"use server";

import {
  getScannerContext,
  getVenueName,
  loadTicketItems,
  toScannerTicket,
} from "@/lib/scanner-core";
import {
  type ParsedItem,
  performActivation,
  performAddItems,
  performCheckout,
} from "@/lib/scanner-operations";
import { createPublicCode, createTicketToken } from "@/lib/tickets";
import { isValidEmail, isValidPhone, phoneDigits } from "@/lib/validation";
import type { ScannerState, ScannerTicket } from "@/app/venuescanner/types";
import type { BackupState } from "./types";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const NO_CONTEXT: BackupState = {
  message: "Sign in with a venue manager or staff account assigned to this venue.",
  status: "error",
};

/**
 * Tolerant phone match: two numbers match if one's digits end with the other's
 * (using the last 7+ significant digits). This survives country-code prefixes,
 * leading zeros, spacing, and partial searches without depending on a fixed
 * slice length lining up between the stored value and the query.
 */
function phonesMatch(stored: string, search: string): boolean {
  const a = phoneDigits(stored);
  const b = phoneDigits(search);
  if (!a || !b) return false;
  const span = Math.min(a.length, b.length, 9);
  if (span < 4) return false;
  const tailA = a.slice(-span);
  const tailB = b.slice(-span);
  return tailA === tailB;
}

function parseItems(formData: FormData): ParsedItem[] {
  const raw = readField(formData, "items");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ label?: unknown; quantity?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((i) => ({ label: String(i.label ?? "").trim(), quantity: Number(i.quantity ?? 1) }))
      .filter((i) => i.label.length > 0);
  } catch {
    return [];
  }
}

function parseItemIds(formData: FormData): string[] {
  const raw = readField(formData, "itemIds");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch {
    return [];
  }
}

function scannerToBackup(state: ScannerState): BackupState {
  if (state.status === "success") {
    return { intent: undefined, message: state.message, status: "action", ticket: state.ticket };
  }
  if (state.status === "ready") {
    return { intent: state.intent, message: state.message, status: "action", ticket: state.ticket };
  }
  if (state.status === "error") {
    return { message: state.message, status: "error" };
  }
  return { message: "", status: "idle" };
}

