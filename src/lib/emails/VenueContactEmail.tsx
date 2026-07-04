import { EmailLayout, Heading, P } from "./layout";

export type VenueContactEmailProps = {
  venueName: string;
  message: string;
};

/**
 * Wraps an admin's free-text message (from a preset template or custom
 * compose) in the standard Cloak email layout. The message may contain
 * multiple paragraphs separated by blank lines.
 */
export function VenueContactEmail({ venueName, message }: VenueContactEmailProps) {
  const paragraphs = message.split(/\n\s*\n/).filter(Boolean);

  return (
    <EmailLayout preview={`A message from the Cloak team about ${venueName}`}>
      <Heading>Hi {venueName},</Heading>
      {paragraphs.map((p, i) => (
        <P key={i}>{p}</P>
      ))}
      <P style={{ color: "#71717a", fontSize: 13 }}>— The Cloak team</P>
    </EmailLayout>
  );
}
