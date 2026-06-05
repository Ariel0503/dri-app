-- ============================================================================
--  TRANSFORMATION READINESS — SUPABASE SCHEMA + ROW-LEVEL SECURITY
--  Covers all 5 modules + settings entities. Dates stored as DATE (ISO);
--  format as dd/mm/yyyy in the UI only. Run top-to-bottom in the SQL editor.
-- ============================================================================

-- ---------- 0. EXTENSIONS ---------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------- 1. ACCESS MODEL (auth) -----------------------------------------
-- Roles: 'admin' (full), 'editor' (read+write), 'viewer' (read only)
create type app_role as enum ('admin', 'editor', 'viewer');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        app_role not null default 'viewer',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: can the current user write? (admin or editor)
create or replace function can_write()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','editor')
  );
$$;

-- ---------- 2. SETTINGS ENTITIES (Module 5) --------------------------------
create table programme (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  updated_at   timestamptz not null default now()
);

create table regions (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  sort_order int  not null default 0
);

create table countries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region_id   uuid references regions(id) on delete set null,
  flag_image  text,                       -- base64 / URL of custom flag
  iso_code    text
);
create unique index countries_name_unique on countries (lower(name));

create table waves (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  deadline    date,                        -- wave deadline / go-live target
  sort_order  int not null default 0
);

create table offers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_code  text                          -- e.g. 'SP'
);

create table business_units (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int not null default 0
);

-- Many-to-many mappings (Settings -> Mappings)
create table offer_business_units (
  offer_id uuid references offers(id) on delete cascade,
  bu_id    uuid references business_units(id) on delete cascade,
  primary key (offer_id, bu_id)
);

create table wave_countries (
  wave_id    uuid references waves(id) on delete cascade,
  country_id uuid references countries(id) on delete cascade,
  primary key (wave_id, country_id)
);

create table offer_waves (
  offer_id uuid references offers(id) on delete cascade,
  wave_id  uuid references waves(id) on delete cascade,
  primary key (offer_id, wave_id)
);

-- Per-country wave assignment with its own go-live date (dd/mm/yyyy in UI)
create table wave_assignments (
  id           uuid primary key default gen_random_uuid(),
  country_id   uuid not null references countries(id) on delete cascade,
  wave_id      uuid not null references waves(id) on delete cascade,
  go_live_date date,
  unique (country_id, wave_id)
);

-- Which BUs are delivered in a given country/wave assignment
create table wave_assignment_deliveries (
  assignment_id uuid references wave_assignments(id) on delete cascade,
  bu_id         uuid references business_units(id) on delete cascade,
  primary key (assignment_id, bu_id)
);

-- ---------- 3. DEPENDENCIES / ENABLERS + BLOCKS & BRICKS (Module 3) --------
create table dependencies (             -- "enablers", weighted
  id        uuid primary key default gen_random_uuid(),
  label     text not null,
  color     text not null default '#6366F1',
  weight    numeric not null default 1 check (weight >= 0)
);

-- A block can be defined at WAVE level OR OFFER level (your new requirement)
create type brick_scope as enum ('wave', 'offer');

create table blocks (
  id            uuid primary key default gen_random_uuid(),
  dependency_id uuid not null references dependencies(id) on delete cascade,
  name          text not null,
  scope_level   brick_scope not null default 'wave'   -- wave OR offer
);

create table bricks (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references blocks(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0
);

-- Where a block applies. For scope_level='wave' use wave_id; for 'offer' use
-- offer_id. country_id optional (NULL = applies to all countries in scope).
create table block_assignments (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references blocks(id) on delete cascade,
  wave_id    uuid references waves(id) on delete cascade,
  offer_id   uuid references offers(id) on delete cascade,
  country_id uuid references countries(id) on delete cascade,
  -- enforce that exactly one of wave/offer matches the block's level:
  check ( (wave_id is not null) <> (offer_id is not null) )
);

-- Per-country completion of each brick (drives the readiness %)
create table brick_checks (
  country_id uuid references countries(id) on delete cascade,
  brick_id   uuid references bricks(id) on delete cascade,
  checked    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  primary key (country_id, brick_id)
);

-- ---------- 4. OBSTACLES / RISKS (Module 2) --------------------------------
create type severity_level as enum ('critical','high','medium','low');
create type obstacle_status as enum ('open','in-progress','resolved');

create table obstacles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  dependency_id uuid references dependencies(id) on delete set null,
  severity      severity_level not null default 'high',
  status        obstacle_status not null default 'open',
  owner         text,                      -- each obstacle has an owner
  resolution    text,                      -- resolution path
  created_at    timestamptz not null default now()
);

