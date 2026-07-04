"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];

export type CustomerTicket = {
  ticketId: string;
  venueName: string;
  status: TicketStatus;
  itemType: string | null;
  itemCount: number;
  storageLocation: string | null;
  createdAt: string;
  expiresAt: string;
};

export type AccountData = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  provider: string | null;
  tickets: CustomerTicket[];
  cloakClubMemberSince: string | null;
};

export type AccountGuardResult = "ok" | "unauthenticated" | "admin" | "venue";

export async function checkAccountAccess(): Promise<AccountGuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "unauthenticated";

  const admin = createAdminClient();
  const [{ data: profile }, { data: venueRoles }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("venue_staff").select("venue_id").eq("profile_id", user.id).limit(1),
  ]);

  if (profile?.role === "platform_admin") return "admin";
  if (venueRoles && venueRoles.length > 0) return "venue";
  return "ok";
}

export async function getAccountData(): Promise<AccountData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [profileResult, ticketsResult, membershipResult] = await Promise.all([
    admin.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    admin
      .from("tickets")
      .select("public_code, status, item_type, item_count, storage_location, created_at, expires_at, venue_id")
      .eq("guest_email", user.email ?? "")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("guest_contacts")
      .select("membership_token_hash, member_since")
      .eq("email_normalized", (user.email ?? "").toLowerCase())
      .maybeSingle(),
  ]);

  // Fetch venue names for all tickets
  const venueIds = [...new Set((ticketsResult.data ?? []).map((t) => t.venue_id))];
  const venueMap: Record<string, string> = {};
  if (venueIds.length > 0) {
    const { data: venues } = await admin.from("venues").select("id, name").in("id", venueIds);
    venues?.forEach((v) => { venueMap[v.id] = v.name; });
  }

  const tickets: CustomerTicket[] = (ticketsResult.data ?? []).map((t) => ({
    ticketId: t.public_code,
    venueName: venueMap[t.venue_id] ?? "Venue",
    status: t.status,
    itemType: t.item_type,
    itemCount: t.item_count,
    storageLocation: t.storage_location,
    createdAt: t.created_at,
    expiresAt: t.expires_at,
  }));

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profileResult.data?.full_name ?? user.user_metadata?.full_name ?? null,
    phone: profileResult.data?.phone ?? null,
    provider: user.app_metadata?.provider ?? null,
    tickets,
    cloakClubMemberSince: membershipResult.data?.membership_token_hash
      ? (membershipResult.data.member_since ?? null)
      : null,
  };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    full_name: fullName || null,
    phone: phone || null,
  });

  if (error) return { error: "Failed to update profile." };

  await supabase.auth.updateUser({ data: { full_name: fullName } });

  return { error: null };
}

