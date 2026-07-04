"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  clearDraftVenueSignup,
  getDraftVenueSignup,
  setDraftVenueSignup,
  type VenueEntry,
  type VenueSignupDraft,
} from "@/lib/venue-signup-session";
import { slugifyVenueName, type VenuePlanId, venuePlans } from "@/lib/venues";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { sendEmail, getSiteUrl } from "@/lib/email";
import { NewVenuePendingEmail } from "@/lib/emails/NewVenuePendingEmail";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function isPlanId(value: string): value is VenuePlanId {
  return venuePlans.some((plan) => plan.id === value);
}

async function findUserByEmail(email: string) {
  const supabase = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < 100) return null;
  }

  return null;
}

// ── Step 1 → Step 2: select plan ──────────────────────────────────────────────

export async function selectVenuePlan(formData: FormData) {
  const plan = readField(formData, "plan");
  const billingCadenceRaw = readField(formData, "billingCadence");
  const billingCadence: "monthly" | "annual" = billingCadenceRaw === "annual" ? "annual" : "monthly";

  if (!isSupabaseAdminConfigured()) {
    fail("/venuesignup", "Plan selection is temporarily unavailable.");
  }

  if (!isPlanId(plan)) {
    fail("/venuesignup", "Invalid plan selected. Please try again.");
  }

  const existing = await getDraftVenueSignup();
  const draft: VenueSignupDraft = existing
    ? { ...existing, billingCadence, billingPlan: plan }
    : {
        billingCadence,
        billingPlan: plan,
        contactName: "",
        companyName: "",
        contactEmail: "",
        contactPhone: "",
        venueCount: "single",
        country: "United Kingdom",
        venues: [],
      };

  await setDraftVenueSignup(draft);
  redirect("/venuesignup");
}

// ── Step 2 → Step 3: save venue details ───────────────────────────────────────

export async function createVenueSignup(formData: FormData) {
  const existing = await getDraftVenueSignup();
  if (!existing?.billingPlan) {
    fail("/venuesignup", "Please select a plan before entering venue details.");
  }

  if (!isSupabaseAdminConfigured()) {
    fail("/venuesignup", "Venue registration is temporarily unavailable.");
  }

  const contactName = readField(formData, "contactName");
  const companyName = readField(formData, "companyName");
  const contactEmail = readField(formData, "contactEmail").toLowerCase();
  const contactPhone = readField(formData, "contactPhone");
  const venueCount = readField(formData, "venueCount") as "single" | "multiple";
  const venueQuantityRaw = Number(readField(formData, "venueQuantity") || "1");

  const singleVenueOnly = existing.billingPlan === "starter" || existing.billingPlan === "per_event";
  if (singleVenueOnly && venueCount === "multiple") {
    fail("/venuesignup", "The Starter plan supports one venue only. Upgrade to Professional for multiple venues.");
  }

  if (!contactName) fail("/venuesignup", "Full name is required.");
  if (!contactEmail || !isValidEmail(contactEmail)) {
    fail("/venuesignup", "Please enter a valid email address.");
  }
  if (!contactPhone) fail("/venuesignup", "Phone number is required.");
  if (!isValidPhone(contactPhone)) {
    fail("/venuesignup", "Please enter a valid phone number.");
  }

  const numVenues = venueCount === "single" ? 1 : Math.min(Math.max(venueQuantityRaw, 2), 3);
  const venues: VenueEntry[] = [];

  for (let i = 0; i < numVenues; i++) {
    const p = `venue_${i}`;
    const venueName = readField(formData, `${p}_venueName`);
    if (!venueName) fail("/venuesignup", `Venue ${i + 1}: name is required.`);

    const hangerCapacity = Number(readField(formData, `${p}_hangerCapacity`) || "0");
    const bagCapacity = Number(readField(formData, `${p}_bagCapacity`) || "0");
    const addressLine1 = readField(formData, `${p}_addressLine1`);
    if (!addressLine1) fail("/venuesignup", `Venue ${i + 1}: address line 1 is required.`);

    const latRaw = readField(formData, `${p}_latitude`);
    const lngRaw = readField(formData, `${p}_longitude`);
    const venueCountry = readField(formData, `${p}_country`) || "United Kingdom";

    venues.push({
      venueName,
      hangerCapacity,
      bagCapacity,
      addressLine1,
      addressLine2: readField(formData, `${p}_addressLine2`),
      city: readField(formData, `${p}_city`),
      postalCode: readField(formData, `${p}_postalCode`).toUpperCase(),
      country: venueCountry,
      latitude: latRaw ? Number(latRaw) : null,
      longitude: lngRaw ? Number(lngRaw) : null,
      extraDevices: Number(readField(formData, `${p}_extraDevices`) || "0"),
    });
  }

  await setDraftVenueSignup({
    ...existing,
    contactName,
    companyName,
    contactEmail,
    contactPhone,
    venueCount,
    venueQuantity: venueQuantityRaw,
    venues,
  });

  redirect("/venuesignup");
}

// ── Back navigation: clear venue details (keep or clear plan) ─────────────────

