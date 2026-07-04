"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { requireVenueAccess } from "@/lib/auth/guards";

export async function endEvent(eventId: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;

  const guard = await requireVenueAccess("/venuedashboard");
  if (guard.status !== "authorized") return;

  const allowedVenueIds = guard.venueRoles
    .filter((r) => r.role === "manager")
    .map((r) => r.venueId);
  if (allowedVenueIds.length === 0) return;

  const supabase = createAdminClient();

  // Mark event as inactive
  await supabase
    .from("events")
    .update({ active: false })
    .eq("id", eventId)
    .in("venue_id", allowedVenueIds);

  // Mark every ticket on this event that never made it to "collected" as
  // forgotten — whether it was never activated, still fully stored, or only
  // partially returned. Items may still be sitting in the cloakroom; staff
  // can still check them out normally, "forgotten" just flags that the event
  // ended without the guest coming back for them.
  await supabase
    .from("tickets")
    .update({ status: "forgotten" })
    .eq("event_id", eventId)
    .in("status", ["pending_activation", "active", "partially_collected"])
    .in("venue_id", allowedVenueIds);

  revalidatePath("/venuedashboard");
}


export async function deletePendingTicket(ticketId: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;

  const guard = await requireVenueAccess("/venuedashboard");
  if (guard.status !== "authorized") return;

  const allowedVenueIds = guard.venueRoles.map((r) => r.venueId);
  const supabase = createAdminClient();

  // Only allow deleting tickets that are pending (never activated) and belong to this venue
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, venue_id, status")
    .eq("id", ticketId)
    .eq("status", "pending_activation")
    .in("venue_id", allowedVenueIds)
    .maybeSingle();

  if (!ticket) return;

  await supabase.from("ticket_items").delete().eq("ticket_id", ticketId);
  await supabase.from("tickets").delete().eq("id", ticketId);

  revalidatePath("/venuedashboard");
}
