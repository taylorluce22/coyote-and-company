# Command Center — Farmhand Brain

The one-screen view of the operation. Agents: read this first, every run.

## Agent status board

Migrated 2026-07-21 to the 6-agent Agentic OS roster (1 chief of staff +
5 specialists). The old content specialists (Creative Director, Copywriter,
Art Director, Fact Checker, Feed Director) folded into the [[CMO]]; the
Analyst became the [[Data Analyst]].

| Agent | State | Last run | Next |
|---|---|---|---|
| [[Orchestrator\|CEO / Orchestrator]] | **ON HOLD** — schedule deleted per owner; manual runs only | 2026-07-20 (manual make-up run) | when Taylor asks |
| [[Researcher]] | idle — idea bank stocked from the research dump | 2026-07-21 | when idea bank thin / a niche saturates |
| [[CMO]] | 5 briefs `fact-checked`, awaiting Taylor's approval; carousels upgraded to photo-backed | 2026-07-21 | when queue < 3 open |
| [[Lead Manager]] | idle — lead engine exists (Engage), appointment-booking not wired yet | — | when web leads land |
| [[Data Analyst]] | idle — no post data yet (pre-launch) | — | first Friday after posts ship |
| [[Dev]] | **active** — rebuilt the app into the Agentic OS shell + roster | 2026-07-21 | next build task (Pexels/Supabase wiring) |

## Current state

- **App**: Farmhand (Next.js, `farmhand/`), live at coyote-and-company.vercel.app, auto-deploys on merge to `main`.
- **Vertical**: Arizona residential solar. West Valley (Buckeye, Peoria — APS), East Valley (Queen Creek — SRP); full catalog in `farmhand/lib/azTerritories.ts`.
- **Runtime**: scheduled Claude Routines fire in the cloud (no VPS, no local machine needed), work this vault, and push via PR. Taylor supervises from Obsidian and approves in [[Content Queue]].
- **Standing owner decisions**: quality over cost, but no credit spent on a post that isn't worth posting. Honest numbers only. CTAs are Valley-general and interchangeable — cities only when they're the subject.

## Needs Taylor (mirror of [[Tasks]])

- **Photo dump** into `brain/Brand/refs/` (installs, equipment, consults,
  truck/tools) — unlocks Lane 3 proof-of-work posts AND a Higgsfield
  style reference so AI scenes match your real work
- **Run the grid-level competitor audit** (extension prompt below) — this
  is the "make my page look/feel like an established pro" review
- Review the 5 open briefs in [[Content Queue]] (2 rejected per your direction)
- `ANTHROPIC_API_KEY` in Vercel · Higgsfield key rotation

## Map

**Agents**: [[Orchestrator|CEO / Orchestrator]] · [[Researcher]] · [[CMO]] ·
[[Lead Manager]] · [[Data Analyst]] · [[Dev]]
**Docs**: [[Tasks]] · [[Schedule]] · [[Tools]] · [[Content Queue]] · [[Log]] ·
[[Voice]] · [[Visual Style]] · [[Editorial Direction]] · [[Competitor Audit]] ·
[[Growth Strategy]] · [[Lead Pipeline]] · [[Content Analytics]]
