"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVenueAccess } from "@/lib/auth/guards";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation";
import { planCancellation } from "@/lib/billing";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(message: string, venueId?: string): never {
  const suffix = venueId ? `&venueId=${encodeURIComponent(venueId)}` : "";
  redirect(`/venuesettings?message=${encodeURIComponent(message)}${suffix}`);
}

function fail(message: string, venueId?: string): never {
  const suffix = venueId ? `&venueId=${encodeURIComponent(venueId)}` : "";
  redirect(`/venuesettings?error=${encodeURIComponent(message)}${suffix}`);
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

// ─── Create staff account ──────────────────────────────────────────────────────

export async function createVenueStaffAccount(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);
  const fullName = readField(formData, "fullName");
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password");
  const roleRaw = readField(formData, "role");
  const staffRole: "staff" | "manager" = roleRaw === "manager" ? "manager" : "staff";

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("Staff account creation is temporarily unavailable.");
  }

  const venueId =
    readField(formData, "venueId") || guard.venueRoles.find((r) => r.role === "manager")?.venueId;
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    fail("No managed venue was found for this account.");
  }

  if (!fullName || !email || !password) fail("Please complete all staff account details.", venueId);
  if (!isValidEmail(email)) fail("Please enter a valid staff email address.", venueId);
  if (password.length < 8) fail("Staff password must be at least 8 characters.", venueId);

  const supabase = createAdminClient();

  // Enforce device limit before creating the account (only for staff, not additional managers)
  if (staffRole === "staff") {
    const [venueRow, existingStaffResult] = await Promise.all([
      supabase.from("venues").select("extra_devices").eq("id", venueId).maybeSingle(),
      supabase
        .from("venue_staff")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("role", "staff"),
    ]);
    const totalDevices = 1 + (venueRow.data?.extra_devices ?? 0);
    const usedDevices = (existingStaffResult.count ?? 0) + 1; // +1 for the manager
    if (usedDevices >= totalDevices) {
      fail(
        `Device limit reached. Your plan allows ${totalDevices} device${totalDevices === 1 ? "" : "s"} (including the manager account).`,
        venueId,
      );
    }
  }

  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) fail("We could not create the staff account. Please try again.", venueId);
    user = data.user;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { full_name: fullName },
    });
    if (error) fail("We could not update the staff account. Please try again.", venueId);
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { error: profileError } = await supabase.from("profiles").upsert({
    email,
    full_name: fullName,
    id: user.id,
    role: existingProfile?.role ?? "guest",
  });
  if (profileError) fail("We could not prepare the staff profile. Please try again.", venueId);

  const { data: existingStaff } = await supabase
    .from("venue_staff")
    .select("id")
    .eq("venue_id", venueId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existingStaff) {
    await supabase
      .from("venue_staff")
      .update({ accepted_at: new Date().toISOString(), role: staffRole })
      .eq("id", existingStaff.id);
  } else {
    const { error: staffError } = await supabase.from("venue_staff").insert({
      accepted_at: new Date().toISOString(),
      profile_id: user.id,
      role: staffRole,
      venue_id: venueId,
    });
    if (staffError) fail("We could not attach the staff account to this venue.", venueId);
  }

  finish(`${staffRole === "manager" ? "Manager" : "Staff"} account created.`, venueId);
}

// ─── Remove staff member ───────────────────────────────────────────────────────

export async function removeStaffMember(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);
  const staffId = readField(formData, "staffId");

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("This action is temporarily unavailable.");
  }

  const venueId =
    readField(formData, "venueId") || guard.venueRoles.find((r) => r.role === "manager")?.venueId;
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    fail("No managed venue was found for this account.");
  }
  if (!staffId) fail("Staff member not identified.", venueId);

  const supabase = createAdminClient();

  // Verify the staff row belongs to this venue and is not a manager (can't remove managers)
  const { data: staffRow } = await supabase
    .from("venue_staff")
    .select("id, role, profile_id")
    .eq("id", staffId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!staffRow) fail("Staff member not found in this venue.", venueId);
  if (staffRow.role === "manager") fail("Managers cannot be removed from this page.", venueId);
  if (staffRow.profile_id === guard.userId) fail("You cannot remove your own account.", venueId);

  const { error } = await supabase.from("venue_staff").delete().eq("id", staffId);
  if (error) fail("Could not remove staff member. Please try again.", venueId);

  revalidatePath("/venuesettings");
  finish("Staff member removed.", venueId);
}

// ─── Update venue details ──────────────────────────────────────────────────────

