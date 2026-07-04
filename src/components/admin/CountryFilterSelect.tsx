"use client";

import { useRouter } from "next/navigation";
import { COUNTRY_FILTER_OPTIONS, type CountryFilter } from "@/lib/admin-dashboard";

export default function CountryFilterSelect({ value }: { value: CountryFilter }) {
  const router = useRouter();

  return (
    <select
      className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8"
      onChange={(e) => {
        const next = e.target.value;
        router.push(next === "all" ? "/masterdashboard" : `/masterdashboard?country=${encodeURIComponent(next)}`);
      }}
      value={value}
    >
      {COUNTRY_FILTER_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
