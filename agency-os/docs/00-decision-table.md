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

## 4. Regulatory navigation register (research-answered; founder-cleared)

Superseded framing: these items were originally gated on attorney sign-off. Per the founder's direction they are now navigated on documented research — full findings with citations in `10-regulatory-research.md`. Each item is cleared by the founder recording the decision with that document (or a later supplement) as basis. Status reflects the 2026-07-27 research.

| # | Question | Research answer (see §refs in 10-regulatory-research.md) | Status |
|---|---|---|---|
| RC1 | Does the agency need state wholesale/broker licenses? | **No — for the introduction model** (no title/possession, no negotiating/offering/contracting sales, supplier is seller-of-record). CA/TX/AZ/IL/FL definitions reach *negotiating* brokers, so the activity discipline in §1/§7 is the license shield; FL carved out of launch. (§1, §6) | Answered — cleared by adopting introduction model |
| RC2 | Product legal status by category | Answered per lane: non-GLP-1 503B office-use = primary; approved drugs/devices/supplements = green; **compounded GLP-1s and RUO peptides = prohibited** (active enforcement incl. against marketers). Classification rows now cite this research + supplier attestations. (§3) | Answered — prohibited lanes seeded |
| RC3 | Buyer-type eligibility matrix | 503B office-use → licensed providers for own-patient administration ("not for resale"); 503A → patient-specific only; office-use-restricted states CA/AL/NJ excluded (full state list UNVERIFIED — verify per target state before enabling it). (§3, §6) | Answered for launch lanes; per-state rows added as states open |
| RC4 | Percentage commission legality | **Lawful in cash-pay B2B** (AKS unmet without federal billing; EKRA inapplicable; AO 98-10; Sorensen/Marchetti). Requires the §5 contract terms, esp. federal-program exclusion. FL Patient Brokering Act = the one flagged state (carved out). (§2, §5) | Answered — terms adopted in agreement template |
| RC5 | Supplier agreement terms | Term sheet defined from safe-harbor factors + seller-of-record clause (§5). Template drafting remains open; attorney review of the template is the one flagged optional spend (~$2–4k). | Open — founder drafting from §5 |
| RC6 | Outreach copy rules | Answered: CAN-SPAM mechanics + no FDA-approval/equivalence/efficacy claims for compounded products; claims-linter word lists updated accordingly. (§4) | Answered — encoded in G10 linter |
| RC7 | Privacy / B2B data | CCPA applies only above thresholds ($25M or 100k CA records/yr); track CA record counts; vendor DPAs at list-buying scale. (§4.5) | Answered — threshold tracking added to monthly close |
| RC8 | Adverse-event duties | Agency duty = prompt forwarding; MedWatch reporting sits with supplier/manufacturer. Contract SLA stays. No contrary authority found. | Answered — unchanged workflow |
| RC9 | Recall duties | Supplier owns notification; agency assists/tracks. No independent agency obligation found. | Answered — unchanged workflow |
| RC10 | Agency insurance | E&O + general liability at launch; additional-insured on supplier product-liability policies remains the ask in onboarding. | Answered — in launch checklist |
| RC11 | DSCSA status | Outside "trading partner"/"wholesale distribution" with no ownership/possession and no direction of sale (FD&C §581(23)-(24), FDA trading-partner guidance). Preserved by the seller-of-record clause. (§1) | Answered — cleared by model + contract clause |
| RC12 | Tax nexus | Remote solicitation still creates income-tax nexus questions per state — accountant task at first out-of-state revenue concentration. | Open — accountant, not blocking |

**Operating rule encoded in the system:** each register item lives as a `compliance_exceptions` record clearable by the **founder**, closed by linking a `compliance_reviews` row citing `10-regulatory-research.md` (or successor research) as the basis document. Two items stay open (RC5 template drafting, RC12 accountant) — neither blocks launch. The two genuinely untested legal points on record: FL Patient Brokering Act's reach into B2B purchasing (mitigated by the FL carve-out) and state boards' reading of "introduction ≠ wholesale distribution" in CA/TX/AZ/IL (mitigated by activity discipline; a written board determination is the cheap upgrade when volume justifies it).
