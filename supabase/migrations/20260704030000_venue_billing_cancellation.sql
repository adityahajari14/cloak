-- Venue subscription cancellation support.
--
-- Every venue commits to a 1-year minimum term from signup (created_at),
-- regardless of billing cadence. billing_cadence records how they pay
-- (monthly vs annual), which determines how a cancellation request resolves
-- to an actual service-end date (see src/lib/billing.ts for the policy logic).
--
-- Existing venues predate this column and default to 'monthly' — the safest
-- assumption since the signup pricing toggle defaults to Monthly.
alter table public.venues
  add column if not exists billing_cadence text not null default 'monthly'
    check (billing_cadence in ('monthly', 'annual')),
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists cancellation_pay_remainder boolean not null default false;
