# Farmhand — Local Presence OS

A production **Next.js + TypeScript + Tailwind** rebuild of the Farmhand app, elevated to a
premium ("$20k") design. Every component from the merged Coyote content-generator + Farmhand
prototype is preserved — the **Composer** and **Post Studio** (originally the Coyote content
generator, now living inside Farmhand) get first-class, buttery-smooth treatment.

> The Coyote & Company recruiting landing page still lives untouched at the repo root
> (`../index.html`). This folder is the Farmhand application.

## Run

```bash
cd farmhand
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + a hand-authored design system (`app/globals.css`)
- **three.js** — global ambient particle field + the real-time 3D neighborhood farm
- **gsap** — magnetic buttons, hover-lift on the 3D clusters, camera fly-ins, ticker springs
- **next/font** — Geist, Space Grotesk, Orbitron, Chakra Petch, Geist Mono (self-hosted)

## Screens

| Screen | Highlights |
| --- | --- |
| **Dashboard** | 3D farm scene (parallax, hover-lift, click-to-fly-in), live-activity ticker, farm-health HUD, right-rail engine cards, presence-activity chart, 3D ↔ Live-Map toggle |
| **Content Engine** | Platform-native IG/FB/Nextdoor preview, approval queue, **Post Studio** (pillar-keyed accents, first-person photo logic, tiered image library) |
| **Composer** | Ratio / fill / accent controls, per-channel copy variants, branded live preview, tiered image library + device upload, **true-size canvas PNG export** (1080×1350/1080/1920) |
| **Local Playbook** | Copy → open group → mark posted flow, Perplexity scout column |
| **Calendar** | Week / month views, drag-to-reschedule, 70/30 volume/personal mix meter |
| **Active Groups** | Channel directory with rules, cadence, promo windows, health indicators |
| **Reply Assistant** | Tone-tunable, non-salesy reply drafting with copy |
| **Results** | Hero inbound number (count-up), stats, quick-add lead log |
| **Settings** | Voice profile, brokerage/legal, image prefs, connections |

## Architecture

- `lib/data.ts` — all authentic demo content (Jess, Gilbert AZ) as typed data.
- `lib/store.tsx` — single React-context state store mirroring the prototype's state model.
- `components/` — shell (`FarmhandApp`, `Rail`, `TopBar`), effects (`BackgroundFx`, `FarmScene`),
  primitives (`ui.tsx`: `MagneticButton`, `Switch`, `CountUp`), and `components/screens/*`.
- Every animation is `prefers-reduced-motion` guarded.

## Notes

- Demo images use `picsum.photos` seeds (swap for user uploads / licensed stock in production).
- The **Live Map** view uses a self-contained isometric map; the handoff calls for MapLibre GL +
  OSM tiles, which can be dropped in without structural changes.
- Publishing hooks (Claude / Perplexity / Meta Graph APIs) are represented in the UI and left as
  integration points.
