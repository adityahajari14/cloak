-- Tracks "contact customer" attempts on forgotten tickets, so staff can see
-- whether/when/how a guest was already notified their items are waiting.
create table if not exists public.ticket_contacts (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  contacted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_contacts_ticket_idx
  on public.ticket_contacts (ticket_id);

alter table public.ticket_contacts enable row level security;

drop policy if exists "ticket_contacts_select_admin" on public.ticket_contacts;
create policy "ticket_contacts_select_admin"
on public.ticket_contacts
for select
to authenticated
using (public.is_platform_admin());
