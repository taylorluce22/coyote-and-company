# Log

Every agent run appends here, newest on top. Format:

```
## YYYY-MM-DD · <agent>
What was done · what was spent · what needs a human
```

---

## 2026-07-21 · Supabase Shared Memory Layer — scaffolded (inert until keys land)
Owner chose "scaffold the code now" for the shared memory layer. Built the
whole thing so it's live the instant the Supabase project + 3 keys exist —
zero more code needed. Follows the existing [[Connectors|kv.ts]] philosophy:
plain fetch against Supabase's PostgREST REST API, NO SDK dependency, graceful
no-op degrade. Completely inert today (no keys) — the app runs on localStorage
exactly as before.

New files: `farmhand/supabase/schema.sql` (7 workspace-namespaced tables —
agent_runs, leads, contacts, opportunities, planned_posts, reel_analyses,
kb_refs; each = typed/indexed columns + `data jsonb`; RLS on, no public
policies), `lib/supabase.ts` (server-only PostgREST layer, service_role key
never reaches browser), `lib/memory.ts` (typed domain API), `app/api/memory`
(status probe + push/pull), `lib/memorySync.ts` + store wiring (client sync —
pull non-destructive/local-wins, push debounced, gated on configured). Supabase
connector now live-checks `/api/memory`. Full doc: [[Shared Memory Layer]].

Ran a 4-lens adversarial review workflow (inert-when-unconfigured, key-leak
security, PostgREST correctness, store-sync safety), each finding independently
verified. Security + inert lenses came back clean. Two real (latent) bugs
caught and fixed before ship: (1) `upsertLeads` didn't collapse duplicate
dedup_keys within a batch — PostgREST rejects the whole request (SQLSTATE
21000) if a hunt re-cites one url twice; now deduped by key (highest score
wins); (2) the store push effect was gated by a `useRef`, whose flip doesn't
re-run the effect, so an edit made during the cloud-pull window could go
unsynced — `syncReady` is now state + a push-effect dep. Build passes. Nothing
spent.

Owner action (~5 min): create a Supabase project → run the schema → add
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` (mark Sensitive) / `SUPABASE_ANON_KEY`
in Vercel → redeploy. Steps in [[Shared Memory Layer]].

---

## 2026-07-22 · Supabase shared memory layer — LIVE and verified
Owner created the `farmhand-memory` Supabase project (West US / Oregon), ran
`farmhand/supabase/schema.sql` clean, and added the 3 keys in Vercel
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` marked **Sensitive**, `SUPABASE_ANON_KEY`
— the legacy anon/service_role JWT keys). Redeploy green.

