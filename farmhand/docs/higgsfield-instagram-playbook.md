# Higgsfield + Instagram Craft Playbook

Operating manual for Farmhand's visual generation (Post Studio → ✨ Post
visuals + the single-image panel). Condensed July 2026 from a deep-dive
knowledge base; specifics about Higgsfield's catalog are perishable — the
principles are not.

## Operating principles (applied in `lib/postVisuals.ts`)

1. **Aesthetic first, prompt second.** Pick a strong look (preset/pack),
   then write a SHORT concrete prompt: subject + setting + 1–2 lighting/lens
   cues + palette. Long over-stuffed prompts produce worse, more distorted
   output.
2. **One idea per asset.** One subject, one mood per slide; for video, one
   camera move per clip.
3. **Variety is a system, not an accident.** Rotate aesthetics, palettes,
   compositions deliberately — sameness is the #1 faceless-account killer.
   Farmhand enforces this with `AESTHETIC_PACKS` + a rolling recent-use log
   (`fh-visual-log`): consecutive posts never share a look.
4. **Consistency anchor amid variety.** One signature stays constant — for
   Farmhand it's the Arizona desert-suburb setting + the text-overlay
   design system. Variety in content, consistency in signature.
5. **The first 0.5 seconds are the whole game.** Cover frame + hook line
   decide the stop. The copywriter (`/api/copy`) enforces scroll-stopping
   hooks (number-led / contrarian / curiosity gap / question — rotated).
6. **Negative space.** Slides carry text overlays, so every image prompt
   reserves clean space and bans in-image text/logos/watermarks.

## Prompt formula (images)

```
[subject, concrete] + [setting] + [1–2 lighting/lens cues] + [palette/mood]
+ "negative space for text overlay, no text, no logos, no watermarks"
```

Photography language the models respond to:
- **Lens:** 85mm (portrait compression) · 50mm (natural) · 35mm
  (environmental) · 24mm (dramatic scale) · macro (detail)
- **Light:** golden hour · rim light · soft window light · hard flash ·
  volumetric rays · neon · blue hour
- **Grade:** teal-and-orange · muted film · high-contrast B&W · warm pastel

## Aspect ratios

- Feed post: **4:5** (we send 3:4 — the closest ratio the API accepts;
  export canvas is 1080×1350)
- Square grid: 1:1 · Reels/Stories: 9:16 · Widescreen: 16:9

## Higgsfield catalog (perishable — verify at cloud.higgsfield.ai)

- **Soul / Soul 2.0** — flagship photoreal image model. Our primary
  (`higgsfield-ai/soul/standard`, raw JSON body, `Key id:secret` auth).
- **Soul ID** — persistent character/mascot identity across generations.
  *Future: a recurring brand motif.*
- **Soul Moodboards** — build a reusable signature style from reference
  images. *Future: train a Farmhand brand look.*
- **Soul Inpaint** — fix a region instead of regenerating the image.
- **DoP video model** — camera-motion-native video (dolly, orbit, crash
  zoom; Lite/Standard/Turbo tiers). *Future: "Animate this post" for
  Reels — one move per clip, draft Lite → publish Standard.*
- **Shots app** — 1 image → ~9 cinematic angles (instant carousel).
- Hosted third-party: **Seedream v4** (2K stills — our first fallback),
  FLUX, Kling/Seedance/Veo (video). Paths follow
  `provider/model/version/task`; never hardcode unverified paths.

## API pattern (what Farmhand implements in `/api/higgsfield`)

- Start jobs fast, return `request_id`/`status_url` handles, poll
  `/requests/{id}/status` from the client. Statuses: queued / in_progress /
  completed / failed / nsfw. Results: `images[].url`.
- On `failed`: retry with a simpler prompt. On `nsfw`: rework wording.
- Keys live ONLY in env vars (Vercel). Never in code or exports.

## Instagram structures worth rotating

Curiosity gap · pattern interrupt · aspirational still + one sharp line ·
micro-story (before→after) · list carousel (one idea per slide, payoff +
CTA on the last slide). Carousels: consistent visual system, escalate
value, end on payoff + CTA — exactly the Studio's cover/body/CTA model.

## Pre-publish checklist (mirrors the Studio flow)

- [ ] Cover + first line stop the scroll on their own
- [ ] Right ratio for placement
- [ ] No AI artifacts (hands, warped text/geometry) — regenerate the slide
- [ ] Look differs from the last few posts (pack log handles this)
- [ ] Signature present (AZ setting, overlay design system)
- [ ] Text legible: real contrast, safe margins (dimness slider)
- [ ] Caption: hook line + value + CTA; hashtags relevant, not spammy

## Future connectors (not yet in Farmhand)

Trend/idea intelligence feed · TTS voiceover + Lipsync for talking Reels ·
performance loop (read back which packs/hooks won and weight toward them —
natural fit once post-performance data exists in Insights).
