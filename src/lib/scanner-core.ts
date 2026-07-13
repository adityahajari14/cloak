import "server-only";

import type { AuthorizedContext } from "@/lib/auth/guards";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { hashTicketToken } from "@/lib/tickets";
import type { ScannerTicket, TicketItemView } from "@/app/venuescanner/types";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
type TicketItemRow = Database["public"]["Tables"]["ticket_items"]["Row"];
export type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type ScannerContext = {
  guard: AuthorizedContext;
  supabase: SupabaseAdmin;
};

// ─── Context & access ─────────────────────────────────────────────────────────

export async function getScannerContext(): Promise<ScannerContext | null> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return null;
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: venueRoles }] = await Promise.all([
    authClient.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    authClient.from("venue_staff").select("venue_id, role").eq("profile_id", user.id),
  ]);

  const guard: AuthorizedContext = {
    profileRole: profile?.role ?? "guest",
    status: "authorized",
    userId: user.id,
    venueRoles:
      venueRoles?.map((venueRole) => ({
        role: venueRole.role,
        venueId: venueRole.venue_id,
      })) ?? [],
  };

  if (guard.profileRole === "platform_admin" || guard.venueRoles.length === 0) {
    return null;
  }

  return { guard, supabase: createAdminClient() };
}

export function canAccessVenue(guard: AuthorizedContext, venueId: string) {
  return guard.venueRoles.some((venueRole) => venueRole.venueId === venueId);
}

export function isPendingTicketExpired(ticket: TicketRow) {
  return (
    ticket.status === "pending_activation" &&
    new Date(ticket.expires_at).getTime() < Date.now()
  );
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function normalizeLookup(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const token = url.searchParams.get("token");
    const code = url.searchParams.get("code");

    if (token) {
      return { column: "qr_token_hash" as const, value: hashTicketToken(token) };
    }

    if (code) {
      return { column: "public_code" as const, value: code.trim().toUpperCase() };
    }
  } catch {
    // Plain fallback codes and raw QR tokens are handled below.
  }

  if (trimmed.toUpperCase().startsWith("CLK-")) {
    return { column: "public_code" as const, value: trimmed.toUpperCase() };
  }

  // Last 6 characters of a CLK code (the unique suffix, e.g. "74E9F1").
  // Staff can type just the suffix instead of the full "CLK-YYYYMMDD-" prefix.
  if (/^[A-Z0-9]{6}$/i.test(trimmed)) {
    return { column: "public_code_suffix" as const, value: trimmed.toUpperCase() };
  }

  return { column: "qr_token_hash" as const, value: hashTicketToken(trimmed) };
}

export async function getVenueName(supabase: SupabaseAdmin, venueId: string) {
  const { data } = await supabase.from("venues").select("name").eq("id", venueId).maybeSingle();
  return data?.name ?? "Selected venue";
}

export async function loadTicketItems(
  supabase: SupabaseAdmin,
  ticketId: string,
): Promise<TicketItemRow[]> {
  const { data } = await supabase
    .from("ticket_items")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("added_at", { ascending: true });
  return data ?? [];
}

function toItemView(row: TicketItemRow): TicketItemView {
  return {
    collected: row.collected_at !== null,
    id: row.id,
    label: row.label,
    notes: row.notes,
    quantity: row.quantity,
    storageLocation: row.storage_location ?? null,
  };
}

export function toScannerTicket(
  ticket: TicketRow,
  venueName: string,
  items: TicketItemRow[],
): ScannerTicket {
  return {
    expiresAt: ticket.expires_at,
    guestEmail: ticket.guest_email ?? "",
    guestName: ticket.guest_name,
    guestPhone: ticket.guest_phone,
    id: ticket.id,
    itemCount: ticket.item_count,
    itemDescription: ticket.item_description,
    items: items.map(toItemView),
    itemType: ticket.item_type,
    publicCode: ticket.public_code,
    status: ticket.status,
    storageLocation: ticket.storage_location,
    venueId: ticket.venue_id,
    venueName,
  };
}

export async function loadTicketById(supabase: SupabaseAdmin, ticketId: string) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Resolve a scanned Cloak Club membership token to a usable ticket at the given
 * venue. Members carry a permanent, venue-agnostic pass — each scan should land
 * on a live ticket for them at this venue: reuse an open one if present,
 * otherwise mint a fresh pending ticket. Returns null if the value isn't a
 * membership token.
 */