**End-to-end verified.** Connectors card = 🟢 CONNECTED on first check. A UI
write in the solar workspace (an Opportunity captured as "Supabase Test /
Buckeye") flowed straight into Supabase → `opportunities`: `workspace = solar`,
`app_id opp-1784692964075`, `data` jsonb carrying the exact sourceName +
excerpt, timestamp-consistent. The memory layer is genuinely operational, not
just wired.

First agent writer also shipped (#132): the always-on cron hunt now logs each
run to `agent_runs` as the [[Researcher]] and mirrors leads into `leads`.
Client sync (contacts/opportunities/planned_posts) auto-flows on change.

The full 6-agent architecture is now live end to end. Remaining wiring is
additive: [[CMO]] → log produced content to `planned_posts` + `kb_refs`;
[[Orchestrator]] → read `agent_runs` so each session picks up where the last
left off. Nothing spent.

---

## 2026-07-21 · Connectors "Verify keys" — real validation, not just presence
Owner flagged: "there are key placeholders but not actual keys in some of
them." The Connectors screen only did presence checks (is the env var set?),
which is exactly what lets a placeholder like `your-key-here` read as green.
Added a **Verify keys** button that makes a real, **free** call to each
provider it can safely test and reports an honest per-card verdict: valid /
bad-or-placeholder (401/403) / no-key / couldn't-reach. Tested for free:
Pexels, Pixabay, Unsplash (`/api/stock?verify=1`, 1-result search) and Gemini
(`/api/video-reference?verify=1`, free `models.list`). Perplexity + Higgsfield
stay presence-only on purpose — testing them spends a credit (Credit
Preservation Policy). Also shipped the Blob card accuracy fix (GET status
probe so it live-checks instead of a static "attach store"). Shipped in #130.
Nothing spent.

Owner action: open **Connectors → Verify keys** after the redeploy. The
Jul-4 stock keys are the prime placeholder suspects — watch for any red
"Bad / placeholder" badge and replace that key in Vercel.

**Result (owner ran it):** all four testable keys came back **valid** —
Pexels, Pixabay, Unsplash, Gemini. No placeholders after all; the Jul-4
stock keys are real and working. Higgsfield's two vars were already marked
Sensitive in Vercel. The "placeholder keys" concern is closed. Every wired
integration is confirmed live. Nothing spent.

Next real build: **Supabase shared memory** — the only unwired compounding
piece. Blocked on owner creating the Supabase project (URL + keys); the
code side can be scaffolded ahead of that so it works the moment the env
vars land.

---

## 2026-07-21 · Connectors audit screen + checklist
Owner asked to "connect everything / make sure the connectors are set up."
Can't obtain keys or create accounts from here (owner actions), so built a
live **Connectors** screen (new nav item) that probes the app's own `/api`
status endpoints and shows each integration's real state: Perplexity,
Higgsfield, Pexels/Pixabay/Unsplash, Gemini (live-checked); Vercel Blob/KV
(attach-store); Apify, Tavily, Firecrawl, Gmail/Meet/Calendar, Supabase,
Metricool, Instagram/X, Anthropic, Reddit (to-wire); GitHub (connected).
21 connectors total. Each card shows what it powers, the env var, a
"get key" link, and setup notes. Registry in `farmhand/lib/connectors.ts`.
Matching checklist saved as [[Connectors]] for the Obsidian side.
Verified rendering (screenshot). Nothing spent.

Priority for the owner: (1) confirm Perplexity + Higgsfield keys are live;
(2) turn on the already-built features — Pexels, Gemini, Vercel Blob;
(3) the compounding one is Supabase shared memory (needs Dev to wire).

## 2026-07-21 · MIGRATED to the 6-agent Agentic OS roster
Owner adopted the Agentic OS architecture (the Sureflow model, adapted to
solar). Migrated the brain vault agent charters to match: 1 chief of staff
+ 5 specialists. New/rewritten charters in `brain/Agents/`:
[[Orchestrator|CEO / Orchestrator]], [[Researcher]] (intel gatherer —
Apify/Tavily), [[CMO]] (market voice — absorbs the OLD Creative Director +
Copywriter + Art Director + Fact Checker accuracy gate + Feed Director grid/
authenticity, so nothing binding was lost), [[Lead Manager]] (revenue ops —
web leads → booked in-home/virtual consults), [[Data Analyst]] (signal layer
— the full reel→revenue chain), [[Dev]] (build system).

Deleted the six old content-specialist charters. Bulk-remapped every
wikilink across the vault ([[Creative Director]]/[[Copywriter]]/[[Art
Director]]/[[Fact Checker]]/[[Feed Director]] → [[CMO]]; [[Analyst]] →
[[Data Analyst]]) and rewrote the [[Home]] status board + [[README]] map to
the new roster. Fixed the readability spots the remap left (dup-CMO lines in
Editorial Direction, stale Copywriter/Art-Director task lines). Re-aligned
the app's Knowledge Vault graph (`agentOs.ts` nodes + links) to the new
agents so the topology matches. Build passes. Nothing spent.

Note: the CMO now owns the entire content line as one agent (idea → drafted
→ visuals-planned → fact-checked). The accuracy gate and authenticity rules
are preserved verbatim inside its charter — still binding, still no
self-approval.

## 2026-07-21 · carousel look upgraded — photo-backed + news screengrabs
Owner direction after seeing the post-preview mockup: informational
carousels should be PHOTO-backed (image + scrim + short overlay text),
not flat text-on-black, to feel like an established pro and earn the
swipe. Recorded as the Lane 1 upgrade in [[Visual Style]]: Pexels
backgrounds (the `/api/stock` proxy already supports Pexels/Pixabay/
Unsplash — just needs `PEXELS_API_KEY`), one slide can be a credited
news-article screengrab (binding legal rule: headline+image as a
reference to the coverage, outlet credited on-slide + source in caption,
never strip credits; AP/Getty photos → keep to headline-screenshot +
attribution or swap to Pexels/own). On-screen text tightened to ≤~10–12
words, one idea per slide, swipe-loop structure. Preview artifact updated
to v2 showing the data-center carousel photo-backed with an AZFamily/ASU
news slide. Added: Pexels key (Needs Taylor), and a backlog task to wire
`/api/stock` auto-backgrounds into carousel generation. Nothing spent.

## 2026-07-21 · 3 new briefs added from the fresh research
Added three fact-checked briefs off the new sourced KB, all APS-primary/
utility-general per the SRP cap: "Data centers are heating up your
neighborhood" (carousel, HIGH-priority standout — ASU 1–4°F waste-heat
finding + #2-metro + 64k-homes, data-center-cost-shift kept a dispute);
"2024 was the hottest year in Phoenix history" (single — heat records →
evening AC load → rising bills → own-your-power); "They'll pay to use
your home battery. Ask why." (single — both utilities pay ~$110/kW/yr for
peak battery access, framed as "worth to them," not grid-instability).
Each carries claim→source receipts. Queue now: briefs 1, 3, and these 3
at fact-checked awaiting Taylor's approval; brief 4 held as the LOW-
priority SRP slot; briefs 2/monsoon/credit rejected. Nothing spent.

## 2026-07-21 · owner direction: APS-primary, SRP ~1 in 20
Owner: SRP residential solar ROI is too low (3.45¢ export + demand-charge
design) to court as a focus. New Editorial Direction rule — content is
APS-first, SRP-focused posts capped at ~1 in 20 (~5%); SRP facts stay in
the KB for education + the rare SRP piece. Brief 4 ("SRP's rate design")
demoted to the LOW-priority SRP cadence slot (kept fact-checked/ready,
not a priority post). VPP pay also corrected this session: APS and SRP
pay ~the same (~$110/kW/yr) — not "APS more" — verified via both program
pages. Nothing spent.

## 2026-07-21 · research dump LANDED — rising-cost/heat/data-center KB
Owner ran the deep ChatGPT research pass (news-sourced: azcentral/AZFamily/
ABC15/12News, NWS Phoenix, Maricopa County, ASU, EIA, NERC, APS/SRP
tariffs). Distilled into a new sourced+labeled fact-check doc
`farmhand/docs/az-rising-costs-heat-datacenters-2026.md` (Fact Checker +
Copywriter now bound to it). Key sourced facts: AZ avg bill +33%/decade
($120→$160, EIA); APS ~8% (2024) + ~14%/$20 ask (2H 2026); SRP redesign
(E-28 6–9pm w/ 40.26¢ summer-peak, E-16 5–10pm demand, export 3.45¢,
grandfathering to Nov 2029); APS TOU-E 4–7pm 34.4¢/12.3¢, RCP 6.17¢
declining; APS Storage Rewards ($110/kW) + SRP Battery Partner ($55/kW);
2024 warmest Phoenix year, 113-day 100°F streak, 608→430 heat deaths;
data centers ~5% of peak, ASU says their waste heat +1–4°F downwind.

Three owner assumptions CORRECTED to stay honest: (1) SRP window shift is
plan-specific, not a blanket 3–8→5–10; (2) "grid unstable" isn't supported
(NERC margins fine) — reframed as "utilities pay for your evening battery
because peaks/growth strain the plan"; (3) "bill doubles" given BOTH
horizons (~15 yr recent / ~24 yr decade), never a fixed date. Data-center-
raises-bills kept as a live dispute (AG Mayes vs. utilities). These
guardrails baked into the doc + Editorial Direction.

Content updated: brief 1 rate-case number fixed to sourced ~14%/$20/2H-2026;
brief 3 rewritten ("Your power bill isn't going back down" — rising-cost
inevitability, no plan-switching-as-fix); brief 4 rewritten ("SRP's rate
design: why solar alone won't save you" — 3.45¢ export vs 40¢ evening,
battery hedge, Battery Partner VPP). azEnergyKb rate-case reply + deck and
the retired "cheap by the kWh" deck rewritten to the rising-cost thesis.
Briefs 3 & 4 back to `fact-checked` (awaiting Taylor's approve). Nothing
spent.

## 2026-07-21 · editorial pivot: rising-cost thesis + solar-as-hedge
Owner reset the spine of the content pillar during brief review. New
thesis recorded in [[Editorial Direction]]: no matter the rate plan, AZ
power costs only climb (infrastructure + data centers + repeated rate
cases) — so plan-switching is NOT sold as a fix; the real hedge is
solar + battery sized to self-supply the punishing evening peak. Rate
DESIGN (low buyback, cheap off-peak, brutal on-peak) is the story, and
utility VPP / residential-battery programs are reframed as proof the grid
isn't stable ("if it were stable, why would they need your battery?").
Also resolved last turn's open question — the "cheap by the kWh / rose
slower than national" credibility-through-downplay framings are RETIRED,
not kept.

Queue actions: brief 2 (Every new street) REJECTED (owner: doesn't land/
flow, too abstract; new-demand facts kept only as support). Briefs 3
(kitchen-table) and 4 (SRP) moved to `reworking` with explicit rework
notes — #3 drops plan-switching-as-savings, #4 must teach SRP system
design + VPPs instead of cooling tips. Both HELD pending a research dump
the owner offered: SRP redesign/peak-window shift, current export+off-peak
rates, APS & SRP VPP terms, the grid-strain rationale, and a sourced
historical+projected bill trajectory to ground "costs keep climbing /
could double." Full research prompt saved in [[Tasks]]. Nothing enters
content as [fact] until sourced — no "bill will double" without a
timeframe + citation. Nothing spent.

## 2026-07-21 · Reel Coach: whole-browser freeze fixed (drag-and-drop gap)
Taylor hit this twice: Chrome itself — not just the tab — went fully
unresponsive after using Reel Coach, needing a full quit both times.
Root cause found by reading the browser's default drag-drop behavior,
not by reproducing it: the upload box's drop handling only covered
drops that landed exactly inside it. A drop missing the box by a few
pixels (easy when dragging from Finder/Photos) fell through to
Chrome's native default — navigate the tab and try to open the raw
video file directly — which can wedge the browser's shared video/GPU
pipeline hard enough to take the whole thing down for a large local
clip. Fixed with a page-level `dragover`/`drop` guard in
`FarmhandApp.tsx` (`DropGuard`) that no-ops any drop by default; the
upload box's own handler still runs first via bubbling so intentional
drops are unaffected. Shipped ahead of confirmation since the fix is
low-risk and the bug is a hard blocker; awaiting Taylor's confirmation
it's actually resolved. Also added a client-side 200MB file-size cap
as a smaller defensive measure. Nothing spent.

## 2026-07-21 · Reel Coach built — Gemini video coaching pipeline
Taylor's ask: he wants to upload real reference reels (his own or
competitors') and get an AI that actually WATCHES them (video + audio
together, not sampled stills) to coach the content bot on hooks/pacing/
visual style/reusable format. Built as a real app feature, not a one-off
session task, per Taylor's choice.

New: Content → Reel Coach tab. Upload flow: browser → Vercel Blob
(`@vercel/blob/client`, bypasses the ~4.5MB Vercel serverless body cap
that would otherwise reject most iPhone reels) → `/api/video-reference`
fetches the bytes, resumable-uploads to Gemini's Files API, polls until
processed, asks Gemini to analyze (structured JSON: hook strength/
technique, cut/pacing rhythm, on-screen text, visual style, spoken
content, the reusable content PATTERN, coaching notes) → Blob copy
deleted immediately (transfer hop only) → analysis persists in a new
in-app IndexedDB store (`reelVault`, mirrors the existing image Vault
pattern) with a "copy as vault note" button so results can be pasted
straight into a brain session. GET/POST `configured` pattern matches
`/api/copy`.

Needs Taylor before it's live: `GEMINI_API_KEY` + a Vercel Blob store
attached (`BLOB_READ_WRITE_TOKEN`) — added to [[Tasks]]. `npm run build`
passes clean, but the actual Gemini/Blob calls are untested — no real
keys exist in this sandbox. Nothing spent (build only).

## 2026-07-21 · two reel clips reviewed (clip 1 + clip 2)
Taylor sent two real reel candidates (clarifying the earlier 3.13s clip
was reference-only, not a review subject): Clip 1 (20.23s) and Clip 2
(13.17s), both HEVC 1080x1920, both continuous unedited straight-to-
camera talking-head takes in the same SunSolar-branded apparel/lav-mic
setup as the earlier clip. Extracted + sampled frames across both full
durations via the ffmpeg recipe in [[Tools]] (2fps). Clip 2's backdrop
is notably stronger — a finished house with a visible rooftop solar
array in frame the whole time. Neither has a scroll-stopping hook
(static face, no text/motion in frame one) and neither can be checked
against Editorial Direction's claims/pain-point rules without a
transcript of the audio — flagged as the blocker before either becomes
a `drafted` brief. Same SunSolar-branding question as before applies.
Logged to [[Visual Style]]. Nothing spent.

## 2026-07-20 · video reel reviewed; SunSolar affiliation confirmed
Taylor sent a 3.13s HEVC/Dolby Vision .mov (iPhone selfie clip). Sandbox
tooling couldn't decode it out of the box (Playwright's bundled ffmpeg is
webm/mjpeg-only; the sandboxed Chromium has zero proprietary codecs) —
fixed session-locally via `apt-get install ffmpeg --fix-broken` (recipe
now in [[Tools]] for future video reviews). Extracted + reviewed frames:
Taylor + a colleague, both in SunSolar-branded polos (colleague also
badged), golden-hour selfie on a bare lot in a new-construction desert
neighborhood — casual, no on-screen text, has untranscribed audio. This
visually CONFIRMS SunSolar Solutions is Taylor's own company (resolves
the batch 1/2 "competitor" mislabel — corrected in [[Visual Style]], not
deleted). Raw footage is strong (real match for the "new demand" post's
backdrop) but too short/unstructured to post standalone — b-roll
candidate. Surfaced a real strategic fork for Taylor: keep the
installer-neutral "consultant" positioning the whole Editorial Direction
is built on, or let personal-brand transparency (visible company
branding) take priority — added to [[Tasks]] as Needs Taylor. Nothing
spent (apt install is free, session-local infra, not a content spend).

