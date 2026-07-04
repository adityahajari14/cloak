"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminVenueReview } from "@/lib/admin-dashboard";

type StatusFilter = "all" | "approved" | "suspended";

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Suspended", value: "suspended" },
];

const STATUS_DOT: Record<AdminVenueReview["status"], string> = {
  approved: "bg-zinc-800",
  suspended: "bg-zinc-300",
};

const STATUS_LABEL: Record<AdminVenueReview["status"], string> = {
  approved:  "Approved",
  suspended: "Suspended",
};

function formatPlan(plan: string | null) {
  if (!plan) return "—";
  if (plan === "per_event") return "Per event";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

// A monochrome status badge — just a dot + label, no pastel backgrounds.
function StatusBadge({ venue }: { venue: AdminVenueReview }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[venue.status]}`} />
      <span className="text-sm text-foreground">{STATUS_LABEL[venue.status]}</span>
    </span>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function VenueTable({ venues }: { venues: AdminVenueReview[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visible = filter === "all" ? venues : venues.filter((v) => v.status === filter);
  const countFor = (s: StatusFilter) =>
    s === "all" ? venues.length : venues.filter((v) => v.status === s).length;

  return (
    <div className="rounded-xl border border-line bg-panel shadow-sm">
      {/* Table header */}
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Venues</h2>
          <p className="mt-0.5 text-xs text-muted">{venues.length} total · click any row to view details</p>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count = countFor(tab.value);
            const active = filter === tab.value;
            return (
              <button
                className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-foreground text-white"
                    : "text-muted hover:bg-zinc-100 hover:text-foreground"
                }`}
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                type="button"
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
          <svg className="h-8 w-8 text-zinc-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M3 21h18M4 21V8l8-5 8 5v13M9 21v-5h6v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-muted">No venues in this category</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-zinc-50/50 text-left">
              <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">Venue</th>
              <th className="hidden px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted md:table-cell">Plan</th>
              <th className="hidden px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted lg:table-cell">Signed up</th>
              <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">Status</th>
              <th className="px-6 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((venue) => (
              <tr className="transition-colors hover:bg-zinc-50/70" key={venue.id}>
                <td className="p-0">
                  <Link className="flex items-center gap-3 px-6 py-4" href={`/masterdashboard/venues/${venue.id}`}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-zinc-100 text-xs font-bold text-zinc-500">
                      {venue.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{venue.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[venue.city, venue.contactEmail].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="hidden p-0 md:table-cell">
                  <Link className="block px-6 py-4 text-sm text-muted" href={`/masterdashboard/venues/${venue.id}`}>
                    {formatPlan(venue.billingPlan)}
                  </Link>
                </td>
                <td className="hidden p-0 lg:table-cell">
                  <Link className="block px-6 py-4 text-sm text-muted" href={`/masterdashboard/venues/${venue.id}`}>
                    {formatDate(venue.createdAt)}
                  </Link>
                </td>
                <td className="p-0">
                  <Link className="block px-6 py-4" href={`/masterdashboard/venues/${venue.id}`}>
                    <StatusBadge venue={venue} />
                  </Link>
                </td>
                <td className="p-0">
                  <Link className="flex items-center justify-end px-6 py-4" href={`/masterdashboard/venues/${venue.id}`}>
                    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
