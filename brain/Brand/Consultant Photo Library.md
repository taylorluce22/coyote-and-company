# Consultant Photo Library (Higgsfield)

Near-term priority (owner, 2026-07-22): real photos of Taylor as a consultant
are limited, so **build the @taylorlucesolar image library with Higgsfield Soul
photos that read as real** — indistinguishable-from-real field/consultant shots.
Grounded in `farmhand/docs/higgsfield-prompting-playbook-2026.md`.

> **Authenticity line (still holds):** these carry the consultant *look* and
> can front the feed, but a Higgsfield image is **never captioned as a specific
> real job/install/customer** — that stays real-photo-only. "Me on a roof" as
> brand aesthetic = fine. "Here's the Johnson install I did Tuesday" = must be a
> real photo.

## Step 1 — Soul ID (do this first; it's what makes them look like YOU)
Higgsfield → **Soul ID** → upload **20+ photos of Taylor**:
- Recent, same time period (same haircut/weight), varied angles + expressions.
- Strong even light, face unobstructed, no sunglasses/hats in most.
- Include a few **full-body** shots (best consistency).
- Name it e.g. `taylor-consultant`. Every prompt below runs **with this Soul ID selected.**

## The look (owner direction, 2026-07-23) — CANDID iPHONE PHOTOS
Every shot must look like **a real iPhone photo someone caught in the moment** —
never a posed portrait or a fashion/editorial shoot. Two hard rules on every prompt:
1. **"shot on an iPhone, natural iPhone photo look, everyday snapshot"** — the phone-camera aesthetic is the target, not a polished camera/film look.
2. **Candid, unposed, NOT looking at the camera** — the consultant is engaged in the actual thing (homeowner, tablet, roof, meter, bill), caught mid-action. No direct-to-lens gaze, no arms-crossed hero pose, no tailored blazer — plain approachable polo.
- **Moodboard: `Digital camera` for ALL shots (verified).** `Warm ambient` produced fashion-editorial (cardigans, tailored coats, moody magazine light, posed) — do NOT use it. `Old smartphone` (lo-fi), `Film looks`/`Theatrical light` (editorial) also out. For indoors on `Digital camera`, add **"soft daylight from a window, no flash"** to the prompt to avoid the harsh party-flash look.
- **Wardrobe LOCK:** a **plain solid-color polo** (light blue / grey) + casual pants, every shot. Negative-clause OUT: cardigan, blazer, sport coat, sweater, suit jacket, tie, black t-shirt.
- **Poses:** proven simple ones only — walking, hand in pocket, holding one thing low at the side, looking down/away/up. NO hand-on-hip, crossed legs, pointing/gesturing, or crossed arms (all read posed or distort).
- Body note: Soul ID locks the **face only**, not the physique — avoid full-body hero poses and crossed arms (worst for AI anatomy); favor natural mid-action framing.

## What actually works (learned from the test batch, 2026-07-23)
The reliable formula — nearly always lands: **solo subject · outdoor · natural
motion (walking/standing) · one hand doing ONE simple thing low at his side
(tablet/phone/folder) or in a pocket · looking down / away / up, never at the
camera.** These come out clean.
**What fails** (regenerate-heavy, distortion-prone): multiple people, pointing/
gesturing at someone (arm reaches → giant-arm distortion), crouching, busy
indoor scenes with hands mid-gesture. So: **bias the library to solo simple
poses.** When people/interaction is needed, keep it to ONE homeowner, frame
WIDE, both looking at the same thing (tablet/roof), zero pointing.