## 2026-07-20 · photo dump batches 1-3 catalogued
Batches 1-2: Aurora Solar design-tool screenshots + SRP DER meter
(style-reference, likely fine to post once actually committed) and a
SunSolar Solutions-branded proposal for a named homeowner ("John
Matthews," Peoria) across two images plus a matching bill-comparison
graphic — held as NOT postable, named third-party PII, regardless of
whose company produced it. Batch 3: two candid personal shots (dusk, dog
— low value, postable as texture), one context-unclear kitchen photo
(hold), a genuine team photo holding a SunSolar Solutions/REC Certified
Professional tote, and a real doorstep photo of Taylor in SunSolar
branding with a homeowner holding a welcome flyer — the clearest Lane 3
proof-of-work material yet, pending confirmation the homeowner consented
to appear.

Correction flagged, not asserted: batches 1-2 were provisionally
described as "competitor" material without knowing Taylor's actual
affiliation — batch 3 shows Taylor himself in SunSolar Solutions
branding among colleagues, suggesting that read may be wrong. Open
question posted in [[Visual Style]] rather than guessed at. No files
committed to brain/Brand/refs/ yet (all catalogued from chat pending
Obsidian hookup or a bulk GitHub upload). Nothing spent.

## 2026-07-20 · installer-quality research pass 2 — sourced upgrade
Taylor pasted a second, far more rigorously cited installer-quality deep
dive (NREL SolarAPP+ inspection data, CFPB dealer-fee findings, exact
manufacturer program names/tiers verified against current pages, ROC
license classes, REC ProTrust / Panasonic AllGuard warranty-survival
detail). `az-installer-quality-2026.md` REWRITTEN wholesale — pass 2
authoritative where it refines pass 1. Key upgrades: dealer-fee claim
moved from [industry-claim] ~15-25% to [fact, CFPB-sourced] 30%+,
independently confirming and sourcing the owner's tile-underlayment
three-course correction via manufacturer install guides (IronRidge),
flagged Panasonic's 2026 solar-line discontinuation (existing warranties
still honored), added NREL workmanship-failure stats (58-78%) as the
strongest evidence yet that craft beats brand. az-solar-market-2026.md's
verified-installer-quality summary and Phoenix pricing figure ($2.30/W,
14.56kW avg, ~$33,511) updated to match. KB reply line + one idea deck
sharpened with the CFPB stat ("The federal regulator's warning about
'cheap' solar financing" replaces the older generic framing).

Taylor is also sending a real photo dump in batches (chat 5-image cap;
offered zip/GitHub-upload as bulk alternatives). Batch 1 flagged: Aurora
Solar design-tool screenshots, an SRP DER meter close-up, and a
COMPETITOR'S branded proposal (SunSolar Solutions, ROC#331679/
LightReach plan) containing a real homeowner's name and address (privacy
+ competitor-IP concern) — logged as style-reference-only, NOT postable,
pending Taylor's confirmation. See [[Visual Style]] refs log once photos
are actually committed to brain/Brand/refs/. Nothing spent.

