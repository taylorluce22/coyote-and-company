# Automation Wiring — Full-Auto Operation Spec

Target operating model: **the machine runs the business; the founder runs a one-click cockpit.** Every email is sent by automation. Every reminder, freeze, suppression, calculation, log entry, and report is automated. The founder's daily surface is the **Today** interface: a queue of clicks (approve / send / verify) plus reply conversations. Budget: 20–40 min/day once running.

Two hard red lines stay in the design because they're what keeps the machine legal (basis: `docs/10-regulatory-research.md`):
1. **No automated texting or robocalling** — cold email is the lawful automated channel; automated texts to cell numbers without written consent carry $500–1,500-per-message private lawsuits (TCPA). Email automates fully; phones stay human.
2. **No unapproved copy ever sends** — templates send fully automatically *after* the two approval checkboxes are set once per template version. Editing a template creates a new version that re-queues for the two clicks. This is minutes of friction per template, and it's the difference between a compliant sender and a warning-letter recipient.

Everything else automates.

## Stack wiring

```
Instantly (sending + warm-up)  ⇄ webhooks/API ⇄  Make (scenarios M1–M12)  ⇄ API ⇄  Airtable (system of record)
Cal.com (booking)              → webhook →  Make → Airtable
MillionVerifier (email verify) ← API ← Make
Google Drive (evidence/docs)   ← links stored in Airtable
QBO (invoices)                 ← Make (M8)
FDA feeds (RSS/email)          → Make (M12)
```

