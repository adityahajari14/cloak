import crypto from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { hashTicketToken } from "@/lib/tickets";

/** Fixed gender options for the Cloak Club signup form. */
export const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say", "Other"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export function isValidGender(value: string): value is Gender {
  return (GENDER_OPTIONS as readonly string[]).includes(value);
}

/**
 * A Cloak Club membership pass is identity-based and venue-agnostic. The pass
 * encodes a permanent membership token — scanning it at any venue resolves to
 * the member. We store only the hash; the raw token lives in the wallet pass QR.
 */
export function createMembershipToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    hash: hashTicketToken(token),
    token,
  };
}

export type PublicMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  memberSince: string | null;
};

/** Resolve a raw membership token (from a scanned pass) to its member. */
export async function getMemberByToken(token: string): Promise<PublicMember | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_contacts")
    .select("id, full_name, email, phone, member_since")
    .eq("membership_token_hash", hashTicketToken(token))
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    memberSince: data.member_since,
  };
}