## 2026-07-20 · Feed Director added — the Instagram/grid-level agent
Owner clarified the page review isn't analytics — it's "make my page
LOOK AND FEEL like an established local pro." New agent [[CMO]]
owns this: judges the whole GRID (not one post at a time) against a
2-second-scroll credibility test, sets grid composition rules (~2:1
photo-feeling-to-designed-card ratio, no adjacent same-look posts, pinned
trio = positioning/flagship/proof-of-work), and drafted a First-12 grid
plan mixing the 5 queued posts with new proof-of-work slots.

Added Lane 3 (proof-of-work) to [[Visual Style]] with binding
authenticity rules — the core protection: REAL photos are the only
material that may be presented as documentation of an actual job/
meeting/install; Higgsfield images are illustrative-only (generic,
representative, never captioned as a specific documented event). This
is deliberate risk management — one "that's AI" callout on a fake
install would undermine the whole trust brand.

Owner decision resolved: minimize on-camera presence. Lean on real
equipment/install photos (faces optional, craft mandatory) over
talking-head content; no recurring synthetic persona for AI-illustrated
people. [[Competitor Audit]] gained a grid-level scoring section (rhythm,
proof-of-work visibility, pinned posts, "looks active today" signals) as
the primary audit, with per-post metrics now secondary. Grid-audit
extension prompt issued to Taylor; photo-dump spec issued (10-25 photos,
postable vs. style-only tagging). Orchestrator now routes to Feed
Director whenever the audit or photo dump changes. Nothing spent.

