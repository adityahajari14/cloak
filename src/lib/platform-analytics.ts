import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { MONTHLY_PLAN_PRICES, type VenuePlanId } from "@/lib/venues";

export type AnalyticsScope =
  | { type: "total" }
  | { type: "country"; country: string }
  | { type: "venue"; venueId: string };

export type MonthBucket = { month: string; label: string };

export type PlatformAnalyticsData = {
  scope: AnalyticsScope;
  venueOptions: Array<{ id: string; name: string }>;

  // Revenue
  currentMrr: number;
  mrrTrend: Array<{ label: string; mrr: number }>;
  mrrIsEstimated: true;

  // Ticket volume & usage
  ticketTrend: Array<{ label: string; created: number; activated: number; collected: number }>;
  totalTickets: number;
  activationRate: number;
  avgStorageHours: number | null;

  // Venue health
  activeVenueCount: number;
  suspendedVenueCount: number;
  avgUtilization: number;
  signupsVsCancellations: Array<{ label: string; signups: number; cancellations: number }>;

  // Plan mix
  planMix: Array<{ plan: string; label: string; count: number; revenue: number }>;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(date);
}

/** Last 12 calendar months, oldest first, ending with the current month. */
function last12Months(): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: monthKey(d), label: monthLabel(d) });
  }
  return buckets;
}

