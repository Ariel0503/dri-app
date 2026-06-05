-- Single key-value table. Each row holds one collection as JSON
-- e.g. key='dri8:countries', value=[ ...the countries array... ]

create table if not exists public.app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security.
alter table public.app_state enable row level security;

-- SIMPLE START: allow anyone with the anon key to read/write.
-- Good for an internal tool behind a private deployment.
-- Tighten later by requiring auth (see README "Securing it").
create policy "anon full access"
  on public.app_state
  for all
  using (true)
  with check (true);