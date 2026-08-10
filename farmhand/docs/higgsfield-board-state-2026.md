# Higgsfield Board & Asset State (Aug 2026)

> **Companion to `higgsfield-prompting-playbook-2026.md`.** That file holds the *rules*.
> This file holds *current state*: which moodboards actually exist, what is really in
> them, what source material is on disk, and what the founder has ruled out.
> Read this before generating anything or writing board-selection logic.

_Last verified in-app: 2026-08-04._

---

## 1. Moodboard inventory (verified in the Higgsfield UI)

Four boards exist on the account:

| Board | Refs | Verified contents | Use |
|---|---|---|---|
| **AZ Grid v2** | **54** | Purpose-built. Residential AZ + rooftop/solar + operator-subject coverage. Count meter PERFECT, quality GOOD @647px. | **Primary. Route all new generation here.** |
| AZ Grid | unknown | Predecessor of v2. | Superseded — do not use. |
| AZ Homes | unknown | People, portraits, an animal, a bathroom interior. | **Do NOT use for residential exteriors.** See §2. |
| AZ real estate and solar | unknown | Mixed lifestyle/interior (poolside figure, interior sink, person with camera). | Limited. Not a residential-exterior source. |

### 2. Correction — `AZ Homes` does not contain what its name implies

Earlier guidance in this workstream recommended routing residential beats to **AZ Homes**
on the strength of its name. That recommendation was **wrong and was never verified against
its contents.** Its rendered thumbnails are people, portraits, an animal, and a bathroom —
not house exteriors.

**Rule: never select a board by name alone.** Board names on this account are historical and
do not describe contents. If engine code picks a board, it must pick `AZ Grid v2` explicitly,
not infer from a name string.

This is moot for generation (v2 carries residential itself) but matters for any
board-selection logic and for anyone reading older notes.

---

## 3. Local source library

`~/Documents/photo-pull/` — **437 files**, pulled from the founder's photo library.

```
photo-pull/
  taylor/            395   founder, varied scenes/wardrobe/lighting
  az-homes/           26   residential exteriors (the real ones)
  solar-and-roofs/    16   panels, roof decks, install context
```

`solar-and-roofs/` + `az-homes/` = the 42 usable solar/property frames.
This library — not Commons/stock — is what got `AZ Grid v2` to 54 refs.

---

## 4. Founder constraints (stated 2026-08-04)

1. **No new footage will be shot.** Confirmed directly and treated as settled. Any reel must
   be assembled from the existing stills library above — cuts and slow pushes, no live motion.
   Do not build features or plans that assume capture.
2. **Monday's post is the educational video**, not the lifestyle reel.
3. Founder approves generated frames **before** video credits are spent. Frames first, always.

---

## 5. Current status / next action

- `AZ Grid v2` — **built and content-verified 2026-08-04.** Dataset opened and inspected, not
  just counted: AZ stucco single-storys, aerial suburban rooftops, concrete S-tile roof texture,
  aerial homes w/ rooftop arrays + pools, saguaro golden hour, desert mountain skies, grid
  transmission structure. Correct coverage for the educational video.
- **Known UI artifact:** v2's tile in the board picker can render blank/empty while its dataset
  is fully present. Do not treat an empty picker tile as a failed board — open Dataset to confirm.
- **Trap found 2026-08-04:** the image composer was silently holding **AZ Homes** as the attached
  moodboard. Any generation run in that state would have drawn style from portraits/interiors
  instead of AZ residential. Corrected to `AZ Grid v2` via the board's "Use preset".
  *Verify the attached board immediately before every generation run — the composer does not
  default to the board you last built.*
- **Next:** generate 9 per-clip start frames off `AZ Grid v2` for the educational video
  (`news-alert-v2` script), send for founder yes/no, and only then spend on video generation.
- Credits: ~50 spent on board builds. 235 free generations untouched. Nothing spent on video.

---

## 6. Carry-forward rules for the engine

```
board selection        -> hard-pin "AZ Grid v2"; never infer a board from its name
before every gen run   -> assert attached board == AZ Grid v2; composer does NOT default to it
empty board tile       -> UI artifact, not failure; confirm via Dataset tab before rebuilding
residential exteriors  -> AZ Grid v2 (or photo-pull/az-homes as raw refs); NEVER AZ Homes
recurring founder      -> photo-pull/taylor is the identity source (395 frames)
reel assembly          -> stills-only pipeline; no capture step may be assumed
spend gate             -> frames rendered + founder-approved BEFORE any video credits
```

## Account direction (2026-08-10)
Grid content rules for @taylorlucesolar now live in **`ig-account-direction-2026.md`** —
two lanes only (lifestyle / educational solar), sales-wins and recruiting content are
Stories-only, and the field-sales persona is retired. Read it before planning any post.
