# Shared Memory Layer

The operational data layer for the Agentic OS — Supabase. This is the "big
one" from the architecture: real persistence so no agent ever re-explains
context to another. Managed by [[Dev]]; read/written by the whole roster.

**Status:** code is wired and shipped (inert). It turns on the moment the
Supabase project exists and its 3 keys are in Vercel. No more code needed.

## Obsidian vs. Supabase (the split)
- **This vault (Obsidian + GitHub)** = the *knowledge / strategy* layer.
  Charters, editorial direction, KB facts, decisions. Human-readable, versioned,
  live now. Managed by hand + by sessions pushing markdown.
- **Supabase** = the *operational data* layer. The moving records the agents
  produce and act on: leads, contacts, the content queue, reel analyses, the
  agent run-log, the accuracy-gate source registry. Structured, queryable,
  shared across every device and every agent.

They are complementary, not either/or.

## What lives in it (7 tables — see `farmhand/supabase/schema.sql`)
| Table | Holds | Written by |
|---|---|---|
| `agent_runs` | the shared run log (mirrors this vault's [[Log]]) | every agent |
| `leads` | server-hunted leads (dedup by normalized url) | [[Researcher]] / [[Lead Manager]] |
| `contacts` | the CRM / pipeline | [[Lead Manager]] |
| `opportunities` | the engagement inbox | [[Lead Manager]] / [[CMO]] |
| `planned_posts` | the content queue / weekly planner | [[CMO]] |
| `reel_analyses` | Reel Coach coaching JSON (no video kept) | [[CMO]] |
| `kb_refs` | accuracy-gate source registry ([fact]/[projection]/[contested]/[industry-claim]) | [[CMO]] / [[Researcher]] |

Every table is namespaced by `workspace` (`default` = realtor test user,
`solar` = the real business) so both accounts share one layer without
colliding. Each row keeps a few typed/indexed columns plus a `data jsonb` of
the full record, so the schema survives the app's evolving shapes.

## How it's wired (all safe until configured)
- `lib/supabase.ts` — PostgREST fetch layer (plain fetch, no SDK, like
  [[Connectors|kv.ts]]). Server-only. Uses the **service_role** key, which
  never reaches the browser.
- `lib/memory.ts` — typed domain API (logAgentRun, upsertLeads, syncRecords,
  pushWorkspace/pullWorkspace, addKbRefs…). All reads → `[]`, all writes →
  no-op when unconfigured.
- `app/api/memory` — the bridge. `GET` = status probe + pull; `POST` = push a
  snapshot or append an agent run.
- `lib/memorySync.ts` + the store — the client half. Pulls once per workspace
  (non-destructive merge — local always wins), pushes on change (debounced).
  Inert until `/api/memory` reports configured.

## Turn it on (owner, ~5 min)
1. Create a project at supabase.com/dashboard.
2. **SQL Editor → New query** → paste all of `farmhand/supabase/schema.sql` → Run.
3. **Settings → API** → copy the Project URL, the `service_role` key (secret),
   and the `anon` key.
4. In **Vercel → Project → Settings → Environment Variables** add:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` (mark **Sensitive**), `SUPABASE_ANON_KEY`.
5. Redeploy. The **Connectors** card flips green and sync turns on automatically.

## Security
- RLS is ON with **no public policies** — the anon key can read/write nothing.
  The server uses `service_role` (bypasses RLS). Never expose it client-side.
- `SUPABASE_SERVICE_ROLE` must be marked **Sensitive** in Vercel.
