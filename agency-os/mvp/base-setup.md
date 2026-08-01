# Airtable Base Setup — "Agency OS" MVP

Build order: create tables by importing the CSVs in `csv/` (each CSV's headers become fields), then apply the field-type conversions below (imports arrive as text), then wire linked-record fields, then build the views and interfaces. Total setup: ~2–3 hours. Field names must stay exactly as written — every Make scenario in `automations.md` references them by name.

## Conventions

- Single-select options are listed in order; create them verbatim (automations match on exact strings).
- `→Table` = linked record field. Wire links after all tables exist.
- Fields marked ⚙ are written only by Make automations — never edit by hand (edits get overwritten and break the audit trail).
- Every table gets Airtable's built-in Created time + Last modified time fields enabled.

## Tables

### 1. Suppliers
Name (primary) · DBA · Status (single select: Prospect, In Review, Approved, Suspended, Terminated) · Tier (single select: Tier 1, Tier 2, Watch, Excluded) · State · Website (URL) · Product Focus (long text) · Pitch Angle (long text) · Regulatory Flags (long text) · Source · Risk Tier (single select: Low, Medium, High) · Approved By · Approved At (date) · Next Review Date (date) · Notes (long text) · Credentials (→Supplier Credentials) · Products (→Products) · Agreements (→Agreements) · Opportunities (→Opportunities)

### 2. Supplier Credentials
Credential (primary, formula: `Supplier & " – " & Subtype & " – " & Jurisdiction`) · Supplier (→Suppliers) · Type (single select: License, Insurance, Inspection) · Subtype · Jurisdiction · Number (text) · Expiration Date (date) · Status (single select: Pending Verification, Active, Expiring Soon, Expired, Revoked) ⚙(downgrades only) · Verified By · Verified At (date) · Evidence Link (URL — Drive) · Next Verification Due (date)

### 3. Products
Name (primary) · Supplier (→Suppliers) · Category (single select: 503B Office-Use Sterile, 503B Non-Sterile, Device, Supplement, Other) · Description (long text) · Status (single select: Draft, In Review, Approved, Suspended, Discontinued) · Classification (single select: Compounded 503B, Compounded 503A, OTC, Device, Supplement, Other) · Classification Basis (URL — memo/attestation) · Approved Buyer Types (multi select: 503A Pharmacy, Hospital, Physician Clinic, Med Spa w/ Medical Director, Veterinary, Research Org) · Allowed States (multi select: state codes — add as opened; **no CA/AL/NJ for office-use compounds, no FL at launch**) · Approved By · Approved At (date) · Next Review Date (date) · Source

### 4. Buyers
Name (primary) · DBA · Buyer Type (single select: 503A Pharmacy, Hospital, Physician Clinic, Med Spa w/ Medical Director, Veterinary, Research Org) · State · Website (URL) · Status (single select: Prospect, Qualified, Verified, Active, Suspended, Do Not Contact) · Owner · Source · First Contact (date) · First Order (date) · Next Review Date (date) · Contacts (→Contacts) · Credentials (→Buyer Credentials) · Opportunities (→Opportunities)

### 5. Contacts
Name (primary) · Buyer (→Buyers) · Title · Email (email) · Email Status (single select: Unverified, Deliverable, Risky, Undeliverable) ⚙ · Phone · Outreach Status (single select: New, Eligible, Enrolled, Replied, Opted Out, Bounced) ⚙(Opted Out/Bounced set by M2 only; never manually revert) · Source · Last Verified (date) ⚙

### 6. Buyer Credentials
Credential (primary formula as table 2) · Buyer (→Buyers) · Type (single select: License, Attestation) · Subtype · Jurisdiction · Number · Expiration Date (date) · Status (same options as table 2) ⚙(downgrades only) · Verified By · Verified At (date) · Evidence Link (URL) · Next Verification Due (date)

### 7. Campaigns
Name (primary) · Audience (single select: Supplier Recruitment, Buyer Outreach) · Target Buyer Type (single select, as table 4; blank for supplier recruitment) · Products (→Products) · Template Version · Status (single select: Draft, Pending Approval, Approved, Active, Paused, Completed) · Founder Approved (checkbox) · Founder Approved At (date) · Compliance Reviewed (checkbox) · Compliance Reviewed At (date) · Sending Domain · Daily Cap (number) · Instantly Campaign ID ⚙ · Start Date (date)

### 8. Messages ⚙ (entire table Make-written; read-only log)
Message (primary formula: `Contact & " – " & Sent At`) · Campaign (→Campaigns) · Contact (→Contacts) · Subject · Body Snapshot (long text) · Gate Result (long text) · Status (single select: Blocked, Queued, Sent, Delivered, Bounced, Replied, Opted Out) · Sent At (date+time) · Provider ID · Reply Class (single select: None, Positive, Neutral, Negative, Opt Out, Auto Reply)

### 9. Suppression ⚙ (Make-written; rows are never deleted)
Email (primary) · Domain · Reason (single select: Opt Out, Hard Bounce, Spam Complaint, Legal Request, Manual) · Source · Date (date) · Permanent (checkbox, default checked)

### 10. Opportunities
Name (primary formula: `Buyer & " × " & Supplier`) · Buyer (→Buyers) · Supplier (→Suppliers) · Product (→Products) · Stage (single select: Qualified, Meeting Held, Intro Requested, Supplier Consented, Introduced, Quote Reported, Won, Lost) · Est Monthly Value (currency) · Owner · Supplier Consent At (date) · Introduced At (date) · Lost Reason (single select: Price, Timing, Compliance Block, Competitor, No Response, Other) · Next Step · Next Step Date (date) · Quotes (→Quotes) · Orders (→Orders)

### 11. Quotes (supplier-reported)
Quote Ref (primary) · Opportunity (→Opportunities) · Supplier (→Suppliers) · Buyer (→Buyers) · Status (single select: Reported, Accepted, Declined, Expired) · Total (currency) · Valid Until (date) · Reported At (date) · Intro Check (formula: `IF(Opportunity = BLANK(), "⚠ NO LINKED INTRO", "OK")`)

### 12. Orders (supplier-reported)
Order Ref (primary) · Supplier (→Suppliers) · Buyer (→Buyers) · Opportunity (→Opportunities) · Order Date (date) · Status (single select: Reported, Shipped, Delivered, Complete, Cancelled) · Total (currency) · First Order (checkbox) ⚙ · Completion Evidence (URL) · Reported At (date) · Collections (→Collections)

### 13. Collections (supplier-reported)
Collection (primary formula: `Order & " – " & Collected Date`) · Order (→Orders) · Supplier (→Suppliers) · Amount (currency) · Collected Date (date) · Evidence Link (URL) · Reported At (date)

### 14. Agreements
Agreement (primary formula: `Supplier & " – " & Effective`) · Supplier (→Suppliers) · Type (single select: Meeting+Commission [standard], Commission Only, Retainer+Meeting+Commission [variant A]) · Retainer (currency) · Meeting Fee (currency) · Commission Pct (percent) · Effective (date) · End (date) · Signed Date (date) · Contract Link (URL) · Status (single select: Draft, Signed Active, Expired, Terminated) · Federal Exclusion Clause (checkbox — **must be checked before Signed Active; M8 refuses to calculate without it**) · Payment Terms Days (number)

### 15. Commissions ⚙ (M8-written; founder approves)
Line (primary formula: `Period & " – " & Supplier & " – " & Type`) · Period (text YYYY-MM) · Agreement (→Agreements) · Collection (→Collections) · Supplier (→Suppliers) · Type (single select: Commission, Retainer, Meeting Fee) · Basis (currency) · Rate (percent) · Amount (currency) · Status (single select: Draft, Approved, Invoiced, Paid, Disputed) · Approved At (date)

### 16. Reorders ⚙ (M5-written)
Reorder (primary formula: `Buyer & " – " & Product`) · Buyer (→Buyers) · Product (→Products) · Supplier (→Suppliers) · Prior Order (→Orders) · Cadence Days (number) · Expected Date (date) · Status (single select: Upcoming, Reminder Sent, Ordered, Lapsed)

### 17. Exceptions
Exception (primary formula: `Code & " – " & Subject`) · Code · Subject · Blocking Record · Description (long text) · Remedy (long text) · Clearable By (single select: Founder, Compliance, Founder w/ New Research) · Severity (single select: Low, Medium, High, Critical) · Status (single select: Open, In Progress, Waived, Resolved) · Assigned · Resolved At (date) · Resolution Note (long text — required to resolve; M10 reverts resolutions without one)

### 18. Issues (complaints / adverse events / recalls)
Issue (primary formula: `Type & " – " & Received`) · Type (single select: Complaint, Adverse Event, Recall) · Supplier (→Suppliers) · Buyer (→Buyers) · Product (→Products) · Received (date) · Description (long text — verbatim) · Severity (single select: Low, Medium, High, Critical) · Forwarded to Supplier At (date+time — SLA: complaint 1 business day, AE same day) · Supplier Ack At (date) · Status (single select: Open, Forwarded, Supplier Resolved, Closed)

### 19. Tasks
Title (primary) · Type (single select: Follow Up, Verification Due, Document Missing, Review Due, Reorder Reminder, Exception, Close Item, Reply Triage, Other) · Due (date) · Priority (single select: Low, Normal, High, Critical) · Status (single select: Open, In Progress, Done, Cancelled) · Related (text) · Notes (long text)

### 20. Audit Log ⚙ (Make-written, append-only; never edit or delete)
Entry (primary formula: `Timestamp & " " & Action`) · Timestamp (date+time) · Actor (single select: Founder, Make Automation, Instantly Webhook, Form) · Action · Subject · Detail (long text)

### 21. Regulatory Updates
Title (primary) · Jurisdiction · Source (URL) · Summary (long text) · Received (date) ⚙ · Impact (single select: Unreviewed, None, Review Needed, Action Required) · Reviewed At (date) · Status (single select: Open, Closed)

## Key views (automations read these — names must match)

| Table | View | Filter |
|---|---|---|
| Contacts | **Enroll Queue** | Outreach Status = Eligible AND Email Status = Deliverable AND Buyer.Status is Qualified/Verified AND Buyer.Status ≠ Do Not Contact |
| Contacts | **Reply Triage** | Outreach Status = Replied AND (open Reply Triage task exists) |
| Supplier Credentials + Buyer Credentials | **Expiring 60d** | Expiration Date ≤ 60 days from today AND Status = Active |
| Campaigns | **Ready to Activate** | Status = Approved AND Founder Approved AND Compliance Reviewed |
| Commissions | **Awaiting Approval** | Status = Draft |
| Exceptions | **Open by Severity** | Status = Open or In Progress, sort Severity desc, then age |
| Quotes | **Integrity Flags** | Intro Check = "⚠ NO LINKED INTRO" |
| Reorders | **Due Soon** | Expected Date ≤ 14 days from today AND Status = Upcoming |
| Issues | **SLA Watch** | Status = Open AND Forwarded to Supplier At is empty |

## Interfaces (Airtable Interface Designer)

1. **Today** (founder cockpit): Open exceptions by severity · SLA Watch · approvals waiting (Campaigns pending, Commissions awaiting) · Reply Triage · today's Tasks. This is the one screen the daily loop runs from.
2. **Approve** (the one-click surface): record review panels with the approval checkboxes for Campaigns, Products, Suppliers, Commissions. Clicking the checkbox is the human act; M3 validates and executes everything downstream.
3. **Pipeline**: Opportunities by Stage (kanban) with intro-consent and gate status visible.
4. **Money**: Commissions by period, Collections, aging.
5. **Verify** (license workbench): Buyer/Supplier Credentials Pending Verification, with lookup-URL field and evidence-link field side by side.

## Import order (respects link dependencies)

1. Suppliers → 2. Products → 3. Buyers → 4. Contacts → 5. Supplier Credentials, Buyer Credentials → 6. Campaigns → 7. Agreements → 8. Opportunities → 9. Quotes, Orders, Collections → 10. everything else. CSVs ship with real seed data where we have it (supplier targets, RC exceptions, launch tasks) and one `EXAMPLE — delete me` row elsewhere to show format.
