"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Panel from "@/components/shared/Panel";
import StatusPill, { type StatusTone } from "@/components/shared/StatusPill";
import type { DateRange, TicketFilter, VenueDashboardData, VenueTicketListItem } from "@/lib/venue-dashboard";

const filters: Array<{ label: string; value: TicketFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Stored", value: "active" },
  { label: "Collected", value: "collected" },
  { label: "Forgotten", value: "forgotten" },
];

const dateRangeOptions: Array<{ label: string; value: DateRange }> = [
  { label: "Today", value: "today" },
  { label: "24h", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "1 month", value: "1mo" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
];

function statusLabel(status: VenueTicketListItem["status"]) {
  if (status === "pending_activation") return "Pending";
  if (status === "active") return "Stored";
  if (status === "partially_collected") return "Partial";
  if (status === "forgotten") return "Forgotten";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: VenueTicketListItem["status"]): StatusTone {
  if (status === "active" || status === "partially_collected") return "green";
  if (status === "pending_activation") return "warning";
  if (status === "collected") return "blue";
  if (status === "forgotten") return "danger";
  return "danger";
}

function fmtTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function fmtDate(value: string) {
  const d = new Date(value);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return fmtTime(value);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}


export default function TodayTickets({
  data,
  isManager = false,
  onDeletePending,
}: {
  data: VenueDashboardData;
  isManager?: boolean;
  onDeletePending?: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(data.search);
  const [activeFilter, setActiveFilter] = useState<TicketFilter>(data.activeFilter);
  const [dateRange, setDateRange] = useState<DateRange>(data.dateRange);
  const [customFrom, setCustomFrom] = useState(data.customFrom);
  const [customTo, setCustomTo] = useState(data.customTo);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search/filter/dateRange → navigate so the server re-fetches with the right scope
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const p = new URLSearchParams();
      if (activeFilter !== "all") p.set("filter", activeFilter);
      if (search) p.set("q", search);
      if (dateRange !== "all") p.set("range", dateRange);
      if (dateRange === "custom") {
        if (customFrom) p.set("from", customFrom);
        if (customTo) p.set("to", customTo);
      }
      router.replace(`/venuedashboard?${p.toString()}`, { scroll: false });
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeFilter, dateRange, customFrom, customTo]);

  function changeFilter(f: TicketFilter) {
    setActiveFilter(f);
  }

  // Client-side search filter only (date range is handled server-side via URL param)
  const filteredTickets =
    search.trim().length > 0
      ? data.tickets.filter((t) => {
          const q = search.toLowerCase();
          return (
            t.guestName.toLowerCase().includes(q) ||
            t.guestPhone.toLowerCase().includes(q) ||
            t.publicCode.toLowerCase().includes(q)
          );
        })
      : data.tickets;

  async function handleDelete(id: string) {
    if (!onDeletePending) return;
    setDeletingId(id);
    try {
      await onDeletePending(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Panel title="Tickets">
      {/* Search */}
      <div className="mb-3">
        <input
          className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30 focus:bg-white"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          value={search}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {filters.map((f) => {
          const active = activeFilter === f.value;
          return (
            <button
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-foreground text-white"
                  : "bg-zinc-100 text-muted hover:bg-zinc-200 hover:text-foreground"
              }`}
              key={f.value}
              onClick={() => changeFilter(f.value)}
              type="button"
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Date range row */}
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {dateRangeOptions.map((r) => (
          <button
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs transition ${
              dateRange === r.value
                ? "bg-zinc-200 font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
            key={r.value}
            onClick={() => setDateRange(r.value)}
            type="button"
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {dateRange === "custom" && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-zinc-50 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            From
            <input
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-foreground/30"
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              type="date"
              value={customFrom}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            To
            <input
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-foreground/30"
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              type="date"
              value={customTo}
            />
          </label>
          {(customFrom || customTo) && (
            <button
              className="pb-1.5 text-xs font-medium text-muted hover:text-foreground"
              onClick={() => { setCustomFrom(""); setCustomTo(""); }}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {dateRange !== "custom" && <div className="mb-2" />}

      {/* Ticket list */}
      {filteredTickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-xl">🎫</div>
          <p className="text-sm font-medium text-foreground">
            {activeFilter === "all" ? "No tickets" : `No ${activeFilter} tickets`}
          </p>
          <p className="mt-1 text-xs text-muted">Try a different filter or date range.</p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {filteredTickets.map((ticket) => (
            <TicketRow
              deletingId={deletingId}
              key={ticket.id}
              onDelete={isManager && onDeletePending ? handleDelete : undefined}
              ticket={ticket}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function TicketRow({
  ticket,
  onDelete,
  deletingId,
}: {
  ticket: VenueTicketListItem;
  onDelete?: (id: string) => Promise<void>;
  deletingId: string | null;
}) {
  const isPending = ticket.status === "pending_activation";

  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-zinc-50 sm:px-4">
      {/* Left side — name, item, time, mobile */}
      <a
        className="min-w-0 flex-1 block"
        href={`/venueticketdetail?id=${ticket.id}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-foreground truncate">{ticket.guestName}</p>
          <StatusPill tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</StatusPill>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {ticket.itemSummary ? <span>{ticket.itemSummary}</span> : null}
          <span className="font-mono">{ticket.publicCode}</span>
          <span>{ticket.guestPhone}</span>
          <span>{fmtDate(ticket.lastActivityAt)}</span>
        </div>
      </a>

      {/* Right side — slot + optional delete */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {ticket.slots.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1">
            {ticket.slots.map((slot, i) => (
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-bold ${
                  slot.collected
                    ? "bg-zinc-100 text-zinc-400 line-through"
                    : "bg-foreground text-white"
                }`}
                key={`${slot.label}-${i}`}
              >
                {slot.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
        {isPending && onDelete ? (
          <button
            className="text-[10px] font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
            disabled={deletingId === ticket.id}
            onClick={() => onDelete(ticket.id)}
            type="button"
          >
            {deletingId === ticket.id ? "Deleting…" : "Delete"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
