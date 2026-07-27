# Phase 1 — Data Model

Executable DDL: `../db/schema.sql`. ERD: `../db/erd.md`.

## Conventions (apply to every table unless overridden)

- **Common fields:** `id uuid PK`, `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz`, `created_by uuid FK→users`. Not repeated below.
- **Req** column: ✅ required (NOT NULL / must be present before the record can leave `draft`), ◐ conditionally required (condition stated), ○ optional.
- **Status enums** never skip states; transitions are gate-checked and audit-logged.
- **Source** = where the data comes from. **Review** = how often a human re-verifies it. Both are stated per table; individual fields inherit unless noted.
- **Permissions** use role codes: **F** Founder, **SR** Sales Rep, **CR** Compliance Reviewer, **SU** Supplier User, **AC** Accountant (read-only), **SA** SysAdmin. `R`=read, `C`=create, `U`=update, `A`=approve/state-change. SU access is always row-scoped to `supplier_id = their supplier`. Full matrix: `02-roles-permissions.md`.
- **Soft delete only** (`archived_at`); hard deletes are prohibited everywhere except by SA with an audit record. `audit_logs` and `suppression_list` cannot be deleted at all.
- Every approval field pair (`approved_by`, `approved_at`) must reference a human user with an approving role; automations can never write them.

---

## 1. users
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| email | citext | ✅ | unique, RFC-5322 format | |
| full_name | text | ✅ | | |
| role | enum(founder, sales_rep, compliance, supplier_user, accountant, sysadmin) | ✅ | role changes only by F or SA | |
| status | enum(invited, active, suspended) | ✅ | | |
| supplier_id | uuid | ◐ req iff role=supplier_user | must be an approved supplier | →suppliers |
| mfa_enabled | bool | ✅ | must be true before role grants beyond invited | |
| last_login_at | timestamptz | ○ | | |

Permissions: SA CRUD; F R+role-approve; others R own row. · Source: founder invitation. · Review: quarterly access review (seeded task).

## 2. suppliers
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| legal_name | text | ✅ | unique | |
| dba | text | ○ | | |
| entity_type | enum(llc, corp, partnership, other) | ✅ | | |
| ein | text | ◐ req before approval | 9-digit format | |
| hq_address / city / state / zip | text | ✅ before approval | state = 2-letter | |
| website | text | ○ | URL format | |
| status | enum(prospect, in_review, approved, suspended, terminated) | ✅ | → approved only via compliance review workflow (WF3); never automated | |
| risk_tier | enum(low, medium, high) | ◐ req at approval | set by CR | |
| approved_by / approved_at | uuid/ts | ◐ req when approved | approver role ∈ {F} after CR recommendation | →users |
| next_review_date | date | ◐ req when approved | ≤ 12 months out (6 for high risk) | |
| source | text | ✅ | how the supplier was found | |
| notes | text | ○ | | |

Permissions: F CRUA; CR RU+recommend; SR R (approved only); SU R own; AC R; SA R. · Source: supplier-provided docs + primary-source verification. · Review: annual (semi-annual if high risk).

## 3. supplier_facilities
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id | uuid | ✅ | | →suppliers |
| name | text | ✅ | | |
| facility_type | enum(manufacturer, 503a_pharmacy, 503b_outsourcing, wholesale, lab, 3pl, office) | ✅ | | |
| address/city/state/zip | text | ✅ | | |
| fei_number | text | ○ | FDA FEI format (7–10 digits) | |
| state_license_required | bool | ✅ | if true, ≥1 active supplier_license must reference this facility before supplier approval | |
| status | enum(active, inactive) | ✅ | | |

Permissions: F/CR CRU; SU R own + propose edits (queued for CR); SR R; AC R. · Source: supplier docs, FDA registration DB. · Review: annual with supplier review.

## 4. supplier_licenses
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id | uuid | ✅ | | →suppliers |
| facility_id | uuid | ◐ | when license is facility-specific | →supplier_facilities |
| license_type | enum(state_wholesale, state_manufacturer, pharmacy, 503b_registration, dea_registration, device, other) | ✅ | | |
| jurisdiction | text | ✅ | 2-letter state or "US-FED" | |
| license_number | text | ✅ | unique per (jurisdiction, type) | |
| issued_date | date | ○ | | |
| expiration_date | date | ✅ | must be future at verification; drives gate G9 | |
| status | enum(pending_verification, active, expiring_soon, expired, revoked, surrendered) | ✅ | `expiring_soon` auto-set at T-60d; `expired` auto-set at date — automation may only *downgrade*, never activate | |
| document_id | uuid | ✅ | copy of license | →documents |

