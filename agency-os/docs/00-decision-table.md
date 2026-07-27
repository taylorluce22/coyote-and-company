# Decision Table — Build / Do Not Build / Requires Counsel

**Status of the research brief:** No pharmaceutical business brief was supplied with this task and none exists in this repository (searched all markdown and source files). The prompt's constraints are therefore treated as the controlling specification. Every place where the missing brief — or an attorney — must confirm an assumption is flagged below. **Nothing in this system or its documentation is legal advice, and no record in this system constitutes a legal conclusion.**

## 1. Contradictions and unsupported assumptions in the specification

| # | Issue | Resolution adopted (pending brief/counsel) |
|---|---|---|
| C1 | "Collected Revenue" table vs. "suppliers remain responsible for invoicing." If the agency collects buyer payments, it becomes a party to the sale and possibly a wholesale distributor. | Modeled as **supplier-reported buyer collections** (commission basis only). The agency never invoices buyers or touches product revenue. Agency's own receivable is the commission invoice to the supplier. |
| C2 | "MRR" is a subscription metric; this is a commission agency with no subscriptions. | Defined as **normalized recurring commission revenue**: trailing-3-month average commission from accounts with ≥2 orders in 120 days. Labeled a management metric, not GAAP revenue. |
| C3 | Supplier users see "their own opportunities" — but pre-introduction opportunities contain buyer identities the agency has an interest in protecting, and the buyer hasn't consented to disclosure. | Suppliers see an opportunity **only after a Supplier Introduction record exists** with supplier consent and buyer disclosure recorded. Before that, blinded. |
| C4 | "Product Geographic Restrictions" implies a deny-list. A deny-list fails open for states nobody researched. | Modeled as an **allow-list**: a product is offerable in a state only if an explicit, sourced, approved allow record exists. No record = blocked. |
| C5 | "Contact enrichment" of named individuals is personal-data processing. CCPA/CPRA covers B2B contacts; other state privacy laws vary. | Enrichment limited to business-role data; suppression honored globally; privacy notice required — text needs counsel review (RC7). |
| C6 | Cold-email platforms (Instantly-class) rely on lookalike sending domains, which is in tension with "identify the actual business." | Sending domains must be obvious variants of the real brand, with real postal address and real reply-to. No spoofed or unrelated domains. |
| C7 | 38-table schema vs. "simple enough for one founder." | Full schema is specified for the scalable stack; the MVP collapses some tables into views/linked records (mapping in `07-stack.md`) without dropping any required field. |
| C8 | "Track orders reported by suppliers" but also "marking an order complete without supplier confirmation" — orders originate from suppliers, so self-confirmation is circular. | "Reported" and "confirmed complete" are separate supplier acts with separate evidence documents; completion additionally requires supplier confirmation that the buyer took delivery. |

## 2. Build

| Item | Notes |
|---|---|
| All 38 entities in Phase 1, incl. append-only audit log | `01-data-model.md`, `db/schema.sql` |
| Role/permission system with RLS (6 roles) | Sales reps cannot approve anything legally material; suppliers see only their own records |
| The 10 compliance gates, default-deny, with structured block messages | `03-compliance-gates.md` |
| 23 workflows with per-step automation classification | `04-workflows.md` |
| Founder dashboard: scorecards, tables, alert/action queues (no decorative charts) | `05-dashboard.md` |
| Outreach system with qualification-before-send, template approval, opt-out/suppression | `06-outreach.md` |
| Commission calculation strictly from signed compensation agreements | Human approval before invoicing |
| Reorder/MRR tracking from supplier-reported orders | |
| Regulatory-update intake queue (human-reviewed) | Monitoring feeds in, humans classify impact |

## 3. Do not build

| Item | Reason |
|---|---|
| Ecommerce storefront, cart, checkout, product payments | Explicitly prohibited; would make the agency a seller |
| Any patient-facing feature: ordering, prescribing, dosing, medical advice, consumer fulfillment | Explicitly prohibited |
| Automated product-legality or classification decisions | Classification records only *cite* a counsel memo or supplier attestation; the system never generates a legal status |
| Automated license "verified" status | Automation may fetch and pre-fill; a human must confirm against primary source with evidence attached |
| Inventory, warehousing, shipping, title/possession of product | Would trigger wholesale-distributor licensing (VAWD/NABP, state WDL) and DSCSA trading-partner duties |
| Buyer invoicing or product payment processing | See C1 |
| Automated commission *payment* execution | Founder pays manually; system only calculates and reconciles |
| Custom email infrastructure, e-signature, calendaring, accounting | Buy, don't build (`07-stack.md`) |
| Auto-sending of any new outreach template | Templates require human (founder + compliance) approval before first send |
| Automated regulatory-impact conclusions | Feed items are queued for human classification only |

## 4. Requires counsel (attorney sign-off before the dependent feature is used in production)

| # | Question | Blocks |
|---|---|---|
| RC1 | Does the agency itself need state licenses (wholesale distributor, broker, or manufacturer's-representative registrations)? Several states' WDL definitions capture entities that *facilitate* drug sales without possession. State-by-state survey needed. | Any live outreach or introduction in a given state |
| RC2 | Legal status of each product category the brief contemplates (Rx, 503A/503B compounded, API, device, supplement, RUO chemical). Peptides marketed "research use only" into channels where human use is foreseeable are an active FDA/FTC enforcement area. | Product approval; every `product_regulatory_classifications` row must cite a counsel memo or supplier attestation counsel has accepted |
| RC3 | Eligible buyer-type matrix per product class (e.g., can a med-spa with a medical director buy a 503B product in state X?). | `product_approved_buyer_types` and `product_geographic_restrictions` content |
| RC4 | Percentage-commission compensation: federal Anti-Kickback Statute exposure if any product is reimbursable by a federal healthcare program; state all-payer kickback and fee-splitting laws; whether commissioned reps need any registration. | Compensation agreement templates; product mix decisions |
| RC5 | Supplier agreement and introduction/consent terms: indemnification, agency's non-responsibility for product legality, buyer-data confidentiality. | Supplier onboarding completion |
| RC6 | Outreach copy compliance beyond CAN-SPAM: state commercial-email and telemarketing laws; permissible product descriptions without implying FDA approval or legality. Counsel reviews the master template rules and the first template set. | Campaign approval |
| RC7 | Privacy notice and B2B personal-data handling (CCPA/CPRA et al.); data-processing terms with enrichment/verification vendors. | Prospect import at scale |
| RC8 | Adverse-event and complaint handling: confirm the agency's only duty is prompt forwarding to the supplier and that MedWatch/regulatory reporting stays with the supplier/manufacturer; define the forwarding SLA contractually. | Complaint workflow go-live |
| RC9 | Recall duties: confirm the agency has no independent recall obligation and define its notification-assist role in the supplier contract. | Recall workflow go-live |
| RC10 | Insurance for the agency itself (E&O/professional liability) and whether the agency should be an additional insured on supplier product-liability policies. | Supplier approval checklist content |
| RC11 | DSCSA: confirm the no-title/no-possession model keeps the agency outside "wholesale distributor"/"trading partner," and what contract language preserves that. | Business model as a whole |
| RC12 | Tax: state income/franchise nexus from in-state solicitation activity; commission revenue sourcing. (Accountant + counsel.) | Monthly close configuration |

**Operating rule encoded in the system:** every RC item is seeded as an open `compliance_exceptions` record blocking its dependent workflow. Counsel sign-off is recorded as a `documents` row linked from a `compliance_reviews` record; only then does the gate clear.
