import "server-only";

const API_VERSION = "v19.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function getConfig(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

// E.164 phone numbers must be sent without the leading +.
function toWhatsAppNumber(phone: string): string {
  return phone.replace(/^\+/, "");
}

async function sendTemplate(
  to: string,
  templateName: string,
  components: object[],
): Promise<void> {
  // In test mode Meta only allows the built-in hello_world template.
  // Set WHATSAPP_TEST_MODE=true in .env.local while using the Meta test number.
  const testMode = process.env.WHATSAPP_TEST_MODE === "true";
  const config = getConfig();
  if (!config) return;

  const resolvedName = testMode ? "hello_world" : templateName;
  const resolvedComponents = testMode ? [] : components;
  // hello_world uses en_US; production templates use en_GB.
  const resolvedLanguage = testMode ? "en_US" : "en_GB";

  try {
    const res = await fetch(`${BASE_URL}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toWhatsAppNumber(to),
        type: "template",
        template: {
          name: resolvedName,
          language: { code: resolvedLanguage },
          components: resolvedComponents,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[whatsapp] ${resolvedName} failed (${res.status}):`, body);
    }
  } catch (err) {
    console.error(`[whatsapp] ${resolvedName} error:`, err);
  }
}

/**
 * Sent when a guest creates a cloakroom pass (pending_activation).
 * Template: cloak_pass_issued
 * Body variables: {{1}} guest name, {{2}} venue name, {{3}} pass code
 */
export async function sendWhatsAppPassIssued({
  phone,
  guestName,
  venueName,
  publicCode,
}: {
  phone: string;
  guestName: string;
  venueName: string;
  publicCode: string;
}): Promise<void> {
  await sendTemplate(phone, "cloak_pass_issued", [
    {
      type: "body",
      parameters: [
        { type: "text", text: guestName },
        { type: "text", text: venueName },
        { type: "text", text: publicCode },
      ],
    },
  ]);
}

/**
 * Sent when staff activate a ticket and log items into storage.
 * Template: cloak_items_stored
 * Body variables: {{1}} guest name, {{2}} item count, {{3}} slot number, {{4}} venue name
 */
export async function sendWhatsAppItemsStored({
  phone,
  guestName,
  itemCount,
  slotNumber,
  venueName,
}: {
  phone: string;
  guestName: string;
  itemCount: number;
  slotNumber: string;
  venueName: string;
}): Promise<void> {
  await sendTemplate(phone, "cloak_items_stored", [
    {
      type: "body",
      parameters: [
        { type: "text", text: guestName },
        { type: "text", text: String(itemCount) },
        { type: "text", text: slotNumber },
        { type: "text", text: venueName },
      ],
    },
  ]);
}

/**
 * Sent when staff complete a checkout (full or partial collection).
 * Template: cloak_items_collected
 * Body variables: {{1}} guest name, {{2}} collected count, {{3}} venue name
 */
export async function sendWhatsAppItemsCollected({
  phone,
  guestName,
  collectedCount,
  venueName,
}: {
  phone: string;
  guestName: string;
  collectedCount: number;
  venueName: string;
}): Promise<void> {
  await sendTemplate(phone, "cloak_items_collected", [
    {
      type: "body",
      parameters: [
        { type: "text", text: guestName },
        { type: "text", text: String(collectedCount) },
        { type: "text", text: venueName },
      ],
    },
  ]);
}

/**
 * Sent when staff manually follow up on a forgotten ticket — items still
 * stored after the event ended without the guest collecting them.
 * Template: cloak_items_forgotten
 * Body variables: {{1}} guest name, {{2}} venue name, {{3}} pass code
 */
export async function sendWhatsAppItemsForgotten({
  phone,
  guestName,
  venueName,
  publicCode,
}: {
  phone: string;
  guestName: string;
  venueName: string;
  publicCode: string;
}): Promise<void> {
  await sendTemplate(phone, "cloak_items_forgotten", [
    {
      type: "body",
      parameters: [
        { type: "text", text: guestName },
        { type: "text", text: venueName },
        { type: "text", text: publicCode },
      ],
    },
  ]);
}
