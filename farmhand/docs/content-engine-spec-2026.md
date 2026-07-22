# DESERT GRID — CONTENT ENGINE SPECIFICATION v1.0
### A reusable visual + video system for an Arizona solar & home-energy education brand
**Audience for this doc:** a human designer, a Figma/Canva template builder, or an automated content-generation pipeline.
**Format:** every section is written as parameters, explicit limits, and repeatable recipes.

---

## §0. HOW TO READ THIS SPEC

| Notation | Meaning |
|---|---|
| `PARAM` | A variable the engine fills per post |
| **HARD LIMIT** | Never exceed. Fail the render and re-write copy instead. |
| **SOFT TARGET** | Aim for; deviation allowed with reason |
| `[ZONE]` | A named region of the canvas grid |
| ARCHETYPE-ID | Reference key, e.g. `A03` |

**The core thesis of this system:** amateur energy content looks amateur because it uses *one* layout (big bold text, three sentences) for *every* kind of idea. Professional informational accounts have a **library of layouts, each matched to a content shape** — a stat wants a different container than a timeline, which wants a different container than a myth-bust. Rotating through a fixed library is what reads as "established source." Consistency of *system* plus variety of *layout* = institutional credibility.

---

## §1. GLOBAL BRAND TOKENS

Every archetype inherits these. Change them once, and the whole library re-skins.

### 1.1 Canvas

| Token | Value | Note |
|---|---|---|
| `CANVAS_FEED` | 1080 × 1350 px (4:5) | **HARD** — max vertical feed real estate |
| `CANVAS_VIDEO` | 1080 × 1920 px (9:16) | Reels/Stories |
| `MARGIN_OUTER` | 72 px all sides | **HARD MIN 60 px** (Instagram edge crop) |
| `COL_COUNT` | 6 | |
| `COL_WIDTH` | 136 px | |
| `GUTTER` | 24 px | |
| `CONTENT_WIDTH` | 936 px | |
| `BASELINE` | 18 px | All vertical spacing = multiple of 18 |
| `RADIUS` | 0 px (cards) / 8 px (chips) | Sharp corners read editorial; rounded reads SaaS |
| `SAFE_VIDEO_TOP` | 250 px | Instagram UI |
| `SAFE_VIDEO_BOTTOM` | 400 px | Instagram UI — caption, buttons, audio ticker |
| `SAFE_VIDEO_RIGHT` | 120 px | Action button rail |

**Video text rule:** all burned-in text lives in the vertical band **y = 380 → 1420 px**. This is non-negotiable — off-safe-zone text measurably suppresses completion rate because viewers can't read it and swipe away.

### 1.2 Palette — the discipline

**HARD LIMIT: 5 colors total in the system. Maximum 3 visible on any single slide.**

| Role | Token | Hex | Usage ceiling |
|---|---|---|---|
| Paper (primary bg) | `PAPER` | `#F4F0E6` | 60–75% of pixels |
| Ink (type, rules) | `INK` | `#14161A` | 15–25% |
| Accent — heat/cost | `ACCENT_HOT` | `#E8622C` | **HARD MAX 15% of pixels** |
| Data cool — savings/solar-owned | `DATA_COOL` | `#0F5A63` | Charts only |
| Neutral mid — comparison bars, "other" | `NEUTRAL` | `#B9B2A2` | Charts only |
| Alert (rare) | `ALERT` | `#9E1B14` | ≤1 element per carousel |
| Night bg (alt surface) | `NIGHT` | `#101820` | Used on ≤2 slides per carousel |

**Color logic — the rule the engine applies:**
1. `ACCENT_HOT` means *"this is the thing that costs you money / this is the number that matters."* It is never decorative. One accent object per slide.
2. `DATA_COOL` always = the reader's outcome (solar, battery, savings). Never swap.
3. `NEUTRAL` = the baseline / status quo / everyone else. Grey the comparison, color the subject.
4. Never use accent for body text. Never use two accents on one slide.
5. Gradients: allowed only as a single-hue 6% duotone wash over photography. No purple-to-pink SaaS gradients.

### 1.3 Type pairings that read "studio-designed"

Pick **one** pairing and never mix across the account. Each is listed with a premium option and a free Google Fonts equivalent.

| Pairing | Display / Headline | Body / UI | Numerals | Reads as |
|---|---|---|---|---|
| **P1 "Newsroom"** *(recommended)* | Söhne Kräftig → free: **Inter Tight, 700** | Söhne Buch → free: **Inter, 400/500** | Inter, tabular figures | Chartr, Sherwood, Morning Brew |
| **P2 "Editorial contrast"** | GT Sectra / Publico → free: **Fraunces, 700 opsz 144** | Söhne → free: **Inter, 400** | IBM Plex Mono | The Atlantic, NYT explainer |
| **P3 "Data desk"** | IBM Plex Sans, 600 | IBM Plex Sans, 400 | **IBM Plex Mono, 500** | Our World in Data, FT |
| **P4 "Loud brief"** | Archivo Black / Anton (condensed) | Public Sans, 400 | Archivo, tabular | The Hustle, Morning Brew Reels |

**Typographic rules (HARD):**
- Max **2 typefaces** per slide. Weight and size do the rest of the work.
- Display tracking: **−2% to −3%**. Body tracking: **0**. Small caps eyebrow: **+8%**.
- Display line-height **1.02–1.12**. Body line-height **1.35–1.45**.
- **Never** stretch, skew, outline, or drop-shadow type. Never use all-caps for anything longer than 4 words.
- All numerals in charts and stat blocks must be **tabular lining figures** so digits align vertically.
- **Minimum type size anywhere: 28 px** at 1080 canvas width. If copy won't fit at 28 px, the copy is too long — cut it.

### 1.4 Background treatments (the "not flat black" list)

Rotate through these. Flat black and flat white both read as template-default.

| ID | Treatment | Spec |
|---|---|---|
| `BG-1` | **Warm paper** | Flat `PAPER` + 3% monochrome grain overlay (noise, 0.4 px) |
| `BG-2` | **Tinted paper** | `PAPER` shifted 4% toward `DATA_COOL` or `ACCENT_HOT` — a whole-slide tint that signals topic category |
| `BG-3` | **Ink field** | `NIGHT` + 4% grain + one 1 px `NEUTRAL` hairline rule at the 72 px margin |
| `BG-4` | **Blueprint grid** | `PAPER` + 8% opacity 72 px grid lines; use for how-it-works diagrams |
| `BG-5` | **Photo, 3/4 bleed** | Field photo with a 0→70% `NIGHT` vertical gradient scrim across the bottom 40% |
| `BG-6` | **Duotone photo** | Photo mapped `NIGHT` → `PAPER`, single accent object left in full color |
| `BG-7` | **Split field** | Canvas divided at a column line: 2 cols `NIGHT` / 4 cols `PAPER`. Used for comparisons. |

**Rule:** a single carousel uses **at most 3 background treatments**. Cover and closer should share one; body slides share another.

### 1.5 Persistent furniture (branding conventions)

These appear on **every** slide and are the single biggest "established source" signal.

```
FOOTER_LEFT   = WORDMARK (24px, INK @ 55% opacity, tracking +6%)
FOOTER_RIGHT  = SLIDE_INDEX "03 / 08" (24px, IBM Plex Mono / tabular, 55% opacity)
FOOTER_Y      = canvas_height − 72px baseline
SOURCE_LINE   = 24px, INK @ 50%, sits 18px above FOOTER on any slide containing a number
HAIRLINE      = 1px INK @ 20%, full content width, 18px above footer row
```

- **Wordmark:** small. Amateur accounts make the logo big; professional ones make it small, consistent, and always in the same corner. 24–28 px, never above 3% of canvas area.
- **Slide index** is mandatory on carousels of 4+. It tells the reader the piece has a defined length — measurably improves completion.
- **Source line** is mandatory on every slide with a figure. Format:
  `Source: Arizona Corporation Commission, Docket E-01773A-25-0105 · Jul 2026`
  This is the trust device. It is the difference between "some solar guy" and "a source."

---

## §2. TEMPLATE ARCHETYPE LIBRARY (15)

Each archetype is a container matched to a **content shape**. The engine picks the archetype from the shape of the data, not from aesthetics.

**Rotation rule:** no archetype may appear as the *cover* more than once per 6 posts. Body slides may reuse freely within a carousel.

---

### A01 — HERO NUMBER CARD
**Reference:** Visual Capitalist (@visualcap, ~410K IG) stat cards; Chartr (@chartrdaily, ~515K IG) daily number posts.
**Content shape:** one figure that is surprising on its own.
**Swipe role:** cover, or slide 2 of any carousel.

**Layout & grid**
```
[EYEBROW]     cols 1–6, y = 72          — category label, 30px, small caps, ACCENT_HOT
[HERO_NUM]    cols 1–6, y = 300–760     — the number, optically centered, NOT mathematically
[UNIT]        baseline-aligned to HERO_NUM, 25% of its size, INK @ 60%
[SUBHEAD]     cols 1–5, y = 820         — 1 sentence, ≤14 words, 44px
[CONTEXT]     cols 1–4, y = 980         — the comparison that makes it land, ≤18 words, 34px
[SOURCE]      footer row
```

**Type treatment:** `HERO_NUM` at 260–420 px depending on digit count. Tracking −4%. Unit ("¢/kWh", "%", "$/mo") set at 25% of the numeral size and **baseline-aligned**, never centered — this one detail separates pro from amateur.

**Color logic:** `BG-1` or `BG-2`. Number in `INK`; the *unit* or a single underline swash in `ACCENT_HOT`. Nothing else colored.

