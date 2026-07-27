# Phase 2 — Roles and Permissions

Six roles. Enforcement is at the database layer (Postgres RLS in the scalable stack; interface + automation guards in the Airtable MVP — see `07-stack.md` for the MVP caveat that Airtable cannot truly enforce row security for external users, which is why suppliers get no direct MVP login).

## Role definitions

| Role | Purpose | Hard limits |
|---|---|---|
| **Founder (F)** | Final approver for everything legally material: suppliers, products, buyer-type/state allow-lists, campaigns, agreements, commission approval, exception waivers | Cannot edit `audit_logs`; cannot remove opt-out suppressions; waivers require a written memo document |
| **Sales Representative (SR)** | Prospecting, qualification data entry, opportunities, meetings, quotes (request/track), tasks | **Cannot approve suppliers, products, licenses, classifications, buyer-type/state rows, campaigns, or exceptions. Cannot write license_verifications. Cannot see commission rates. Cannot un-suppress or un-opt-out anyone.** |
| **Compliance Reviewer (CR)** | Verifications, compliance reviews, classification records (from counsel basis docs), exception management, regulatory triage | Cannot give final approval on suppliers/products/campaigns (recommends; F approves); cannot approve commission calcs; cannot waive exceptions marked founder-only |
| **Supplier User (SU)** | Self-service for their own supplier: upload docs/licenses, submit products (draft), consent to introductions, approve quote pricing, report orders/deliveries/collections, acknowledge AEs/recalls | **Row-scoped to own `supplier_id` on every table.** Sees opportunities/buyers only after an introduction record with consent. Never sees other suppliers, agency-wide pipeline, commission internals beyond own agreement, or pre-introduction buyer identities |
| **Read-Only Accountant (AC)** | Reconciliation and close | Read-only on financial + order + audit tables; may set `commission_payments.reconciled`. No access to outreach, contacts, complaints, or compliance work products |
| **System Administrator (SA)** | User management, integrations, backups | No business approvals; cannot modify `audit_logs` or `suppression_list` opt-outs; SA actions are themselves audit-logged |

## Permission matrix

Legend: C create · R read · U update · A approve/state-change · ✗ none · "own" = row-scoped. Everything not granted is denied (default-deny).

| Table | F | SR | CR | SU (own rows) | AC | SA |
|---|---|---|---|---|---|---|
| users | R+role-A | R self | R self | R self | R self | CRUD |
| suppliers | CRUA | R (approved) | RU+recommend | R | R | R |
| supplier_facilities | CRU | R | CRU | R + propose | R | R |
| supplier_licenses | CRUA | R | CRUA | C(pending)+R | R | R |
| supplier_inspections | CRU | ✗ | CRU | C(pending)+R | ✗ | R |
| supplier_insurance | CRU | ✗ | CRU | C(pending)+R | R | R |
| products | R+A | R (approved) | RU+recommend | C(draft)+R | R | R |
| product_regulatory_classifications | R+A | R | CRU | ✗ | ✗ | R |
| product_documents | R | R (approved) | CRUA | C(pending) | ✗ | R |
| product_approved_buyer_types | A | R | C | R | ✗ | R |
| product_geographic_restrictions | A | R | C | R | ✗ | R |
| buyer_entities | CRUA | CRU | R+A(verified) | blinded† | R | R |
| buyer_facilities | CRU | CRU | R | ✗ | R | R |
| buyer_contacts | CRU | CRU‡ | R | ✗ | ✗ | R |
| buyer_licenses | CRUA | C(pending)+R | RUA | ✗ | ✗ | R |
| buyer_attestations | RA | C+R | RA | ✗ | ✗ | R |
| license_verifications | C | ✗ | C | ✗ | ✗ | R |
| outreach_campaigns | RA | C+U(draft) | RA | ✗ | ✗ | R |
| outreach_messages | R | R | R | ✗ | ✗ | R |
| suppression_list | C+R | C+R | C+R | ✗ | R | R (no delete) |
| meetings | R | CRU own | R | ✗ | ✗ | R |
| opportunities | CRUA | CRU own | R | R post-intro† | R (amounts) | R |
| supplier_introductions | A | C | R | R + consent | ✗ | R |
| quotes | CRUA | C+U | R | R + price-A | R | R |
| orders | R+A(complete) | R | R | CRU (→delivered) | R | R |
| order_line_items | R | R | R | CRU | R | R |
| collected_revenue | R | R | R | C+R | R | R |
| compensation_agreements | CRUA | R (rates hidden) | R | R | R | R |
| commission_calculations | A | ✗ | R | R (approved+) | R | R |
| commission_payments | C | ✗ | R | R | RU(reconcile) | R |
| reorders | R | RU own | R | ✗ | R | R |
| compliance_reviews | R+A on subject | R summary | CRU | R own-subject | ✗ | R |
| compliance_exceptions | U+close/waive | R | CRU+close | R own-subject | R | R |
| complaints | A(close) | C+R | CRU | R own + resolve-note | ✗ | R |
| adverse_events | CRU | C | CRU | R own + ack | ✗ | R |
| recalls | CRUA | R | CRU | C(notice)+R | R | R |
| tasks | all | CRU own | CRU | R assigned | ✗ | R |
| documents | per related record | per related | per related | own-supplier | financial only | R |
| audit_logs | R | R own actions | R | R own-supplier | R | R (append-only for all) |
| regulatory_updates | RU | R | CRU | R (own products) | ✗ | R |

† Supplier users see a buyer's identity only through `supplier_introductions` rows where `status ∈ {consented, introduced}`. Pre-introduction, opportunity rows exposed to SU show stage and blinded labels only.
‡ SR may never change `outreach_status` from `opted_out`, and email edits on a suppressed contact do not lift suppression (suppression matches on email/domain, not contact id).

## Separation-of-duties rules (enforced as constraints, not convention)

1. `approved_by` on any record must differ from `created_by` where both exist (no self-approval), except F on records F created with a second review recorded.
2. Legally material approvals (supplier, product, buyer-type row, geo row, campaign, agreement, exception waiver) require role ∈ {F}; CR provides the recommending review first — both are recorded.
3. `license_verifications.verified_by` must have role ∈ {CR, F}; write attempts by automation identities are rejected at the DB layer.
4. `calculated_by` on commissions is always `system`; `approved_by` is always human F. Neither can be the same identity by construction.
5. One-founder reality: today one person holds F. The structure still forces the two-step (CR checklist then F approval) as two recorded acts; when a CR hire exists, no schema change is needed.
