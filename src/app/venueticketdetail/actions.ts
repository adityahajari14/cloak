"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { requireVenueAccess } from "@/lib/auth/guards";
import { sendEmail, getSiteUrl } from "@/lib/email";
import { TicketForgottenEmail } from "@/lib/emails/TicketForgottenEmail";
import { sendWhatsAppItemsForgotten } from "@/lib/whatsapp";

export async function collectItemsFromDetail(
  ticketId: string,
  itemIds: string[],
): Promise<{ ok: boolean; allCollected: boolean }> {
  if (!isSupabaseAdminConfigured() || itemIds.length === 0) {
    return { ok: false, allCollected: false };
  }

  const guard = await requireVenueAccess("/venueticketdetail");
  if (guard.status !== "authorized") return { ok: false, allCollected: false };

  const allowedVenueIds = guard.venueRoles.map((r) => r.venueId);
  const supabase = createAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, venue_id, status")
    .eq("id", ticketId)
    .in("venue_id", allowedVenueIds)
    .maybeSingle();

  if (!ticket) return { ok: false, allCollected: false };

  const now = new Date().toISOString();

  await supabase
    .from("ticket_items")
    .update({ collected_at: now, collected_by: guard.userId })
    .in("id", itemIds)
    .eq("ticket_id", ticketId);

  // Check if all items are now collected
  const { data: remaining } = await supabase
    .from("ticket_items")
    .select("id")
    .eq("ticket_id", ticketId)
    .is("collected_at", null);

  const allCollected = (remaining?.length ?? 0) === 0;

  if (allCollected) {
    await supabase
      .from("tickets")
      .update({ status: "collected", collected_at: now })
      .eq("id", ticketId);
  } else {
    await supabase
      .from("tickets")
      .update({ status: "partially_collected" })
      .eq("id", ticketId);
  }

  revalidatePath(`/venueticketdetail`);
  revalidatePath("/venuedashboard");

  return { ok: true, allCollected };
}

export type ContactChannel = "email" | "whatsapp";

export type TicketContactLogEntry = {
  id: string;
  channel: ContactChannel;
  createdAt: string;
};

/**
 * Notify a guest that their items are still waiting after their event ended
 * without them collecting. Logs the attempt so staff can see who was already
 * contacted, and when.
 */
export async function contactGuestAboutForgottenTicket(
  ticketId: string,
  channel: ContactChannel,
): Promise<{ ok: boolean }> {
  if (!isSupabaseAdminConfigured()) return { ok: false };

  const guard = await requireVenueAccess("/venueticketdetail");
  if (guard.status !== "authorized") return { ok: false };

  const allowedVenueIds = guard.venueRoles.map((r) => r.venueId);
  const supabase = createAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, venue_id, guest_name, guest_email, guest_phone, public_code, status")
    .eq("id", ticketId)
    .in("venue_id", allowedVenueIds)
    .maybeSingle();

  if (!ticket) return { ok: false };

  const { data: venue } = await supabase
    .from("venues")
    .select("name, address, city")
    .eq("id", ticket.venue_id)
    .maybeSingle();

  const venueName = venue?.name ?? "the venue";
  const venueAddress = [venue?.address, venue?.city].filter(Boolean).join(", ") || null;
  const ticketUrl = `${getSiteUrl()}/ticket?code=${encodeURIComponent(ticket.public_code)}`;

  if (channel === "email") {
    if (!ticket.guest_email) return { ok: false };
    await sendEmail({
      to: ticket.guest_email,
      subject: `Your items are still waiting at ${venueName}`,
      react: TicketForgottenEmail({
        guestName: ticket.guest_name,
        publicCode: ticket.public_code,
        ticketUrl,
        venueAddress,
        venueName,
      }),
    });
  } else {
    await sendWhatsAppItemsForgotten({
      guestName: ticket.guest_name,
      phone: ticket.guest_phone,
      publicCode: ticket.public_code,
      venueName,
    });
  }

  await supabase.from("ticket_contacts").insert({
    channel,
    contacted_by: guard.userId,
    ticket_id: ticketId,
  });

  revalidatePath("/venueticketdetail");

  return { ok: true };
}

export async function getTicketContactLog(ticketId: string): Promise<TicketContactLogEntry[]> {
  if (!isSupabaseAdminConfigured()) return [];

  const guard = await requireVenueAccess("/venueticketdetail");
  if (guard.status !== "authorized") return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ticket_contacts")
    .select("id, channel, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    channel: row.channel,
    createdAt: row.created_at,
    id: row.id,
  }));
}
