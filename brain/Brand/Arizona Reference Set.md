# Arizona Reference Set (real photos → ground truth for every AZ scene)

Owner dumped **real Arizona listing photos** (2026-07-23) so the OS stops
drifting to generic/European/Midwest suburbs. This is the **visual ground truth**
for "Arizona" — the CMO's `ARIZONA` setting constant
(`farmhand/lib/consultantLibrary.ts`) and any DESERT GRID cover/reel that shows a
home must match what's below. When a generated environment doesn't look like
this, it's wrong — regenerate.

> **The single strongest lever:** build a Higgsfield **Moodboard** from these exact
> photos (see "Moodboard setup"). Reference images beat any text description — the
> moodboard makes every generated shot inherit the real AZ look at the source, so
> we stop fighting it in the prompt.

## What Phoenix homes ACTUALLY look like (read straight off the real photos)

**Exteriors**
- **Tan / greige / warm-beige stucco** — matte, sometimes two-tone (body + darker
  trim column bases). Single-story ranch and **two-story tract** both common.
- **Stone-veneer wainscot** at garage columns / porch bases on nicer two-stories.
- **Roofs: low-pitch concrete "S"-tile** — terracotta-brown, tan, or dark
  brown/charcoal. This is the #1 AZ tell. NOT steep dark asphalt gables.
- **Garages dominate the streetfront:** 2-car and 3-car (1+2 split), tan/almond
  panel doors, some with arched window inserts. Wide flat concrete driveways.
- **Yards are mixed, not all-gravel:** backyards are **decomposed-granite gravel**
  (tan/rust) with **freeform pools**; front yards are often gravel + round-trimmed
  shrubs, but **small irrigated green grass front lawns do exist** — don't hard-ban
  grass, just keep gravel/xeriscape as the default and never a lush Midwest lawn.
- **Plants:** agave, barrel/saguaro cactus, olive & mesquite (fine canopy), palo
  verde, **Mexican fan palms & date palms**, oleander, bird-of-paradise.

**Pools & backyards (very AZ, very common)**
- **Freeform / kidney pools** with tan **cool-decking**, boulder/rock accents.
- **Green wrought-iron pool safety fence** (code) — appears constantly.
- **Palapa / thatched umbrellas, talavera pottery, alumawood covered patios**,
  wicker patio sets, block privacy walls (tan CMU), citrus & cypress trees.
- Neighboring tan tile-roof homes just over the wall; sometimes a greenbelt/park.

**Environment / streetscape**
- Wide streets, low tan block walls, **distant brown/purple desert mountains**,
  big open sky, **hard bright dry sun** (high contrast, short midday shadows) →
  warm gold low light near sunset. Aerials: dense tan-roof subdivisions, curving
  streets, blue pool rectangles, desert edge + mountains framing the grid.

**Interiors (this is where the drift was worst — fix it)**
- **Vaulted / high ceilings** with a **half-round arched clerestory ("eyebrow")
  window** up high — the signature Phoenix tract-home move. Arched interior
  passthroughs/niches too.
- **Grey & greige walls** dominate (also warm-white). **Ceiling fans in every
  room** (heat). **Plantation shutters** or vertical blinds on sliders.
- **Floors: hard surface, not carpet** — grey **wood-look plank tile**,
  **travertine/stone tile**, or **grey marble-look porcelain**. Carpet only on stairs.
- Kitchens: **white, grey, maple, or espresso** cabinets; **granite or laminate**
  counters; stainless appliances; breakfast-bar island with stools; recessed cans
  + track lighting; slider to a gravel/pool backyard flooding the room with bright
  desert daylight. New-build Southwest, airy — never dark/cozy Northeast.

**Field / install**
- Crew on a **concrete-tile roof** setting **all-black (triple-black) panels** in
  clean flush rows, tan homes + desert behind. Panels also seen on low tile roofs
  from the backyard. Clean garages for Powerwall/equipment, work trucks in gravel.

## Moodboard setup (do this once in Higgsfield — biggest fix)
1. Higgsfield → **Moodboards → New**. Name it **`AZ Homes`**.
2. Upload these real photos. Include a **balanced spread**: 3–4 exteriors (stucco +
   tile roof + stone veneer + black panels), 2–3 **pool/backyard** (freeform pool,
   green iron fence, palapa), 3–4 **interiors** (the vaulted arched-window great
   rooms + kitchens), a roof/install shot, and a streetscape/aerial. ~12–18 images.
3. When you generate a consultant shot: select **your `taylor-consultant`
   character + the `AZ Homes` moodboard together**. Character locks *you*; moodboard
   locks the *Arizona environment*.
4. Keep the prompt's setting language (the `ARIZONA` constant) — it reinforces the
   moodboard, doesn't fight it. Change one variable at a time when tuning.

Result: exteriors, yards, roofs, mountains, interiors, and light all inherit the
real AZ look instead of drifting. This is the fix for "the environments don't match."

## Rule for the OS
- Any agent generating a scene with a home/yard/street/interior → the environment
  must match this set. Prefer the `AZ Homes` moodboard on every likeness shot.
- Indoor consult scenes → **vaulted ceiling + arched clerestory window + wood-look
  tile + grey/greige walls + ceiling fan**, bright daylight from a slider. That combo
  reads "Phoenix home" instantly.
- `ARIZONA` constant in code is the text mirror of this doc — keep them in sync.
- Real reference photos > AI for anything captioned as a **specific** job; these
  references also make the *believable-generic* AI shots read unmistakably Arizona.
