# Design & Format Playbook

> **Canonical spec:** the full machine-readable system is
> **`farmhand/docs/content-engine-spec-2026.md`** — "DESERT GRID Content Engine
> Spec v1.0" (ingested 2026-07-22). It has the exact brand tokens (hex, px,
> type), all 16 archetypes with YAML params, the 20 pre-publish QA gates, reel
> recipes, the 5 content pillars, and the current AZ fact bank. **On any
> conflict, the spec wins.** This page is the human-readable summary.

Ingested from Taylor's ChatGPT deep-research pass (2026-07-22). This is the
binding visual + format system for the account — the [[CMO]]'s design gate,
the same way `az-rising-costs-heat-datacenters-2026.md` is its accuracy gate.
Pairs with [[Visual Style]] (mood/look) and [[Editorial Direction]] (voice).

## Brand tokens (DESERT GRID — from the spec)
- **Palette (5, max 3/slide):** `PAPER #F4F0E6` bg · `INK #14161A` type · `ACCENT_HOT #E8622C` = "this costs you money / the number that matters" (≤15% of pixels, never decorative, one per slide) · `DATA_COOL #0F5A63` = the reader's win (solar/battery/savings) · `NEUTRAL #B9B2A2` = the status quo/comparison · `ALERT #9E1B14` (rare) · `NIGHT #101820` alt surface. **Grey the field, color the subject.**
- **Type:** P1 "Newsroom" — Inter Tight 700 (display) + Inter 400/500 (body), tabular figures. Max 2 faces/slide. Sharp corners (0px cards) read editorial.
- **Furniture (every slide):** small wordmark (≤3% canvas, fixed corner), slide index `03 / 08` (mono), and a **source line on every slide with a number** (`Source: ACC Docket E-01773A-25-0105 · Jul 2026`). The source line is the trust device.
- **Pillars (rotate, never 2 in a row):** P1 Rate Watch 25% · P2 Bill School 25% · P3 Grid File 20% · P4 Straight Answers 20% · P5 Field Notes 10%.

**North-star standard:** every post should look like *a page torn from a smart
local energy publication* — obvious sourcing, restrained color, repeat
structure, a tight claim↔visual-proof relationship. **Test:** if the post
still works after cutting 30–40% of its text, it's right. If it collapses when
text is cut, the visual is doing too little.

## The strategic split (job per format)
- **Reels → reach/discovery** (especially non-followers). First frame must land *topic + stakes + audience + location* in ~1 sec.
- **Carousels → authority + saves.** They behave like mini-documents / reference sheets.
- **Field / story content → conversion to DMs.** Human, local, personality.
- The topic stack already carries built-in tension (APS 4–7pm peak, SRP 6–9/5–10pm, 430 Maricopa heat deaths in 2025, data-center grid strain) — we don't manufacture urgency, we package it cleanly.

## Template archetype library (rotate — never one look)
Reproduction specs distilled from Visual Capitalist, Sherwood/Chartr, Statista,
Our World in Data, Axios Visuals, Carbon Brief, Reuters Graphics, Finshots,
Information is Beautiful, The Pudding, Brew Markets. Match message → archetype.

