import "server-only";

import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import type { ScannerState } from "@/app/venuescanner/types";
import {
  type ScannerContext,
  assignSlots,
  canAccessVenue,
  getVenueName,
  isPendingTicketExpired,
  loadTicketById,
  loadTicketItems,
  toScannerTicket,
  writeAcceptedScan,
  writeRejectedScan,
} from "@/lib/scanner-core";
import {
  sendWhatsAppItemsCollected,
  sendWhatsAppItemsStored,
} from "@/lib/whatsapp";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];

export type ParsedItem = { label: string; quantity: number; pool?: "hanger" | "bag" };

// Items that go on a shelf/bag area rather than a hanger rail.
// Everything not in this set defaults to the hanger pool.
const BAG_POOL_ITEMS = new Set([
  "bag", "backpack", "luggage", "suitcase", "rucksack",
  "helmet", "electronics", "sports equipment", "package",
]);

function classifySlotType(item: ParsedItem): "hanger" | "bag" {
  if (item.pool) return item.pool;
  return BAG_POOL_ITEMS.has(item.label.toLowerCase().trim()) ? "bag" : "hanger";
}

function revalidateSurfaces() {
  revalidatePath("/venuescanner");
  revalidatePath("/smsbackup");
  revalidatePath("/ticket");
}

// ─── Ready-state resolution ──────────────────────────────────────────────────