export async function resolveMembershipTicket(
  supabase: SupabaseAdmin,
  value: string,
  venueId: string,
): Promise<TicketRow | null> {
  const { data: member } = await supabase
    .from("guest_contacts")
    .select("id, full_name, email, phone")
    .eq("membership_token_hash", hashTicketToken(value.trim()))
    .maybeSingle();

  if (!member) return null;

  // Reuse an open ticket for this member at this venue if one exists —
  // including a forgotten one, since its items are still physically stored.
  const { data: openTicket } = await supabase
    .from("tickets")
    .select("*")
    .eq("venue_id", venueId)
    .eq("guest_contact_id", member.id)
    .in("status", ["pending_activation", "active", "partially_collected", "forgotten"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openTicket) return openTicket;

  // Otherwise mint a fresh pending ticket for this visit.
  const { createPublicCode, createTicketToken } = await import("@/lib/tickets");
  const ticketToken = createTicketToken();
  const { data: venue } = await supabase
    .from("venues")
    .select("ticket_expiry_hours")
    .eq("id", venueId)
    .maybeSingle();

  const expiryHours = venue?.ticket_expiry_hours ?? null;
  const expiresAt = expiryHours !== null
    ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
    : new Date("9999-12-31T23:59:59Z").toISOString();

  const { data: created } = await supabase
    .from("tickets")
    .insert({
      venue_id: venueId,
      guest_contact_id: member.id,
      guest_email: member.email,
      guest_name: member.full_name,
      guest_phone: member.phone,
      public_code: createPublicCode(),
      qr_token_hash: ticketToken.hash,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  return created ?? null;
}

export async function lookupTicketByInput(
  supabase: SupabaseAdmin,
  value: string,
  venueId?: string,
) {
  // A Cloak Club membership token resolves to a live ticket for the member at
  // this venue (venue is required to know where to activate).
  if (venueId) {
    const memberTicket = await resolveMembershipTicket(supabase, value, venueId);
    if (memberTicket) return memberTicket;
  }

  const lookup = normalizeLookup(value);
  if (!lookup) return null;

  // Suffix search — match the last 6 chars of public_code, scoped to this venue
  // to avoid cross-venue collisions on the short suffix.
  if (lookup.column === "public_code_suffix") {
    let query = supabase.from("tickets").select("*").ilike("public_code", `%${lookup.value}`);
    if (venueId) query = query.eq("venue_id", venueId);
    const { data, error } = await query.limit(2);
    if (error || !data || data.length !== 1) return null; // ambiguous or none → no match
    return data[0];
  }

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq(lookup.column, lookup.value)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// ─── Scan logging ─────────────────────────────────────────────────────────────

export async function writeRejectedScan({
  reason,
  scanner,
  ticket,
}: {
  reason: string;
  scanner: AuthorizedContext;
  ticket: TicketRow;
}) {
  const supabase = createAdminClient();
  try {
    await supabase.from("ticket_scans").insert({
      reason,
      result: "rejected",
      scan_type: "rejected",
      scanned_by: scanner.userId,
      ticket_id: ticket.id,
      venue_id: ticket.venue_id,
    });
  } catch {
    // Scan rejection logging should not break the counter workflow.
  }
}

export async function writeAcceptedScan({
  scanType,
  scanner,
  ticket,
}: {
  scanType: "activation" | "checkout";
  scanner: AuthorizedContext;
  ticket: TicketRow;
}) {
  const supabase = createAdminClient();
  try {
    await supabase.from("ticket_scans").insert({
      result: "accepted",
      scan_type: scanType,
      scanned_by: scanner.userId,
      ticket_id: ticket.id,
      venue_id: ticket.venue_id,
    });
  } catch {
    // Scan logging should not block an already validated ticket update.
  }
}

// ─── Slot assignment ──────────────────────────────────────────────────────────

// A slot stays occupied while the ticket is active, partially collected, or
// forgotten — a forgotten ticket's items are still physically in the
// cloakroom until someone actually checks them out.
export const OCCUPYING_STATUSES: TicketRow["status"][] = ["active", "partially_collected", "forgotten"];

// Format a raw internal slot (e.g. "h5", "b2") to the display label "H-5" / "B-2".
export function formatSlot(raw: string): string {
  if (raw.startsWith("h")) return `H-${raw.slice(1)}`;
  if (raw.startsWith("b")) return `B-${raw.slice(1)}`;
  return raw;
}

/**
 * Assign `count` consecutive free slot numbers from the hanger or bag pool.
 * Returns an array of display-formatted labels (e.g. ["H-1","H-2","H-3"]),
 * or null if the pool has fewer than `count` free slots.
 */
export async function assignSlots(
  supabase: SupabaseAdmin,
  venueId: string,
  slotType: "hanger" | "bag",
  count: number,
): Promise<string[] | null> {
  const { data: venue } = await supabase
    .from("venues")
    .select("hanger_capacity, bag_capacity, capacity")
    .eq("id", venueId)
    .maybeSingle();

  const prefix = slotType === "bag" ? "b" : "h";
  const poolSize =
    slotType === "bag"
      ? (venue?.bag_capacity ?? 0)
      : (venue?.hanger_capacity ?? venue?.capacity ?? 0);

  if (poolSize < 1 || count < 1) return null;

  // Collect occupied slot numbers from active/partial tickets AND individual items
  // (items may have been added to already-active tickets).
  // Fetch active/partial tickets for this venue to get their IDs + legacy slot summary
  const { data: openTickets } = await supabase
    .from("tickets")
    .select("id, storage_location")
    .eq("venue_id", venueId)
    .in("status", OCCUPYING_STATUSES);

  const openTicketIds = (openTickets ?? []).map((t) => t.id);

  // Fetch uncollected item rows for those tickets to find per-unit slots
  const { data: openItems } =
    openTicketIds.length > 0
      ? await supabase
          .from("ticket_items")
          .select("storage_location")
          .in("ticket_id", openTicketIds)
          .not("storage_location", "is", null)
          .is("collected_at", null)
      : { data: [] as Array<{ storage_location: string | null }> };

  const usedNumbers = new Set<number>();

  // Parse the formatted label "H-5" / "B-2" → number 5 / 2
  const labelPrefix = slotType === "bag" ? "B-" : "H-";
  for (const item of openItems ?? []) {
    const loc = item.storage_location ?? "";
    if (!loc.startsWith(labelPrefix)) continue;
    const n = parseInt(loc.slice(labelPrefix.length), 10);
    if (!isNaN(n)) usedNumbers.add(n);
  }

  const assigned: string[] = [];
  for (let n = 1; n <= poolSize && assigned.length < count; n++) {
    if (!usedNumbers.has(n)) {
      usedNumbers.add(n); // reserve so next iteration doesn't re-pick it
      assigned.push(formatSlot(`${prefix}${n}`));
    }
  }

  return assigned.length === count ? assigned : null;
}

// ─── Event guest capacity ─────────────────────────────────────────────────────

/**
 * An event's guest_capacity caps how many guests may be holding items AT ONCE —
 * live occupancy, not total admissions. A guest who collects everything frees
 * their slot, so a 300-capacity night can serve far more than 300 people as
 * they cycle through.
 *
 * This is separate from the venue's hanger/bag capacity above: that counts
 * physical storage slots, this counts guests. One guest occupies one slot no
 * matter how many items they check in. Both limits must hold.
 *
 * A ticket occupies a slot exactly while its items are in the cloakroom — the
 * same OCCUPYING_STATUSES used for slot assignment, and for the same reason.
 * A pending ticket (QR issued, nothing handed over) occupies nothing.
 *
 * Returns null when the event has room — or has no cap, or the ticket has no
 * event. Returns the occupancy numbers when it is full.
 */
export async function checkEventGuestCapacity(
  supabase: SupabaseAdmin,
  eventId: string | null,
  excludeTicketId?: string,
): Promise<{ used: number; cap: number } | null> {
  if (!eventId) return null;

  const { data: event } = await supabase
    .from("events")
    .select("guest_capacity")
    .eq("id", eventId)
    .maybeSingle();

  const cap = event?.guest_capacity ?? null;
  if (cap === null) return null; // unlimited

  let query = supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", OCCUPYING_STATUSES);

  if (excludeTicketId) query = query.neq("id", excludeTicketId);

  const { count } = await query;
  const used = count ?? 0;

  return used >= cap ? { cap, used } : null;
}
