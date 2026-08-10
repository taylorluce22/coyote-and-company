# Research loop — first live cycle: report (2026-08-10)

> Cowork session, answering `research-activation-cowork-tasks.md`.

## 1. Env vars (names checked only; no values viewed or changed)
- `PERPLEXITY_API_KEY` — present (Production and Preview).
- `ANTHROPIC_API_KEY` — present (Production and Preview, updated Jul 25). Nothing added.
- `CRON_SECRET` — **absent**. Cycle triggered without auth per the doc's "optional" note.
  Recommend Taylor add one before relying on the weekly cron (his hand, not ours).

## 2. First cycle — ran to completion, but note the 504
- GET `<branch-preview>/api/cron/research-cycle` returned a browser error page twice.
  Vercel logs: `504 — Vercel Runtime Timeout Error: Task timed out after 60 seconds`.
- **Execution completed anyway** — the function outlived the response window. agent_runs
  shows a full cycle: researcher 18:02:26Z (12 sourced claims) on attempt 1, then attempt 2
  at 18:03: researcher (0 new — dedup working), cmo 18:03:40, data_analyst 18:03:40,
  orchestrator 18:03:41 "Weekly research cycle complete: sweep 12 claims, audit skipped (odd week)".
- Engineering to-do: the route can't return inside 60s. The Monday 14:00 UTC cron will
  "fail" with 504 while actually completing — split the cycle, stream, or fire-and-forget
  a 202 so cron logs stay honest.

## 3. Supabase verification (farmhand-memory)
- `agent_runs`: rows for researcher, cmo, data_analyst, orchestrator (audit correctly
  skipped — odd ISO week). ✓
- `kb_refs`: 12 sourced claims, source `researcher-weekly-sweep`, labeled fact /
  industry-claim (APS Storage Rewards, RCP export credits, SRP BYOT, Solar Communities,
  lease-to-own marketing, 9,164 MW peak, etc.). ✓
- Guardrail: `planned_posts` with cmoReview → p-e1 ready / p-e2 draft / p-e3 draft, BUT all
  three have `updated_at = 2026-07-25` — **the cycle changed no statuses**; p-e1 was
  "ready" two weeks before this pass. ✓ (Two notes for Engineering: (a) the task doc's
  query used `created_at`, which doesn't exist on planned_posts — used `updated_at`;
  (b) cmoReview landed without bumping `updated_at`, and p-e1 is a low-score-18 post
  sitting in "ready" from July — worth a look, but not a guardrail breach.)
- Nothing posted anywhere. ✓

## 4. Graph data
- `/api/agent-runs` → `configured:true`, latest stamps for all four agents at 18:03Z.
  (Root route gates behind the strategy-session onboarding in a fresh context, so the
  screen itself wasn't clicked through — the endpoint that feeds "ran Xm ago" is live.)

## 5. Docs + answers
- Both Mac-only playbooks pushed: `ig-account-direction-2026.md`,
  `higgsfield-board-state-2026.md` → commit `bd950d9`. RULES can reconcile.
- FYI: a third uncommitted doc exists on the Mac at `farmhand/docs/two-account-architecture-2026.md`
  (modified today) — not pushed since it wasn't asked for and may be mid-edit.
- Globyz/Nexgen — Salman clarification: **Salman Pathan, CEO of Globyz Pharma (parent of
  Nexgen Formulations, Folcroft PA) — a supplier prospect of the SCP agency business**
  (503B introduction pipeline), not FarmHand. Thread lives in Taylor's mailbox under
  "Introduction work for 503B facilities" (reply from sal@globyz.com, Aug 6). Call is
  Thu Aug 13, 1:25 PM ET / 10:25 AM MST via his Microsoft Bookings.
- Open question surfaced to Taylor (his call): promote this branch to production vs.
  keep working off the protected preview URL.

— Cowork session, 2026-08-10
