# Agency OS money layer — activation report (2026-08-10)

> **From the Cowork session** (browser + Gmail + Supabase/Vercel access), executing the
> activation runbook authored by the code session. Convention going forward: specs/prompts
> committed to this repo get executed on the Cowork side and results land back here as
> `*-report-*.md` next to the spec — no founder relay needed.

## STEP 1 — Money layer: ACTIVE ✅

- `farmhand/supabase/agency-schema.sql` run **verbatim, unmodified** in the Supabase
  project the app already uses: **farmhand-memory** (`qarqudhfgqxxmolhpptr`, us-west-2).
  Result: `Success. No rows returned`. Re-runnable as designed.
- Seed verified by follow-up SELECT — exactly one row:
  `ProRx | draft | 0.03 | 0 | 2026-08-07`. Status left as **draft** per instructions.
- Env vars were already present in Vercel (memory layer shares them) — no changes made.
- `/api/agency/money` returns:
  `{"configured":true,"money":{"asOf":"2026-08-10","mrr":0,...},"counts":{"agreements":1,"meetings":0,"collections":0}}`
- `/agency` renders (verified in-browser): header "Sonoran Clinical Partners · Agency OS —
  Money as of 2026-08-10"; stat cards MRR $0 (0 recurring), New MRR $0, Churned $0,
  Gross $0 ($0 commission + $0 meeting fees), Meetings held 0, Commission unpaid $0;
  AGREEMENTS: **ProRx — 3.0% commission · no meeting fee · draft**; ACCOUNTS: "No
  introduced accounts with collections yet." **No "Not connected" warning.**

## Deployment topology — read before "verifying" from a server

- Auto-deploy picked up `b444bc1` (and later pushes) as **Preview** deployments.
- **Production** (`coyote-and-company.vercel.app`) still serves a ~2-week-old build from a
  different branch (`claude/app-performance-max-h8tgoc` promoted Jul 29); `/agency` 404s there.
- The working app is the branch's stable preview URL:
  `https://coyote-and-company-git-claud-389ab2-taylorluce22-8523s-projects.vercel.app`
- ⚠️ Preview deployments have Vercel Authentication ON: anonymous/server-side fetches
  **302 → vercel.com/login**. A curl/fetch of the preview URL failing is NOT an outage —
  verify in a logged-in browser, or have the founder decide whether to promote the branch
  to production / relax protection.

## STEP 2 — Missing spec: FOUND AND PUSHED ✅

- Actual location on the Mac was `farmhand/docs/` (not root `docs/`):
  `farmhand/docs/prelaunch-research-activation-2026.md` → committed as **b62c884**.
- Bonus orphan recovered from the Cowork workspace: `agency-os/mvp/import-prospects-fast.py`
  (compiles clean, pure CSV transform, same FL/CA/AL/NJ carve-outs) → committed as **701a2bc**.
- Note: direct `git push` from the Cowork sandbox is proxy-blocked for this repo;
  commits land via the GitHub web UI. Branch tip at time of writing: `701a2bc`.

## STEP 3 — Founder queue: surfaced to Taylor (not actioned)

- STASKA + Belmar drafts verified sitting in Gmail Drafts (drafts-only rule respected).
- Frier Levitt: still no confirmed time as of this report.
- Schedule change since the runbook was written: **Globyz/Nexgen call moved** at the
  founder's direction from Mon Aug 10 to **Thu Aug 13, 1:25 PM ET / 10:25 AM MST**
  (rescheduled through Salman's Microsoft Bookings; single booking, Monday slot cleared —
  verified on his calendar). Factor this into any pipeline/next-action state.

— Cowork session, 2026-08-10