**The "one number as hero" doctrine:**
> A number written inside a sentence is *read*. A number set as an object is *remembered and screenshotted*.
> If the figure is the point, it gets its own slide, at ≥240 px, with ≤18 words of support. If the figure is merely supporting evidence, it stays in the sentence at body size, bolded. Never in between.

**Parameters**
```yaml
archetype: A01
eyebrow: str(≤4 words)
hero_number: str(≤6 glyphs incl. separators)
unit: str(≤7 chars)
subhead: str(≤14 words)
context: str(≤18 words)
source: str
bg: [BG-1, BG-2, BG-3]
```

**Populated example (AZ)**
```
EYEBROW:  WHAT APS PAYS YOU
HERO:     6.171
UNIT:     ¢ / kWh
SUBHEAD:  What APS credits you for solar you export in 2026.
CONTEXT:  You buy it back at 16–33¢ depending on the hour. That gap is the whole battery argument.
SOURCE:   APS Rate Rider RCP, Tranche 2025 (Sep 1 2025 – Aug 31 2026)
```

---

### A02 — RANKED BAR LIST
**Reference:** Visual Capitalist ranked infographics; Voronoi.
**Content shape:** 5–10 items ordered on one metric. Comparison, leaderboard, "where does Arizona rank."
**Swipe role:** body, or standalone single post.

**Layout & grid**
```
[HEADLINE]   cols 1–6, y = 72–200, ≤9 words, 68px — must state the FINDING, not the topic
[SUBHEAD]    cols 1–5, 34px, ≤20 words — the "so what"
[BAR_STACK]  cols 1–6, y = 320–1120
   row height = 84px, gap = 18px, max 9 rows
   label LEFT-aligned inside or outside bar start (never centered)
   value RIGHT-aligned at bar terminus, tabular figures, 36px
[SOURCE]     footer row
```

**Type treatment:** labels 34 px `INK`; values 36 px tabular. Subject row's label goes 600 weight; all others 400.

