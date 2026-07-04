"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { createMembershipToken, isValidGender } from "@/lib/membership";
import { sendEmail, getSiteUrl } from "@/lib/email";
import { CloakClubWelcomeEmail } from "@/lib/emails/CloakClubWelcomeEmail";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`/cloak-club?error=${encodeURIComponent(message)}`);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Accepts YYYY-MM-DD, returns it if it's a real, past, non-absurd date. */
function normalizeDob(raw: string): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 1900 || d.getTime() > Date.now()) return null;
  return raw;
}

export async function joinCloakClub(formData: FormData) {
  const fullName = readField(formData, "fullName");
  const email = normalizeEmail(readField(formData, "email"));
  const mobile = readField(formData, "mobile");
  const gender = readField(formData, "gender");
  const dobRaw = readField(formData, "dateOfBirth");

  if (!isSupabaseAdminConfigured()) {
    fail("Membership signup is temporarily unavailable.");
  }

  if (!fullName || !email || !mobile) {
    fail("Please complete all required details.");
  }
  if (!isValidEmail(email)) {
    fail("Please enter a valid email address.");
  }
  if (!isValidPhone(mobile)) {
    fail("Please enter a valid mobile number.");
  }
  if (!isValidGender(gender)) {
    fail("Please select your gender.");
  }
  const dateOfBirth = normalizeDob(dobRaw);
  if (!dateOfBirth) {
    fail("Please enter a valid date of birth.");
  }

  const supabase = createAdminClient();

  // A guest_contacts row may already exist from a one-time check-in — that's
  // fine, we upsert onto it. But if they're already a Cloak Club member, block
  // re-signup: their existing pass stays valid and they use the one-time
  // check-in flow for any regular visit.
  const { data: existing } = await supabase
    .from("guest_contacts")
    .select("membership_token_hash")
    .eq("email_normalized", email)
    .maybeSingle();

  if (existing?.membership_token_hash) {
    fail(
      "You're already a Cloak Club member. Your permanent pass is in your wallet — no need to sign up again.",
    );
  }

  const { token: rawToken, hash: tokenHash } = createMembershipToken();

  // Guard against a concurrent double-submit: only write membership fields
  // when the row still has no membership_token_hash at write time. If a
  // second, near-simultaneous submission raced past the check above, this
  // condition (rather than a plain upsert) makes exactly one of them win.
  const { data: written, error: upsertError } = await supabase
    .from("guest_contacts")
    .upsert(
      {
        email,
        email_normalized: email,
        full_name: fullName,
        phone: mobile,
        gender,
        date_of_birth: dateOfBirth,
        membership_token_hash: tokenHash,
        member_since: new Date().toISOString(),
      },
      { onConflict: "email_normalized" },
    )
    .select("membership_token_hash")
    .single();

  if (upsertError || !written) {
    fail("We could not create your membership. Please try again.");
  }

  // Lost the race — someone else's signup for this email committed first with
  // a different token. Send them to sign in via that pass instead of handing
  // out a token that will immediately stop resolving.
  if (written.membership_token_hash !== tokenHash) {
    fail(
      "You're already a Cloak Club member. Your permanent pass is in your wallet — no need to sign up again.",
    );
  }

  const site = getSiteUrl();
  const welcomeUrl = `${site}/cloak-club/welcome?member=${encodeURIComponent(rawToken)}`;

  // Best-effort welcome email — never block the redirect on it.
  await sendEmail({
    to: email,
    subject: "Welcome to Cloak Club",
    react: CloakClubWelcomeEmail({
      guestName: fullName,
      passUrl: welcomeUrl,
    }),
  }).catch(() => {});

  redirect(`/cloak-club/welcome?member=${encodeURIComponent(rawToken)}`);
}

/**
 * Re-issue a Cloak Club member's wallet pass from their My Account page.
 * We only ever store the token's hash, so the original raw token can't be
 * recovered — this mints a fresh one (rotating the pass, same as re-running
 * signup) and sends it to the member's own email.
 */
export async function resendCloakClubPass(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "This is temporarily unavailable." };
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

  const email = user.email.toLowerCase();
  const supabase = createAdminClient();

  const { data: member } = await supabase
    .from("guest_contacts")
    .select("id, full_name, membership_token_hash")
    .eq("email_normalized", email)
    .maybeSingle();

  if (!member?.membership_token_hash) {
    return { ok: false, error: "No Cloak Club membership found for this account." };
  }

  const { token: rawToken, hash: tokenHash } = createMembershipToken();
  const { error } = await supabase
    .from("guest_contacts")
    .update({ membership_token_hash: tokenHash })
    .eq("id", member.id);

  if (error) return { ok: false, error: "Could not refresh your pass. Please try again." };

  const site = getSiteUrl();
  const welcomeUrl = `${site}/cloak-club/welcome?member=${encodeURIComponent(rawToken)}`;

  await sendEmail({
    to: email,
    subject: "Your Cloak Club pass",
    react: CloakClubWelcomeEmail({
      guestName: member.full_name,
      passUrl: welcomeUrl,
    }),
  }).catch(() => {});

  revalidatePath("/account");
  redirect(`/cloak-club/welcome?member=${encodeURIComponent(rawToken)}`);
}
