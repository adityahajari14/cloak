-- Add the 'forgotten' status: a ticket whose event ended before the guest
-- collected their items (whether they were never activated, actively stored,
-- or partially collected). Must be in its own migration: Postgres forbids
-- using a newly added enum value in the same transaction that adds it.
alter type public.ticket_status add value if not exists 'forgotten' before 'cancelled';
