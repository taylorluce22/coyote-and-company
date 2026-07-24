# Farmhand — Reconciled 90-Day Plan & Dev Backlog

> Synthesis of two independent strategy passes (Claude + ChatGPT) that converged on
> the same plan. This is the single source of truth a Dev agent builds from. Where
> the two differed, the reconciled call is stated inline and marked **[CALL]**.

## The decision (one paragraph)
Sell Farmhand as a **done-with-you productized service**, operated by the founder
inside the existing single-user app — NOT as multi-tenant SaaS. Beachhead:
**self-generating residential solar closers in Phoenix** doing 2+ deals/month who
already post badly. Price **$1,500 first month → $750/mo** (founding 10; $997 after).
The free **Territory Teardown** is the whole go-to-market. Build only what lowers
**minutes-per-client-per-week** or unblocks a sale. Multi-tenant self-serve SaaS is a
**Day-90 decision funded by service revenue**, not a prerequisite.

## Targets
- First paid pilot ~Day 14 · 3 pilots by Day 30 · 8 clients by Day 60 · **10–15 clients / $7.5–10k MRR by Day 90.**
- Servicing time: **≤3 hrs/client/week at launch → ≤1 hr by Day 90.**
- First-pass content approval **≥70%** · top-10 lead relevance **≥60%** · gross margin **≥65%**.

## Reconciled calls (where the two plans differed)
1. **[CALL] Pricing:** $1,500 first month (setup + month one, front-loads cash & filters tire-kickers) → **$750/mo** founding 10 → **$997** from client #11. Founding-cohort framing, price-locked 12 months.
2. **[CALL] Tenancy weight:** ship the **client-namespace profile switcher now** (fast path), add **export/import backup immediately** (localStorage holding paying clients is fragile), then migrate to **server-side workspaces at ~5 clients or any data scare** (Supabase memory layer already scaffolded). Phased.
3. **[CALL] Market contraction is real and in-scope:** 25D residential credit ended 12/31/2025; residential solar ~‑25% in 2026. Reframe pitch around urgency; treat the durable ICP as *self-generating home-improvement closer*; **schedule roofing/HVAC vertical for ~Day 45** as a planned event. (Founder to confirm weighting — he has ground truth.)
4. **[CALL] Data durability:** near-term = export/import bundle; real answer = server-side workspace migration (Epic G).