export async function ticketReadyState(
  context: ScannerContext,
  ticket: TicketRow,
): Promise<ScannerState> {
  const venueName = await getVenueName(context.supabase, ticket.venue_id);
  const items = await loadTicketItems(context.supabase, ticket.id);
  const scannerTicket = toScannerTicket(ticket, venueName, items);

  if (ticket.status === "pending_activation") {
    return {
      intent: "activation",
      message: "Ticket found. Confirm the stored item details before activation.",
      status: "ready",
      ticket: scannerTicket,
    };
  }

  if (
    ticket.status === "active" ||
    ticket.status === "partially_collected" ||
    ticket.status === "forgotten"
  ) {
    return {
      intent: "checkout",
      message:
        ticket.status === "forgotten"
          ? "This event ended before the guest collected their items. Select items to return."
          : ticket.status === "partially_collected"
            ? "Some items already returned. Select items to return or add more."
            : "Ticket found. Select items to return, or add more items.",
      status: "ready",
      ticket: scannerTicket,
    };
  }

  return {
    message: "This ticket is not available for scanner action.",
    status: "error",
    ticket: scannerTicket,
  };
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export async function performLookup(
  context: ScannerContext,
  lookupValue: string,
  ticket: TicketRow | null,
  venueId?: string,
): Promise<ScannerState> {
  if (!ticket) {
    return { message: "Ticket was not found. Check the code and try again.", status: "error" };
  }

  // If a specific venueId is selected, enforce that the ticket belongs to it.
  if (venueId && ticket.venue_id !== venueId) {
    await writeRejectedScan({
      reason: "Ticket belongs to a different venue.",
      scanner: context.guard,
      ticket,
    });
    return { message: "This ticket is not valid for the selected venue.", status: "error" };
  }

  if (!canAccessVenue(context.guard, ticket.venue_id)) {
    await writeRejectedScan({
      reason: "Ticket belongs to another venue.",
      scanner: context.guard,
      ticket,
    });
    return { message: "This ticket is not valid for your venue.", status: "error" };
  }

  if (isPendingTicketExpired(ticket) || ticket.status === "expired") {
    await writeRejectedScan({
      reason: "Ticket expired before activation.",
      scanner: context.guard,
      ticket,
    });
    return { message: "This ticket has expired and cannot be activated.", status: "error" };
  }

  if (ticket.status === "cancelled") {
    await writeRejectedScan({ reason: "Ticket was cancelled.", scanner: context.guard, ticket });
    return { message: "This ticket has been cancelled.", status: "error" };
  }

  if (ticket.status === "collected") {
    await writeRejectedScan({
      reason: "Ticket was already checked out.",
      scanner: context.guard,
      ticket,
    });
    return { message: "All items on this ticket have already been collected.", status: "error" };
  }

  void lookupValue;
  return ticketReadyState(context, ticket);
}

// ─── Activation ───────────────────────────────────────────────────────────────

export async function performActivation(
  context: ScannerContext,
  {
    ticketId,
    items,
    notes,
    venueId,
  }: { ticketId: string; items: ParsedItem[]; notes: string; venueId?: string },
): Promise<ScannerState> {
  const ticket = await loadTicketById(context.supabase, ticketId);

  if (!ticket || !canAccessVenue(context.guard, ticket.venue_id)) {
    return { message: "Ticket could not be verified for this venue.", status: "error" };
  }

  if (venueId && ticket.venue_id !== venueId) {
    return { message: "Ticket could not be verified for the selected venue.", status: "error" };
  }

  if (ticket.status !== "pending_activation") {
    return ticketReadyState(context, ticket);
  }

  if (isPendingTicketExpired(ticket)) {
    await writeRejectedScan({
      reason: "Ticket expired before activation.",
      scanner: context.guard,
      ticket,
    });
    return { message: "This ticket has expired and cannot be activated.", status: "error" };
  }

  const validItems = items.filter((i) => i.label && i.quantity >= 1 && i.quantity <= 99);
  if (validItems.length === 0) {
    const venueName = await getVenueName(context.supabase, ticket.venue_id);
    const existing = await loadTicketItems(context.supabase, ticket.id);
    return {
      intent: "activation",
      message: "Add at least one item before activation.",
      status: "ready",
      ticket: toScannerTicket(ticket, venueName, existing),
    };
  }

  // Expand each item line by quantity — one physical unit per row.
  // e.g. { label: "Jacket", quantity: 3 } → 3 rows each needing a slot.
  type UnitItem = { label: string; slotType: "hanger" | "bag" };
  const units: UnitItem[] = validItems.flatMap((i) =>
    Array.from({ length: i.quantity }, () => ({
      label: i.label,
      slotType: classifySlotType(i),
    })),
  );

  const hangerCount = units.filter((u) => u.slotType === "hanger").length;
  const bagCount = units.filter((u) => u.slotType === "bag").length;

  // Assign all required slots up-front so we can fail atomically before writing anything.
  const [hangerSlots, bagSlots] = await Promise.all([
    hangerCount > 0
      ? assignSlots(context.supabase, ticket.venue_id, "hanger", hangerCount)
      : Promise.resolve([] as string[]),
    bagCount > 0
      ? assignSlots(context.supabase, ticket.venue_id, "bag", bagCount)
      : Promise.resolve([] as string[]),
  ]);

  if ((hangerCount > 0 && !hangerSlots) || (bagCount > 0 && !bagSlots)) {
    return {
      message: "Not enough free cloakroom slots. Please complete a checkout first.",
      status: "error",
    };
  }

  // Pair each unit with its assigned slot label.
  const hQueue = [...(hangerSlots ?? [])];
  const bQueue = [...(bagSlots ?? [])];
  const assignedUnits = units.map((u) => ({
    ...u,
    slot: u.slotType === "bag" ? bQueue.shift()! : hQueue.shift()!,
  }));

  const allSlots = assignedUnits.map((u) => u.slot);
  const slotSummary = allSlots.join(", ");
  const totalCount = units.length;
  const summary = validItems.map((i) => `${i.quantity}× ${i.label}`).join(", ");
  const description = notes.trim() ? `${summary}\n${notes.trim()}` : summary;
  const activatedAt = new Date().toISOString();

  const { data: updatedTicket, error } = await context.supabase
    .from("tickets")
    .update({
      activated_at: activatedAt,
      activation_confirmed_by: context.guard.userId,
      item_count: totalCount,
      item_description: description,
      item_type: validItems[0].label,
      status: "active",
      storage_location: slotSummary,
    })
    .eq("id", ticket.id)
    .eq("status", "pending_activation")
    .select("*")
    .single();

  if (error || !updatedTicket) {
    return { message: "Ticket activation failed. Please refresh and try again.", status: "error" };
  }

  // One row per physical unit with its own slot label.
  await context.supabase.from("ticket_items").insert(
    assignedUnits.map((u) => ({
      added_by: context.guard.userId,
      label: u.label,
      notes: notes.trim() || null,
      quantity: 1,
      storage_location: u.slot,
      ticket_id: ticket.id,
    })),
  );

  await writeAcceptedScan({ scanType: "activation", scanner: context.guard, ticket });
  revalidateSurfaces();

  const venueName = await getVenueName(context.supabase, ticket.venue_id);
  const freshItems = await loadTicketItems(context.supabase, ticket.id);

  void sendWhatsAppItemsStored({
    phone: updatedTicket.guest_phone,
    guestName: updatedTicket.guest_name,
    itemCount: totalCount,
    slotNumber: slotSummary,
    venueName,
  });

  return {
    message: `Ticket activated. Slots assigned: ${slotSummary}.`,
    status: "success",
    ticket: toScannerTicket(updatedTicket, venueName, freshItems),
  };
}

// ─── Add items to an already-active ticket ────────────────────────────────────

export async function performAddItems(
  context: ScannerContext,
  {
    ticketId,
    items,
    notes,
  }: { ticketId: string; items: ParsedItem[]; notes: string },
): Promise<ScannerState> {
  const ticket = await loadTicketById(context.supabase, ticketId);

  if (!ticket || !canAccessVenue(context.guard, ticket.venue_id)) {
    return { message: "Ticket could not be verified for this venue.", status: "error" };
  }

  if (
    ticket.status !== "active" &&
    ticket.status !== "partially_collected" &&
    ticket.status !== "forgotten"
  ) {
    return ticketReadyState(context, ticket);
  }

  const validItems = items.filter((i) => i.label && i.quantity >= 1 && i.quantity <= 99);
  if (validItems.length === 0) {
    return ticketReadyState(context, ticket);
  }

  type UnitItem = { label: string; slotType: "hanger" | "bag" };
  const units: UnitItem[] = validItems.flatMap((i) =>
    Array.from({ length: i.quantity }, () => ({
      label: i.label,
      slotType: classifySlotType(i),
    })),
  );

  const hangerCount = units.filter((u) => u.slotType === "hanger").length;
  const bagCount = units.filter((u) => u.slotType === "bag").length;

  const [hangerSlots, bagSlots] = await Promise.all([
    hangerCount > 0
      ? assignSlots(context.supabase, ticket.venue_id, "hanger", hangerCount)
      : Promise.resolve([] as string[]),
    bagCount > 0
      ? assignSlots(context.supabase, ticket.venue_id, "bag", bagCount)
      : Promise.resolve([] as string[]),
  ]);

  if ((hangerCount > 0 && !hangerSlots) || (bagCount > 0 && !bagSlots)) {
    return {
      message: "Not enough free cloakroom slots. Please complete a checkout first.",
      status: "error",
    };
  }

  const hQueue = [...(hangerSlots ?? [])];
  const bQueue = [...(bagSlots ?? [])];
  const assignedUnits = units.map((u) => ({
    ...u,
    slot: u.slotType === "bag" ? bQueue.shift()! : hQueue.shift()!,
  }));

  await context.supabase.from("ticket_items").insert(
    assignedUnits.map((u) => ({
      added_by: context.guard.userId,
      label: u.label,
      notes: notes.trim() || null,
      quantity: 1,
      storage_location: u.slot,
      ticket_id: ticket.id,
    })),
  );

  // Re-open the ticket if it had slipped to partially_collected, and refresh
  // the denormalized counters on the ticket row.
  const freshItems = await loadTicketItems(context.supabase, ticket.id);
  const openItems = freshItems.filter((i) => i.collected_at === null);
  const totalOpen = openItems.length;

  // Rebuild the ticket-level slot summary from all open item rows.
  const allOpenSlots = openItems
    .map((i) => i.storage_location)
    .filter(Boolean)
    .join(", ");

  const { data: updatedTicket } = await context.supabase
    .from("tickets")
    .update({
      item_count: totalOpen,
      item_type: openItems[0]?.label ?? ticket.item_type,
      status: "active",
      storage_location: allOpenSlots || ticket.storage_location,
    })
    .eq("id", ticket.id)
    .select("*")
    .single();

  await writeAcceptedScan({ scanType: "activation", scanner: context.guard, ticket });
  revalidateSurfaces();

  const venueName = await getVenueName(context.supabase, ticket.venue_id);
  const newSlots = assignedUnits.map((u) => u.slot).join(", ");
  const added = assignedUnits.length;
  return {
    message: `${added} item${added === 1 ? "" : "s"} added. Slots: ${newSlots}.`,
    status: "success",
    ticket: toScannerTicket(updatedTicket ?? ticket, venueName, freshItems),
  };
}

// ─── Checkout (full or partial) ───────────────────────────────────────────────

export async function performCheckout(
  context: ScannerContext,
  { ticketId, itemIds }: { ticketId: string; itemIds: string[] },
): Promise<ScannerState> {
  const ticket = await loadTicketById(context.supabase, ticketId);

  if (!ticket || !canAccessVenue(context.guard, ticket.venue_id)) {
    return { message: "Ticket could not be verified for this venue.", status: "error" };
  }

  if (ticket.status === "collected") {
    return { message: "All items on this ticket have already been collected.", status: "error" };
  }

  if (ticket.status === "cancelled" || ticket.status === "expired") {
    return { message: "This ticket is no longer valid.", status: "error" };
  }

  if (
    ticket.status !== "active" &&
    ticket.status !== "partially_collected" &&
    ticket.status !== "forgotten"
  ) {
    return ticketReadyState(context, ticket);
  }

  const allItems = await loadTicketItems(context.supabase, ticket.id);
  const openItems = allItems.filter((i) => i.collected_at === null);

  // Default to returning everything still stored when no specific items chosen.
  const targetIds =
    itemIds.length > 0
      ? itemIds.filter((id) => openItems.some((i) => i.id === id))
      : openItems.map((i) => i.id);

  if (targetIds.length === 0) {
    return { message: "Select at least one item to return.", status: "error" };
  }

  const collectedAt = new Date().toISOString();
  await context.supabase
    .from("ticket_items")
    .update({ collected_at: collectedAt, collected_by: context.guard.userId })
    .in("id", targetIds);

  const remainingOpen = openItems.filter((i) => !targetIds.includes(i.id));
  const fullyCollected = remainingOpen.length === 0;

  const { data: updatedTicket, error } = await context.supabase
    .from("tickets")
    .update({
      checkout_confirmed_by: context.guard.userId,
      collected_at: fullyCollected ? collectedAt : ticket.collected_at,
      item_count: remainingOpen.reduce((s, i) => s + i.quantity, 0) || ticket.item_count,
      status: fullyCollected ? "collected" : "partially_collected",
      // Keep storage_location for history. The slot is freed by the status
      // change alone — slot assignment only counts occupying statuses
      // (active/partially_collected/forgotten), so a collected ticket no
      // longer occupies it.
      storage_location: ticket.storage_location,
    })
    .eq("id", ticket.id)
    .select("*")
    .single();

  if (error || !updatedTicket) {
    return { message: "Ticket checkout failed. Please refresh and try again.", status: "error" };
  }

  await writeAcceptedScan({ scanType: "checkout", scanner: context.guard, ticket });
  revalidateSurfaces();

  const venueName = await getVenueName(context.supabase, ticket.venue_id);
  const freshItems = await loadTicketItems(context.supabase, ticket.id);
  const returnedCount = targetIds.length;

  void sendWhatsAppItemsCollected({
    phone: ticket.guest_phone,
    guestName: ticket.guest_name,
    collectedCount: returnedCount,
    venueName,
  });

  return {
    message: fullyCollected
      ? "Checkout complete. All items returned and the ticket is now closed."
      : `${returnedCount} item${returnedCount === 1 ? "" : "s"} returned. ${remainingOpen.length} still stored.`,
    status: "success",
    ticket: toScannerTicket(updatedTicket, venueName, freshItems),
  };
}