export async function updateVenueDetails(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("Venue updates are temporarily unavailable.");
  }

  const venueId =
    readField(formData, "venueId") || guard.venueRoles.find((r) => r.role === "manager")?.venueId;
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    fail("No managed venue was found for this account.");
  }

  const name = readField(formData, "name");
  const city = readField(formData, "city");
  const postalCode = readField(formData, "postalCode").toUpperCase();
  const contactPhone = readField(formData, "contactPhone");
  const hangerCapacity = parseInt(readField(formData, "hangerCapacity") || "0", 10);
  const bagCapacity = parseInt(readField(formData, "bagCapacity") || "0", 10);

  if (!name) fail("Venue name is required.", venueId);
  if (isNaN(hangerCapacity) || hangerCapacity < 0) fail("Hanger slot count must be 0 or more.", venueId);
  if (isNaN(bagCapacity) || bagCapacity < 0) fail("Bag slot count must be 0 or more.", venueId);
  if (hangerCapacity + bagCapacity < 1) fail("Total capacity must be at least 1 slot.", venueId);
  if (postalCode && !/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(postalCode)) {
    fail("Please enter a valid UK postcode.", venueId);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("venues")
    .update({
      bag_capacity: bagCapacity,
      capacity: hangerCapacity + bagCapacity,
      city: city || null,
      contact_phone: contactPhone || null,
      hanger_capacity: hangerCapacity,
      name,
      postal_code: postalCode || null,
    })
    .eq("id", venueId);

  if (error) fail("Could not update venue details. Please try again.", venueId);

  revalidatePath("/venuesettings");
  revalidatePath("/venuedashboard");
  finish("Venue details updated.", venueId);
}

// ─── Update my profile ─────────────────────────────────────────────────────────

export async function updateMyProfile(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings");

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("Profile updates are temporarily unavailable.");
  }

  const fullName = readField(formData, "fullName");
  const phone = readField(formData, "phone");

  if (!fullName) fail("Full name is required.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", guard.userId);

  if (error) fail("Could not update your profile. Please try again.");

  revalidatePath("/venuesettings");
  finish("Profile updated.");
}

// ─── Update venue expiry ───────────────────────────────────────────────────────

export async function updateVenueExpiry(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("Expiry settings are temporarily unavailable.");
  }

  const venueId =
    readField(formData, "venueId") || guard.venueRoles.find((r) => r.role === "manager")?.venueId;
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    fail("No managed venue was found for this account.");
  }

  const enabled = readField(formData, "expiryEnabled") === "1";
  let ticketExpiryHours: number | null = null;

  if (enabled) {
    const raw = parseInt(readField(formData, "expiryHours"), 10);
    if (isNaN(raw) || raw < 1) fail("Expiry duration must be at least 1 hour.", venueId);
    if (raw > 720) fail("Expiry duration cannot exceed 720 hours (30 days).", venueId);
    ticketExpiryHours = raw;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("venues")
    .update({ ticket_expiry_hours: ticketExpiryHours })
    .eq("id", venueId);

  if (error) fail("Could not update expiry settings. Please try again.", venueId);

  revalidatePath("/venuesettings");
  finish(enabled ? `Tickets now expire after ${ticketExpiryHours} hours.` : "Ticket expiry disabled.", venueId);
}

/**
 * Pause or resume new guest check-ins.
 *
 * Writes `accepting_checkins`, deliberately not `active`: `active` is the
 * platform's switch (constrained against billing status, and how an admin
 * suspends a venue). This one belongs to the manager — the cloakroom is full,
 * or the counter is closed — and never touches account standing.
 *
 * Pausing does not affect items already stored: guests can still collect, and
 * staff can still scan. It only stops new tickets being created.
 */
export async function updateVenueAcceptingCheckins(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("Check-in settings are temporarily unavailable.");
  }

  const venueId =
    readField(formData, "venueId") || guard.venueRoles.find((r) => r.role === "manager")?.venueId;
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    fail("No managed venue was found for this account.");
  }

  const accepting = readField(formData, "acceptingCheckins") === "1";

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("venues")
    .update({ accepting_checkins: accepting })
    .eq("id", venueId);

  if (error) fail("Could not update check-in settings. Please try again.", venueId);

  revalidatePath("/venuesettings");
  revalidatePath("/venuedashboard");
  finish(
    accepting
      ? "Venue is active — now accepting new check-ins."
      : "Check-ins paused. Guests can still collect stored items.",
    venueId,
  );
}

// ─── Subscription cancellation ─────────────────────────────────────────────────

export type CancellationPreview = {
  effectiveEndDate: string;
  message: string;
  withinFirstYear: boolean;
  canPayRemainder: boolean;
  remainingMonthlyCharges: number;
  remainderAmount: number | null;
};

async function loadVenueForCancellation(venueId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("venues")
    .select("id, created_at, billing_cadence, billing_plan, cancellation_requested_at, subscription_ends_at")
    .eq("id", venueId)
    .maybeSingle();
  return data;
}

