import type { AuthorizedContext } from "@/lib/auth/guards";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type StatusTone = "blue" | "green" | "warning" | "danger" | "neutral";
type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type VenueTicketSlot = {
  label: string;
  collected: boolean;
};

export type VenueTicketListItem = {
  activatedAt: string | null;
  collectedAt: string | null;
  createdAt: string;
  guestName: string;
  guestPhone: string;
  id: string;
  itemCount: number;
  itemType: string | null;
  itemSummary: string;
  lastActivityAt: string;
  publicCode: string;
  slots: VenueTicketSlot[];
  status: TicketStatus;
  storageLocation: string | null;
  venueName: string;
};

export type VenueStaffMember = {
  acceptedAt: string | null;
  email: string;
  id: string;
  name: string;
  role: "staff" | "manager";
};

export type VenueInfo = {
  address: string | null;
  bagCapacity: number;
  billingCadence: "monthly" | "annual";
  billingPlan: string | null;
  cancellationPayRemainder: boolean;
  cancellationRequestedAt: string | null;
  capacity: number;
  city: string | null;
  contactEmail: string;
  contactPhone: string | null;
  createdAt: string;
  extraDevices: number;
  hangerCapacity: number;
  id: string;
  name: string;
  postalCode: string | null;
  slug: string;
  subscriptionEndsAt: string | null;
  ticketExpiryHours: number | null;
};

export type UserProfile = {
  email: string;
  fullName: string | null;
  id: string;
  phone: string | null;
};

export type VenueApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export type ActiveEvent = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  ticketCount: number;
};

export type VenueDashboardData = {
  activeEvents: ActiveEvent[];
  activeFilter: TicketFilter;
  approvalStatus: VenueApprovalStatus;
  dateRange: DateRange;
  customFrom: string;
  customTo: string;
  isManager: boolean;
  profile: UserProfile | null;
  queryMessage: string | null;
  search: string;
  staff: VenueStaffMember[];
  stats: Array<{ helper?: string; label: string; value: string; tone: StatusTone }>;
  tickets: VenueTicketListItem[];
  venue: VenueInfo | null;
  venues: VenueInfo[];
  venueLabel: string;
};

export type CustomerRow = {
  name: string;
  email: string;
  phone: string;
  visits: number;
  lastVisit: string;
};

export type VenueAnalyticsData = {
  byEvent: Array<{ id: string; name: string; eventDate: string; tickets: number; collected: number }>;
  customers: CustomerRow[];
  hourlyVolume: Array<{ hour: string; count: number; percent: number }>;
  itemTypes: Array<{ count: number; label: string; percent: number }>;
  stats: Array<{ label: string; value: string; tone: StatusTone }>;
  venueLabel: string;
};

export type VenueTicketItem = {
  id: string;
  label: string;
  quantity: number;
  notes: string | null;
  addedAt: string;
  collectedAt: string | null;
  storageLocation: string | null;
};

export type VenueTicketDetail = VenueTicketListItem & {
  activatedAt: string | null;
  collectedAt: string | null;
  eventName: string | null;
  expiresAt: string;
  guestEmail: string;
  itemDescription: string | null;
  items: VenueTicketItem[];
  scans: Array<{
    createdAt: string;
    id: string;
    reason: string | null;
    result: Database["public"]["Enums"]["scan_result"];
    scanType: Database["public"]["Enums"]["scan_type"];
  }>;
};

export type TicketFilter = "all" | "pending" | "active" | "collected" | "forgotten";
export type DateRange = "today" | "24h" | "7d" | "1mo" | "all" | "custom";

export function normalizeDateRange(value: string | undefined): DateRange {
  if (
    value === "today" || value === "24h" || value === "7d" ||
    value === "1mo" || value === "custom"
  ) return value;
  return "all";
}

