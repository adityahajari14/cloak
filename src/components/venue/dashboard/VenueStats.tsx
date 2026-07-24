type Tone = "blue" | "green" | "warning" | "danger" | "neutral";

const toneClass: Record<Tone, string> = {
  blue: "text-foreground",
  danger: "text-red-600",
  green: "text-emerald-600",
  neutral: "text-foreground",
  warning: "text-amber-600",
};

const iconBg: Record<Tone, string> = {
  blue: "bg-zinc-100 text-zinc-500",
  danger: "bg-red-50 text-red-500",
  green: "bg-emerald-50 text-emerald-500",
  neutral: "bg-zinc-100 text-zinc-500",
  warning: "bg-amber-50 text-amber-500",
};

const labelIcon: Record<string, string> = {
  Today: "📅",
  Pending: "⏳",
  Stored: "📦",
  Collected: "✓",
  Forgotten: "⚠",
  Capacity: "📊",
};

export default function VenueStats({
  stats,
}: {
  stats: Array<{ helper?: string; label: string; value: string; tone: Tone }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <div
          className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-sm"
          key={stat.label}
          title={stat.helper}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${iconBg[stat.tone]}`}>
            {labelIcon[stat.label] ?? "·"}
          </span>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">{stat.label}</p>
            <p className={`shrink-0 text-xl font-semibold tabular-nums ${toneClass[stat.tone]}`}>
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

