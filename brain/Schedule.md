# Schedule

When each agent runs. **The engine is LIVE**: a scheduled cloud Routine
("Farmhand Brain — Orchestrator", Mon/Thu/Fri 9:00 AM Phoenix) spawns a
fresh agent session that reads this vault, does the work below via the
[[Orchestrator]] charter, and pushes the results back — no VPS, no local
machine, nothing for Taylor to keep running. Taylor gets a push
notification when each run finishes. Runs are hard-bounded to `brain/`
and can never spend image credits or approve their own work.

| Run | Cadence | Agent(s) | Output |
|---|---|---|---|
| Planning | Mon + Thu morning | Orchestrator → Creative Director | 3–5 fresh briefs in [[Content Queue]] |
| Drafting | after planning | Copywriter → Art Director | briefs advanced to `visuals-planned` |
| Production | on `approved` | Taylor in Post Studio (later: `/api/produce`) | finished post + images in the app vault |
| Review | Fri | Analyst | findings in [[Content Analytics]], tweaks proposed to Brand notes |
| Lead engine | already live in-app | app cron (hunt) | opportunities in the Engage tab |

Rules: no run without a [[Log]] entry · scheduled runs never spend image
credits (that requires `approved` + production) · if two runs collide, the
later one reads the earlier one's log first.
