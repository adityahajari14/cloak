import crypto from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];

export type PublicVenueOption = {
  address: string | null;
  id: string;
  label: string;
  name: string;
  slug: string;
};

export type PublicTicketItem = {
  id: string;
  label: string;
  storageLocation: string | null;
  collected: boolean;
};

export type PublicTicket = {
  createdAt: string;
  dbId: string;
  email: string;
  expiresAt: string;
  /**
   * True when the ticket was opened with its secret token (the QR / emailed
   * link), false when opened with the short public code.
   *
   * The public code is a low-entropy fallback that staff can read aloud, so it
   * must not unlock the guest's personal details — anyone who guesses one would
   * otherwise get a real name and phone number. Contact details are masked on a
   * code-only view; the token view shows them in full.
   */
  fullAccess: boolean;
  guestName: string;
  itemCount: number;
  itemDescription: string | null;
  itemType: string | null;
  items: PublicTicketItem[];
  mobile: string;
  status: TicketStatus;
  storageLocation: string | null;
  ticketId: string;
  venueAddress: string | null;
  // Captured when the venue signed up. The map pins these directly — geocoding
  // the address string instead lands in the wrong place (see VenueLocationMap).
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueId: string;
  venueName: string;
};

export type TicketLookupStatus = "found" | "invalid" | "expired";

export async function getSelectableVenues(): Promise<PublicVenueOption[]> {
  if (!isSupabaseAdminConfigured()) {
    return [];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, slug, city, address")
    .eq("active", true)
    // Manager-controlled pause: the cloakroom is full or the counter is closed,
    // so the venue drops out of the guest picker without any change to its
    // account standing (which is what `active` governs).
    .eq("accepting_checkins", true)
    .in("billing_status", ["trialing", "active"])
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((venue) => ({
    address: venue.address ?? null,
    id: venue.id,
    label: venue.city ? `${venue.name}, ${venue.city}` : venue.name,
    name: venue.name,
    slug: venue.slug,
  }));
}

export function hashTicketToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Masking for code-only lookups ────────────────────────────────────────────
//
// A ticket opened by its short public code shows enough for the holder to
// recognise it as theirs, but not enough to identify a stranger. Someone who
// guesses a code must not walk away with a real name and phone number.

/** "Aditya Hazari" → "Aditya H." */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** "+447700900123" → "•••• ••0123" */
function maskPhone(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ••${digits.slice(-4)}`;
}

/** "aditya@example.com" → "a•••••@example.com" */
function maskEmail(email: string | null): string {
  const value = (email ?? "").trim();
  const at = value.indexOf("@");
  if (at < 1) return "";
  return `${value[0]}${"•".repeat(Math.max(value.slice(0, at).length - 1, 1))}${value.slice(at)}`;
}

function normalizeTicketStatus(ticket: {
  expires_at: string;
  status: PublicTicket["status"];
}) {
  if (
    ticket.status === "pending_activation" &&
    new Date(ticket.expires_at).getTime() < Date.now()
  ) {
    return "expired";
  }

  return ticket.status;
}

async function getTicketByColumn(column: "public_code" | "qr_token_hash", value: string) {
  if (!isSupabaseAdminConfigured()) {
    return { status: "invalid" as const, ticket: null };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, public_code, guest_email, guest_name, guest_phone, status, venue_id, created_at, expires_at, item_type, item_count, item_description, storage_location",
    )
    .eq(column, value)
    .maybeSingle();

  if (error || !data) {
    return { status: "invalid" as const, ticket: null };
  }

  const [{ data: venue }, { data: itemRows }] = await Promise.all([
    supabase
      .from("venues")
      .select("name, slug, address, city, postal_code, latitude, longitude")
      .eq("id", data.venue_id)
      .maybeSingle(),
    supabase
      .from("ticket_items")
      .select("id, label, storage_location, collected_at")
      .eq("ticket_id", data.id)
      .order("added_at", { ascending: true }),
  ]);

  const status = normalizeTicketStatus(data);

  // Only the secret token proves the holder is the guest. The public code is a
  // short, human-readable fallback — treat it as an identifier, not a password.
  const fullAccess = column === "qr_token_hash";

  return {
    status: status === "expired" ? ("expired" as const) : ("found" as const),
    ticket: {
      createdAt: data.created_at,
      dbId: data.id,
      email: fullAccess ? (data.guest_email ?? "") : maskEmail(data.guest_email),
      expiresAt: data.expires_at,
      fullAccess,
      guestName: fullAccess ? data.guest_name : maskName(data.guest_name),
      itemCount: data.item_count,
      itemDescription: data.item_description,
      itemType: data.item_type,
      items: (itemRows ?? []).map((r) => ({
        id: r.id,
        label: r.label,
        storageLocation: r.storage_location ?? null,
        collected: r.collected_at !== null,
      })),
      mobile: fullAccess ? data.guest_phone : maskPhone(data.guest_phone),
      status,
      storageLocation: data.storage_location,
      ticketId: data.public_code,
      venueAddress:
        [venue?.address, venue?.city, venue?.postal_code].filter(Boolean).join(", ") || null,
      venueLatitude: venue?.latitude ?? null,
      venueLongitude: venue?.longitude ?? null,
      venueId: venue?.slug ?? data.venue_id,
      venueName: venue?.name ?? "Selected venue",
    } satisfies PublicTicket,
  };
}

export async function getPublicTicketByCode(publicCode: string) {
  return getTicketByColumn("public_code", publicCode.trim().toUpperCase());
}

export async function getPublicTicketByToken(token: string) {
  return getTicketByColumn("qr_token_hash", hashTicketToken(token));
}

export function createPublicCode() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  // The date prefix is public, so all the entropy lives in the suffix. 3 bytes
  // (~16.7M) is small enough to enumerate a night's tickets by brute force;
  // 5 bytes (~1.1 trillion) is not, and the code is still short enough for
  // staff to read aloud. Existing shorter codes keep working — this only
  // affects newly issued ones.
  const suffix = crypto.randomBytes(5).toString("hex").toUpperCase();

  return `CLK-${stamp}-${suffix}`;
}

export function createTicketToken() {
  const token = crypto.randomBytes(32).toString("base64url");

  return {
    hash: hashTicketToken(token),
    token,
  };
}