// Parse a YYYY-MM-DD string into a Date, or null if invalid.
function parseYmd(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Returns the [from, to] ISO bounds for a range. `to` is null for open-ended.
function dateRangeBounds(
  range: DateRange,
  from?: string,
  to?: string,
): { gte: string | null; lte: string | null } {
  const now = Date.now();
  if (range === "today") {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return { gte: t.toISOString(), lte: null };
  }
  if (range === "24h") return { gte: new Date(now - 24 * 60 * 60 * 1000).toISOString(), lte: null };
  if (range === "7d") return { gte: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), lte: null };
  if (range === "1mo") return { gte: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), lte: null };
  if (range === "custom") {
    const fromDate = parseYmd(from);
    const toDate = parseYmd(to);
    if (toDate) toDate.setHours(23, 59, 59, 999); // inclusive end of day
    return {
      gte: fromDate ? fromDate.toISOString() : null,
      lte: toDate ? toDate.toISOString() : null,
    };
  }
  return { gte: null, lte: null };
}

// Build a human label like "2× Bag, 1× Jacket" from a ticket's item rows.
// Groups by label, sums quantities, and truncates long lists to keep the
// dashboard row compact. Falls back to the legacy item_type/count when a
// ticket has no item rows (older tickets predating per-item storage).
function buildItemSummary(
  rows: Array<{ label: string; quantity: number }>,
  fallbackType: string | null,
  fallbackCount: number,
): string {
  if (rows.length === 0) {
    if (!fallbackType) return fallbackCount > 0 ? `${fallbackCount} items` : "";
    return fallbackCount > 1 ? `${fallbackCount}× ${fallbackType}` : fallbackType;
  }

  const byLabel = new Map<string, number>();
  for (const r of rows) {
    byLabel.set(r.label, (byLabel.get(r.label) ?? 0) + (r.quantity || 1));
  }

  const parts = [...byLabel.entries()].map(([label, qty]) =>
    qty > 1 ? `${qty}× ${label}` : label,
  );

  // Keep the row short — show first two groups, then "+N more".
  if (parts.length > 2) {
    return `${parts.slice(0, 2).join(", ")} +${parts.length - 2} more`;
  }
  return parts.join(", ");
}

// Per-item slot rows carry accurate collected state. Older tickets predating
// per-item storage only have the legacy comma-joined storage_location string
// on the ticket itself — treat those as all still occupied.
function buildSlotList(
  itemSlots: VenueTicketSlot[] | undefined,
  legacyStorageLocation: string | null,
): VenueTicketSlot[] {
  if (itemSlots && itemSlots.length > 0) return itemSlots;
  if (!legacyStorageLocation) return [];
  return legacyStorageLocation
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ label, collected: false }));
}

// Note: "forgotten" covers two cases, handled separately below because they
// need different query shapes:
//  1. status === "forgotten" — set explicitly when a manager ends an event
//     and tickets on it were never collected (see endEvent).
//  2. A pending_activation ticket whose expires_at has already passed but
//     whose event (if any) hasn't been ended yet — nobody has flagged it
//     forgotten explicitly, but it functionally is (the guest never showed).
const FILTER_TO_STATUS: Partial<Record<TicketFilter, TicketStatus[]>> = {
  active: ["active", "partially_collected"],
  collected: ["collected"],
  pending: ["pending_activation"],
};

function emptyVenueDashboardData(
  activeFilter: TicketFilter = "all",
  search = "",
  dateRange: DateRange = "all",
  customFrom = "",
  customTo = "",
): VenueDashboardData {
  return {
    activeEvents: [],
    activeFilter,
    approvalStatus: "pending",
    dateRange,
    customFrom,
    customTo,
    isManager: false,
    queryMessage: null,
    search,
    staff: [],
    stats: [
      { helper: "Tickets created today", label: "Today", value: "0", tone: "neutral" },
      { helper: "Waiting at counter", label: "Pending", value: "0", tone: "warning" },
      { helper: "Currently stored", label: "Stored", value: "0", tone: "green" },
      { helper: "Returned today", label: "Collected", value: "0", tone: "blue" },
      { helper: "Expired before activation", label: "Forgotten", value: "0", tone: "danger" },
      { helper: "Active storage use", label: "Capacity", value: "0%", tone: "blue" },
    ],
    profile: null,
    tickets: [],
    venue: null,
    venues: [],
    venueLabel: "No assigned venue",
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { email: data.email, fullName: data.full_name, id: data.id, phone: data.phone };
}

function emptyAnalyticsData(): VenueAnalyticsData {
  return {
    byEvent: [],
    customers: [],
    hourlyVolume: [],
    itemTypes: [],
    stats: [
      { label: "Guests", value: "0", tone: "neutral" },
      { label: "Collected", value: "0", tone: "green" },
      { label: "Avg. storage", value: "0m", tone: "neutral" },
      { label: "Utilization", value: "0%", tone: "warning" },
    ],
    venueLabel: "No assigned venue",
  };
}

function formatCount(value: number | null) {
  return String(value ?? 0);
}

function formatMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0m";
  if (value < 60) return `${Math.round(value)}m`;
  return `${Math.round(value / 60)}h`;
}

