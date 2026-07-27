# Phase 4 — Workflows

Step tags: **[A]** automated · **[H]** human approved · **[S]** supplier controlled · **[C]** compliance controlled · **[P]** prohibited from automation (a human must perform the act itself, not merely approve it). Every [A] step writes an audit_logs row with its automation run id.

### WF1 — New supplier onboarding
1. [A] Create supplier (status=prospect) from intake form; dedupe on legal_name+state. 2. [A] Send document-request packet (WF2 kickoff); create checklist tasks. 3. [S] Supplier returns docs, licenses, insurance, facility list. 4. [C] CR runs initial compliance_review (checklist: licenses verified per WF-license steps, insurance minimums, inspections history, RC5 contract terms). 5. [P] Counsel-reviewed supplier agreement executed (e-sign; humans sign). 6. [H] Founder sets status=approved, risk_tier, next_review_date. 7. [A] Portal access provisioned for supplier users; audit-logged.

### WF2 — Supplier document collection
1. [A] Generate required-document list from facility types + product classes. 2. [A] Request + reminder emails at T+3/7/14d. 3. [S] Supplier uploads. 4. [A] Hash, file, link documents; flag expirations. 5. [C] CR verifies each document matches the record it supports (product, license, policy). 6. [A] Missing-doc exceptions auto-open at T+21d.

### WF3 — Supplier compliance review (initial & periodic)
1. [A] Task created at next_review_date−30d. 2. [C] CR re-verifies licenses (WF-verification), insurance currency, new inspections (FDA dashboard check), open complaints/AEs/recalls. 3. [C] CR records compliance_review with outcome. 4. [H] Founder confirms continued approved status or suspends. 5. [A] Status change propagates: suspension freezes new quotes/introductions for that supplier (G2 family) and notifies rep.

### WF4 — Product onboarding
1. [S] Supplier submits product (draft) with documents. 2. [A] Claims-linter runs on name/description (G10 pre-check); required-doc checklist generated. 3. [C] Classification per WF5. 4. [C] CR proposes buyer-type rows and state allow-list rows from the counsel matrix, each with basis document. 5. [H] Founder approves product + buyer-type rows + geo rows (three explicit approvals). 6. [P] If counsel_review_required: counsel memo obtained and linked before step 5 can occur. 7. [A] Product becomes offerable; audit trail complete.

### WF5 — Product classification
1. [S] Supplier states its classification position + provides basis docs. 2. [P] **Determination is made only by counsel memo or counsel-accepted attestation (RC2) — never by staff judgment, never by automation.** 3. [C] CR records the classification row citing the basis document. 4. [A] Review-date task scheduled.

### WF6 — Buyer prospect creation
1. [A] Import per `06-outreach.md` (dedupe, normalize). 2. [A] Enrichment fills firmographic + license-lookup hints. 3. [H] Rep completes qualification fields (buyer_type, title, state) — G1 blocks outreach until present. 4. [A] Email verification runs. 5. [A] Suppression screen on entry.

### WF7 — Buyer license verification
1. [A] Task generated when a buyer approaches `verified` need (product-specific campaign, quote, introduction). 2. [A] System pre-fills lookup links (NPPES, state board URLs) for the required license set per buyer_type. 3. [P] **CR performs primary-source check personally, captures evidence screenshot, records license_verifications row.** Automation may fetch and suggest; it may never set verified. 4. [C] CR sets entity status=verified when the required set passes + attestations current. 5. [A] next_verification_due tasks scheduled; downgrades at expiry are automatic (downgrade-only rule).

### WF8 — Outreach approval (campaigns & templates)
1. [H] Rep drafts campaign + templates. 2. [A] Claims-linter pre-check (G10). 3. [C] CR reviews copy against the copy rules (`06-outreach.md`), records template compliance_review. 4. [H] Founder approves campaign (second sign-off). 5. [P] First-send of any **new template** requires the founder to press send on a live test to self and confirm rendering + footer — not automatable. 6. [A] Campaign activates within caps.

### WF9 — Cold-email sequence
1. [A] Nightly eligibility sweep: G1, G5, G9 evaluated per contact; failures logged, never queued. 2. [A] Personalization merge from approved fields only (name, org, role, state, approved product category phrases). 3. [A] Sends within daily_cap and schedule; body snapshot stored. 4. [A] Bounce/complaint webhooks → suppression + status. 5. [A] Reply detection pauses sequence for that contact instantly.

### WF10 — Positive reply handling
1. [A] Classifier suggests reply class. 2. [H] Rep confirms classification (positive/neutral/negative; opt-out per WF22 is auto-honored first, human-confirmed after). 3. [H] Rep responds personally — **sequence automation never continues after any human reply**. 4. [A] Opportunity auto-created at stage=qualified; follow-up task set.

### WF11 — Meeting booking
1. [A] Booking link in rep replies; calendar webhook creates meeting row. 2. [H] Rep holds meeting; records outcome/notes (linter warns on medical-advice phrasing). 3. [A] No-show → reschedule task; held → opportunity stage update prompt.

