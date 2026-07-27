# Operating Manual — One-Founder Edition

## Daily loop (~45–60 min)

1. **Today screen.** Clear Band-1 in order: critical exceptions → complaints/AE SLA timers → recalls → license expirations ≤ 7d → regulatory queue items at SLA.
2. **Approvals waiting on you.** Supplier/product/campaign approvals only after reading the CR checklist (even when you wrote it — the two recorded acts are the point). Commission calc approvals only against the supplier's collection report.
3. **Pipeline.** Reply to positive responses personally; make any consented introductions personally; chase quote evidence.
4. **Tasks due today.** Reorder follow-ups are 1:1 personal messages.

Rule of thumb: never clear an exception by editing data to make it pass. Clear it by obtaining the document or approval the remedy names. If the remedy is wrong, fix the gate, not the record.

## Weekly (~2 hrs)
- Pipeline review: stale opportunities (>21d in stage) — advance, downgrade, or close with lost_reason.
- Exception triage: everything open > 7d gets an owner and a date.
- Outreach health: bounce/complaint rates, cap utilization, suppression sync spot-check (pick 3 opted-out emails, confirm platform-side suppression).
- Verification workbench: burn down license verifications due in next 30d.

## Monthly (~half day)
- **Close (WF23):** request supplier statements → reconcile collections/calcs/payments → resolve discrepancies as disputed calcs → approve close (locks period).
- Review waived-gate register out loud to yourself: is every waiver still justified?
- Run the MVP manual test script (`08-build-plan.md` §Test plan, item 9).
- Metrics snapshot review: MRR movement, concentration flags (>40% supplier / >30% buyer means diversification is the next sales priority).

## Quarterly
- Access review (task A10): every user, role, supplier login still correct; MFA on.
- Restore-test one backup.
- Counsel check-in: RC register — anything cleared that should be re-confirmed, any new products/states re-opening RC2/RC3.
- Re-read the copy word lists against the quarter's regulatory updates.

## Incident playbooks

**Recall notice arrives (any source).** Product is already auto-suspended (A7) — verify it. Confirm affected orders list. Contact supplier same day: their notification plan, your assist role. Track daily until closed. Un-suspension only via WF20 step 5.

**Adverse event reported.** Log verbatim. Forward to supplier **today**, confirm transmission personally, record the confirmation. You do not investigate, opine, or advise the reporter medically — acknowledge receipt and state that the supplier will follow up. If the reporter is a patient/consumer, refer them to their healthcare provider and the supplier; log it; the agency has no patient-facing role.

**Opt-out complaint ("I unsubscribed and got email").** Treat as critical. Confirm suppression row exists and platform sync; find the leak (usually an unsynced platform list); document in an exception; reply with apology and confirmation. Never argue.

**Supplier reports data breach / you suspect one.** Freeze the supplier's portal access, snapshot audit logs, call counsel. Notification duties depend on facts — do not improvise.

**License found revoked (not just expired).** G9 freeze is automatic on status change — set it immediately if you learned out-of-band. For a buyer: halt everything, open critical exception, counsel if orders occurred while revoked. For a supplier: suspend supplier, notify affected buyers only per counsel guidance.

**Regulatory change hits an approved product.** CR sets product in_review (offer-freeze). Nothing resumes without the WF19 chain — no "it's probably fine."

## What you never do (standing orders to yourself)
- Never let automation approve, verify, classify, un-suspend, un-suppress, or introduce.
- Never state a product is legal, FDA-approved, or effective. Factual, sourced statements only.
- Never touch product money, product possession, or buyer invoicing.
- Never email a contact outside an approved campaign or a genuine 1:1 human reply.
- Never backdate. The audit log is the business's memory and its defense; if it isn't logged, it didn't happen — and if it's logged wrong, fix forward with a correcting entry, never by edit.
