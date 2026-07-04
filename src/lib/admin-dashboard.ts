import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { MONTHLY_PLAN_PRICES } from "@/lib/venues";

export type AdminVenueReview = {
  address: string | null;
  bagCapacity: number;
  billingPlan: string | null;
  billingStatus: string;
  capacity: number;
  city: string | null;
  contactEmail: string;
  contactPhone: string | null;
  country: string | null;
  createdAt: string;
  extraDevices: number;
  hangerCapacity: number;
  id: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  postalCode: string | null;
  status: "approved" | "suspended";
};

export type AdminVenueDetail = AdminVenueReview & {
  billingCadence: "monthly" | "annual";
  cancellationRequestedAt: string | null;
  subscriptionEndsAt: string | null;
  stripeCustomerId: string | null;
};

export type CountryFilter = "all" | "United Kingdom" | "United Arab Emirates";

export const COUNTRY_FILTER_OPTIONS: Array<{ label: string; value: CountryFilter }> = [
  { label: "Total", value: "all" },
  { label: "UK", value: "United Kingdom" },
  { label: "UAE", value: "United Arab Emirates" },
];

export type AdminDashboardData = {
  countryFilter: CountryFilter;
  stats: Array<{ helper?: string; label: string; value: string; tone: "blue" | "green" | "warning" | "danger" | "neutral" }>;
  venues: AdminVenueReview[];
};

function formatCount(value: number | null) {
  return String(value ?? 0);
}

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function emptyData(countryFilter: CountryFilter): AdminDashboardData {
  return {
    countryFilter,
    stats: [
      { helper: "Live + suspended", label: "Total venues", value: "0", tone: "neutral" },
      { helper: "Active subscriptions", label: "MRR", value: formatGbp(0), tone: "green" },
      { helper: "Needs billing action", label: "Billing issues", value: "0", tone: "danger" },
      { helper: "Ever requested", label: "Cancellations", value: "0", tone: "warning" },
      { helper: "All-time bookings", label: "Demo call requests", value: "0", tone: "blue" },
    ],
    venues: [],
  };
}

export async function getAdminDashboardData(countryFilter: CountryFilter = "all"): Promise<AdminDashboardData> {
  if (!isSupabaseAdminConfigured()) {
    return emptyData(countryFilter);
  }

  const supabase = createAdminClient();

  const scopeToCountry = <T extends { eq: (col: string, val: string) => T }>(query: T): T =>
    countryFilter === "all" ? query : query.eq("country", countryFilter);

  const [totalVenues, billingIssues, cancellations, demoRequests, mrrVenues, venueRows] = await Promise.all([
    scopeToCountry(supabase.from("venues").select("id", { count: "exact", head: true })),
    scopeToCountry(
      supabase
        .from("venues")
        .select("id", { count: "exact", head: true })
        .in("billing_status", ["incomplete", "past_due", "canceled", "unpaid"]),
    ),
    scopeToCountry(
      supabase
        .from("venues")
        .select("id", { count: "exact", head: true })
        .not("cancellation_requested_at", "is", null),
    ),
    scopeToCountry(supabase.from("leads").select("id", { count: "exact", head: true })),
    // MRR needs the actual plan + cadence per active, non-per-event venue —
    // count queries can't express that, so fetch the rows and sum in JS.
    scopeToCountry(
      supabase
        .from("venues")
        .select("billing_plan, billing_cadence")
        .eq("active", true)
        .in("billing_plan", ["starter", "professional"]),
    ),
    // Venue approval is automatic on signup, so every venue is either live
    // ("approved") or manually deactivated by an admin ("suspended") — fetch
    // all of them, not just active ones, so suspended venues still show up.
    scopeToCountry(
      supabase
        .from("venues")
        .select(
          "id, name, address, city, postal_code, contact_email, contact_phone, country, capacity, hanger_capacity, bag_capacity, extra_devices, billing_plan, billing_status, active, created_at, latitude, longitude",
        ),
    ).order("created_at", { ascending: false }).limit(20),
  ]);

  // Annual plans are normalized to their monthly-equivalent contribution
  // (pay 11 months, get 12 — same "1 month free" model used at signup).
  const mrr = (mrrVenues.data ?? []).reduce((sum, v) => {
    const monthly = v.billing_plan ? MONTHLY_PLAN_PRICES[v.billing_plan as "starter" | "professional"] : undefined;
    if (!monthly) return sum;
    return sum + (v.billing_cadence === "annual" ? (monthly * 11) / 12 : monthly);
  }, 0);

  return {
    countryFilter,
    stats: [
      { helper: "Live + suspended", label: "Total venues", value: formatCount(totalVenues.count), tone: "neutral" },
      { helper: "Active subscriptions", label: "MRR", value: formatGbp(mrr), tone: "green" },
      { helper: "Needs billing action", label: "Billing issues", value: formatCount(billingIssues.count), tone: "danger" },
      { helper: "Ever requested", label: "Cancellations", value: formatCount(cancellations.count), tone: "warning" },
      { helper: "All-time bookings", label: "Demo call requests", value: formatCount(demoRequests.count), tone: "blue" },
    ],
    venues:
      venueRows.data?.map((venue) => ({
        address: venue.address ?? null,
        bagCapacity: venue.bag_capacity ?? 0,
        billingPlan: venue.billing_plan,
        billingStatus: venue.billing_status,
        capacity: venue.capacity,
        city: venue.city,
        contactEmail: venue.contact_email,
        contactPhone: venue.contact_phone,
        country: venue.country ?? null,
        createdAt: venue.created_at,
        extraDevices: venue.extra_devices ?? 0,
        hangerCapacity: venue.hanger_capacity ?? 0,
        id: venue.id,
        latitude: venue.latitude ?? null,
        longitude: venue.longitude ?? null,
        name: venue.name,
        postalCode: venue.postal_code ?? null,
        status: venue.active ? ("approved" as const) : ("suspended" as const),
      })) ?? [],
  };
}

export async function getAdminVenueDetail(venueId: string): Promise<AdminVenueDetail | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const supabase = createAdminClient();
  const { data: venue } = await supabase
    .from("venues")
    .select(
      "id, name, address, city, postal_code, contact_email, contact_phone, country, capacity, hanger_capacity, bag_capacity, extra_devices, billing_plan, billing_status, billing_cadence, cancellation_requested_at, subscription_ends_at, stripe_customer_id, active, created_at, latitude, longitude",
    )
    .eq("id", venueId)
    .maybeSingle();

  if (!venue) return null;

  return {
    address: venue.address ?? null,
    bagCapacity: venue.bag_capacity ?? 0,
    billingCadence: venue.billing_cadence,
    billingPlan: venue.billing_plan,
    billingStatus: venue.billing_status,
    cancellationRequestedAt: venue.cancellation_requested_at,
    capacity: venue.capacity,
    city: venue.city,
    contactEmail: venue.contact_email,
    contactPhone: venue.contact_phone,
    country: venue.country ?? null,
    createdAt: venue.created_at,
    extraDevices: venue.extra_devices ?? 0,
    hangerCapacity: venue.hanger_capacity ?? 0,
    id: venue.id,
    latitude: venue.latitude ?? null,
    longitude: venue.longitude ?? null,
    name: venue.name,
    postalCode: venue.postal_code ?? null,
    status: venue.active ? ("approved" as const) : ("suspended" as const),
    stripeCustomerId: venue.stripe_customer_id,
    subscriptionEndsAt: venue.subscription_ends_at,
  };
}
