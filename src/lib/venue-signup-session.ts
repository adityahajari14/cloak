import { cookies } from "next/headers";
import type { VenuePlanId } from "@/lib/venues";

const draftDataCookie = "cloak_venue_signup_draft";
const submittedCookie = "cloak_venue_submitted_id";

const cookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 24,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export type VenueEntry = {
  venueName: string;
  hangerCapacity: number;
  bagCapacity: number;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  extraDevices: number;
};

export type VenueSignupDraft = {
  // Step 1 — plan selection
  billingPlan?: VenuePlanId;
  billingCadence?: "monthly" | "annual";

  // Step 2 — contact + venue details
  contactName: string;
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  venueCount: "single" | "multiple";
  venueQuantity?: number;
  country: string;
  venues: VenueEntry[];
};

export async function getDraftVenueSignup(): Promise<VenueSignupDraft | null> {
  const value = (await cookies()).get(draftDataCookie)?.value;
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as VenueSignupDraft;
  } catch {
    return null;
  }
}

export async function setDraftVenueSignup(draft: VenueSignupDraft) {
  (await cookies()).set(draftDataCookie, encodeURIComponent(JSON.stringify(draft)), cookieOptions);
}

export async function clearDraftVenueSignup() {
  (await cookies()).delete(draftDataCookie);
}

export async function getSubmittedVenueId() {
  return (await cookies()).get(submittedCookie)?.value;
}

export async function setSubmittedVenueId(venueId: string) {
  (await cookies()).set(submittedCookie, venueId, cookieOptions);
}
