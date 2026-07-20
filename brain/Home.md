# Command Center — Farmhand Brain

The one-screen view of the operation. Agents: read this first, every run.

## Agent status board

| Agent | State | Last run | Next |
|---|---|---|---|
| [[Orchestrator]] | **LIVE — scheduled** Mon/Thu/Fri 9:00 AM Phoenix | 2026-07-20 (manual make-up run) | Thu 2026-07-23 auto |
| [[Creative Director]] | 5 open briefs, all advanced | 2026-07-19 | when queue < 3 open |
| [[Copywriter]] | all 5 briefs drafted | 2026-07-20 | next `idea` brief |
| [[Art Director]] | all 5 visual plans done (~13 credits total est.) | 2026-07-20 | next `drafted` brief |
| [[Fact Checker]] | **5/5 PASS** — receipts under each brief | 2026-07-20 | next `visuals-planned` brief |
| [[Analyst]] | idle — no post data yet | — | first Friday after posts ship |

## Current state

- **App**: Farmhand (Next.js, `farmhand/`), live at coyote-and-company.vercel.app, auto-deploys on merge to `main`.
- **Vertical**: Arizona residential solar. West Valley (Buckeye, Peoria — APS), East Valley (Queen Creek — SRP); full catalog in `farmhand/lib/azTerritories.ts`.
- **Runtime**: scheduled Claude Routines fire in the cloud (no VPS, no local machine needed), work this vault, and push via PR. Taylor supervises from Obsidian and approves in [[Content Queue]].
- **Standing owner decisions**: quality over cost, but no credit spent on a post that isn't worth posting. Honest numbers only. Geography in the CTA, not the education.

## Needs Taylor (mirror of [[Tasks]])

- Face decision for the realistic lane → record in [[Visual Style]]
- Reference photos → `brain/Brand/refs/`
- Review the 5 open briefs in [[Content Queue]] (2 rejected per your direction)
- `ANTHROPIC_API_KEY` in Vercel · Higgsfield key rotation

## Map

[[Tasks]] · [[Schedule]] · [[Tools]] · [[Content Queue]] · [[Log]] ·
[[Voice]] · [[Visual Style]] · [[Lead Pipeline]] · [[Content Analytics]]