function planLabel(plan: string | null): string {
  if (!plan) return "None";
  if (plan === "per_event") return "Per event";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function monthlyEquivalent(plan: string | null, cadence: "monthly" | "annual"): number {
  const monthly = plan ? MONTHLY_PLAN_PRICES[plan as VenuePlanId] : undefined;
  if (!monthly) return 0;
  return cadence === "annual" ? (monthly * 11) / 12 : monthly;
}

function emptyData(scope: AnalyticsScope): PlatformAnalyticsData {
  const months = last12Months();
  return {
    activationRate: 0,
    activeVenueCount: 0,
    avgStorageHours: null,
    avgUtilization: 0,
    currentMrr: 0,
    mrrIsEstimated: true,
    mrrTrend: months.map((m) => ({ label: m.label, mrr: 0 })),
    planMix: [],
    scope,
    signupsVsCancellations: months.map((m) => ({ label: m.label, signups: 0, cancellations: 0 })),
    suspendedVenueCount: 0,
    ticketTrend: months.map((m) => ({ label: m.label, created: 0, activated: 0, collected: 0 })),
    totalTickets: 0,
    venueOptions: [],
  };
}

export async function getPlatformAnalyticsData(scope: AnalyticsScope): Promise<PlatformAnalyticsData> {
  if (!isSupabaseAdminConfigured()) return emptyData(scope);

  const supabase = createAdminClient();
  const months = last12Months();
  const rangeStart = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString();

  // ── Venue options for the scope picker (always unscoped) ──────────────────
  const { data: venueOptionRows } = await supabase.from("venues").select("id, name").order("name");
  const venueOptions = (venueOptionRows ?? []).map((v) => ({ id: v.id, name: v.name }));

  // ── Venue rows in scope ─────────────────────────────────────────────────────
  let venueQuery = supabase
    .from("venues")
    .select(
      "id, name, active, billing_plan, billing_cadence, country, capacity, created_at, cancellation_requested_at",
    );
  if (scope.type === "country") venueQuery = venueQuery.eq("country", scope.country);
  if (scope.type === "venue") venueQuery = venueQuery.eq("id", scope.venueId);
  const { data: venueRows } = await venueQuery;
  const venues = venueRows ?? [];
  const venueIdsInScope = venues.map((v) => v.id);

  // ── Tickets in scope, last 12 months ────────────────────────────────────────
  let ticketQuery = supabase
    .from("tickets")
    .select("id, venue_id, status, created_at, activated_at, collected_at")
    .gte("created_at", rangeStart)
    .limit(20000);
  if (scope.type !== "total") ticketQuery = ticketQuery.in("venue_id", venueIdsInScope.length > 0 ? venueIdsInScope : ["__none__"]);
  const { data: ticketRows } = await ticketQuery;
  const tickets = ticketRows ?? [];

  // Total ticket count in scope (not limited to 12mo, for the all-time stat)
  let totalTicketsQuery = supabase.from("tickets").select("id", { count: "exact", head: true });
  if (scope.type !== "total") {
    totalTicketsQuery = totalTicketsQuery.in("venue_id", venueIdsInScope.length > 0 ? venueIdsInScope : ["__none__"]);
  }
  const { count: totalTicketsCount } = await totalTicketsQuery;

  // ── Currently-stored items, for utilization (scoped to active venues) ──────
  const activeVenues = venues.filter((v) => v.active);
  const activeVenueIds = activeVenues.map((v) => v.id);
  let storedItemCount = 0;
  if (activeVenueIds.length > 0) {
    const { data: openTickets } = await supabase
      .from("tickets")
      .select("id")
      .in("venue_id", activeVenueIds)
      .in("status", ["active", "partially_collected", "forgotten"]);
    const openIds = (openTickets ?? []).map((t) => t.id);
    if (openIds.length > 0) {
      const { data: items } = await supabase
        .from("ticket_items")
        .select("quantity")
        .in("ticket_id", openIds)
        .is("collected_at", null);
      storedItemCount = (items ?? []).reduce((sum, i) => sum + (i.quantity || 1), 0);
    }
  }
  const totalCapacity = activeVenues.reduce((sum, v) => sum + (v.capacity || 0), 0);
  const avgUtilization = totalCapacity > 0 ? Math.round((storedItemCount / totalCapacity) * 100) : 0;

  // ── Revenue: current MRR (real) ─────────────────────────────────────────────
  const currentMrr = activeVenues.reduce(
    (sum, v) => sum + monthlyEquivalent(v.billing_plan, v.billing_cadence),
    0,
  );

  // ── Revenue trend: approximated from signup dates + current plan/cadence ───
  // Caveat: there's no historical invoice ledger, so this assumes every venue
  // has held its *current* plan/cadence since it signed up — a venue that
  // upgraded/downgraded will show its new plan retroactively across the
  // whole trend, not the plan it actually had at the time.
  const mrrTrend = months.map((bucket) => {
    const [y, m] = bucket.month.split("-").map(Number);
    const bucketEnd = new Date(y, m, 0, 23, 59, 59);
    const mrr = venues
      .filter((v) => new Date(v.created_at) <= bucketEnd)
      .reduce((sum, v) => sum + monthlyEquivalent(v.billing_plan, v.billing_cadence), 0);
    return { label: bucket.label, mrr: Math.round(mrr) };
  });

  // ── Ticket volume trend ──────────────────────────────────────────────────────
  const ticketTrend = months.map((bucket) => {
    const [y, m] = bucket.month.split("-").map(Number);
    const bucketStart = new Date(y, m - 1, 1);
    const bucketEnd = new Date(y, m, 1);
    const inBucket = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= bucketStart && d < bucketEnd;
    };
    return {
      activated: tickets.filter((t) => inBucket(t.activated_at)).length,
      collected: tickets.filter((t) => inBucket(t.collected_at)).length,
      created: tickets.filter((t) => inBucket(t.created_at)).length,
      label: bucket.label,
    };
  });

  const createdCount = tickets.length;
  const activatedCount = tickets.filter((t) => t.activated_at).length;
  const activationRate = createdCount > 0 ? Math.round((activatedCount / createdCount) * 100) : 0;

  const storageDurations = tickets
    .filter((t) => t.activated_at && t.collected_at)
    .map((t) => (new Date(t.collected_at as string).getTime() - new Date(t.activated_at as string).getTime()) / 3600000);
  const avgStorageHours =
    storageDurations.length > 0
      ? Math.round((storageDurations.reduce((s, v) => s + v, 0) / storageDurations.length) * 10) / 10
      : null;

  // ── Signups vs cancellations trend ──────────────────────────────────────────
  const signupsVsCancellations = months.map((bucket) => {
    const [y, m] = bucket.month.split("-").map(Number);
    const bucketStart = new Date(y, m - 1, 1);
    const bucketEnd = new Date(y, m, 1);
    const inBucket = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= bucketStart && d < bucketEnd;
    };
    return {
      cancellations: venues.filter((v) => inBucket(v.cancellation_requested_at)).length,
      label: bucket.label,
      signups: venues.filter((v) => inBucket(v.created_at)).length,
    };
  });

  // ── Plan mix ─────────────────────────────────────────────────────────────────
  const planGroups = new Map<string, { count: number; revenue: number }>();
  for (const v of venues) {
    const key = v.billing_plan ?? "none";
    const entry = planGroups.get(key) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    if (v.active) entry.revenue += monthlyEquivalent(v.billing_plan, v.billing_cadence);
    planGroups.set(key, entry);
  }
  const planMix = [...planGroups.entries()].map(([plan, v]) => ({
    count: v.count,
    label: planLabel(plan === "none" ? null : plan),
    plan,
    revenue: Math.round(v.revenue),
  }));

  return {
    activationRate,
    activeVenueCount: venues.filter((v) => v.active).length,
    avgStorageHours,
    avgUtilization,
    currentMrr: Math.round(currentMrr),
    mrrIsEstimated: true,
    mrrTrend,
    planMix,
    scope,
    signupsVsCancellations,
    suspendedVenueCount: venues.filter((v) => !v.active).length,
    ticketTrend,
    totalTickets: totalTicketsCount ?? 0,
    venueOptions,
  };
}
