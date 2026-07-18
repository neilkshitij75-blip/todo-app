-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is additive and idempotent: no existing column or row is dropped or
-- modified, so your current tasks stay exactly as they are. Existing rows
-- simply get the new columns with sensible defaults.

-- v1: due dates, priority, simple recurrence, manual order
alter table public.tasks add column if not exists due_date   date;
alter table public.tasks add column if not exists due_time   time;             -- start time for tasks/events
alter table public.tasks add column if not exists priority   boolean not null default false;
alter table public.tasks add column if not exists recurrence text;             -- legacy simple recurrence ('daily'|'weekly')
alter table public.tasks add column if not exists sort_order double precision; -- manual drag order

-- v2: agenda app — item types, details, tags, events, buckets, rich recurrence
alter table public.tasks add column if not exists type     text not null default 'task';   -- 'task' | 'event' | 'note'
alter table public.tasks add column if not exists notes    text;                            -- freeform body / description
alter table public.tasks add column if not exists subtasks jsonb not null default '[]'::jsonb; -- [{id,text,done}]
alter table public.tasks add column if not exists tags     text[] not null default '{}';    -- freeform labels
alter table public.tasks add column if not exists end_time time;                             -- event end time
alter table public.tasks add column if not exists someday  boolean not null default false;  -- someday/maybe bucket
alter table public.tasks add column if not exists recur    jsonb;                            -- {freq,interval,until} rich recurrence

-- Indexes for the views that filter a lot.
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_type_idx     on public.tasks (type);

-- Note: the old `scheduled_day` text column is intentionally left in place so
-- no historical data is lost. The app no longer writes to it.