Instantly config: brand-variant sending domains only; custom domain tracking; **custom unsubscribe page + webhook** (not just Instantly's internal list — ours is the master); warm-up 2–3 weeks before first send; daily cap ramp 10 → 30/domain; reply detection on.

## Scenarios

### M1 — Nightly enrollment sweep (the sending gate) · daily 21:00
1. Read Airtable view `Contacts / Enroll Queue` (view filter = gates G1 pre-check).
2. Per contact, re-verify in real time (never trust the view alone): lookup email + domain in **Suppression** (G5); confirm buyer credentials current for campaign tier (G9); confirm campaign Status = Active **and** both approval checkboxes true (G10); email Last Verified ≤ 90d else call MillionVerifier and update.
3. Pass → add to Instantly campaign (within Daily Cap), write **Messages** row (Queued, Gate Result = pass detail), Audit row.
4. Fail → write **Messages** row (Blocked, Gate Result = failing gate), create/refresh Exception. **Any lookup error = Blocked** (fail closed).

### M2 — Instantly webhook intake (instant) 
- `sent/delivered` → update Messages (+ Body Snapshot from Instantly on first send).
- `bounce` → Messages Bounced; Contact Outreach Status = Bounced; Suppression row (Hard Bounce); remove from all Instantly campaigns.
- `unsubscribe / reply containing opt-out keywords` → **immediate**: Suppression row (Opt Out, Permanent), Contact = Opted Out, remove from every Instantly list, cancel queued sends, Audit row. No human in this path, ever.
- `reply` (non-opt-out) → Contact = Replied; **stop sequence for that contact permanently**; create Task (Reply Triage, due today); optional AI classification written to Reply Class as a *suggestion only*.
- All events → Audit rows. Idempotent on Provider ID.

### M3 — One-click approval enforcement (watch on record change)
Watches the approval checkboxes and status fields on Campaigns, Products, Suppliers, Agreements, Commissions:
- Campaign → Active: allowed only from `Ready to Activate` view membership (both checkboxes + template version present). Otherwise Make reverts the status and opens an Exception naming what's missing. 
- Agreement → Signed Active: requires Signed Date, Contract Link, **Federal Exclusion Clause checked**; else revert + Exception.
- Product → Approved: requires Classification, Classification Basis link, ≥1 Approved Buyer Type, ≥1 Allowed State; else revert + Exception.
- Exception → Resolved: requires Resolution Note; else revert.
The founder's click is the decision; M3 makes an invalid click impossible to leave standing. Every transition → Audit row.

### M4 — Credential expiry engine · daily 06:00
Expiration ≤60d → Status = Expiring Soon + Task; ≤7d → High task; past → **Expired** and: linked Buyer drops to Qualified (pulls contacts out of Enroll Queue automatically via view filter), or Supplier flagged + High exception. Downgrades only — renewal back to Active happens solely through the Verify workbench (human enters Verified By/At + Evidence Link; M4 then restores dependent statuses). Audit rows throughout.

### M5 — Reorder engine · daily 06:30
≥2 completed orders per Buyer×Product → derive Cadence Days (median gap), maintain Reorders rows. At Expected−14d: create Task **and generate the reorder email as a Gmail draft** (approved reorder template + account facts) — founder sends with one click from Gmail. At Expected+30d: Status = Lapsed → feeds churn metrics. (Reorder mails are 1:1 to an existing relationship; the one-click keeps a human in the relationship without writing anything.)

### M6 — Introduction packet generator (watch Opportunities)
Stage → Supplier Consented: Make assembles the intro email as a **Gmail draft**: supplier + buyer contacts, license-verification evidence links, buyer type/state confirmation, template intro text. Founder reviews 30 seconds, clicks send. Make detects the sent thread → Stage = Introduced, Introduced At stamped, Audit row. (The introduction is the product — it stays a human send, pre-assembled to one click.)

### M7 — Supplier reporting intake
Airtable form per supplier (tokenized link) for quotes/orders/collections reporting; Make validates on submission: quote links to an Introduced opportunity (else Integrity Flag + Exception), order totals sane, collection ≤ order total. Monthly reminder email to each Active supplier with their form link + a summary of what we have on file. First Order checkbox derived automatically.

### M8 — Money engine · on Collection created + monthly 1st
- Per Collection: find Agreement (Signed Active, Federal Exclusion Clause checked, Effective covering Collected Date) → write Commission row (Draft, Type=Commission, Amount = Amount × Commission Pct). No qualifying agreement → Exception, no calc (G7).
- Monthly 1st: add Meeting Fee lines (meetings held last month × fee; retainer lines only if the agreement is a variant-A type), assemble the period statement, notify founder → **Awaiting Approval** view.
- Founder approves (one click per period) → M8 generates the QBO invoice to the supplier, marks Invoiced, emails statement. Payment recorded in QBO → webhook → mark Paid. Mismatches → Disputed + Exception.

### M9 — Daily digest · 07:00
One email/notification to founder: overnight sends/replies/bounces; approvals waiting (count + links); open exceptions by severity; SLA timers (Issues awaiting forwarding); today's tasks; reorder drafts ready. **This is the cockpit's front door — if the digest is empty, the business ran itself last night.**

### M10 — Audit + integrity sweeper · daily 05:00
Writes Audit rows for any scenario that failed to log (belt and braces); reverts hand-edits to ⚙ fields; flags Exceptions resolved without notes; verifies Suppression has no deletions (row count monotonic; if a deletion is detected → Critical exception).

### M11 — Metrics snapshot · Sunday 22:00 + monthly 1st
Computes and stores: MRR (trailing-90d approved commission ÷ 3 for recurring accounts), new/churned MRR, pipeline by stage, meeting/intro/quote/order conversion, concentration flags (>40% supplier / >30% buyer), days-to-first-order. Monthly snapshot locks with the close.

### M12 — Regulatory feed intake · daily 06:45
FDA enforcement-report RSS + warning-letter feed + board bulletins (per target state) → Regulatory Updates (Unreviewed). Name-match against Suppliers/Products → if hit: High exception + (recall match) auto-set Product = Suspended. Un-suspension is human-only via M3 rules. Two-business-day triage task auto-created.

## The human residue (everything else is the machine)

| Act | Surface | Time | Why it stays human |
|---|---|---|---|
| Approve a template/campaign version | Approve interface, 2 checkboxes | ~2 min, once per version | The legality of the whole sending machine hangs on approved copy (G10) |
| Verify a license | Verify workbench: open pre-filled board URL, screenshot to Drive, paste link, click Verified | ~5 min each, batch weekly | "License-verified buyers" is the product being sold; an automation attesting to it makes the claim worthless |
| Send an intro / reorder draft | Gmail, pre-assembled | ~30 sec each | The introduction is the relationship — and it's revenue-triggering |
| Reply to interested prospects | Inbox | The actual sales work | This is the business |
| Approve monthly commission statement | One click per supplier per month | ~5 min | It's an invoice going out under your name |
| Clear exceptions | Today queue | Varies | Each one is the machine saying "I refused to act — decide" |

Everything not in that table — sending, sequencing, suppression, verification scheduling, freezing, calculating, invoicing, logging, monitoring, reporting — runs without you.

## Build order

1. Instantly workspace + domains + warm-up start (day 1 — longest lead time).
2. Airtable base per `base-setup.md` + CSV imports (day 1–2).
3. M2 webhooks first (never send before intake works), then M1, M3, M10 (the compliance spine), then M4–M9, M11–M12.
4. Dry-run week: M1 pointed at a test campaign with your own addresses across Gmail/Outlook; verify opt-out latency < 1 min, suppression sync, digest accuracy.
5. Templates through the two-click approval → activate supplier recruitment campaign → live.
