"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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

const accentBar: Record<StatusTone, string> = {
  blue: "bg-zinc-900",
  green: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
  neutral: "bg-zinc-300",
};

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

  // Every filter/range/search change navigates, which re-runs the whole
  // dashboard query server-side. Wrapping the navigation in a transition gives
  // us a real isPending flag — without it the buttons look inert for the entire
  // round trip and people click them again thinking nothing happened.
  const [isPending, startTransition] = useTransition();

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
      startTransition(() => {
        router.replace(`/venuedashboard?${p.toString()}`, { scroll: false });
      });
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
            t.guestEmail.toLowerCase().includes(q) ||
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
    <Panel
      title="Tickets"
      action={
        isPending ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />
            Updating…
          </span>
        ) : undefined
      }
    >
      {/* Search */}
      <div className="relative mb-3">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          className="w-full rounded-lg border border-line bg-zinc-50 py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-foreground/30 focus:bg-white"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          value={search}
        />
      </div>

      {/* Filter tabs */}
      <div className="relative mb-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filters.map((f) => {
            const active = activeFilter === f.value;
            return (
              <button
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-foreground text-white shadow-sm"
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
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-linear-to-l from-panel to-transparent sm:hidden" />
      </div>

      {/* Date range row */}
      <div className="relative mb-2">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
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
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-linear-to-l from-panel to-transparent sm:hidden" />
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

      {/* Ticket list — dimmed while refreshing so stale rows don't read as current */}
      <div className={isPending ? "opacity-50 transition-opacity" : "transition-opacity"}>
      {filteredTickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-xl">🎫</div>
          <p className="text-sm font-medium text-foreground">
            {activeFilter === "all" ? "No tickets" : `No ${activeFilter} tickets`}
          </p>
          <p className="mt-1 text-xs text-muted">Try a different filter or date range.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-0 sm:divide-y sm:divide-line sm:overflow-hidden sm:rounded-lg sm:border sm:border-line">
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
      </div>
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
  const tone = statusTone(ticket.status);

  return (
    <div className="relative flex overflow-hidden rounded-xl border border-line bg-panel shadow-sm sm:rounded-none sm:border-0 sm:shadow-none sm:hover:bg-zinc-50">
      <span className={`w-1 shrink-0 sm:hidden ${accentBar[tone]}`} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        {/* Left side — name, item, time, mobile */}
        <a
          className="min-w-0 flex-1 block"
          href={`/venueticketdetail?id=${ticket.id}`}
        >
          <p className="font-semibold text-sm text-foreground truncate">{ticket.guestName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            {ticket.itemSummary ? <span>{ticket.itemSummary}</span> : null}
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">{ticket.publicCode}</span>
            <span>{ticket.guestPhone}</span>
            {ticket.guestEmail ? <span className="truncate">{ticket.guestEmail}</span> : null}
            <span>{fmtDate(ticket.lastActivityAt)}</span>
          </div>
        </a>

        {/* Right side — status, slots, optional delete */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line pt-2.5 sm:flex-col sm:items-end sm:gap-1.5 sm:border-t-0 sm:pt-0">
          <StatusPill tone={tone}>{statusLabel(ticket.status)}</StatusPill>
          {ticket.slots.length > 0 ? (
            <div className="flex flex-wrap gap-1 sm:justify-end">
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
    </div>
  );
}
