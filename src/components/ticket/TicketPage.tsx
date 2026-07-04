"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import TicketDetails from "./TicketDetails";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PublicTicketItem } from "@/lib/tickets";

const VenueLocationMap = dynamic(() => import("./VenueLocationMap"), { ssr: false });

export type TicketView = {
  createdAt: string;
  dbId: string;
  email: string;
  expiresAt: string;
  guestName: string;
  itemCount: number;
  itemDescription: string | null;
  itemType: string | null;
  items: PublicTicketItem[];
  mobile: string;
  qrValue: string;
  status?: "pending_activation" | "active" | "partially_collected" | "collected" | "forgotten" | "cancelled" | "expired";
  storageLocation: string | null;
  ticketId: string;
  venueAddress: string | null;
  venueId: string;
  venueName: string;
};

function StatusPill({ status }: { status: TicketView["status"] }) {
  const map: Record<
    NonNullable<TicketView["status"]>,
    { label: string; cls: string }
  > = {
    pending_activation:    { label: "Awaiting activation", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    active:                { label: "Items stored",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partially_collected:   { label: "Partially collected", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    // Guests see a forgotten ticket the same as an active one — the items are
    // still safely stored, "forgotten" is only a staff-facing operational flag.
    forgotten:             { label: "Items stored",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    collected:             { label: "Collected",           cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
    cancelled:          { label: "Cancelled",            cls: "bg-red-50 text-red-600 border-red-200" },
    expired:            { label: "Expired",              cls: "bg-red-50 text-red-600 border-red-200" },
  };
  const s = status ?? "pending_activation";
  const { label, cls } = map[s];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}


export default function TicketPage({
  ticket: initial,
  qrCard,
}: {
  ticket: TicketView;
  qrCard: ReactNode;
}) {
  const [ticket, setTicket] = useState<TicketView>(initial);

  useEffect(() => {
    const supabase = createClient();

    async function refreshItems() {
      const { data } = await supabase
        .from("ticket_items")
        .select("id, label, storage_location, collected_at")
        .eq("ticket_id", initial.dbId)
        .order("added_at", { ascending: true });
      if (data) {
        setTicket((prev) => ({
          ...prev,
          items: data.map((r) => ({
            id: r.id,
            label: r.label,
            storageLocation: r.storage_location ?? null,
            collected: r.collected_at !== null,
          })),
        }));
      }
    }

    const channel = supabase
      .channel(`ticket:${initial.dbId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
          filter: `id=eq.${initial.dbId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setTicket((prev) => ({
            ...prev,
            status: (row.status as TicketView["status"]) ?? prev.status,
            storageLocation: (row.storage_location as string | null) ?? null,
            itemType: (row.item_type as string | null) ?? prev.itemType,
            itemCount: typeof row.item_count === "number" ? row.item_count : prev.itemCount,
            itemDescription: (row.item_description as string | null) ?? null,
          }));
          void refreshItems();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_items",
          filter: `ticket_id=eq.${initial.dbId}`,
        },
        () => { void refreshItems(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.dbId]);

  const { user, openAuthModal } = useAuth();

  // Guests see a forgotten ticket exactly like an active one — the items are
  // still stored, "forgotten" is a staff-only operational flag.
  const isActive = ticket.status === "active" || ticket.status === "forgotten";
  const isCollected = ticket.status === "collected";
  const isExpired = ticket.status === "expired";
  const isCancelled = ticket.status === "cancelled";
  const isClosed = isCollected || isExpired || isCancelled;

  const description = isCollected
    ? "Your items have been returned. This ticket is now closed."
    : isExpired
      ? "This ticket expired before it was activated at the counter."
      : isCancelled
        ? "This ticket has been cancelled and is no longer valid."
        : isActive
          ? "Your items are stored. Show this QR code or fallback code at the counter to collect."
          : "Show this QR code or fallback code at the selected venue counter to activate storage.";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-6 sm:max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-foreground"
              href="/"
            >
              Cloak
            </Link>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusPill status={ticket.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </div>
          {user ? (
            <Link
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground text-xs font-bold text-white transition hover:bg-zinc-700"
              href="/account"
              title="My account"
            >
              {(user.user_metadata?.full_name as string | undefined)
                ?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
                ?? user.email?.[0]?.toUpperCase()
                ?? "?"}
            </Link>
          ) : (
            <button
              className="shrink-0 rounded-xl border border-line bg-panel px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-zinc-50"
              onClick={() => openAuthModal("signin")}
              title="Sign in"
              type="button"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Collected celebration state */}
        {isCollected && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</span>
            <div>
              <p className="font-semibold text-emerald-800">Thanks for using Cloak</p>
              <p className="mt-1 text-sm text-emerald-700">Your items have been safely returned. See you next time!</p>
            </div>
          </div>
        )}

        {/* Items list — when active, partially collected, or collected */}
        {(isActive || ticket.status === "partially_collected" || isCollected) && (ticket.items.length > 0 || ticket.itemType) ? (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <p className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {isCollected ? "Items returned" : "Stored items"}
            </p>
            <div className="divide-y divide-line">
              {ticket.items.length > 0
                ? ticket.items.map((item) => (
                    <ItemRow
                      collected={item.collected}
                      key={item.id}
                      label={item.label}
                      slot={item.storageLocation}
                    />
                  ))
                : parseItemLines(ticket.itemDescription, ticket.itemType ?? "", ticket.itemCount).map(
                    (line, i) => (
                      <ItemRow collected={isCollected} key={i} label={line.label} slot={null} />
                    ),
                  )}
            </div>
            {extractNotes(ticket.itemDescription) ? (
              <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
                {extractNotes(ticket.itemDescription)}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* QR card — rendered server-side, passed as a child */}
        {qrCard}


        <TicketDetails ticket={ticket} />

        {/* Cloak Club upsell — permanent pass for any venue */}
        {!isClosed && (
          <Link
            className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 transition hover:border-foreground/30 hover:bg-zinc-50"
            href="/cloak-club"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg">
              ✨
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Get a lifetime Cloak pass
              </span>
              <span className="block text-xs text-muted">
                One wallet pass for every venue — join Cloak Club free.
              </span>
            </span>
            <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}

        {/* Venue map — helps guest find the venue */}
        {ticket.venueAddress && !isClosed && (
          <VenueLocationMap
            address={ticket.venueAddress}
            venueName={ticket.venueName}
          />
        )}

      </main>
    </div>
  );
}

function ItemRow({
  slot,
  label,
  collected,
}: {
  slot: string | null;
  label: string;
  collected: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${collected ? "opacity-50" : ""}`}>
      {slot ? (
        <span className="shrink-0 rounded-lg bg-foreground px-2.5 py-1 font-mono text-xs font-bold text-white">
          {slot}
        </span>
      ) : (
        <span className="shrink-0 w-7" />
      )}
      <span className={`flex-1 text-sm text-foreground ${collected ? "line-through" : ""}`}>
        {label}
      </span>
      {collected && <span className="shrink-0 text-xs text-emerald-600">Returned</span>}
    </div>
  );
}

function extractNotes(description: string | null): string | null {
  if (!description) return null;
  const idx = description.indexOf("\n");
  if (idx === -1) return null;
  const notes = description.slice(idx + 1).trim();
  return notes || null;
}

function parseItemLines(
  description: string | null,
  fallbackType: string,
  fallbackCount: number,
): Array<{ label: string; count: number }> {
  if (!description) return [{ label: fallbackType, count: fallbackCount }];
  const firstLine = description.split("\n")[0];
  const parts = firstLine.split(",").map((s) => s.trim());
  const parsed: Array<{ label: string; count: number }> = [];
  for (const part of parts) {
    const match = part.match(/^(\d+)[×x]\s*(.+)$/i);
    if (match) parsed.push({ count: parseInt(match[1], 10), label: match[2].trim() });
  }
  return parsed.length > 0 ? parsed : [{ label: fallbackType, count: fallbackCount }];
}

