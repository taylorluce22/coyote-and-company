# Schedule

When each agent runs.

**Status: ON HOLD (owner, 2026-07-20).** Nothing fires automatically until
Taylor is happy with the content quality. The scheduled Routine has been
deleted — not just paused — so zero autonomous runs occur. Agent passes
happen only when Taylor asks a session to "run the brain."

**To re-arm when ready**: tell a Claude session "re-arm the orchestrator
routine" — the full standing prompt is preserved (chat 2026-07-20 and the
Orchestrator charter); recreate cadence Mon/Thu/Fri 9:00 AM Phoenix
(cron `0 16 * * 1,4,5` UTC), fresh session per fire, push notification on.
Scheduled runs are hard-bounded to `brain/`, can never spend credits
(see the Credit Preservation Policy in [[Tools]]), and can never
self-approve.

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
