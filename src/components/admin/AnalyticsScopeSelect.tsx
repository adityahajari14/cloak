"use client";

import { useRouter } from "next/navigation";
import { COUNTRY_FILTER_OPTIONS } from "@/lib/admin-dashboard";
import type { AnalyticsScope } from "@/lib/platform-analytics";

export default function AnalyticsScopeSelect({
  scope,
  venueOptions,
}: {
  scope: AnalyticsScope;
  venueOptions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const countryValue = scope.type === "country" ? scope.country : "all";
  const venueValue = scope.type === "venue" ? scope.venueId : "";

  function goTo(next: { country?: string; venueId?: string }) {
    const params = new URLSearchParams();
    if (next.venueId) params.set("venueId", next.venueId);
    else if (next.country && next.country !== "all") params.set("country", next.country);
    const qs = params.toString();
    router.push(qs ? `/masterdashboard/analytics?${qs}` : "/masterdashboard/analytics");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8"
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