Permissions: F/CR CRU-A; SU C own (lands as pending_verification) + R; SR R; AC R. · Source: supplier upload + primary-source verification (license_verifications). · Review: at every expiration and at least annually.

## 5. supplier_inspections
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id / facility_id | uuid | ✅/◐ | | →suppliers, →supplier_facilities |
| inspection_type | enum(fda_483, fda_eir, state_board, third_party_audit, other) | ✅ | | |
| inspection_date | date | ✅ | | |
| outcome | enum(nai, vai, oai, pass, fail, pending, unknown) | ✅ | OAI ⇒ auto-open compliance_exception on supplier | |
| summary | text | ✅ | | |
| document_id | uuid | ◐ req if document exists | →documents | |
| reviewed_by / review_date | uuid/date | ✅ | CR reviewed | →users |

Permissions: F/CR CRU; SU C own (pending CR review) + R own; SR ✗; AC ✗. · Source: FDA data dashboards, supplier disclosure. · Review: at supplier annual review + on new FDA postings.

## 6. supplier_insurance
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id | uuid | ✅ | | →suppliers |
| policy_type | enum(product_liability, general_liability, recall, cargo, other) | ✅ | product_liability required for approval (RC10 confirms limits) | |
| carrier / policy_number | text | ✅ | | |
| coverage_amount | numeric(14,2) | ✅ | > 0; minimum per policy set at supplier approval | |
| effective_date / expiration_date | date | ✅ | expiration drives WF18 | |
| agency_additional_insured | bool | ✅ | target true (RC10) | |
| document_id | uuid | ✅ | COI on file | →documents |

Permissions: F/CR CRU; SU C own (pending) + R own; SR ✗; AC R. · Source: certificate of insurance from carrier/broker. · Review: at expiration; verified annually.

## 7. products
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id | uuid | ✅ | supplier must be approved | →suppliers |
| name | text | ✅ | unique per supplier; **claims-linter must pass** (no efficacy/medical terms — see 06-outreach.md word lists) | |
| generic_name / strength / form / unit | text | ○ | | |
| ndc | text | ◐ | format 4-4-2/5-3-2/5-4-1 when present | |
| sku | text | ○ | | |
| description | text | ✅ | claims-linter must pass | |
| status | enum(draft, in_review, approved, suspended, discontinued) | ✅ | → approved requires: ≥1 regulatory classification, ≥1 approved buyer type, ≥1 allowed state, required product_documents present, counsel review if flagged. Approval by F only, after CR recommendation. **Never automated.** | |
| counsel_review_required | bool | ✅ | set by CR at classification; if true, approval blocked until counsel memo doc linked | |
| approved_by / approved_at | uuid/ts | ◐ | | →users |
| next_review_date | date | ◐ req when approved | ≤ 12 months | |
| source | text | ✅ | supplier submission ref | |

Permissions: F A; CR RU+recommend; SU C own (draft) + R own; SR R approved only; AC R. · Source: supplier submission + supplier docs. · Review: annual, or immediately on regulatory_update impact.

## 8. product_regulatory_classifications
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| product_id | uuid | ✅ | | →products |
| classification | enum(rx_drug, otc_drug, compounded_503a, compounded_503b, api, medical_device, supplement, ruo_chemical, cosmetic, other) | ✅ | **system never infers this** | |
| basis | text | ✅ | narrative citation | |
| determined_by | enum(counsel_memo, supplier_attestation_counsel_accepted) | ✅ | nothing else is a valid basis | |
| basis_document_id | uuid | ✅ | the memo/attestation | →documents |
| effective_date | date | ✅ | | |
| review_date | date | ✅ | ≤ 12 months out | |

Permissions: CR C-U; F A; SU ✗ (may upload basis docs); SR R; AC ✗. · Source: counsel memo or counsel-accepted supplier attestation (RC2). · Review: annual + on regulatory_update.

## 9. product_documents
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| product_id | uuid | ✅ | | →products |
| doc_type | enum(coa, label, sds, spec_sheet, counsel_memo, supplier_attestation, approved_marketing_copy, other) | ✅ | required set per classification defined in WF4 checklist | |
| document_id | uuid | ✅ | | →documents |
| valid_from / valid_to | date | ✅/○ | expired docs flag exception on approved products | |
| verified_by / verified_at | uuid/ts | ✅ | CR confirms doc matches product | →users |

