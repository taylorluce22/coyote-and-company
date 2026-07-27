# Log

Every agent run appends here, newest on top. Format:

```
## YYYY-MM-DD · <agent>
What was done · what was spent · what needs a human
```

---

## 2026-07-27 · BOOT-CRASH FIX — WebGL off by default, image vault bounded
Owner report: loading Farmhand crashed ALL of Chrome again. Two
boot/near-boot browser-killers found and removed:
- **BackgroundFx ran a three.js WebGL render loop on EVERY screen from
  boot.** WebGL lives in Chrome's shared GPU process — starve or wedge it
  and every tab + the browser UI goes down (exactly the reported
  signature, and it fires BEFORE any card is opened). The particle field
  is now OPT-IN (Settings → Performance → "3D particle background",
  off by default), three.js is dynamically imported so it's not even in
  the boot bundle, contexts are low-power with a webglcontextlost
  handler, and the render loop pauses when the tab is hidden. The CSS
  aurora look stays. **?safe=1** on any URL is the standing panic switch
  (sticky until ?safe=0).
- **Composer's AI image vault loaded EVERY generated image as a
  full-size dataURL at mount and rendered them all** — unbounded decoded
  bitmaps (hundreds of MB once the vault grows), the memory-pressure
  twin of the wasm crash. Now: collapsed by default, opens on demand,
  newest-12 page with Show More (IndexedDB v2 createdAt index cursor —
  never a full getAll on the UI path), and closing frees the bitmaps.
Rule reaffirmed for every future screen: no always-on GPU loops, no
unbounded media materialization — heavy is server-side or on-demand.


## 2026-07-27 · MEDIA ACTUALLY PLAYS — same-origin range streamer
Posters fixed the stall but exposed a separate bug (Cowork, prod c31142b):
every vault video parked at readyState 0 and never rendered a frame. Root
cause: vault Blob URLs are CROSS-ORIGIN; the store honors Range (206 with
correct bytes) but does not expose `Content-Range` / `Accept-Ranges` to the
page, so the media engine can't build a seekable stream. A full GET works —
which is why the download links always worked and this hid for two ships.
Fix: **/api/media?u=<vault blob url>** streams the blob SAME-ORIGIN with
real range semantics (206 + Content-Range + Accept-Ranges + Content-Length
+ correct Content-Type; 200 + Accept-Ranges on a full request), body piped
through so memory stays flat. Every playable element (beat clips, draft,
compare pair, VO audio, the duration probe) now points at it; posters and
download links stay on the direct CDN URL. One-video-at-a-time rule intact.


