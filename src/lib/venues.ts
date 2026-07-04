import crypto from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type VenueSignupSummary = {
  billingPlan: "starter" | "professional" | "per_event" | null;
  billingStatus: string;
  city: string | null;
  companyName?: string;
  contactEmail: string;
  contactName?: string;
  id?: string;
  name: string;
  slug?: string;
  venueNames?: string[];
};

export const venuePlans = [
  {
    id: "starter",
    name: "Starter",
    price: "£49 / month",
    description: "For smaller venues running one cloakroom counter.",
    features: ["Up to 250 tickets per month", "QR and fallback code verification", "Basic venue dashboard"],
    venues: "1 venue",
    devices: "1 device included",
    enterprise: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: "£149 / month",
    description: "For busy venues with regular storage operations.",
    features: ["Up to 1,500 tickets per month", "Staff scanner workflow", "Analytics and ticket history"],
    venues: "Up to 3 venues",
    devices: "1 device per venue",
    enterprise: false,
  },
  {
    id: "per_event",
    name: "Per event",
    price: "£399 / event",
    description: "For temporary cloakrooms, launches, and one-off events.",
    features: ["Event-ready onboarding", "Guest QR pass flow", "Post-event operations review"],
    venues: "1 venue per event",
    devices: "1 device included",
    enterprise: false,
  },
] as const;

export type VenuePlanId = (typeof venuePlans)[number]["id"];

// Monthly prices in GBP, used for both the signup pricing toggle and the
// cancellation "pay remaining balance" calculation. per_event has no monthly
// price — it's billed per event, not a subscription.
export const MONTHLY_PLAN_PRICES: Partial<Record<VenuePlanId, number>> = {
  starter: 49,
  professional: 149,
};

export function slugifyVenueName(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "venue"}-${crypto.randomBytes(2).toString("hex")}`;
}

export async function getVenueSignupSummary(
  venueId?: string,
): Promise<VenueSignupSummary | null> {
  if (!venueId || !isSupabaseAdminConfigured()) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, slug, city, contact_email, billing_plan, billing_status")
    .eq("id", venueId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    billingPlan: data.billing_plan,
    billingStatus: data.billing_status,
    city: data.city,
    contactEmail: data.contact_email,
    id: data.id,
    name: data.name,
    slug: data.slug,
  };
}
