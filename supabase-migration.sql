-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is additive and idempotent: no existing column or row is dropped or
-- modified, so your current tasks stay exactly as they are. Existing rows
-- simply get the new columns with sensible defaults (priority=false, the
-- rest NULL).

alter table public.tasks add column if not exists due_date   date;
alter table public.tasks add column if not exists due_time   time;             -- optional clock time
alter table public.tasks add column if not exists priority   boolean not null default false;
alter table public.tasks add column if not exists recurrence text;             -- 'daily' | 'weekly' | null
alter table public.tasks add column if not exists sort_order double precision; -- manual drag order

-- Helps the "Today"/"Scheduled" views stay quick as the list grows.
create index if not exists tasks_due_date_idx on public.tasks (due_date);

-- Note: the old `scheduled_day` text column is intentionally left in place so
-- no historical data is lost. The app no longer writes to it.
