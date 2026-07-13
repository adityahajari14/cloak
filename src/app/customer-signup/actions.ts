"use server";

import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createPublicCode, createTicketToken } from "@/lib/tickets";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { sendEmail, getSiteUrl } from "@/lib/email";
import { GuestTicketEmail } from "@/lib/emails/GuestTicketEmail";
import { sendWhatsAppPassIssued } from "@/lib/whatsapp";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`/customer-signup?error=${encodeURIComponent(message)}`);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createGuestTicket(formData: FormData) {
  const venueId = readField(formData, "venue");
  const fullName = readField(formData, "fullName");
  const email = normalizeEmail(readField(formData, "email"));
  const mobile = readField(formData, "mobile");
  const eventId = readField(formData, "event");

  if (!isSupabaseAdminConfigured()) {
    fail("Ticket creation is temporarily unavailable.");
  }

  if (!venueId || !fullName || !email || !mobile) {
    fail("Please complete all required details.");
  }

  if (!isValidEmail(email)) {
    fail("Please enter a valid email address.");
  }

  if (!isValidPhone(mobile)) {
    fail("Please enter a valid mobile number.");
  }

  const supabase = createAdminClient();
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, ticket_expiry_hours, accepting_checkins")
    .eq("id", venueId)
    .eq("active", true)
    .in("billing_status", ["trialing", "active"])
    .maybeSingle();

  if (venueError || !venue) {
    fail("Please select an available venue.");
  }

  // Enforced here as well as in the venue list: a guest holding a stale form or
  // a pre-shared event QR must not be able to check in after the venue has
  // paused, so the pause has to hold at the point of creation.
  if (!venue.accepting_checkins) {
    fail("This venue has paused check-ins and is not accepting new items right now.");
  }

  const { data: contact, error: contactError } = await supabase
    .from("guest_contacts")
    .upsert(
      {
        email,
        email_normalized: email,
        full_name: fullName,
        phone: mobile,
      },
      { onConflict: "email_normalized" },
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    fail("We could not save your contact details. Please try again.");
  }

  // Only attach the event if it belongs to this venue and is still active.
  let validEventId: string | null = null;
  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("venue_id", venue.id)
      .eq("active", true)
      .maybeSingle();
    validEventId = event?.id ?? null;
  }

  const publicCode = createPublicCode();
  const ticketToken = createTicketToken();
  const expiryHours = venue.ticket_expiry_hours;
  const expiresAt = expiryHours !== null
    ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
    : new Date("9999-12-31T23:59:59Z").toISOString();
  const { error: ticketError } = await supabase.from("tickets").insert({
    event_id: validEventId,
    expires_at: expiresAt,
    guest_contact_id: contact.id,
    guest_email: email,
    guest_name: fullName,
    guest_phone: mobile,
    public_code: publicCode,
    qr_token_hash: ticketToken.hash,
    venue_id: venue.id,
  });

  if (ticketError) {
    fail("We could not create your ticket. Please try again.");
  }

  const ticketUrl = `${getSiteUrl()}/ticket?token=${encodeURIComponent(ticketToken.token)}`;

  // Fetch venue address for the email — non-blocking, best-effort.
  const { data: venueRow } = await supabase
    .from("venues")
    .select("name, address, city")
    .eq("id", venue.id)
    .maybeSingle();

  const venueAddress = [venueRow?.address, venueRow?.city].filter(Boolean).join(", ") || null;

  const resolvedVenueName = venueRow?.name ?? "your venue";

  await Promise.all([
    sendEmail({
      to: email,
      subject: `Your Cloak pass for ${resolvedVenueName}`,
      react: GuestTicketEmail({
        cloakClubUrl: `${getSiteUrl()}/cloak-club`,
        expiresAt: expiresAt,
        guestName: fullName,
        publicCode,
        ticketUrl,
        venueAddress,
        venueName: resolvedVenueName,
      }),
    }),
    sendWhatsAppPassIssued({
      phone: mobile,
      guestName: fullName,
      venueName: resolvedVenueName,
      publicCode,
    }),
  ]);

  redirect(ticketUrl);
}
