"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageShell from "@/components/shared/PageShell";
import Panel from "@/components/shared/Panel";
import { SecondaryLink } from "@/components/shared/ButtonLink";
import type { PlatformAnalyticsData } from "@/lib/platform-analytics";
import AnalyticsScopeSelect from "./AnalyticsScopeSelect";

// Reference categorical palette (validated — see dataviz skill), fixed order.
const SERIES = {
  blue: "#2a78d6",
  aqua: "#1baf7a",
  yellow: "#eda100",
  violet: "#4a3aa7",
  red: "#e34948",
};

const CHROME = {
  grid: "#e1e0d9",
  muted: "#898781",
};

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", maximumFractionDigits: 0, style: "currency" }).format(
    amount,
  );
}

function StatTile({ helper, label, value }: { helper?: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}

export default function PlatformAnalyticsPage({ data }: { data: PlatformAnalyticsData }) {
  const scope = data.scope;
  const isVenueScope = scope.type === "venue";
  const scopeDescription =
    scope.type === "venue"
      ? (data.venueOptions.find((v) => v.id === scope.venueId)?.name ?? "Selected venue")
      : scope.type === "country"
        ? scope.country
        : "All venues";

  return (
    <PageShell
      activePath="/masterdashboard"
      eyebrow="Platform admin"
      title="Analytics"
      description={`Showing: ${scopeDescription}`}
      actions={<SecondaryLink href="/masterdashboard">Back to dashboard</SecondaryLink>}
    >
      <div className="flex justify-end">
        <AnalyticsScopeSelect
          monthWindow={data.monthWindow}
          scope={data.scope}
          venueOptions={data.venueOptions}
        />
      </div>

      {/* ── Revenue ── */}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <StatTile helper="Active subscriptions" label="Current MRR" value={formatGbp(data.currentMrr)} />
        <Panel
          description="Estimated from signup dates and current plan/cadence — not actual billed amounts (no Stripe invoice history yet)."
          title="MRR trend — last 12 months"
        >
          <ResponsiveContainer height={220} width="100%">
            <AreaChart data={data.mrrTrend} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={CHROME.grid} vertical={false} />
              <XAxis axisLine={false} dataKey="label" fontSize={12} stroke={CHROME.muted} tickLine={false} />
              <YAxis
                axisLine={false}
                fontSize={12}
                stroke={CHROME.muted}
                tickFormatter={(v) => formatGbp(v)}
                tickLine={false}
                width={70}
              />
              <Tooltip formatter={(v) => formatGbp(Number(v))} />
              <Area dataKey="mrr" fill={SERIES.blue} fillOpacity={0.1} stroke={SERIES.blue} strokeWidth={2} type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── Ticket volume & usage ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Ticket volume &amp; usage</p>
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <Panel title="Tickets — last 12 months">
            <ResponsiveContainer height={260} width="100%">
              <LineChart data={data.ticketTrend} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHROME.grid} vertical={false} />
                <XAxis axisLine={false} dataKey="label" fontSize={12} stroke={CHROME.muted} tickLine={false} />
                <YAxis axisLine={false} fontSize={12} stroke={CHROME.muted} tickLine={false} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="created" dot={{ r: 4 }} name="Created" stroke={SERIES.blue} strokeWidth={2} type="monotone" />
                <Line dataKey="activated" dot={{ r: 4 }} name="Activated" stroke={SERIES.aqua} strokeWidth={2} type="monotone" />
                <Line dataKey="collected" dot={{ r: 4 }} name="Collected" stroke={SERIES.violet} strokeWidth={2} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
          <div className="grid gap-5">
            <StatTile helper="All-time" label="Total tickets" value={String(data.totalTickets)} />
            <StatTile helper="Created → activated" label="Activation rate" value={`${data.activationRate}%`} />
            <StatTile
              helper="Activation to collection"
              label="Avg storage time"
              value={data.avgStorageHours !== null ? `${data.avgStorageHours}h` : "—"}
            />
          </div>
        </div>
      </div>

      {/* ── Venue health ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Venue health</p>
        <div className="grid gap-5 sm:grid-cols-3">
          {!isVenueScope && (
            <StatTile
              helper={`${data.suspendedVenueCount} suspended`}
              label="Active venues"
              value={String(data.activeVenueCount)}
            />
          )}
          <StatTile helper="Items stored vs. capacity" label="Avg utilization" value={`${data.avgUtilization}%`} />
        </div>
        <Panel description="New venue signups vs. cancellation requests, per month." title="Signups vs. cancellations">
          <ResponsiveContainer height={220} width="100%">
            <BarChart data={data.signupsVsCancellations} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={CHROME.grid} vertical={false} />
              <XAxis axisLine={false} dataKey="label" fontSize={12} stroke={CHROME.muted} tickLine={false} />
              <YAxis axisLine={false} fontSize={12} stroke={CHROME.muted} tickLine={false} width={30} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="signups" fill={SERIES.blue} name="Signups" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancellations" fill={SERIES.red} name="Cancellations" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── Plan mix ── */}
      {!isVenueScope && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Plan mix</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Venues by plan">
              <ResponsiveContainer height={240} width="100%">
                <PieChart>
                  <Pie
                    data={data.planMix}
                    dataKey="count"
                    innerRadius={60}
                    nameKey="label"
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.planMix.map((entry, i) => (
                      <Cell fill={Object.values(SERIES)[i % 5]} key={entry.plan} stroke="#fcfcfb" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="MRR by plan">
              <div className="space-y-3">
                {data.planMix.map((p) => (
                  <div className="flex items-center justify-between border-b border-line pb-2 last:border-0" key={p.plan}>
                    <span className="text-sm font-medium text-foreground">{p.label}</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {p.plan === "per_event" ? "n/a — not a subscription" : formatGbp(p.revenue)}
                      </p>
                      <p className="text-xs text-muted">{p.count} venue{p.count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </PageShell>
  );
}