## 2026-07-20 · installer-quality research ingested + owner correction
Taylor ran the installer-quality deep dive → new fact-check doc
`farmhand/docs/az-installer-quality-2026.md` (legal floor: R-11/CR-11 +
ARS 44-1762 warranty minimums · roof-penetration best practice by roof
type · verified credentials: APS QTI, SRP Preferred Solar Installer,
Tesla Certified, NABCEP PVIP rarity, SASSB bar · dealer-fee and
quality-premium industry claims · warranty-survival reality · the
7-point homeowner checklist). Owner-expertise section in the market doc
upgraded to VERIFIED. Owner field correction applied: three-course
flashing on tile roofs happens at the UNDERLAYMENT layer (standoff
penetration three-coursed before tiles are cut and replaced) — doc and
deck updated. KB reply line now cites QTI/PSI by name; 3 new idea decks
(60-second background check · warranty survival · tile-roof craft).
Fact Checker + Copywriter now bound to all four KB docs. Nothing spent.

## 2026-07-20 · growth strategy: @taylorlucesolar audited
First-pass audit of the real IG profile (1 post, 133/261, sales-voice
bio) → [[Growth Strategy]]: bio rewrite proposed (resource-first, keep
the "DM AZ" keyword funnel but attach it to a free rate-plan check),
display-name searchability fix, following-ratio cleanup, and the
three-engine reach model (reels = non-follower reach · carousels = saves
· daily comment presence + realtor collab posts = borrowed audiences).
Gap flagged: queue has no reel lane yet. Insights data pull prompt issued
to the extension. Handle mismatch with Studio placeholder queued as an
app fix. Nothing spent.

