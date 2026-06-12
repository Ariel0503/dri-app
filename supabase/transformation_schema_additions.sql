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