Permissions: CR CRU; SU C own (pending verification); F R; SR R (approved products); AC ✗. · Source: supplier upload. · Review: at valid_to; COAs per-lot as supplied.

## 10. product_approved_buyer_types
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| product_id | uuid | ✅ | unique (product_id, buyer_type) | →products |
| buyer_type | enum(pharmacy_503a, outsourcing_503b, hospital, physician_clinic, med_spa_medical_director, veterinary, research_org, wholesaler, other) | ✅ | must be a subset counsel approved for the classification (RC3) | |
| basis | text | ✅ | cite counsel matrix section | |
| basis_document_id | uuid | ✅ | | →documents |
| approved_by / approved_at | uuid/ts | ✅ | CR proposes, F approves | →users |
| review_date | date | ✅ | | |

Permissions: CR C; F A; SR R; SU R own; AC ✗. **Allow-list: no row = ineligible (gate G4).** · Source: counsel buyer-eligibility matrix. · Review: annual + on regulatory_update.

## 11. product_geographic_restrictions
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| product_id | uuid | ✅ | unique (product_id, state) | →products |
| state | char(2) | ✅ | US state/territory code | |
| restriction_type | enum(allowed, allowed_with_conditions, prohibited) | ✅ | **no row = prohibited (gate G3)**; `prohibited` rows document known bans | |
| conditions | text | ◐ req if allowed_with_conditions | | |
| basis / basis_document_id | text/uuid | ✅ | | →documents |
| approved_by / approved_at | uuid/ts | ✅ | CR proposes, F approves | →users |
| review_date | date | ✅ | | |

Permissions: as table 10. · Source: counsel state survey (RC1/RC3). · Review: annual + on regulatory_update.

## 12. buyer_entities
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| legal_name | text | ✅ | dedupe: unique (normalized name, state) | |
| dba | text | ○ | | |
| buyer_type | enum (same as table 10) | ✅ before outreach | qualification field (gate G1) | |
| npi_org | text | ○ | 10 digits, Luhn check; verified against NPPES | |
| state_of_formation | char(2) | ○ | | |
| website | text | ○ | | |
| status | enum(prospect_unqualified, qualified, verified, active, suspended, do_not_contact) | ✅ | `verified` requires ≥1 verified active buyer_license + attestation set for its buyer_type (WF7); `active` = has ≥1 order; do_not_contact is terminal except by F | |
| owner_id | uuid | ✅ | assigned rep | →users |
| source | text | ✅ | import batch / referral / inbound | |
| first_contact_date / first_order_date | date | ○ | derived, for funnel metrics | |
| next_review_date | date | ◐ req when verified | license-driven | |

Permissions: SR CRU (cannot set verified/do_not_contact→reversal); CR A (verified); F all; SU ✗ until introduction (then name/state via introduction record only); AC R. · Source: prospect import + qualification research. · Review: license expirations drive; entity re-verified annually.

## 13. buyer_facilities
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id | uuid | ✅ | | →buyer_entities |
| name | text | ✅ | | |
| address/city/state/zip | text | ✅ | **state feeds gate G3** | |
| facility_type | text | ○ | | |
| npi | text | ○ | NPPES check | |
| status | enum(active, inactive) | ✅ | | |

Permissions: SR CRU; CR R; F all; AC R; SU ✗. · Source: buyer-provided / public records. · Review: annual.

## 14. buyer_contacts
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id | uuid | ✅ | | →buyer_entities |
| full_name | text | ✅ | | |
| title | text | ✅ before outreach | role-relevance is a qualification field | |
| email | citext | ✅ | format + **verification status must = deliverable** before sequence enrollment (gate G1); checked against suppression_list on every send (gate G5) | |
| email_verification_status | enum(unverified, deliverable, risky, undeliverable) | ✅ | set by verification tool; risky/undeliverable never enrolled | |
| phone | text | ○ | E.164 | |
| outreach_status | enum(new, eligible, enrolled, replied, opted_out, bounced) | ✅ | opted_out is terminal (writes suppression_list) | |
| source | text | ✅ | | |
| last_verified_at | timestamptz | ◐ | email verifications expire after 90 days | |

