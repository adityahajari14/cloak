"use client";

import { startTransition, useState } from "react";
import type { ScannerTicket } from "@/app/venuescanner/types";

// Sentinel value for the "Other" free-text option — never saved to DB
const OTHER_SENTINEL = "__other__";

type ItemCard = { key: string; label: string; icon: string };

const ITEM_CARDS: ItemCard[] = [
  { key: "Jacket", label: "Jacket", icon: "🧥" },
  { key: "Bag / Backpack", label: "Bag / Backpack", icon: "🎒" },
  { key: "Luggage", label: "Luggage", icon: "🧳" },
  { key: "Umbrella", label: "Umbrella", icon: "☂️" },
  { key: "Clothing", label: "Clothing", icon: "👕" },
  { key: OTHER_SENTINEL, label: "Other", icon: "➕" },
];

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
        {ticket.guestEmail ? <span className="truncate">{ticket.guestEmail}</span> : null}
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

/**
 * Card-based item picker: tap a card to add one, tap again to bump the count
 * (only once "Multiple items" is on — otherwise a second tap is a no-op so a
 * mis-tap can't silently double a guest's coat count). "Other" is the one
 * card that can't just be a counter, since each one needs its own free-text
 * name and hanger/shelf pool — so instead of a badge it expands into its own
 * small list underneath the grid, reusing the same custom/pool fields the
 * old dropdown's "Other" row used.
 */
function ItemEntry({
  items,
  setItems,
  label,
}: {
  items: ItemLine[];
  setItems: React.Dispatch<React.SetStateAction<ItemLine[]>>;
  label: string;
}) {
  const [multiple, setMultiple] = useState(false);

  const otherLines = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.type === OTHER_SENTINEL);

  function cardCount(key: string) {
    const line = items.find((item) => item.type === key);
    return line ? parseInt(line.count, 10) || 0 : 0;
  }

  function tapCard(key: string) {
    if (key === OTHER_SENTINEL) {
      setItems((prev) => [...prev, { type: OTHER_SENTINEL, count: "1", custom: "", pool: "" }]);
      return;
    }
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.type === key);
      if (idx === -1) return [...prev, { type: key, count: "1", custom: "", pool: "" }];
      if (!multiple) return prev;
      return prev.map((item, i) =>
        i === idx ? { ...item, count: String((parseInt(item.count, 10) || 0) + 1) } : item,
      );
    });
  }

  function decrementCard(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.type === key);
      if (idx === -1) return prev;
      const nextCount = (parseInt(prev[idx].count, 10) || 0) - 1;
      if (nextCount <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((item, i) => (i === idx ? { ...item, count: String(nextCount) } : item));
    });
  }

  function removeOtherLine(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateOtherLine(i: number, patch: Partial<ItemLine>) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Multiple items
          <button
            aria-checked={multiple}
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${multiple ? "bg-foreground" : "bg-zinc-200"}`}
            onClick={() => setMultiple((v) => !v)}
            role="switch"
            type="button"
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                multiple ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ITEM_CARDS.map((card) => {
          const count = card.key === OTHER_SENTINEL ? otherLines.length : cardCount(card.key);
          const selected = count > 0;
          return (
            <div className="relative" key={card.key}>
              <button
                className={`flex w-full flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition ${
                  selected
                    ? "border-foreground bg-zinc-50 ring-1 ring-foreground"
                    : "border-line bg-white hover:border-foreground/30"
                }`}
                onClick={() => tapCard(card.key)}
                type="button"
              >
                {count > 1 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-white">
                    +{count}
                  </span>
                )}
                <span className="text-xl">{card.icon}</span>
                <span className="text-[11px] font-medium leading-tight text-foreground">{card.label}</span>
              </button>
              {selected && card.key !== OTHER_SENTINEL && (
                <button
                  className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-white text-xs font-bold text-muted transition hover:border-red-300 hover:text-red-600"
                  onClick={(e) => decrementCard(card.key, e)}
                  type="button"
                >
                  −
                </button>
              )}
            </div>
          );
        })}
      </div>

      {otherLines.length > 0 && (
        <div className="mt-3 space-y-2">
          {otherLines.map(({ item, i }) => (
            <div className="flex flex-col gap-1.5" key={i}>
              <div className="flex gap-2">
                <input
                  autoFocus
                  className={`${fieldClass} min-w-0 flex-1`}
                  onChange={(e) => updateOtherLine(i, { custom: e.target.value })}
                  placeholder="e.g. Pushchair, Scooter, Musical instrument…"
                  type="text"
                  value={item.custom}
                />
                <button
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-foreground/30 hover:text-foreground"
                  onClick={() => removeOtherLine(i)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
                <button
                  className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                    item.pool === "hanger"
                      ? "bg-foreground text-white"
                      : "bg-white text-muted hover:text-foreground"
                  }`}
                  onClick={() => updateOtherLine(i, { pool: "hanger" })}
                  title="Assign to hanger rail"
                  type="button"
                >
                  Hanger
                </button>
                <button
                  className={`flex-1 border-l border-line px-3 py-2 text-xs font-semibold transition ${
                    item.pool === "bag"
                      ? "bg-foreground text-white"
                      : "bg-white text-muted hover:text-foreground"
                  }`}
                  onClick={() => updateOtherLine(i, { pool: "bag" })}
                  title="Assign to bag/shelf area"
                  type="button"
                >
                  Shelf
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [items, setItems] = useState<ItemLine[]>([]);
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
  const [items, setItems] = useState<ItemLine[]>([]);
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
