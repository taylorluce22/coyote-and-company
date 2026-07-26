# First Reel Kit — "Six Cents" (R1 Number Drop, VO edition)

Everything needed to produce and post reel #1 at production quality using
Higgsfield credits + CapCut, with zero filming. Built from the house system:
`content-engine-spec-2026.md` §4 (R1 recipe, hard rules), the
[[Higgsfield Prompting Playbook|higgsfield-prompting-playbook-2026]], the
[[Arizona Reference Set]], and [[Voice]].

**Format choice:** R1 Number Drop, delivered as **voice-over + cinematic AZ
B-roll** instead of a talking head. Reasons: no filming or Soul-ID lip-sync
risk on day one, every shot is a scene Higgsfield does well (verified in the
photo-library tests), and it still satisfies every hard reel rule. Taylor's
face enters the feed later via the consultant photo library; reel #1 leads
with the number.

**Target:** 23–25 s · 1080×1920 · 30 fps · Pillar P1 (Rate Watch) · Hook `H1`.

---

## 0 — One-time setup (do before generating; this is the quality lever)
1. Higgsfield → **Moodboards** → create `az-ground-truth` from the real
   Arizona listing photos (the 2026-07-23 dump — see [[Arizona Reference Set]],
   which calls this "the single strongest lever"). 10–20 of the most
   representative: tan stucco + S-tile roofs, freeform pool backyards,
   subdivision aerials, plank-tile interiors.
2. Have the DESERT GRID hexes handy: `PAPER #F4F0E6` · `INK #14161A` ·
   `ACCENT_HOT #E8622C` · `DATA_COOL #0F5A63` · `NIGHT #101820`.

## 1 — The script (record first; the edit is cut to the voice)
~60 words ≈ 22 s. Numbers per [[Voice]] KB: 6.2¢ export, 34¢ on-peak.

> Six cents. That's what APS pays you for the power your roof makes.
> It's the export rate — it's in the rate plan itself, and it steps down
> over time.
> Meanwhile, summer on-peak power you buy back can cost thirty-four cents.
> That gap is why a quote that ignores it looks great on paper — and bad
> on your bill.
> Send this to whoever pays your bill.

**Recording:** iPhone Voice Memos, in a car or closet (dead room), phone
~15 cm from mouth. Read it 3–4 times back to back; keep the take that sounds
like explaining to a neighbor, not presenting. Own voice, not TTS — the voice
is the trust asset and it's free.

## 2 — Stills (Soul 2.0, moodboard `az-ground-truth` on every prompt)
Generate stills first ("hero frame first" — cheapest place to iterate).
Batch 2–4 per scene, pick the best, ~16:9 framing knowing crop to 9:16.
Append the standard negative clause to every prompt:

```
no text, no captions, no logos, no watermarks, no utility-company marks, no misspelled bill text,
no deformed hands, no extra fingers, no duplicated objects, no warped roof tiles, no bent solar panels,
no unrealistic lens flare, no posterized skin, no plastic textures
```

**S1 — Aerial subdivision (the hook shot)**
```
Realistic · aerial view of a Phoenix Arizona tract-home subdivision at golden hour,
dense tan concrete S-tile roofs, curving streets, blue freeform backyard pools,
desert edge and brown mountains on the horizon, warm amber highlights, deep blue sky,
24mm look, high vantage, clean composition with open sky upper third for text
```

**S2 — Kitchen-table bill (the stakes shot)**
```
Warm Ambient · close over-the-shoulder view of a homeowner's hands holding a paper
electricity bill at a kitchen table, bright Arizona daylight through a window with
plantation shutters, grey wood-look plank tile floor, greige walls, granite counter
breakfast bar in soft background, 50mm look, soft window light, bill paper angled
so no text is legible
```

**S3 — Rooftop panels (the subject shot)**
```
Realistic · low-pitch concrete S-tile roof of a tan stucco Phoenix home with clean
flush rows of all-black solar panels, golden-hour side light raking across the tiles,
neighboring tan tile-roof homes and a distant desert mountain behind, 35mm look,
realistic panel geometry, warm desert neutrals
```

**S4 — Dusk neighborhood (the loop-closer; rhymes with S1)**
```
Realistic · Phoenix Arizona suburban street at dusk, single-story tan stucco homes
with tile roofs and warm windows glowing, low tan block walls, mexican fan palms
silhouetted, deep blue sky fading to warm horizon, 24mm look, soft dusk light,
calm and quiet mood
```