Permissions: SR CRU (cannot un-opt-out); CR R; F all; AC ✗; SU ✗ pre-introduction. · Source: import/enrichment. · Review: email re-verified every 90 days before sends.

## 15. buyer_licenses
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id / facility_id | uuid | ✅/◐ | | →buyer_entities, →buyer_facilities |
| license_type | enum(pharmacy_permit, medical_license, dea_registration, wholesale_license, research_exemption, business_license, other) | ✅ | required set per buyer_type defined in WF7 checklist | |
| jurisdiction | text | ✅ | | |
| license_number | text | ✅ | | |
| expiration_date | date | ✅ | drives gates G1/G9 and WF17 | |
| status | enum(pending_verification, active, expiring_soon, expired, revoked) | ✅ | same downgrade-only automation rule as supplier_licenses | |
| document_id | uuid | ◐ | copy if provided | →documents |

Permissions: SR C (pending only); CR U-A via license_verifications; F all; AC ✗; SU ✗. · Source: buyer-provided + primary source. · Review: at expiration; annually minimum.

## 16. buyer_attestations
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id | uuid | ✅ | | →buyer_entities |
| attestation_type | enum(licensure, intended_use, no_patient_resale_violation, research_use_only, other) | ✅ | required set per buyer_type (counsel-defined, RC3); **supplements, never replaces, license verification** | |
| template_version | text | ✅ | counsel-approved template id | |
| signed_by_name / signed_by_title | text | ✅ | | |
| signed_at | timestamptz | ✅ | | |
| method | enum(esignature, signed_pdf) | ✅ | | |
| document_id | uuid | ✅ | executed copy | →documents |
| expires_at | date | ✅ | ≤ 12 months | |

Permissions: SR C (sends template, records return); CR A (accepts); F all; AC ✗; SU ✗. · Source: signed instrument from buyer. · Review: annual re-attestation.

## 17. license_verifications
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_license_id | uuid | ◐ | exactly one of the two FKs (XOR check) | →supplier_licenses |
| buyer_license_id | uuid | ◐ | | →buyer_licenses |
| verification_source | text | ✅ | primary-source URL (state board, NPPES, etc.) | |
| method | enum(primary_source_web, api_lookup, document_review) | ✅ | api_lookup still requires human confirmation | |
| result | enum(verified_active, expired, not_found, mismatch, disciplinary_flag) | ✅ | anything but verified_active auto-opens compliance_exception | |
| evidence_document_id | uuid | ✅ | screenshot/PDF of source **required** | →documents |
| verified_by / verified_at | uuid/ts | ✅ | must be human CR or F — **automation cannot write** | →users |
| next_verification_due | date | ✅ | min(license expiration, +12 months) | |

Permissions: CR C; F C; SR ✗; SU ✗; AC ✗. · Source: primary source only. · Review: this table *is* the review record; due dates drive tasks.

## 18. outreach_campaigns
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| name | text | ✅ | | |
| target_buyer_type | enum | ✅ | one buyer_type per campaign | |
| product_ids | uuid[] | ✅ | all must be approved; each must have buyer-type row matching target (gate G2/G4 at design time) | →products |
| template_ids | uuid[] | ✅ | all templates must be approved (WF8) | →documents |
| sending_domain / from_identity | text | ✅ | real-brand domain; postal address in footer | |
| daily_cap | int | ✅ | 1–200 | |
| status | enum(draft, pending_approval, approved, active, paused, completed) | ✅ | → approved by F **and** CR (two sign-offs); activation only from approved | |
| approved_by_founder / approved_by_compliance | uuid | ◐ req for approved | | →users |
| start_date / end_date | date | ✅/○ | | |

Permissions: SR C-U(draft); CR A; F A; SU ✗; AC ✗. · Source: internal. · Review: templates re-reviewed on any regulatory_update affecting scoped products; campaign re-approval on any template change.

## 19. outreach_messages
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| campaign_id / contact_id | uuid | ✅ | | →outreach_campaigns, →buyer_contacts |
| template_version | text | ✅ | | |
| subject / body_snapshot | text | ✅ | immutable copy of what was actually sent | |
| gate_check_result | jsonb | ✅ | pass/fail per gate at send time — written even when blocked | |
| status | enum(blocked, queued, sent, delivered, bounced, replied, opted_out) | ✅ | blocked rows retain the failing gate code | |
| scheduled_at / sent_at | timestamptz | ✅/◐ | | |
| provider_message_id | text | ◐ | from email platform | |
| reply_classification | enum(none, positive, neutral, negative, opt_out, auto_reply) | ○ | auto-suggested, human-confirmed for positive/opt_out | |

