import * as React from "react";
import { EmailLayout, Heading, Subheading, P, Divider, Field, Button } from "./layout";

export type GuestTicketEmailProps = {
  guestName: string;
  venueName: string;
  venueAddress: string | null;
  publicCode: string;
  ticketUrl: string;
  expiresAt: string | null;
  cloakClubUrl?: string;
};

export function GuestTicketEmail({
  guestName,
  venueName,
  venueAddress,
  publicCode,
  ticketUrl,
  expiresAt,
  cloakClubUrl,
}: GuestTicketEmailProps) {
  const expiry = expiresAt && new Date(expiresAt).getFullYear() < 9999
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(expiresAt))
    : null;

  return (
    <EmailLayout preview={`Your Cloak cloakroom pass for ${venueName}`}>
      <Heading>Your cloakroom pass is ready.</Heading>
      <Subheading>Hi {guestName} — here's your digital pass for {venueName}.</Subheading>

      <Button href={ticketUrl}>Open my pass</Button>

      <Divider />

      <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
        <tbody>
          <Field label="Venue" value={venueName} />
          {venueAddress ? <Field label="Address" value={venueAddress} /> : null}
          <Field label="Pass code" value={publicCode} />
          {expiry ? <Field label="Valid until" value={expiry} /> : null}
        </tbody>
      </table>

      <Divider />

      <P>
        Show the QR code or tell staff your pass code <strong>{publicCode}</strong> when
        you drop off or collect your items. Keep this email as a backup.
      </P>
      <P style={{ color: "#71717a", fontSize: 13 } as React.CSSProperties}>
        If you did not create this pass, you can ignore this email — no action is needed.
      </P>

      {cloakClubUrl ? (
        <>
          <Divider />
          <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
            <tbody>
              <tr>
                <td
                  style={{
                    backgroundColor: "#f4f4f5",
                    borderRadius: 10,
                    padding: "18px 20px",
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#09090b" }}>
                    ✨ Skip the form next time
                  </p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#71717a", lineHeight: 1.5 }}>
                    Join Cloak Club for a permanent wallet pass that works at every venue.
                  </p>
                  <a
                    href={cloakClubUrl}
                    style={{
                      display: "inline-block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#09090b",
                      textDecoration: "underline",
                    }}
                  >
                    Get my lifetime pass →
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : null}
    </EmailLayout>
  );
}