async function handleSearch(formData: FormData): Promise<BackupState> {
  const context = await getScannerContext();
  if (!context) return NO_CONTEXT;

  const phone = readField(formData, "phone");
  if (phoneDigits(phone).length < 4) {
    return { message: "Enter at least the last few digits of the guest's phone number.", status: "error" };
  }

  // Scope to the staff's venues, open tickets only.
  const venueIds = [...new Set(context.guard.venueRoles.map((r) => r.venueId))];

  const { data: tickets, error: ticketsError } = await context.supabase
    .from("tickets")
    .select("*")
    .in("venue_id", venueIds)
    .in("status", ["pending_activation", "active", "partially_collected", "forgotten"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (ticketsError) {
    // eslint-disable-next-line no-console
    console.error("[smsbackup] ticket search failed", ticketsError);
    return {
      message: "Ticket search is unavailable. A database migration may be pending — contact support.",
      status: "error",
    };
  }

  // Tolerant match on trailing digits so legacy/varied formats still resolve.
  const matches = (tickets ?? []).filter((t) => phonesMatch(t.guest_phone, phone));

  if (matches.length === 0) {
    return { message: "No open tickets found for that number at your venue.", status: "error" };
  }

  const scannerTickets: ScannerTicket[] = [];
  for (const ticket of matches) {
    const venueName = await getVenueName(context.supabase, ticket.venue_id);
    const items = await loadTicketItems(context.supabase, ticket.id);
    scannerTickets.push(toScannerTicket(ticket, venueName, items));
  }

  return {
    message: `${matches.length} open ticket${matches.length === 1 ? "" : "s"} found.`,
    status: "results",
    tickets: scannerTickets,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Staff create a fresh ticket for a walk-in guest whose phone has died and who
 * never made a pass. The ticket starts in pending_activation, then the console
 * immediately shows the activation form so staff record items in one sitting.
 */
async function handleCreateTicket(formData: FormData): Promise<BackupState> {
  const context = await getScannerContext();
  if (!context) return NO_CONTEXT;

  const fullName = readField(formData, "fullName");
  const phone = readField(formData, "phone");
  const emailInput = normalizeEmail(readField(formData, "email"));
  const requestedVenue = readField(formData, "venue");

  if (!fullName || !phone) {
    return { message: "Enter the guest's name and phone number.", status: "error" };
  }

  if (!isValidPhone(phone)) {
    return { message: "Please enter a valid phone number.", status: "error" };
  }

  if (emailInput && !isValidEmail(emailInput)) {
    return { message: "Please enter a valid email address.", status: "error" };
  }

  // Resolve the venue: an explicit choice (validated against the staff's
  // venues) or the single venue they're assigned to.
  const venueIds = [...new Set(context.guard.venueRoles.map((r) => r.venueId))];
  const venueId = requestedVenue && venueIds.includes(requestedVenue) ? requestedVenue : venueIds[0];
  if (!venueId) {
    return { message: "No venue is associated with your account.", status: "error" };
  }

  const { data: venue } = await context.supabase
    .from("venues")
    .select("id, ticket_expiry_hours")
    .eq("id", venueId)
    .maybeSingle();

  if (!venue) {
    return { message: "Your venue could not be verified.", status: "error" };
  }

  // Email is optional for a counter-created ticket. Only create a contact
  // record when we actually have an email (it's the dedup key); otherwise the
  // ticket simply carries no email and no linked contact.
  const email = emailInput || null;
  let contactId: string | null = null;
  if (email) {
    const { data: contact } = await context.supabase
      .from("guest_contacts")
      .upsert(
        { email, email_normalized: email, full_name: fullName, phone },
        { onConflict: "email_normalized" },
      )
      .select("id")
      .single();
    contactId = contact?.id ?? null;
  }

  const publicCode = createPublicCode();
  const ticketToken = createTicketToken();
  const expiryHours = venue.ticket_expiry_hours;
  const expiresAt =
    expiryHours !== null
      ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
      : new Date("9999-12-31T23:59:59Z").toISOString();

  const { data: ticket, error } = await context.supabase
    .from("tickets")
    .insert({
      expires_at: expiresAt,
      guest_contact_id: contactId,
      guest_email: email,
      guest_name: fullName,
      guest_phone: phone,
      public_code: publicCode,
      qr_token_hash: ticketToken.hash,
      venue_id: venue.id,
    })
    .select("*")
    .single();

  if (error || !ticket) {
    return { message: "Could not create the ticket. Please try again.", status: "error" };
  }

  const venueName = await getVenueName(context.supabase, ticket.venue_id);
  return {
    intent: "activation",
    message: "Ticket created. Record the guest's items to check them in.",
    status: "action",
    ticket: toScannerTicket(ticket, venueName, []),
  };
}

export async function handleBackupAction(
  _prev: BackupState,
  formData: FormData,
): Promise<BackupState> {
  try {
    const action = readField(formData, "_action");

    if (action === "reset") return { message: "", status: "idle" };
    if (action === "search") return handleSearch(formData);
    if (action === "create") return handleCreateTicket(formData);

    const context = await getScannerContext();
    if (!context) return NO_CONTEXT;

    if (action === "activate") {
      return scannerToBackup(
        await performActivation(context, {
          items: parseItems(formData),
          notes: readField(formData, "notes"),
          ticketId: readField(formData, "ticketId"),
        }),
      );
    }

    if (action === "add_items") {
      return scannerToBackup(
        await performAddItems(context, {
          items: parseItems(formData),
          notes: readField(formData, "notes"),
          ticketId: readField(formData, "ticketId"),
        }),
      );
    }

    if (action === "checkout") {
      return scannerToBackup(
        await performCheckout(context, {
          itemIds: parseItemIds(formData),
          ticketId: readField(formData, "ticketId"),
        }),
      );
    }

    return { message: "Unknown action.", status: "error" };
  } catch {
    return { message: "The lookup could not complete. Please try again.", status: "error" };
  }
}
