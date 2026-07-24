import { PrimaryLink, SecondaryLink } from "@/components/shared/ButtonLink";
import PageShell from "@/components/shared/PageShell";
import type { VenueDashboardData } from "@/lib/venue-dashboard";
import { deletePendingTicket, endEvent, startEvent } from "@/app/venuedashboard/actions";
import ActiveEventBanner from "./ActiveEventBanner";
import ApprovalBanner from "./ApprovalBanner";
import LiveDashboardStats, { type LiveCounts } from "./LiveDashboardStats";
import PreEventAlert from "./PreEventAlert";
import TodayTickets from "./TodayTickets";

export default function VenueDashboardPage({
  data,
  selectedVenueId,
}: {
  data: VenueDashboardData;
  selectedVenueId?: string;
}) {
  if (data.isManager) return <ManagerDashboard data={data} selectedVenueId={selectedVenueId} />;
  return <StaffDashboard data={data} />;
}

function buildInitialCounts(data: VenueDashboardData, selectedVenueId?: string): LiveCounts {
  const get = (label: string) =>
    Number(data.stats.find((s) => s.label === label)?.value ?? 0);

  const selectedVenue =
    selectedVenueId && data.venues.length > 1
      ? data.venues.find((v) => v.id === selectedVenueId)
      : undefined;

  const venueSource = selectedVenue ?? data.venue;

  return {
    bagCapacity: venueSource?.bagCapacity ?? 0,
    // Seeded from the server. These used to be hardcoded to 0, so the capacity
    // bars read "0 / 50 · 50 slots available" on every page load — even with a
    // full rail — until a realtime event happened to arrive and correct them.
    bagStored: data.storedByPool.bag,
    capacity: venueSource?.capacity ?? 0,
    collected: get("Collected"),
    forgotten: get("Forgotten"),
    hangerCapacity: venueSource?.hangerCapacity ?? 0,
    hangerStored: data.storedByPool.hanger,
    pending: get("Pending"),
    stored: get("Stored"),
    today: get("Today"),
  };
}

// ─── Staff view ────────────────────────────────────────────────────────────────

function StaffDashboard({ data }: { data: VenueDashboardData }) {
  const isLocked = data.approvalStatus !== "approved";
  return (
    <PageShell
      activePath="/venuedashboard"
      eyebrow={data.venueLabel}
      locked={isLocked}
      title="Dashboard"
      venueRole="staff"
      actions={
        isLocked ? null : <PrimaryLink href="/venuescanner">Open scanner</PrimaryLink>
      }
    >
      <ApprovalBanner />
      {/* Live events only: starting one is a manager action, so staff get the
          occupancy readout without the lifecycle controls. */}
      {data.activeEvents
        .filter((e) => e.status === "live")
        .map((e) => (
          <ActiveEventBanner event={e} key={`live-${e.id}`} onEnd={endEvent} readOnly />
        ))}
      <LiveDashboardStats
        initialCounts={buildInitialCounts(data)}
        showCapacityBar={false}
        venueId={data.venue?.id ?? null}
      />
      <TodayTickets data={data} isManager={false} onDeletePending={deletePendingTicket} />
    </PageShell>
  );
}

// ─── Manager view ───────────────────────────────────────────────────────────────

function ManagerDashboard({
  data,
  selectedVenueId,
}: {
  data: VenueDashboardData;
  selectedVenueId?: string;
}) {
  const isLocked = data.approvalStatus !== "approved";
  const activeVenueId = data.venue?.id ?? null;

  return (
    <PageShell
      activePath="/venuedashboard"
      eyebrow={data.venueLabel}
      locked={isLocked}
      title="Dashboard"
      venueRole="manager"
      actions={
        isLocked ? null : (
          <>
            <PrimaryLink href="/venuescanner">Open scanner</PrimaryLink>
            <SecondaryLink href="/smsbackup">SMS Backup</SecondaryLink>
            <a
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:border-foreground/20 hover:text-foreground"
              href="/venuesettings"
              title="Settings"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </>
        )
      }
    >
      {/* Venue switcher — only shown when managing multiple venues */}
      {data.venues.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-px">
          {data.venues.map((v) => (
            <a
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                v.id === (selectedVenueId ?? activeVenueId)
                  ? "bg-foreground text-white"
                  : "border border-line bg-white text-muted hover:border-foreground/20 hover:text-foreground"
              }`}
              href={`/venuedashboard?venueId=${v.id}`}
              key={v.id}
            >
              {v.name}
            </a>
          ))}
        </div>
      )}

      <ApprovalBanner />
      {/* Scheduled and due soon → prompt to open the doors. */}
      {data.activeEvents
        .filter((e) => e.status === "scheduled" && e.startsAt)
        .map((e) => (
          <PreEventAlert event={e} key={`pre-${e.id}`} onStart={startEvent} />
        ))}
      {/* Live → occupancy readout and the single End control. */}
      {data.activeEvents
        .filter((e) => e.status === "live")
        .map((e) => (
          <ActiveEventBanner event={e} key={`live-${e.id}`} onEnd={endEvent} />
        ))}
      <LiveDashboardStats
        initialCounts={buildInitialCounts(data, selectedVenueId)}
        showCapacityBar={!isLocked}
        venueId={activeVenueId}
      />
      <TodayTickets data={data} isManager={true} onDeletePending={deletePendingTicket} />
    </PageShell>
  );
}

