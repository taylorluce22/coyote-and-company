# MAC TASK — Research loop: first live cycle + verification

For the Cowork session (browser/Vercel/Supabase hands). Engineering has wired everything;
this closes the spec's definition of done. Report back as `*-report-*.md` per convention.

## 1. Preconditions (Vercel → Project → Settings → Env Vars)
- `PERPLEXITY_API_KEY` — exists? (the hunt cron already uses it; just confirm)
- `ANTHROPIC_API_KEY` — needed by the CMO review pass. If absent, add it.
- `CRON_SECRET` — optional but recommended; if set, use it in step 2.

## 2. Trigger the first cycle (after the latest push deploys)
On the branch preview deployment (Vercel Authentication ON — use a logged-in browser):
open `<preview-url>/api/cron/research-cycle` (add header `Authorization: Bearer <CRON_SECRET>`
if set — curl from a terminal that can reach it, or temporarily test without the secret).
Expect JSON: `{ ok: true, research: {...}, audit: {...}, cmo: {...}, analyst: {...} }`.

## 3. Verify in Supabase (farmhand-memory project)
- `select agent, summary, created_at from agent_runs order by created_at desc limit 10;`
  → expect rows for researcher, cmo, data_analyst, orchestrator (+ competitor_audit on even ISO weeks).
- `select claim, label, source, url from kb_refs order by created_at desc limit 10;`
  → expect sourced sweep claims (source `researcher-weekly-sweep`).
- If the Content Queue has drafts: `select app_id, status, data->'cmoReview' from planned_posts
  where data ? 'cmoReview';` → reviews present, **status still draft** (guardrail check).

## 4. Verify the graph
Open the app → Agent Network: Researcher/CMO/Data Analyst/Orchestrator cards should read
"ran Xm ago" with active styling.

## 5. Report + blockers
- Confirm: cycle ran, rows above exist, no draft status changed, nothing posted anywhere.
- Push the two Mac-only docs the spec references: `ig-account-direction-2026.md`,
  `higgsfield-board-state-2026.md` (Engineering will reconcile RULES with them).
- Open question for Taylor (his call, not ours): promote this branch to production or keep
  working off the protected preview URL.
