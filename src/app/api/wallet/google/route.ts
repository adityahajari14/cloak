export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getPublicTicketByCode, getPublicTicketByToken } from "@/lib/tickets";
import { getMemberByToken } from "@/lib/membership";

function isConfigured() {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Google Wallet is not configured on this server." },
      { status: 503 },
    );
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const member = searchParams.get("member");

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;

  // ── Cloak Club membership pass — permanent, venue-agnostic ──────────────────
  if (member) {
    const memberRecord = await getMemberByToken(member);
    if (!memberRecord) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }

    const classId = `${issuerId}.cloak_ticket`;
    const objectId = `${issuerId}.member_${memberRecord.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const origin = siteUrl.startsWith("http") ? new URL(siteUrl).origin : "http://localhost:3000";

    const memberObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      cardTitle: { defaultValue: { language: "en", value: "Cloak Club" } },
      header: { defaultValue: { language: "en", value: memberRecord.fullName } },
      subheader: { defaultValue: { language: "en", value: "Lifetime member" } },
      textModulesData: [
        { id: "member", header: "MEMBER", body: memberRecord.fullName },
        { id: "email", header: "EMAIL", body: memberRecord.email },
      ],
      barcode: {
        type: "QR_CODE",
        value: member,
        alternateText: "Cloak Club",
      },
      hexBackgroundColor: "#18181b",
    };

    const memberPayload = {
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      aud: "google",
      origins: [origin],
      typ: "savetowallet",
      payload: { genericObjects: [memberObject] },
    };

    const memberKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
    const memberJwt = jwt.sign(memberPayload, memberKey, { algorithm: "RS256" });
    return NextResponse.redirect(`https://pay.google.com/gp/v/save/${memberJwt}`, { status: 302 });
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
  const classId = `${issuerId}.cloak_ticket`;
  const objectId = `${issuerId}.${t.ticketId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    cardTitle: {
      defaultValue: { language: "en", value: "Cloak" },
    },
    header: {
      defaultValue: { language: "en", value: t.venueName },
    },
    subheader: {
      defaultValue: {
        language: "en",
        value:
          t.status === "active" || t.status === "forgotten"
            ? `Stored — ${t.storageLocation ?? t.itemType ?? "Items"}`
            : t.status === "pending_activation"
              ? "Awaiting activation"
              : t.status === "collected"
                ? "Collected"
                : t.status ?? "Cloak ticket",
      },
    },
    textModulesData: [
      { id: "guest", header: "GUEST", body: t.guestName },
      { id: "items", header: "ITEMS", body: t.itemType ?? "Items" },
      { id: "ticket_id", header: "TICKET ID", body: t.ticketId },
      { id: "email", header: "EMAIL", body: t.email },
      ...(t.storageLocation
        ? [{ id: "cloak_no", header: "CLOAK NO.", body: t.storageLocation }]
        : []),
    ],
    barcode: {
      type: "QR_CODE",
      value: t.ticketId,
      alternateText: t.ticketId,
    },
    validTimeInterval: {
      end: { date: new Date(t.expiresAt).toISOString() },
    },
    hexBackgroundColor: "#18181b",
  };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const origin = siteUrl.startsWith("http") ? new URL(siteUrl).origin : "http://localhost:3000";

  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    aud: "google",
    origins: [origin],
    typ: "savetowallet",
    payload: {
      genericObjects: [genericObject],
    },
  };

  // Replace escaped newlines in the private key (common when stored in env vars)
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const token_jwt = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
  });

  // Debug mode: show the decoded JWT payload Google will receive
  if (searchParams.get("debug") === "1") {
    return NextResponse.json({
      classId,
      objectId,
      issuerId,
      origin,
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      payload,
      saveUrl: `https://pay.google.com/gp/v/save/${token_jwt}`,
    });
  }

  const saveUrl = `https://pay.google.com/gp/v/save/${token_jwt}`;
  return NextResponse.redirect(saveUrl, { status: 302 });
}
