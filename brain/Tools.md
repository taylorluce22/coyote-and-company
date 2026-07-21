# Tools

Registry of what the agents can actually use, what it costs, and the rules.

## CREDIT PRESERVATION POLICY (owner, 2026-07-20 — binding on everyone)

Paid services exist to produce **approved, publishable content** — never to
test, demo, or "see what it looks like."

1. **No paid call is ever a test.** App and pipeline testing uses mocked/
   intercepted responses (the engineering verification flow already works
   this way) or free stock sources. If a real generation is needed to
   evaluate quality, that IS a production run: it requires an `approved`
   brief and gets logged.
2. **Higgsfield**: spend only on briefs with status `approved`, via the
   planned visual spec, within its stated credit estimate. Overage beyond
   the estimate needs Taylor. Every finished image is committed to the
   vault immediately (already enforced in-app) — a spent credit must never
   be lose-able.
3. **Metricool / any scheduler (future)**: free tier only until Taylor
   explicitly approves a paid plan. No API calls that consume plan quota
   for testing — dry-run against docs, not the live API.
4. **Perplexity / Claude tokens**: cheap but not free — no loops, one pass
   per run (already in the Orchestrator charter), no re-runs to "polish"
   without a failed check or new input.
5. **Ledger**: every paid spend gets a line in [[Log]] — service, amount,
   brief it served. If a month's spend can't be reconstructed from the
   Log, that's a policy breach.
6. When in doubt: don't spend, escalate in [[Tasks]] → Needs Taylor.

| Tool | What it does | Access | Cost | Rules |
|---|---|---|---|---|
| Higgsfield Soul | photoreal images (posts, scenes) | app `/api/higgsfield` (keys in Vercel env) | ~1 credit/image | ONLY after a brief is `approved`; batch ≤6; every image auto-saves to the app's AI vault |
| Perplexity sonar | copy writing + live research | app `/api/copy`, `/api/discover`, hunt lanes | pennies/run | facts must still trace to the KB; research cites sources |
| Gemini video | watches a real reel (video+audio together) and returns a coaching breakdown | app `/api/video-reference`, Content → Reel Coach tab (needs `GEMINI_API_KEY` in Vercel) | pay-as-you-go, cheap/clip | analysis-only, no fact-checking claims by itself — spoken content still needs KB verification before it informs a brief; clip itself is deleted from Blob right after analysis, only the analysis JSON persists (in-app IndexedDB reel vault) |
| Vercel Blob | transfer hop for reel uploads (bypasses the ~4.5MB serverless body cap so 20-60MB iPhone clips can reach Gemini) | app-internal (`BLOB_READ_WRITE_TOKEN` in Vercel env) | free tier (small, ephemeral — clips deleted immediately after analysis) | not a permanent store — treat any file living there as in-flight only |
| App lead engine | finds real homeowner threads | in-app (Engage tab, cron) | Perplexity tokens | thumbs-down avoid-rules are owner training data — never delete |
| Claude (sessions/Routines) | the agents themselves | this environment, repo access | API tokens | vault edits via `brain/` only on scheduled runs; app code changes only in interactive sessions with Taylor |
| Post Studio | assembles + exports finished posts | in-app | free | production happens here until `/api/produce` exists |
| GitHub | sync layer for everything | sessions push; Obsidian Git pulls | free | scheduled runs commit with `brain:` prefix, PR + squash |

## Video review recipe (session-local — not persisted across containers)

iPhone video (HEVC/Dolby Vision .mov) can't be decoded by the sandbox's
default tools: the Playwright-bundled ffmpeg is stripped to webm/mjpeg
only, and the sandboxed Chromium build has no proprietary codecs at all.
Fix: `apt-get update && apt-get install -y ffmpeg --fix-broken` pulls a
full Ubuntu ffmpeg (libavcodec/HEVC-capable) over the sandbox's normal
network access — no special permission needed, just takes a minute. Then
`ffprobe` for duration/codec/resolution and
`ffmpeg -i in.mov -vf "fps=6,scale=640:-1" frame-%02d.jpg` for review
frames. Re-run this install every fresh session; it doesn't persist.

Knowledge sources (read-only ground truth):
- `farmhand/docs/az-energy-knowledge-2026.md` — AZ utility numbers
- `farmhand/docs/higgsfield-instagram-playbook.md` — visual + IG craft
- `farmhand/lib/strategy.ts`, `farmhand/lib/azEnergyKb.ts` — idea decks
- `farmhand/lib/azTerritories.ts` — territory/utility map
