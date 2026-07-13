"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageShell from "@/components/shared/PageShell";
import Panel from "@/components/shared/Panel";
import type { CustomerRow, DateRange, VenueAnalyticsData } from "@/lib/venue-dashboard";

type Tone = "green" | "warning" | "danger" | "neutral";

// The ranges offered on analytics. "Day" is today so far, not a rolling 24h —
// a manager asking for "day" means tonight's trading, not since 3pm yesterday.
const RANGE_OPTIONS: Array<{ value: DateRange; label: string }> = [
  { label: "Day", value: "today" },
  { label: "Week", value: "7d" },
  { label: "Month", value: "1mo" },
  { label: "Year", value: "1y" },
  { label: "All", value: "all" },
  { label: "Custom", value: "custom" },
];

const RANGE_LABEL: Record<DateRange, string> = {
  "24h": "the last 24 hours",
  "1mo": "the last month",
  "1y": "the last year",
  "7d": "the last 7 days",
  all: "all time",
  custom: "the selected dates",
  today: "today",
};

const toneClass: Record<Tone, string> = {
  danger: "text-red-600",
  green: "text-emerald-600",
  neutral: "text-foreground",
  warning: "text-amber-600",
};

const iconBg: Record<Tone, string> = {
  danger: "bg-red-50 text-red-500",
  green: "bg-emerald-50 text-emerald-500",
  neutral: "bg-zinc-100 text-zinc-500",
  warning: "bg-amber-50 text-amber-500",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv(customers: CustomerRow[]) {
  const header = "Name,Email,Phone,Visits,Last Visit";
  const rows = customers.map((c) =>
    [csvCell(c.name), csvCell(c.email), csvCell(c.phone), c.visits, fmtDate(c.lastVisit)].join(","),
  );
  download([header, ...rows].join("\n"), "customers.csv", "text/csv");
}

// ─── Marketing export ──────────────────────────────────────────────────────────

// Email and mobile are pulled out as separate lists on purpose: an email tool
// and an SMS/WhatsApp tool each want one channel, and a mixed CSV means the
// venue has to split the columns by hand before they can import anything.
//
// Not every guest has both — email is nullable (phone-only check-ins), so the
// two lists differ in length and the counts are surfaced rather than hidden.
type Channel = "email" | "phone";

function contactsFor(customers: CustomerRow[], channel: Channel): string[] {
  const values = customers
    .map((c) => (channel === "email" ? c.email : c.phone).trim())
    .filter(Boolean);
  return [...new Set(values)];
}

/**
 * Guests with nothing to reach them on for this channel.
 *
 * Counted directly rather than as (rows − unique contacts): that subtraction
 * conflates a guest with no email against two rows sharing one, and would
 * over-report the gap for any repeat visitor.
 */
function missingContact(customers: CustomerRow[], channel: Channel): number {
  return customers.filter((c) => !(channel === "email" ? c.email : c.phone).trim()).length;
}

function MarketingExport({
  customers,
  periodLabel,
}: {
  customers: CustomerRow[];
  periodLabel: string;
}) {
  const [copied, setCopied] = useState<Channel | null>(null);

  const emails = contactsFor(customers, "email");
  const phones = contactsFor(customers, "phone");

  function handleCopy(channel: Channel, values: string[]) {
    void navigator.clipboard.writeText(values.join(", ")).then(() => {
      setCopied(channel);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function handleDownload(channel: Channel, values: string[]) {
    const header = channel === "email" ? "Email" : "Phone";
    download(
      [header, ...values.map(csvCell)].join("\n"),
      `${channel === "email" ? "emails" : "mobiles"}.csv`,
      "text/csv",
    );
  }

  const channels: Array<{
    key: Channel;
    label: string;
    values: string[];
    hint: string;
    icon: string;
  }> = [
    {
      hint: "For email campaigns — Mailchimp, Klaviyo, etc.",
      icon: "✉️",
      key: "email",
      label: "Email addresses",
      values: emails,
    },
    {
      hint: "For SMS and WhatsApp campaigns.",
      icon: "📱",
      key: "phone",
      label: "Mobile numbers",
      values: phones,
    },
  ];

  return (
    <Panel
      title="Marketing export"
      description={
        customers.length > 0
          ? `Contacts from ${periodLabel}. Select guests in the table below to narrow this down.`
          : `No guests in ${periodLabel}.`
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {channels.map((channel) => {
          const missing = missingContact(customers, channel.key);
          return (
            <div className="rounded-xl border border-line bg-white p-4" key={channel.key}>
              <div className="flex items-center gap-2">
                <span className="text-base">{channel.icon}</span>
                <p className="text-sm font-semibold text-foreground">{channel.label}</p>
                <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                  {channel.values.length}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted">{channel.hint}</p>

              {missing > 0 && (
                <p className="mt-1.5 text-xs text-amber-700">
                  {missing} selected guest{missing === 1 ? " has" : "s have"} no{" "}
                  {channel.key === "email" ? "email address" : "mobile number"}.
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-foreground transition hover:border-foreground/30 disabled:opacity-40"
                  disabled={channel.values.length === 0}
                  onClick={() => handleCopy(channel.key, channel.values)}
                  type="button"
                >
                  {copied === channel.key ? "Copied!" : "Copy list"}
                </button>
                <button
                  className="flex-1 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  disabled={channel.values.length === 0}
                  onClick={() => handleDownload(channel.key, channel.values)}
                  type="button"
                >
                  Download CSV
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ data, basePath }: { data: VenueAnalyticsData; basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Rebuild the querystring from the current one so range and event compose
  // instead of clobbering each other. basePath keeps the bar on whichever page
  // it's rendered on — the same component serves the venue page and the
  // platform-admin one, and hardcoding /venueanalytics used to bounce admins
  // off their own page (which is why the bar was hidden for them).
  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  const scopedToEvent = Boolean(data.eventId);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGE_OPTIONS.map((option) => {
          const selected = !scopedToEvent && data.dateRange === option.value;
          return (
            <button
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? "bg-foreground text-white"
                  : "border border-line bg-white text-muted hover:border-foreground/30 hover:text-foreground"
              }`}
              disabled={scopedToEvent}
              key={option.value}
              onClick={() => apply({ range: option.value })}
              title={scopedToEvent ? "Clear the event filter to use date ranges" : undefined}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <select
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-foreground outline-none transition focus:border-foreground/40"
          onChange={(e) => apply({ event: e.target.value || null })}
          value={data.eventId}
        >
          <option value="">All events</option>
          {data.eventOptions.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} — {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </option>
          ))}
        </select>
      </div>

      {data.dateRange === "custom" && !scopedToEvent && (
        <div className="flex items-center gap-2">
          <input
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-foreground/40"
            defaultValue={data.customFrom}
            onChange={(e) => apply({ from: e.target.value || null, range: "custom" })}
            type="date"
          />
          <span className="text-xs text-muted">to</span>
          <input
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-foreground/40"
            defaultValue={data.customTo}
            onChange={(e) => apply({ range: "custom", to: e.target.value || null })}
            type="date"
          />
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage({
  data,
  venueOnly = false,
}: {
  data: VenueAnalyticsData;
  venueOnly?: boolean;
}) {
  const normalizeTone = (tone: string): Tone => {
    if (tone === "green" || tone === "warning" || tone === "danger") return tone as Tone;
    return "neutral";
  };

  // When scoped to one event, the event IS the window — say so instead of
  // claiming a date range that isn't being applied.
  const selectedEvent = data.eventOptions.find((e) => e.id === data.eventId);
  const periodLabel = selectedEvent
    ? selectedEvent.name
    : RANGE_LABEL[data.dateRange];

  const basePath = venueOnly ? "/venueanalytics" : "/analytics";

  return (
    <PageShell
      activePath={basePath}
      eyebrow={venueOnly ? data.venueLabel : "Platform"}
      title="Analytics"
      venueRole={venueOnly ? "manager" : undefined}
    >
      {/* Filtering works on both surfaces now — the platform admin gets the same
          range and event controls, scoped across every venue. */}
      <FilterBar basePath={basePath} data={data} />

      {/* Never let a truncated figure pass as a total. */}
      {data.truncated && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
            !
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">Showing a partial view</p>
            <p className="mt-0.5 text-xs text-amber-800">
              This period contains more than {data.ticketsAnalyzed.toLocaleString()} tickets. Every
              figure below is calculated from the first {data.ticketsAnalyzed.toLocaleString()} and
              is not the full total — narrow the date range for accurate numbers.
            </p>
          </div>
        </div>
      )}
      {/* Stat bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.stats.map((stat) => {
          const tone = normalizeTone(stat.tone);
          return (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel px-4 py-4 shadow-sm" key={stat.label}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${iconBg[tone]}`}>
                {stat.label === "Total" ? "📊" : stat.label === "Stored" ? "📦" : stat.label === "Collected" ? "✓" : "⏱"}
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{stat.label}</p>
                <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${toneClass[tone]}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Popular items — what guests actually check in */}
      <PopularItemsCard items={data.itemTypes} periodLabel={periodLabel} />

      {/* Operational insight: when to roster, who's coming back, what leaks */}
      <StaffingCard periodLabel={periodLabel} staffing={data.staffing} />

      <div className="grid gap-5 lg:grid-cols-2">
        <GuestMixCard mix={data.guestMix} />
        <DropOffCard dropOff={data.dropOff} />
      </div>

      {/* Charts */}
      <Panel title={selectedEvent ? selectedEvent.name : `Showing ${periodLabel}`}>
        <div className="grid gap-8 md:grid-cols-2">
          <VolumeChart data={data.hourlyVolume} />
          <ItemTypesChart data={data.itemTypes} />
        </div>
      </Panel>

      {/* Per-event breakdown */}
      {data.byEvent.length > 0 && (
        <Panel title="By event" description={`Tickets tagged to each event in ${periodLabel}.`}>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3 text-right">Tickets</th>
                  <th className="px-4 py-3 text-right">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.byEvent.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{event.name}</p>
                      {event.eventDate ? (
                        <p className="mt-0.5 text-xs text-muted">
                          {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {event.tickets}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{event.collected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Guest data + marketing export — selection is shared between them */}
      <GuestDataPanel customers={data.customers} periodLabel={periodLabel} />
    </PageShell>
  );
}

// ─── Operational insight ───────────────────────────────────────────────────────

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * When the counter is actually busy. Check-in and collection peak at different
 * times — guests arrive over an hour or two and all leave at closing — so a
 * venue rostering off check-in volume alone understaffs the rush at the end of
 * the night, which is exactly when queues and disputes happen.
 */
function StaffingCard({
  staffing,
  periodLabel,
}: {
  staffing: VenueAnalyticsData["staffing"];
  periodLabel: string;
}) {
  const hasData = staffing.checkInPeak !== null || staffing.collectionPeak !== null;

  return (
    <Panel
      title="Peak hours & staffing"
      description={`When the counter is busiest during ${periodLabel}.`}
    >
      {!hasData ? (
        <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-8 text-center text-sm text-muted">
          Not enough activity yet to identify peak hours.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              hint="Busiest check-in window"
              icon="📥"
              label="Check-in peak"
              value={staffing.checkInPeak ?? "—"}
            />
            <StatTile
              hint="Busiest collection window"
              icon="📤"
              label="Collection peak"
              value={staffing.collectionPeak ?? "—"}
            />
            <StatTile
              hint="Typical time items are stored"
              icon="⏱"
              label="Median turnaround"
              value={formatDuration(staffing.medianTurnaroundMinutes)}
            />
          </div>

          {staffing.collectionVolume.length > 0 && (
            <div className="mt-6">
              <p className="mb-4 text-sm font-medium text-foreground">Collections by hour</p>
              <HourBars data={staffing.collectionVolume} tone="emerald" />
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function StatTile({
  hint,
  icon,
  label,
  value,
}: {
  hint: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function HourBars({
  data,
  tone,
}: {
  data: VenueAnalyticsData["hourlyVolume"];
  tone: "brand" | "emerald";
}) {
  const barClass = tone === "emerald" ? "bg-emerald-500" : "bg-brand/75";
  return (
    <div className="flex h-28 items-end gap-1">
      {data.map((item) => (
        <div className="group flex h-full w-full flex-col justify-end gap-1" key={item.hour}>
          <div className="relative flex justify-center">
            {item.count > 0 && (
              <span className="absolute -top-5 hidden text-[9px] font-medium text-muted group-hover:block">
                {item.count}
              </span>
            )}
            <div
              className={`w-full rounded-t-sm transition-all ${barClass}`}
              style={{
                height: item.percent > 0 ? `${Math.max(item.percent, 4)}%` : "2px",
                opacity: item.count === 0 ? 0.25 : 1,
              }}
              title={`${item.count}`}
            />
          </div>
          <span className="text-center text-[9px] text-muted">{item.hour}</span>
        </div>
      ))}
    </div>
  );
}

/** Retention. `visits` was already tracked per guest but never shown. */
function GuestMixCard({ mix }: { mix: VenueAnalyticsData["guestMix"] }) {
  const total = mix.newGuests + mix.returningGuests;
  const returningPct = total > 0 ? Math.round((mix.returningGuests / total) * 100) : 0;

  return (
    <Panel title="Repeat vs new guests" description="How many guests are coming back.">
      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-8 text-center text-sm text-muted">
          No guests in this period.
        </div>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="bg-brand transition-all"
              style={{ width: `${100 - returningPct}%` }}
              title={`${mix.newGuests} new`}
            />
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${returningPct}%` }}
              title={`${mix.returningGuests} returning`}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand" />
                <p className="text-xs font-medium text-muted">New</p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {mix.newGuests}{" "}
                <span className="text-sm font-normal text-muted">({100 - returningPct}%)</span>
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-medium text-muted">Returning</p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {mix.returningGuests}{" "}
                <span className="text-sm font-normal text-muted">({returningPct}%)</span>
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
            <span>
              Avg visits per guest:{" "}
              <span className="font-semibold text-foreground">{mix.avgVisits.toFixed(1)}</span>
            </span>
            <span>
              Most loyal: <span className="font-semibold text-foreground">{mix.topVisits} visits</span>
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * Where passes leak out of the funnel. Both numbers are directly actionable:
 * a high no-show rate means guests can't find the QR or the counter; a high
 * forgotten rate is a lost-property pile that's also eating storage capacity.
 */
function DropOffCard({ dropOff }: { dropOff: VenueAnalyticsData["dropOff"] }) {
  const rows = [
    {
      count: dropOff.noShowCount,
      hint: "Pass issued, nothing ever handed over",
      label: "No-shows",
      rate: dropOff.noShowRate,
    },
    {
      count: dropOff.forgottenCount,
      hint: "Items stored, never collected",
      label: "Forgotten",
      rate: dropOff.forgottenRate,
    },
  ];

  return (
    <Panel title="Drop-off" description="Passes that never completed the journey.">
      <div className="space-y-4">
        {rows.map((row) => {
          const tone =
            row.rate >= 20 ? "text-red-600" : row.rate >= 10 ? "text-amber-600" : "text-foreground";
          const bar =
            row.rate >= 20 ? "bg-red-500" : row.rate >= 10 ? "bg-amber-500" : "bg-zinc-300";
          return (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className={`text-sm font-semibold tabular-nums ${tone}`}>
                  {row.count} <span className="text-xs font-normal text-muted">({row.rate}%)</span>
                </p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${bar}`}
                  style={{ width: `${Math.min(Math.max(row.rate, 1), 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">{row.hint}</p>
            </div>
          );
        })}
      </div>

      {dropOff.slotsHeldByForgotten > 0 && (
        <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <strong>{dropOff.slotsHeldByForgotten}</strong>{" "}
          {dropOff.slotsHeldByForgotten === 1 ? "slot is" : "slots are"} still occupied by
          uncollected items — clear the rail to free that capacity.
        </p>
      )}
    </Panel>
  );
}

// ─── Guest data + selection ────────────────────────────────────────────────────

// The customer list is deduplicated upstream by email-or-phone, so that same
// value is a stable identity for a row.
function customerKey(c: CustomerRow) {
  return (c.email || c.phone || c.name).toLowerCase();
}

function GuestDataPanel({
  customers,
  periodLabel,
}: {
  customers: CustomerRow[];
  periodLabel: string;
}) {
  // Empty selection means "everyone currently filtered" — the venue shouldn't
  // have to tick 200 boxes just to export the whole month.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedCustomers = useMemo(
    () =>
      selected.size === 0 ? customers : customers.filter((c) => selected.has(customerKey(c))),
    [customers, selected],
  );

  const allSelected = selected.size > 0 && selected.size === customers.length;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(customers.map(customerKey)));
  }

  const exportLabel =
    selected.size === 0
      ? periodLabel
      : `${selected.size} selected guest${selected.size === 1 ? "" : "s"}`;

  return (
    <>
      <MarketingExport customers={selectedCustomers} periodLabel={exportLabel} />

      <Panel
        title="Guest data"
        description={
          selected.size > 0
            ? `${selected.size} of ${customers.length} selected.`
            : `All guests from ${periodLabel}. Tick rows to export a subset.`
        }
        action={
          customers.length > 0 ? (
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground"
                  onClick={() => setSelected(new Set())}
                  type="button"
                >
                  Clear selection
                </button>
              )}
              <button
                className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground"
                onClick={() => exportCsv(selectedCustomers)}
                type="button"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export all fields
              </button>
            </div>
          ) : undefined
        }
      >
        {customers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-8 text-center text-sm text-muted">
            No guest data yet — appears after tickets are created.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="w-10 px-4 py-3">
                    <input
                      aria-label="Select all guests"
                      checked={allSelected}
                      className="h-4 w-4 cursor-pointer rounded border-line accent-zinc-900"
                      onChange={toggleAll}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Phone</th>
                  <th className="px-4 py-3 text-right">Visits</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Last visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((c) => {
                  const key = customerKey(c);
                  const isSelected = selected.has(key);
                  return (
                    <tr
                      className={`cursor-pointer transition hover:bg-zinc-50 ${isSelected ? "bg-zinc-50" : ""}`}
                      key={key}
                      onClick={() => toggle(key)}
                    >
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Select ${c.name}`}
                          checked={isSelected}
                          className="h-4 w-4 cursor-pointer rounded border-line accent-zinc-900"
                          onChange={() => toggle(key)}
                          onClick={(e) => e.stopPropagation()}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted">{c.email || "—"}</td>
                      <td className="hidden px-4 py-3 text-muted sm:table-cell">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{c.visits}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted sm:table-cell">
                        {fmtDate(c.lastVisit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

// ─── Popular items ─────────────────────────────────────────────────────────────

// Maps an item label to an emoji. Falls back to a generic tag, so an unknown
// label still renders cleanly rather than showing a gap.
function itemIcon(label: string): string {
  const l = label.toLowerCase();
  if (/coat|jacket|parka|blazer/.test(l)) return "🧥";
  if (/bag|backpack|rucksack|handbag/.test(l)) return "🎒";
  if (/suitcase|luggage|case/.test(l)) return "🧳";
  if (/hat|cap|beanie/.test(l)) return "🧢";
  if (/umbrella/.test(l)) return "☂️";
  if (/scarf|glove/.test(l)) return "🧣";
  if (/helmet/.test(l)) return "🪖";
  if (/laptop|comput/.test(l)) return "💻";
  return "🏷️";
}

function PopularItemsCard({
  items,
  periodLabel,
}: {
  items: VenueAnalyticsData["itemTypes"];
  periodLabel: string;
}) {
  if (items.length === 0) {
    return (
      <Panel title="Popular items" description={`What guests checked in during ${periodLabel}.`}>
        <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-8 text-center text-sm text-muted">
          No items yet — appears once staff start storing items.
        </div>
      </Panel>
    );
  }

  const total = items.reduce((sum, i) => sum + i.count, 0);
  // itemTypes arrives sorted by count desc; the top 5 is what a manager acts on.
  const top = items.slice(0, 5);
  const rankTone = ["bg-amber-100 text-amber-700", "bg-zinc-200 text-zinc-600", "bg-orange-100 text-orange-700"];

  return (
    <Panel
      title="Popular items"
      description={`What guests checked in during ${periodLabel}. ${total} item${total === 1 ? "" : "s"} total.`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((item, i) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div
              className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 shadow-sm"
              key={item.label}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                {itemIcon(item.label)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      rankTone[i] ?? "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className="truncate text-sm font-semibold capitalize text-foreground">
                    {item.label}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {item.count} <span className="text-muted/60">({pct}%)</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function VolumeChart({ data }: { data: VenueAnalyticsData["hourlyVolume"] }) {
  const peakEntry = data.reduce<{ hour: string; count: number } | null>(
    (best, d) => (!best || d.count > best.count ? d : best),
    null,
  );

  const hasData = data.some((d) => d.count > 0);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-foreground">Ticket volume by hour</p>
        {hasData && peakEntry && peakEntry.count > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Peak: {peakEntry.hour}
          </span>
        )}
      </div>
      <div className="flex h-36 items-end gap-1">
        {data.map((item) => (
          <div className="group flex h-full w-full flex-col justify-end gap-1" key={item.hour}>
            <div className="relative flex justify-center">
              {item.count > 0 && (
                <span className="absolute -top-5 hidden text-[9px] font-medium text-muted group-hover:block">
                  {item.count}
                </span>
              )}
              <div
                className={`w-full rounded-t-sm transition-all ${
                  peakEntry && item.hour === peakEntry.hour && item.count > 0
                    ? "bg-amber-400"
                    : "bg-brand/75"
                }`}
                style={{ height: item.percent > 0 ? `${Math.max(item.percent, 4)}%` : "2px", opacity: item.count === 0 ? 0.25 : 1 }}
                title={`${item.count} tickets`}
              />
            </div>
            <span className="text-center text-[9px] text-muted">{item.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemTypesChart({ data }: { data: VenueAnalyticsData["itemTypes"] }) {
  if (data.length === 0) {
    return (
      <div>
        <p className="mb-4 text-sm font-medium text-foreground">Item types</p>
        <p className="text-sm text-muted">No item data yet — appears after staff activate tickets.</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <p className="mb-4 text-sm font-medium text-foreground">Item types</p>
      <div className="space-y-3">
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center gap-3">
                <div className="h-5 overflow-hidden rounded bg-brand/15" style={{ width: `${item.percent}%`, minWidth: "4px" }}>
                  <div className="h-full rounded bg-brand" style={{ width: "100%" }} />
                </div>
                <span className="shrink-0 text-sm font-medium text-foreground">{item.label}</span>
                <span className="ml-auto shrink-0 tabular-nums text-xs text-muted">
                  {item.count} <span className="text-muted/60">({pct}%)</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