Permissions: system C; SR R; CR R; F R; SU ✗; AC ✗. Rows are immutable after send. · Source: email platform webhooks. · Review: none (immutable log).

## 20. suppression_list
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| email | citext | ◐ | lowercased; unique; either email or domain required | |
| domain | citext | ◐ | org-wide suppression | |
| contact_id | uuid | ○ | | →buyer_contacts |
| reason | enum(opt_out, hard_bounce, spam_complaint, legal_request, manual) | ✅ | | |
| source | text | ✅ | reply id / webhook / user | |
| suppressed_at | timestamptz | ✅ | | |
| permanent | bool | ✅ | default true; removal only by F with written justification, never for opt_out/legal_request | |

Permissions: system+any staff C; **nobody D** (SA only, audited, never for opt_out); all staff R. · Source: opt-outs, bounces, requests. · Review: none — permanent.

## 21. meetings
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id / contact_id | uuid | ✅ | | →buyer_entities, →buyer_contacts |
| rep_id | uuid | ✅ | | →users |
| scheduled_at | timestamptz | ✅ | | |
| held_at | timestamptz | ○ | | |
| outcome | enum(scheduled, held, no_show, cancelled) | ✅ | | |
| notes | text | ○ | **no medical advice in notes** (linter warns) | |
| opportunity_id | uuid | ○ | | →opportunities |
| booking_source | text | ✅ | calendar link id | |

Permissions: SR CRU own; F all; CR R; AC ✗; SU ✗. · Source: calendar tool webhook. · Review: n/a.

## 22. opportunities
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id | uuid | ✅ | must be status ≥ verified (gate G1 family) | →buyer_entities |
| supplier_id / product_id | uuid | ◐ req from stage intro_requested | product gates G2–G4 checked on attach | →suppliers, →products |
| stage | enum(qualified, meeting_held, intro_requested, intro_made, quote_requested, quoted, won, lost) | ✅ | won requires an order; lost requires lost_reason | |
| est_monthly_value | numeric(12,2) | ○ | | |
| owner_id | uuid | ✅ | | →users |
| expected_close | date | ○ | | |
| lost_reason | enum(price, timing, compliance_block, competitor, no_response, other) | ◐ | | |

Permissions: SR CRU own; F all; CR R; SU R **only post-introduction, blinded fields until then**; AC R (amounts only). · Source: internal. · Review: weekly pipeline review.

## 23. supplier_introductions
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| opportunity_id | uuid | ✅ | | →opportunities |
| supplier_id / buyer_entity_id | uuid | ✅ | buyer must be verified; supplier approved; product gates pass | |
| requested_by | uuid | ✅ | | →users |
| supplier_consent_at | timestamptz | ✅ before introduced | supplier agrees to receive the introduction (protects both sides) | |
| introduced_at | timestamptz | ◐ | | |
| method | enum(email, call, meeting) | ✅ | | |
| status | enum(requested, consented, introduced, declined) | ✅ | | |

Permissions: SR C; F A; SU R own + consent action; CR R; AC ✗. · Source: internal + supplier consent. · Review: n/a.

