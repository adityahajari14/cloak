import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccountData, checkAccountAccess, type CustomerTicket } from "./actions";
import AccountEditForm from "./AccountEditForm";
import AccountSignOutButton from "./AccountSignOutButton";
import CloakClubCard from "./CloakClubCard";
import PastTicketsToggle from "./PastTicketsToggle";

function statusLabel(status: string) {
  switch (status) {
    case "pending_activation": return "Awaiting activation";
    case "active": return "Stored";
    case "partially_collected": return "Partially collected";
    // Guests see "forgotten" the same as an active ticket — the items are
    // still stored, "forgotten" is a staff-only operational flag.
    case "forgotten": return "Stored";
    case "collected": return "Collected";
    case "cancelled": return "Cancelled";
    case "expired": return "Expired";
    default: return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "active": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "partially_collected": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "forgotten": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending_activation": return "bg-amber-50 text-amber-700 border-amber-200";
    case "collected": return "bg-zinc-100 text-zinc-600 border-zinc-200";
    default: return "bg-red-50 text-red-600 border-red-200";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default async function AccountPage() {
  const access = await checkAccountAccess();
  if (access === "unauthenticated") redirect("/?signin=1");
  if (access === "admin") redirect("/masterdashboard");
  if (access === "venue") redirect("/venuedashboard");

  const data = await getAccountData();
  if (!data) redirect("/?signin=1");

  const openStatuses = ["active", "partially_collected", "pending_activation", "forgotten"];
  const active = data.tickets.filter((t) => openStatuses.includes(t.status));
  const past = data.tickets.filter((t) => !openStatuses.includes(t.status));

  const initials = data.fullName
    ? data.fullName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : data.email[0].toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link className="flex items-center gap-2.5" href="/">
            <img alt="Cloak" className="h-8 w-8 rounded-lg object-cover" src="/images/cloak-logo.png" />
            <span className="text-sm font-semibold text-foreground">Cloak</span>
          </Link>
          <AccountSignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="grid gap-6">

          {/* Profile hero */}
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            {/* Top banner */}
            <div className="h-20 bg-zinc-950" />
            <div className="px-5 pb-5">
              {/* Avatar overlapping banner */}
              <div className="-mt-8 mb-4 flex items-end justify-between">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-4 border-white bg-foreground text-base font-bold text-white shadow-sm">
                  {initials}
                </div>
                <AccountSignOutButton />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{data.fullName ?? "No name set"}</p>
                <p className="text-sm text-muted">{data.email}</p>
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <AccountEditForm fullName={data.fullName} phone={data.phone} />
              </div>
            </div>
          </div>

          {/* Cloak Club membership */}
          <CloakClubCard memberSince={data.cloakClubMemberSince} />

          {/* Active tickets */}
          {active.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Active passes</p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {active.length}
                </span>
              </div>
              <div className="grid gap-3">
                {active.map((t) => (
                  <TicketCard key={t.ticketId} ticket={t} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.tickets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-2xl">
                🎫
              </div>
              <p className="font-semibold text-foreground">No passes yet</p>
              <p className="mt-1 text-sm text-muted">Your cloakroom passes will appear here after your first check-in.</p>
              <Link
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
                href="/customer-signup"
              >
                Get your first pass
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          )}

          {/* Past tickets toggle */}
          {past.length > 0 && (
            <PastTicketsToggle past={past} />
          )}

        </div>
      </main>
    </div>
  );
}

export function TicketCard({ ticket }: { ticket: CustomerTicket }) {
  const isActive = ticket.status === "active" || ticket.status === "forgotten";
  const isPending = ticket.status === "pending_activation";

  return (
    <Link
      className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-white p-4 shadow-sm transition hover:border-foreground/20 hover:shadow"
      href={`/ticket?code=${encodeURIComponent(ticket.ticketId)}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
          isActive ? "bg-emerald-50 text-emerald-700" : isPending ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"
        }`}>
          {isActive ? "✓" : isPending ? "⏳" : "↩"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{ticket.venueName}</p>
          <p className="mt-0.5 text-xs text-muted">
            {ticket.itemType ?? "Items"} · {formatDate(ticket.createdAt)}
          </p>
          {ticket.storageLocation && (
            <p className="mt-0.5 font-mono text-xs font-bold text-foreground">{ticket.storageLocation}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor(ticket.status)}`}>
          {statusLabel(ticket.status)}
        </span>
        <span className="font-mono text-[10px] text-muted">{ticket.ticketId}</span>
      </div>
    </Link>
  );
}