**Color logic:** **grey everything, color one bar.** All bars `NEUTRAL`; the subject row (Arizona, or the reader's utility) in `ACCENT_HOT`. This is the single highest-leverage chart move in the system — it converts a chart into an argument.

**Parameters**
```yaml
archetype: A02
headline: str(≤9 words)   # finding, not topic
subhead: str(≤20 words)
rows: [{label: str(≤22 chars), value: float, highlight: bool}] (5–9)
value_format: ["$", "%", "¢/kWh", "×"]
sort: desc | asc
```

---

### A03 — ANNOTATED LINE CHART
**Reference:** Chartr / Sherwood News; the Financial Times' John Burn-Murdoch approach to annotation.
**Content shape:** a trend over time. Rate history, bill history, demand growth.
**Swipe role:** body slide 2–4. The credibility anchor of any carousel.

**Why annotation, not minimalism:** eye-tracking research cited by Burn-Murdoch shows readers scan a chart in a **Z pattern — title, then axes, then data.** In tested comparisons, heavily and well-placed annotated charts outperformed minimalist charts with audiences; stripped-back "Tufte-pure" charts ranked lowest for general readers. **Design for the general reader, not the data purist.**

**Layout & grid**
```
[NARRATIVE_TITLE] cols 1–6, y = 72, ≤10 words, 60px
   MUST be the conclusion. "APS rates rose 4× faster than inflation" — NOT "APS rate history"
[STANDFIRST]      cols 1–5, 32px, ≤22 words
[PLOT]            cols 1–6, y = 330–1080
   axis lines: 1px INK @ 25%; NO gridlines except 3–4 horizontal at 12% opacity
   line weight: 6px for subject series, 3px NEUTRAL for comparison series
   NO legend — label the line ends directly, 30px, in the line's own color
[ANNOTATION]      2–4 max. 28px text + 1.5px leader line/arrow to the data point
[SOURCE]          footer row
```

**Type treatment:** direct end-of-line labels only. A legend is a failure state — it forces the reader to translate.

**Color logic:** subject series `ACCENT_HOT`, comparison series `NEUTRAL`, annotation text `INK` with a `PAPER` 6 px halo so it reads over the plot.

**Parameters**
```yaml
archetype: A03
narrative_title: str(≤10 words)   # a claim
standfirst: str(≤22 words)
series: [{name, points:[{x,y}], role: subject|comparison}]
annotations: [{x, y, text: str(≤12 words), anchor: above|below|left|right}] (2–4)
y_format: ["$", "¢", "%", "MW"]
```

---

### A04 — SMALL MULTIPLES GRID
**Reference:** Our World in Data (@ourworldindata); FT data desk.
**Content shape:** the same chart repeated across 4–6 categories. Months, rate plans, neighborhoods, utilities.
**Swipe role:** body. High save-rate — it's a reference table people return to.

**Layout & grid**
```
[HEADLINE]  cols 1–6, y = 72, ≤9 words
[SUBHEAD]   cols 1–6, 32px, ≤18 words
[GRID]      2 × 3 or 3 × 2 tiles, each tile = 2 cols × 300px, gutter 24px
   each tile: micro-title 30px top-left, mini chart, one value callout 44px
   IDENTICAL y-axis scale across all tiles — HARD RULE, non-negotiable
[KEY_LINE]  one sentence, 32px, stating the pattern the grid reveals
[SOURCE]    footer
```

**Color logic:** all tiles `NEUTRAL` except the one that proves the point → `ACCENT_HOT`.

**Parameters**
```yaml
archetype: A04
headline: str(≤9 words)
tiles: [{title: str(≤18 chars), values: [float], callout: str(≤8 chars), highlight: bool}] (4–6)
shared_y_max: float   # enforced identical
key_line: str(≤20 words)
```

---

### A05 — MAP CARD
**Reference:** Visual Capitalist geographic infographics; Our World in Data choropleths.
**Content shape:** anything geographic. Where data centers are, which ZIPs have the highest bills, utility service territories.
**Swipe role:** cover or body. **Highest share-rate archetype for local content** — people send maps of their own area to neighbors.

**Layout & grid**
```
[HEADLINE]   cols 1–6, y = 72, ≤8 words
[MAP]        cols 1–6, y = 260–1050, map fills 100% of this block
   no country/state outline beyond the subject geography
   labels set INSIDE the map, 28–32px, with PAPER halo
[LEGEND]     horizontal, cols 1–4, directly under map, 26px, 5 swatches max
[CALLOUT]    1–2 pin annotations, 30px
[SOURCE]     footer
```

**Color logic:** sequential single-hue ramp `PAPER → ACCENT_HOT` (5 steps max). Never rainbow. Never red-green (colorblind failure). Non-subject geography at `NEUTRAL` 20%.

**Local rule:** always label 3–5 recognizable municipalities (Surprise, Peoria, Goodyear, Buckeye, Glendale). Recognition of one's own town is the share trigger.

**Parameters**
```yaml
archetype: A05
headline: str(≤8 words)
geo_level: [state, county, zip, utility_territory]
values: {geo_id: float}
ramp_steps: 5
pins: [{lat, lng, label: str(≤6 words)}] (0–2)
anchor_cities: [str] (3–5)
```

---

### A06 — EDITORIAL COVER (EYEBROW + PUNCH HEADLINE)
**Reference:** Morning Brew (@morningbrew); Axios; Sherwood News.
**Content shape:** the default cover for any explainer carousel.
**Swipe role:** **cover only.**

**Layout & grid**
```
[EYEBROW]    cols 1–6, y = 96, 30px, small caps, +8% tracking, ACCENT_HOT
             — a category, e.g. "RATE WATCH" / "BILL SCHOOL" / "GRID FILE"
[RULE]       1px hairline, cols 1–6, y = 148
[HEADLINE]   cols 1–6, y = 300–860, 92–120px, ≤9 words, line-height 1.05
[KICKER]     cols 1–4, y = 900, 36px, ≤14 words — the promise/open loop
[WORDMARK]   footer left
[SWIPE_CUE]  footer right: "→" or "01 / 08"
```

**Type treatment:** headline is the largest text; kicker is exactly 1/3 its size. Never center the headline — flush left, ragged right. Centered display type is the #1 amateur tell.

**Color logic:** `BG-1`, `BG-3`, or `BG-6`. One word of the headline may be set in `ACCENT_HOT` or given an `ACCENT_HOT` underline — **one word, once.**

**Cover formulas (the engine picks one):**

| ID | Formula | Example |
|---|---|---|
| `F1` Number gap | `[NUMBER] + [noun] + [unresolved consequence]` | "Your bill has 11 line items. Two of them aren't electricity." |
| `F2` Named enemy | `[Entity] is [verb] + [your thing]` | "APS wants 14%. Here's what the docket actually says." |
| `F3` Reversal | `Everyone thinks [X]. The filing says [Y].` | "Solar 'doesn't pay' in Arizona. The 2026 export rate says otherwise." |
| `F4` Local proof | `[Specific place] + [specific number]` | "A 2,400 sq ft house in Surprise. A $412 July bill. Here's the breakdown." |
| `F5` Deadline | `[Date] + [what changes] + [who's affected]` | "Sept 1: the export rate drops again. What that locks in." |
| `F6` Forbidden knowledge | `What [insiders] know about [thing you pay for]` | "What's actually in the rate case nobody reads" |
| `F7` Cost of inaction | `[Doing nothing] costs [specific number]` | "Waiting one year costs the average Surprise homeowner $___" |

**HARD LIMIT:** headline ≤ **9 words** and ≤ **52 characters**. If it doesn't fit, it isn't a headline, it's a sentence.

---

### A07 — HIGHLIGHTER TEXT SLIDE
**Reference:** The Hustle (@thehustle); Morning Brew's conversational voice slides.
**Content shape:** a claim or takeaway with no data visual. The connective tissue between chart slides.
**Swipe role:** body, transition, or closer.

**Layout & grid**
```
[STATEMENT]  cols 1–5, vertically centered as an optical block, 56–64px, ≤22 words
   1–3 phrases receive a HIGHLIGHT: a 0.55em-tall ACCENT_HOT bar behind the text
   at 35% opacity, offset −4px from baseline (marker, not fill)
[ATTRIBUTION or MICROCOPY]  cols 1–4, 30px, INK @ 60%
[SOURCE]     footer if any figure appears
```

**Color logic:** `BG-1`. Text `INK`. Highlight `ACCENT_HOT` @ 30–40% — it must sit *behind* the ink, never invert it.

**HARD LIMIT: ≤22 words, and no more than 3 highlighted phrases.** Highlighting more than a third of a sentence highlights nothing.

**Parameters**
```yaml
archetype: A07
statement: str(≤22 words)
highlight_spans: [str] (1–3)   # substrings of statement
microcopy: str(≤12 words) | null
```

---

### A08 — SMART-BREVITY BULLET CARD
**Reference:** Axios (@axios) "Why it matters / By the numbers / The bottom line" structure.
**Content shape:** structured argument in 3 beats. The workhorse body slide.
**Swipe role:** body slides 3–6.

**Layout & grid**
```
[SECTION_LABEL]  cols 1–6, y = 72, 30px, small caps, ACCENT_HOT
                 — one of: WHY IT MATTERS / BY THE NUMBERS / THE CATCH / BOTTOM LINE
[RULE]           1px hairline
[BULLETS]        cols 1–6, 3 rows max
   each row: [BOLD LEAD-IN, 40px] + [em dash] + [explanation, 36px regular]
   row gap = 54px; leading bullet glyph = 8px ACCENT_HOT square, NOT a dot or emoji
[SOURCE]         footer
```

**HARD LIMIT: 3 bullets. Each bullet ≤ 16 words. Slide total ≤ 42 words.**

**Color logic:** `BG-1`. Only the section label and the bullet squares carry accent.

---

### A09 — PHOTO + SCRIM CAPTION
**Reference:** National Geographic (@natgeo); NYT / Washington Post photo-explainer posts.
**Content shape:** field content, install photos, a data center on the horizon, a rooftop at 115°F.
**Swipe role:** cover (high stop-power) or the "proof I was actually there" slide.

**Layout & grid**
```
[PHOTO]     full bleed 1080×1350
[SCRIM]     linear gradient NIGHT 0% → 78%, occupying bottom 46% of canvas
[EYEBROW]   cols 1–5, 30px small caps, PAPER @ 80%
[CAPTION]   cols 1–5, 52px, ≤16 words, PAPER
[MICRO]     cols 1–4, 28px, PAPER @ 65% — location + date, e.g. "Surprise, AZ · Jul 2026"
[WORDMARK]  footer left, PAPER @ 55%
```

**Color logic:** `BG-5`. The photo stays untouched except the scrim. No color overlays, no filters that shift skin tone.

**Photo rules:** shot in the field (see §4.7). Real hardware, real roofs, real meters. **Zero stock photography** — stock is the fastest way to lose local credibility. If a photo must be sourced, use `BG-6` duotone so it reads as a graphic element rather than a fake.

---

### A10 — SPLIT-FIELD COMPARISON / MYTH-BUST
**Reference:** finance-explainer accounts that popularized the two-panel correction format (@yourrichbff, @humphreytalks); consumer-fact-check layouts.
**Content shape:** myth vs fact, before vs after, with-solar vs without, Plan A vs Plan B.
**Swipe role:** body or standalone. **Highest comment-rate archetype** — people argue with it.

**Layout & grid**
```
[HEADLINE]     cols 1–6, y = 72, ≤8 words
[SPLIT]        canvas divided vertically at the col 3/4 boundary
  LEFT panel   bg NIGHT   — the myth / the status quo
     label "WHAT YOU'VE HEARD" 28px small caps, PAPER @ 60%
     body 44px PAPER, ≤18 words
  RIGHT panel  bg PAPER   — the fact / the outcome
     label "WHAT THE FILING SAYS" 28px small caps, ACCENT_HOT
     body 44px INK, ≤18 words
[VERDICT_BAR]  full width strip, 120px tall, y = 1080, bg ACCENT_HOT
     one sentence, 38px, PAPER, ≤14 words
[SOURCE]       footer
```

**Rule against strawmanning:** the left panel must state the myth **in its strongest, fairest form**. A weak strawman is the fastest way to lose the audience that is already skeptical of solar sales. The credibility of the whole account rests on this slide type being fair.

**Parameters**
```yaml
archetype: A10
headline: str(≤8 words)
myth: str(≤18 words)
fact: str(≤18 words)
verdict: str(≤14 words)
source: str   # REQUIRED — this archetype cannot render without a citation
```

---

### A11 — VERTICAL TIMELINE LADDER
**Reference:** Visual Capitalist timeline infographics; Our World in Data historical series.
**Content shape:** a sequence of events with dates. Rate case history, policy step-downs, install process.
**Swipe role:** body; or a whole carousel where each slide is one rung.

**Layout & grid**
```
[HEADLINE]  cols 1–6, y = 72, ≤9 words
[SPINE]     3px vertical rule at x = 180px, INK @ 25%, running y = 280 → 1120
[NODES]     4–6 max
   node dot: 20px circle on spine (ACCENT_HOT if it's the "you are here" node, else INK)
   date:  x = 240, 34px, IBM Plex Mono, tabular
   event: x = 240, 38px, ≤12 words
   node vertical gap = 168px
[NOW_MARKER] optional: a dashed hairline labeled "TODAY" across the spine
[SOURCE]    footer
```

**Color logic:** past nodes `INK` @ 70%; the current/upcoming node `ACCENT_HOT` at full weight. Future nodes `NEUTRAL` with hollow dots. This encodes urgency without saying "act now."

**HARD LIMIT: 6 nodes. 12 words per node.**

---

### A12 — PULL-QUOTE / RECEIPT CARD
**Reference:** Sherwood News and Chartr quote cards; news-account quote treatments.
**Content shape:** something a regulator, utility executive, or official document actually said.
**Swipe role:** body slide 4–6. This is the "I'm not making this up" slide.

**Layout & grid**
```
[QUOTE_MARK]  a single oversized " glyph, 220px, ACCENT_HOT @ 20%, behind text, cols 1–2
[QUOTE]       cols 1–5, 52px, ≤25 words, INK, line-height 1.25
[ATTRIB]      cols 1–4, 32px, INK @ 65%: Name, Title
[PROVENANCE]  cols 1–4, 28px, INK @ 50%: document/hearing + date
[SOURCE]      footer
```

**HARD LIMIT: 25 words.** Longer than that, it isn't a quote — paraphrase it into A07 instead and cite the source.

**Legal/ethical rule for the engine:** only quote statements that exist in the public record (ACC dockets, hearing transcripts, utility press releases, published reporting). Never fabricate, compress, or "tidy" a quote. Always give the document and date. Never attribute a paraphrase as a quotation.

---

### A13 — ANNOTATED DOCUMENT TEARDOWN
**Reference:** the contract/fine-print markup format popularized by @erikakullberg; explainer-account document breakdowns.
**Content shape:** a real utility bill, a rate schedule, a solar contract page.
**Swipe role:** carousel spine — one document, one annotation per slide, 4–7 slides. **Highest save-rate archetype in this library.**

**Layout & grid**
```
[HEADLINE]     cols 1–6, y = 72, ≤8 words
[DOC_IMAGE]    cols 1–6, y = 220–1060, the document scan, desaturated to 15% saturation
[FOCUS_BOX]    2px ACCENT_HOT rectangle around the line item being explained
[DIM_MASK]     NIGHT @ 55% over everything OUTSIDE the focus box
[CALLOUT]      a PAPER card, 3 cols wide, offset from the focus box with a 2px leader line
   title 34px bold + explanation 30px, ≤22 words
[COUNTER]      "Line item 3 of 6" — 26px mono, footer right
```

**Privacy rule (HARD):** account numbers, service addresses, names, meter IDs, and barcodes are **redacted with solid `INK` bars, not blur** (blur is reversible). Use the customer's own bill only with written permission, or use your own.

**Why it saves:** the reader is holding the same document. This is the highest-utility content an energy educator can make — it teaches a skill the viewer uses on their own paperwork tonight.

---

### A14 — COMPARISON MATRIX / SCORECARD
**Reference:** consumer-testing publications (Wirecutter, Consumer Reports) table conventions.
**Content shape:** 3–4 options × 4–6 attributes. Rate plans, financing types, battery sizes, installer quotes.
**Swipe role:** the "reference" slide near the end. Save magnet.

**Layout & grid**
```
[HEADLINE]  cols 1–6, y = 72, ≤8 words
[TABLE]     y = 240 → 1120
   col 1 = attribute names, 32px, left aligned, INK @ 70%
   cols 2–4 = options; header row 36px bold, PAPER on INK band
   row height 96px; zebra: alternating PAPER / PAPER darkened 3%
   cell values: short strings ≤ 4 words, or ✓ / ✗ / — glyphs (never emoji)
   RECOMMENDED column gets a 3px ACCENT_HOT border + a small "BEST FOR ___" tag
[FOOTNOTE]  28px, assumptions stated explicitly
[SOURCE]    footer
```

**HARD LIMIT: 4 columns × 6 rows.** Beyond that it becomes unreadable at phone size — split into two slides.

**Honesty rule:** every scorecard must include at least one row where the recommended option **loses**. A table where one column wins everything reads as an ad and kills trust.

---

### A15 — ISOMETRIC SYSTEM DIAGRAM
**Reference:** Visual Capitalist isometric explainers; Our World in Data / Vox process diagrams.
**Content shape:** how something works. Panel → inverter → panel → grid. Where a kWh actually goes. What a substation does.
**Swipe role:** the "teach" slide. Slide 3–5.

**Layout & grid**
```
[HEADLINE]   cols 1–6, y = 72, ≤8 words
[CANVAS]     BG-4 blueprint grid, y = 220–1120
[NODES]      3–5 objects on a 30° isometric axis
   flat-color vector, 2px INK outline, no gradients, no drop shadows
[FLOW]       arrows: 4px, ACCENT_HOT for energy the homeowner keeps,
             NEUTRAL for energy exported, ALERT for money leaving
[LABELS]     numbered chips ①–⑤, 30px, connected to nodes with 1.5px leaders
[LEGEND]     one line, 28px
[SOURCE]     footer if any figure appears
```

**Style rule:** one consistent icon language across the entire account. Same stroke weight (2 px), same corner radius, same 30° axis. Mixing icon styles is the most visible "made in Canva" tell.

---

### ARCHETYPE → CONTENT SHAPE ROUTING TABLE

| If the content is… | Use | Never use |
|---|---|---|
| One surprising figure | A01 | A08 |
| A ranking / "who pays most" | A02 | A03 |
| A trend over time | A03 | A02 |
| Same metric across categories | A04 | A02 |
| Anything geographic | A05 | A14 |
| Opening any explainer | A06 | A07 |
| A takeaway, no data | A07 | A01 |
| A 3-beat argument | A08 | A11 |
| Field proof / on location | A09 | A15 |
| Correcting a belief | A10 | A07 |
| A sequence with dates | A11 | A08 |
| Something official was said | A12 | A07 |
| Explaining a document | A13 | A14 |
| Choosing between options | A14 | A02 |
| How a system works | A15 | A13 |

---

## §3. DESIGN-SYSTEM RULES (EXPLICIT LIMITS)

These are the rules that produce the "pro" look independent of taste. An engine can enforce all of them programmatically.

### 3.1 Copy volume ceilings — HARD

| Slot | Ceiling | Notes |
|---|---|---|
| Cover eyebrow | **4 words** | Category label only |
| Cover headline | **9 words / 52 characters** | Fail render above this |
| Cover kicker | **14 words** | The open loop |
| Cover total | **25 words** | |
| Hero-number slide (A01) | **32 words** + the number | |
| Standard body slide | **30 words** | Headline ≤10, body ≤20 |
| Bullet slide (A08) | **42 words**, 3 bullets, ≤16 words each | |
| Statement slide (A07) | **22 words** | |
| Quote (A12) | **25 words** | |
| Callout (A13) | **22 words** | |
| Closer slide | **25 words** + CTA ≤8 words | |
| **Whole carousel** | **180 words across all slides** | The discipline that makes it look designed |
| Caption (in-app) | 80–150 words; first 125 characters must stand alone | |

**Reading-time model the engine should use:** a viewer gives a body slide ~1.4 seconds. At roughly 4 words/second of scanning, that is ~6 words of actual comprehension. Everything past word 30 is decoration that costs completion rate. The word ceilings above are not stylistic preferences; they are the throughput limit of the medium.

**The rewrite loop:** if copy exceeds the ceiling, the engine must not shrink type. It must either (a) cut, (b) split into two slides, or (c) convert prose into a chart. **Never below 28 px.**

### 3.2 Hierarchy ratios — HARD

```
HEADLINE : BODY size ratio  >= 2.2 : 1   (target 2.5 : 1)
HERO_NUM : SUBHEAD ratio    >= 5   : 1
EYEBROW  : HEADLINE ratio   ~= 0.30 : 1
```
- Exactly **one** element per slide may be "loud." If two things are loud, nothing is.
- Weight jumps must be >= 2 steps (400 -> 700). A 400 -> 500 jump reads as an accident.
- Contrast ratio >= 4.5:1 for all body text; >= 3:1 for display.

### 3.3 Spacing & alignment — HARD

- Every vertical dimension is a multiple of **18 px**.
- Left edge of every text block sits on a column line. **No optical fudging, no centering** — except a hero numeral, which is optically centered (visual mass centered, not bounding box).
- Whitespace floor: **>= 35% of the canvas must be empty.** Measure it. This is what "expensive" looks like.
- Never place text closer than 60 px to any canvas edge.

### 3.4 Chart rules — HARD

1. Title states the **finding**, not the topic.
2. **No legends.** Label series directly at their end points.
3. Max 4 gridlines, <=12% opacity, horizontal only.
4. Y-axis starts at zero for bar charts. **Always.** A truncated bar axis is the fastest way to get called a liar in the comments — and utility-rate content attracts hostile commenters.
5. Max 2 data series per chart. A third series means you should be using A04 small multiples.
6. Grey the field, color the subject (one series max in `ACCENT_HOT`).
7. Every chart carries: source name, dataset/docket ID, retrieval date.
8. Round aggressively in display, be exact in the source line. "About $20/month" in the headline; "$20 based on 1,000 kWh" in the footnote.

### 3.5 The 6 amateur tells to lint against

Reject any slide containing these:

| Tell | Fix |
|---|---|
| Centered multi-line display type | Flush left, ragged right |
| Drop shadows / outer glow / text outline | Solid contrast, or a 6 px halo in the bg color |
| More than 2 typefaces or 3 colors | Cut to system tokens |
| Emoji used as bullets or icons | 8 px squares or the account's own icon set |
| Full-bleed pure `#000000` or `#FFFFFF` | Use `NIGHT` `#101820` / `PAPER` `#F4F0E6` |
| Logo larger than 3% of canvas area | 24–28 px wordmark, fixed corner |

### 3.6 Carousel architecture

**Slide count: 7–9. HARD MIN 5, HARD MAX 10.**
Rationale: carousels earn a **second distribution wave** when users swipe to slide 3 or beyond, which extends their reach window past any other feed format — but completion drops measurably past 10 slides, and completion is what triggers that second wave. 7–9 is the band where both effects are positive.

**Canonical structure:**

| Slide | Role | Archetype |
|---|---|---|
| 1 | Hook / open loop | A06, A09, or A01 |
| 2 | **Second hook** — must stand alone | A01 or A07 |
| 3 | The evidence | A03 / A02 / A05 |
| 4 | The mechanism (why this is happening) | A15 / A08 |
| 5 | The complication ("the catch") | A10 / A12 |
| 6 | The implication for *you* | A08 / A04 |
| 7 | The action / reference table | A14 / A13 |
| 8 | Closer + CTA | A16 pattern (below) |

**Slide 2 rule:** because carousels get re-served to users who already scrolled past, slide 2 is frequently the *first* slide a second-wave viewer sees. It must work with zero context from slide 1. Never make slide 2 a continuation sentence.

**The bleed cue:** on 2 body slides, let a chart, arrow, or number bleed 40–80 px past the right margin, cropped by the canvas edge. The eye reads the crop as "there's more" and the thumb follows. Twice per carousel maximum, never on the cover.

### 3.7 Closer / CTA pattern (A16)

```
[HEADLINE]        cols 1-6, 64px, <=8 words — the compressed takeaway, restated
[RECAP]           3 lines, 34px, one per key point, each <=9 words, ACCENT_HOT square bullets
[DIVIDER]         1px hairline
[CTA_PRIMARY]     38px: ONE action
[CTA_SECONDARY]   30px, INK @ 60%: the save/send prompt
[WORDMARK]        larger here only: 40px, still <=5% of canvas
```

**CTA ladder — pick exactly one primary per post, rotate across the calendar:**

| Tier | Pattern | Use when |
|---|---|---|
| Save | "Save this before your next bill lands." | Reference content (A13, A14) |
| **Send** | "Send this to the neighbor who keeps complaining about their bill." | **Default — highest algorithmic value** |
| Comment | "Comment your ZIP and I'll tell you which rate plan is cheapest there." | Local, answerable, scalable |
| Keyword-DM | "DM the word BILL and I'll send the one-page checklist." | Lead capture, <=1 in 5 posts |
| Follow | "Follow for the rate-case verdict when it lands." | News-cycle posts only |

**HARD LIMIT: one primary CTA + one save/send prompt. Two asks = zero actions.**
**HARD LIMIT: keyword-DM CTAs on no more than 20% of posts.** Above that the account reads as a funnel, and the educational credibility — the entire asset — degrades.

**Never** put the CTA on a slide by itself with no value. The closer must restate the takeaway so that a screenshot of the *last* slide is still useful on its own. People screenshot last slides.

### 3.8 Caption spec

```
LINE 1 (<=125 chars): standalone restatement of the hook. Visible before "...more".
LINE 2: blank
BODY: 3-5 short paragraphs, 1-2 sentences each. Plain language.
      Repeat the specific numbers — captions are indexed by Instagram search.
SOURCE BLOCK: "Source: [document], [date]" — repeated from the slides.
CTA: repeat the primary CTA verbatim.
HASHTAGS: 5-10, hyper-relevant only.
      2 local (#surpriseaz #westvalleyaz), 3 topical (#apsrates #srp #arizonasolar),
      2 category (#homeenergy #utilitybills)
```
Keyword-rich, natural-language captions matter because Instagram surfaces content through caption text in search — "APS rate increase 2026" is a query real Arizona homeowners type.

---

## §4. VIRAL REEL & FIELD-CONTENT FORMATS

### 4.0 Role split

- **Reels = reach.** Pushed to non-followers via Explore and recommendations. This is how a local brand reaches homeowners who have never heard of it.
- **Carousels = authority + saves.** They convert a stranger who found you via Reels into someone who follows and returns.
- **Stories = conversion.** This is where DMs actually start.

**Weekly cadence: 3 Reels, 2 carousels, daily Stories.** Reaching the right 500 households consistently beats one viral hit.

### 4.1 Reference operators (study the format, don't copy the person)

| Operator | What to steal | Why it's proof |
|---|---|---|
| **Roger Wakefield** (@therogerwakefield) — Texas master plumber | The archetype: local service pro becomes national educator. Trade knowledge, explained plainly, on site, in work clothes. | ~750K YouTube subscribers, 156M+ views, ~595K TikTok followers. He has stated plainly that he started YouTube in 2018 to make the phone ring for his plumbing company. The education *is* the lead-gen. |
| **Glennda Baker** (Atlanta real estate) | Story-first delivery, strong opinions, first-person anecdote as the hook. | Built a national audience out of a hyper-local business. |
| **Ken Pozek** (Orlando) | The neighborhood-tour format: on location, walking, answering the question a buyer actually has. | Local-search driven. |
| **Shannon Gillette** (Gilbert, AZ) | Polished local personal brand in *your* metro — study the production bar in Phoenix. | Local benchmark. |
| **Brad McCallum** (Calgary) | Market-data reels: numbers on screen, delivered fast, updated monthly. | The recurring-segment model. |
| **Michael Bordenaro / Freddie Smith** | Commentary-on-the-news: react to a real headline, add the analysis the article left out. | Reach comes from timeliness plus a take, not production value. |
| **Erika Kullberg** | Document/fine-print teardown as video: the contract on screen, the trap circled. | Directly transferable to utility bills and solar contracts. |
| **Humphrey Yang** | Physical props to explain abstract finance. | Transferable: a real meter, a real panel, real cash. |
| **Cleo Abram / Johnny Harris** | Explainer craft: motion graphics keyed to narration; B-roll that illustrates the specific noun being spoken. | The discipline bar for explainer B-roll. |

*(Named for format study only. No affiliation implied.)*

### 4.2 Universal reel rules — HARD

| Rule | Spec |
|---|---|
| Length | **18–34 s** for education; 34–60 s for teardowns; <=75 s only when there's a story with a payoff |
| Hook window | **First 1.5 seconds.** Getting past the 3-second mark is the first threshold the ranking system tests. |
| First frame | Must contain a **face, a number, or an object in motion.** Never a title card. Never a logo. |
| Cold open | **No greeting.** "Hey guys, it's ___ and today..." is the most reach-destructive opening in the format. Start mid-sentence, mid-argument, or mid-action. |
| Cut cadence | A visual change every **1.5–2.5 s** (cut, push-in, text change, B-roll swap). Static talking head beyond 4 s without change = drop-off. |
| On-screen text | Burned-in captions **always**. **Max 6 words on screen at once.** Positioned y = 380–1420 px only. |
| Caption style | One consistent style account-wide. Sans, 700 weight, `PAPER` fill, 4 px `NIGHT` stroke or a 70% pill. **No word-by-word karaoke bounce** — it reads as low-effort automation. |
| Audio | Voice is the loudest element. Music bed **-22 to -18 dB** under voice. Never trending audio that fights narration. |
| Loop | Final frame should visually rhyme with the first frame so a rewatch feels intentional. Rewatches are watch time. |
| Delivery | 1080 x 1920, 30 fps |

### 4.3 Hook template bank (first 1–2 seconds)

| ID | Template | AZ-populated example |
|---|---|---|
| `H1` Number cold-open | "[Number]. That's [what it means]." | "Six cents. That's what APS pays you for the power your roof makes." |
| `H2` Local address | "If you live in [town], this is your bill." | "If you live in Surprise, your July bill is doing this." |
| `H3` Physical reveal | *(no speech — hold an object to camera)* | Holds an IR thermometer to a roof tile: "One sixty-one." |
| `H4` Contradiction | "Everyone's blaming [X]. It's not [X]." | "Everyone blames the heat. Your bill went up before it got hot." |
| `H5` Insider frame | "I read the [document] so you don't have to." | "I read the APS rate filing. Three things in it actually matter." |
| `H6` Direct question | "Do you know what [line item] is?" | "Do you know what line 7 of your bill is? Neither did I." |
| `H7` Countdown | "[Date]. That's when [thing changes]." | "September 1. That's when the export rate steps down again." |
| `H8` Objection first | "You're right that [objection]. Here's the part that changed." | "You're right, the tax credit is gone. Here's what replaced it." |
| `H9` Receipt | *(hold up the actual document)* "This is a real [x]." | Holds a bill: "This is a real July bill. 2,400 square feet, Surprise." |
| `H10` Field context | *(walking, gesturing at something behind you)* | Points at a substation: "That thing behind me is why your bill is going up." |

**Hook lint rules:** the first sentence must contain a **noun the viewer owns** (your bill, your roof, your neighborhood) or a **number**. It must not contain: your name, the phrase "today I'm going to," or a follow request.

### 4.4 The reel format menu (10 recipes)

---

#### R1 — THE NUMBER DROP
**Length:** 18–24 s · **Best for:** a single stat from the rate case, the export rate, bill data
**Hook:** `H1` or `H7`

| t | Shot | Audio | On-screen text |
|---|---|---|---|
| 0.0–1.5 | MCU talking head, hard cut in, already mid-sentence | The number + what it is | The numeral, huge, `ACCENT_HOT` |
| 1.5–6 | Same, 5% push-in | Where it comes from — name the document | Source line, small |
| 6–13 | B-roll: bill on a table, meter, roof | What it means in dollars for a real house | Running dollar figure |
| 13–20 | Back to talking head, wider | The one implication | 4-word summary |
| 20–24 | Static end card (A01 archetype, same design system) | "Send this to whoever pays your bill." | CTA |

**Conversion:** none in-video beyond the send prompt. The DM comes from the "wait, is that real?" comment — which you answer with the docket number. Being the person who has the receipt *is* the sales motion.

---

#### R2 — THE BILL TEARDOWN
**Length:** 40–60 s · **Best for:** the highest-save video you will make. Run monthly.
**Hook:** `H9` or `H6`

**Shot list**
1. Overhead (phone on a tripod arm, straight down) of a real bill on a plain surface. Hands in frame. `0–2 s`
2. Finger physically points at line item 1. Cut. `2–10 s`
3. Repeat for 3–5 line items, one cut each; a circle/highlight animation appears the moment the finger lands.
4. Pull the hand away, whole bill visible, one number circled.

**Pacing:** one line item per 8–10 s. Cut on the point.
**Text:** the name of each line item appears burned in as it is mentioned. Nothing else.
**Talking head vs B-roll:** 100% B-roll (overhead), voice-over only. Your face never appears — the document is the star.
**Privacy:** solid black redaction bars over account number, address, name, meter ID. Bars, not blur (blur is reversible). Visible redaction is itself a trust signal.
**Conversion:** "Want me to do this with yours? Send it over and I'll mark it up." Converts because you're offering **the exact work you just demonstrated**, not a consultation.

---

#### R3 — THE ROOFTOP / FIELD WALK-AND-TALK
**Length:** 25–40 s · **Best for:** proof of presence, heat content, seasonal
**Hook:** `H10` or `H3`

**Shot list**
1. Walk *toward* camera, already talking (phone on a small tripod or held by a helper). `0–3 s`
2. Turn and gesture at the thing — roof, array, condenser, meter. Camera follows the gesture. `3–10 s`
3. Handheld close on the object. Show a real instrument reading if possible. `10–20 s`
4. Back to MCU, deliver the takeaway. `20–30 s`
5. End card. `30–34 s`

**Pacing:** 3 shots minimum, 4–6 preferred. Movement is the retention device.
**Text:** one lower third with location and condition — "Surprise, AZ · 114°F · 2:40 PM". Specificity is credibility.
**Conversion:** the location tag. Locals see a town they recognize and DM "do you work in Litchfield Park too?"

---

#### R4 — THE INSTRUMENT REVEAL
**Length:** 15–25 s · **Best for:** the most shareable format you have. Visual, undeniable, non-verbal hook.
**Hook:** `H3` — zero words for the first 1.5 s

**Recipe:** point a measuring device at something and show the reading.
- IR thermometer at a dark roof tile at 3 PM vs. the same tile under a panel
- Clamp meter on a condenser's start-up draw
- Kill-A-Watt on a pool pump
- Thermal camera on an attic hatch

| t | Shot | Text |
|---|---|---|
| 0–1.5 | ECU of the instrument display, number climbing | none — let the number move |
| 1.5–4 | Wide reveal: what's being measured | the reading, huge |
| 4–12 | Second measurement, the comparison | second reading beside the first |
| 12–20 | Talking head, one sentence of meaning | the difference, in dollars |
| 20–25 | End card | CTA |

**Why it travels:** a rising number on a screen is a self-resolving open loop; the viewer stays to see where it stops. It requires no prior trust in you, which is exactly why it reaches strangers.
**Conversion:** "Want me to point this at your roof? Ten minutes, costs nothing." A measurement is a low-commitment, high-specificity offer and converts far better than "free quote."

---

#### R5 — GREEN-SCREEN / DOCUMENT REACT
**Length:** 30–45 s · **Best for:** news cycle, rate-case milestones, utility press releases
**Hook:** `H5` or `H4`

**Setup:** you on the right third, a screenshot of the actual article or filing behind you. Scroll and highlight as you talk.
**Rules**
- Screenshot the **primary source** (ACC docket page, utility rate sheet, published article with the outlet visible) — not someone else's summary.
- Highlight the exact sentence you're discussing as you say it.
- Give the opposing side its strongest version before you respond.

**Cadence:** ship within 24–48 hours. Timeliness is the entire format.
**Conversion:** authority accumulation. Do this on every rate-case milestone and you become the local person who tracks it.

---

#### R6 — THE NEIGHBORHOOD RATE REPORT *(recurring segment)*
**Length:** 30–45 s · **Frequency:** monthly, same day, same open, same music
**Hook:** `H2`

**Structure — three numbers, one per beat**
1. What the average summer bill did in [named ZIP or subdivision] this month
2. What changed at the utility this month
3. What that means for a typical house on that street

**Design:** every frame uses A02/A03 as motion graphics — video and carousels share one visual language. This is what makes a solo operator look like a publication.
**Why recurring segments work:** a named, dated, repeating format trains the audience to expect you, and gives you a permanent engine that never requires a new idea.
**Conversion:** "Want your street's numbers? Comment your ZIP." Answerable at scale, generates comment *depth* (weighted more heavily than comment count), and every answer is a warm DM opening.

---

#### R7 — STREET INTERVIEW / "WHAT'S YOUR BILL?"
**Length:** 30–50 s · **Best for:** raw reach. Other people's faces and voices outperform yours.
**Hook:** a stranger's answer, cut in cold. Not your question.

**Shot list:** 3–4 people, 6–10 s each, same framing, same question. End on the most extreme answer.
**Rules:** ask permission on camera, capture a verbal release, film in genuinely public places, respect a no.
**Text:** neighborhood and house size under each answer.
**Conversion:** indirect. Top-of-funnel reach. Comments fill with locals volunteering their own bills — reply to every one.

---

#### R8 — THE PROCESS TIME-LAPSE
**Length:** 20–30 s · **Best for:** demystifying what actually happens; killing the "it's a hassle" objection
**Hook:** `H3` — open on the finished array, then hard cut to the bare roof (reverse reveal)

**Shot list:** locked-off time-lapse of an install day (one frame per 2 s), intercut with 3 detail shots — a rail going down, a conduit run, the inverter powering on.
**Text:** an elapsed-time counter, plus one honest line about disruption ("power off for about 90 minutes").
**Conversion:** honesty about the annoying parts *is* the persuasion. Include the mess.

---

#### R9 — MYTH-BUST, TWO-SHOT
**Length:** 22–35 s · **Best for:** the objections that kill deals
**Hook:** `H8` — concede first

**Structure**
- 0–4 s: state the objection **in its strongest form**, in the objector's voice
- 4–8 s: "That was true until ___" / "That's still true, but here's what it doesn't cover"
- 8–20 s: the evidence, on screen, cited
- 20–28 s: what you'd actually tell a friend
- 28–32 s: end card, A10 archetype

**Rule:** you must be willing to say "solar isn't worth it if ___" on camera. Naming who *shouldn't* buy is the single most trust-generating move available in a high-pressure sales category, and it converts better than any pitch.

---

#### R10 — DM / COMMENT ANSWER
**Length:** 15–30 s · **Frequency:** 1 per week, mined from real comments
**Hook:** the comment itself on screen, read aloud in the first second

**Recipe:** screenshot a real comment (name blurred), answer it in one breath, put the answer on screen as text.
**Why it works:** it proves you answer people, which is the entire premise of DMing you. It also produces infinite content from your own audience.
**Conversion:** highest DM-rate format in this list, because it *demonstrates* the DM experience.

---

### 4.5 Reel rotation (4-week block)

| Week | Reel 1 | Reel 2 | Reel 3 |
|---|---|---|---|
| 1 | R6 Neighborhood Report | R4 Instrument Reveal | R10 DM Answer |
| 2 | R2 Bill Teardown | R9 Myth-Bust | R3 Field Walk |
| 3 | R5 News React | R1 Number Drop | R10 DM Answer |
| 4 | R7 Street Interview | R8 Process | R3 Field Walk |

### 4.6 The anti-salesy conversion doctrine

1. **Demonstrate the work, don't describe the service.** R2 sells by doing the thing on camera. "Free consultation" sells nothing.
2. **Offer a measurement, not a meeting.** "I'll point a thermal camera at your roof" is concrete, brief, low-commitment. "Let's hop on a call" is a threat.
3. **Name who shouldn't buy.** Publish the disqualifiers: heavy shade, a roof needing replacement within 5 years, moving within 2 years, very low usage. Every disqualification you publish raises the conversion rate of everyone who remains.
4. **Never mention price in the hook.** Price in the first 3 seconds re-classifies the video as an ad, and viewers scroll ads.
5. **Cite something in every single video.** Docket number, tariff sheet, date. You're competing against door-knockers; the thing you're actually selling is documentation.
6. **CTA ladder:** comment -> save/send -> keyword-DM. Never lead with a DM ask on a first-touch reach video.
7. **Answer every comment within 2 hours** for the first 4 hours after posting, substantively (not "great question!"). Thread depth is a weighted signal, and each thread is a lead.
8. **Ratio discipline:** at most 1 in 5 posts contains an offer. The other four are pure utility. That ratio *is* the brand.

### 4.7 Premium field content on a phone — technical spec

**Camera**
```
Resolution / frame rate : 4K @ 30 fps (delivery) | 4K @ 24 fps (filmic B-roll)
                          4K @ 60 fps only for footage you'll slow to ~40%
Codec                   : HEVC / H.265
Profile                 : Apple Log (iPhone 15 Pro and later) via the Blackmagic
                          Camera app — flat capture with a live LUT preview.
                          If not shooting Log: turn HDR OFF. HDR footage renders
                          badly in most viewers' feeds.
Stabilization           : Standard — not "Action" mode (it crops and over-processes)
Exposure / focus        : Tap-and-hold to AE/AF LOCK before every take. Auto-exposure
                          drifting mid-shot is the #1 amateur tell in Arizona sun.
Exposure bias           : Expose for the FACE and let the sky blow out. Never the reverse.
Lens                    : Main (1x) for talking head. Ultra-wide (0.5x) only for
                          rooftop context — never for faces (distortion).
```

**Arizona-specific shooting rules**
- **Avoid 10 AM – 4 PM direct sun** for anything with your face in it. Raccoon-eye shadows are unfixable in post. Shoot faces at golden hour, or in **open shade using a bright wall as the bounce.**
- **North-facing shade** is the most consistent free softbox in the Phoenix metro.
- Use a **variable ND filter** (ND8–ND128, ~$40 clip-on). Highest-ROI purchase for AZ field content: without it the phone hits its shutter ceiling in daylight and footage looks video-ish rather than filmic.
- **Heat management:** phones thermal-throttle and stop recording in extreme heat. Shoot 60-second takes, keep the phone in a cooler bag between setups, remove the case, never leave it lying on a roof.
- Roof safety: don't film on a pitched roof in summer. Use a ladder-top shot or a compliant low-altitude drone.

**Audio — the part that actually separates pro from amateur**
```
Primary : Wireless lav (DJI Mic Mini, Rode Wireless Micro) — $80-150.
          Clip 6-8 inches below the chin, cable hidden.
Wind    : Foam windscreen ALWAYS outdoors. Non-negotiable in afternoon wind.
Backup  : Run a simultaneous phone voice memo as a safety track.
Levels  : Peak -6 dB. Loudness-normalize to -14 LUFS on export.
Rule    : Viewers forgive soft focus. They do not forgive bad audio.
          If you buy one thing, buy the mic, not the gimbal.
```

**Stabilization & movement**
- A slow push-in beats a static shot; a gimbal beats a push-in; but a **tripod with a locked frame and good composition beats a wobbly gimbal shot every time.**
- Free stability: brace elbows against your ribs, exhale, walk heel-to-toe.
- Movement must be **motivated** — follow the gesture, reveal the object. Motion for its own sake reads as filler.

**Composition**
```
Framing      : MCU (mid-chest up) for talking head. Eyes on the upper-third line.
Headroom     : ~8% of frame height. Amateur footage has too much.
Look room    : If off-axis, leave space on the side the subject faces.
Background   : Depth is what looks expensive. Never stand against a flat wall.
               Put something 15+ feet behind you — a street, a yard, an array.
Vertical     : Compose for 9:16, but capture 4:3 "open gate" where available so you
               can reframe a horizontal cut later.
Continuity   : Same shirt and backdrop for all takes in a session — lets you cut
               several videos from one shoot without looking recycled.
```

**Color & finish**
- One LUT for the whole account. Warm, slightly desaturated, lifted blacks (matched to `NIGHT` `#101820`, not pure black). Grade consistency is a brand asset.
- Export: 1080 x 1920, H.264, 12–15 Mbps, 30 fps, audio 192 kbps AAC.
- Upload the highest-quality original. Never re-upload a downloaded copy of your own video — recycled and reposted content is distributed measurably worse than originals, and accounts leaning heavily on reposts can be dropped from recommendations entirely.

**Kit list (~$300 total)**

| Item | ~Cost | Why |
|---|---|---|
| Wireless lav mic | $90–150 | Non-negotiable |
| Variable ND filter + clip | $40 | Arizona sun |
| Small tripod + phone clamp | $35 | Locked frames |
| Foldable 5-in-1 reflector | $25 | Shade fill |
| IR thermometer | $25 | R4 format |
| Clamp meter / Kill-A-Watt | $40 | R4 format |


---

## §5. WHAT ACTUALLY DRIVES SAVES, SHARES, AND VIEWS

### 5.1 The ranking model in one paragraph

Instagram doesn't run one algorithm; it runs separate ranking systems for Feed, Reels, Stories, Explore and Search. Across all of them, the signals Adam Mosseri has publicly named as most important are **watch time, sends per reach (DM shares), and likes per reach** — in that order of weight, with likes now carrying very little. Mosseri's framing is that the platform tunes toward the **expensive action**: a like is cheap, a save is medium (it implies future intent), and a send is expensive (it involves another person and real social risk). Design for the expensive action.

**The metric to actually track is a ratio, not a count.** Sends ÷ reach. 200 sends on 10,000 reach (2%) is a strong signal; 200 sends on 50,000 reach (0.4%) is weak. A high ratio tells the system that *new* viewers valued it, which is what triggers further distribution.

### 5.2 The five mechanics, and how to engineer each

---

#### MECHANIC 1 — SENDS (the highest-value action)

A send happens when the content does a **social job** for the sender. There are exactly five jobs. Every post should be built to do one of them, and the engine should tag which:

| Job | What the sender is saying | Content that produces it |
|---|---|---|
| `ARGUMENT_AMMO` | "See, I was right." | Cited stat that settles a household or neighborhood dispute (A01, A12) |
| `SOMEONE_I_KNOW` | "This is literally you." | Content addressed to an identifiable person: pool owners, people with a west-facing roof, retirees on a fixed income |
| `LOCAL_RECOGNITION` | "That's our street." | Named ZIPs, subdivisions, landmarks, a map of the metro (A05) |
| `UTILITY_HANDOFF` | "You need this." | A checklist, a script, a deadline (A13, A14) |
| `SHARED_GRIEVANCE` | "Are you seeing this?" | The rate case, data-center cost-shift, a $400 July bill |

**Engineering rules:**
- **Name a person type in the copy.** "If you have a pool pump running 8 hours a day" makes the recipient obvious. Generic copy is un-sendable — the sender can't think of who to send it to.
- **Write one line that is quotable on its own.** The sender needs something to say when they paste it into a chat.
- **Ask for the send explicitly, but specifically.** "Send this to someone" performs far worse than "Send this to the person in your group chat who complains about their APS bill every July."
- **Make it self-contained.** A post that requires context from your other posts can't be forwarded.

---

#### MECHANIC 2 — SAVES

A save is a **promise to future-self**. It means the content has deferred utility. Saves are what educational and reference content is built to earn.

**The save triggers, ranked:**
1. **Reference density** — a table, a checklist, a list of thresholds. Something you can't memorize but will need. (A13, A14, A04)
2. **A specific future moment** — "when your next bill lands," "before you sign," "when the door-knocker comes." Name the moment in the CTA and saves jump.
3. **A script** — the exact words to say when calling APS to switch rate plans; the three questions to ask an installer. People save language they intend to reuse.
4. **A number they'll need to look up again** — the export rate, the rate-plan cutover times, the docket number.
5. **A thing that takes longer than a scroll to act on** — "here's how to pull your 12-month usage data from your utility account."

**Anti-pattern:** motivational or opinion content gets likes, not saves. If the post contains nothing the viewer would need *later*, it will not be saved regardless of how good it looks.

---

#### MECHANIC 3 — WATCH TIME / COMPLETION (the reach engine)

- The **3-second threshold** is the first gate. If the hook doesn't survive it, nothing else in the video matters.
- **Completion rate beats length.** A 30-second video with 80% completion outperforms a 2-minute video with 30% completion. Cut ruthlessly to the shortest length that still lands the payoff.
- **Open loops are the retention mechanism.** State the question in second 1; resolve it in the final third. Every time you resolve a loop, open a smaller one.
- **Rewatch is watch time.** Loop-friendly endings and dense on-screen numbers (which viewers rewind to re-read) inflate this legitimately.

**Carousel equivalent:** completion = reaching the final slide. Carousels get **re-served to users who swiped past slide 3**, giving them a longer reach window than any other feed format. That is why slide 2 must independently stand alone and why the bleed cue on slides 3 and 5 matters.

---

#### MECHANIC 4 — COMMENT DEPTH (not comment count)

Threaded conversation and substantive replies are weighted; one-word comments carry almost nothing. Engineer for depth:

- **Ask an answerable, local, low-effort question.** "Comment your ZIP" beats "What do you think?" — everyone knows their ZIP and nobody has an opinion on demand.
- **Reply with a real answer**, not an emoji. Each substantive reply extends the thread and creates a second ranked interaction.
- **Plant the disagreement.** A fair, well-sourced myth-bust (A10) reliably attracts people who want to argue. Argument threads are deep threads. This is why A10 has the highest comment rate in the library — but it only works if the myth was stated fairly, or the thread turns hostile instead of deep.
- **Reply-to-comment videos (R10)** convert a comment thread into a new piece of content and a new ranked object.

---

#### MECHANIC 5 — ORIGINALITY & DISTRIBUTION HYGIENE

- Original content receives materially more distribution than reposted material, and accounts that lean heavily on reposts risk being excluded from recommendations. Never re-upload someone else's content; never re-upload a downloaded copy of your own.
- **Post format-native.** Don't post a horizontal video with letterboxing, don't post a screenshot of a tweet, don't post a Canva template with the watermark.
- **Longer Reels now reach non-followers** through recommendations, but only if completion holds. Length is permission, not a target.
- **Carousels support up to 20 slides**, but you should still use 7–9 — the ceiling is not the recommendation.

### 5.3 Content-level triggers, applied to this niche

| Trigger | Why it works here | Post pattern |
|---|---|---|
| **Documented grievance** | Rate increases are a shared, non-partisan local frustration with an identifiable cause. | "The 14% request, in 8 slides, with the docket number." |
| **Cost-shift narrative** | Data centers vs. residential ratepayers is the most sendable energy story in Arizona right now. | A05 map of proposed data centers + A03 demand curve |
| **The receipt** | A real bill, redacted, from a real house in a named suburb. | A13 teardown |
| **The deadline** | Step-down dates create a legitimate calendar. | A11 timeline of RCP step-downs |
| **The disqualifier** | "Don't buy solar if…" is the most-screenshotted post an energy brand can publish. | A14 scorecard with honest losses |
| **The instrument** | A number rising on a device is a self-resolving loop. | R4 |
| **The translation** | "Here's what 'Grid Access Charge' means in English." | A13 + A07 |

### 5.4 Measurement — the dashboard the engine should output

Track per post, weekly:

```
sends_per_reach     = sends / reach          TARGET >= 1.5%   (excellent >= 3%)
saves_per_reach     = saves / reach          TARGET >= 2.0%   (reference posts >= 4%)
completion_rate     = (reached last slide|frame) / reach   TARGET >= 55% carousel, >= 45% reel
3s_retention        = views past 3s / plays  TARGET >= 65%
follower_conversion = new follows / reach    TARGET >= 0.4%
dm_rate             = DMs started / reach    TARGET >= 0.15%
comment_depth       = replies per comment thread  TARGET >= 1.4
```
**Decision rule:** kill any archetype whose 8-post rolling `sends_per_reach` is below 0.7%. Double the frequency of any archetype above 2.5%.

---

## §6. CONTENT PILLARS & THE ARIZONA FACT BANK

### 6.1 Five pillars (rotate; never two of the same in a row)

| Pillar | Share of calendar | Default archetypes | Default reels |
|---|---|---|---|
| **P1 — Rate Watch** (what the utilities and the ACC are doing) | 25% | A03, A11, A12, A06 | R5, R1 |
| **P2 — Bill School** (how to read, reduce, and choose) | 25% | A13, A14, A08 | R2, R10 |
| **P3 — The Grid File** (data centers, demand, heat, infrastructure) | 20% | A05, A15, A02 | R3, R4 |
| **P4 — Straight Answers** (myths, disqualifiers, contract traps) | 20% | A10, A07, A12 | R9, R10 |
| **P5 — Field Notes** (local proof, install reality, neighbors) | 10% | A09, A01 | R3, R7, R8 |

### 6.2 Verified Arizona fact bank (verify before each use — these move)

> **Engine rule:** every figure below must be re-verified against the primary source and re-dated before it appears in a post. Rates step down annually; the rate case is live. Publishing a stale number in this niche is the fastest way to lose the credibility this whole system is built to create.

| Fact | Value | Source | As of |
|---|---|---|---|
| APS rate case request | ~13.99% net revenue increase, ~$579.5M; roughly **$20/month** for a typical 1,000 kWh residential customer | APS filing / ACC Docket **E-01773A-25-0105** | Filed Jun 2025 |
| Rate case status | Evidentiary hearing began **May 18, 2026**, running through late July, 30+ intervenors; ALJ issues a Recommended Opinion & Order, then a Commission vote. Final decision expected toward the end of 2026. | ACC / APS | Jul 2026 |
| Formula rates (FRAM) | APS also seeks a formula rate mechanism allowing **annual** adjustments without a full rate case — the ACC adopted formula-rate policy in 2024. | ACC / APS filing | 2026 |
| Prior APS increase | ACC approved ~8% in Feb 2024 (Decision No. 79293) — about **$10.59–$12/month**; included a monthly charge on residential rooftop-solar customers | ACC Decision 79293 | Mar 2024 |
| SRP | ~**2.4%** overall increase effective Nov 2025, ~$5.61/month average residential; fixed monthly service charge for single-family homes raised substantially | SRP | Nov 2025 |
| APS solar export credit (RCP) | **6.171 ¢/kWh** for the Sep 1 2025 – Aug 31 2026 tranche (down ~10% from 6.857¢). Steps down up to 10% each September; **locked 10 years** at your interconnection date. | APS Rate Rider RCP | 2026 |
| Retail vs. export gap | APS time-of-use retail roughly **16–33 ¢/kWh** depending on hour vs. ~6.2¢ export | APS rate schedules | 2026 |
| Grid Access Charge | ~**$0.93 per kW** of solar array capacity, monthly | APS | 2026 |
| Federal tax credit | **Section 25D expired Dec 31, 2025** under the OBBBA. Homeowners buying with cash or a loan in 2026 get **$0** federal residential credit. Section 48E still flows through third-party-owned lease/PPA structures, subject to construction-start and placed-in-service deadlines and FEOC sourcing rules. | OBBBA (P.L. 119-21) | 2026 |
| APS peak demand | 2025 peak reached **8,648 MW**, ~400 MW above 2024 | reported via AZ Capitol Times | 2026 |
| Extra-large load requests | APS reports extra-large user requests exceeding **19,000 MW** — more than double current peak demand | same | 2026 |
| Data center share | Large data centers projected to consume **over 20% of Arizona's electricity by 2030** | same | 2026 |
| Demand growth rate | APS reports peak demand growth roughly **100× faster** for data centers than for all other customer classes | 12News analysis of APS data | 2024–26 |
| Data center rate proposal | APS proposed a **45%+** rate increase for extra-large users so that large loads cover their cost of service | APS rate case materials | 2026 |
| TEP parallel case | TEP seeking ~14%, 400,000+ customers; hearings raised whether residential customers subsidize infrastructure tied to a large Pima County data center | ACC | 2026 |
| Phoenix data center pipeline | Phoenix capacity projected to grow by several thousand MW; ACC opened a large-load docket and held workshops | ACC / press | 2026 |
| Summer bills | National forecasts projected summer electricity bills up ~**8.5%** year over year, with hot-climate states higher | Scripps/EIA-derived reporting | 2026 |

**Content angles this bank unlocks (one per fact, minimum):**
- A01: "6.171¢" as a hero number
- A03: RCP step-down curve 2017 → 2026, annotated with each September decision
- A11: rate-case timeline with a "you are here" node at the July 2026 hearing
- A10: "Solar has a 30% tax credit" → *had*. What replaced it, and for whom.
- A05: map of proposed/announced data center sites vs. residential ZIPs
- A02: APS vs. SRP vs. TEP — requested increases side by side
- A14: buy vs. lease/PPA vs. do-nothing scorecard, post-25D
- A13: teardown of a real July APS bill showing Grid Access Charge and TOU periods

### 6.3 Two-week publishing block (template)

| Day | Format | Pillar | Archetype/Recipe | Primary CTA |
|---|---|---|---|---|
| Mon | Carousel | P1 | A06 → A03 → A11 → A16 | Send |
| Tue | Reel | P3 | R4 Instrument Reveal | Send |
| Wed | Carousel | P2 | A06 → A13 ×4 → A16 | Save |
| Thu | Reel | P1 | R5 News React | Comment |
| Fri | Reel | P5 | R3 Field Walk | Comment |
| Sat | Carousel | P4 | A06 → A10 → A12 → A14 → A16 | Send |
| Sun | Stories only | — | Poll + AMA box | DM |
| Mon | Carousel | P3 | A06 → A05 → A15 → A02 → A16 | Send |
| Tue | Reel | P2 | R2 Bill Teardown | Keyword-DM |
| Wed | Carousel | P2 | A06 → A14 → A08 → A16 | Save |
| Thu | Reel | P4 | R9 Myth-Bust | Comment |
| Fri | Reel | P5 | R6 Neighborhood Report | Comment |
| Sat | Carousel | P1 | A06 → A01 → A04 → A16 | Send |
| Sun | Stories only | — | Recap + save reminder | Save |

---

## §7. ENGINE CONTRACT

### 7.1 Post object schema

```json
{
  "post_id": "string",
  "format": "carousel | reel | story",
  "pillar": "P1 | P2 | P3 | P4 | P5",
  "share_job": "ARGUMENT_AMMO | SOMEONE_I_KNOW | LOCAL_RECOGNITION | UTILITY_HANDOFF | SHARED_GRIEVANCE",
  "cover_formula": "F1..F7",
  "primary_cta": "save | send | comment | keyword_dm | follow",
  "slides": [
    {
      "index": 1,
      "archetype": "A01..A16",
      "bg": "BG-1..BG-7",
      "params": { },
      "word_count": 0,
      "source_line": "string|null"
    }
  ],
  "caption": {
    "line_1": "string(<=125 chars)",
    "body": "string",
    "source_block": "string",
    "cta": "string",
    "hashtags": ["string"]
  },
  "facts_used": [
    { "claim": "string", "value": "string", "source": "string", "verified_on": "YYYY-MM-DD" }
  ]
}
```

### 7.2 Pre-publish QA gates — the render fails if any of these trip

```
GATE 01  cover_headline.words <= 9  AND  cover_headline.chars <= 52
GATE 02  every slide.word_count <= archetype ceiling (§3.1)
GATE 03  carousel total words <= 180
GATE 04  slide_count between 5 and 10
GATE 05  slide 2 passes standalone_comprehension check (no anaphora: "this", "that", "it"
         referring to slide 1; no sentence continuation)
GATE 06  distinct_colors_on_slide <= 3  AND  accent_pixel_share <= 15%
GATE 07  distinct_typefaces_on_slide <= 2
GATE 08  min_font_size >= 28px
GATE 09  whitespace_share >= 35%
GATE 10  every numeric claim has a source_line with a document name AND a date
GATE 11  every fact in facts_used has verified_on within 45 days
GATE 12  exactly 1 primary CTA
GATE 13  keyword_dm CTAs <= 20% of trailing 20 posts
GATE 14  cover archetype not used as cover in trailing 6 posts
GATE 15  reel: all burned-in text within y = 380..1420 of a 1080x1920 frame
GATE 16  reel: first 1.5s contains face | number | moving object; contains no greeting,
         no logo card, no self-introduction
GATE 17  A10 renders only if myth_statement passes steelman check (states the
         strongest version of the opposing view)
GATE 18  A13 renders only if PII redaction mask = solid fill (not blur) and covers
         account number, name, service address, meter ID, barcodes
GATE 19  no emoji used as bullet, icon, or in any headline
GATE 20  no stock photography in A09
```

### 7.3 Compliance & ethics guardrails (non-optional in a regulated, high-complaint category)

- **Never** state or imply a guaranteed savings figure, guaranteed bill elimination, or a fixed payback period without the assumptions on the same slide.
- **Never** present a projected utility rate escalation as a certainty. Label projections as projections.
- **Never** imply affiliation with APS, SRP, TEP, the ACC, or any government program.
- Tax and financing statements must carry a "not tax advice — consult a tax professional" line. Post-25D, this matters more, not less: the incentive landscape changed in a way many homeowners still don't know about, and getting it wrong publicly is both a legal and a credibility problem.
- If a figure changes (a step-down, a Commission vote), **publish the correction as its own post.** Corrections are the highest-trust content an information brand can produce, and in this niche they're also excellent content.

---

## §8. SOURCES

**Platform mechanics**
- Adam Mosseri / Instagram creator communications on ranking signals — watch time, sends per reach, likes per reach (2025–26); "sends per reach" as a primary ranking signal.
- Later, "How the Instagram algorithm works" (2026); CreatorFlow, "Instagram Algorithm 2026" (2026); Socialync, "Adam Mosseri on Shares" (2026); Dataslayer, "Instagram Algorithm" guide (2026).
- Carousel mechanics: re-serve on swipe-to-slide-3, 5–8/8–10 slide bands, 1080×1350 sizing — Carouselli (2026), TrueFuture Media (2026), PostEverywhere (2026), Social Insider engagement benchmarks (2025–26).
- Safe zones: CampaignSwift (2026), TryMyPost (2026), Kreatli (2026), ScreenSnap (2026).

**Design & data-visualization craft**
- Visual Capitalist (@visualcap, ~410K IG) — infographic and stat-card conventions.
- Chartr / Sherwood News (@chartrdaily, ~515K IG) — daily chart storytelling; acquired by Sherwood Media (Robinhood), 2023.
- John Burn-Murdoch (Financial Times) on annotation and narrative titles, via GIJN — including the finding that readers scan charts in a Z pattern (title → axes → data) and that well-annotated charts outperformed minimalist charts with general audiences.
- Our World in Data; Urban Institute and World Bank data-visualization style guides; *Hands-On Data Visualization* chart-design principles.
- Morning Brew, The Hustle, Axios — editorial cover, highlighter, and Smart Brevity conventions.

**Creator / field-content references**
- Roger Wakefield (@therogerwakefield): ~750K YouTube subscribers, 156M+ YouTube views, ~595K TikTok followers; publicly states he began YouTube in 2018 to generate calls for his plumbing company.
- Real-estate content operators cited in AgentsBoost's 2026 creator roundup: Shannon Gillette, Ken Pozek, Brad McCallum, Glennda Baker, Tim Smith.
- Reel format benchmarks: Krista Mashore (2026), Jamil Academy (2026), Luxury Presence 2024 Agent Marketing Survey.
- iPhone capture: Apple Log / Blackmagic Camera workflow guides (Cinem8 2026, Absoluts 2025), 4K/24–30fps and AE/AF lock conventions.

**Arizona energy facts**
- Arizona Corporation Commission, APS rate case **Docket E-01773A-25-0105**; ACC eDocket; ACC news releases (Feb 2026).
- APS newsroom: rate case filing (Jun 2025), "APS Rate Case Hearing Begins" (May 2026), Rate Rider RCP schedules.
- ACC Decision No. 79293 (Mar 2024) — prior 8% increase.
- KJZZ (Jun 2025, Mar 2026), ABC15 (2025), AZFamily (Jan 2026), Arizona Agenda (Dec 2025), Arizona Capitol Times (Mar 2026), 12News data-center demand analysis, GovTech / East Valley Tribune on the state energy task force (Apr 2026), Gilbert Sun News (Apr 2026).
- One Big Beautiful Bill Act (P.L. 119-21) — Section 25D termination Dec 31, 2025; Section 48E treatment of third-party-owned residential systems.
- SRP rate adjustment effective Nov 2025.

---

*Spec v1.0 — built July 2026. Re-verify every figure in §6.2 before publication; the APS rate case is live and the export rate steps down each September.*
