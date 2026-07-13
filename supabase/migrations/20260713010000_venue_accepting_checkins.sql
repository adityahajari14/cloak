-- ───────────────────────────────────────────────────────────────────────────
-- "Venue Active — accept new check-ins": a manager-controlled pause switch.
--
-- Deliberately NOT a reuse of venues.active. That column is the platform's:
-- it's constrained against billing status (venues_active_requires_billing) and
-- is how an admin suspends a venue. A manager flipping it would collide with
-- billing enforcement and could put the row in a state the constraint rejects.
--
-- This is a separate, softer switch the venue owns: the cloakroom is full, or
-- the counter is unstaffed, or the night is over, so stop taking new guests —
-- without touching the venue's account standing.
--
-- Defaults to true so every existing venue keeps accepting check-ins.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.venues
  add column if not exists accepting_checkins boolean not null default true;

comment on column public.venues.accepting_checkins is
  'Manager-controlled: whether the venue is currently taking new guest check-ins. Distinct from `active`, which is platform/billing-controlled.';