function getVenueIds(context: AuthorizedContext) {
  if (context.profileRole === "platform_admin") return null;
  return [...new Set(context.venueRoles.map((r) => r.venueId))];
}

function isManagerContext(context: AuthorizedContext) {
  return context.venueRoles.some((r) => r.role === "manager");
}

async function getVenueMeta(supabase: SupabaseAdmin, venueIds: string[] | null) {
  let query = supabase
    .from("venues")
    .select(
      "id, name, capacity, hanger_capacity, bag_capacity, extra_devices, address, city, postal_code, contact_email, contact_phone, billing_plan, billing_cadence, cancellation_requested_at, cancellation_pay_remainder, subscription_ends_at, created_at, slug, ticket_expiry_hours",
    )
    .order("name");

  if (venueIds) query = query.in("id", venueIds);

  const { data } = await query;
  const venues = data ?? [];
  const capacity = venues.reduce((s, v) => s + v.capacity, 0);
  const hangerCapacity = venues.reduce((s, v) => s + (v.hanger_capacity ?? 0), 0);
  const bagCapacity = venues.reduce((s, v) => s + (v.bag_capacity ?? 0), 0);
  const first = venues[0] ?? null;

  const venueInfoList: VenueInfo[] = venues.map((v) => ({
    address: v.address,
    bagCapacity: v.bag_capacity ?? 0,
    billingCadence: v.billing_cadence,
    billingPlan: v.billing_plan,
    cancellationPayRemainder: v.cancellation_pay_remainder,
    cancellationRequestedAt: v.cancellation_requested_at,
    capacity: v.capacity,
    city: v.city,
    contactEmail: v.contact_email,
    contactPhone: v.contact_phone,
    createdAt: v.created_at,
    extraDevices: v.extra_devices ?? 0,
    hangerCapacity: v.hanger_capacity ?? 0,
    id: v.id,
    name: v.name,
    postalCode: v.postal_code,
    slug: v.slug,
    subscriptionEndsAt: v.subscription_ends_at,
    ticketExpiryHours: v.ticket_expiry_hours ?? null,
  }));

  return {
    approvalStatus: "approved" as const,
    bagCapacity,
    capacity,
    hangerCapacity,
    label:
      venues.length === 0
        ? "No assigned venue"
        : venues.length === 1
          ? first!.name
          : `${venues.length} venues`,
    queryMessage: null,
    venue: venueInfoList[0] ?? null,
    venues: venueInfoList,
  };
}

async function getStaffList(supabase: SupabaseAdmin, venueIds: string[] | null): Promise<VenueStaffMember[]> {
  if (!venueIds || venueIds.length === 0) return [];

  const { data: staffRows } = await supabase
    .from("venue_staff")
    .select("id, profile_id, role, accepted_at, invited_email")
    .in("venue_id", venueIds)
    .not("profile_id", "is", null)
    .order("accepted_at", { ascending: false });

  if (!staffRows || staffRows.length === 0) return [];

  const profileIds = staffRows.map((s) => s.profile_id!).filter(Boolean);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", profileIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Deduplicate by profile_id — a person linked to multiple venues appears once.
  // Prefer "manager" role over "staff" when the same person has both.
  const seen = new Map<string, VenueStaffMember>();
  for (const s of staffRows) {
    const pid = s.profile_id!;
    const profile = profileMap.get(pid);
    const member: VenueStaffMember = {
      acceptedAt: s.accepted_at,
      email: profile?.email ?? s.invited_email ?? "",
      id: s.id,
      name: profile?.full_name ?? profile?.email ?? "Staff member",
      role: s.role as "staff" | "manager",
    };
    const existing = seen.get(pid);
    if (!existing || member.role === "manager") {
      seen.set(pid, member);
    }
  }
  return [...seen.values()];
}

