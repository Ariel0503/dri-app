-- ============================================================================
--  TRANSFORMATION READINESS — SUPABASE SCHEMA + RLS
--  Safe to run multiple times (idempotent). Recursion-safe profiles policies.
--  Run top-to-bottom in the SQL editor.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- 1. ENUMS (guarded so re-runs don't error) -----------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin','editor','viewer'); end if;
  if not exists (select 1 from pg_type where typname = 'brick_scope') then
    create type brick_scope as enum ('wave','offer'); end if;
  if not exists (select 1 from pg_type where typname = 'severity_level') then
    create type severity_level as enum ('critical','high','medium','low'); end if;
  if not exists (select 1 from pg_type where typname = 'obstacle_status') then
    create type obstacle_status as enum ('open','in-progress','resolved'); end if;
end $$;

-- ---------- 2. PROFILES (auth) ----------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       app_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- Helper functions are SECURITY DEFINER -> they bypass RLS, so using them
-- inside a policy on `profiles` does NOT cause infinite recursion.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function can_write()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','editor'));
$$;

-- ---------- 3. SETTINGS ENTITIES (Module 5) ---------------------------------
create table if not exists programme (
  id uuid primary key default gen_random_uuid(), name text not null,
  description text, updated_at timestamptz not null default now());

create table if not exists regions (
  id uuid primary key default gen_random_uuid(), name text not null, sort_order int not null default 0);
create unique index if not exists regions_name_unique on regions (lower(name));

create table if not exists countries (
  id uuid primary key default gen_random_uuid(), name text not null,
  region_id uuid references regions(id) on delete set null, flag_image text, iso_code text);
create unique index if not exists countries_name_unique on countries (lower(name));

create table if not exists waves (
  id uuid primary key default gen_random_uuid(), name text not null,
  deadline date, sort_order int not null default 0);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(), name text not null, short_code text);

create table if not exists business_units (
  id uuid primary key default gen_random_uuid(), name text not null, sort_order int not null default 0);

create table if not exists offer_business_units (
  offer_id uuid references offers(id) on delete cascade,
  bu_id    uuid references business_units(id) on delete cascade,
  primary key (offer_id, bu_id));

create table if not exists wave_countries (
  wave_id    uuid references waves(id) on delete cascade,
  country_id uuid references countries(id) on delete cascade,
  primary key (wave_id, country_id));

create table if not exists offer_waves (
  offer_id uuid references offers(id) on delete cascade,
  wave_id  uuid references waves(id) on delete cascade,
  primary key (offer_id, wave_id));

create table if not exists wave_assignments (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  wave_id    uuid not null references waves(id) on delete cascade,
  go_live_date date, unique (country_id, wave_id));

create table if not exists wave_assignment_deliveries (
  assignment_id uuid references wave_assignments(id) on delete cascade,
  bu_id uuid references business_units(id) on delete cascade,
  primary key (assignment_id, bu_id));

-- ---------- 4. ENABLERS + BLOCKS & BRICKS (Module 3) ------------------------
create table if not exists dependencies (
  id uuid primary key default gen_random_uuid(), label text not null,
  color text not null default '#6366F1', weight numeric not null default 1 check (weight >= 0));

-- A block is defined at WAVE level OR OFFER level
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  dependency_id uuid references dependencies(id) on delete cascade,
  name text not null, weight numeric not null default 0,
  scope_level brick_scope not null default 'wave');

create table if not exists bricks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks(id) on delete cascade,
  name text not null, sort_order int not null default 0);

-- Where a block applies: exactly one of wave_id / offer_id matches its level
create table if not exists block_assignments (
  id uuid primary key default gen_random_uuid(),
  block_id   uuid not null references blocks(id) on delete cascade,
  wave_id    uuid references waves(id) on delete cascade,
  offer_id   uuid references offers(id) on delete cascade,
  country_id uuid references countries(id) on delete cascade,
  check ((wave_id is not null) <> (offer_id is not null)));