**Still QA before animating (playbook gate):** believable AZ house? roof/panel
geometry plausible? no readable text anywhere? survives zoom? If a scene reads
generic-Midwest, the moodboard isn't attached — fix that, don't prompt harder.

## 3 — Video (image-to-video from the winning stills)
Cinema Studio / DoP i2v, **one camera move per clip**, intensity **0.3–0.5**
(subtle-premium band), 5 s each, 9:16.

| Clip | From | Motion | Intensity |
|---|---|---|---|
| V1 | S1 | `Aerial Pullback` (or `Dolly In` if pullback drifts) | 0.4 |
| V2 | S2 | `Dolly In` (slow push toward the bill) | 0.3 |
| V3 | S3 | `Arc Right` | 0.4 |
| V4 | S4 | `Dolly In` | 0.3 |

**Video QA:** motion intentional (no "AI float"), nothing appears mid-clip,
geometry stays rigid. One clean reroll max per clip; if a clip fails twice,
diagnose the failure class (motion → simplify axis; layout → better still)
instead of rerolling blind.

## 4 — End card (made in our own Composer)
Farmhand Composer → 1080×1920 export. DESERT GRID A01-style: `PAPER` field,
`INK` type, "**Send this to whoever pays your bill.**" + small wordmark +
source line `Source: APS rate schedule · 2026`. Hold 3 s.

## 5 — Assembly (CapCut, free tier is enough)
1. New project 9:16 · 30 fps. Drop VO on the audio track first.
2. Lay clips against the VO: V1 ≈ 0–6 s, V2 ≈ 6–12 s, V3 ≈ 12–18 s,
   V4 ≈ 18–22 s, end card 22–25 s. Trim each clip to the line it covers —
   cut ON the sentence boundary.
3. **Text beats** (this is what creates the ≤2.5 s visual-change cadence —
   change the text even when the shot holds):
   - 0.0 s: `6.2¢` — huge, `ACCENT_HOT #E8622C`
   - ~2 s: `what APS pays for your solar` (small, under the numeral)
   - ~6 s: `the export rate`
   - ~9 s: `it steps down over time`
   - ~12 s: `buying it back: 34¢ on-peak` (34¢ in `ACCENT_HOT`)
   - ~16 s: `that gap decides your bill`
   - ~19 s: `most quotes ignore it`
   - Style, account-wide from day one: bold sans (Inter-class) 700,
     `PAPER #F4F0E6` fill, thin `NIGHT #101820` stroke or 70% pill.
     **Max 6 words on screen. Keep text inside y ≈ 380–1420 px** (clear of
     UI). No word-by-word karaoke bounce.
4. Music: one calm instrumental bed from CapCut's commercial-safe library,
   **-22 to -18 dB under the voice**. Voice is the loudest element.
5. Export 1080×1920 · 30 fps · highest bitrate offered.

## 6 — Post
- Cover frame: the `6.2¢` numeral frame (first frame = a number ✓, never a
  title card ✓, no greeting ✓).
- Caption carries the education (screen/caption split): 3–4 short lines on
  what the export rate is and the one thing to check on a quote, then the
  Valley-general soft CTA — "Valley homeowners — if you want me to check
  what a quote assumes for exports, DM me." No emojis, no urgency.
- Hashtags: local-discovery set (Phoenix/West Valley + solar/APS terms).
- Post at a weekday evening; reply to every early comment (comment depth
  is a ranked signal).

## Budget reality
- Plan on a standard paid Higgsfield tier (the entry paid plan is enough for
  this reel) — stills are cheap, i2v clips are the credit spend.
- Expected volume: ~12–16 stills + 4–6 video generations (4 keepers + a
  couple of rerolls). Well inside one month of an entry plan; total cash
  outlay for reel #1 ≈ one plan month + $0 (CapCut free, own voice free).
- Credit-efficiency rules from the playbook: iterate at the STILL stage,
  not the video stage · lock 9:16 intent from the start · one variable per
  reroll.

## Definition of done
Runs 23–25 s · first frame is the number · no greeting · a visual/text change
every ≤2.5 s · captions burned, ≤6 words, in safe zone · voice loudest ·
final dusk frame rhymes with the aerial open · every number matches the KB ·
no generated shot captioned as a specific real job (authenticity line).
