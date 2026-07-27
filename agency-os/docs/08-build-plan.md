# Phase 8 — Build Plan

Build order (each stage gates the next; nothing downstream launches until upstream acceptance passes):
**1 Database → 2 Supplier onboarding → 3 Buyer verification → 4 Compliance gates → 5 CRM → 6 Quote & order tracking → 7 Compensation tracking → 8 Reorder tracking → 9 Dashboard → 10 Outreach automation → 11 Regulatory monitoring.**

## Product requirements document (condensed)

**Product:** internal operating system for a compliance-first B2B pharmaceutical sales & sourcing agency. One founder-operator today.
**Problem:** brokering introductions between vetted suppliers and license-verified B2B buyers requires provable compliance discipline; spreadsheets can't prove who approved what, when, on what basis.
**Non-goals:** everything in `00-decision-table.md` §3 (no storefront, no patient-facing anything, no automated legal conclusions, no possession/title, no buyer invoicing).
**Success criteria:** zero outreach to unverified/suppressed contacts (measured: blocked-send exceptions vs. sent messages); 100% of approvals carry approver + basis document; commission calc matches supplier statements at close within $0; founder operates the whole loop in < 1 hr/day of system time.
**Constraints:** requires-counsel items RC1–RC12 block their dependent workflows until cleared (seeded exceptions).
**Authoritative specs:** data model `01`, roles `02` (field-level permissions), gates `03`, workflows `04`, dashboard `05`, outreach `06`, stack `07`.

## User stories & acceptance criteria (by build stage)

| # | Story | Acceptance criteria (testable) |
|---|---|---|
| S1 | As founder I need the full schema deployed with roles and an append-only audit log | All Phase-1 tables exist; RLS denies by default; any write produces an audit row; `UPDATE/DELETE` on audit_logs fails for every role incl. sysadmin; suppression_list rejects deletes |
| S2 | As founder I can take a supplier from prospect → approved with a complete evidence trail | Cannot set status=approved while any required doc/license/insurance/checklist item is missing (attempt → G-family exception with remedy text); approved supplier has approved_by≠created_by recorded, next_review_date set; WF2 reminders fire on schedule in test |
| S3 | As compliance I can verify a buyer license only with evidence | license_verifications insert fails without evidence_document_id or with automation identity; entity can't reach verified without required license set + attestations; expiry auto-downgrades and freezes dependents (G9) same day |
| S4 | As any user I am blocked from gated actions with a complete explanation | Each gate G1–G10 has a test fixture that attempts the action and asserts: block + exception row containing why / blocking record / remedy / clearable_by; G5 opt-out and G10 have no waiver path even for founder |
| S5 | As a rep I manage prospects → opportunities without compliance authority | Rep account cannot approve suppliers/products/licenses/exceptions/campaigns (API-level test per table); rep can run WF6, WF10–WF13 happy paths |
| S6 | As founder I track quotes/orders reported by suppliers | Quote can't reach sent_to_buyer without supplier evidence (G6); order can't reach complete without confirmation doc (G8); line item violating G2–G4 at order date opens exception automatically |
| S7 | As founder commissions compute only from signed agreements | Calc without covering signed_active agreement fails (G7); rate math property-tested against rate_schedule shapes; calc → invoice requires founder approval; payments must fully apply or reconciliation flags |
| S8 | As a rep I get reorder tasks at the right time | Cadence derived from ≥2 orders; task at expected−14d; lapsed at +30d moves account to churn metrics |
| S9 | As founder the dashboard tells me what to do today | Band-1 queues match underlying tables exactly (spot-check queries); MRR/new/churned reconcile: current = prior + new − churned ± expansion (tolerance 0); every scorecard links to its backing filtered view |
| S10 | As founder outreach can only do the narrow safe thing | Unapproved template cannot send (incl. edited-after-approval); nightly sweep never enrolls a contact failing any of G1/G5/G9 (fixture matrix); opt-out reply suppresses in < 1 min and cancels queued sends; body snapshots stored for 100% of sends |
| S11 | As compliance I triage regulatory changes | Feed item lands unreviewed; SLA task at +2bd; action_required requires linked review; product offer-freeze takes effect immediately when CR sets in_review |

## Screen list & navigation

Navigation (left rail, in this order): **Today** · Pipeline · Buyers · Suppliers · Products · Quotes & Orders · Money · Compliance · Outreach · Settings.

| Screen | Contents |
|---|---|
| 1. Today (founder home) | Band-1 compliance queues + today's tasks + approvals awaiting me |
| 2. Dashboard | Full Phase-5 layout (Money/Pipeline/Account bands) |
| 3. Suppliers list / 4. Supplier detail | Detail tabs: profile, facilities, licenses, inspections, insurance, products, agreements, orders, reviews, documents, audit |
| 5. Supplier intake form | WF1 entry |
| 6. Products list / 7. Product detail | Tabs: classification (with basis doc), documents, buyer types, states, recalls, audit. Approval panel shows the three explicit approvals |
| 8. Buyers list / 9. Buyer detail | Tabs: qualification, facilities, contacts, licenses & verifications, attestations, opportunities, orders, audit |
| 10. Prospect import | Staging review, dedupe queue, reject reasons |
| 11. Verification workbench | CR queue: license → source link → evidence upload → result (the WF7 screen) |
| 12. Pipeline board | Opportunities by stage with gate-status chips per card |
| 13. Opportunity detail | Gates panel, introduction (consent state), quote links, meetings |
| 14. Quotes list/detail | Evidence attachment, G6 state |
| 15. Orders list/detail | Supplier-reported timeline, completion evidence, line-item gate audit results |
| 16. Money | Collections, calcs (approve queue), invoices, payments, close checklist (WF23) |
| 17. Compliance center | Exceptions, reviews, waiver register, regulatory queue, complaints/AEs/recalls |
| 18. Outreach | Campaigns, template versions + approval states, suppression list, send log with gate results |
| 19. Settings | Users/roles, integrations, checklist templates, linter word lists |
| 20. (Scale only) Supplier portal | Own profile/docs/products(draft)/introductions(consent)/orders(report)/collections(report)/agreement/statements |

