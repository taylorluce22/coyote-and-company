# Command Center — Farmhand Brain

The one-screen view of the operation. Agents: read this first, every run.

## Agent status board

| Agent | State | Last run | Next |
|---|---|---|---|
| [[Orchestrator]] | **ON HOLD** — schedule deleted per owner; manual runs only | 2026-07-20 (manual make-up run) | when Taylor asks |
| [[Creative Director]] | 5 open briefs, all advanced | 2026-07-19 | when queue < 3 open |
| [[Copywriter]] | all 5 briefs drafted | 2026-07-20 | next `idea` brief |
| [[Art Director]] | all 5 visual plans done (~13 credits total est.) | 2026-07-20 | next `drafted` brief |
| [[Fact Checker]] | **5/5 PASS** — receipts under each brief | 2026-07-20 | next `visuals-planned` brief |
| [[Feed Director]] | **NEW** — First-12 grid plan drafted; awaiting grid-level audit data + photo dump | 2026-07-20 | after Competitor Audit grid pass |
| [[Analyst]] | idle — no post data yet | — | first Friday after posts ship |

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

[[Tasks]] · [[Schedule]] · [[Tools]] · [[Content Queue]] · [[Log]] ·
[[Voice]] · [[Visual Style]] · [[Feed Director]] · [[Competitor Audit]] ·
[[Growth Strategy]] · [[Lead Pipeline]] · [[Content Analytics]]
