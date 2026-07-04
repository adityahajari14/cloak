import { EmailLayout, Heading, Subheading, P, Divider, Button } from "./layout";

export type CloakClubWelcomeEmailProps = {
  guestName: string;
  passUrl: string;
};

export function CloakClubWelcomeEmail({ guestName, passUrl }: CloakClubWelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to Cloak Club — add your permanent pass to Wallet">
      <Heading>Welcome to Cloak Club.</Heading>
      <Subheading>
        Hi {guestName} — you now have a permanent Cloak pass that works at any Cloak venue.
      </Subheading>

      <Button href={passUrl}>Add my pass to Wallet</Button>

      <Divider />

      <P>
        Your Cloak Club pass lives in your mobile wallet and refreshes after each visit —
        no need to sign up again. Just show it at the counter at any participating venue.
      </P>
      <P style={{ color: "#71717a", fontSize: 13 }}>
        If you did not join Cloak Club, you can ignore this email — no action is needed.
      </P>
    </EmailLayout>
  );
}
