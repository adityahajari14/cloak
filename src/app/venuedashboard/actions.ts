"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { requireVenueAccess } from "@/lib/auth/guards";
import {
  endEvent as endEventCore,
  resetEvent as resetEventCore,
  startEvent as startEventCore,
} from "@/lib/events";

function revalidateEventSurfaces() {
  revalidatePath("/venuedashboard");
  revalidatePath("/venueevents");
}

export async function startEvent(eventId: string): Promise<void> {
  const guard = await requireVenueAccess("/venuedashboard");
  if (guard.status !== "authorized") return;

  await startEventCore(eventId, guard);
  revalidateEventSurfaces();
}

export async function endEvent(eventId: string): Promise<void> {
  const guard = await requireVenueAccess("/venuedashboard");
  if (guard.status !== "authorized") return;

  await endEventCore(eventId, guard);
  revalidateEventSurfaces();
}

export async function resetEvent(eventId: string): Promise<void> {
  const guard = await requireVenueAccess("/venuedashboard");
  if (guard.status !== "authorized") return;

  await resetEventCore(eventId, guard);
  revalidateEventSurfaces();
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
