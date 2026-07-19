# Tasks

Operational task board (system work — content work lives in [[Content Queue]]).
Orchestrator triages this every run. Newest on top within each section.

## Needs Taylor
- [ ] **Run the deep-research prompt** (provided in chat 2026-07-19): AZ
  electricity price trajectory + how solar is sold in metro Phoenix. Paste
  results back to a Claude session → it distills them into
  `farmhand/docs/` and refines [[Editorial Direction]] + the idea banks
- [ ] **A/B decision**: realistic-lane faces — (A) real photos of you for
  identity + AI for scenes, or (B) a consistent stylized character via Soul
  ID. Record the answer in [[Visual Style]]. *(Recommendation: A)*
- [ ] Drop 10–15 reference photos into `brain/Brand/refs/` and list them in
  [[Visual Style]]
- [ ] Vercel: add `ANTHROPIC_API_KEY` (enables the in-app produce pipeline)
- [ ] Higgsfield key hygiene: rotate the exposed key, mark env vars
  Sensitive (flagged 2026-07-18)
- [ ] Review the 5 briefs in [[Content Queue]] — approve / reject with reasons

## Active
- [ ] Copywriter pass on the 5 `idea` briefs (next scheduled/asked run)
- [ ] Art Director pass follows on `drafted` briefs

## Backlog
- [ ] "Produce post" one-button pipeline in the app (`/api/produce`)
- [ ] Vercel KV for server-side state (unlocks fully autonomous production
  + the 24/7 lead cron)
- [ ] Reddit API keys → native hunt lane + conversation auto-checks
- [ ] Soul Moodboard/style_id trained from `Brand/refs` once photos exist
- [ ] Performance loop: pack/hook win-rates → [[Content Analytics]]

## Done
- [x] Brain vault OS structure (2026-07-19)
- [x] Coherent idea decks + copywriter + visuals pipeline in-app (PRs #88–#95)
