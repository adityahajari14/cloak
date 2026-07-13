-- ───────────────────────────────────────────────────────────────────────────
-- Realtime for the venue dashboard counters.
--
-- The dashboard's Stored / Collected / Capacity figures are all item-level:
-- they count rows in ticket_items, not tickets. But the dashboard was only
-- subscribed to the `tickets` table, and storing or collecting an item writes
-- to `ticket_items`.
--
-- A partial collection is the clearest case: it sets ticket_items.collected_at
-- and leaves tickets.status on 'partially_collected'. No tickets row changes,
-- so no realtime event fired, so the counters silently went stale until a full
-- page reload.
--
-- Publish both tables so the dashboard sees item-level changes as they happen.
-- Adding a table already in the publication raises, so each is guarded.
-- ───────────────────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.ticket_items;
exception
  when duplicate_object then null;  -- already published
  when undefined_object then null;  -- publication doesn't exist on this instance
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Realtime delivers the old row on UPDATE/DELETE only when the table has a
-- replica identity that includes the changed columns. FULL is the safe choice
-- here: these tables are low-volume (a few hundred rows a night) and the
-- dashboard re-queries on any event rather than diffing the payload.
alter table public.ticket_items replica identity full;
alter table public.tickets replica identity full;