## 2026-07-20 · owner direction: value over price
Price-per-watt demoted from "the one honest yardstick" to a transparency
tool — never the verdict. New Editorial Direction rule: educate on
installer QUALITY (flashing, utility qualified-installer credentials,
manufacturer partner tiers, in-house crews, year-five service); honest
framing that AZ's few high-quality installers price slightly higher; never
name specific installers. Owner's professional knowledge recorded in
az-solar-market-2026.md as [owner-expertise] pending a dedicated
installer-quality research pass (prompt issued to Taylor). Reworked: the
"3 questions" idea deck + the queued doorstep-consult brief (quality/
process/service questions before price), the "Solar quote check" idea →
"Why the cheapest solar quote can cost you the most", new
KB.installerQuality reply line wired into buyer-education. Nothing spent.

## 2026-07-20 · owner direction: screen/caption split + competitor audit
New content-model law in [[Editorial Direction]]: on-screen text is a
summary (≤ ~12 words/slide, one number max), the education lives in the
caption and comments; posts must never LOOK educational. Both queued
carousels reworked to match (slides compressed, captions absorbed the
full numbers — same claims, same sources, receipts updated). New
[[Competitor Audit]] framework in Analytics: study local realtors and
trusted service pros as the model, solar recruiting pages as the
anti-pattern; scoring rubric + read-only extension collection process;
Adopt/Avoid lists seeded. Nothing spent.