## 2026-07-27 · ZERO-CRASH MEDIA — posters + one-video-at-a-time
Owner priority above all polish: "basic functions with ZERO crashes, zero
manual intervention." Cowork isolated the remaining stall (prod b749ea9):
the card rendered every beat clip AND the draft as live <video>, so
scrolling the beat grid into view made Chrome decode ~5 streams at once →
~30s tab stall (self-recovering, unlike the old wasm whole-browser
freeze). Fixed at the root:
- **Server posters**: `/api/assemble phase:"posters"` extracts one small
  JPEG per vault video (clip-N.jpg, draft.jpg, refs/<job>.jpg) with the
  native ffmpeg. Idempotent → also the BACKFILL for reels made before
  posters existed (the APS card's 4 clips + draft). Vault manifest now
  carries posters/draftPoster.
- **One decoding <video> in the DOM, ever**: the grid and draft render
  `<img>` poster tiles with a ▶ overlay; pressing play mounts a single
  <video> and evicts whichever item held the slot. Compare view is
  poster-gated too (its two players mount only after an explicit play,
  which first evicts everything else). preload="none" everywhere, no
  autoplay-on-render; VO players downgraded to preload="none";
  collapsing a card or switching workspace releases the slot.
- **Client audit**: only two <video> JSX sites remain in the whole app,
  both gated; no whole-media in JS/IndexedDB/data-URLs (remaining
  canvas/dataURL paths are images only: Studio exports, consultant
  library, the small voice-clone sample).


## 2026-07-27 · P1+P2+P3 — everything server-side, premium tier, compare view
Taylor's directive ("the app keeps freezing — ALL of it hosted on a
server") executed as three ships on the branch:
- **P1 (b588a05): server-side media vault.** All clips/VO/drafts/reference
  videos live in Vercel Blob (vault/<client>/<reelId>/…); the browser
  stores URLs and streams off the CDN — zero media bytes on the main
  thread, IndexedDB media retired via a confirm-before-delete one-time
  migration. Higgsfield clips ingest server→server; TTS stores
  server-side; assemble reads/writes the vault directly. 3-lens
  adversarial review; all confirmed blockers/warns fixed (DNS-resolved
  SSRF guard, streamed ingest cap, cache-bust + 60s TTLs, manifest merge,
  migration pinning).
- **P2 (78079e8): premium quality tier**, selectable per reel with cost
  shown before spending (~$0.60/clip standard vs ~$2.52/clip premium):
  premium renders a style-locked KEYFRAME image per beat (shared seed)
  then animates it with top-fidelity image-to-video (hailuo-02 pro 1080p
  anchor; HIGGSFIELD_VIDEO_MODELS_PREMIUM env override) and assembles at
  1080×1920 CRF 19. All keyframes must land before any video credit is
  spent.
- **P3 (78079e8): Reference-vs-Draft compare** on the card — synced
  side-by-side players (reference leads with audio, draft follows the
  scrub) streaming from the vault. References are preserved at analysis
  time from now on; cards analyzed BEFORE this ship (incl. the APS card)
  have no stored reference — re-run the analysis to unlock the compare.


## 2026-07-27 · ✅ FIRST FULL PIPELINE RUN CONFIRMED — reference → posted-ready reel
Cowork verified end to end on production (75d5c41): ⚡ Produce reel on the
banked APS rate-case card skipped banked beats + VO (zero re-spend),
uploaded the timeline, /api/assemble encoded natively, and a finished 14s
9:16 draft.mp4 — Eric narration + burned DESERT GRID captions — landed on
the card. Tab responsive throughout; freeze class confirmed dead; the
prep-stage read-hang fixed by the bounded self-naming awaits (75d5c41).
The full chain is live: reference video → style genome → adapted APS
script → Higgsfield clips → ElevenLabs VO → one tap → draft reel, no
CapCut required. Owner next steps: record the teleprompter sample
(Settings › Spoken voice, shipped in 124fb54) to arm the personal-voice
lane; review/post the APS draft; MERGE the branch to main — production
still runs a manually promoted preview and a stray push to main would
roll it back.

## 2026-07-27 · ASSEMBLY GOES SERVER-SIDE — the browser-freeze class is deleted
Three client-side assembly architectures all froze Chrome (v3 froze the
whole browser + Mac): root cause was ffmpeg.wasm's grow-only heap
exhausting unified memory — the workload, not the thread. **Rule: no
browser encode, ever.** Now: ClipStudio uploads the banked clips/VO/
caption-PNGs to Blob (`reels/asm/`), **/api/assemble** runs NATIVE ffmpeg
(ffmpeg-static, traced into the function; one filter_complex pass, x264
veryfast CRF 20, ~15-60s) and returns a Blob URL; the client banks the
MP4 and burns the remote copies. Filter graph validated against the real
binary before ship. Also in: **⚡ Produce reel** one-tap (beats → VO →
assemble; every stage reads the vault fresh and skips banked assets — never
re-spends; credit confirm only when clips are missing).

## 2026-07-26 · VOICEOVER + ASSEMBLY — a finished draft reel comes OUT of Farmhand
The "silent b-roll" gap is closed on `claude/app-performance-max-h8tgoc`:
- **ElevenLabs lane (/api/tts):** per-beat narration from the remake's
  "say" lines (sync TTS, vault-first per segment, re-run skips finished
  beats); TWO voices per workspace for the 70/30 mix — brand narrator
  (workspace pick or ELEVENLABS_VOICE_ID default; never a legacy Default
  voice, those retire Dec 31 2026) and **Instant Voice Clone** recorded in
  Settings › Spoken voice. Needs ELEVENLABS_API_KEY in Vercel (+
  ELEVENLABS_VOICE_ID after Taylor auditions; ELEVENLABS_MODEL optional).
- **Phase 2 assembly (ffmpeg.wasm, client-side):** 🎞 Assemble draft
  stitches clips in shot order, times each beat to its narration, burns
  DESERT GRID captions (canvas-PNG overlays), optional low music bed →
  one 720×1280 draft MP4 saved in the clip vault, playable/downloadable
  on the card. CapCut is now polish, not required.
- Hailuo duration fix shipped earlier today (numeric duration, [6,10]
  snap, hailuo-anchored ladder) — 67fadb4.

## 2026-07-26 · STYLE GENOME + HIGGSFIELD VIDEO LANE — extract → adapt → generate, in-app
Two ships on `claude/app-performance-max-h8tgoc` (production currently runs
the PROMOTED preview of this branch — merge to main when ready, a main push
rolls it back):
- **Style genome pipeline (c8f90bf, Cowork-verified FULL PASS ×2 runs):**
  reference analysis is now structured extraction (timestamped beatMap, hook
  mechanics, visual language, editing/persuasion systems, reusableStyleRules,
  preserveVsReplace, recreationBrief) with a hard style-vs-topic split; one
  shared Stage-2 adaptation prompt (Claude) + originality/quality gate
  (verbatim-overlap, weak-hook, no-proof, generic-language flags);
  deterministic Higgsfield master prompt compiled from genome fields;
  Re-adapt reruns Stage 2 from the saved genome — no re-upload, no Gemini
  cost. Prompts to tune: EXTRACTION_PROMPT (video-reference route),
  buildAdaptationPrompt (claudeScript), buildHiggsfieldPrompt (styleGenome).
- **Stage 3 — beat clips in-app:** /api/higgsfield grew a VIDEO lane (t2v
  model ladder, env-overridable via HIGGSFIELD_VIDEO_MODELS, shared seed,
  9:16, per-beat duration) + video proxy; new clip vault (IndexedDB, per
  client); Reel Coach "Generate beats" renders every remake genPrompt with
  Composer-style crash-proofing (pending record before poll, vault-first
  commit, ⟳ Recover) and per-beat status/playback/download. Phase 2
  assembly SPEC'd (ffmpeg.wasm worker) in
  `farmhand/docs/reel-assembly-spec-2026.md`, not built.
- Needs a human: HIGGSFIELD_API_KEY/SECRET into Vercel env (Cowork);
  first live video run will reveal the real t2v route — set
  HIGGSFIELD_VIDEO_MODELS if the default ladder misses.

## 2026-07-25 · SCRIPT WRITER v2 + SCRIPT STUDIO — details that survive into generated video
Owner produced his first AI video from a remake script: "pretty cool
for a first draft but i need the quality enhanced and the script writer
to be better so the details turn out in the video better." Root cause:
v1 beats ("shot: show a graphic") lose all craft on the way into a
video generator — the generated clip is only as detailed as the text
it's given. Two builds:

- **Script writer v2** (style-match remake): every beat now carries
  camera language, a complete visualDetail (every visible element,
  materials, lighting, what moves), textStyle (how captions animate),
  VO fitted to duration at ~2.5 words/sec — and a paste-ready per-beat
  genPrompt (9:16, self-contained, no vague adjectives, protagonist
  described identically across beats since generators have no memory).
  Rendered in AnalysisCard with collapsible one-tap-copy prompt rows.
- **✍️ Script Studio** (/api/reel-script + card in Reel Coach): scripts
  from SCRATCH — topic × style × 15/30/45s, same v2 format. Style can
  be a preset (3D caricature, motion graphics, talking head, b-roll)
  or "Match: <analyzed reel>" which seeds the writer with that reel's
  styleDna — one analyzed reference now powers unlimited scripts.
  Scripts save into the reel vault as ✍️ cards.

## 2026-07-25 · FIRST COMPLETE REEL RUN ✓ — and the real saboteur was the blob store
The Cowork agent on the owner's Mac ran the whole pipeline end to end:
exported the clip from the Photos library, compressed 81.5MB → small
via avconvert, uploaded from the terminal, job-start with the
data-center style-match topic — received → analyzing → done in ~40s.
Analysis verified correct against the reference (3D caricature
pattern-interrupt hook rated strong, ~5 cuts at 2–4s, synced yellow/
white captions, billionaire-loans explainer structure).

Root causes found by the on-Mac agent, invisible from the repo side:
- **The original Vercel blob store was PRIVATE.** The app uploads with
  access:"public"; a private store plausibly explains every "stalled at
  zero bytes" upload across Chrome/Safari/builds. Agent created public
  store `coyote-and-company-blob-2` and repointed the project env; the
  old private store sits unused (safe to delete in Vercel someday).
- **gemini-2.5-flash was retired by Google** — analyze 404'd. Env var
  GEMINI_MODEL=gemini-3.6-flash now set in Vercel; code default updated
  to match so a fresh deploy without the env var still works.
- Pipeline used to delete the video blob even on a FAILED ingest,
  which 404'd the agent's first retry — now the blob survives ingest
  failure (received.videoUrl re-ingest path actually works) and is
  cleaned up by job-ack; remote-lane failures stay non-retryable.

## 2026-07-25 · JOB INBOX — agents anywhere, results in the app (owner friction catch #10)
Owner: "get Claude to complete this task by using Cowork… so I don't
have to keep going back and forth." The missing bridge: jobs can be
STARTED from outside any browser (Cowork terminal: blob upload via
@vercel/blob + phase job-start), but results only landed in whichever
browser held the pending record. New phase `job-inbox` lists finished
jobs; Reel Coach sweeps it on open and banks anything waiting — so
"agent uploads from the Mac, breakdown appears in the app" needs zero
manual hand-off. Jobs now carry a `client` tag end-to-end and bank
into their HOME client's vault.

Adversarially verified (3 lenses) — 13 confirmed defects fixed before
ship: banked-set now written by EVERY banking path (failed acks no
longer re-import duplicates); sweep concurrency guard + cancellation
(StrictMode double-mount / workspace switch); per-entry error isolation;
per-iteration banked-set re-reads; server-side dedupe by jobId (a job
with two done records imported twice); 3-minute grace window so an
active watcher always banks before the inbox can ack a result away;
list pagination + 48h journal GC; re-ack of lingering journals; cap
100 banked ids (20 could evict inside the 40h journal window).

KNOWN LIMITATION (documented, accepted for a single-owner unlisted
tool): the app has no auth anywhere, and job-inbox makes finished-job
ids enumerable — a stranger with the URL could read or ack unbanked
analyses during the brief window before the owner banks them. Optional
gate shipped: set REEL_JOB_TOKEN (server) + NEXT_PUBLIC_REEL_JOB_TOKEN
(app) in Vercel and the enumerate/delete phases require the token.
Real per-user auth is the proper fix if this app ever gets more users.

Also: upload preflight speed check + 90s stall watchdog shipped earlier
today after the diag trail proved every upload ever attempted stalled
at zero bytes (network path, not machine). Owner's Safari run confirmed
alive; Chrome-on-his-Mac remains the one environment that hard-freezes.

## 2026-07-25 · Photos-placeholder canary + attach hardening (owner friction catch #9)
Owner: still a complete freeze, "doesn't work at all", even post-worker.
Freeze-hazard audit agent (with 20x-CPU-throttle Playwright verification)
found the remaining wedge class: macOS Photos-library-backed Files are
promise-backed placeholders — reading .name/.size, or structured-cloning
the File into the worker via postMessage, can force full materialization
on the main thread and hard-wedge a memory-pressured tab. Six fixes:

- **probeFileReadable()**: 64KB canary read raced vs 10s timeout runs
  BEFORE the worker ever sees the File. Timeout/failure → fast
  plain-English "save it to Files/Desktop/Dropbox first" instead of a
  freeze; crumbs before/after so a wedge during the probe names itself.
- Lite page onChange metadata reads now defensively wrapped (was the one
  gap vs pickFile); metadata snapshotted ONCE into state — render and
  start() never touch the File object again.
- FILE_UNREADABLE is distinct from WORKER_UNAVAILABLE so an unreadable
  file can never fall through to the main-thread upload (which would
  wedge worse); ReelCoach rethrows it past the generic upload catch.
- ReelCoach onDrop dataTransfer access wrapped; analyze()'s unguarded
  metadata console.log moved inside try.
- Reported, not fixed: ReelCoach JSX re-reads file.name/.size in render
  (post-successful-pickFile, judged safe; refactor too broad).

Under 20x CPU throttle: attach 973ms, worst main-thread stall 470ms,
errors surface cleanly, crumb order verified. Owner's Mac (via Cowork
health snapshot): M5 16GB, ~70MB free, 2GB swap, three browsers — the
machine-side amplifier. VPS/Mac-mini ruled out with data: CPU relaxed,
no throttling, 295GB disk free; RAM pressure + main-thread file work
was the collision, and both sides are now addressed.