## Step 2 — the realism settings (what stops it reading "AI")
- **Model:** Soul 2.0, **with your Soul ID**.
- **Moodboard by shot (actual Higgsfield web-UI names, verified 2026-07-23):**
  clean authority → **General** · indoor consult → **Warm ambient** · candid/real
  (driveway, walk, truck, portrait) → **Digital camera** · subtle cinematic
  (battery, wide) → **Film looks**. **Avoid** `Old smartphone` (too lo-fi/dated)
  and `Theatrical light` (too dramatic/staged) — both break "reads real." No
  "8k/hyperreal" tokens. (Soul ID / character is selectable ONLY in Higgsfield's
  own Image UI — not via the platform API — so likeness shots are made there,
  then imported into the app's Consultant Library.)
- **Wardrobe (keep consistent):** clean solid polo or quarter-zip (brand-ish), jeans/work pants. Approachable-professional, not corporate.
- **Light:** golden hour, open shade, or window light. Never harsh noon on the face.
- **Negative clause on every prompt:**
```
no text, no logos, no watermarks, no deformed hands, no extra fingers, plastic skin,
no over-smoothed face, no over-saturation, no fake bokeh, no warped panels, no bent rooflines
```
- **Consistency across the set:** same Soul ID + a Soul HEX palette reference (warm desert neutrals) so the whole library looks like one brand. Change one variable at a time.

## Step 3 — the prompt pack (12 shots that build a consultant feed)
Run each with your Soul ID. `[preset]` = set the Higgsfield preset, don't type it.

**1 · Profile / bio headshot** `[Realistic]`
> a confident solar consultant in a clean polo standing outside a modern stucco Arizona home with rooftop solar, relaxed genuine half-smile, arms lightly crossed, golden-hour side light, shallow depth of field, natural skin texture, candid editorial portrait

**2 · Rooftop authority** `[Realistic]`
> a solar consultant in a polo and safety gear kneeling beside clean solar panels on an Arizona tile roof, holding a tablet, checking the array, early golden-hour light, desert suburb behind, photojournalistic, realistic tools and posture

**3 · Kitchen-table consult** `[Warm Ambient]`
> a solar consultant sitting at a kitchen island with a homeowner (seen from behind), pointing at a tablet showing an energy chart, warm afternoon window light, relaxed trustworthy body language, candid documentary lifestyle photo, modern Southwest kitchen

**4 · Driveway, tablet in hand** `[iPhone]`
> candid iPhone-style photo of a solar consultant standing in the driveway of a solar-equipped Arizona home, glancing at a tablet, casual polished wardrobe, spontaneous slight tilt, sunset light on the facade, natural imperfections, believable

**5 · Walk-and-talk (reel still)** `[Digital Camera]`
> a solar consultant walking through a desert suburban neighborhood mid-stride, gesturing while talking to camera, natural daylight, motion-candid, everyday realism, palo verde and stucco homes behind

**6 · Explaining at the meter** `[Realistic]`
> a solar consultant pointing at a home electric meter on a stucco wall, mid-explanation, homeowner partly in frame, bright open shade, authentic teaching moment, realistic hands and expression

**7 · Beside the battery wall** `[Movie]`
> a solar consultant standing beside a wall-mounted home battery in a clean Arizona garage, calm confident expression, gesturing toward the unit, soft practical light and open garage-door spill, premium install aesthetic, realistic hardware

**8 · Holding a real bill** `[Warm Ambient]`
> a solar consultant at a table holding a paper electric bill, explaining a line on it, warm window light, focused approachable expression, close natural framing, realistic paper and hands (no readable text)

**9 · Truck / tailgate working pro** `[Digital Camera]`
> a solar consultant leaning on the tailgate of a work truck with panels and gear, casual confident, late-afternoon desert light, dusty authentic work vibe, candid everyday realism

**10 · On-site with a homeowner, handshake-free** `[Realistic]`
> a solar consultant standing with a homeowner in front of a solar-equipped Arizona home, both looking up at the roof, natural conversation, golden hour, documentary authenticity, no staged poses

**11 · Warm candid portrait** `[iPhone]`
> candid warm portrait of a solar consultant laughing naturally, outdoors in soft evening light, casual polo, genuine relatable expression, slight motion, believable skin and eyes, not staged

**12 · Standing in front of a solar home, wide** `[Movie]`
> a solar consultant standing confidently in front of a modern desert home with a clean rooftop solar array, wide environmental portrait, golden-hour, understated premium mood, realistic architecture and panels

## The SKILL — how the agent composes these itself (Taylor writes nothing)
This is the CMO's Higgsfield-prompt skill. Given only a shot *intent* (e.g.
"rooftop authority," "kitchen-table consult," or an archetype needing a photo),
the agent emits a ready Higgsfield job by running this recipe — no human
prompt-writing:

1. **Classify the shot** → pick the preset:
   candid/relatable → `iPhone` or `Digital Camera` · clean authority → `Realistic`
   · indoor consult → `Warm Ambient` · product/battery/wide → `Movie`.
2. **Fill the scene tokens** from the brief in this fixed order:
   `[preset] · [subject: the consultant + wardrobe] · [action/pose] · [AZ setting +
   real materials] · [natural light] · [framing/lens feel] · [mood]`.
   Keep it ONE compact sentence. Never add "8k/hyperreal/ultra-detailed."
3. **Always attach:** the `taylor-consultant` **Soul ID**, the Soul **HEX** palette
   ref (warm desert neutrals), and the **negative clause** above.
4. **Pick light + wardrobe** from the fixed brand set (golden hour / open shade /
   window light; solid polo or quarter-zip) so the whole library stays coherent.
5. **Emit as a Higgsfield job object** (model=Soul 2.0, preset, soul_id, prompt,
   negatives, aspect 4:5 or 9:16) → queue for Taylor's one-tap approve.
6. **QA before ship:** hands/eyes/skin survive zoom, light natural, no AI tell.
   Miss → regenerate with one variable changed, not a rewrite.

The 12 prompts above are seed examples of this recipe's output; the agent
generates new shots the same way for any brief or any A06/A09 cover or reel
opener that needs the consultant in it. Batch a set to build the library fast.

## Using them
- **Pinned trio:** #1 (bio), #2 or #7 (authority/product), #3 (the human consult moment).
- **A09 photo covers + reel openers/closers** in the DESERT GRID system pull from this library.
- QA each (Higgsfield playbook gate): hands/eyes survive zoom? light natural? nothing screams AI? Regenerate misses; don't ship a tell.
- As you shoot **real** photos, swap them in — real always wins for anything captioned as a specific event.