| # | Archetype | Reproduction spec | Best for |
|---|---|---|---|
| 1 | **Monument poster** (Visual Capitalist) | 4:5, 12-col grid. Eyebrow top-left, stacked headline upper third, one dominant graphic/map 55–70% of canvas, callouts around perimeter, thin source footer. Condensed heavy display + clean sans. 1 bg / 1 data hue / 1 accent. | Annual "where your bill goes", utility breakdowns, statewide grid maps |
| 2 | **Single-chart headline card** (Sherwood/Chartr) | One chart fills 70–80%. Headline top-left 2–4 lines, subtitle w/ units+timeframe under it. Direct-label series (no legend). Brand + source in opposite bottom corners. Off-white/light-gray bg. | One sharp stat, one trend, one clear winner/loser |
| 3 | **Small-multiple benchmark** (Statista) | Title block, then 2×2 or 1×4 mini-charts, identical axes/labels, one accent family. Source under grid, logo lower-right. | APS vs SRP structures, 4 ZIP bill scenarios, battery ROI scenarios |
| 4 | **Source-first line chart** (Our World in Data) | Restrained: headline+chart title above, chart fills most of frame, **source line prominent**, direct labels, thin gridlines, generous whitespace. | Long-run trends: price history, heat deaths, cooling-load growth |
| 5 | **Annotated brevity bar** (Axios) | Short header, simple chart, a few tactical annotations doing the storytelling. 1–2 emphasized values. Explanation lives in caption/next slide. | Short local data hits — "why your summer bill feels worse" |
| 6 | **Map + takeaway strip** (Axios) | Map/choropleth center-right 60%, title+1–2 sentence frame above/left, source strip bottom. One hue scale, strip counties/roads, legible at phone size. | Service-territory maps, hottest ZIPs, solar potential, data-center siting |
| 7 | **Map + table legend** (Carbon Brief) | Large map upper 2/3, structured legend/mini-table below (doubles as evidence). ≤3–4 data colors, informative never decorative. | Progress trackers, county solar uptake, "which areas on which plan" |
| 8 | **Explainer stack w/ method cues** (Carbon Brief) | Each slide = one method step: headline, chart/map, visible source/method line. Brand from consistent scaffolding. Shows its homework — good for contested topics. | Data centers & grid, net-metering myths, battery economics |
| 9 | **Map-and-reportage panel** (Reuters) | Newsroom package: one map/diagram main object + concise captions/inset panels. Neutral editorial type. | "What changed where", infrastructure, policy maps |
| 10 | **Cutaway diagram** (Reuters) | Labeled schematic/cross-section/process diagram. Headline above, numbered labels/arrows explain stages. Muted functional color. | "How a battery changes your bill", how TOU pricing hits, how data-center load hits the grid |
| 11 | **Ring / revenue-mix wheel** (Finshots) | Circle chart center, outer labels on thin leader lines, tiny related palette, one figure per segment. Don't over-segment. | "What makes up your bill", "where peak demand comes from" |
| 12 | **Category bars + icons** (Finshots) | Strong title, 6–10 horizontal bars w/ small icons + short labels, soft-gray bg, source footer. Easy to localize. | Appliance usage, "which changes move the bill most" |
| 13 | **Concept poster / quadrant** (Information is Beautiful) | Poster driven by a central organizing metaphor (Venn/quadrant/spectrum). Flat shapes, generous labels, harmonious palette. Only when the category system *is* the story. | Myth-busts, decision trees, "good vs bad solar fit" |
| 14 | **Scene-by-scene visual essay** (The Pudding) | Sequence where each slide adds ONE visual layer. Shorter sentence-case headlines, graphic does the work. Narrative, not static. | Causality carousels: "why your bill spikes after sunset" |
| 15 | **Outlier scatter** (Brew Markets) | Big scatter, only a few labeled points (like characters), clutter removed. One accent for points, one darker for annotation. | "Which home features drive summer usage", solar-penetration outliers |

## Design-system rules (hard ceilings — enforce these)
| Area | Rule |
|---|---|
| Cover words | **6–12 words max.** Cover is a poster, not a paragraph. |
| Internal slide (w/ chart) | 18–35 words total. **Text-only slide:** 35–55 max. Never >3 short lines per block. |
| Text blocks/slide | **Max 2** — one headline + one support. Third block → new slide. |
| Headline hierarchy | Headline 2.5–4× body size. A numeric hero may exceed headline size. |
| Hero-number rule | If the number is the point, **isolate it**: one number, one unit, one short qualifier. `430 · heat-related deaths · Maricopa County, 2025` — never buried in a sentence. Applies to `4–7pm`, `$110/kW`, `up to 4°`, etc. |
| Body function | Body does ONE of: define, compare, interpret. Not hook+narrate+qualify at once. |
| Palette | 1 neutral bg family + 1 primary hue + 1 secondary data hue + 1 accent. **≤4 recurring colors** system-wide. |
| Background | **Never flat black.** Warm white, light sand, utility-gray, dusty sage, muted cream, or 2–4% paper/noise. Light gray is the Chartr/Statista default. |
| Type pairing | One serious sans (body/labels) + one high-contrast display sans or restrained serif (headlines). Contrast, not novelty. |
| Footer (every slide) | `slide # / source / @handle` — small. **Publication footer, not a logo splash.** Logo never larger than the source line. Visible sourcing = credibility. |
| Cover formula | Include ≥2 of 4: locality (AZ/Phoenix), specific stake, specific number/time-window, curiosity gap. Patterns: "The hidden cost of…", "Why Arizona bills spike after…", "The one APS/SRP rule most homeowners miss", "What happens if… in Phoenix heat". |
| Typographic rhythm (1080×1350) | margins 72–96px · eyebrow 24–32px · headline 72–120px · body 30–40px · footer 20–24px. Keep negative space visible. |

## Reel & field recipes (local-expert hybrid)
Models: Javier Vidana (Phoenix educational), Glennda Baker (story-led), Ryan
Serhant (walk-and-talk + media mindset). NAR 2024: social = highest-quality
lead source for agents. **Conversion object is always a useful ASSET**
(checklist, worksheet, plan selector, bill-audit rubric) — never an
appointment request. Viewer feels they're asking a local expert for a tool.

