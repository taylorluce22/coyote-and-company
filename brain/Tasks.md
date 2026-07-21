# Tasks

Operational task board (system work — content work lives in [[Content Queue]]).
Orchestrator triages this every run. Newest on top within each section.

## Needs Taylor
- [x] **"Credible" framings — RESOLVED (owner 2026-07-21)**: retire them.
  The "cheap by the kWh / rose slower than national" downplay is off-message
  under the rising-cost thesis; gets reworked in the post-research KB
  overhaul. See [[Editorial Direction]].
- [x] **RESEARCH DUMP — rate design, VPPs, cost trajectory — LANDED
  2026-07-21**: owner ran the deep ChatGPT pass; results ingested into
  `farmhand/docs/az-rising-costs-heat-datacenters-2026.md` (sourced +
  labeled). Corrections captured: SRP window shift is plan-specific (E-16
  5–10pm, E-28 6–9pm, APS still 4–7pm); "grid unstable" softened to
  "utilities paying for evening flexibility" (NERC says margins fine);
  "bill doubles" given both horizons (~15/~24 yr). Briefs 1/3/4 rewritten
  on it; azEnergyKb rate-case + "cheap by the kWh" decks updated.
- [ ] **Pexels API key** in Vercel (`PEXELS_API_KEY`, free at
  pexels.com/api) — turns on photo backgrounds for the upgraded
  informational carousels (the `/api/stock` proxy is already built; also
  accepts `PIXABAY_API_KEY` / `UNSPLASH_ACCESS_KEY`). See [[Visual Style]].
- [ ] **Reel Coach setup**: Content → Reel Coach tab needs two things live in
  Vercel before it works: `GEMINI_API_KEY` (free at aistudio.google.com,
  cheap pay-as-you-go for video) and a Vercel Blob store connected
  (`BLOB_READ_WRITE_TOKEN` auto-populates once one's attached to the
  project — it's just a transfer hop, clips get deleted right after
  analysis). Built 2026-07-21, untestable in this sandbox without real
  keys — flag anything that breaks on first real use.
- [ ] **Brand positioning call**: your own on-camera photos/video show
  SunSolar Solutions branding (polo + badge) — keep that visible (real,
  transparent) or keep public content installer-neutral (matches the
  "consultant not salesperson" positioning the whole page strategy is
  built on)? See [[Visual Style]] for the tradeoff.
- [ ] **Run the GRID-LEVEL competitor audit** with the browser extension
  (prompt provided in chat 2026-07-20 — compares whole profiles/grids on
  established high-follower pages, not individual post stats) — results
  paste into [[Competitor Audit]]; [[Feed Director]] then refines the
  First-12 grid plan from it
- [x] Face/on-camera decision — RESOLVED 2026-07-20: minimize on-camera,
  lean on real equipment/install photos + AI illustration for generic
  moments, no recurring synthetic persona. Recorded in [[Visual Style]].
- [ ] **Photo dump**: 10–25 real photos into `brain/Brand/refs/` (installs,
  flashed penetrations/racking close-ups, panels on tile+shingle, consult
  moments, truck/tools) — powers Lane 3 proof-of-work posts AND becomes
  the Higgsfield style reference for illustrative scenes
- [ ] Vercel: add `ANTHROPIC_API_KEY` (enables the in-app produce pipeline)
- [ ] Higgsfield key hygiene: rotate the exposed key, mark env vars
  Sensitive (flagged 2026-07-18)
- [ ] Review the 5 briefs in [[Content Queue]] — approve / reject with reasons

## Active
- [ ] Copywriter pass on the 5 `idea` briefs (next scheduled/asked run)
- [ ] Art Director pass follows on `drafted` briefs

## Backlog
- [ ] **Wire `/api/stock` auto-background into carousel generation** so the
  content engine defaults informational carousels to photo backgrounds
  (Pexels), with a slot for a credited news-article screengrab — per the
  Lane 1 upgrade in [[Visual Style]]. App build; needs the Pexels key first.
- [ ] Settings field for the real IG handle (@taylorlucesolar) — Studio
  slides currently render a derived placeholder handle
- [ ] Reel lane: reel-format versions of queued topics — screen-recorded
  walkthroughs / install b-roll / voiceover-over-stills per the
  minimize-on-camera decision (until DoP video is wired)
- [ ] Build the first Feed Director grid plan into actual Content Queue
  briefs once the photo dump + grid audit land
- [ ] "Produce post" one-button pipeline in the app (`/api/produce`)
- [ ] Vercel KV for server-side state (unlocks fully autonomous production
  + the 24/7 lead cron)
- [ ] Reddit API keys → native hunt lane + conversation auto-checks
- [ ] Soul Moodboard/style_id trained from `Brand/refs` once photos exist
- [ ] Performance loop: pack/hook win-rates → [[Content Analytics]]

## Done
- [x] Installer-quality research ingested: `az-installer-quality-2026.md`
  (QTI/PSI programs, flashing standards, ROC/NABCEP, warranty survival);
  owner-expertise upgraded to verified fact; 3 new idea decks (2026-07-20)
- [x] Deep research ingested: `az-rates-supply-demand-2026.md` +
  `az-solar-market-2026.md`, KB reply lines + idea banks refreshed,
  Editorial Direction updated (2026-07-19)
- [x] Brain vault OS structure (2026-07-19)
- [x] Coherent idea decks + copywriter + visuals pipeline in-app (PRs #88–#95)
