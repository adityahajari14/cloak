export type VenueContactTemplateId = "billing_followup" | "cancellation_followup" | "custom";

export type VenueContactTemplate = {
  id: VenueContactTemplateId;
  label: string;
  subject: string;
  body: (venueName: string) => string;
};

export const VENUE_CONTACT_TEMPLATES: VenueContactTemplate[] = [
  {
    id: "billing_followup",
    label: "Billing follow-up",
    subject: "Action needed: update your payment details",
    body: (venueName) =>
      `We noticed there's an issue with the billing on your Cloak account for ${venueName}.\n\n` +
      `Could you take a moment to check your payment details are up to date? If your card has expired or a recent payment didn't go through, updating it will keep your account in good standing.\n\n` +
      `If you've already sorted this or have any questions, just reply to this email and we'll help sort it out.`,
  },
  {
    id: "cancellation_followup",
    label: "Cancellation follow-up",
    subject: "Following up on your cancellation request",
    body: (venueName) =>
      `We saw that you've requested to cancel your Cloak subscription for ${venueName}.\n\n` +
      `Before your subscription ends, we wanted to check in — is there anything we could do differently, or any issue we could help resolve? We'd genuinely like to keep you on board if there's a way to make Cloak work better for you.\n\n` +
      `If you'd still like to go ahead with cancelling, no problem at all — just let us know and we'll take care of the rest.`,
  },
  {
    id: "custom",
    label: "Custom message",
    subject: "",
    body: () => "",
  },
];

export function getVenueContactTemplate(id: VenueContactTemplateId): VenueContactTemplate {
  return VENUE_CONTACT_TEMPLATES.find((t) => t.id === id) ?? VENUE_CONTACT_TEMPLATES[2];
}