## What we are explicitly NOT building in 90 days
Public self-serve signup · team seats/roles/manager dashboards · white-label · new
professions beyond the Day-45 roofing config · enterprise SSO/audit · auto-posting or
auto-commenting · full CRM replacement · native mobile · cosmetic Agent-Network/
Command-Center/Knowledge-Vault expansion · a Higgsfield-API likeness workaround (measure
the manual step's real cost first).

---

# Dev Backlog (priority order, deduped across both plans)

Rule: each story has an acceptance criterion (**AC**). **[DECISION]** = needs a founder
call before a coding agent starts. Effort is rough.

## ▶ FIRST-REVENUE SLICE (build this first — gate: first paying client)

### E1 — Operator multi-client mode `P0 · ~1–2 days`
- **E1-1 Namespace all client state.** Prefix every localStorage + IndexedDB key with an active `clientId`; migrate existing single-user data to `client:founder`.
  - **AC:** Two clients configured; switching yields entirely separate strategy profiles, planners, pipelines, and image vaults with zero bleed.
- **E1-2 Client switcher UI.** Persistent selector in app chrome showing the active client on every screen.
  - **AC:** Switching re-renders all modules against the new profile in <2s; active client always visible (guards against sending Client A's content to Client B).
- **E1-3 Client bundle export/import.** JSON export of a full client profile + vault manifest.
  - **AC:** A client can be exported, the browser cleared, and the client restored intact. This is the backup that stops a localStorage wipe from destroying paying clients.

### E4 — Cost & usage metering `P0 · ~half day`
- **E4-1 Per-generation cost log.** Every Higgsfield/Perplexity/Gemini call logged with `clientId`, type, timestamp, unit cost.
  - **AC:** A query returns total + per-accepted-asset spend per client per month.
- **E4-2 Allowance guardrail.** Soft monthly cap per client: warn at 80%, block at 100%, operator-overridable.
  - **AC:** Exceeding the allowance blocks new generations for that client until overridden.

### E2-3 — Monday packet export `P0 · ~2 days`
- **Story:** One-click client-facing artifact: the week's posts (images + copy), the curated lead list with warmth scores + source links, and the single best next action.
  - **AC:** Produces a shareable branded HTML/PDF in <60s containing no Farmhand internals.

> Shipping E1 + E4 + E2-3 makes Farmhand sellable and deliverable. Everything below reduces servicing time or unlocks the next gate.

## ▶ SERVICING-TIME REDUCTION (gate: >3 clients)

### E2 — Weekly run + triage `P0 · ~1 week`
- **E2-1 One-command weekly run.** One action generates the full week for the active client: 5 posts (copy + images), planner slots, lead sweep.
  - **AC:** Founder triggers once and gets a complete draft week in <10 min wall-time, no intermediate input.
- **E2-2 Lead triage queue.** Keyboard-driven accept/reject/snooze over hunt results; rejections feed the relevance model.
  - **AC:** 50 raw opportunities triaged in <5 min; rejected patterns suppressed in the next sweep for that client.
- **E2-4 Batch failure hardening.** Any generation failure retries and reports rather than dropping the batch.
  - **AC:** A forced mid-batch API failure leaves all successful assets intact and lists the failures to retry.

## ▶ CLIENT APPROVAL LOOP (gate: ~5 clients)

### E3 — Client share & approval `P1 · ~3–4 days`
- **E3-1 Signed read-only share link.** Tokenized URL rendering the Monday packet — no login.
  - **AC:** Renders on mobile, expires after 14 days, exposes no app functionality beyond viewing.
- **E3-2 Per-post approve / reject / request-change.** Client actions write back to the operator queue tagged to client + post within 30s.
  - **AC:** Client marks "change: swap the photo"; it appears in the founder's queue correctly attributed.
- **[DECISION]** Leads in the share link, or posts only? *Recommendation: posts only at first; curated leads go by email to preserve the weekly human touchpoint that drives retention.*

## ▶ LIKENESS WORKFLOW (the §4 product risk) `P1 · ~3 days · gate: ~5 clients`

### E5
- **E5-1 Batch prompt export.** Emit a month of likeness shot specs as a numbered, copy-paste-ready list for the Higgsfield web UI.
  - **AC:** One action → 12 spec-complete prompts; operator pastes serially without editing.
- **E5-2 Bulk import & auto-tag.** Drag a folder of downloads in; auto-match to originating spec and tag into the client vault.
  - **AC:** 12 images imported + correctly tagged in <2 min.
- **E5-3 Vendor-agnostic prompt layer.** CMO skill emits a neutral shot spec; a thin adapter maps to a provider.
  - **AC:** Swapping image provider touches one adapter file only.
- **[DECISION]** Pursue an API-accessible per-client identity-lock (LoRA/fine-tune) instead of the manual step? *Recommendation: don't evaluate before Day 60 — if the manual step is ~15 min/client/month it doesn't justify a research project.*

## ▶ VERTICAL EXPANSION (gate: ~Day 45)

### E6 — Vertical config kit `P1 · ~3 days`
- **E6-1 Vertical schema.** A vertical = one config: intents, search phrasing, relevance rules, content-archetype weightings, compliance lint rules.
  - **AC:** `roofing.json` authored with no code changes; lead hunt returns roofing-relevant results ≥70% precision on a 50-result sample.
- **E6-2 Vertical precision harness.** Labeled sample set per vertical to score hunt precision after tuning.
  - **AC:** Running the harness prints precision/recall and fails the build below threshold.
- **E6-3 Claims lint for solar/finance.** Mirror the fair-housing lint: flag unqualified savings claims, guaranteed-return language, rate projections.
  - **AC:** "save $200/month guaranteed" is flagged before it reaches the packet.
- **[DECISION]** Obtain AZ solar advertising/compliance review before removing human approval from any claims-based post.

## ▶ DEFERRED — build only on the Day-90 go-decision OR a Team-tier sale

### E7 — Multi-tenancy, auth, billing
- **E7-1** Supabase auth + per-account row-level isolation. **AC:** two accounts can't read each other's data under direct API probing.
- **E7-2** Migrate client state from localStorage/IndexedDB to Supabase. **AC:** an account's full state loads on a fresh device.
- **E7-3** Stripe subscriptions + plan tiers + usage metering tied to E4. **AC:** a lapse downgrades access without data loss.
- **E7-4** Self-serve onboarding: intake → generated first week, no operator. **AC:** a test user reaches a populated week-one dashboard unaided in <15 min.
- **[DECISION]** Do not start E7 until the Day-90 gate passes on evidence, or a Team-tier ($2,500/mo) client's reps need real logins.

---

## Founder dashboard (only metrics that change a decision)
Acquisition: qualified contacts · conversations · demos · paid pilots · demo→paid ·
cash collected. Delivery: payment→onboarded time · time-to-first-packet · founder
minutes/client · on-time rate. Quality: first-pass QA rate · attempts+cost/accepted
asset · approval rate · revision rate · published/approved · top-10 lead relevance.
Economics: active accounts · MRR · renewal · month-2 retention · generation COGS ·
labor COGS · gross margin · referral rate.

## Bottom line
Farmhand does not need to be finished SaaS to earn its first dollar. It needs to sell
one expensive, measurable workflow to one customer the founder can reach this week,
deliver it through founder-operated isolated client profiles, measure approval /
publishing / relevance / labor / cost / renewal, and build only the tenancy, approval,
and billing features that repeated *paid* behavior proves it needs.