create table if not exists brick_checks (
  country_id uuid references countries(id) on delete cascade,
  brick_id   uuid references bricks(id) on delete cascade,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  primary key (country_id, brick_id));

-- ---------- 5. OBSTACLES / RISKS (Module 2) ---------------------------------
create table if not exists obstacles (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  dependency_id uuid references dependencies(id) on delete set null,
  severity severity_level not null default 'high',
  status obstacle_status not null default 'open',
  owner text, resolution text, created_at timestamptz not null default now());

create table if not exists obstacle_countries (
  obstacle_id uuid references obstacles(id) on delete cascade,
  country_id  uuid references countries(id) on delete cascade,
  primary key (obstacle_id, country_id));

create table if not exists obstacle_waves (
  obstacle_id uuid references obstacles(id) on delete cascade,
  wave_id     uuid references waves(id) on delete cascade,
  primary key (obstacle_id, wave_id));

-- Dependency map: which OTHER obstacles this one blocks
create table if not exists obstacle_impacts (
  obstacle_id uuid references obstacles(id) on delete cascade,
  blocked_obstacle_id uuid references obstacles(id) on delete cascade,
  primary key (obstacle_id, blocked_obstacle_id),
  check (obstacle_id <> blocked_obstacle_id));

create table if not exists obstacle_blocks (
  obstacle_id uuid references obstacles(id) on delete cascade,
  block_id    uuid references blocks(id) on delete cascade,
  primary key (obstacle_id, block_id));

-- ============================================================================
--  6. ROW-LEVEL SECURITY  (enable is idempotent; policies are dropped first)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programme','regions','countries','waves','offers','business_units',
    'offer_business_units','wave_countries','offer_waves',
    'wave_assignments','wave_assignment_deliveries',
    'dependencies','blocks','bricks','block_assignments','brick_checks',
    'obstacles','obstacle_countries','obstacle_waves','obstacle_impacts','obstacle_blocks'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- profiles: read own row (or admin reads all); update own row only
drop policy if exists "profiles_read"   on profiles;
drop policy if exists "profiles_update" on profiles;
create policy "profiles_read"   on profiles for select to authenticated
  using ( id = auth.uid() or public.is_admin() );
create policy "profiles_update" on profiles for update to authenticated
  using ( id = auth.uid() ) with check ( id = auth.uid() );

-- every data table: read for any signed-in user, write for admin/editor
do $$
declare t text;
begin
  foreach t in array array[
    'programme','regions','countries','waves','offers','business_units',
    'offer_business_units','wave_countries','offer_waves',
    'wave_assignments','wave_assignment_deliveries',
    'dependencies','blocks','bricks','block_assignments','brick_checks',
    'obstacles','obstacle_countries','obstacle_waves','obstacle_impacts','obstacle_blocks'
  ] loop
    execute format('drop policy if exists "auth_read" on %I;', t);
    execute format('drop policy if exists "editor_write" on %I;', t);
    execute format('create policy "auth_read" on %I for select to authenticated using (true);', t);
    execute format('create policy "editor_write" on %I for insert, update, delete to authenticated
       using (true) with check (public.can_write());', t);
  end loop;
end $$;

-- ============================================================================
--  7. PROMOTE YOUR FIRST ADMIN (run AFTER signing up once with this email)
-- ============================================================================
-- update profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
--  TRANSFORMATION READINESS — SCHEMA ADDITIONS
--  Run AFTER the main schema. Safe to run multiple times (idempotent).
--  Two changes the new save logic needs:
--    1. brick_checks must be per (country, wave, brick) — readiness is per wave.
--    2. brick_exclusions lets a brick be dropped from one wave/offer only.
-- ============================================================================

-- ---------- 1. brick_checks: add wave_id and make it part of the PK ----------
alter table brick_checks add column if not exists wave_id uuid references waves(id) on delete cascade;

do $$
begin
  -- Drop the old (country_id, brick_id) PK if that's what's there, then recreate
  -- as (country_id, wave_id, brick_id). Guarded so re-runs don't error.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'brick_checks'::regclass and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (country_id, brick_id)'
  ) then
    alter table brick_checks drop constraint brick_checks_pkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'brick_checks'::regclass and contype = 'p'
  ) then
    -- Existing rows with NULL wave_id would block the PK; clear them first.
    delete from brick_checks where wave_id is null;
    alter table brick_checks add primary key (country_id, wave_id, brick_id);
  end if;
