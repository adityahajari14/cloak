import { SecondaryLink } from "@/components/shared/ButtonLink";
import PageShell from "@/components/shared/PageShell";
import { COUNTRY_FILTER_OPTIONS, type AdminDashboardData } from "@/lib/admin-dashboard";
import VenueMapPanel from "./VenueMapPanel";
import VenueTable from "./VenueTable";
import CountryFilterSelect from "./CountryFilterSelect";

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconBuilding() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M3 21h18M4 21V8l8-5 8 5v13M9 21v-5h6v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M3 3v18h18M7 15l4-5 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconExclamation() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUserMinus() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM18.75 9.75h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M2.25 6.75c0 8.284 6.716 15 15 15h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STAT_ICONS: Record<string, React.ReactNode> = {
  "Total venues": <IconBuilding />,
  "MRR": <IconChart />,
  "Billing issues": <IconExclamation />,
  "Cancellations": <IconUserMinus />,
  "Demo call requests": <IconPhone />,
};

type Tone = "green" | "warning" | "danger" | "neutral" | "blue";

// All cards share the same white/zinc surface — tone only affects the icon chip.
const cardStyle: Record<Tone, { icon: string }> = {
  blue:    { icon: "bg-zinc-100 text-zinc-500" },
  danger:  { icon: "bg-zinc-100 text-zinc-500" },
  green:   { icon: "bg-zinc-100 text-zinc-500" },
  neutral: { icon: "bg-zinc-100 text-zinc-500" },
  warning: { icon: "bg-zinc-100 text-zinc-500" },
};

function normalizeTone(t: string): Tone {
  if (t === "green" || t === "warning" || t === "danger" || t === "blue") return t as Tone;
  return "neutral";
}

function StatCard({
  stat,
}: {
  stat: AdminDashboardData["stats"][number];
}) {
  const tone = normalizeTone(stat.tone);
  const style = cardStyle[tone];
  const hasAlert = stat.label === "Billing issues" && Number(stat.value) > 0;

  return (
    <div
      className="relative flex flex-col justify-between rounded-xl border border-line bg-panel p-5 shadow-sm"
      title={stat.helper}
    >
      {hasAlert && (
        <span className="absolute right-4 top-4 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-500" />
        </span>
      )}
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.icon}`}>
        {STAT_ICONS[stat.label] ?? <IconBuilding />}
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{stat.label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
          {stat.value}
        </p>
        {stat.helper && (
          <p className="mt-1 text-xs text-muted">{stat.helper}</p>
        )}
      </div>
    </div>
  );
}

export default function MasterDashboardPage({
  data,
  message,
}: {
  data: AdminDashboardData;
  message?: string;
}) {
  return (
    <PageShell
      activePath="/masterdashboard"
      eyebrow="Platform admin"
      title="Admin console"
      description="Monitor venues and track platform health."
      actions={<SecondaryLink href="/masterdashboard/analytics">View analytics</SecondaryLink>}
    >
      {/* Toast notification */}
      {message ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-sm font-medium text-foreground shadow-sm">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-white">✓</span>
          {message}
        </div>
      ) : null}

      {/* ── Stat grid ── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Platform overview
          </p>
          <CountryFilterSelect value={data.countryFilter} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {data.stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>
      </div>

      {/* ── Map + table ── */}
      <VenueMapPanel venues={data.venues} />
      <VenueTable venues={data.venues} />
    </PageShell>
  );
}
