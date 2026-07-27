# Phase 6 — Outreach System

Cold outreach is the highest-risk automated surface in the business. Everything below is subordinate to gates G1–G5, G9, G10 and workflows WF6–WF12, WF22.

## Components

| # | Component | Behavior |
|---|---|---|
| 1 | **Prospect import** | CSV/API import → staging table. Required columns: org name, state, buyer_type hint, contact name, title, email, source. Rows failing shape validation are rejected with reasons, never silently dropped. Import batch id stamps `source` on every created record. |
| 2 | **Deduplication** | Entity: normalized legal_name + state (fuzzy ≥ 0.92 flagged for human merge decision — auto-merge prohibited). Contact: exact email match merges; suppressed emails are marked at import, imported as suppressed, and never enrolled. |
| 3 | **Buyer qualification** | Checklist per buyer_type (WF6): buyer_type confirmed, state, contact title relevance, license hint located. G1 blocks enrollment until complete. Qualification is human work; the system only tracks field completeness. |
| 4 | **Contact enrichment** | Vendor fills firmographics + business contact data only. No consumer/personal enrichment. Vendor DPA required (RC7). Enriched fields carry `source=enrichment:<vendor>` and are eligible for personalization only after rep review. |
| 5 | **Email verification** | API verification on import and re-verification at 90d. Only `deliverable` enrolls; `risky` and `undeliverable` never send (G1). |
| 6 | **Sequence enrollment** | Nightly sweep enrolls contacts passing G1+G5+G9 into approved campaigns within daily_cap. Every enrollment decision (including refusals) is audit-logged with the gate results. |
| 7 | **Personalization** | Merge fields from an approved whitelist only: first_name, org_name, role_phrase, state, approved product-category phrase. Free-text AI personalization is **prohibited** in automated sends (unreviewable copy = G10 violation). Reps may personalize 1:1 messages, which are their own words, sent by them. |
| 8 | **Opt-out detection** | Footer link (one-click) + reply keyword scan. Fires suppression immediately (WF22) — automated, instant, unconditional. Ambiguous replies pause sends pending human review, defaulting to paused. |
| 9 | **Suppression** | Global list by email and domain. Checked at enrollment AND again at send-time (G5). Opt-outs permanent. |
| 10 | **Reply classification** | Model suggests {positive, neutral, negative, opt_out, auto_reply}; human confirms everything except opt_out (auto-honored first, reviewed after). Any reply stops the sequence for that contact permanently — resumption requires new human decision. |
| 11 | **Meeting booking** | Scheduling link in human replies; webhook → meetings row (WF11). |
| 12 | **Follow-up tasks** | Positive reply → task ≤ 1 bd. Meeting no-show → reschedule task. Quote sent → follow-up at T+3d. Reorder window → task at expected−14d. |
| 13 | **Supplier routing** | On opportunity reaching intro_requested: candidate suppliers = approved suppliers whose approved products pass G2/G3/G4 for this buyer and state. System *lists* candidates with gate results; **rep chooses; founder/rep makes the introduction personally** (WF12). Auto-routing of introductions is prohibited. |

## Outbound copy rules (enforced by claims-linter + human review; G10)

Every template and product description must satisfy all of:

1. **No medical efficacy claims.** Blocklist includes: treats, cures, heals, prevents, anti-aging, weight loss, fat loss, muscle growth, recovery, clinically proven, results, patient outcomes, safe and effective (list versioned, CR-maintained; linter flags for human review — final judgment is human).
2. **No implied FDA approval.** "FDA-approved," "FDA-cleared," "FDA-registered facility" only when a sourced record supports the exact phrase for that exact product/facility; "FDA-registered" may never be phrased to imply product approval.
3. **No unqualified legality statements.** "Legal," "compliant," "fully licensed" about products is prohibited; permitted framing is factual and sourced: "Supplier holds [license type] in [state], license #, verifiable at [board]."
4. **Identify the actual business.** Real legal/DBA name, real sender name and title, real postal address, working reply-to. Sending domains are recognizable variants of the actual brand (decision C6).
5. **Required footer:** physical postal address + functioning one-click opt-out in every message, including 1:1 sequence steps.
6. **Stop on opt-out** — immediate and automatic (WF22).
7. **Human approval for every new template and every edit** — an edited template is a new version requiring CR + F re-approval before next send (WF8). Counsel reviews the rule set and first template batch (RC6).

Volume posture: new domains warm gradually; daily_cap starts ≤ 30/day/domain; bounce rate > 3% or complaint rate > 0.1% auto-pauses the campaign and opens an exception.
