# Tasks

Operational task board (system work — content work lives in [[Content Queue]]).
Orchestrator triages this every run. Newest on top within each section.

## Needs Taylor
- [x] **"Credible" framings — RESOLVED (owner 2026-07-21)**: retire them.
  The "cheap by the kWh / rose slower than national" downplay is off-message
  under the rising-cost thesis; gets reworked in the post-research KB
  overhaul. See [[Editorial Direction]].
- [ ] **RESEARCH DUMP — rate design, VPPs, cost trajectory** (owner offered
  2026-07-21): needed to source the rising-cost/solar-hedge thesis before
  the KB overhaul + brief rewrites (kitchen-table #3, SRP #4). Run this and
  paste results back (label every item [fact]/[projection]/[contested]/
  [industry-claim] with source + date):
  - **SRP redesign 2025–26**: residential plan names, what changed, who's
    grandfathered + for how long; on-peak windows now vs. after (confirm the
    ~3–8pm → 5–10pm shift), months, on/off-peak ¢/kWh; demand charges on
    solar plans; solar export/buyback ¢/kWh + how it's set.
  - **APS current**: TOU on/off-peak windows + ¢; export/RCP ¢ and its
    decline path.
  - **VPP / battery programs, BOTH utilities**: names, incentives, dispatch
    rules (how often they can pull your battery), eligibility, 2026 status.
  - **Why VPPs exist (grid-strain case)**: AZ peak-demand growth, reserve
    margins, data-center load, capacity constraints — NERC assessments,
    utility IRPs, ACC filings; the reliability rationale utilities give for
    needing residential storage.
  - **Bill trajectory**: historical AZ residential rate/bill path (10–20 yr,
    % increases) + forward projections (EIA, IRPs, approved + pending rate
    cases) — over what horizon does a Phoenix bill realistically double?
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
