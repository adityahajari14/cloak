"use client";

import { startTransition, useState } from "react";
import type { ScannerTicket } from "@/app/venuescanner/types";

export const PRESET_ITEM_TYPES = [
  // Hanger pool
  "Coat",
  "Jacket",
  // Bag/shelf pool
  "Bag",
  "Backpack",
  "Luggage",
  "Helmet",
  "Electronics",
  "Sports equipment",
  "Package",
];

// Sentinel value for the "Other" free-text option — never saved to DB
const OTHER_SENTINEL = "__other__";

const fieldClass =
  "rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 transition";

// ─── Guest info card ──────────────────────────────────────────────────────────

/**
 * Where the staff member must physically put the items, shown after activation.
 *
 * This is the single most operationally important thing on the screen: the
 * assigned slot only exists in the app, so if it isn't read and acted on, the
 * coat goes on the wrong hook and the guest can't get it back. It used to be
 * buried in a small status line that auto-dismissed after five seconds, which
 * staff routinely missed — hence the big, persistent treatment here.
 */
export function StorageLocationCard({ ticket }: { ticket: ScannerTicket }) {
  const stored = ticket.items.filter((i) => !i.collected && i.storageLocation);

  // Fall back to the legacy denormalized column for tickets predating per-item
  // slot rows, so an older ticket still shows something rather than nothing.
  const legacy =
    stored.length === 0 && ticket.storageLocation
      ? ticket.storageLocation
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  if (stored.length === 0 && legacy.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
        Put the items here
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {stored.length > 0
          ? stored.map((item) => (
              <div
                className="flex items-center gap-2.5 rounded-lg border border-emerald-300 bg-white px-3 py-2.5"
                key={item.id}
              >
                <span className="rounded bg-emerald-600 px-2.5 py-1 font-mono text-base font-bold tabular-nums text-white">
                  {item.storageLocation}
                </span>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
            ))
          : legacy.map((slot) => (
              <span
                className="rounded bg-emerald-600 px-2.5 py-1 font-mono text-base font-bold tabular-nums text-white"
                key={slot}
              >
                {slot}
              </span>
            ))}
      </div>

      <p className="mt-3 text-xs text-emerald-800">
        {ticket.guestName} &middot; {ticket.publicCode}
      </p>
    </div>
  );
}

