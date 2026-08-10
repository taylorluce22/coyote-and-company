-- ============================================================
-- Agency OS · Money layer — Sonoran Clinical Partners
-- ============================================================
-- Run ONCE in the same Supabase project as schema.sql:
--   Dashboard → SQL Editor → New query → paste → Run.
-- Uses the same env keys the app already reads (SUPABASE_URL /
-- SUPABASE_SERVICE_ROLE) — nothing new to configure in Vercel.
--
-- House rules (same as schema.sql): workspace-namespaced, flat
-- indexed columns for what we filter on + full record in jsonb,
-- RLS ON with no public policies (server-only via service_role),
-- idempotent — safe to re-run.
-- ============================================================

-- ---- agreements — supplier compensation terms ----
-- Commission only computes from status='signed_active' rows whose
-- window covers the collection date (gate G7 as arithmetic — see
-- lib/agencyMoney.mjs). Draft rows record verbal terms honestly
-- without letting them count.
create table if not exists public.agency_agreements (
  id             uuid primary key default gen_random_uuid(),
  workspace      text not null default 'agency',
  supplier       text not null,
  status         text not null default 'draft',   -- draft | signed_active | expired | terminated
  commission_pct numeric not null default 0,      -- 0.03 = 3%
  meeting_fee    numeric not null default 0,
  effective      date,
  end_date       date,
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists agency_agr_ws_supplier on public.agency_agreements (workspace, supplier);

-- ---- meetings — qualified meetings held (pay-on-performance fees) ----
create table if not exists public.agency_meetings (
  id         uuid primary key default gen_random_uuid(),
  workspace  text not null default 'agency',
  supplier   text not null,
  buyer      text not null,
  held_on    date not null,
  fee        numeric not null default 0,          -- fee snapshot at booking
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agency_mtg_ws_date on public.agency_meetings (workspace, held_on desc);

-- ---- collections — supplier-reported collected revenue (commission basis) ----
create table if not exists public.agency_collections (
  id                uuid primary key default gen_random_uuid(),
  workspace         text not null default 'agency',
  supplier          text not null,
  buyer             text not null,
  amount            numeric not null,
  collected_on      date not null,
  commission_paid_at date,                        -- null until the supplier pays our commission
  data              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists agency_col_ws_date on public.agency_collections (workspace, collected_on desc);

-- RLS on, no policies: anon key reads/writes nothing; server uses service_role.
alter table public.agency_agreements enable row level security;
alter table public.agency_meetings   enable row level security;
alter table public.agency_collections enable row level security;

-- ---- seed: the real current state (idempotent) ----
-- ProRx verbal terms from the 8/7 call: 3% of collected revenue on
-- introduced customers, no meeting fee. Recorded as DRAFT — it is a
-- verbal understanding, not a signed agreement, so it attributes no
-- commission until the status flips to signed_active. That is the
-- honest state of the world, not a placeholder.
insert into public.agency_agreements (workspace, supplier, status, commission_pct, meeting_fee, effective, data)
select 'agency', 'ProRx', 'draft', 0.03, 0, '2026-08-07',
       '{"note":"verbal terms from 8/7 call with Dave Dugas; recap emailed 8/8; not signed"}'::jsonb
where not exists (select 1 from public.agency_agreements where workspace = 'agency' and supplier = 'ProRx');