Field-level permissions: the matrix in `02-roles-permissions.md` is authoritative; UI hides what RLS denies (defense in depth — UI hiding is never the enforcement).

## Automation specifications (Make MVP / n8n scale)

| ID | Trigger | Action | Guard |
|---|---|---|---|
| A1 | Daily 06:00 | License/insurance/doc expiry sweep: set expiring_soon/expired (downgrade only), create tasks, open exceptions, freeze dependents | Never upgrades status |
| A2 | Nightly 21:00 | Outreach eligibility sweep + enrollment within caps | Full gate re-check per contact at send time too |
| A3 | Webhook (email platform) | Delivery/bounce/reply/opt-out ingestion; suppression on opt-out/hard bounce; sequence stop on any reply | Opt-out path has no human step |
| A4 | Webhook (calendar) | Meeting create/update; no-show task | |
| A5 | On collected_revenue insert | Draft commission calc (G7) | Draft only; never approves |
| A6 | Daily 07:00 | Reorder expectation refresh; tasks at expected−14d; lapse at +30d | |
| A7 | Daily 06:30 | FDA enforcement-report + configured feeds → regulatory_updates (unreviewed); recall match → auto-suspend product + recall row | Suspension is the only status change allowed |
| A8 | Monthly 1st | Close packet draft (WF23) | Founder approves close |
| A9 | On any gate block | Exception upsert + notification (critical → immediate) | |
| A10 | Quarterly | Access-review task (users, roles, supplier logins) | |

Every automation writes audit rows with run ids; every automation fails closed (on error: block + exception, never proceed).

## Error states (pattern + specifics)

Pattern: every error names the record, the reason, and the next action; gate blocks use the G-template from `03`. Specifics: import row invalid → per-row reason, batch continues; duplicate suspect → merge queue, no auto-merge; evidence upload hash mismatch → reject; automation failure → fail closed + critical exception; webhook out-of-order → idempotent upserts keyed on provider ids; period locked → founder-unlock flow with reason; RLS denial → "you don't have permission; who does: {role}"; stale gate data (reference record changed since page load) → re-evaluate server-side at commit, never trust the client.

## Test plan

1. **Gate matrix (the core):** fixtures for each gate × {pass, each failure mode} — asserts block, exception contents, audit rows. ~45 cases.
2. **RLS/permission suite:** for each role × table × verb from the `02` matrix, attempt and assert allow/deny (generated tests, incl. supplier row-scoping and blinding pre-introduction).
3. **Workflow happy paths:** WF1–WF23 end-to-end with seed data.
4. **Workflow sad paths:** the [P]-steps attempted by automation identities must fail; approval by wrong role must fail; self-approval must fail.
5. **Money properties:** commission math property tests per rate shape; close reconciliation with an intentionally wrong supplier statement must flag.
6. **Outreach drills:** opt-out latency (< 1 min), queued-send cancellation, template-edit re-approval, cap enforcement, bounce-rate auto-pause.
7. **Immutability:** audit_logs and suppression_list mutation attempts by every role including SA.
8. **Metric reconciliation:** MRR identity (current = prior + new − churned ± expansion) on generated order histories.
9. **MVP (Airtable) manual test script:** same scenarios as 1–6 executed by hand monthly, because Airtable can't run the automated suite — checklist ships in the operating manual.

## Seed data

`db/seed.sql`: 1 founder, 1 rep, 1 compliance, 1 accountant, 1 sysadmin, 1 supplier user; 2 suppliers (one approved with full evidence chain, one stuck in_review missing insurance — exercises the queues); 3 products (approved / counsel-blocked / recalled-suspended); buyer-type and state allow-lists for the approved product; 4 buyer entities (unqualified, qualified, verified, active-with-orders); contacts incl. one suppressed; 1 campaign + approved template; opportunities across stages; quote with supplier evidence; 2 orders (one complete with evidence, one delivered awaiting confirmation); collections + draft and approved calcs + partial payment; reorder due; open exception per major gate; 1 complaint→AE; 1 recall; regulatory updates in each impact state; RC1–RC12 seeded exceptions.

## Deployment instructions

**MVP:** create Airtable base mirroring `schema.sql` names/enums (single-select fields = enums verbatim) → build Interfaces per screen list → configure Make scenarios A1–A10 → connect Instantly (real-brand domain, footer, webhook), MillionVerifier, Cal.com, Dropbox Sign, QBO → load seed rows → run the manual test script → clear RC-blockers with counsel before first live outreach.
**Scale:** `supabase init` → apply `db/schema.sql` then `db/rls` section → `db/seed.sql` in staging → Retool apps per screen list → n8n flows A1–A10 (parallel-run with Make, then cut over) → Next.js portal (supplier auth via Supabase Auth, RLS does the scoping) → migrate Airtable CSVs → hash-verify documents → decommission Airtable. Backups: nightly Postgres dump + storage sync, restore-tested quarterly.