end $$;

-- ---------- 2. brick_exclusions: brick removed from a single wave/offer -------
create table if not exists brick_exclusions (
  brick_id uuid not null references bricks(id) on delete cascade,
  scope_id uuid not null,            -- a wave_id OR an offer_id (matches the block's level)
  primary key (brick_id, scope_id)
);

-- ---------- 3. RLS for the new table (read all / write admin+editor) ---------
alter table brick_exclusions enable row level security;

drop policy if exists "auth_read"   on brick_exclusions;
drop policy if exists "editor_write" on brick_exclusions;
create policy "auth_read"   on brick_exclusions for select to authenticated using (true);
create policy "editor_write" on brick_exclusions for all to authenticated
  using (public.can_write()) with check (public.can_write());
-- ============================================================================
--  TRANSFORMATION READINESS — RLS WRITE-POLICY FIX
--  Run AFTER the main schema. Safe to run multiple times (idempotent).
--
--  Why: the main schema creates the write policy with
--       `for insert, update, delete` — Postgres CREATE POLICY accepts only ONE
--       command (ALL | SELECT | INSERT | UPDATE | DELETE), so that statement
--       errors and the editor_write policy is never created. With RLS enabled
--       and only a select policy present, ALL writes (Save AND Excel import)
--       are denied by default. This recreates the policy correctly as `for all`.
--
--  Reads stay open to any signed-in user (auth_read). Writes require can_write()
--  (admin/editor). can_write() is SECURITY DEFINER, so it bypasses RLS and does
--  NOT cause recursion when referenced inside these policies.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'programme','regions','countries','waves','offers','business_units',
    'offer_business_units','wave_countries','offer_waves',
    'wave_assignments','wave_assignment_deliveries',
    'dependencies','blocks','bricks','block_assignments','brick_checks',
    'obstacles','obstacle_countries','obstacle_waves','obstacle_impacts','obstacle_blocks'
  ] loop
    -- read: any authenticated user
    execute format('drop policy if exists "auth_read" on %I;', t);
    execute format('create policy "auth_read" on %I for select to authenticated using (true);', t);

    -- write: admin/editor only. `for all` covers insert/update/delete in one
    -- valid policy; using() gates update/delete rows, with check() gates
    -- inserted/updated rows. Both are can_write(), so a viewer is blocked at the
    -- DELETE too (important: the import's delete-then-insert replace can't wipe a
    -- table for a viewer, because the delete itself is denied).
    execute format('drop policy if exists "editor_write" on %I;', t);
    execute format(
      'create policy "editor_write" on %I for all to authenticated
         using (public.can_write()) with check (public.can_write());', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Verify (optional): one editor_write row per table above.
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, policyname;
-- ----------------------------------------------------------------------------


-- brick_exclusions
grant select, insert, update, delete on table public.brick_exclusions to authenticated;
alter table public.brick_exclusions enable row level security;

-- App write (insert/update/delete) for authenticated users
drop policy if exists brick_exclusions_app_write on public.brick_exclusions;
create policy brick_exclusions_app_write
on public.brick_exclusions
for all
to authenticated
using (can_write())
with check (can_write());

-- Excel import write (allow import writes as authenticated)
drop policy if exists brick_exclusions_excel_import_write on public.brick_exclusions;
create policy brick_exclusions_excel_import_write
on public.brick_exclusions
for all
to authenticated
using (true)
with check (true);



-- offer_business_units
grant select, insert, update, delete on table public.offer_business_units to authenticated;
alter table public.offer_business_units enable row level security;

-- App write
drop policy if exists offer_business_units_app_write on public.offer_business_units;
create policy offer_business_units_app_write
on public.offer_business_units
for all
to authenticated
using (can_write())
with check (can_write());

-- Excel import write
drop policy if exists offer_business_units_excel_import_write on public.offer_business_units;
create policy offer_business_units_excel_import_write
on public.offer_business_units
for all
to authenticated
using (true)
with check (true);



-- wave_assignment_deliveries
grant select, insert, update, delete on table public.wave_assignment_deliveries to authenticated;
alter table public.wave_assignment_deliveries enable row level security;

-- App write
drop policy if exists wave_assignment_deliveries_app_write on public.wave_assignment_deliveries;
create policy wave_assignment_deliveries_app_write
on public.wave_assignment_deliveries
for all
to authenticated
using (can_write())
with check (can_write());

-- Excel import write
drop policy if exists wave_assignment_deliveries_excel_import_write on public.wave_assignment_deliveries;
create policy wave_assignment_deliveries_excel_import_write
on public.wave_assignment_deliveries
for all
to authenticated
using (true)
with check (true);
-- ============================================================================
--  TRANSFORMATION READINESS — UPSERT PREP
--  Run AFTER the main schema. Safe to run multiple times (idempotent).
--
--  Why: the app now writes with upsert + prune-stale instead of delete-then-
--  insert. Every target table already has a usable natural key EXCEPT
--  block_assignments, whose primary key is a synthetic `id`. The app keys block
--  scope by block_id (one scope row per block), so we add UNIQUE(block_id) to
--  give the upsert a conflict target.
-- ============================================================================

-- De-dupe first (keep one row per block_id) so the unique index can be created
-- even if older delete-then-insert runs left duplicates behind.
delete from public.block_assignments a
using  public.block_assignments b
where  a.block_id = b.block_id
  and  a.ctid     < b.ctid;

create unique index if not exists block_assignments_block_id_key
  on public.block_assignments (block_id);

-- ----------------------------------------------------------------------------
-- Note: other link tables (offer_business_units, wave_countries, offer_waves,
-- brick_exclusions, brick_checks, obstacle_*) already have composite PRIMARY
-- KEYs, which the upsert uses as its conflict target — no change needed.
-- ----------------------------------------------------------------------------
-- ============================================================================
--  TRANSFORMATION READINESS — DROP NAME-UNIQUE INDEXES
--  Run AFTER the main schema. Safe to run multiple times (idempotent).
--
--  Why: the app upserts entities ON CONFLICT (id) and reconciles removals by
--  pruning ids no longer present. regions and countries also carry a SEPARATE
--  unique index on lower(name). When a row arrives with a NEW id but an
--  EXISTING name, the id-conflict rule doesn't apply, Postgres tries a plain
--  INSERT, and the name index raises 409 Conflict. Identity in this app is the
--  UUID, so the name-unique index is what breaks saves — drop it.
--
--  No data loss: this only removes the indexes. After the next successful Save,
--  the upsert+prune in sync() reconciles to exactly the in-memory set, so any
--  duplicate-name rows left from earlier attempts are pruned automatically.
-- ============================================================================

drop index if exists public.regions_name_unique;
drop index if exists public.countries_name_unique;
drop index if exists public.blocks_name_unique;
drop index if exists public.bricks_name_unique;
drop index if exists public.blocks_assignments_name_unique;

-- ----------------------------------------------------------------------------
-- Verify (optional): neither index should appear.
--   select indexname from pg_indexes
--   where schemaname = 'public'
--     and indexname in ('regions_name_unique','countries_name_unique');
-- ----------------------------------------------------------------------------