function getTodayStart() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString();
}

export function normalizeTicketFilter(value: string | undefined): TicketFilter {
  if (value === "pending" || value === "active" || value === "collected" || value === "forgotten") return value;
  return "all";
}

function normalizeSearch(value: string | undefined) {
  return (value ?? "").trim().slice(0, 80);
}

function searchPattern(value: string) {
  return `%${value.replaceAll("%", "").replaceAll(",", " ").trim()}%`;
}

async function getVenueNameMap(supabase: SupabaseAdmin, venueIds: string[]) {
  const names = new Map<string, string>();
  if (venueIds.length === 0) return names;
  const { data } = await supabase.from("venues").select("id, name").in("id", venueIds);
  data?.forEach((v) => names.set(v.id, v.name));
  return names;
}

export async function getVenueDashboardData({
  context,
  filter,
  search,
  range,
  from,
  to,
}: {
  context: AuthorizedContext;
  filter?: string;
  range?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<VenueDashboardData> {
  const activeFilter = normalizeTicketFilter(filter);
  const normalizedSearch = normalizeSearch(search);
  const activeDateRange = normalizeDateRange(range);
  const customFrom = activeDateRange === "custom" ? (from ?? "") : "";
  const customTo = activeDateRange === "custom" ? (to ?? "") : "";

  if (!isSupabaseAdminConfigured()) return emptyVenueDashboardData(activeFilter, normalizedSearch, activeDateRange, customFrom, customTo);

  const venueIds = getVenueIds(context);
  if (venueIds?.length === 0) return emptyVenueDashboardData(activeFilter, normalizedSearch, activeDateRange, customFrom, customTo);

  const supabase = createAdminClient();
  const todayStart = getTodayStart();

  async function getActiveEvents(): Promise<ActiveEvent[]> {
    if (!venueIds || venueIds.length === 0) return [];
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, name, starts_at, ends_at")
      .eq("active", true)
      .in("venue_id", venueIds)
      .order("starts_at", { ascending: true });
    if (!eventsData || eventsData.length === 0) return [];

    const eventIds = eventsData.map((e) => e.id);
    const { data: ticketRows } = await supabase
      .from("tickets")
      .select("event_id")
      .in("event_id", eventIds);
    const counts = new Map<string, number>();
    (ticketRows ?? []).forEach((t) => {
      if (t.event_id) counts.set(t.event_id, (counts.get(t.event_id) ?? 0) + 1);
    });

    return eventsData.map((e) => ({
      id: e.id,
      name: e.name,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      ticketCount: counts.get(e.id) ?? 0,
    }));
  }

  const [venueMeta, staffList, profileRow, activeEvents] = await Promise.all([
    getVenueMeta(supabase, venueIds),
    isManagerContext(context) ? getStaffList(supabase, venueIds) : Promise.resolve([]),
    supabase.from("profiles").select("id, email, full_name, phone").eq("id", context.userId).maybeSingle(),
    getActiveEvents(),
  ]);

  const scopedCount = () => {
    let q = supabase.from("tickets").select("id", { count: "exact", head: true });
    if (venueIds) q = q.in("venue_id", venueIds);
    return q;
  };

  let ticketQuery = supabase
    .from("tickets")
    .select("id, public_code, guest_name, guest_phone, status, created_at, activated_at, collected_at, item_type, item_count, storage_location, venue_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (venueIds) ticketQuery = ticketQuery.in("venue_id", venueIds);

  // Apply date range — filter on the most-recent activity column
  const { gte: rangeGte, lte: rangeLte } = dateRangeBounds(activeDateRange, customFrom, customTo);
  if (rangeGte) {
    ticketQuery = ticketQuery.or(
      `collected_at.gte.${rangeGte},activated_at.gte.${rangeGte},created_at.gte.${rangeGte}`,
    );
  }
  if (rangeLte) {
    // Upper bound: the ticket's earliest timestamp (created_at) must be on/before the end date.
    ticketQuery = ticketQuery.lte("created_at", rangeLte);
  }

  if (activeFilter === "forgotten") {
    ticketQuery = ticketQuery.or(
      `status.eq.forgotten,and(status.eq.pending_activation,expires_at.lt.${new Date().toISOString()})`,
    );
  } else {
    const selectedStatuses = FILTER_TO_STATUS[activeFilter];
    if (selectedStatuses) ticketQuery = ticketQuery.in("status", selectedStatuses);
  }

  if (normalizedSearch) {
    const pattern = searchPattern(normalizedSearch);
    ticketQuery = ticketQuery.or(
      `guest_name.ilike.${pattern},guest_phone.ilike.${pattern},guest_email.ilike.${pattern},public_code.ilike.${pattern}`,
    );
  }

  // Stored/Collected must reflect items, not tickets — a single ticket can hold
  // several items across several slots, and a partially_collected ticket has
  // some items returned and others still stored at the same time.
  const storedItemsQuery = (async () => {
    // Forgotten tickets still occupy their slots physically — the guest just
    // never came back — so they count toward capacity same as active ones.
    let openTickets = supabase
      .from("tickets")
      .select("id")
      .in("status", ["active", "partially_collected", "forgotten"]);
    if (venueIds) openTickets = openTickets.in("venue_id", venueIds);
    const { data: rows } = await openTickets;
    const ticketIds = (rows ?? []).map((r) => r.id);
    if (ticketIds.length === 0) return 0;

    const { data: items } = await supabase
      .from("ticket_items")
      .select("quantity")
      .in("ticket_id", ticketIds)
      .is("collected_at", null);
    return (items ?? []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  })();

  const collectedItemsTodayQuery = (async () => {
    let venueTickets = supabase.from("tickets").select("id");
    if (venueIds) venueTickets = venueTickets.in("venue_id", venueIds);
    const { data: rows } = await venueTickets;
    const ticketIds = (rows ?? []).map((r) => r.id);
    if (ticketIds.length === 0) return 0;

    const { data: items } = await supabase
      .from("ticket_items")
      .select("quantity")
      .in("ticket_id", ticketIds)
      .gte("collected_at", todayStart);
    return (items ?? []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  })();

  const [todayCount, pendingCount, forgottenCount, ticketRows, storedItemCount, collectedItemCountToday] =
    await Promise.all([
      scopedCount().gte("created_at", todayStart),
      scopedCount().eq("status", "pending_activation"),
      scopedCount().or(
        `status.eq.forgotten,and(status.eq.pending_activation,expires_at.lt.${new Date().toISOString()})`,
      ),
      ticketQuery,
      storedItemsQuery,
      collectedItemsTodayQuery,
    ]);

  const usedCapacity = storedItemCount;
  const utilization = venueMeta.capacity > 0 ? Math.round((usedCapacity / venueMeta.capacity) * 100) : 0;

  const listedTicketIds = (ticketRows.data ?? []).map((t) => t.id);
  const [venueNames, itemsByTicket, slotsByTicket] = await Promise.all([
    getVenueNameMap(
      supabase,
      [...new Set(ticketRows.data?.map((t) => t.venue_id) ?? [])],
    ),
    // Per-item breakdown for the listed tickets, so the list shows e.g.
    // "2× Bag, 1× Jacket" instead of a wrong "3× Bag".
    (async () => {
      const map = new Map<string, Array<{ label: string; quantity: number }>>();
      if (listedTicketIds.length === 0) return map;
      const { data } = await supabase
        .from("ticket_items")
        .select("ticket_id, label, quantity")
        .in("ticket_id", listedTicketIds);
      for (const row of data ?? []) {
        const arr = map.get(row.ticket_id) ?? [];
        arr.push({ label: row.label, quantity: row.quantity });
        map.set(row.ticket_id, arr);
      }
      return map;
    })(),
    // Per-slot collected state, so a returned H-1/B-1 can be greyed out
    // instead of showing as still occupied on the dashboard list.
    (async () => {
      const map = new Map<string, VenueTicketSlot[]>();
      if (listedTicketIds.length === 0) return map;
      const { data } = await supabase
        .from("ticket_items")
        .select("ticket_id, storage_location, collected_at")
        .in("ticket_id", listedTicketIds)
        .not("storage_location", "is", null);
      for (const row of data ?? []) {
        if (!row.storage_location) continue;
        const arr = map.get(row.ticket_id) ?? [];
        arr.push({ label: row.storage_location, collected: row.collected_at !== null });
        map.set(row.ticket_id, arr);
      }
      return map;
    })(),
  ]);

  const profile = profileRow.data
    ? { email: profileRow.data.email, fullName: profileRow.data.full_name, id: profileRow.data.id, phone: profileRow.data.phone }
    : null;

  return {
    activeEvents,
    activeFilter,
    approvalStatus: venueMeta.approvalStatus,
    dateRange: activeDateRange,
    customFrom,
    customTo,
    isManager: isManagerContext(context),
    profile,
    queryMessage: venueMeta.queryMessage,
    search: normalizedSearch,
    staff: staffList,
    stats: [
      { helper: "Tickets created today", label: "Today", value: formatCount(todayCount.count), tone: "neutral" },
      { helper: "Waiting at counter", label: "Pending", value: formatCount(pendingCount.count), tone: "warning" },
      { helper: "Items currently stored", label: "Stored", value: formatCount(storedItemCount), tone: "green" },
      { helper: "Items returned today", label: "Collected", value: formatCount(collectedItemCountToday), tone: "blue" },
      { helper: "Expired before activation", label: "Forgotten", value: formatCount(forgottenCount.count), tone: "danger" },
      {
        helper: "Active storage use",
        label: "Capacity",
        value: `${utilization}%`,
        tone: utilization >= 90 ? "danger" : utilization >= 70 ? "warning" : "blue",
      },
    ],
    tickets:
      (ticketRows.data ?? [])
        .map((t) => ({
          activatedAt: t.activated_at,
          collectedAt: t.collected_at,
          createdAt: t.created_at,
          guestName: t.guest_name,
          guestPhone: t.guest_phone,
          id: t.id,
          itemCount: t.item_count,
          itemType: t.item_type,
          itemSummary: buildItemSummary(itemsByTicket.get(t.id) ?? [], t.item_type, t.item_count),
          lastActivityAt: t.collected_at ?? t.activated_at ?? t.created_at,
          publicCode: t.public_code,
          slots: buildSlotList(slotsByTicket.get(t.id), t.storage_location),
          status: t.status,
          storageLocation: t.storage_location,
          venueName: venueNames.get(t.venue_id) ?? venueMeta.label,
        }))
        .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()),
    venue: venueMeta.venue,
    venues: venueMeta.venues,
    venueLabel: venueMeta.label,
  };
}

export async function getVenueTicketDetail({
  context,
  ticketId,
}: {
  context: AuthorizedContext;
  ticketId?: string;
}): Promise<VenueTicketDetail | null> {
  if (!ticketId || !isSupabaseAdminConfigured()) return null;

  const venueIds = getVenueIds(context);
  if (venueIds?.length === 0) return null;

  const supabase = createAdminClient();
  let query = supabase
    .from("tickets")
    .select("id, public_code, guest_name, guest_email, guest_phone, status, created_at, expires_at, activated_at, collected_at, item_type, item_description, item_count, storage_location, venue_id, event_id")
    .eq("id", ticketId);

  if (venueIds) query = query.in("venue_id", venueIds);

  const { data: ticket } = await query.maybeSingle();
  if (!ticket) return null;

  const [venueNames, scans, items, eventRow] = await Promise.all([
    getVenueNameMap(supabase, [ticket.venue_id]),
    supabase
      .from("ticket_scans")
      .select("id, scan_type, result, reason, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ticket_items")
      .select("id, label, quantity, notes, added_at, collected_at, storage_location")
      .eq("ticket_id", ticket.id)
      .order("added_at", { ascending: true }),
    ticket.event_id
      ? supabase.from("events").select("name").eq("id", ticket.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    activatedAt: ticket.activated_at,
    collectedAt: ticket.collected_at,
    createdAt: ticket.created_at,
    eventName: eventRow.data?.name ?? null,
    expiresAt: ticket.expires_at,
    guestEmail: ticket.guest_email ?? "",
    guestName: ticket.guest_name,
    guestPhone: ticket.guest_phone,
    id: ticket.id,
    itemCount: ticket.item_count,
    itemDescription: ticket.item_description,
    itemSummary: buildItemSummary(
      (items.data ?? []).map((i) => ({ label: i.label, quantity: i.quantity })),
      ticket.item_type,
      ticket.item_count,
    ),
    lastActivityAt: ticket.collected_at ?? ticket.activated_at ?? ticket.created_at,
    items:
      items.data?.map((i) => ({
        addedAt: i.added_at,
        collectedAt: i.collected_at,
        id: i.id,
        label: i.label,
        notes: i.notes,
        quantity: i.quantity,
        storageLocation: i.storage_location ?? null,
      })) ?? [],
    itemType: ticket.item_type,
    publicCode: ticket.public_code,
    scans:
      scans.data?.map((s) => ({
        createdAt: s.created_at,
        id: s.id,
        reason: s.reason,
        result: s.result,
        scanType: s.scan_type,
      })) ?? [],
    slots: buildSlotList(
      (items.data ?? [])
        .filter((i) => i.storage_location)
        .map((i) => ({ label: i.storage_location as string, collected: i.collected_at !== null })),
      ticket.storage_location,
    ),
    status: ticket.status,
    storageLocation: ticket.storage_location,
    venueName: venueNames.get(ticket.venue_id) ?? "Selected venue",
  };
}

export async function getVenueAnalyticsData(context: AuthorizedContext): Promise<VenueAnalyticsData> {
  if (!isSupabaseAdminConfigured()) return emptyAnalyticsData();

  const venueIds = getVenueIds(context);
  if (venueIds?.length === 0) return emptyAnalyticsData();

  const supabase = createAdminClient();
  const venueMeta = await getVenueMeta(supabase, venueIds);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let q = supabase
    .from("tickets")
    .select("id, created_at, activated_at, collected_at, status, item_type, event_id, guest_name, guest_email, guest_phone")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500);

  if (venueIds) q = q.in("venue_id", venueIds);

  const { data: recentTickets } = await q;
  const tickets = recentTickets ?? [];
  const guests = tickets.length;
  const collected = tickets.filter((t) => t.status === "collected").length;
  const active = tickets.filter(
    (t) => t.status === "active" || t.status === "partially_collected" || t.status === "forgotten",
  ).length;
  const storageDurations = tickets
    .filter((t) => t.activated_at && t.collected_at)
    .map(
      (t) =>
        (new Date(t.collected_at as string).getTime() - new Date(t.activated_at as string).getTime()) / 60000,
    );
  const avgStorage =
    storageDurations.length > 0
      ? storageDurations.reduce((s, d) => s + d, 0) / storageDurations.length
      : 0;
  const utilization = venueMeta.capacity > 0 ? Math.round((active / venueMeta.capacity) * 100) : 0;

  // Item types from per-item rows (more accurate than the denormalized blob).
  const ticketIds = tickets.map((t) => t.id);
  let itemTypes: VenueAnalyticsData["itemTypes"];
  if (ticketIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("ticket_items")
      .select("label, quantity")
      .in("ticket_id", ticketIds);
    if (itemRows && itemRows.length > 0) {
      itemTypes = buildItemTypesFromRows(itemRows);
    } else {
      itemTypes = buildItemTypes(tickets.map((t) => t.item_type));
    }
  } else {
    itemTypes = [];
  }

  const byEvent = await buildEventBreakdown(supabase, venueIds, tickets);

  // Build deduplicated customer list (keyed by email, fallback phone)
  const customerMap = new Map<string, { name: string; email: string; phone: string; visits: number; lastVisit: string }>();
  for (const t of tickets) {
    const key = (t.guest_email || t.guest_phone || "").toLowerCase();
    if (!key) continue;
    const existing = customerMap.get(key);
    if (existing) {
      existing.visits += 1;
      if (t.created_at > existing.lastVisit) existing.lastVisit = t.created_at;
    } else {
      customerMap.set(key, {
        email: t.guest_email ?? "",
        lastVisit: t.created_at,
        name: t.guest_name,
        phone: t.guest_phone,
        visits: 1,
      });
    }
  }
  const customers = [...customerMap.values()].sort(
    (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime(),
  );

  return {
    byEvent,
    customers,
    hourlyVolume: buildHourlyVolume(tickets.map((t) => t.created_at)),
    itemTypes,
    stats: [
      { label: "Guests", value: formatCount(guests), tone: "neutral" },
      { label: "Collected", value: formatCount(collected), tone: "green" },
      { label: "Avg. storage", value: formatMinutes(avgStorage), tone: "neutral" },
      {
        label: "Utilization",
        value: `${utilization}%`,
        tone: utilization >= 90 ? "danger" : utilization >= 70 ? "warning" : "neutral",
      },
    ],
    venueLabel: venueMeta.label,
  };
}

async function buildEventBreakdown(
  supabase: SupabaseAdmin,
  venueIds: string[] | null,
  tickets: Array<{ event_id: string | null; status: string }>,
): Promise<VenueAnalyticsData["byEvent"]> {
  const eventTickets = tickets.filter((t) => t.event_id);
  if (eventTickets.length === 0) return [];

  const eventIds = [...new Set(eventTickets.map((t) => t.event_id as string))];
  let eventsQuery = supabase.from("events").select("id, name, event_date").in("id", eventIds);
  if (venueIds) eventsQuery = eventsQuery.in("venue_id", venueIds);
  const { data: events } = await eventsQuery;

  const meta = new Map((events ?? []).map((e) => [e.id, e]));
  const counts = new Map<string, { tickets: number; collected: number }>();
  eventTickets.forEach((t) => {
    const key = t.event_id as string;
    const entry = counts.get(key) ?? { collected: 0, tickets: 0 };
    entry.tickets += 1;
    if (t.status === "collected") entry.collected += 1;
    counts.set(key, entry);
  });

  return [...counts.entries()]
    .map(([id, c]) => {
      const event = meta.get(id);
      return {
        collected: c.collected,
        eventDate: event?.event_date ?? "",
        id,
        name: event?.name ?? "Unknown event",
        tickets: c.tickets,
      };
    })
    .filter((e) => e.name !== "Unknown event")
    .sort((a, b) => b.tickets - a.tickets);
}

function buildHourlyVolume(values: string[]) {
  const counts = Array.from({ length: 8 }, (_, i) => ({
    count: 0,
    hour: `${String(i * 3).padStart(2, "0")}:00`,
    percent: 0,
  }));
  values.forEach((v) => {
    const h = new Date(v).getHours();
    counts[Math.floor(h / 3)].count += 1;
  });
  const max = Math.max(...counts.map((c) => c.count), 1);
  return counts.map((c) => ({ ...c, percent: Math.max(8, Math.round((c.count / max) * 100)) }));
}

function buildItemTypes(values: Array<string | null>) {
  const counts = new Map<string, number>();
  values.forEach((v) => {
    const label = v || "Unassigned";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return summarizeCounts(counts);
}

function buildItemTypesFromRows(rows: Array<{ label: string; quantity: number }>) {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const label = r.label || "Unassigned";
    counts.set(label, (counts.get(label) ?? 0) + (r.quantity || 1));
  });
  return summarizeCounts(counts);
}

function summarizeCounts(counts: Map<string, number>) {
  const total = Math.max([...counts.values()].reduce((s, c) => s + c, 0), 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ count, label, percent: Math.round((count / total) * 100) }));
}
