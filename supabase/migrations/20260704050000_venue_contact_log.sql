-- Tracks admin outreach emails sent to venues (billing follow-up, cancellation
-- follow-up, or custom messages) from the venue detail page, so there's a
-- history of contact attempts per venue.
create table if not exists public.venue_contacts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  subject text not null,
  message text not null,
  template text not null check (template in ('billing_followup', 'cancellation_followup', 'custom')),
  contacted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists venue_contacts_venue_idx
  on public.venue_contacts (venue_id);

alter table public.venue_contacts enable row level security;

drop policy if exists "venue_contacts_select_admin" on public.venue_contacts;
create policy "venue_contacts_select_admin"
on public.venue_contacts
for select
to authenticated
using (public.is_platform_admin());