/** Compute the cancellation outcome for the manager to review before confirming. */
export async function previewVenueCancellation(venueId: string): Promise<CancellationPreview | { error: string }> {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);
  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    return { error: "Cancellation is temporarily unavailable." };
  }
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    return { error: "No managed venue was found for this account." };
  }

  const venue = await loadVenueForCancellation(venueId);
  if (!venue) return { error: "Venue not found." };

  const { MONTHLY_PLAN_PRICES } = await import("@/lib/venues");
  const { formatCancellationMessage } = await import("@/lib/billing");

  const plan = planCancellation({
    cadence: venue.billing_cadence,
    signupDate: new Date(venue.created_at),
  });

  const monthlyPrice = venue.billing_plan ? MONTHLY_PLAN_PRICES[venue.billing_plan] : undefined;
  const remainderAmount =
    plan.canPayRemainder && monthlyPrice ? monthlyPrice * plan.remainingMonthlyCharges : null;

  return {
    canPayRemainder: plan.canPayRemainder,
    effectiveEndDate: plan.effectiveEndDate.toISOString(),
    message: formatCancellationMessage(plan, venue.billing_cadence),
    remainderAmount,
    remainingMonthlyCharges: plan.remainingMonthlyCharges,
    withinFirstYear: plan.withinFirstYear,
  };
}

/**
 * Confirm cancellation. Records the scheduled end date and (for the pay-now
 * path) that the manager opted to pay the remaining balance up front. No real
 * charge or subscription cancellation happens yet — Stripe isn't wired up, so
 * this only updates our own records; a future job/webhook will need to action
 * subscription_ends_at against the real payment processor.
 */
export async function confirmVenueCancellation(
  venueId: string,
  payRemainderNow: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);
  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    return { ok: false, error: "Cancellation is temporarily unavailable." };
  }
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    return { ok: false, error: "No managed venue was found for this account." };
  }

  const venue = await loadVenueForCancellation(venueId);
  if (!venue) return { ok: false, error: "Venue not found." };

  const plan = planCancellation({
    cadence: venue.billing_cadence,
    signupDate: new Date(venue.created_at),
  });

  // Paying the remainder now stops service immediately instead of waiting
  // for the 1-year anniversary — only meaningful within the first year on a
  // monthly plan.
  const effectiveEndDate =
    payRemainderNow && plan.canPayRemainder ? new Date() : plan.effectiveEndDate;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("venues")
    .update({
      cancellation_pay_remainder: payRemainderNow && plan.canPayRemainder,
      cancellation_requested_at: new Date().toISOString(),
      subscription_ends_at: effectiveEndDate.toISOString(),
    })
    .eq("id", venueId);

  if (error) return { ok: false, error: "Could not process cancellation. Please try again." };

  revalidatePath("/venuesettings");
  return { ok: true };
}

/** Undo a pending cancellation request — venue continues as normal. */
export async function resumeVenueSubscription(venueId: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);
  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    return { ok: false, error: "This action is temporarily unavailable." };
  }
  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    return { ok: false, error: "No managed venue was found for this account." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("venues")
    .update({
      cancellation_pay_remainder: false,
      cancellation_requested_at: null,
      subscription_ends_at: null,
    })
    .eq("id", venueId);

  if (error) return { ok: false, error: "Could not resume subscription. Please try again." };

  revalidatePath("/venuesettings");
  return { ok: true };
}

// ─── Regenerate venue QR slug ─────────────────────────────────────────────────

export async function regenerateVenueQrSlug(venueId: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireVenueAccess("/venuesettings", ["manager"]);

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    return { ok: false, error: "QR regeneration is temporarily unavailable." };
  }

  if (!venueId || !guard.venueRoles.some((r) => r.venueId === venueId && r.role === "manager")) {
    return { ok: false, error: "No managed venue was found for this account." };
  }

  // Generate a new random slug: 12 hex chars prefixed with "v-"
  const newSlug = `v-${crypto.randomBytes(6).toString("hex")}`;

  const supabase = createAdminClient();
  const { error } = await supabase.from("venues").update({ slug: newSlug }).eq("id", venueId);

  if (error) return { ok: false, error: "Could not regenerate QR code. Please try again." };

  revalidatePath("/venuesettings");
  return { ok: true };
}

// ─── Change password ───────────────────────────────────────────────────────────

export async function changeMyPassword(formData: FormData) {
  const guard = await requireVenueAccess("/venuesettings");

  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) {
    fail("Password changes are temporarily unavailable.");
  }

  const newPassword = readField(formData, "newPassword");
  const confirmPassword = readField(formData, "confirmPassword");

  if (newPassword.length < 8) fail("New password must be at least 8 characters.");
  if (newPassword !== confirmPassword) fail("Passwords do not match.");

  // Use the user-scoped client so we update the currently authenticated user
  const authClient = await createClient();
  const { error } = await authClient.auth.updateUser({ password: newPassword });

  if (error) fail("Could not change password. Please try again.");

  finish("Password changed successfully.");
}
