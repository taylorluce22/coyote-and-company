# Higgsfield Prompting Playbook (2026)

Ingested from Taylor's ChatGPT deep-research pass (2026-07-22). The engine's
reference for making Higgsfield produce **usable assets on the first pass** —
photoreal stills + short 8–15s cinematic reels — for the DESERT GRID system.
Pairs with `content-engine-spec-2026.md` (where images anchor covers/closers +
photo archetypes A09; data slides stay typographic).

> **Runtime-discoverable, not frozen.** Higgsfield ships ~weekly (200+ releases).
> Treat model names, preset lists, and params as a **queryable catalog**, not
> hard-coded constants. Detect the account's surface: MCP/CLI vs. enterprise API
> vs. web-app only. There is **no universal public REST API** — programmatic
> access is MCP/CLI-first; an official SDK exists for enterprise.

## Product surface (what to target)
**Images**
- **Soul 2.0** — foundation photoreal image model (text-to-image + image-reference). Launched 20+ presets; live catalog is larger: `Realistic`, `Movie`, `iPhone`, `Warm Ambient`, `Street Photography`, `Digital Camera`, `Theatrical Light`, `Quiet Luxury`, `Foggy Morning`, `Flash Editorial`, etc. Query the catalog.
- **Soul ID** — locks a real person across generations. Needs ≥20 recent photos, strong light, unobstructed faces, ideally full-body.
- **Soul HEX** — extracts a palette from up to 20 reference images and applies it (brand-color continuity). One good reference can steer it.
- **Moodboards** — reusable custom style from up to 80 images (~10 cohesive hi-res usually enough; 20–30 better). Use for a whole-campaign look.
- **Soul Reference** — inherits a reference image's composition/lighting/pose/mood.
- **SOUL Inpaint / Canvas** — surgical placement of exact text/logos/products (do NOT brute-force text in first-pass generation).

**Video**
- Multi-model workspace: **Seedance 2.0**, **Kling 3.0**, Veo 3.1, Wan 2.7, Sora 2, etc. (discover at runtime).
- **Cinema Studio** — film workspace: camera body, lens (8–50mm), aperture, lighting, color, motion, multi-shot (up to 6 shots, 1–12s each, 1080p, start/end frame, up to 3 simultaneous camera moves, 21:9). "Hero frame first" — start from a still.
- **Camera Controls** — 50+ named motion presets (see mapping below).
- Effects / Transitions / Mixed Media / Vibe Motion — stylized layers; for a premium solar brand use sparingly (maps, data overlays, explainers), NOT photoreal footage.

**SDK params (when exposed):** Soul — `prompt`, `width_and_height`, `quality`, `batch_size`, `style_id`, `style_strength`, `seed`. DoP i2v — `model`, `prompt`, `input_images`, `motions` (intensity e.g. `inputMotion(id, 0.8)`). Helpers: `getSoulStyles()`, `getMotions()`, `uploadImage()`, `createSoulId()`, `listSoulIds()`.

## Image prompt template (engine fills tokens)
```
[PRESET or MOODBOARD] · [SUBJECT] · [SETTING + LOCATION] · [TIME OF DAY + WEATHER]
· [POSE/ACTION] · [FRAMING] · [LENS/FOCAL LOOK] · [LIGHTING] · [SURFACE/MATERIALS]
· [MOOD/STORY] · [COLOR CONTROL via HEX] · [CONSISTENCY ANCHORS] · [NEGATIVE CLAUSE]
```
**Bounded, not verbose.** State only what changes the frame; over-wording confuses the model. Be specific about subject, location cues, sun angle, roof/material realism, camera distance, surface detail — never "beautiful/amazing." Change **one variable at a time** across a batch.

**Preset → use-case (solar brand):**
| Use case | Preset |
|---|---|
| Rooftops, equipment, hero exteriors | `Realistic` / `Movie` |
| Kitchen-table bill scenes, cozy interiors | `Warm Ambient` / `Digital Camera` |
| Candid, user-shot authenticity | `iPhone` |
| Neighborhood / documentary exteriors | `Street Photography` |
| Battery / blackout / heat-crisis contrast | `Theatrical Light` |
| EV + solar "understated wealth" | `Quiet Luxury` |
Brand-color continuity > style-bouncing → **Moodboard + Soul HEX**.

**Reusable negative clause:**
```
no text, no captions, no logos, no watermarks, no utility-company marks, no misspelled bill text,
no deformed hands, no extra fingers, no duplicated objects, no warped roof tiles, no bent solar panels,
no melted battery housing, no floating tools, no unrealistic lens flare, no posterized skin, no plastic textures
```

**Consistency division:** recurring person → **Soul ID** · recurring world → **Moodboard** · palette → **Soul HEX** · composition → **Soul Reference**. `seed` stabilizes, does not freeze (drift still happens).

