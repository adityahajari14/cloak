"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VenueStats from "./VenueStats";

type Tone = "blue" | "green" | "warning" | "danger" | "neutral";
type Stat = { helper?: string; label: string; value: string; tone: Tone };

export type LiveCounts = {
  pending: number;
  stored: number;
  collected: number;
  today: number;
  forgotten: number;
  capacity: number;
  hangerCapacity: number;
  bagCapacity: number;
  hangerStored: number;
  bagStored: number;
};

function buildStats(counts: LiveCounts): Stat[] {
  const totalUsed = counts.stored;
  const totalCapacity = counts.hangerCapacity + counts.bagCapacity || counts.capacity;
  const utilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
  return [
    { helper: "Tickets created today", label: "Today", value: String(counts.today), tone: "neutral" },
    { helper: "Waiting at counter", label: "Pending", value: String(counts.pending), tone: "warning" },
    { helper: "Currently stored", label: "Stored", value: String(counts.stored), tone: "green" },
    { helper: "Returned today", label: "Collected", value: String(counts.collected), tone: "blue" },
    { helper: "Expired before activation", label: "Forgotten", value: String(counts.forgotten), tone: "danger" },
    {
      helper: "Active storage use",
      label: "Capacity",
      value: `${utilization}%`,
      tone: utilization >= 90 ? "danger" : utilization >= 70 ? "warning" : "blue",
    },
  ];
}

function CapacityBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(Math.round((used / total) * 100), 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted">
          {used} / {total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">{total - used} slots available</p>
    </div>
  );
}

function PendingAlert({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
          {count}
        </span>
        <p className="text-sm font-medium text-amber-900">
          {count === 1
            ? "1 guest is waiting at the counter to activate their pass."
            : `${count} guests are waiting at the counter to activate their passes.`}
        </p>
      </div>
      <Link
        className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
        href="/venuescanner"
      >
        Open scanner
      </Link>
    </div>
  );
}

export default function LiveDashboardStats({
  initialCounts,
  showCapacityBar,
  venueId,
}: {
  initialCounts: LiveCounts;
  showCapacityBar: boolean;
  venueId: string | null;
}) {
  const [counts, setCounts] = useState<LiveCounts>(initialCounts);

  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    async function refresh() {
      const now = new Date().toISOString();
      const today = todayStart.toISOString();

      // Forgotten tickets still have items physically in storage, so they
      // count toward occupancy/capacity same as active/partially_collected —
      // "forgotten" is a real status now (event ended without collection),
      // plus we keep the time-based fallback for tickets whose event hasn't
      // been explicitly ended yet.
      const occupyingStatuses = ["active", "partially_collected", "forgotten"] as const;

      // Item counts are filtered through an inner join on tickets rather than by
      // fetching every ticket id and passing it to .in(). That id list was
      // unbounded — a venue with a few hundred tickets would blow past the URL
      // length limit, the request would fail, and the counters would quietly
      // read 0. It's also one query instead of two.
      const [pending, all, forgottenResult, storedResult, collectedTodayResult] = await Promise.all([
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venueId!)
          .eq("status", "pending_activation"),
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venueId!)
          .gte("created_at", today),
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venueId!)
          .or(`status.eq.forgotten,and(status.eq.pending_activation,expires_at.lt.${now})`),
        // Items physically in storage right now.
        supabase
          .from("ticket_items")
          .select("storage_location, quantity, tickets!inner(venue_id, status)")
          .eq("tickets.venue_id", venueId!)
          .in("tickets.status", occupyingStatuses)
          .is("collected_at", null),
        // Items handed back today, across every ticket — including partially
        // collected ones, where the ticket itself is still open.
        supabase
          .from("ticket_items")
          .select("quantity, tickets!inner(venue_id)")
          .eq("tickets.venue_id", venueId!)
          .gte("collected_at", today),
      ]);

      const qty = (i: { quantity: number }) => i.quantity || 1;

      // The embedded-join select confuses the generated row types, so name the
      // shape we actually asked for.
      const itemRows = (storedResult.data ?? []) as unknown as Array<{
        quantity: number;
        storage_location: string | null;
      }>;
      const collectedRows = (collectedTodayResult.data ?? []) as unknown as Array<{
        quantity: number;
      }>;

      const storedItemCount = itemRows.reduce((sum, i) => sum + qty(i), 0);
      const hangerStored = itemRows
        .filter((i) => i.storage_location?.startsWith("H-"))
        .reduce((sum, i) => sum + qty(i), 0);
      const bagStored = itemRows
        .filter((i) => i.storage_location?.startsWith("B-"))
        .reduce((sum, i) => sum + qty(i), 0);

      const collectedItemCountToday = collectedRows.reduce((sum, i) => sum + qty(i), 0);

      setCounts((prev) => ({
        ...prev,
        bagStored,
        hangerStored,
        pending: pending.count ?? prev.pending,
        stored: storedItemCount,
        collected: collectedItemCountToday,
        today: all.count ?? prev.today,
        forgotten: forgottenResult.count ?? prev.forgotten,
      }));
    }

    // Paint the server's numbers immediately, then keep them live.
    refresh();

    const channel = supabase
      .channel(`dashboard:${venueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `venue_id=eq.${venueId}` },
        () => { refresh(); },
      )
      // Storing and collecting items writes ticket_items, not tickets. Watching
      // only the tickets table meant a partial collection — which updates
      // ticket_items.collected_at and leaves tickets.status on
      // "partially_collected" — changed no tickets row at all, so no event
      // fired and the stored/collected/capacity counters silently went stale.
      //
      // ticket_items has no venue_id to filter on, so this listens to the whole
      // table and refreshes; refresh() is already venue-scoped, so a change at
      // another venue just costs one redundant re-query.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_items" },
        () => { refresh(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  const showHanger = showCapacityBar && counts.hangerCapacity > 0;
  const showBag = showCapacityBar && counts.bagCapacity > 0;
  const showLegacy = showCapacityBar && !showHanger && !showBag && counts.capacity > 0;

  return (
    <>
      <PendingAlert count={counts.pending} />
      <VenueStats stats={buildStats(counts)} />
      {(showHanger || showBag) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {showHanger && (
            <CapacityBar label="Hanger slots in use" used={counts.hangerStored} total={counts.hangerCapacity} />
          )}
          {showBag && (
            <CapacityBar label="Bag slots in use" used={counts.bagStored} total={counts.bagCapacity} />
          )}
        </div>
      )}
      {showLegacy && (
        <CapacityBar label="Cloak slots in use" used={counts.stored} total={counts.capacity} />
      )}
    </>
  );
}