## 24. quotes
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| opportunity_id / supplier_id / buyer_entity_id | uuid | ✅ | | |
| quote_number | text | ✅ | unique | |
| line_items | jsonb | ✅ | [{product_id, qty, uom, unit_price}]; every product re-checked against gates G2–G4 | |
| currency / total | text/numeric | ✅ | total = Σ lines | |
| status | enum(requested, supplier_approved, sent_to_buyer, accepted, declined, expired) | ✅ | **→ sent_to_buyer requires supplier_approval evidence (gate G6)** | |
| supplier_approved_by_name / supplier_approval_evidence_id | text/uuid | ◐ req for supplier_approved | evidence = supplier email/signed doc | →documents |
| valid_until | date | ✅ | | |
| document_id | uuid | ◐ | the quote PDF (supplier-branded — pricing is the supplier's) | →documents |

Permissions: SR C (requested), U to sent after evidence; SU A own (approve pricing); F all; CR R; AC R. · Source: supplier pricing approval. · Review: expires at valid_until.

## 25. orders
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id / buyer_entity_id | uuid | ✅ | | |
| opportunity_id / quote_id | uuid | ○ | linked when known | |
| supplier_order_ref | text | ✅ | unique per supplier | |
| order_date | date | ✅ | | |
| status | enum(reported, confirmed, shipped, delivered, complete, cancelled) | ✅ | **→ complete only with supplier confirmation evidence (gate G8)** | |
| reported_by | uuid | ✅ | supplier user or staff entering supplier report | →users |
| currency / subtotal / total | | ✅ | total ≥ 0; = Σ line items | |
| completion_evidence_id | uuid | ◐ req for complete | supplier written confirmation | →documents |
| is_first_order | bool | ✅ | derived per buyer | |

Permissions: SU C-U own (through delivered); F A (complete, with evidence); SR R; CR R; AC R. · Source: **supplier reports only** — the agency never originates order data. · Review: monthly close reconciliation.

## 26. order_line_items
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| order_id / product_id | uuid | ✅ | product must have been approved + buyer-type + state allowed at order_date, else auto-exception (post-hoc gate audit) | →orders, →products |
| qty / uom | numeric/text | ✅ | qty > 0 | |
| unit_price / extended | numeric | ✅ | extended = qty × unit_price | |

Permissions: follows orders. · Source: supplier report. · Review: monthly close.

## 27. collected_revenue
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| order_id / supplier_id | uuid | ✅ | | |
| amount | numeric(14,2) | ✅ | > 0; Σ per order ≤ order total | |
| collected_date | date | ✅ | **buyer payment to supplier, reported by supplier** (see decision C1) | |
| evidence_document_id | uuid | ◐ | remittance/statement | →documents |
| reported_by / reported_at | uuid/ts | ✅ | | →users |

Permissions: SU C own; F/AC R; CR R; SR R. · Source: supplier remittance reports. · Review: monthly close vs. supplier statements.

## 28. compensation_agreements
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id | uuid | ✅ | | →suppliers |
| agreement_type | enum(percent_of_collected, flat_per_order, tiered_percent) | ✅ | | |
| rate_schedule | jsonb | ✅ | validated against agreement_type shape | |
| commission_basis | enum(collected_revenue) | ✅ | fixed: collections only (C1) | |
| effective_date / end_date | date | ✅/○ | no overlapping active agreements per supplier | |
| signed_date | date | ✅ | | |
| document_id | uuid | ✅ | **fully executed contract — gate G7 hard-fails without it** | →documents |
| status | enum(draft, signed_active, expired, terminated) | ✅ | signed_active set by F only | |
| payment_terms_days | int | ✅ | | |
| counsel_reviewed | bool | ✅ | RC4/RC5 — must be true before signed_active | |

Permissions: F CRUA; CR R; AC R; SU R own; SR R (rates hidden). · Source: executed contract. · Review: at renewal; annual.

## 29. commission_calculations
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| agreement_id | uuid | ✅ | **must be signed_active and cover collected_date (gate G7)** | →compensation_agreements |
| collected_revenue_id | uuid | ✅ | unique — one calc per collection | →collected_revenue |
| period | text | ✅ | YYYY-MM | |
| basis_amount / rate_applied / commission_amount | numeric | ✅ | amount = basis × rate per rate_schedule; recomputed & matched on approval | |
| calculated_by | enum(system) | ✅ | calculation itself is automated | |
| status | enum(draft, approved, invoiced, paid, disputed) | ✅ | → approved by F only (human check before invoicing supplier) | |
| approved_by / approved_at | uuid/ts | ◐ | | →users |

Permissions: system C; F A; AC R; SU R own (approved+); CR R; SR ✗. · Source: derived from collections + agreement. · Review: monthly close.

## 30. commission_payments
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id | uuid | ✅ | | →suppliers |
| amount | numeric(14,2) | ✅ | > 0 | |
| received_date | date | ✅ | | |
| method / reference | text | ✅ | bank ref | |
| applied_calculation_ids | uuid[] | ✅ | Σ applied = amount (reconciliation check) | →commission_calculations |
| reconciled | bool | ✅ | set at monthly close | |

Permissions: F C; AC RU (reconcile); SU R own; CR R; SR ✗. · Source: bank/accounting. · Review: monthly close.

## 31. reorders
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| buyer_entity_id / product_id / supplier_id | uuid | ✅ | | |
| prior_order_id | uuid | ✅ | | →orders |
| cadence_days | int | ✅ | derived from order history, editable | |
| expected_reorder_date | date | ✅ | | |
| status | enum(upcoming, reminder_sent, ordered, lapsed) | ✅ | lapsed at +30d past expected | |
| task_id | uuid | ○ | follow-up task | →tasks |

Permissions: system C-U; SR RU own accounts; F R; SU ✗; AC R. · Source: derived from orders. · Review: weekly rep review.

## 32. compliance_reviews
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| subject_type | enum(supplier, product, buyer_entity, campaign, template, agreement, process) | ✅ | | |
| subject_id | uuid | ✅ | | polymorphic |
| review_type | enum(initial, periodic, for_cause, counsel) | ✅ | | |
| reviewer_id | uuid | ✅ | role ∈ {CR, F}; counsel reviews recorded by CR with counsel doc | →users |
| checklist | jsonb | ✅ | versioned checklist with per-item pass/fail/na + note | |
| outcome | enum(approved_recommend, rejected, conditional) | ✅ | | |
| conditions | text | ◐ | | |
| reviewed_at / next_review_date | ts/date | ✅ | next_review_date drives task creation | |
| document_ids | uuid[] | ○ | supporting docs incl. counsel memos | →documents |

Permissions: CR CRU; F R+final approval on subject record; others R own-subject summaries. · Source: reviewer work product. · Review: self-scheduling via next_review_date.

## 33. compliance_exceptions
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| gate_code | enum(G1..G10, RC1..RC12, ADHOC) | ✅ | | |
| subject_type / subject_id | text/uuid | ✅ | what was blocked | |
| blocking_record_type / blocking_record_id | text/uuid | ✅ | **which record caused the block** | |
| description | text | ✅ | why blocked (human-readable) | |
| required_remedy | text | ✅ | which document/approval clears it | |
| clearable_by_role | enum(compliance, founder, founder_with_counsel) | ✅ | who may clear | |
| severity | enum(low, medium, high, critical) | ✅ | critical pages founder | |
| status | enum(open, in_progress, waived, resolved) | ✅ | waived requires F + written memo doc; G5/G10 can never be waived | |
| raised_by | enum(system, user) + user_id | ✅ | | |
| assigned_to | uuid | ✅ | | →users |
| resolved_by / resolved_at / resolution_note | | ◐ req on close | resolver role must match clearable_by_role | |

Permissions: system+all staff C; CR/F U-close per clearable_by_role; SR R; SU R own-subject; AC R. · Source: gate engine + manual. · Review: open exceptions on daily dashboard; weekly triage.

## 34. complaints
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| source | enum(buyer, supplier, third_party) | ✅ | | |
| buyer_entity_id / order_id / product_id | uuid | ○ | linked when known | |
| received_at | timestamptz | ✅ | | |
| description | text | ✅ | verbatim; no editorializing | |
| severity | enum(low, medium, high) | ✅ | | |
| is_adverse_event | bool | ✅ | true ⇒ auto-create adverse_events row + critical task | |
| forwarded_to_supplier_at | timestamptz | ✅ SLA 1 business day | **agency's only duty is prompt forwarding (RC8)** | |
| supplier_ack_at | timestamptz | ◐ | chased at +2d | |
| status | enum(open, forwarded, supplier_resolved, closed) | ✅ | closed requires supplier resolution note or F sign-off | |

Permissions: all staff C; CR U; F A close; SU R own + resolve note; AC ✗. · Source: inbound reports. · Review: open complaints daily; all complaints at monthly close.

## 35. adverse_events
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| complaint_id | uuid | ○ | | →complaints |
| product_id / order_id | uuid | ✅/○ | | |
| event_date / description | date/text | ✅ | verbatim | |
| reported_to_supplier_at | timestamptz | ✅ SLA same business day | **prohibited from automation-only: human confirms transmission** | |
| supplier_confirmation_document_id | uuid | ◐ | supplier's written acknowledgment | →documents |
| regulatory_reporting_owner | enum(supplier) | ✅ | fixed — supplier/manufacturer owns MedWatch (RC8 confirms) | |
| status | enum(open, forwarded, acknowledged, closed) | ✅ | | |

Permissions: CR/F CRU; SR C only; SU R own + acknowledge; AC ✗. · Source: complaints/reports. · Review: every open AE daily until acknowledged; quarterly summary.

## 36. recalls
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| supplier_id / product_id | uuid | ✅ | | |
| recall_class | enum(class_1, class_2, class_3, market_withdrawal, unknown) | ✅ | | |
| initiated_date | date | ✅ | | |
| source | enum(fda_enforcement_report, supplier_notice, other) | ✅ | + source URL/doc | |
| scope | text | ✅ | lots/dates | |
| affected_order_ids | uuid[] | ✅ | derived from product+scope, human-confirmed | →orders |
| buyer_notification_status | enum(supplier_notifying, agency_assisting, complete) | ✅ | notification duty is supplier's (RC9); agency assists and tracks | |
| status | enum(open, monitoring, closed) | ✅ | product auto-suspended (status=suspended) while open — suspension is automated, **un-suspension is F-only** | |
| document_id | uuid | ◐ | | →documents |

Permissions: CR/F CRU; SU C own (notice) + R; SR R; AC R. · Source: FDA enforcement reports + supplier notices. · Review: daily while open.

## 37. tasks
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| title | text | ✅ | | |
| task_type | enum(follow_up, verification_due, document_missing, review_due, reorder_reminder, exception, close_item, other) | ✅ | | |
| due_date | date | ✅ | | |
| assigned_to | uuid | ✅ | | →users |
| related_type / related_id | text/uuid | ○ | polymorphic link | |
| priority | enum(low, normal, high, critical) | ✅ | | |
| status | enum(open, in_progress, done, cancelled) | ✅ | cancellation requires note | |

Permissions: all staff CRU own/assigned; F all; SU R own-subject tasks assigned to them; AC ✗. · Source: system + users. · Review: daily queue.

## 38. documents
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| filename | text | ✅ | | |
| doc_kind | enum(license, insurance_coi, contract, counsel_memo, attestation, coa, label, sds, evidence_screenshot, quote, order_evidence, remittance, template, other) | ✅ | | |
| storage_ref | text | ✅ | provider path/URL | |
| sha256 | text | ✅ | integrity hash computed at upload | |
| uploaded_by | uuid | ✅ | | →users |
| related_type / related_id | text/uuid | ✅ | polymorphic | |
| retention_class | enum(legal_7y, operational_3y, permanent) | ✅ | compliance/counsel/audit docs = permanent | |
| effective_date / expiry_date | date | ○ | expiring docs create tasks | |

Permissions: role follows the related record; no hard delete; supersede only. · Source: uploads. · Review: at expiry_date.

## 39. audit_logs
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| occurred_at | timestamptz | ✅ | | |
| actor_type | enum(user, system, automation) | ✅ | | |
| actor_id | uuid | ◐ req if user | | →users |
| action | text | ✅ | verb.noun convention (e.g., `quote.status_change`) | |
| subject_type / subject_id | text/uuid | ✅ | | |
| before / after | jsonb | ✅ | field-level diff | |
| gate_code | text | ○ | when a gate evaluated (pass or block) | |
| context | jsonb | ○ | ip, automation run id, campaign id | |

Permissions: **append-only for everyone including SA** — no update/delete grants exist; F/CR/AC/SA R; SR R own actions; SU R own-supplier subject rows. · Source: every write path (triggers) + gate engine + automations. · Review: monthly close spot-check; quarterly full access review.

## 40. regulatory_updates
| Field | Type | Req | Validation / Notes | Rel |
|---|---|---|---|---|
| jurisdiction | text | ✅ | state or US-FED | |
| source_name / source_url | text | ✅ | FDA feed, board bulletin, counsel alert | |
| title / summary | text | ✅ | | |
| received_at | timestamptz | ✅ | | |
| affected_classifications | enum[] | ○ | from table 8 enum | |
| affected_product_ids | uuid[] | ○ | human-linked | |
| impact | enum(unreviewed, none, review_needed, action_required) | ✅ | **default unreviewed; only CR/F may classify — never automated** | |
| reviewed_by / reviewed_at | uuid/ts | ◐ req to leave unreviewed | | →users |
| linked_review_id | uuid | ◐ req if action_required | | →compliance_reviews |
| status | enum(open, closed) | ✅ | | |

Permissions: system C (feed intake); CR/F U; SR R; SU R (items affecting their products); AC ✗. · Source: monitored feeds + counsel. · Review: intake queue triaged within 2 business days.
