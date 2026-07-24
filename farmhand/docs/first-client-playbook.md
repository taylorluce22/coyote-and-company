# First-Client Playbook — Running "My Solar · real" as Farmhand's First Client

> The founder is client #1: their real Arizona solar business, run through the app.
> Every instruction below names the actual screen/button, verified against the code.
> **Verified fact that frames everything:** Farmhand does NOT publish to Instagram.
> It produces the finished image(s) + caption + hashtags; you download and post
> manually. (`lib/connectors.ts` lists Instagram as `status: "planned"`.)

---

## Part A — How to dogfood yourself correctly

1. **Work only inside "My Solar · real," and prove it's active every session.**
   Check the client pill (top-right). This account is deliberately clean — no demo
   data, every number real. The "Realtor · test user" account is demo junk; never
   build real content there.

2. **Dial the profile in through Settings, not by re-running onboarding.**
   The load-bearing setting is **Settings → "Solar territories."** Territory names
   become literal lead-hunt search keywords, content is written "…in [city]," and
   each territory's utility tag (APS vs SRP) selects which rate math the copywriter
   uses. Replace the seed cities (Buckeye/Peoria/Queen Creek) with where you
   actually sell. Confirm **"Lead engine vertical" = Solar**.

3. **Keep vs. discard from the seed.** Keep: solar vertical, clean/real-data state,
   Instagram-only. Ignore as realtor scaffolding: the Settings "Voice profile,"
   "Image preferences," and "Brokerage & legal" cards (hardcoded demo toggles — the
   solar voice actually comes from the /api/copy system prompt), and the Planner's
   auto-generated realtor topics/hashtags. Build posts in the Studio; use the
   Planner only as a scheduling calendar.

4. **Known gap — no real business-name / IG-handle field (friction item #1).**
   The seed is named "Taylor," and the handle burned onto every image auto-derives
   as `taylor.solar.az` (`lib/ideaCopy.ts`). There is no field to set your real
   handle yet. Don't fix it via the strategy session — it's realtor-shaped and can
   silently flip your vertical/territories.

5. **Keep a friction log every session — it IS the build backlog.** Every manual
   step, silent failure, or realtor-shaped surface you hit gets a line.

6. **Judge output by three questions:** (a) one honest claim with correct AZ
   numbers (APS export ~6.2¢, SRP ~3.45¢)? (b) does the image look like Arizona,
   not generic stock? (c) would you actually publish this to your own followers?
   If no, edit the slide text inline or regenerate BEFORE spending image credits —
   the Studio makes you lock copy first (Post visuals arms, then confirms).

7. **Back up after every session.** Settings → Clients → "Back up" on My Solar.
   All data lives in this one browser; the lossless bundle is the safety net.

---

## Part B — Step-by-step to your first published post

1. **Open the app** (deployed Vercel URL, or `npm run dev` from `farmhand/`).
2. **Select the real account.** Client pill (top-right) → **"☀️ My Solar · real"**
   → pill shows ACTIVE. (Alt: Settings → Clients → Open.)
3. **Verify the profile.** Settings: vertical = Solar; **Solar territories** =
   your real cities (check APS/SRP tags). Name/handle are placeholders for now.
4. **Check generation keys — in Connectors, not Settings.** Left rail →
   **Connectors** (it live-probes the endpoints; the Settings "Connections" card is
   hardcoded demo data — ignore it). You want:
   - **Perplexity** = Connected → powers "✍️ Sharpen copy"
   - **Higgsfield Soul** = Connected → powers "✨ Post visuals" AI images
   - Stock keys optional — Openverse/StockSnap/Wikimedia are free, always on.
   Keys are set in Vercel → Project → Settings → Environment Variables → redeploy.
5. **Pick an idea.** **Content → Ideas** — solar, KB-grounded cards for your
   territories. Optional: "↻ Refresh" on the Live AZ-energy intel strip for
   current-news angles. Click **"Open in Studio →"**.
6. **Generate the copy.** In the Studio, channel = Instagram. **"✍️ Sharpen
   copy"** (needs Perplexity; without it, edit the template copy by hand in the
   "Slide text" box — edits save as you type).
7. **Give it an image.** Preferred: **"✨ Post visuals"** → arms with credit cost
   (~1/slide, max 6) → click again to confirm. Needs Higgsfield keys; no keys =
   no-op, nothing spent. Zero-cost path: the right-side **Stock** panel (free
   sources), your own uploaded photo, or a texture/gradient background.
8. **Review.** Step through the slide dots; fix text inline; adjust background/
   format/dimness in the right rail.
9. **Check the meter.** Settings → **"Generation usage & cost"** — images used vs
   cap (default 60/mo), dollar estimate; warns at 80%, blocks at 100%.
10. **Export.** Studio top bar → **"↓ Download all (N)"** (PNGs, in order). Then
    the **"Caption & hashtags"** panel → Copy caption, Copy hashtags.
11. **Post to Instagram manually.** Upload the PNGs as a post/carousel, paste
    caption + hashtags. This is where the app stops and you take over.
12. **Mark it done.** Studio status dropdown → **Posted** (and/or ✓ Finalize), or
    mark it in the Content → Week planner if you scheduled it there.

---

## Part C — Prerequisites & blockers

- **Nothing hard-blocks a first post even with zero paid keys:** template/edited
  copy + free stock or your own photo + PNG download + manual IG post is a
  complete path today.
- **Perplexity missing** → Sharpen copy fails (small yellow message); template +
  manual edit still works.
- **Higgsfield missing** → AI visuals no-op (nothing spent); stock/own-photo path
  still works.
- **No native IG publishing** — every post is manual. The Planner's "⚡
  Auto-publish week" requires Cloudinary + Make webhook + Metricool (external
  scheduler); skip for week one.
- **Realtor-shaped surfaces** (Planner topics, Settings voice/brokerage cards) —
  cosmetic, not blocking. Log them.
- **No business-name/IG-handle field** — images render `taylor.solar.az`. Known
  friction #1.
- **Single-browser storage, no auth** — back up the client bundle weekly.

---

## Part D — First-week rhythm

- **Monday (~45 min):** Content → Ideas → refresh live intel → pick 3–5 angles →
  build each in the Studio → download → post manually. 3 solid posts > 7 rushed.
- **Tue/Wed/Thu (~15 min/day):** Lead Pipeline — review conversations in your
  territories; engage where genuinely useful. One midweek post if you have a real
  angle.
- **Friday (~20 min):** Monday Packet → generate for My Solar → Print to PDF —
  use it as your own weekly scorecard. Then Settings → Clients → **Back up**.
  Transfer the week's friction notes to the log.

---

**Single first action:** open the app → client pill (top-right) → select
**"☀️ My Solar · real"** → confirm ACTIVE.
