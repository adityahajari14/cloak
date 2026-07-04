-- Demo requests need a country so the admin dashboard can filter metrics by
-- country alongside venues. Existing leads predate this field and stay null
-- (counted only in the "Total" view, not any specific country).
alter table public.leads
  add column if not exists country text;