## 2026-07-25 · Worker uploads + LITE UPLOADER page (owner friction catch #8)
Owner: "i had to force quit chrome again when trying to upload" and "have
the content be a separate app that doesnt share GCU with the main app."
He's right about the contention: the full app carries three.js, GSAP and
the whole shell while an 81MB clip uploads on the main thread, and the
ETA feature was re-rendering the screen on every progress event. Two
structural moves:

- **Web Worker uploads**: the entire blob upload (file slicing, multipart
  machinery, retries) now runs in `workers/reelUpload.worker.ts` — the
  tab's main thread only receives a throttled (300ms) progress message.
  Main-thread fallback kept for browsers without worker support, itself
  throttled to 250ms per re-render. Used by both Reel Coach and:
- **/reel-upload — the Lite Uploader**: a standalone page that is exactly
  what the owner asked for without a second deployment: no store, no
  three.js, no GSAP, no app shell — 158kB first load vs 489kB for the
  app. Pick clip → worker upload → job-start → same watch loop → banks
  straight into the shared IndexedDB vault and clears the shared
  fh-reel-pending record, so the breakdown appears in Reel Coach like it
  was run there. Handles style-match topics (reads strategy from the
  active workspace's localStorage), resumes an in-flight job ("⟳ Check on
  it"), wake-locks while live. Linked from Reel Coach's drop zone
  ("⚡ Browser keeps freezing? Use the Lite Uploader").

Playwright smoke (iPhone 13 emulation, prod build): page renders clean,
worker constructs and relays SDK errors correctly (verified via crumb
trail — no fallback crumb), main-thread probe 1ms during a run.

## 2026-07-25 · Server-driven reel JOBS — the phone can leave (owner friction catch #7)
Owner: 81.5MB run "never finished" + "we need something i can dump bigger
files into." Root cause of never-finishing: the phased flow still made the
BROWSER hold a request open for every step (hand-off up to 280s, then
polling, then a ~2min analyze) — phone auto-lock or a backgrounded Safari
tab kills whichever request is in flight. Ownership flipped:

- **Job pipeline**: after the Blob upload, ONE fast `job-start` call and
  the server runs everything in the background (Next `after()`): blob →
  Gemini (streamed 32MB-chunk resumable relay — nothing big ever sits in
  serverless memory), poll ACTIVE, analyze, journal each state as
  IMMUTABLE Blob records `reeljobs/<id>/<ms>-<state>.json` (done always
  wins; new pathname per write so CDN caching can't serve a stale state).
  Client peeks `job-status` every 4s, kicks `job-continue` for a fresh
  300s budget when a big clip outlives the first invocation, `job-ack`
  burns the journal after banking. jobId minted CLIENT-side and persisted
  before the start call — a lost response can strand nothing.
- **1GB cap** (was 200MB) end to end: blob token, client gate, copy.
- **Wake lock** while a run is live (auto-lock mid-upload was the silent
  killer) + upload ETA from measured transfer rate + elapsed timers on
  every stage (this morning's ask).
- **Auto-bank on open**: jobs finish while the phone is away; opening the
  screen silently banks a finished breakdown — zero taps.
- Also closed: the legacy blob lane fetched ANY client-supplied `url`
  server-side (SSRF read primitive) — every server-side fetch of a
  client url now validates *.blob.vercel-storage.com.

Legacy phases + monolithic flow kept for back-compat with open tabs on
older builds; legacy pending records still resume through the old path.

Adversarial review (11 agents, 3 lenses + refute-verify) confirmed 8
majors, all fixed before ship: job-status error responses used the
`error` key phasePost treats as transport failure (error branch was
unreachable → renamed jobError); a flaky read of the done record could
bank an empty analysis and ack away the only copy (guarded both sides);
retryable errors were a Resume dead-end (client now auto-kicks
job-continue, capped); Gemini FAILED/NOT_FOUND during a client-less gap
wedged the loop (journal converges server-side); store-wide blob
deletion via crafted url (reels/ path-prefix binding at token + every
fetch/del); ingest killed mid-relay stranded the job + orphaned up-to-
1GB blob (received record journals enough to re-ingest, Dismiss acks);
kick-spam could spawn duplicate generateContent pipelines (shared
client cooldown + server in-flight claim record).

## 2026-07-25 · Reel Coach "once and for all": link lane + one-tap diagnostics
Owner still hits browser freezes on his own machines (Mac + phone) even
though the flow passes instrumented freeze tests in emulation — the
remaining failures are environment-specific and invisible from here. Two
moves close the loop permanently:

- **🔗 Analyze-from-link lane**: paste a Dropbox/Drive share link and the
  SERVER fetches the video (SSRF-guarded: https-only, private IPv4+IPv6
  ranges blocked, redirects followed manually with every hop re-checked,
  ~200MB cap, HTML responses rejected with fix-your-link guidance,
  Dropbox/Drive links auto-converted to direct download). The browser
  never touches the file — nothing to freeze. Reuses the phased
  poll/analyze client, pending-resume, and style-match wiring.
- **📋 Copy report for Claude**: one tap copies build stamp, user agent,
  screen/DPR/PWA state, current error, pending status, and the full
  breadcrumb trail. "Read me the trail" is now one tap + one paste.
- Photo-album smoothing: album-reality copy on quicktime/big attaches
  (iPhone converts during picking — use Files or the link lane), Mac
  drag-out-of-Photos-first guidance, pickFile fully try/caught.

Verified by agent on iPhone 13 emulation AND 1440px desktop: attach
feedback 34-36ms, graceful errors everywhere, link-lane error paths
clean, diagnostic report contents asserted, main-thread max gap 240ms.
Agent also caught an IPv6 SSRF bypass (fixed) and the redirect-hop gap
(fixed in review).

## 2026-07-25 · FULL MOBILE PASS — three agents in parallel (owner friction catch #6)
Owner on phone: "when i click on content nothing happens." Root cause: the
app never had a phone layout — the side rail stacked as 15 full-screen
cards with the selected screen rendering below the fold, AND desktop-width
elements (topbar tool cluster ~663px, subtab strips) forced the layout
viewport to ~680px so mobile Chrome zoomed the whole app to ~58%.

Ran three agents in parallel (verifier in-repo; Studio fixer + full-screen
auditor in isolated worktrees, own ports):

- **Verifier**: chip-bar nav confirmed (59px tall, all tabs open on tap);
  found+fixed the topbar wrap, subtab wrap (Reel Coach tab was literally
  unreachable on phones), and enggrid collapse. **Reel Coach 60MB attach
  test PASSED**: attach feedback in 37ms, max main-thread gap 58ms vs a
  3000ms freeze threshold, graceful errors, breadcrumbs verified.
- **Auditor**: all 16 screens now 390/390, canvases render correctly at
  phone size. Ranked 4 majors — all fixed: Connectors get-key links
  became real buttons, Settings toggle rows are whole-row tap targets,
  MiniBtns tappable height, Knowledge Vault legend/detail flow below the
  canvas on phones ("Tap a node" copy swap). Plus: SubTabs height bump,
  Progress ring label 9.5px, Template Studio slides fit 320px phones,
  BackgroundFx sizes from clientWidth (innerWidth misreports under
  transient overflow and baked the canvas wrong).
- **Studio fixer**: Composer single-column on phones (useIsPhone hook —
  inline grid style needed runtime collapse), fit() padding + Resize-
  Observer, 38px slide-nav targets with 26px dot tap areas — AND caught a
  pre-existing DESKTOP bug: html2canvas exports through the stage's
  ancestor scale() were corrupted; capture() now shoots a hidden unscaled
  clone → pixel-perfect 2160×2700 exports verified on phone and desktop.

Everything built green and merged. The phone is now a first-class device.
Owner wanted the app on his phone "as if logged in" — but there are no
accounts; data is per-device localStorage. Built the no-setup path:

- **Settings → 📱 Use on phone**: exports the active client's lossless
  bundle, AES-GCM encrypts it in the browser (key travels only in the
  link's #fragment — never reaches a server), parks the ciphertext in
  Vercel Blob (already-configured infra), and yields a one-time link.
  Open on the phone → the app imports the whole setup, switches into it,
  burns the blob, scrubs the URL. Works even on a fresh, not-onboarded
  device (receiver runs above the onboarding gate).
- **PWA install**: manifest + generated brand icons (night bg, ember
  glow, DG diamond) + apple-touch-icon + standalone display — "Add to
  Home Screen" makes it a real app icon, full-screen.
- New /api/handoff route: upload tokens scoped to handoff/ paths
  (100MB cap) + a delete callback so blobs never linger.

Caveat logged for the owner: handoff is a snapshot, not a live sync —
edits on one device don't flow to the other. The Supabase memory layer
(scaffolded, needs 3 keys) remains the real multi-device answer.

## 2026-07-25 · Reel Coach crash FIXED — phased flow + adversarial review (owner friction catch #5)
Owner: "it wont analyze and it crashes the app… every time." Root causes
(fix agent, high confidence): (1) the monolithic /api/video-reference
invocation ran up to ~450s of work against a ≤300s function ceiling — real
clips died mid-flight every time = "won't analyze"; (2) the browser sent
the whole 100–200MB clip as ONE buffered request (no multipart) while the
three.js background scene kept running = the tab-OOM crash profile.

Fix (same crash-proof shape as the Higgsfield pollBatch): multipart chunked
upload with live progress; server split into client-driven phases
start/status/analyze from shared helpers (monolithic path kept for
back-compat); blob always deleted; PendingReel record persisted the moment
the clip lands at Gemini (per-client, 40h TTL) with a ⟳ Resume strip — a
crash can no longer lose an upload; __fhSuspendBg now also freezes the
aurora CSS animations; every failure lands in the error strip in plain
English with trim-the-clip guidance.

Then a 4-lens adversarial review workflow (state machine, regressions,
memory, error-UX) confirmed 3 additional majors, all fixed before merge:
- vault write result was DISCARDED — a failed IndexedDB save silently lost
  the analysis AND pruned the pending record; now enforced (throw before
  cleanup, Resume survives)
- client start timeout (240s) undercut the server's 260s worst case — a
  SUCCESSFUL Gemini hand-off could be discarded with no resume record;
  now 280s
- a mid-run client switch wrote the analysis into the WRONG client's vault;
  reelVaultAdd now pins to the run's client

Style-match mode untouched. Build green. Practical owner guidance: trim
references to the best ~90 seconds — Gemini needs the style, not the
runtime.

## 2026-07-25 · Depth pass + Style Match (owner friction catch #4: "flat and 2d")
Owner: "everything just looks flat and 2d… we need things to pop… with the
right pictures and animation." Ran the motion/visual research agent — key
finding: the spec's own §1.4 depth treatments (grain, light direction,
glows, scrims) were never implemented in the renderer, and box-shadow/CSS
filters don't survive html2canvas, so all depth must be gradient+SVG built.

**Shipped — depth pass (DGSlide.tsx):** directional light on every surface
(paper radial, night linear — no more flat fills), inline-SVG film grain on
every slide, radial glow behind A01 hero numbers, warm ember wash on night
covers/closers, chart-as-object (area fill + terminal halo + paper-stroked
label), gradient hot bars, layered edges + contact shadow on the myth-bust
verdict bar, oversized edge-clipped ghost numerals on listicle slides. All
html2canvas-safe. Verified via Playwright render.

**Shipped — 🎬 Style Match (Reel Coach):** the owner asked "can I record my
screen and upload a video for an agent to review so we can reproduce a
similar style with my topics?" Yes — the Gemini video-analysis plumbing
already existed (reference mode). Extended it: pick any of the 44 topics
next to the upload, and the same Gemini pass that watches the reference now
also returns styleDna (beat-by-beat: visuals, on-screen text treatment,
transitions, energy) AND a shot-for-shot remake script — hook line, what to
film, spoken lines word-for-word, on-screen text, beat durations, CTA —
constrained to KB facts, APS-only, solar landing. Renders in the analysis
card + copies out as markdown.

**Queued from the brief (next):** photo-hybrid covers (auto-attach vault/
stock/Higgsfield photos to A06/A16 with scrim + duotone — the "pictures
already attached" ask) and the animated cover-teaser recorder (WebM: number
count-up / chart draw-on via canvas captureStream — the real "animation").

## 2026-07-25 · CONTENT ENGINE OVERHAUL — the craft laws finally consumed (owner friction catch #3)
Owner, after his first Studio session: "only rotating 3 ideas… I hate the
way the content looks… the template is redundant and doesn't follow high
quality pages' viral posting laws… that information was not consumed or
added to this system." He was right on every count. Ran a research agent
over the full craft corpus (content-engine-spec-2026.md, Design & Format
Playbook, Editorial Direction, Idea Bank) → gap audit → implemented:

**Idea supply (the "3 ideas" bug):** `ideasFor` sliced 5+4+3 items from
fixed windows — HALF the KB bank was mathematically unreachable, and 29
territories duplicated the same titles. Now: full banks, deduped by title
(territory is a label, not a multiplier), themes interleaved so no two
consecutive ideas repeat a pillar. **44 unique ideas surface (was ~12
repeating)** — including 12 newly authored entries ingesting the brain
Idea Bank clusters that never made it into the app: doubling clock, no-
plan-opts-you-out, data-center trio (64k homes / 4° waste heat / who pays
for the boom), VPP rent-your-battery, battery-beats-4–7pm, off-peak cheat
sheet, summer-bill anatomy, rate-case timeline, transformers 3–4yr,
efficiency-mandate repeal (news-lane entries tagged perishable with a
re-verify banner in the Studio).

**Compiler v2 (the redundancy):** slide plans now selected by content
shape — hero-number / trend / myth-bust / listicle / news-react /
timeline — instead of one fixed cover→chart→bullets→closer sandwich.
Each deck line used exactly once; the closer is takeaway + ONE quotable +
ONE objective-mapped CTA (share/save/dm/comment/reach ladder), with an
echo-guard so it can never repeat the cover. Cover law enforced: ≤9
words, authored hooks on the key posts ("34¢ vs 12¢. Three hours do the
damage." / "September 1: your export rate drops again." / "APS will pay
to use your battery."). Backgrounds rotate per post. Source lines on
every data-bearing slide (GATE 10).

**New archetypes:** A07 highlighter statement, A11 timeline ladder (the
rate case with a YOU ARE HERE node), A12 pull-quote receipt. A14 stub
removed. **Articles→posts:** intel cards now have "Build post →" — a
news item compiles into a receipt-led news-react deck. **Captions:** now
the LESSON (hook line → education → solar landing → source → CTA +
2-local/3-topical/2-category hashtags), never the slides re-joined; AI
writer rules tightened (≤52-char hooks, one number per slide, no
repetition). Retired `KB.azContext` (owner-rejected framing).

Deliberately left out of the auto bank: the heat-death posts (430 / early
heat) — templated CTAs on those would be tone-deaf; they stay in the
brain Idea Bank for hand-crafting.

Verified with Playwright across all six shapes before shipping. Build
green. Nothing spent.

## 2026-07-25 · DESERT GRID editorial slides wired into the Studio (owner friction catch #2)
Owner's first production run surfaced the gap: posts still generated in the
old big-bold-letters photo style — no charts, no data slides — and the copy
educated on APS rules without ever landing back on solar. The DESERT GRID
system existed but only as a sample gallery; nothing compiled real ideas
into it.

Built the missing bridge:
- `lib/dgCompile.ts` — idea → DGPost compiler: editorial cover (A06), an
  authored data slide when the subject has chartable KB numbers (rate-case
  ranked bars, export step-down line, 34¢/12¢ on-peak bars, 20 GW / $660 /
  ~100-bankruptcies / 7-in-10-lease hero numbers, credit-gone + terms-
  transfer myth-busts), smart-brevity bullets from the idea's deck, and
  ALWAYS an A16 closer that lands the education on the solar decision
  (theme-matched: "You can't rate-plan your way off the escalator →
  producing your own power is the hedge").
- `components/DGSlide.tsx` — the shared scalable archetype renderer (336px
  preview ↔ 1080×1350 export, same component).
- Composer: new **Editorial · data / ✨ Photo** toggle (editorial is the
  default when an idea loads). Editorial slides export via the existing
  html2canvas path — **zero image credits**. Photo mode unchanged. Also
  fixed the leftover "monsoon-roof-check" download filename.
- AI writer (/api/copy): new hard rule — every post must END connected to
  the solar/ownership decision; utility education with no solar landing is
  a failed post.
- Verified visually with Playwright on 4 real KB posts before shipping.

Needs a human: nothing — flip to the Studio, the editorial deck is the
default. Photo mode is still one click away when a post wants a photoreal
cover.
First real friction-log catch from the launch run: the owner opened
Settings, saw the demo Connections card (hardcoded "connected" for
Claude/Perplexity/Instagram/Facebook), and reasonably took it as the key
check passing — but Instagram publishing isn't even wired. Exactly the trap
the checklist note warned about. Fix: SET_CONNECTIONS deleted from
`lib/data.ts`; the Settings card now explains and deep-links to the real
Connectors screen (live API probes). Build green, shipped. Lesson for the
Dev agent: no UI element may claim a status it didn't verify.

## 2026-07-24 · APS-only pivot: SRP + East Valley removed, all-West-Valley mode
Owner decision during territory setup: "run all west valley, don't worry
about SRP — it doesn't pencil, remove all SRP data completely and all east
valley." Executed across app + vault:

- **Catalog** (`azTerritories.ts`): East Valley cities (Queen Creek, Mesa
  Gateway, San Tan Valley, Gilbert, Chandler), all 16 SRP developments,
  Laveen, and the ED3/ED2 outskirts (Maricopa/Florence) deleted — 29 West
  Valley + North Phoenix APS entries remain. Utility type narrowed to
  `aps | verify`; new `isOutOfMarket()` guard.
- **Territory picker** (Settings): 6-territory cap REMOVED (the whole
  catalog is the market now); new one-click "Run all West Valley" button.
  Store migration strips SRP/East-Valley picks from saved profiles on load.
- **Hunts** (`verticals.ts`): SRP flipped from secondary target to hard
  exclude; all SRP search queries/phrases/keywords removed.
- **KB + content** (`azEnergyKb.ts`, `strategy.ts`, `signals.ts`,
  `desertGrid.ts`, ideaCopy, discover/copy routes, Content screen): SRP
  reply facts, pulse packs, and the two SRP-led KB posts removed; mixed
  pieces rewritten APS-only (bill-spike post is now the APS 4–7pm version).
- **Vault**: Editorial Direction now APS-ONLY (supersedes the 1-in-20 SRP
  cadence, owner 2026-07-21); SRP queue post rejected with reason; Idea
  Bank SRP lane retired; CMO/Lead Manager charters, Home, Voice, Design
  Playbook, Growth Strategy updated. `farmhand/docs/` research archives
  left intact as historical record.

Build + typecheck green. Nothing spent. Needs a human: open Settings →
Solar territories → hit "Run all West Valley", then check off the Launch
Progress territory item.
Owner chose "scaffold the code now" for the shared memory layer. Built the
whole thing so it's live the instant the Supabase project + 3 keys exist —
zero more code needed. Follows the existing [[Connectors|kv.ts]] philosophy:
plain fetch against Supabase's PostgREST REST API, NO SDK dependency, graceful
no-op degrade. Completely inert today (no keys) — the app runs on localStorage
exactly as before.

New files: `farmhand/supabase/schema.sql` (7 workspace-namespaced tables —
agent_runs, leads, contacts, opportunities, planned_posts, reel_analyses,
kb_refs; each = typed/indexed columns + `data jsonb`; RLS on, no public
policies), `lib/supabase.ts` (server-only PostgREST layer, service_role key
never reaches browser), `lib/memory.ts` (typed domain API), `app/api/memory`
(status probe + push/pull), `lib/memorySync.ts` + store wiring (client sync —
pull non-destructive/local-wins, push debounced, gated on configured). Supabase
connector now live-checks `/api/memory`. Full doc: [[Shared Memory Layer]].

Ran a 4-lens adversarial review workflow (inert-when-unconfigured, key-leak
security, PostgREST correctness, store-sync safety), each finding independently
verified. Security + inert lenses came back clean. Two real (latent) bugs
caught and fixed before ship: (1) `upsertLeads` didn't collapse duplicate
dedup_keys within a batch — PostgREST rejects the whole request (SQLSTATE
21000) if a hunt re-cites one url twice; now deduped by key (highest score
wins); (2) the store push effect was gated by a `useRef`, whose flip doesn't
re-run the effect, so an edit made during the cloud-pull window could go
unsynced — `syncReady` is now state + a push-effect dep. Build passes. Nothing
spent.

Owner action (~5 min): create a Supabase project → run the schema → add
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` (mark Sensitive) / `SUPABASE_ANON_KEY`
in Vercel → redeploy. Steps in [[Shared Memory Layer]].

---

## 2026-07-22 · Content quality overhaul — both research halves ingested
Owner flagged the post TEMPLATES looked amateur (big bold text, 3 sentences a
slide) and wanted the engine producing established-source-grade content. The
internal deep-research harness is the wrong tool for craft (it fact-checks and
rejects design/marketing sources → empty), so owner ran the research in ChatGPT
and uploaded the briefs — the proven pattern.

**Ingested two canonical specs into `farmhand/docs/`:**
- **`content-engine-spec-2026.md`** — "DESERT GRID Content Engine v1.0": brand
  tokens (PAPER #F4F0E6 / INK / ACCENT_HOT #E8622C / DATA_COOL / NEUTRAL / NIGHT),
  16 archetypes with YAML params, 20 pre-publish QA gates, reel recipes R1–R10,
  5 content pillars, and a current AZ fact bank (RCP 6.171¢, ~14% ask, docket
  E-01773A-25-0105, 25D expired Dec 31 2025, peak 8,648 MW). This is the
  authoritative design/format system — the [[CMO]]'s design gate binds to it.
- **`higgsfield-prompting-playbook-2026.md`** — the Higgsfield prompt system:
  Soul 2.0 / Soul ID / Soul HEX / Moodboards / Cinema Studio / Seedance-Kling,
  the image + video prompt templates, preset→use-case map, negative clause,
  anti-distortion rules, and engine defaults. Runtime-discoverable (no fixed
  public REST API; MCP/CLI-first).

Also: [[Design & Format Playbook]] rewritten as the human summary pointing at
the spec; [[CMO]] design gate now requires the post-object schema + all 20 QA
gates; [[Idea Bank]] added (36 energy ideas across 8 clusters). Rendered the
real DESERT GRID tokens to a template-system preview artifact (6 archetypes,
live fact-bank numbers). Nothing spent.

**Next build:** wire the archetypes into Post Studio as real presets + the
Higgsfield prompt-composer layer so the engine emits gate-passing posts +
usable assets on the first pass.

---

## 2026-07-22 · Supabase shared memory layer — LIVE and verified
Owner created the `farmhand-memory` Supabase project (West US / Oregon), ran
`farmhand/supabase/schema.sql` clean, and added the 3 keys in Vercel
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` marked **Sensitive**, `SUPABASE_ANON_KEY`
— the legacy anon/service_role JWT keys). Redeploy green.

**End-to-end verified.** Connectors card = 🟢 CONNECTED on first check. A UI
write in the solar workspace (an Opportunity captured as "Supabase Test /
Buckeye") flowed straight into Supabase → `opportunities`: `workspace = solar`,
`app_id opp-1784692964075`, `data` jsonb carrying the exact sourceName +
excerpt, timestamp-consistent. The memory layer is genuinely operational, not
just wired.

First agent writer also shipped (#132): the always-on cron hunt now logs each
run to `agent_runs` as the [[Researcher]] and mirrors leads into `leads`.
Client sync (contacts/opportunities/planned_posts) auto-flows on change.

The full 6-agent architecture is now live end to end. Remaining wiring is
additive: [[CMO]] → log produced content to `planned_posts` + `kb_refs`;
[[Orchestrator]] → read `agent_runs` so each session picks up where the last
left off. Nothing spent.

---

## 2026-07-21 · Connectors "Verify keys" — real validation, not just presence
Owner flagged: "there are key placeholders but not actual keys in some of
them." The Connectors screen only did presence checks (is the env var set?),
which is exactly what lets a placeholder like `your-key-here` read as green.
Added a **Verify keys** button that makes a real, **free** call to each
provider it can safely test and reports an honest per-card verdict: valid /
bad-or-placeholder (401/403) / no-key / couldn't-reach. Tested for free:
Pexels, Pixabay, Unsplash (`/api/stock?verify=1`, 1-result search) and Gemini
(`/api/video-reference?verify=1`, free `models.list`). Perplexity + Higgsfield
stay presence-only on purpose — testing them spends a credit (Credit
Preservation Policy). Also shipped the Blob card accuracy fix (GET status
probe so it live-checks instead of a static "attach store"). Shipped in #130.
Nothing spent.

Owner action: open **Connectors → Verify keys** after the redeploy. The
Jul-4 stock keys are the prime placeholder suspects — watch for any red
"Bad / placeholder" badge and replace that key in Vercel.

**Result (owner ran it):** all four testable keys came back **valid** —
Pexels, Pixabay, Unsplash, Gemini. No placeholders after all; the Jul-4
stock keys are real and working. Higgsfield's two vars were already marked
Sensitive in Vercel. The "placeholder keys" concern is closed. Every wired
integration is confirmed live. Nothing spent.

Next real build: **Supabase shared memory** — the only unwired compounding
piece. Blocked on owner creating the Supabase project (URL + keys); the
code side can be scaffolded ahead of that so it works the moment the env
vars land.

---

## 2026-07-21 · Connectors audit screen + checklist
Owner asked to "connect everything / make sure the connectors are set up."
Can't obtain keys or create accounts from here (owner actions), so built a
live **Connectors** screen (new nav item) that probes the app's own `/api`
status endpoints and shows each integration's real state: Perplexity,
Higgsfield, Pexels/Pixabay/Unsplash, Gemini (live-checked); Vercel Blob/KV
(attach-store); Apify, Tavily, Firecrawl, Gmail/Meet/Calendar, Supabase,
Metricool, Instagram/X, Anthropic, Reddit (to-wire); GitHub (connected).
21 connectors total. Each card shows what it powers, the env var, a
"get key" link, and setup notes. Registry in `farmhand/lib/connectors.ts`.
Matching checklist saved as [[Connectors]] for the Obsidian side.
Verified rendering (screenshot). Nothing spent.

Priority for the owner: (1) confirm Perplexity + Higgsfield keys are live;
(2) turn on the already-built features — Pexels, Gemini, Vercel Blob;
(3) the compounding one is Supabase shared memory (needs Dev to wire).

## 2026-07-21 · MIGRATED to the 6-agent Agentic OS roster
Owner adopted the Agentic OS architecture (the Sureflow model, adapted to
solar). Migrated the brain vault agent charters to match: 1 chief of staff
+ 5 specialists. New/rewritten charters in `brain/Agents/`:
[[Orchestrator|CEO / Orchestrator]], [[Researcher]] (intel gatherer —
Apify/Tavily), [[CMO]] (market voice — absorbs the OLD Creative Director +
Copywriter + Art Director + Fact Checker accuracy gate + Feed Director grid/
authenticity, so nothing binding was lost), [[Lead Manager]] (revenue ops —
web leads → booked in-home/virtual consults), [[Data Analyst]] (signal layer
— the full reel→revenue chain), [[Dev]] (build system).

Deleted the six old content-specialist charters. Bulk-remapped every
wikilink across the vault ([[Creative Director]]/[[Copywriter]]/[[Art
Director]]/[[Fact Checker]]/[[Feed Director]] → [[CMO]]; [[Analyst]] →
[[Data Analyst]]) and rewrote the [[Home]] status board + [[README]] map to
the new roster. Fixed the readability spots the remap left (dup-CMO lines in
Editorial Direction, stale Copywriter/Art-Director task lines). Re-aligned
the app's Knowledge Vault graph (`agentOs.ts` nodes + links) to the new
agents so the topology matches. Build passes. Nothing spent.

Note: the CMO now owns the entire content line as one agent (idea → drafted
→ visuals-planned → fact-checked). The accuracy gate and authenticity rules
are preserved verbatim inside its charter — still binding, still no
self-approval.

## 2026-07-21 · carousel look upgraded — photo-backed + news screengrabs
Owner direction after seeing the post-preview mockup: informational
carousels should be PHOTO-backed (image + scrim + short overlay text),
not flat text-on-black, to feel like an established pro and earn the
swipe. Recorded as the Lane 1 upgrade in [[Visual Style]]: Pexels
backgrounds (the `/api/stock` proxy already supports Pexels/Pixabay/
Unsplash — just needs `PEXELS_API_KEY`), one slide can be a credited
news-article screengrab (binding legal rule: headline+image as a
reference to the coverage, outlet credited on-slide + source in caption,
never strip credits; AP/Getty photos → keep to headline-screenshot +
attribution or swap to Pexels/own). On-screen text tightened to ≤~10–12
words, one idea per slide, swipe-loop structure. Preview artifact updated
to v2 showing the data-center carousel photo-backed with an AZFamily/ASU
news slide. Added: Pexels key (Needs Taylor), and a backlog task to wire
`/api/stock` auto-backgrounds into carousel generation. Nothing spent.

## 2026-07-21 · 3 new briefs added from the fresh research
Added three fact-checked briefs off the new sourced KB, all APS-primary/
utility-general per the SRP cap: "Data centers are heating up your
neighborhood" (carousel, HIGH-priority standout — ASU 1–4°F waste-heat
finding + #2-metro + 64k-homes, data-center-cost-shift kept a dispute);
"2024 was the hottest year in Phoenix history" (single — heat records →
evening AC load → rising bills → own-your-power); "They'll pay to use
your home battery. Ask why." (single — both utilities pay ~$110/kW/yr for
peak battery access, framed as "worth to them," not grid-instability).
Each carries claim→source receipts. Queue now: briefs 1, 3, and these 3
at fact-checked awaiting Taylor's approval; brief 4 held as the LOW-
priority SRP slot; briefs 2/monsoon/credit rejected. Nothing spent.

## 2026-07-21 · owner direction: APS-primary, SRP ~1 in 20
Owner: SRP residential solar ROI is too low (3.45¢ export + demand-charge
design) to court as a focus. New Editorial Direction rule — content is
APS-first, SRP-focused posts capped at ~1 in 20 (~5%); SRP facts stay in
the KB for education + the rare SRP piece. Brief 4 ("SRP's rate design")
demoted to the LOW-priority SRP cadence slot (kept fact-checked/ready,
not a priority post). VPP pay also corrected this session: APS and SRP
pay ~the same (~$110/kW/yr) — not "APS more" — verified via both program
pages. Nothing spent.

## 2026-07-21 · research dump LANDED — rising-cost/heat/data-center KB
Owner ran the deep ChatGPT research pass (news-sourced: azcentral/AZFamily/
ABC15/12News, NWS Phoenix, Maricopa County, ASU, EIA, NERC, APS/SRP
tariffs). Distilled into a new sourced+labeled fact-check doc
`farmhand/docs/az-rising-costs-heat-datacenters-2026.md` (Fact Checker +
Copywriter now bound to it). Key sourced facts: AZ avg bill +33%/decade
($120→$160, EIA); APS ~8% (2024) + ~14%/$20 ask (2H 2026); SRP redesign
(E-28 6–9pm w/ 40.26¢ summer-peak, E-16 5–10pm demand, export 3.45¢,
grandfathering to Nov 2029); APS TOU-E 4–7pm 34.4¢/12.3¢, RCP 6.17¢
declining; APS Storage Rewards ($110/kW) + SRP Battery Partner ($55/kW);
2024 warmest Phoenix year, 113-day 100°F streak, 608→430 heat deaths;
data centers ~5% of peak, ASU says their waste heat +1–4°F downwind.

Three owner assumptions CORRECTED to stay honest: (1) SRP window shift is
plan-specific, not a blanket 3–8→5–10; (2) "grid unstable" isn't supported
(NERC margins fine) — reframed as "utilities pay for your evening battery
because peaks/growth strain the plan"; (3) "bill doubles" given BOTH
horizons (~15 yr recent / ~24 yr decade), never a fixed date. Data-center-
raises-bills kept as a live dispute (AG Mayes vs. utilities). These
guardrails baked into the doc + Editorial Direction.

Content updated: brief 1 rate-case number fixed to sourced ~14%/$20/2H-2026;
brief 3 rewritten ("Your power bill isn't going back down" — rising-cost
inevitability, no plan-switching-as-fix); brief 4 rewritten ("SRP's rate
design: why solar alone won't save you" — 3.45¢ export vs 40¢ evening,
battery hedge, Battery Partner VPP). azEnergyKb rate-case reply + deck and
the retired "cheap by the kWh" deck rewritten to the rising-cost thesis.
Briefs 3 & 4 back to `fact-checked` (awaiting Taylor's approve). Nothing
spent.

## 2026-07-21 · editorial pivot: rising-cost thesis + solar-as-hedge
Owner reset the spine of the content pillar during brief review. New
thesis recorded in [[Editorial Direction]]: no matter the rate plan, AZ
power costs only climb (infrastructure + data centers + repeated rate
cases) — so plan-switching is NOT sold as a fix; the real hedge is
solar + battery sized to self-supply the punishing evening peak. Rate
DESIGN (low buyback, cheap off-peak, brutal on-peak) is the story, and
utility VPP / residential-battery programs are reframed as proof the grid
isn't stable ("if it were stable, why would they need your battery?").
Also resolved last turn's open question — the "cheap by the kWh / rose
slower than national" credibility-through-downplay framings are RETIRED,
not kept.

Queue actions: brief 2 (Every new street) REJECTED (owner: doesn't land/
flow, too abstract; new-demand facts kept only as support). Briefs 3
(kitchen-table) and 4 (SRP) moved to `reworking` with explicit rework
notes — #3 drops plan-switching-as-savings, #4 must teach SRP system
design + VPPs instead of cooling tips. Both HELD pending a research dump
the owner offered: SRP redesign/peak-window shift, current export+off-peak
rates, APS & SRP VPP terms, the grid-strain rationale, and a sourced
historical+projected bill trajectory to ground "costs keep climbing /
could double." Full research prompt saved in [[Tasks]]. Nothing enters
content as [fact] until sourced — no "bill will double" without a
timeframe + citation. Nothing spent.

## 2026-07-21 · Reel Coach: whole-browser freeze fixed (drag-and-drop gap)
Taylor hit this twice: Chrome itself — not just the tab — went fully
unresponsive after using Reel Coach, needing a full quit both times.
Root cause found by reading the browser's default drag-drop behavior,
not by reproducing it: the upload box's drop handling only covered
drops that landed exactly inside it. A drop missing the box by a few
pixels (easy when dragging from Finder/Photos) fell through to
Chrome's native default — navigate the tab and try to open the raw
video file directly — which can wedge the browser's shared video/GPU
pipeline hard enough to take the whole thing down for a large local
clip. Fixed with a page-level `dragover`/`drop` guard in
`FarmhandApp.tsx` (`DropGuard`) that no-ops any drop by default; the
upload box's own handler still runs first via bubbling so intentional
drops are unaffected. Shipped ahead of confirmation since the fix is
low-risk and the bug is a hard blocker; awaiting Taylor's confirmation
it's actually resolved. Also added a client-side 200MB file-size cap
as a smaller defensive measure. Nothing spent.

## 2026-07-21 · Reel Coach built — Gemini video coaching pipeline
Taylor's ask: he wants to upload real reference reels (his own or
competitors') and get an AI that actually WATCHES them (video + audio
together, not sampled stills) to coach the content bot on hooks/pacing/
visual style/reusable format. Built as a real app feature, not a one-off
session task, per Taylor's choice.

New: Content → Reel Coach tab. Upload flow: browser → Vercel Blob
(`@vercel/blob/client`, bypasses the ~4.5MB Vercel serverless body cap
that would otherwise reject most iPhone reels) → `/api/video-reference`
fetches the bytes, resumable-uploads to Gemini's Files API, polls until
processed, asks Gemini to analyze (structured JSON: hook strength/
technique, cut/pacing rhythm, on-screen text, visual style, spoken
content, the reusable content PATTERN, coaching notes) → Blob copy
deleted immediately (transfer hop only) → analysis persists in a new
in-app IndexedDB store (`reelVault`, mirrors the existing image Vault
pattern) with a "copy as vault note" button so results can be pasted
straight into a brain session. GET/POST `configured` pattern matches
`/api/copy`.

Needs Taylor before it's live: `GEMINI_API_KEY` + a Vercel Blob store
attached (`BLOB_READ_WRITE_TOKEN`) — added to [[Tasks]]. `npm run build`
passes clean, but the actual Gemini/Blob calls are untested — no real
keys exist in this sandbox. Nothing spent (build only).

## 2026-07-21 · two reel clips reviewed (clip 1 + clip 2)
Taylor sent two real reel candidates (clarifying the earlier 3.13s clip
was reference-only, not a review subject): Clip 1 (20.23s) and Clip 2
(13.17s), both HEVC 1080x1920, both continuous unedited straight-to-
camera talking-head takes in the same SunSolar-branded apparel/lav-mic
setup as the earlier clip. Extracted + sampled frames across both full
durations via the ffmpeg recipe in [[Tools]] (2fps). Clip 2's backdrop
is notably stronger — a finished house with a visible rooftop solar
array in frame the whole time. Neither has a scroll-stopping hook
(static face, no text/motion in frame one) and neither can be checked
against Editorial Direction's claims/pain-point rules without a
transcript of the audio — flagged as the blocker before either becomes
a `drafted` brief. Same SunSolar-branding question as before applies.
Logged to [[Visual Style]]. Nothing spent.

## 2026-07-20 · video reel reviewed; SunSolar affiliation confirmed
Taylor sent a 3.13s HEVC/Dolby Vision .mov (iPhone selfie clip). Sandbox
tooling couldn't decode it out of the box (Playwright's bundled ffmpeg is
webm/mjpeg-only; the sandboxed Chromium has zero proprietary codecs) —
fixed session-locally via `apt-get install ffmpeg --fix-broken` (recipe
now in [[Tools]] for future video reviews). Extracted + reviewed frames:
Taylor + a colleague, both in SunSolar-branded polos (colleague also
badged), golden-hour selfie on a bare lot in a new-construction desert
neighborhood — casual, no on-screen text, has untranscribed audio. This
visually CONFIRMS SunSolar Solutions is Taylor's own company (resolves
the batch 1/2 "competitor" mislabel — corrected in [[Visual Style]], not
deleted). Raw footage is strong (real match for the "new demand" post's
backdrop) but too short/unstructured to post standalone — b-roll
candidate. Surfaced a real strategic fork for Taylor: keep the
installer-neutral "consultant" positioning the whole Editorial Direction
is built on, or let personal-brand transparency (visible company
branding) take priority — added to [[Tasks]] as Needs Taylor. Nothing
spent (apt install is free, session-local infra, not a content spend).

## 2026-07-20 · photo dump batches 1-3 catalogued
Batches 1-2: Aurora Solar design-tool screenshots + SRP DER meter
(style-reference, likely fine to post once actually committed) and a
SunSolar Solutions-branded proposal for a named homeowner ("John
Matthews," Peoria) across two images plus a matching bill-comparison
graphic — held as NOT postable, named third-party PII, regardless of
whose company produced it. Batch 3: two candid personal shots (dusk, dog
— low value, postable as texture), one context-unclear kitchen photo
(hold), a genuine team photo holding a SunSolar Solutions/REC Certified
Professional tote, and a real doorstep photo of Taylor in SunSolar
branding with a homeowner holding a welcome flyer — the clearest Lane 3
proof-of-work material yet, pending confirmation the homeowner consented
to appear.

Correction flagged, not asserted: batches 1-2 were provisionally
described as "competitor" material without knowing Taylor's actual
affiliation — batch 3 shows Taylor himself in SunSolar Solutions
branding among colleagues, suggesting that read may be wrong. Open
question posted in [[Visual Style]] rather than guessed at. No files
committed to brain/Brand/refs/ yet (all catalogued from chat pending
Obsidian hookup or a bulk GitHub upload). Nothing spent.

## 2026-07-20 · installer-quality research pass 2 — sourced upgrade
Taylor pasted a second, far more rigorously cited installer-quality deep
dive (NREL SolarAPP+ inspection data, CFPB dealer-fee findings, exact
manufacturer program names/tiers verified against current pages, ROC
license classes, REC ProTrust / Panasonic AllGuard warranty-survival
detail). `az-installer-quality-2026.md` REWRITTEN wholesale — pass 2
authoritative where it refines pass 1. Key upgrades: dealer-fee claim
moved from [industry-claim] ~15-25% to [fact, CFPB-sourced] 30%+,
independently confirming and sourcing the owner's tile-underlayment
three-course correction via manufacturer install guides (IronRidge),
flagged Panasonic's 2026 solar-line discontinuation (existing warranties
still honored), added NREL workmanship-failure stats (58-78%) as the
strongest evidence yet that craft beats brand. az-solar-market-2026.md's
verified-installer-quality summary and Phoenix pricing figure ($2.30/W,
14.56kW avg, ~$33,511) updated to match. KB reply line + one idea deck
sharpened with the CFPB stat ("The federal regulator's warning about
'cheap' solar financing" replaces the older generic framing).

Taylor is also sending a real photo dump in batches (chat 5-image cap;
offered zip/GitHub-upload as bulk alternatives). Batch 1 flagged: Aurora
Solar design-tool screenshots, an SRP DER meter close-up, and a
COMPETITOR'S branded proposal (SunSolar Solutions, ROC#331679/
LightReach plan) containing a real homeowner's name and address (privacy
+ competitor-IP concern) — logged as style-reference-only, NOT postable,
pending Taylor's confirmation. See [[Visual Style]] refs log once photos
are actually committed to brain/Brand/refs/. Nothing spent.

## 2026-07-20 · Feed Director added — the Instagram/grid-level agent
Owner clarified the page review isn't analytics — it's "make my page
LOOK AND FEEL like an established local pro." New agent [[CMO]]
owns this: judges the whole GRID (not one post at a time) against a
2-second-scroll credibility test, sets grid composition rules (~2:1
photo-feeling-to-designed-card ratio, no adjacent same-look posts, pinned
trio = positioning/flagship/proof-of-work), and drafted a First-12 grid
plan mixing the 5 queued posts with new proof-of-work slots.

Added Lane 3 (proof-of-work) to [[Visual Style]] with binding
authenticity rules — the core protection: REAL photos are the only
material that may be presented as documentation of an actual job/
meeting/install; Higgsfield images are illustrative-only (generic,
representative, never captioned as a specific documented event). This
is deliberate risk management — one "that's AI" callout on a fake
install would undermine the whole trust brand.

Owner decision resolved: minimize on-camera presence. Lean on real
equipment/install photos (faces optional, craft mandatory) over
talking-head content; no recurring synthetic persona for AI-illustrated
people. [[Competitor Audit]] gained a grid-level scoring section (rhythm,
proof-of-work visibility, pinned posts, "looks active today" signals) as
the primary audit, with per-post metrics now secondary. Grid-audit
extension prompt issued to Taylor; photo-dump spec issued (10-25 photos,
postable vs. style-only tagging). Orchestrator now routes to Feed
Director whenever the audit or photo dump changes. Nothing spent.

## 2026-07-20 · installer-quality research ingested + owner correction
Taylor ran the installer-quality deep dive → new fact-check doc
`farmhand/docs/az-installer-quality-2026.md` (legal floor: R-11/CR-11 +
ARS 44-1762 warranty minimums · roof-penetration best practice by roof
type · verified credentials: APS QTI, SRP Preferred Solar Installer,
Tesla Certified, NABCEP PVIP rarity, SASSB bar · dealer-fee and
quality-premium industry claims · warranty-survival reality · the
7-point homeowner checklist). Owner-expertise section in the market doc
upgraded to VERIFIED. Owner field correction applied: three-course
flashing on tile roofs happens at the UNDERLAYMENT layer (standoff
penetration three-coursed before tiles are cut and replaced) — doc and
deck updated. KB reply line now cites QTI/PSI by name; 3 new idea decks
(60-second background check · warranty survival · tile-roof craft).
Fact Checker + Copywriter now bound to all four KB docs. Nothing spent.

## 2026-07-20 · growth strategy: @taylorlucesolar audited
First-pass audit of the real IG profile (1 post, 133/261, sales-voice
bio) → [[Growth Strategy]]: bio rewrite proposed (resource-first, keep
the "DM AZ" keyword funnel but attach it to a free rate-plan check),
display-name searchability fix, following-ratio cleanup, and the
three-engine reach model (reels = non-follower reach · carousels = saves
· daily comment presence + realtor collab posts = borrowed audiences).
Gap flagged: queue has no reel lane yet. Insights data pull prompt issued
to the extension. Handle mismatch with Studio placeholder queued as an
app fix. Nothing spent.

## 2026-07-20 · owner direction: value over price
Price-per-watt demoted from "the one honest yardstick" to a transparency
tool — never the verdict. New Editorial Direction rule: educate on
installer QUALITY (flashing, utility qualified-installer credentials,
manufacturer partner tiers, in-house crews, year-five service); honest
framing that AZ's few high-quality installers price slightly higher; never
name specific installers. Owner's professional knowledge recorded in
az-solar-market-2026.md as [owner-expertise] pending a dedicated
installer-quality research pass (prompt issued to Taylor). Reworked: the
"3 questions" idea deck + the queued doorstep-consult brief (quality/
process/service questions before price), the "Solar quote check" idea →
"Why the cheapest solar quote can cost you the most", new
KB.installerQuality reply line wired into buyer-education. Nothing spent.

## 2026-07-20 · owner direction: screen/caption split + competitor audit
New content-model law in [[Editorial Direction]]: on-screen text is a
summary (≤ ~12 words/slide, one number max), the education lives in the
caption and comments; posts must never LOOK educational. Both queued
carousels reworked to match (slides compressed, captions absorbed the
full numbers — same claims, same sources, receipts updated). New
[[Competitor Audit]] framework in Analytics: study local realtors and
trusted service pros as the model, solar recruiting pages as the
anti-pattern; scoring rubric + read-only extension collection process;
Adopt/Avoid lists seeded. Nothing spent.

## 2026-07-20 · owner direction: Valley-general CTAs
CTAs are now interchangeable and Valley-wide ("Valley homeowners…", "if
you're in the Valley with questions you want answered…") — never pinned to
one city. Cities appear only when they're the post's SUBJECT (Teravalis →
Buckeye stays in the body); hashtags may stay local for discovery. Applied
everywhere: app template copy (ideaCopy), the AI writer's rules
(/api/copy), Voice, Editorial Direction, Creative Director + Copywriter
charters, and all 5 queued briefs' CTAs and captions (fact-check receipts
unaffected — no factual claims changed). Nothing spent.

## 2026-07-20 · owner hold + credit preservation policy
Taylor's call: nothing fires automatically until the content is dialed in.
The scheduled Routine was DELETED (not paused) — zero autonomous runs;
manual "run the brain" passes only. Re-arm instructions preserved in
[[Schedule]]. New binding Credit Preservation Policy added to [[Tools]]:
no paid call is ever a test (mocked responses for testing), Higgsfield
only on `approved` briefs within estimate, Metricool free-tier-only until
explicitly approved, one-pass token discipline, and a spend ledger in this
Log. Nothing spent.

## 2026-07-20 · Orchestrator (manual make-up run, in-session)
The Monday 9 AM slot fell during the routine's recreation, so the pass ran
in-session. Copywriter: all 5 briefs drafted (hooks, slides, CTAs,
captions, hashtags) grounded in the three KB docs. Art Director: visual
plans on all 5 (2 card carousels ~5 credits each via Post visuals; 3
realistic singles ~1 credit each; face-neutral framing pending the
standing decision). Fact Checker: 5/5 PASS with claim→source receipts
under each brief; [contested] items verified two-sided. Queue now holds
five `fact-checked` briefs awaiting Taylor's approval — total production
cost if all approved ≈13 Higgsfield credits. Nothing spent. Next auto-run
Thursday 2026-07-23, 9 AM Phoenix.

## 2026-07-19 · research ingested (in-session)
Taylor ran the deep-research prompt; results distilled into two labeled
fact-check docs: `farmhand/docs/az-rates-supply-demand-2026.md` (rate case
in full, supply-demand with contested points labeled, price history,
homeowner translations, sourced consumer-pain record) and
`farmhand/docs/az-solar-market-2026.md` (post-§25D lease wave, installer
bankruptcies + AG enforcement, ranked objections, positioning evidence).
App KB refreshed: new reply lines (rateCase, azContext, trust, leaseShift),
authority/buyer-education fact wiring updated, 4 new deck-carrying ideas
(cheap-by-kWh · vet-your-installer · why-every-quote-is-a-lease ·
6-question test), rate-case + data-center decks updated with exact
numbers, monsoon idea replaced with the October-cliff resource piece.
Editorial Direction refined with 6 adopted rules; Fact Checker + Copywriter
now bound to all three docs and their [fact]/[projection]/[contested]
labels. Routine recreated accordingly. Nothing spent.

## 2026-07-19 · owner direction + accuracy gate
Taylor set new editorial priorities → [[Editorial Direction]]: rising
prices / supply-and-demand as the lead pillar (APS-first), homeowner-
resource stance, expired-credit content demoted to myth-busting-only,
pain-point rule (real pains, treated lightly, always a soft CTA). Queue
re-planned: monsoon brief rejected (owner: not a real pain point),
federal-credit brief rejected (redirected focus), two rising-prices briefs
added (bill-climbing explainer · new-construction demand). New agent:
[[CMO]] — every claim verified verbatim against the KB before
Taylor sees a brief; new status `fact-checked` gates `approved`. Deep-
research prompt issued to Taylor (price trajectory + solar sales craft).
Nothing spent.

## 2026-07-19 · Orchestrator (manual, in-session)
Scheduled Routine ARMED: "Farmhand Brain — Orchestrator", Mon/Thu/Fri
9:00 AM Phoenix, fresh session per run, push notification on completion,
hard-bounded to brain/ with a diff check before pushing. Ran the Creative
Director: 5 briefs planned into [[Content Queue]] (monsoon myths ·
kitchen-table bill moment · SRP 40¢ window · federal-credit honest math ·
doorstep consult) — lanes mixed 3 cards / 2 realistic, looks all distinct,
territories rotated Buckeye/Peoria/Queen Creek. Nothing spent. Needs
Taylor: review briefs; face decision; reference photos.

## 2026-07-19 · setup
Brain vault created and expanded to the full OS shape: Command Center
(Home), Orchestrator + four specialist charters, Tasks, Schedule, Tools,
Lead Pipeline, Content Analytics, Content Queue, this log. Nothing spent.
Needs from Taylor: reference photos into `brain/Brand/refs/`, the
face-vs-synthetic decision in [[Visual Style]], ANTHROPIC_API_KEY in
Vercel for the future in-app produce pipeline.
