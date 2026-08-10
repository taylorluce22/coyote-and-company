# Agency OS · Outreach queue — activation

Built 2026-08-10. Code is on the branch and builds clean; the table does not exist in Supabase yet, so the screen currently renders its honest "not connected / run the schema" state. Two steps to make it live.

## What was built

| Piece | Path | What it does |
|---|---|---|
| Schema + seed | `supabase/agency-outreach-schema.sql` | `agency_outreach` table (workspace `agency`), RLS on with no policies, unique index on `(workspace, gmail_draft_id)` so re-running can't duplicate. Seeds the 39 A2 drafts created 8/10 |
| Pure logic | `lib/agencyOutreach.mjs` | `summarizeOutreach()` (counts by status/stage, cadence age from `drafted_on`, queue ordering) and the Gmail deep-link builders. No I/O |
| Tests | `lib/agencyOutreach.test.mjs` | 8 tests, all passing — empty state, status/stage counts, age from draft date, oldest-queued ignoring sent/skipped, sort order, unknown-status fallback, both link shapes |
| API | `app/api/agency/outreach/route.ts` | `GET` summary · `POST {rows}` register drafts · `PATCH {id,status}` queued/sent/replied/skipped |
| Screen | `app/agency/outreach/page.tsx` + `OutreachRow.tsx` | Queue with tiles, per-row **Open in Gmail** deep link, Mark sent / Skip / Undo. Linked from `/agency` |

## Step 1 — run the schema (Supabase SQL editor)

Same project as `agency-schema.sql`. Paste `supabase/agency-outreach-schema.sql`, Run. Idempotent.

Verify:

```sql
select status, count(*) from public.agency_outreach where workspace='agency' group by status;
-- expect: queued | 39
```

## Step 2 — open the screen

`/agency/outreach` on the working preview URL. Expect 39 queued, oldest drafted 0d ago (they were written 8/10), and every row's **Open in Gmail** landing on the right conversation with the draft in it.

Spot-check two rows against Gmail before trusting the rest — CAPS (`customerservice@capspharmacy.com`, thread `19fd04594ef1f52d`) and New Life Rx (`cs@newliferx.com`, thread `19fd3af6116e52d1`, different subject line). If a link opens the conversation but no draft is visible, the draft was sent or discarded in Gmail — mark the row accordingly rather than editing the link.

## Design constraint — why this doesn't send

The app holds no mail credentials and no route transmits email. **Open in Gmail** is the trigger: it opens the conversation with the draft in it, and the send happens in Gmail where the account and send authority live. Marking a row records what happened; it never causes a send. This keeps the standing rule intact — drafts only, Taylor sends — while giving the OS a real queue instead of a list that lives in one agent's context.

## In-app send — built 8/10, inert until credentials exist

`lib/gmailSend.ts` + `app/api/agency/outreach/send/route.ts` + a **Send** button on each queued row. With no credentials the button doesn't render and the route returns 503, so nothing changes until you finish setup.

Setup is three steps and only the account owner can do them (create the OAuth client, approve the consent screen, paste three env vars into Vercel): **`docs/gmail-send-setup.md`**. `scripts/gmail-oauth.mjs` mints the refresh token.

Scope is `gmail.compose` — send and manage drafts, **no inbox read access**. One row per press, two presses to fire, only `queued` rows, no cron or agent path. Unrun against live Gmail until the first real send.

## Keeping the queue honest

`POST /api/agency/outreach` rejects any row without `facility`, `email`, and `gmail_draft_id`, so a queue row can't exist without a draft behind it. Agents that draft outreach should register the drafts through that route in the same run — otherwise the queue drifts from Gmail, which is exactly the failure the reply-triage fix was about (`agency-os/gtm/reply-triage-rules.md`).