create table obstacle_countries (
  obstacle_id uuid references obstacles(id) on delete cascade,
  country_id  uuid references countries(id) on delete cascade,
  primary key (obstacle_id, country_id)
);

create table obstacle_waves (
  obstacle_id uuid references obstacles(id) on delete cascade,
  wave_id     uuid references waves(id) on delete cascade,
  primary key (obstacle_id, wave_id)
);

-- Dependency map: which OTHER obstacles this one blocks (self-referencing)
create table obstacle_impacts (
  obstacle_id        uuid references obstacles(id) on delete cascade,  -- the blocker
  blocked_obstacle_id uuid references obstacles(id) on delete cascade, -- what it blocks
  primary key (obstacle_id, blocked_obstacle_id),
  check (obstacle_id <> blocked_obstacle_id)
);

-- Which blocks an obstacle is tied to (Module 3 link)
create table obstacle_blocks (
  obstacle_id uuid references obstacles(id) on delete cascade,
  block_id    uuid references blocks(id) on delete cascade,
  primary key (obstacle_id, block_id)
);

-- ============================================================================
--  5. ROW-LEVEL SECURITY
--  Pattern: every authenticated user can READ; only admins/editors can WRITE.
--  Profiles: a user reads/updates their own row; admins manage everyone.
-- ============================================================================

-- Enable RLS everywhere
alter table profiles                    enable row level security;
alter table programme                   enable row level security;
alter table regions                     enable row level security;
alter table countries                   enable row level security;
alter table waves                       enable row level security;
alter table offers                      enable row level security;
alter table business_units              enable row level security;
alter table offer_business_units        enable row level security;
alter table wave_countries              enable row level security;
alter table offer_waves                 enable row level security;
alter table wave_assignments            enable row level security;
alter table wave_assignment_deliveries  enable row level security;
alter table dependencies                enable row level security;
alter table blocks                      enable row level security;
alter table bricks                      enable row level security;
alter table block_assignments           enable row level security;
alter table brick_checks                enable row level security;
alter table obstacles                   enable row level security;
alter table obstacle_countries          enable row level security;
alter table obstacle_waves              enable row level security;
alter table obstacle_impacts            enable row level security;
alter table obstacle_blocks             enable row level security;

-- ---- profiles ----
create policy "read own or admin reads all" on profiles
  for select to authenticated
  using ( id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') );

create policy "update own profile" on profiles
  for update to authenticated
  using ( id = auth.uid() )
  with check ( id = auth.uid() and role = (select role from profiles where id = auth.uid()) );
  -- ^ prevents a user from self-promoting their role; admins change roles via service key.

-- ---- generic read-for-all-authenticated + write-for-editors ----
-- Apply the same two policies to every data table.
do $$
declare t text;
begin
  foreach t in array array[
    'programme','regions','countries','waves','offers','business_units',
    'offer_business_units','wave_countries','offer_waves',
    'wave_assignments','wave_assignment_deliveries',
    'dependencies','blocks','bricks','block_assignments','brick_checks',
    'obstacles','obstacle_countries','obstacle_waves','obstacle_impacts','obstacle_blocks'
  ]
  loop
    execute format(
      'create policy "auth read" on %I for select to authenticated using (true);', t);
    execute format(
      'create policy "editor write" on %I for all to authenticated
         using (public.can_write()) with check (public.can_write());', t);
  end loop;
end$$;

-- ============================================================================
--  6. SEED A FIRST ADMIN (run AFTER you have signed up once)
--  Replace the email with the account that should own the programme.
-- ============================================================================
-- update profiles set role = 'admin' where email = 'you@example.com';