export function GuestCard({ ticket }: { ticket: ScannerTicket }) {
  const isPending = ticket.status === "pending_activation";
  const isStored = ticket.status === "active";
  const isPartial = ticket.status === "partially_collected";
  const isForgotten = ticket.status === "forgotten";

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{ticket.guestName}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">{ticket.publicCode}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isStored || isPartial
              ? "bg-emerald-50 text-emerald-700"
              : isPending
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {isStored ? "Stored" : isPartial ? "Partial" : isPending ? "Pending" : isForgotten ? "Forgotten" : ticket.status}
        </span>
      </div>
      {isForgotten ? (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
          Event ended before collection — items are still stored.
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
        <span>{ticket.guestPhone}</span>
        <span>{ticket.venueName}</span>
      </div>
    </div>
  );
}

// ─── Reusable item-entry rows (shared by activation & add-items) ───────────────

type ItemLine = { type: string; count: string; custom: string; pool: "hanger" | "bag" | "" };

function resolvedType(item: ItemLine): string {
  return item.type === OTHER_SENTINEL ? item.custom.trim() : item.type;
}

function ItemEntry({
  items,
  setItems,
  label,
}: {
  items: ItemLine[];
  setItems: React.Dispatch<React.SetStateAction<ItemLine[]>>;
  label: string;
}) {
  function addLine() {
    setItems((prev) => [...prev, { type: "", count: "1", custom: "", pool: "" }]);
  }
  function removeLine(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, patch: Partial<ItemLine>) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div className="flex flex-col gap-1.5" key={i}>
            <div className="flex items-center gap-2">
              <select
                className={`${fieldClass} min-w-0 flex-1`}
                onChange={(e) => updateLine(i, { type: e.target.value, pool: "" })}
                required
                value={item.type}
              >
                <option value="" disabled>Item type</option>
                {PRESET_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value={OTHER_SENTINEL}>Other</option>
              </select>

              <input
                className={`${fieldClass} w-14 shrink-0 text-center`}
                inputMode="numeric"
                maxLength={2}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  if (digits === "") { updateLine(i, { count: "" }); return; }
                  const n = Math.min(Math.max(parseInt(digits, 10), 1), 99);
                  updateLine(i, { count: String(n) });
                }}
                placeholder="1"
                type="text"
                value={item.count}
              />

              {items.length > 1 && (
                <button
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-foreground/30 hover:text-foreground"
                  onClick={() => removeLine(i)}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            {item.type === OTHER_SENTINEL && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  className={`${fieldClass} min-w-0 flex-1`}
                  onChange={(e) => updateLine(i, { custom: e.target.value })}
                  placeholder="e.g. Pushchair, Scooter, Musical instrument…"
                  type="text"
                  value={item.custom}
                />
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
                  <button
                    className={`px-3 py-2 text-xs font-semibold transition ${
                      item.pool === "hanger"
                        ? "bg-foreground text-white"
                        : "bg-white text-muted hover:text-foreground"
                    }`}
                    onClick={() => updateLine(i, { pool: "hanger" })}
                    title="Assign to hanger rail"
                    type="button"
                  >
                    Hanger
                  </button>
                  <button
                    className={`border-l border-line px-3 py-2 text-xs font-semibold transition ${
                      item.pool === "bag"
                        ? "bg-foreground text-white"
                        : "bg-white text-muted hover:text-foreground"
                    }`}
                    onClick={() => updateLine(i, { pool: "bag" })}
                    title="Assign to bag/shelf area"
                    type="button"
                  >
                    Shelf
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className="mt-2 text-xs font-medium text-muted hover:text-foreground"
        onClick={addLine}
        type="button"
      >
        + Add another item
      </button>
    </div>
  );
}

/** Build the items JSON payload + validation message from item lines. */
function buildItemsPayload(items: ItemLine[]): { json: string; error: string } {
  const valid = items.filter((item) => resolvedType(item) && parseInt(item.count, 10) > 0);
  if (valid.length === 0) return { error: "Add at least one item.", json: "" };
  if (valid.some((item) => item.type === OTHER_SENTINEL && !item.custom.trim())) {
    return { error: "Specify what the item is for the 'Other' row.", json: "" };
  }
  if (valid.some((item) => item.type === OTHER_SENTINEL && !item.pool)) {
    return { error: "Select Hanger or Shelf for each custom item.", json: "" };
  }
  const payload = valid.map((item) => ({
    label: resolvedType(item),
    pool: item.type === OTHER_SENTINEL ? item.pool : undefined,
    quantity: parseInt(item.count, 10),
  }));
  return { error: "", json: JSON.stringify(payload) };
}

// ─── Activation form ──────────────────────────────────────────────────────────

export function ActivationForm({
  formAction,
  pending,
  ticket,
  venueId,
}: {
  formAction: (fd: FormData) => void;
  pending: boolean;
  ticket: ScannerTicket;
  venueId?: string;
}) {
  const [items, setItems] = useState<ItemLine[]>([{ type: "", count: "1", custom: "", pool: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { json, error: err } = buildItemsPayload(items);
    if (err) { setError(err); return; }

    const fd = new FormData();
    fd.set("_action", "activate");
    fd.set("ticketId", ticket.id);
    fd.set("items", json);
    fd.set("notes", notes.trim());
    if (venueId) fd.set("venueId", venueId);
    startTransition(() => formAction(fd));
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <ItemEntry items={items} label="Items to store" setItems={setItems} />

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Notes <span className="normal-case font-normal">(optional)</span>
        </label>
        <textarea
          className={`${fieldClass} w-full min-h-16 resize-none`}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Colour, brand, or distinguishing features…"
          value={notes}
        />
      </div>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}

      <p className="text-xs text-muted">A cloak number will be automatically assigned on activation.</p>

      <button
        className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Confirming…" : "Confirm activation"}
      </button>
    </form>
  );
}

// ─── Add-items form (for an already-active ticket) ────────────────────────────

export function AddItemsForm({
  formAction,
  onCancel,
  pending,
  ticket,
  venueId,
}: {
  formAction: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
  ticket: ScannerTicket;
  venueId?: string;
}) {
  const [items, setItems] = useState<ItemLine[]>([{ type: "", count: "1", custom: "", pool: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { json, error: err } = buildItemsPayload(items);
    if (err) { setError(err); return; }

    const fd = new FormData();
    fd.set("_action", "add_items");
    fd.set("ticketId", ticket.id);
    fd.set("items", json);
    fd.set("notes", notes.trim());
    if (venueId) fd.set("venueId", venueId);
    startTransition(() => formAction(fd));
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <ItemEntry items={items} label="Items to add" setItems={setItems} />

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Notes <span className="normal-case font-normal">(optional)</span>
        </label>
        <textarea
          className={`${fieldClass} w-full min-h-16 resize-none`}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Colour, brand, or distinguishing features…"
          value={notes}
        />
      </div>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-xl bg-foreground py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Adding…" : "Add to ticket"}
        </button>
        <button
          className="rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted transition hover:text-foreground"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Checkout: per-item return + add-items toggle ─────────────────────────────

export function CheckoutForm({
  formAction,
  pending,
  ticket,
  venueId,
}: {
  formAction: (fd: FormData) => void;
  pending: boolean;
  ticket: ScannerTicket;
  venueId?: string;
}) {
  const openItems = ticket.items.filter((i) => !i.collected);
  const collectedItems = ticket.items.filter((i) => i.collected);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(openItems.map((i) => i.id)));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selected.size === 0) {
      setError("Select at least one item to return.");
      return;
    }
    const fd = new FormData();
    fd.set("_action", "checkout");
    fd.set("ticketId", ticket.id);
    fd.set("itemIds", JSON.stringify([...selected]));
    if (venueId) fd.set("venueId", venueId);
    startTransition(() => formAction(fd));
  }

  if (adding) {
    return (
      <AddItemsForm
        formAction={formAction}
        onCancel={() => setAdding(false)}
        pending={pending}
        ticket={ticket}
        venueId={venueId}
      />
    );
  }

  const returningAll = selected.size === openItems.length;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Items in storage
        </p>
        <div className="space-y-2">
          {openItems.map((item) => (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                selected.has(item.id) ? "border-foreground/30 bg-zinc-50" : "border-line"
              }`}
              key={item.id}
            >
              <input
                checked={selected.has(item.id)}
                className="h-4 w-4 shrink-0 accent-foreground"
                onChange={() => toggle(item.id)}
                type="checkbox"
              />
              <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
              {item.storageLocation ? (
                <span className="shrink-0 rounded bg-foreground px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                  {item.storageLocation}
                </span>
              ) : null}
              {item.notes ? <span className="text-xs text-muted">{item.notes}</span> : null}
            </label>
          ))}
        </div>
      </div>

      {collectedItems.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Already returned
          </p>
          <div className="space-y-1.5">
            {collectedItems.map((item) => (
              <div className="flex items-center gap-2 text-sm text-muted line-through" key={item.id}>
                <span className="text-emerald-500">✓</span>
                {item.label}
                {item.storageLocation ? (
                  <span className="font-mono text-xs">{item.storageLocation}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}

      <p className="text-xs text-muted">
        {returningAll
          ? "Returning all stored items will close this ticket."
          : "Only the ticked items will be returned. The rest stay stored."}
      </p>

      <div className="flex flex-col gap-2">
        <button
          className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          disabled={pending || openItems.length === 0}
          type="submit"
        >
          {pending
            ? "Confirming…"
            : returningAll
              ? "Return all & close ticket"
              : `Return ${selected.size} item${selected.size === 1 ? "" : "s"}`}
        </button>
        <button
          className="w-full rounded-xl border border-line py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
          onClick={() => setAdding(true)}
          type="button"
        >
          + Add more items to this ticket
        </button>
      </div>
    </form>
  );
}
