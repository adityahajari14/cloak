-- Cloak Club: turn a guest_contact into a permanent, venue-agnostic member.
-- Membership is identity-based, not ticket-based: a member carries a stable
-- membership token that any venue scanner can resolve. Presence of
-- membership_token_hash marks a contact as a member.

alter table public.guest_contacts
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists membership_token_hash text,
  add column if not exists member_since timestamptz;

-- Unique so a scanned membership token resolves to exactly one member.
create unique index if not exists guest_contacts_membership_token_idx
  on public.guest_contacts (membership_token_hash)
  where membership_token_hash is not null;