| Format | Hook (first 1–2s) | Shot list / pace / length | On-screen text | Lead path |
|---|---|---|---|---|
| **Street-corner reality check** | "If you live in Phoenix, this is costing you more than you think." | You on location → 3–5 B-roll (power lines, rooftop AC, meter, skyline, bill close-up). 20–35s, cut every 1.5–2.5s. | One line per shot, mid safe-zone | "DM BILL for the rate-plan checklist." |
| **Story-led myth-bust** | "A homeowner told me solar stopped making sense in AZ. That's not the real problem." | Face, eye contact → one proof graphic → one field cutaway. 25–45s, voice carries it. | Strong headline 2s then captions only; don't cover eyes/mouth | "Comment or DM RATE for the APS vs SRP version." |
| **Walk-and-talk diagnosis** | "The mistake AZ homeowners make between 4 and 7pm is this." | Walk toward/through driveway/garage/roofline, alternate talking-head + detail. 20–30s. Motion = polish. | Hook large on opening frame, then 3–5 word labels | "DM SHIFT for the one-page off-peak sheet." |
| **Bill teardown POV** | "Here's the line on your bill most people ignore." | Overhead bill, finger tracks one line → you interpret → back to bill. 15–25s. | Arrows/circles + one highlighted number | "Send me your plan name, I'll tell you what to look at." |
| **Heat-day field test** | "It's 114° today. Here's when your house gets most expensive." | Thermometer/weather screen, AC running, thermostat, window light, you explaining timing. 20–40s. | Reinforce windows: 2pm/4pm/6pm/after sunset | "Save this for the next heat warning" / "DM HEAT". |
| **Map reaction reel** | "This Arizona map matters if your bill keeps jumping." | Map full-screen → PiP talking head → zoom to local area. 18–30s. | One headline + one arrow/circle | "DM me your ZIP for the local version." |
| **Scenario comparison** | "Same house. Two utility habits. Very different bill." | Split-screen A/B (on-peak vs shifted) → comparison card. 20–35s. | `ON PEAK` / `OFF PEAK`, big legible | "DM which you are (family/retiree/EV) for your version." |
| **Comment-answer** | "You asked: 'Do batteries only help in outages?'" | Screenshot comment → answer on camera → one graphic → practical answer. 15–30s. | Biggest text = the question | "Leave your utility question, I'll pick the next one." |

**Phone-shoot discipline** (quality from technique, not gear): rear camera, clean lens, 30fps (60 only for motion), **AE/AF lock before speaking**, physically move don't pinch-zoom, eyes on upper-third, prioritize audio (close mic/lav) over visual, open shade / window light / golden hour — never harsh noon sun, keep text in central safe zone.

## Saves / shares / views mechanics
- **Saves = future utility.** Make it a reference sheet: "APS 4–7pm appliance cheat sheet", "battery vs no-battery decision tree". Viewer thinks "I'll need this later." Carousels win saves.
- **Shares = person-directed.** Viewer must instantly know *who* needs it (spouse, parent, neighbor, pool owner, EV owner, Phoenix transplant). High-arousal emotions (awe, anger, anxiety) share more than sadness. Instagram weights *sends per reach* heavily.
- **Views = won before the explanation.** First frame = clear promise + motion/contrast + progressive disclosure. "Phoenix homeowners: this 4–7pm mistake raises your bill" > "Let's talk energy today." Reels win reach.
- **Save arc:** problem → proof → interpretation → simple action.
- **Share arc:** surprising local truth + social relevance + easy retell.
- **Don't optimize for** likes, motivational quotes, or overproduced trend audio — sends/saves/meaningful engagement drive distribution.

## Automation operating spec (the engine obeys this per post)
| Field | Spec |
|---|---|
| **Primary objective** | Pick exactly ONE: reach / save / share / DM. Don't mix. |
| **Format decision** | reach → Reel · save/share → carousel · DM → Reel or field post + asset-CTA. |
| **Template selector** | 1 datapoint → single-chart card · comparison → small multiples · territory/ZIP → map · mechanism → cutaway · decision → quadrant/concept · story → scene-by-scene. |
| **Slide count** | Carousel default **6**; use 8 only for story/myth-bust. |
| **Carousel order** | Cover → proof number/chart → interpretation → local implication → decision/action → save/share/DM CTA. |
| **Reel beat order** | Hook frame → talking-head claim → field/bill/chart proof → one takeaway → tool-CTA. |
| **Source stack** | Primary/local first: aps.com, srpnet.com, AZ Corp Commission, Maricopa Public Health, ADHS → then DOE/Berkeley Lab, EPRI, OWID, Carbon Brief, Reuters. |
| **Data-object rule** | One slide, one dominant object. Two charts → small-multiples or split. |
| **Source visibility** | Every data slide gets a visible micro-source in the footer; every Reel gets source in caption + on-screen stamp on the proof shot. |
| **Branding** | Footer only, no oversized watermark. |
| **CTA mapping** | reach → light/none · save → "save this for your next bill review" · share → "send this to whoever handles your power bill" · DM → keyword (PLAN/SHIFT/HEAT/BILL/RATE). |
| **Visual QA** | one hierarchy, one focal point, one accent, readable source line, ≤2 text blocks, safe-zone on vertical video, consistent footer. |

**Weekly rhythm:** 1 discovery Reel · 2 authority carousels · 1 field/community Reel. (News-reaction reel handles APS/SRP/data-center changes; one carousel explains a homeowner decision; one packages a chart/map; the field Reel humanizes locally.)

## Still open (needs the next research pass or owner input)
- Exact **brand palette** hexes + the two **licensed/embeddable typefaces** to standardize on (playbook gives directions, not final picks).
- Where **Higgsfield photos** anchor vs. where slides stay purely typographic/data (see the Higgsfield prompt system — separate build).
