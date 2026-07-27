# Phase 3 — Compliance Gates

The gate engine is a single function evaluated **at the moment of the guarded action** (not at scheduling time). Every evaluation — pass or block — writes an `audit_logs` row with `gate_code`. Every block creates or updates a `compliance_exceptions` row carrying the four required elements: **why blocked, which record caused it, what document/approval clears it, who may clear it.** Gates are default-deny: missing data blocks; only explicit, current, sourced records pass.

Block-message template (rendered in UI, stored in the exception):

> **Blocked by {gate_code} — {gate_name}.**
> Why: {description}.
> Blocking record: {blocking_record_type} #{blocking_record_id} ({human label}).
> Required to clear: {required_remedy}.
> May be cleared by: {clearable_by_role}.

| Code | Guarded action | Check (all must pass) | Blocking record surfaced | Required remedy | Clearable by | Waivable? |
|---|---|---|---|---|---|---|
| **G1** | Enrolling a contact in a sequence / sending any outreach message | buyer_entities.status ∈ {qualified, verified}; buyer_type set; contact title set; email_verification_status = deliverable and last_verified_at ≤ 90d; entity not suspended/do_not_contact. *For product-specific campaigns, entity must be `verified` (licenses verified).* | buyer_entities or buyer_contacts row | Complete qualification fields; run license verification (WF7) for verified-tier campaigns | Compliance | No |
| **G2** | Attaching a product to a campaign, opportunity, quote, or introduction | products.status = approved; not suspended by open recall; product_documents required set current | products row (or recalls row if suspended) | Product approval per WF4/WF5; recall closure + F un-suspension | Founder (after CR review) | No |
| **G3** | Offering a product to a buyer in a state (campaign scoping, quote lines, introductions) | product_geographic_restrictions has `allowed` (or `allowed_with_conditions` with conditions acknowledged by CR) for every buyer facility state involved | product_geographic_restrictions (missing or `prohibited` row) | Counsel-based allow record approved by F | Founder with counsel basis | No |
| **G4** | Offering a product to a buyer type | product_approved_buyer_types row exists for the buyer's buyer_type | product_approved_buyer_types (missing row) + buyer_entities row | Counsel-based buyer-type record approved by F | Founder with counsel basis | No |
| **G5** | Sending any message | recipient email and domain absent from suppression_list; contact.outreach_status ≠ opted_out/bounced | suppression_list row | None for opt_out/legal_request (permanent). Bounce entries: F may clear only with proof of re-verified deliverability and prior consent context | Founder (bounce only) | **Never for opt-out** |
| **G6** | Moving a quote to sent_to_buyer | quotes.status = supplier_approved; supplier_approval_evidence_id present; every line passes G2–G4; valid_until ≥ today | quotes row (missing evidence) | Supplier written pricing approval uploaded as evidence document | Supplier (provides) + CR (verifies) | No |
| **G7** | Creating/approving a commission_calculation | compensation_agreements row with status = signed_active, counsel_reviewed = true, document_id present, effective range covering collected_date | compensation_agreements row (missing/expired/unsigned) | Fully executed agreement uploaded; F sets signed_active | Founder | No |
| **G8** | Setting orders.status = complete | completion_evidence_id present (supplier written confirmation of delivery/acceptance); status was delivered | orders row | Supplier confirmation document | Supplier (provides) + Founder (sets status) | No |
| **G9** | Continuing outreach / new quotes / introductions for a buyer with an expired credential | all buyer_licenses required for its buyer_type have status = active (not expired/revoked); attestations unexpired | buyer_licenses row (the expired one) | Renewed license verified via license_verifications with evidence | Compliance | No |
| **G10** | Publishing/sending any copy (templates, product descriptions, quote cover text) | claims-linter pass: no efficacy/medical-outcome claims, no "FDA-approved" unless a sourced approval record exists, no unqualified "legal"; template is an approved version (WF8) | the template/description document + linter report | Rewrite; CR + F re-approval of template | Founder + Compliance (both) | No |

Additional engine rules:

- **RC-gates:** the twelve requires-counsel items from `00-decision-table.md` are seeded exceptions (RC1–RC12) that block their dependent workflows until a counsel document is linked via a `compliance_reviews` record. Clearable by Founder-with-counsel only.
- **Post-hoc auditing:** supplier-reported orders are gate-checked *after the fact* (the supplier sold; the agency didn't act). A line item failing G2/G3/G4 at order date opens a high-severity exception — it does not silently pass because the action already happened.
- **No waiver path exists for G5 opt-outs or G10.** Waivers elsewhere require an F memo document and appear on the dashboard's waived list permanently.
- **Fail closed:** if the gate engine errors or reference data is unreadable, the action blocks with gate_code `GERR` and a critical exception. Automations must treat "unknown" as "blocked."
