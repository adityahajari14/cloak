"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRY_FILTER_OPTIONS } from "@/lib/admin-dashboard";
import { MONTH_WINDOWS, type AnalyticsScope, type MonthWindow } from "@/lib/platform-analytics";

export default function AnalyticsScopeSelect({
  monthWindow,
  scope,
  venueOptions,
}: {
  monthWindow: MonthWindow;
  scope: AnalyticsScope;
  venueOptions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  // Platform analytics aggregates across every venue, so a scope change is a
  // slow query. Surface that instead of leaving the selects looking dead.
  const [isPending, startTransition] = useTransition();

  const countryValue = scope.type === "country" ? scope.country : "all";
  const venueValue = scope.type === "venue" ? scope.venueId : "";

  // Scope and window compose — changing one must not silently reset the other.
  function goTo(next: { country?: string; venueId?: string; months?: number }) {
    const params = new URLSearchParams();
    if (next.venueId) params.set("venueId", next.venueId);
    else if (next.country && next.country !== "all") params.set("country", next.country);

    const months = next.months ?? monthWindow;
    if (months !== 12) params.set("months", String(months));

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/masterdashboard/analytics?${qs}` : "/masterdashboard/analytics");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPending && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />
          Updating…
        </span>
      )}
      {/* The trend charts are month-bucketed (MRR, signups, ticket volume), so
          the window is in months — a "last 7 days" view of a monthly series
          would collapse to a single bar. */}
      <select
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8"
        onChange={(e) =>
          goTo({
            country: scope.type === "country" ? scope.country : undefined,
            months: Number(e.target.value),
            venueId: scope.type === "venue" ? scope.venueId : undefined,
          })
        }
        value={monthWindow}
      >
        {MONTH_WINDOWS.map((m) => (
          <option key={m} value={m}>
            Last {m} months
          </option>
        ))}
      </select>

      <select
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8"
        disabled={isPending}
        onChange={(e) => goTo({ country: e.target.value })}
        value={scope.type === "venue" ? "all" : countryValue}
      >
        {COUNTRY_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className="min-w-[10rem] rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8"
        disabled={isPending}
        onChange={(e) => goTo({ venueId: e.target.value })}
        value={venueValue}
      >
        <option value="">All venues</option>
        {venueOptions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}
