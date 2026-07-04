import { EmailLayout, Heading, Subheading, P, Divider, Field, Button } from "./layout";

export type TicketForgottenEmailProps = {
  guestName: string;
  venueName: string;
  venueAddress: string | null;
  publicCode: string;
  ticketUrl: string;
};

export function TicketForgottenEmail({
  guestName,
  venueName,
  venueAddress,
  publicCode,
  ticketUrl,
}: TicketForgottenEmailProps) {
  return (
    <EmailLayout preview={`Your items are still waiting for you at ${venueName}`}>
      <Heading>We still have your items.</Heading>
      <Subheading>
        Hi {guestName} — the event at {venueName} has ended, but your cloakroom items are still
        safely stored and waiting for you to collect.
      </Subheading>

      <Button href={ticketUrl}>View my pass</Button>

      <Divider />

      <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
        <tbody>
          <Field label="Venue" value={venueName} />
          {venueAddress ? <Field label="Address" value={venueAddress} /> : null}
          <Field label="Pass code" value={publicCode} />
        </tbody>
      </table>

      <Divider />

      <P>
        Please contact the venue directly or visit in person to arrange collecting your items.
        Show your QR code or pass code <strong>{publicCode}</strong> when you arrive.
      </P>
    </EmailLayout>
  );
}
