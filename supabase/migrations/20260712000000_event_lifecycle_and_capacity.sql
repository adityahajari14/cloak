-- ───────────────────────────────────────────────────────────────────────────
-- Event lifecycle + guest capacity.
--
-- Events previously had a single `active` boolean as their source of truth,
-- and starts_at/ends_at were written but never read by any logic. This gives
-- them a real lifecycle:
--
--   scheduled — created and shareable, NOT accepting check-ins
--   live      — manager pressed Start; guests can check in
--   ended     — manager pressed End; uncollected tickets flagged forgotten
--
-- `active` is retained and derived from the status by a trigger, so every
-- existing reader (RLS policies, getActiveEventsForVenue, isEventValidForVenue)
-- keeps working untouched.
--
-- starts_at / ends_at  = the SCHEDULE (planned; drives the 10-min start prompt)
-- started_at / ended_at = what ACTUALLY happened
-- ───────────────────────────────────────────────────────────────────────────

do $$
begin
  create type public.event_status as enum ('scheduled', 'live', 'ended');
exception
  when duplicate_object then null;
end $$;

alter table public.events
  add column if not exists status public.event_status not null default 'scheduled',
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists guest_capacity integer;

-- Guest capacity is the number of guests who may be holding items AT ONCE.
-- It is live occupancy, not total admissions: a fully collected ticket frees
-- its slot. NULL means unlimited, which is the default so existing events and
-- venues that don't care are unaffected.
--
-- This is distinct from venues.hanger_capacity / bag_capacity, which count
-- physical storage slots. One guest occupies one event slot however many items
-- they check in.
do $$
begin
  alter table public.events
    add constraint events_guest_capacity_positive
    check (guest_capacity is null or guest_capacity > 0);
exception
  when duplicate_object then null;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Backfill: map the old boolean onto the new lifecycle.
-- An event that was active was, in the old model, accepting check-ins → live.
-- An event that was inactive had been closed → ended.
-- started_at is seeded so historical events display sensibly on the dashboard.
-- ───────────────────────────────────────────────────────────────────────────
update public.events
set status = case when active then 'live'::public.event_status
                  else 'ended'::public.event_status end,
    started_at = coalesce(started_at, starts_at, created_at),
    ended_at = case when active then ended_at else coalesce(ended_at, ends_at) end
where status = 'scheduled';

-- ───────────────────────────────────────────────────────────────────────────
-- Keep `active` in lockstep with `status`. This is what lets every existing
-- query that filters on `active = true` keep working without being rewritten:
-- it now transparently means "status = live".
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.sync_event_active()
returns trigger
language plpgsql
as $$
begin
  new.active := (new.status = 'live');
  return new;
end;
$$;

drop trigger if exists events_sync_active on public.events;
create trigger events_sync_active
before insert or update on public.events
for each row execute function public.sync_event_active();

-- Re-derive `active` for the rows backfilled above.
update public.events set status = status;

create index if not exists events_venue_status_idx
  on public.events (venue_id, status);
