"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVenueAccess } from "@/lib/auth/guards";
import {
  endEvent as endEventCore,
  resetEvent as resetEventCore,
  startEvent as startEventCore,
} from "@/lib/events";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Guest limit: blank means unlimited. Anything not a positive number is treated as blank. */
function readCapacity(formData: FormData): number | null {
  const raw = readField(formData, "guestCapacity");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function fail(message: string): never {
  redirect(`/venueevents?error=${encodeURIComponent(message)}`);
}

function managerVenueIds(venueRoles: Array<{ venueId: string; role: string }>) {
  return [...new Set(venueRoles.filter((r) => r.role === "manager").map((r) => r.venueId))];
}

function done(message: string): never {
  revalidatePath("/venueevents");
  revalidatePath("/venuedashboard");
  redirect(`/venueevents?message=${encodeURIComponent(message)}`);
}

export async function createEvent(formData: FormData) {
  const guard = await requireVenueAccess("/venueevents", ["manager"]);
  if (guard.status !== "authorized") fail("Sign in as a venue manager to manage events.");
  if (!isSupabaseAdminConfigured()) fail("Events are temporarily unavailable.");

  const name = readField(formData, "name");
  const eventDate = readField(formData, "eventDate");
  const startsAt = readField(formData, "startsAt");
  const endsAt = readField(formData, "endsAt");
  const guestCapacity = readCapacity(formData);

  if (!name || !eventDate) fail("Event name and date are required.");

  const venueIds = managerVenueIds(guard.venueRoles);
  const requestedVenueId = readField(formData, "venueId");
  const venueId = requestedVenueId && venueIds.includes(requestedVenueId)
    ? requestedVenueId
    : venueIds[0];
  if (!venueId) fail("No venue is associated with your account.");

  const supabase = createAdminClient();
  // Created as "scheduled": on the calendar and shareable, but not yet taking
  // check-ins. The manager opens it with Start.
  const { error } = await supabase.from("events").insert({
    ends_at: endsAt ? new Date(`${eventDate}T${endsAt}`).toISOString() : null,
    event_date: eventDate,
    guest_capacity: guestCapacity,
    name,
    starts_at: startsAt ? new Date(`${eventDate}T${startsAt}`).toISOString() : null,
    status: "scheduled",
    venue_id: venueId,
  });

  if (error) fail("Could not create the event. Please try again.");

  done("Event created. Share its QR now — it starts accepting guests when you press Start.");
}

export async function updateEvent(formData: FormData) {
  const guard = await requireVenueAccess("/venueevents", ["manager"]);
  if (guard.status !== "authorized") fail("Sign in as a venue manager to manage events.");
  if (!isSupabaseAdminConfigured()) fail("Events are temporarily unavailable.");

  const eventId = readField(formData, "eventId");
  const name = readField(formData, "name");
  const eventDate = readField(formData, "eventDate");
  const startsAt = readField(formData, "startsAt");
  const endsAt = readField(formData, "endsAt");
  const guestCapacity = readCapacity(formData);

  if (!eventId) fail("Missing event.");
  if (!name || !eventDate) fail("Event name and date are required.");

  const venueIds = managerVenueIds(guard.venueRoles);
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("events")
    .select("status, event_date")
    .eq("id", eventId)
    .in("venue_id", venueIds)
    .maybeSingle();

  if (!existing) fail("Could not find that event.");

  // An ended event has settled tickets attached to its date — moving it would
  // silently re-file that history under a different night.
  if (existing.status === "ended" && eventDate !== existing.event_date) {
    fail("Cannot change the date of an event that has already ended.");
  }

  // Lowering the guest limit below current occupancy is allowed on purpose: a
  // manager cutting capacity mid-event (fire marshal, staffing) needs it to take
  // effect immediately. It stops new check-ins; it never invalidates items
  // already stored.
  const { error } = await supabase
    .from("events")
    .update({
      ends_at: endsAt ? new Date(`${eventDate}T${endsAt}`).toISOString() : null,
      event_date: eventDate,
      guest_capacity: guestCapacity,
      name,
      starts_at: startsAt ? new Date(`${eventDate}T${startsAt}`).toISOString() : null,
    })
    .eq("id", eventId)
    .in("venue_id", venueIds);

  if (error) fail("Could not update the event.");

  done("Event updated.");
}

export async function deleteEvent(formData: FormData) {
  const guard = await requireVenueAccess("/venueevents", ["manager"]);
  if (guard.status !== "authorized") fail("Sign in as a venue manager to manage events.");
  if (!isSupabaseAdminConfigured()) fail("Events are temporarily unavailable.");

  const eventId = readField(formData, "eventId");
  if (!eventId) fail("Missing event.");

  const venueIds = managerVenueIds(guard.venueRoles);
  const supabase = createAdminClient();

  // Only allow deleting events with no tickets
  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (count && count > 0) fail("Cannot delete an event that has tickets.");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .in("venue_id", venueIds);

  if (error) fail("Could not delete the event.");

  done("Event deleted.");
}

export async function startEvent(formData: FormData) {
  const guard = await requireVenueAccess("/venueevents", ["manager"]);
  if (guard.status !== "authorized") fail("Sign in as a venue manager to manage events.");

  const eventId = readField(formData, "eventId");
  if (!eventId) fail("Missing event.");

  await startEventCore(eventId, guard);
  done("Event started. Guests can now check in.");
}

export async function endEvent(formData: FormData) {
  const guard = await requireVenueAccess("/venueevents", ["manager"]);
  if (guard.status !== "authorized") fail("Sign in as a venue manager to manage events.");

  const eventId = readField(formData, "eventId");
  if (!eventId) fail("Missing event.");

  await endEventCore(eventId, guard);
  done("Event ended. Uncollected items are flagged as forgotten.");
}

export async function resetEvent(formData: FormData) {
  const guard = await requireVenueAccess("/venueevents", ["manager"]);
  if (guard.status !== "authorized") fail("Sign in as a venue manager to manage events.");

  const eventId = readField(formData, "eventId");
  if (!eventId) fail("Missing event.");

  await resetEventCore(eventId, guard);
  done("Event reopened and tickets restored.");
}