## Ready-to-use Soul templates (10 AZ scenes)
Stored verbatim for the engine — hero rooftop exterior, kitchen-table bill anxiety, garage battery backup, rooftop installer at sunrise, desert-neighborhood establishing, homeowner-with-phone driveway, blackout comfort interior, EV+solar ecosystem, extreme-heat concept, utility tabletop still. Full token-filled prompts in the source upload (this doc's origin). Pattern: `[PRESET] · specific AZ scene · golden/overhead/window light · realistic materials · brand mood · negative clause`.

## Video / reel prompting
**Mode selection:**
- Single shot from a strong still → **image-to-video (Cinema Studio / DoP)** + one named camera preset. Most predictable (has a visual anchor).
- Multi-shot 8–15s reel → **Seedance 2.0 / Kling 3.0**. Declare **shot count + total duration + aspect ratio at the top**; define 2–6 scenes, each with what happens + a duration.
- Precise camera grammar → **Cinema Studio** (lock lens/light/camera/start-end frame).

**Video prompt structure:**
```
[MODEL] · [N] shots, [DURATION], [9:16]
Global look: [style, lighting, lens, palette, continuity]
Keep fixed: [person / home / roof / outfit / weather / location]
Shot 1: [subject + action + setting + camera move + duration]
Shot 2..N: …
End frame: [optional end-state]
Avoid: [drift/deformation/text/logos]
```

**Camera vocabulary → Higgsfield motions:**
- Push-in: `Dolly In` / `Rapid Zoom In` / `Crash Zoom In` (by energy)
- Pullback/reveal: `Dolly Out` / `Aerial Pullback` / `Rapid Zoom Out`
- Orbit: `Arc Left/Right` / `360 Orbit` / `Lazy Susan`
- Crane: `Crane Up/Down` / `Jib Up/Down` / `Overhead`
- Tracking: `Head Tracking` / `Hero Cam` / `Handheld` / `FPV Drone`
- Accent: `Bullet Time` / `Whip Pan` / `Dolly Zoom`
- **Motion intensity:** 0.2–0.4 subtle premium · 0.5–0.7 social-cinematic · 0.8–1.0 aggressive hook (sparingly).

**Anti-distortion (enforce):** specific prompt · hi-res references · identity anchors over text descriptions · smooth single-direction moves · lock lens/light/camera · anchor background with a location reference · describe start+end body positions · one variable at a time · **short chained clips** (last frame → next first frame). Sweet spot **3–5 shots / 8–12s**; 15s only when motion is simple + anchored.

## Cinematic craft (looks premium)
- **Lens:** 24–35mm for homes/rooftops/neighborhoods; 50mm for people/bills/portraits. 8mm rare (distorts faces/homes).
- **Lighting (motivated):** golden-hour side light (rooftops) · hard overhead sun (heat/production) · warm window-through-blinds (bill scenes) · soft dusk practicals (backup peace-of-mind) · high-contrast garage practicals (battery) · overcast monsoon (storm-grid).
- **Color tags:** "warm amber highlights, neutral stucco mids, deep blue sky" · "sun-bleached desert neutrals" · "cool grid-stress w/ cyan shadows" · "campaign palette from Soul HEX reference."
- **Composition:** single-subject > crowded · clean negative space for later text overlays (parameterize, don't bake text in) · exact text/logo/microtext = Inpaint/Canvas post-step, never first-pass.

## Failure modes + auto-fix rules (engine enforces pre-generation)
```
recurring human across assets   -> require Soul ID
campaign palette matters        -> require Soul HEX reference
style consistency matters        -> attach Moodboard
composition continuity matters   -> attach Soul Reference
video >10–12s w/ complex action  -> split into chained shots
exact text/logo required         -> reserve for Inpaint/Canvas post
camera move multidirectional/fast-> simplify to one axis
scene obvious from first frame   -> shorten prompt, don't add prose
```
**Credit efficiency:** hi-res well-lit first frame · lock aspect ratio from the start · test short/simple before scaling · if the still already says it, don't over-prompt.

**QA gate (first-pass approval):** believable AZ house? roof/panel geometry plausible? no problematic readable text? hands/tools/cables/paper survive zoom? palette matches campaign? (video) same person every shot? same place? motion intentional not "AI float"? stable start/end positions? no objects appearing mid-clip? room for captions? — diagnose the failure class before rerolling (identity→Soul ID; layout→frames/refs; text→Inpaint; motion→simplify).

## Engine defaults
```
STILLS: Soul 2.0 · preset Realistic|Warm Ambient · 1 Soul HEX palette ref + 1 Soul Reference
        · Soul ID when recurring person · 1 compact paragraph · negative clause always · Inpaint for text
REELS:  Seedance 2.0 (3-shot) | Cinema Studio (single-shot from still) · 8–12s · 9:16 · 3 shots
        · one motion axis/shot · same home/person/palette/location · hero still = first frame · chain if complex
```