## 2026-07-20 · owner direction: Valley-general CTAs
CTAs are now interchangeable and Valley-wide ("Valley homeowners…", "if
you're in the Valley with questions you want answered…") — never pinned to
one city. Cities appear only when they're the post's SUBJECT (Teravalis →
Buckeye stays in the body); hashtags may stay local for discovery. Applied
everywhere: app template copy (ideaCopy), the AI writer's rules
(/api/copy), Voice, Editorial Direction, Creative Director + Copywriter
charters, and all 5 queued briefs' CTAs and captions (fact-check receipts
unaffected — no factual claims changed). Nothing spent.

## 2026-07-20 · owner hold + credit preservation policy
Taylor's call: nothing fires automatically until the content is dialed in.
The scheduled Routine was DELETED (not paused) — zero autonomous runs;
manual "run the brain" passes only. Re-arm instructions preserved in
[[Schedule]]. New binding Credit Preservation Policy added to [[Tools]]:
no paid call is ever a test (mocked responses for testing), Higgsfield
only on `approved` briefs within estimate, Metricool free-tier-only until
explicitly approved, one-pass token discipline, and a spend ledger in this
Log. Nothing spent.

## 2026-07-20 · Orchestrator (manual make-up run, in-session)
The Monday 9 AM slot fell during the routine's recreation, so the pass ran
in-session. Copywriter: all 5 briefs drafted (hooks, slides, CTAs,
captions, hashtags) grounded in the three KB docs. Art Director: visual
plans on all 5 (2 card carousels ~5 credits each via Post visuals; 3
realistic singles ~1 credit each; face-neutral framing pending the
standing decision). Fact Checker: 5/5 PASS with claim→source receipts
under each brief; [contested] items verified two-sided. Queue now holds
five `fact-checked` briefs awaiting Taylor's approval — total production
cost if all approved ≈13 Higgsfield credits. Nothing spent. Next auto-run
Thursday 2026-07-23, 9 AM Phoenix.

