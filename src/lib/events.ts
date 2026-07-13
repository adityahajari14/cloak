import "server-only";

import type { AuthorizedContext } from "@/lib/auth/guards";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { OCCUPYING_STATUSES } from "@/lib/scanner-core";
import type { Database } from "@/lib/supabase/database.types";

export type EventStatus = Database["public"]["Enums"]["event_status"];

/** Statuses endEvent overwrites, and therefore the only ones resetEvent restores. */
const END_AFFECTED_STATUSES = ["pending_activation", "active", "partially_collected"] as const;

export type VenueEvent = {
  id: string;
  name: string;
  eventDate: string;
  startsAt: string | null;
  endsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: EventStatus;
  active: boolean;
  ticketCount: number;
  guestCapacity: number | null;
  guestsOccupying: number;
  venueId: string;
  venueName: string;
};

export type PublicEventOption = {
  id: string;
  name: string;
  eventDate: string;
};

function getManagerVenueIds(context: AuthorizedContext): string[] {
  return [
    ...new Set(
      context.venueRoles.filter((r) => r.role === "manager").map((r) => r.venueId),
    ),
  ];
}

/** Manager-facing: all events for the manager's venue(s), newest first. */
export async function getVenueEvents(context: AuthorizedContext): Promise<VenueEvent[]> {
  if (!isSupabaseAdminConfigured()) return [];

  const venueIds = getManagerVenueIds(context);
  if (venueIds.length === 0) return [];

  await closeStaleEvents(venueIds);

  const supabase = createAdminClient();
  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, name, event_date, starts_at, ends_at, started_at, ended_at, status, active, guest_capacity, venue_id, venues(name)",
    )
    .in("venue_id", venueIds)
    .order("event_date", { ascending: false })
    .limit(100);

  const events = rawEvents as Array<{
    id: string;
    name: string;
    event_date: string;
    starts_at: string | null;
    ends_at: string | null;
    started_at: string | null;
    ended_at: string | null;
    status: EventStatus;
    active: boolean;
    guest_capacity: number | null;
    venue_id: string;
    venues: { name: string } | null;
  }> | null;

  if (!events || events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const { data: tickets } = await supabase
    .from("tickets")
    .select("event_id, status")
    .in("event_id", eventIds);

  // Total tickets ever issued, and — separately — how many guests are currently
  // holding items. Only the latter counts against guest_capacity.
  const counts = new Map<string, number>();
  const occupying = new Map<string, number>();
  (tickets ?? []).forEach((t) => {
    if (!t.event_id) return;
    counts.set(t.event_id, (counts.get(t.event_id) ?? 0) + 1);
    if (OCCUPYING_STATUSES.includes(t.status)) {
      occupying.set(t.event_id, (occupying.get(t.event_id) ?? 0) + 1);
    }
  });

  return events.map((e) => ({
    active: e.active,
    endedAt: e.ended_at,
    endsAt: e.ends_at,
    eventDate: e.event_date,
    guestCapacity: e.guest_capacity,
    guestsOccupying: occupying.get(e.id) ?? 0,
    id: e.id,
    name: e.name,
    startedAt: e.started_at,
    startsAt: e.starts_at,
    status: e.status,
    ticketCount: counts.get(e.id) ?? 0,
    venueId: e.venue_id,
    venueName: (e.venues as { name: string } | null)?.name ?? "",
  }));
}

/** Guest-facing: active events for a venue, used in the check-in dropdown. */
export async function getActiveEventsForVenue(venueId: string): Promise<PublicEventOption[]> {
  if (!isSupabaseAdminConfigured() || !venueId) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, event_date")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("event_date", { ascending: true })
    .limit(50);

  return (
    data?.map((e) => ({
      eventDate: e.event_date,
      id: e.id,
      name: e.name,
    })) ?? []
  );
}

/** Guest-facing: active events for several venues at once (check-in form). */
export async function getActiveEventsForVenues(
  venueIds: string[],
): Promise<Record<string, PublicEventOption[]>> {
  if (!isSupabaseAdminConfigured() || venueIds.length === 0) return {};

  // Sweep first, so an event whose scheduled end has passed is never offered.
  await closeStaleEvents(venueIds);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("events")
    .select("id, venue_id, name, event_date")
    .in("venue_id", venueIds)
    .eq("active", true)
    .order("event_date", { ascending: true });

  const byVenue: Record<string, PublicEventOption[]> = {};
  (data ?? []).forEach((e) => {
    (byVenue[e.venue_id] ??= []).push({
      eventDate: e.event_date,
      id: e.id,
      name: e.name,
    });
  });
  return byVenue;
}

/** Verify an event belongs to a venue and is active (used at ticket creation). */
export async function isEventValidForVenue(eventId: string, venueId: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured() || !eventId) return false;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .eq("active", true)
    .maybeSingle();

  return Boolean(data);
}

// ───────────────────────────────────────────────────────────────────────────
// Lifecycle: start → end → reset
//
// These live here rather than in a page's actions file because both
// /venueevents and /venuedashboard drive them, and they previously diverged:
// the two surfaces each had their own "End event" that did different things.
// ───────────────────────────────────────────────────────────────────────────

/** Venues this context may manage. Every lifecycle write is scoped to these. */
function managerScope(context: AuthorizedContext): string[] {
  return getManagerVenueIds(context);
}

