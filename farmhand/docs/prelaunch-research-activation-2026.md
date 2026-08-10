# Pre-Launch Research Activation — turn the brain's research loop ON

> **For the Engineering (Claude Code) session.** Taylor's instruction, 2026-08-10:
> activate the research functions visible in the brain graph so the app continuously
> does pre-launch research and every queued draft gets better than the last.
> Execute top to bottom. Update the STATUS section at the end as nodes go live.

## What the brain graph shows (current state)

Nodes exist for: **CMO, Researcher, Data Analyst, Lead Manager, Orchestrator**
(agents) · **Competitor Audit, Rising-cost/Heat KB** (knowledge) · **Visual Style,
Editorial Direction** (brand) · **Content Queue** · **Growth Strategy** (analytics)
· **Home, Tasks, Schedule, Tools, Log, README** (system) · pipeline + content-post
nodes. The research loop is NOT running. Your job is to wire and enable it.

## Step 1 — Locate the wiring

Find the agent/pipeline registry backing the brain graph (orchestrator config /
feature flags / cron or scheduled-job definitions / stub handlers). Identify
concretely why Researcher, Data Analyst, Competitor Audit, CMO review, and
Schedule are inactive. Do not rebuild what exists — enable and finish it.

## Step 2 — Enable these loops, on cadence

1. **Researcher — weekly AZ energy sweep.** Refresh `Rising-cost / Heat KB` from
   the source patterns already established in `az-rising-costs-heat-datacenters-2026.md`,
   `az-rates-supply-demand-2026.md`, `az-solar-market-2026.md`, `az-energy-knowledge-2026.md`.
   Local-first (East Valley AZ); national issues (datacenters, electricity prices)
   secondary/supporting only.
2. **Competitor Audit — biweekly.** Scan AZ solar customer-facing pages + the
   reference-creator pattern class codified in `ig-account-direction-2026.md`
   (@kaelinsager anatomy). Write findings to the Competitor Audit node.
3. **Data Analyst — per-post metrics ingest.** Even at 1–2 posts, wire the loop
   now: capture per-post engagement into Log/Growth Strategy so the CMO pass has
   real data as the page grows.
4. **CMO — review pass on the Content Queue.** Score every queued draft against
   `Editorial Direction`, `Visual Style`, and the hard rules in
   `ig-account-direction-2026.md`. Weak drafts get kicked back with specific notes,
   then regenerated — this is the "gets better as we go" mechanism. Log scores.
5. **Orchestrator + Schedule.** Weekly content-pack cadence per Taylor's standing
   preference; each cycle = research refresh → draft generation → CMO review →
   queue. Nodes must show last-run timestamps in the graph.

## Step 3 — Hard guardrails (non-negotiable)

- **Drafts only. Nothing auto-posts.** Every item lands in Content Queue as DRAFT
  for Taylor's explicit per-item approval. No exceptions, pre-launch or after.
- **Two grid lanes only** (lifestyle / educational solar). Sales-wins, commission,
  recruiting content must never enter the queue for the grid — Stories lane only.
- Never fabricate installs, savings figures, or customer results.
- The field-sales persona is retired (`ig-account-direction-2026.md`) — no route/
  roofs-every-morning framing in any generated copy.
- Content angles per Taylor: batteries-now (self-consumption under net billing,
  VPP incentives, heat-outage backup), AZ-specific advantages, lease-to-own.
  The expired federal tax credit is a dead angle — skip it.
- AI-disclosure label field on meaningfully AI-edited items.
- Board selection for any Higgsfield generation: hard-pin AZ Grid v2
  (`higgsfield-board-state-2026.md`); frames before video credits, always.

## Step 4 — Engineering working agreement (unchanged)

`npx tsc --noEmit` AND `npm run build` clean before every commit · client-isolation
invariant · never surface native provider credits/costs · small commits, working
branch, no PR unless asked. Anything needing Taylor's Mac goes through the MAC TASK
GitHub-issue bridge.

## Definition of done

- Each Step-2 node ACTIVE in the brain graph with a last-run timestamp.
- One full cycle executed end-to-end: refreshed KB entries + at least one queue
  draft improved through a CMO kickback-and-regenerate + Log entries proving it.
- STATUS section below updated; blockers filed as issues, not silently skipped.

## STATUS (Engineering updates this)

- [x] Researcher weekly sweep — WIRED (`lib/researchLoop.ts` → `/api/cron/research-cycle`, Mondays 14:00 UTC; writes kb_refs + agent_runs). First live run pending deploy trigger.
- [x] Competitor Audit biweekly — WIRED (same cron, even ISO weeks; findings → kb_refs `competitor-audit` + agent_runs). First live run pending.
- [x] Data Analyst metrics ingest — WIRED (`POST /api/metrics` per-post capture + weekly growth check in the cycle). Numbers come only from real IG insights — never estimated.
- [x] CMO queue review — WIRED (scores drafts vs Step-3 rules via Claude; kickbacks get a revision stored alongside the original with an AI-disclosure flag; **status never advanced — drafts only**; capped 3/run).
- [x] Orchestrator/Schedule cadence — WIRED (weekly cycle chains all of the above; every node logs to agent_runs).
- [x] Graph last-run timestamps — LIVE (Agent Network cards overlay real `agent_runs` stamps: status flips to active with "ran Xh ago" once a loop has run; Competitor Audit runs surface on the Researcher card; degrades to the static roster when memory isn't configured).
- [ ] One full cycle executed end-to-end — **needs Cowork/Vercel side**: deploy, trigger the cron once, verify agent_runs + a CMO-reviewed draft. See `docs/research-activation-cowork-tasks.md`.

**Blocker (filed, not skipped):** `ig-account-direction-2026.md` and `higgsfield-board-state-2026.md` are referenced by this spec but are not in the repo (Mac-only). Rules encoded in `lib/researchLoop.ts` RULES from this spec's own text; reconcile when the docs land.
