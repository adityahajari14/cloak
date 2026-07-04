export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import { getPublicTicketByCode, getPublicTicketByToken } from "@/lib/tickets";
import { getMemberByToken } from "@/lib/membership";

function isConfigured() {
  return !!(
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_CERT_PEM &&
    process.env.APPLE_PASS_KEY_PEM &&
    process.env.APPLE_WWDR_PEM
  );
}

// Minimal 1x1 white PNG for required icon slots
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==",
  "base64",
);

// Sign a pass.json object and return it as a .pkpass download response.
async function pkpassResponse(passJson: object, filename: string) {
  const fixPem = (s: string) => s.replace(/\\n/g, "\n");
  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": BLANK_PNG,
      "icon@2x.png": BLANK_PNG,
      "icon@3x.png": BLANK_PNG,
    },
    {
      wwdr: fixPem(process.env.APPLE_WWDR_PEM!),
      signerCert: fixPem(process.env.APPLE_PASS_CERT_PEM!),
      signerKey: fixPem(process.env.APPLE_PASS_KEY_PEM!),
    },
  );

  const buffer = await pass.getAsBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${filename}.pkpass"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet is not configured on this server." },
      { status: 503 },
    );
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const member = searchParams.get("member");

  // ── Cloak Club membership pass — permanent, venue-agnostic ──────────────────
  if (member) {
    const memberRecord = await getMemberByToken(member);
    if (!memberRecord) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }

    const memberPass = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      organizationName: "Cloak",
      description: "Cloak Club membership",
      serialNumber: `member-${memberRecord.id}`,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(24, 24, 27)",
      labelColor: "rgb(161, 161, 170)",
      generic: {
        primaryFields: [{ key: "club", label: "CLOAK CLUB", value: "Lifetime member" }],
        secondaryFields: [{ key: "member", label: "MEMBER", value: memberRecord.fullName }],
        backFields: [
          { key: "email", label: "Email", value: memberRecord.email },
          { key: "mobile", label: "Mobile", value: memberRecord.phone },
        ],
      },
      barcodes: [
        {
          message: member,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
          altText: "Cloak Club",
        },
      ],
    };

    try {
      return await pkpassResponse(memberPass, `cloak-club-${memberRecord.id}`);
    } catch (err) {
      console.error("[apple-wallet:member]", err);
      return NextResponse.json({ error: "Failed to generate pass." }, { status: 500 });
    }
  }

  const result = code
    ? await getPublicTicketByCode(code)
    : token
      ? await getPublicTicketByToken(token)
      : { status: "invalid" as const, ticket: null };

  if (!result.ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const t = result.ticket;
  const expiryDate = new Date(t.expiresAt);

  // Build the pass.json content
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
    teamIdentifier: process.env.APPLE_TEAM_ID!,
    organizationName: "Cloak",
    description: "Cloak cloakroom ticket",
    serialNumber: t.ticketId,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(24, 24, 27)",
    labelColor: "rgb(161, 161, 170)",
    expirationDate: expiryDate.toISOString(),
    generic: {
      primaryFields: [
        {
          key: "venue",
          label: "VENUE",
          value: t.venueName,
        },
      ],
      secondaryFields: [
        {
          key: "guest",
          label: "GUEST",
          value: t.guestName,
        },
        {
          key: "items",
          label: "ITEMS",
          value: t.itemType ?? "Items",
        },
      ],
      auxiliaryFields: [
        {
          key: "status",
          label: "STATUS",
          value:
            t.status === "active" || t.status === "forgotten"
              ? "Stored"
              : t.status === "pending_activation"
                ? "Awaiting activation"
                : t.status === "collected"
                  ? "Collected"
                  : t.status,
        },
        ...(t.storageLocation
          ? [{ key: "cloak", label: "CLOAK NO.", value: t.storageLocation }]
          : []),
      ],
      backFields: [
        { key: "ticketId", label: "Ticket ID", value: t.ticketId },
        { key: "email", label: "Email", value: t.email },
        { key: "mobile", label: "Mobile", value: t.mobile },
        {
          key: "expires",
          label: "Expires",
          value: expiryDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        },
      ],
    },
    barcodes: [
      {
        message: t.ticketId,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: t.ticketId,
      },
    ],
  };

  try {
    return await pkpassResponse(passJson, `cloak-${t.ticketId}`);
  } catch (err) {
    console.error("[apple-wallet]", err);
    return NextResponse.json({ error: "Failed to generate pass." }, { status: 500 });
  }
}
