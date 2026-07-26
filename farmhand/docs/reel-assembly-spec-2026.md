# Reel Assembly — Phase 2 spec

> **STATUS: BUILT 2026-07-26** — `lib/assembleReel.ts` + the Draft-reel row
> in Reel Coach's ClipStudio. Two deltas from the spec below: captions are
> canvas-rendered transparent PNGs overlaid per beat (ffmpeg.wasm ships no
> fonts; canvas gets the app's real fonts + exact DESERT GRID styling), and
> VO shipped in the same pass (ElevenLabs per-beat segments, beats timed to
> narration length). "Later" items below remain open.

Phase 1 (shipped) ends with per-beat clips in the clip vault: one 9:16
Higgsfield render per remake beat, plus the script's `say` lines,
`onScreenText`, `textStyle` and `productionNotes`. Phase 2 turns that kit
into a draft reel without leaving Farmhand.

## Scope
One button on a reel card with a full clip set: **"Assemble draft"** →
a single 1080×1920 MP4: clips concatenated in beat order, trimmed to their
scripted durations, with burned-in captions. VO and music stay OUT of
scope for the first cut (the owner records VO per the script and finishes
in CapCut) — the draft's job is to prove the visual cut and caption timing.

## Approach: ffmpeg.wasm in a Web Worker (client-side)
- Vercel serverless can't hold ffmpeg + N clips inside a function budget;
  the clips are already ON the device in IndexedDB. Client-side assembly
  costs nothing and works offline.
- `@ffmpeg/ffmpeg` (wasm) in a dedicated Web Worker — same isolation
  pattern as the upload worker (`lib/reelUploadClient.ts`), so the main
  thread never freezes (the owner's environment is freeze-prone).
- Memory guard: process at 720×1280 for the draft (halves wasm memory);
  the final master is CapCut's job.

## Pipeline
1. Pull the reel's clips from the clip vault, sort by `beatIndex`; refuse
   to assemble with gaps (a missing beat = a hole in the story).
2. Per beat: trim/pad to the scripted duration (`-t`), scale/crop to
   720×1280, re-encode to a common profile (h264 + yuv420p, 30fps).
3. Captions: `drawtext` per beat from `onScreenText` — DESERT GRID
   caption system (bold sans, `PAPER #F4F0E6` fill, `NIGHT #101820` pill,
   y within the 380–1420/1920 safe band scaled, ≤6 words). `textStyle`
   is advisory; the account-wide caption style wins (spec §4.2: one
   consistent style, no karaoke bounce).
4. Concat (`concat` demuxer, re-encoded once), audio silent.
5. Output blob → saved into the clip vault as `beatIndex: -1` ("draft
   assembly"), playable + downloadable from the same card.

## UI
- "Assemble draft" appears only when every beat has a clip.
- Progress line per stage (encode beat n / concat / captions) — the
  worker posts progress events; never an indeterminate spinner.
- The draft card shows total runtime vs the script's target and flags a
  drift > 10%.

## Later (Phase 2.5+)
- VO: record in-app (MediaRecorder), auto-place per beat, duck nothing
  (voice is the only track).
- End-card: append a Composer-exported 1080×1920 PNG as a 3s tail.
- Auto-trim: cut each clip at its first hard motion beat (scene-change
  detection) instead of t=0.

## Why not server-side
Runtime budget (Vercel), clip egress cost, and the clips are already
local. If assembly ever needs to run headless (Cowork/cron), reuse this
exact ffmpeg command set on the Mac agent — the spec is the contract.