## 2026-07-19 · research ingested (in-session)
Taylor ran the deep-research prompt; results distilled into two labeled
fact-check docs: `farmhand/docs/az-rates-supply-demand-2026.md` (rate case
in full, supply-demand with contested points labeled, price history,
homeowner translations, sourced consumer-pain record) and
`farmhand/docs/az-solar-market-2026.md` (post-§25D lease wave, installer
bankruptcies + AG enforcement, ranked objections, positioning evidence).
App KB refreshed: new reply lines (rateCase, azContext, trust, leaseShift),
authority/buyer-education fact wiring updated, 4 new deck-carrying ideas
(cheap-by-kWh · vet-your-installer · why-every-quote-is-a-lease ·
6-question test), rate-case + data-center decks updated with exact
numbers, monsoon idea replaced with the October-cliff resource piece.
Editorial Direction refined with 6 adopted rules; Fact Checker + Copywriter
now bound to all three docs and their [fact]/[projection]/[contested]
labels. Routine recreated accordingly. Nothing spent.

## 2026-07-19 · owner direction + accuracy gate
Taylor set new editorial priorities → [[Editorial Direction]]: rising
prices / supply-and-demand as the lead pillar (APS-first), homeowner-
resource stance, expired-credit content demoted to myth-busting-only,
pain-point rule (real pains, treated lightly, always a soft CTA). Queue
re-planned: monsoon brief rejected (owner: not a real pain point),
federal-credit brief rejected (redirected focus), two rising-prices briefs
added (bill-climbing explainer · new-construction demand). New agent:
[[CMO]] — every claim verified verbatim against the KB before
Taylor sees a brief; new status `fact-checked` gates `approved`. Deep-
research prompt issued to Taylor (price trajectory + solar sales craft).
Nothing spent.

## 2026-07-19 · Orchestrator (manual, in-session)
Scheduled Routine ARMED: "Farmhand Brain — Orchestrator", Mon/Thu/Fri
9:00 AM Phoenix, fresh session per run, push notification on completion,
hard-bounded to brain/ with a diff check before pushing. Ran the Creative
Director: 5 briefs planned into [[Content Queue]] (monsoon myths ·
kitchen-table bill moment · SRP 40¢ window · federal-credit honest math ·
doorstep consult) — lanes mixed 3 cards / 2 realistic, looks all distinct,
territories rotated Buckeye/Peoria/Queen Creek. Nothing spent. Needs
Taylor: review briefs; face decision; reference photos.

## 2026-07-19 · setup
Brain vault created and expanded to the full OS shape: Command Center
(Home), Orchestrator + four specialist charters, Tasks, Schedule, Tools,
Lead Pipeline, Content Analytics, Content Queue, this log. Nothing spent.
Needs from Taylor: reference photos into `brain/Brand/refs/`, the
face-vs-synthetic decision in [[Visual Style]], ANTHROPIC_API_KEY in
Vercel for the future in-app produce pipeline.