/**
 * Flag every ticket on an event whose items never made it back to the guest.
 * Covers never-activated, still-stored, and partially-returned tickets alike:
 * "forgotten" records that the event ended before the guest came back. The
 * items may still be physically in the cloakroom — staff can still check them
 * out normally, and they keep occupying both their storage slot and their
 * guest capacity slot until they do.
 */
async function flagForgottenTickets(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  venueIds: string[],
) {
  await supabase
    .from("tickets")
    .update({ status: "forgotten" })
    .eq("event_id", eventId)
    .in("status", [...END_AFFECTED_STATUSES])
    .in("venue_id", venueIds);
}

/** Open the cloakroom for this event. Guests can only check in once this runs. */
export async function startEvent(eventId: string, context: AuthorizedContext): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const venueIds = managerScope(context);
  if (venueIds.length === 0) return;

  const supabase = createAdminClient();

  // Preserve the original started_at across an end/reset/start cycle — the
  // first time the doors opened is the interesting fact, not the last.
  const { data: existing } = await supabase
    .from("events")
    .select("started_at")
    .eq("id", eventId)
    .in("venue_id", venueIds)
    .maybeSingle();

  await supabase
    .from("events")
    .update({
      ended_at: null,
      started_at: existing?.started_at ?? new Date().toISOString(),
      status: "live",
    })
    .eq("id", eventId)
    .in("venue_id", venueIds);
}

/**
 * Close the cloakroom. Anything not collected is flagged forgotten — the
 * event is over, but the coats may well still be on the rail.
 */
export async function endEvent(eventId: string, context: AuthorizedContext): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const venueIds = managerScope(context);
  if (venueIds.length === 0) return;

  const supabase = createAdminClient();

  await supabase
    .from("events")
    .update({ ended_at: new Date().toISOString(), status: "ended" })
    .eq("id", eventId)
    .in("venue_id", venueIds);

  await flagForgottenTickets(supabase, eventId, venueIds);
}

/**
 * Undo an End. Reopens the event and restores every ticket endEvent flagged.
 *
 * The pre-end status is re-derived rather than stored, which is safe because
 * endEvent only ever overwrites the three END_AFFECTED_STATUSES and never
 * touches the fields those statuses are computed from:
 *
 *   activated_at is null            → pending_activation (never handed over)
 *   some items collected, some open → partially_collected
 *   otherwise                       → active
 *
 * This is the same rule performCheckout uses when deciding a ticket's status
 * after returning items. Tickets already collected or cancelled were never
 * touched by End, so scoping to status = 'forgotten' leaves them alone.
 */
export async function resetEvent(eventId: string, context: AuthorizedContext): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const venueIds = managerScope(context);
  if (venueIds.length === 0) return;

  const supabase = createAdminClient();

  const { data: forgotten } = await supabase
    .from("tickets")
    .select("id, activated_at")
    .eq("event_id", eventId)
    .eq("status", "forgotten")
    .in("venue_id", venueIds);

  if (forgotten && forgotten.length > 0) {
    const { data: items } = await supabase
      .from("ticket_items")
      .select("ticket_id, collected_at")
      .in(
        "ticket_id",
        forgotten.map((t) => t.id),
      );

    const collectedCount = new Map<string, number>();
    const totalCount = new Map<string, number>();
    (items ?? []).forEach((i) => {
      totalCount.set(i.ticket_id, (totalCount.get(i.ticket_id) ?? 0) + 1);
      if (i.collected_at) {
        collectedCount.set(i.ticket_id, (collectedCount.get(i.ticket_id) ?? 0) + 1);
      }
    });

    await Promise.all(
      forgotten.map((ticket) => {
        const total = totalCount.get(ticket.id) ?? 0;
        const collected = collectedCount.get(ticket.id) ?? 0;
        const status = !ticket.activated_at
          ? "pending_activation"
          : total > 0 && collected > 0 && collected < total
            ? "partially_collected"
            : "active";

        return supabase.from("tickets").update({ status }).eq("id", ticket.id);
      }),
    );
  }

  await supabase
    .from("events")
    .update({ ended_at: null, status: "live" })
    .eq("id", eventId)
    .in("venue_id", venueIds);
}

/**
 * End any live event whose scheduled end has passed. A lazy sweep run on read
 * (dashboard load, guest check-in list) rather than a cron.
 *
 * Without this, an event nobody remembered to close stays live forever: it
 * keeps appearing in the guest check-in dropdown, so Friday's event is still
 * taking check-ins on Tuesday.
 */
export async function closeStaleEvents(venueIds: string[]): Promise<void> {
  if (!isSupabaseAdminConfigured() || venueIds.length === 0) return;

  const supabase = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Stale = scheduled to have ended already, or (with no end time set) dated
  // before today. A live event with no ends_at on today's date is left alone —
  // it's still running and only the manager knows when it's over.
  const { data: stale } = await supabase
    .from("events")
    .select("id, ends_at, event_date")
    .eq("status", "live")
    .in("venue_id", venueIds);

  const expired = (stale ?? []).filter((e) =>
    e.ends_at ? new Date(e.ends_at) < now : e.event_date < today,
  );
  if (expired.length === 0) return;

  await supabase
    .from("events")
    .update({ ended_at: now.toISOString(), status: "ended" })
    .in(
      "id",
      expired.map((e) => e.id),
    );

  await Promise.all(
    expired.map((e) => flagForgottenTickets(supabase, e.id, venueIds)),
  );
}