export async function clearPlanFromDraft(formData: FormData) {
  const draft = await getDraftVenueSignup();
  if (!draft) {
    redirect("/venuesignup");
  }

  const keepPlan = readField(formData, "keepPlan") === "1";

  if (keepPlan) {
    // Going back from step 3 → 2: keep plan, clear saved venues so step detection lands on step 2
    await setDraftVenueSignup({
      ...draft,
      venues: [],
      contactName: draft.contactName ?? "",
      companyName: draft.companyName ?? "",
      contactEmail: draft.contactEmail ?? "",
      contactPhone: draft.contactPhone ?? "",
      venueCount: draft.venueCount ?? "single",
      country: draft.country ?? "United Kingdom",
    });
  } else {
    // Going back from step 2 → 1: clear everything except maybe keep the plan cleared too
    await clearDraftVenueSignup();
  }

  redirect("/venuesignup");
}

// ── Step 3: finish signup ──────────────────────────────────────────────────────

export async function finishVenueSignup(formData: FormData) {
  const draft = await getDraftVenueSignup();
  const password = readField(formData, "password");
  const confirmPassword = readField(formData, "confirmPassword");

  if (!draft || !draft.billingPlan || !draft.venues.length) {
    fail("/venuesignup", "Please complete all steps before submitting.");
  }

  if (!isSupabaseAdminConfigured()) {
    fail("/venuesignup", "Venue registration is temporarily unavailable.");
  }

  if (!isValidEmail(draft.contactEmail)) {
    fail("/venuesignup", "Please enter a valid contact email address.");
  }

  if (password.length < 8) {
    fail("/venuesignup", "Manager password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    fail("/venuesignup", "Manager passwords do not match.");
  }

  const supabase = createAdminClient();
  const primaryVenue = draft.venues[0];

  const existing = await findUserByEmail(draft.contactEmail);
  if (existing) {
    fail(
      "/venuesignup",
      "An account with this email address already exists. Please sign in to your existing account to manage your venues.",
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: draft.contactEmail,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: draft.contactName || `${primaryVenue.venueName} Manager`,
    },
  });

  if (error || !data.user) {
    fail("/venuesignup", "We could not create the manager account. Please try again.");
  }

  const manager = data.user;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", manager.id)
    .maybeSingle();

  const { error: profileError } = await supabase.from("profiles").upsert({
    email: draft.contactEmail,
    full_name: draft.contactName || `${primaryVenue.venueName} Manager`,
    id: manager.id,
    phone: draft.contactPhone,
    role: existingProfile?.role ?? "guest",
  });

  if (profileError) {
    fail("/venuesignup", "We could not prepare the manager profile. Please try again.");
  }

  const now = new Date().toISOString();
  let firstVenueId: string | undefined;

  for (const entry of draft.venues) {
    const address = [entry.addressLine1, entry.addressLine2].filter(Boolean).join(", ");
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({
        active: true,
        address,
        billing_cadence: draft.billingCadence ?? "monthly",
        billing_plan: draft.billingPlan,
        billing_status: "trialing",
        capacity: entry.hangerCapacity + entry.bagCapacity,
        city: entry.city,
        contact_email: draft.contactEmail,
        contact_phone: draft.contactPhone,
        country: entry.country,
        created_by: manager.id,
        extra_devices: entry.extraDevices,
        hanger_capacity: entry.hangerCapacity,
        bag_capacity: entry.bagCapacity,
        latitude: entry.latitude ?? null,
        longitude: entry.longitude ?? null,
        name: entry.venueName,
        postal_code: entry.postalCode,
        slug: slugifyVenueName(entry.venueName),
        stripe_customer_id: `sample_${crypto.randomUUID()}`,
        stripe_price_id: `sample_${draft.billingPlan}`,
      })
      .select("id")
      .single();

    if (venueError || !venue) {
      console.error("[finishVenueSignup] venue insert error:", venueError);
      fail("/venuesignup", "We could not create the venue registration. Please try again.");
    }

    if (!firstVenueId) firstVenueId = venue.id;

    const { error: staffError } = await supabase.from("venue_staff").insert({
      accepted_at: now,
      profile_id: manager.id,
      role: "manager",
      venue_id: venue.id,
    });

    if (staffError) {
      fail("/venuesignup", "We could not assign the venue manager. Please try again.");
    }
  }

  await clearDraftVenueSignup();

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New venue signup: ${primaryVenue.venueName}`,
      react: NewVenuePendingEmail({
        billingPlan: draft.billingPlan ?? "unknown",
        capacity: primaryVenue.hangerCapacity + primaryVenue.bagCapacity,
        city: primaryVenue.city,
        contactEmail: draft.contactEmail,
        contactName: draft.contactName ?? `${primaryVenue.venueName} Manager`,
        dashboardUrl: `${getSiteUrl()}/masterdashboard`,
        venueName: primaryVenue.venueName,
      }),
    });
  }

  // Sign the new manager in so they land on the dashboard
  const { createClient: createBrowserServer } = await import("@/lib/supabase/server");
  const serverClient = await createBrowserServer();
  await serverClient.auth.signInWithPassword({
    email: draft.contactEmail,
    password,
  });

  redirect("/venuedashboard");
}