### WF12 — Supplier introduction
1. [H] Rep requests introduction on opportunity (G1–G4, G9 evaluated). 2. [S] Supplier consents to receive the introduction (records supplier_consent_at). 3. [P] **Founder or rep makes the introduction personally** (email connecting supplier and buyer); no automated intro emails. 4. [A] Introduction recorded; supplier's portal now shows this opportunity (un-blinded).

### WF13 — Quote request
1. [H] Rep composes quote request with line items (G2–G4 per line). 2. [S] **Supplier sets/approves all pricing** and returns written approval. 3. [H] Rep attaches evidence; G6 evaluated; marks supplier_approved. 4. [H] Rep sends quote to buyer (supplier-branded). 5. [A] Expiry tracking; accept/decline updates opportunity.

### WF14 — Order confirmation
1. [S] Supplier reports order (portal or emailed report keyed in by staff, reported_by recorded). 2. [A] Line items post-hoc gate audit (exceptions on violations). 3. [S] Supplier updates shipped/delivered. 4. [S] Supplier provides completion confirmation document. 5. [H] Founder marks complete (G8). 6. [A] Reorder row seeded; opportunity → won.

### WF15 — Commission calculation
1. [S] Supplier reports collected revenue against orders. 2. [A] System computes commission per signed agreement (G7); creates draft calc rows. 3. [H] **Founder reviews and approves each period's calcs before any invoice**. 4. [A] Commission invoice generated to supplier from approved calcs. 5. [H] Founder records payments received; [A] reconciliation check that applied amounts sum.

### WF16 — Reorder reminder
1. [A] Cadence derived from order history; reorders row at expected−14d creates rep task. 2. [H] Rep makes personal follow-up (reorder outreach is 1:1, not sequenced; G1/G5/G9 still checked). 3. [A] Ordered/lapsed status tracked; lapsed feeds churn metrics.

### WF17 — License expiration (buyer or supplier)
1. [A] T−60/T−30/T−7 tasks + notices; status→expiring_soon. 2. [A] At expiry: status→expired; **all dependent actions freeze automatically** (G9): sequences pause, quotes/introductions block. 3. [S]/[H] Renewal document obtained. 4. [P] CR re-verifies per WF7 before anything unfreezes.

### WF18 — Supplier insurance expiration
1. [A] T−45/T−15 tasks; expiry opens high-severity exception and freezes new introductions/quotes for that supplier. 2. [S] Supplier provides renewed COI. 3. [C] CR verifies coverage ≥ required minimums; clears exception.

### WF19 — Regulatory status change
1. [A] Feed intake creates regulatory_updates (impact=unreviewed). 2. [C] CR triages within 2 business days; links affected products. 3. [C] If review_needed/action_required: compliance_review opened; affected product rows may be set to in_review (offer-freeze) by CR. 4. [H] Founder approves any resulting change to classifications, buyer-type rows, or geo rows (with counsel where RC2/RC3 applies). 5. [P] No automated re-approval ever.

### WF20 — Product recall
1. [A/S] Recall row from FDA feed match or supplier notice; **product auto-suspended immediately** (the one automated status change that restricts rather than grants). 2. [A] Affected orders derived; buyers with affected orders listed. 3. [S] Supplier executes its notification/recall duties (RC9); agency tracks and assists. 4. [C] CR monitors to closure. 5. [H] Founder un-suspends product only after recall closed + CR review.

### WF21 — Complaint escalation
1. [A/H] Complaint logged verbatim on receipt. 2. [P] **Forwarded to supplier within 1 business day by a human who confirms transmission** (SLA timer automated; the act and confirmation are human). 3. [A] If is_adverse_event: AE row + critical task, same-day forwarding SLA (WF-AE). 4. [S] Supplier investigates/resolves; agency records ack + resolution. 5. [H] Founder closes; unresolved at +14d escalates to founder daily list.

### WF22 — Suppression request
1. [A] Opt-out link clicks and reply keywords ("unsubscribe", "remove", "stop") suppress **immediately and automatically** — suppression is the one thing that must never wait for a human. 2. [A] All queued messages to that email/domain cancelled instantly. 3. [H] Rep confirms classification afterward (cannot reverse it). 4. [A] Ambiguous phrasing → sends pause for that contact + human review task (default stays paused).

### WF23 — Monthly financial close
1. [A] Close packet drafted: orders, collections, calcs, payments, exceptions, MRR movements. 2. [S] Supplier statements requested/received for the period. 3. [H] Founder/AC reconcile supplier statements vs. reported collections vs. commission payments; discrepancies → disputed calcs + exceptions. 4. [H] Founder approves the close; period locks (further edits require F unlock, audit-logged). 5. [A] Dashboard metrics snapshot to a monthly history record.

## Automation boundary summary

**Automation may:** create records from intake, schedule tasks/reminders, compute derived values, freeze/downgrade/suppress (restrict), send within an approved campaign to fully-gated recipients, and log.
**Automation may never:** approve, verify, classify, un-suspend, un-suppress, introduce, determine legality, mark complete, or send anything containing new/unapproved copy. Those are [H]/[C]/[P] acts by construction.
