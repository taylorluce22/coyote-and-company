-- ============================================================
-- Farmhand · Agentic OS — Shared Memory Layer schema
-- ============================================================
-- Run this ONCE in your Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Then set these env vars in Vercel (Project → Settings → Env Vars):
--   SUPABASE_URL           https://<project-ref>.supabase.co
--   SUPABASE_SERVICE_ROLE  (Settings → API → service_role key — SECRET)
--   SUPABASE_ANON_KEY      (Settings → API → anon/public key)
-- Redeploy. The app auto-detects the keys and the Connectors card flips green.
--
-- Design notes
-- • Every table is namespaced by `workspace` ('default' = realtor test user,
--   'solar' = the real business) so both accounts share one memory layer
--   without colliding.
-- • Each table keeps a few typed, indexed columns for the fields we filter on,
--   plus a `data jsonb` column holding the full app record. The client types
--   drift over time (the store already migrates old shapes on load), so the
--   full record lives in jsonb and stays resilient; the flat columns are just
--   for querying/dedup.
-- • RLS is ON with NO public policies → the anon key can read/write nothing.
--   The server talks to these tables with the service_role key, which bypasses
--   RLS. Never expose the service_role key to the browser.
-- • Re-running this file is safe (IF NOT EXISTS / idempotent).
-- ============================================================

-- ---- agent_runs — the shared run log (mirrors brain/Log.md) ----
-- Append-only. Every agent writes what it did / spent / needs a human here so
-- the next agent (and Taylor) has the running record without re-explaining.
create table if not exists public.agent_runs (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  agent       text not null,            -- orchestrator | researcher | cmo | lead_manager | data_analyst | dev
  summary     text not null,
  needs_human text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists agent_runs_ws_time on public.agent_runs (workspace, created_at desc);

-- ---- leads — server-hunted leads (the always-on hunt writes here) ----
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  dedup_key   text not null,            -- normalized url; dedup within a workspace
  score       int,
  platform    text,
  intent      text,
  territory   text,
  data        jsonb not null default '{}'::jsonb,
  found_at    timestamptz not null default now(),
  unique (workspace, dedup_key)
);
create index if not exists leads_ws_score on public.leads (workspace, score desc);

-- ---- contacts — the CRM / pipeline ----
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  app_id      text not null,            -- the client's Contact.id
  name        text,
  stage       text,
  warmth      text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (workspace, app_id)
);
create index if not exists contacts_ws_stage on public.contacts (workspace, stage);

-- ---- opportunities — the engagement inbox ----
create table if not exists public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  app_id      text not null,            -- the client's Opportunity.id
  status      text,
  territory   text,
  data        jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  unique (workspace, app_id)
);
create index if not exists opportunities_ws_status on public.opportunities (workspace, status);

-- ---- planned_posts — the content queue / weekly planner ----
create table if not exists public.planned_posts (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  app_id      text not null,            -- the client's PlannedPost.id
  status      text,                     -- draft | ready | scheduled | posted
  pillar      text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (workspace, app_id)
);
create index if not exists planned_posts_ws_status on public.planned_posts (workspace, status);

-- ---- reel_analyses — Reel Coach output (Gemini coaching JSON, no video) ----
create table if not exists public.reel_analyses (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  app_id      text not null,            -- the client's VaultReel.id
  label       text,
  source      text,                     -- own | reference
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (workspace, app_id)
);
create index if not exists reel_analyses_ws_time on public.reel_analyses (workspace, created_at desc);

-- ---- kb_refs — accuracy-gate source registry ----
-- Every claim the CMO puts in a post must trace to a labeled source here.
create table if not exists public.kb_refs (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'solar',
  claim       text not null,
  label       text,                     -- fact | projection | contested | industry-claim
  source      text,
  url         text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists kb_refs_ws_time on public.kb_refs (workspace, created_at desc);

-- ---- lock everything down: RLS on, no public policies ----
-- The server uses the service_role key (bypasses RLS). The anon key gets
-- nothing. This is the secure default — do not add permissive anon policies.
alter table public.agent_runs    enable row level security;
alter table public.leads         enable row level security;
alter table public.contacts      enable row level security;
alter table public.opportunities enable row level security;
alter table public.planned_posts enable row level security;
alter table public.reel_analyses enable row level security;
alter table public.kb_refs       enable row level security;
