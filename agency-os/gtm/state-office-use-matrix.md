# State Office-Use Matrix — 503B to Clinic (2026-07-28)

> **STATUS: DISPUTED RESEARCH — DO NOT ACT ON THIS ALONE.**
>
> This pass contradicts the earlier research (`docs/10-regulatory-research.md` §3/§6) on
> CA, AL, and NJ. Both passes were built from search-engine snippets, not primary text —
> direct fetching was blocked in both cases. **A second search-derived analysis is not
> proof that the first one was wrong.** The system's carve-outs remain in force until a
> human confirms against primary sources; the verification path is at the bottom of this file.
>
> The core claim here is worth understanding either way: most published "office-use
> prohibited" state lists describe **503A pharmacies**, and office-use distribution is the
> defining purpose of the **503B** category. If that conflation is what produced our CA/AL/NJ
> flags, those markets may be open — CA especially, being the largest med-spa market in the US.

## RESEARCH LIMITATION — READ FIRST

All outbound HTTPS fetching was blocked by this environment's egress policy (every `WebFetch`/`curl` to state statute, board-of-pharmacy, and law-database hosts returned proxy 403). **Every citation below is derived from search-engine result summaries and quoted snippets, not from my own reading of the primary text.** Rule language reproduced here is quoted as returned by search. For a compliance deliverable that gates outreach into regulated markets, each GREEN/YELLOW call should be confirmed against primary text or board staff before campaigning. Confidence ratings below already reflect this ceiling.

---

## (0) THE CENTRAL FINDING — REFRAME THE QUESTION

The most consequential result of this research is that **the premise behind most "restrictive state" lists is a category error.**

The widely circulated statistics — Pew's "39 states and DC prohibit compounding for sterile office stock" and GAO's "27 states authorize office use" — describe **503A pharmacies**, not 503B outsourcing facilities. Office-use distribution is the *defining purpose* of the 503B category under the DQSA. Applying 503A office-use bans to 503Bs is what produces false "prohibited" flags.

**No priority state in this set was confirmed to prohibit a clinic from purchasing office-use compounded preparations from a properly licensed 503B.** The real variables are: (a) does the 503B hold the right in-state license, (b) does the *buyer* need a license, (c) are there drug-class carve-outs.

All three states the client previously flagged as restrictive — CA, AL, NJ — appear **mis-tiered**. Details in §3.

---

## (a) STATE MATRIX

| State | Office-use purchase from 503B permitted? | Key conditions | 503B nonresident license (name) | Confidence | Source |
|---|---|---|---|---|---|
| **ARIZONA** | YES | A.R.S. §32-1901 defines "compounding" to include preparing drugs "for administration by a medical practitioner to the medical practitioner's patient and not for sale or dispensing." A.A.C. R4-23-410 expressly permits a compounded product to be "provided to a medical practitioner to administer to a patient," with labeling + written-list requirements | Regulated under drug-manufacturer framework; **Nonresident Manufacturer Permit** (A.A.C. R4-23-607) + current equivalent home-state license, FDA registration, drug/device list | HIGH on permission; MEDIUM on permit name | [R4-23-410](https://www.law.cornell.edu/regulations/arizona/Ariz-Admin-Code-SS-R4-23-410) · [R4-23-607](https://www.law.cornell.edu/regulations/arizona/Ariz-Admin-Code-SS-R4-23-607) · [§32-1901](http://az.elaws.us/ars/32-1901) |
| **TEXAS** | YES — explicit | 22 TAC §291.133 governs "compounding and dispensing of **reasonable quantities** to a practitioner's office for office use." "Office use" defined as administration by a practitioner in the office or health care facility per Tex. Occ. Code Ch. 562. Quantity must be "reasonable" | **Non-Resident (Class E/E-S) Pharmacy License** with service code 22 (503B Outsourcing Facility) and/or 48 (Compounding, Office Use); **Texas-licensed PIC required**. TX also regulates 503Bs as manufacturers via DSHS | HIGH | [22 TAC 291.133](http://txrules.elaws.us/rule/title22_chapter291_sec.291.133) · [Class E app](https://www.pharmacy.texas.gov/files_pdf/licensing/LIC-Class_E.pdf) |
| **COLORADO** | YES — explicit | 3 CCR 719-1 defines "Non-Resident 503 Outsourcing Facility" as an FDA-registered out-of-state facility "that distributes compounded drugs into the state **without a prescription order**." (Contrast: nonresident *prescription drug outlets* may ship only on patient-specific orders) | **Non-Resident 503B Outsourcing Facility registration**, CO State Board of Pharmacy; proof of active FDA 503B registration + active home-state license | HIGH | [3 CCR 719-1-5.00.00](https://www.law.cornell.edu/regulations/colorado/3-CCR-719-1-5.00.00) · [3 CCR 719-1 full](https://www.sos.state.co.us/CCR/GenerateRulePdf.do?ruleVersionId=11189&fileName=3+CCR+719-1) |
| **NEVADA** | YES — strongest express authorization found | NRS 639.268: any entity authorized to dispense CS and dangerous drugs, **including a practitioner**, may acquire drugs compounded/repackaged by an outsourcing facility **directly from the outsourcing facility without an order from another practitioner**; such drugs may be administered/dispensed to the same extent as drugs acquired otherwise. **Expressly covers controlled substances** | NV Board of Pharmacy outsourcing facility license (nonresident) | HIGH on permission; MEDIUM on license name | [NRS 639.268](https://law.justia.com/codes/nevada/chapter-639/statute-639-268/) |
| **UTAH** | YES | R156-17b-624: "A pharmacy may repackage or compound a prescription drug **for sale to a practitioner for office use**" subject to federal/state law compliance. DOPL guidance acknowledges office-use compounders must hold FDA 503B registration | Likely **Class C Pharmacy** (pharmaceutical wholesaler/distributor/manufacturer, R156-17b-615) — **exact class for 503B UNVERIFIED** | HIGH on permission; **LOW on license name** | [R156-17b-624](https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R156-17b-624) · [R156-17b-615](https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R156-17b-615) |
| **GEORGIA** | YES for non-controlled — **NO for controlled substances** | Rule 480-11-.02 bans office-use distribution of non-patient-specific preparations generally, but expressly states this "does not affect **503b outsourcing facilities' ability to provide non-patient specific compounded preparations for office use** by a practitioner." **BUT** O.C.G.A. §26-4-86: quantities limited by board rule after consultation with GA Composite Medical Board, and **"No Schedule II, III, IV, or V controlled substance … shall be eligible for such designation"** → compounded testosterone (C-III) office stock appears barred | GA Board of Pharmacy **outsourcing facility permit** (authorized July 1, 2016) | HIGH for non-controlled; **MEDIUM on reach of the CS exclusion** | [Rule 480-11-.02](https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-480-11-.02) · [O.C.G.A. 26-4-86](https://law.justia.com/codes/georgia/title-26/chapter-4/article-5/section-26-4-86/) · [GDNA office-use letter](https://gbp.georgia.gov/document/publication/office-use-compounding-letter-posted-012716/download) |
| **TENNESSEE** | YES, with unresolved conditions | T.C.A. §63-10-204 defines compounding to include preparation "for use in a licensed prescribing practitioner's office for administration to the … patient(s) **when the product is not commercially available upon receipt of an order from the prescriber**." Whether the "not commercially available" + prescriber-order conditions are applied to 503B shipments is **UNVERIFIED** | TN Board of Pharmacy **Outsourcing Facility License** (Rule 1140-09-.01) + **"sterile manufacturer" modifier** for aseptic processing; pre-license inspection | MEDIUM-HIGH | [T.C.A. 63-10-204](https://law.justia.com/codes/tennessee/title-63/chapter-10/part-2/section-63-10-204/) · [Rule 1140-09-.01](https://www.law.cornell.edu/regulations/tennessee/Tenn-Comp-R-Regs-1140-09-.01) · [TN outsourcer app](https://www.tn.gov/content/dam/tn/health/documents/Outsoucerapp(3).pdf) |
| **NORTH CAROLINA** | YES | NCBOP guidance (7/15/2014): an **"Outsourcing Only Facility"** is not engaged in "compounding" under the NC Pharmacy Practice Act and **does not need a pharmacy permit**. G.S. 106-140.1 extends federal 503B exemptions (labeling, new drug, supply chain) to compounded drugs distributed in NC by an outsourcing facility. A **"Dual Purpose Facility"** (also dispensing to individual patients) *does* need an NCBOP pharmacy permit | **NC Dept. of Agriculture & Consumer Services, Food & Drug Protection Division** registration (manufacturer/repackager, ~$1,000/yr) — *not* the Board of Pharmacy | HIGH | [NCBOP guidance](https://www.ncbop.org/downloads/GuidancePermittingOutsourcingFacilities071514.pdf) · [G.S. 106-140.1](https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_106/GS_106-140.1.html) · [NCDA licensing](https://www.ncagr.gov/divisions/food-drug-protection/drug-program/food-drug-drug-program-licensing) |
| **OHIO** | YES | ORC 4729.52 / OAC 4729:6-10-01: 503B may not sell compounded products in OH without a valid OH outsourcing facility license. 503B needs a TDDD license *only if* it sells/dispenses patient-specific drugs. **Buyer-side:** prescriber practices need a **Terminal Distributor of Dangerous Drugs (TDDD)** license if compounding drugs or distributing controlled substances; limited Cat. II/III applicants administering drugs must submit protocol/standing orders. *Note:* OAC 4729:5-8-04 restricts **nonresident 503A pharmacies** shipping non-patient-specific compounds to animal use — a 503A rule, not a 503B one | **Outsourcing Facility License** (ORC 4729.52); out-of-state license accepted only if that state's qualifications are comparable to Ohio's | HIGH on 503B; MEDIUM on TDDD triggers for med spas | [OAC 4729:6-10-01](https://codes.ohio.gov/ohio-administrative-code/rule-4729:6-10-01) · [ORC 4729.52](https://law.justia.com/codes/ohio/title-47/chapter-4729/section-4729-52/) · [TDDD prescriber guidance](https://www.pharmacy.ohio.gov/prescribertddd) |
| **MICHIGAN** | YES | Mich. Admin. Code R. 338.533 contemplates office-use labeling: *"This is a compounded drug. For office use only"* / *"Not for resale."* Heavier structural gate: **MCL 333.17748 — "To do business in this state, an outsourcing facility must be licensed as a pharmacy."** Out-of-state 503B must be FDA-registered **and inspected** before applying; **Michigan-licensed pharmacist-in-charge** required | **Michigan Pharmacy License** (not a separate outsourcing-facility license) | HIGH on license structure; MEDIUM-HIGH on office use | [MCL 333.17748](https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-333-17748) · [R. 338.533](https://law.cornell.edu/regulations/michigan/Mich-Admin-Code-R-338-533) |
| **WASHINGTON** | LIKELY YES — no prohibition located | WAC 246-945-246: outsourcing facilities FDA-registered under 21 USC 353b(d)(4)(A) located in WA **or that "distribute or sell drugs into Washington"** must be licensed as a **wholesaler**. Nonresident applicants must supply a home-jurisdiction or recognized third-party **site inspection within last 2 years**, home-state license, and list of other jurisdictional licenses. Separately, WA has active enforcement posture on compounded semaglutide/GLP-1s — relevant to med-spa weight-loss lines | **Wholesaler License**, Pharmacy Quality Assurance Commission | HIGH on license; **MEDIUM on office use (inferred from absence of prohibition, not express authorization)** | [WAC 246-945-246](https://app.leg.wa.gov/wac/default.aspx?cite=246-945-246) · [WA GLP-1 statement](https://nursing.wa.gov/news/2025/reminder-commissions-statement-compounding-semaglutide-and-glp-1s) |
| **OREGON** | YES — explicit | OAR 855-045-0210: "A **non-resident drug outlet that distributes a non-patient specific compounded drug into Oregon** must be registered with the FDA as a 503B Outsourcing Facility and must register with the Board as a manufacturer drug outlet." USP 795/797/800 compliance required | **Manufacturer Drug Outlet registration** (nonresident), OR Board of Pharmacy | HIGH | [OAR 855-045-0210](https://oregon.public.law/rules/oar_855-045-0210) · [OAR 855-045-0200](https://oregon.public.law/rules/oar_855-045-0200) |
| **NEW MEXICO** | YES | 16.19.37 NMAC: nonresident outsourcing facility distributing compounded sterile drugs into NM must be FDA-registered **and** licensed as a nonresident outsourcing facility. Board self-assessment expressly addresses facilities that "compound non-patient specific products for distribution into New Mexico" — cGMP + labeling per 16.19.37.10(D) | **Nonresident Outsourcing Facility License**, NM Board of Pharmacy | HIGH | [16.19.37 NMAC](https://www.srca.nm.gov/parts/title16/16.019.0037.html) · [NM outsourcing self-assessment](https://rld-cf.rtscustomer.com/wp-content/uploads/2024/12/Pharm-Outsourcing-Self-Assessment.pdf) |
| **IDAHO** | YES | IDAPA 24.36.01.406: compounded/sterile prepackaged product distributed **absent a patient-specific prescription** must be labeled **"office use only"** and **"not for resale"** if from an outsourcing facility — i.e., the rule presupposes the channel. IDAPA 24.36.01.703: comply with 21 USC 353b; submit adverse-event reports to Board. **Caution:** one secondary source indicates ID prohibits **503B→503A pharmacy** sales — a different channel from office use | Drug outlet license/registration as **Outsourcing Facility**; required before doing business "in or into Idaho"; inspection after issuance | HIGH on office use; MEDIUM on the 503A-channel restriction | [IDAPA 24.36.01.703](https://www.law.cornell.edu/regulations/idaho/IDAPA-24.36.01.703) · [24.36.01.406](https://regulations.justia.com/states/idaho/24/24-36-01/subchapter-e/section-24-36-01-406/) · [24.36.01.230](https://www.law.cornell.edu/regulations/idaho/IDAPA-24.36.01.230) |
| **CALIFORNIA** ⚠️ *reclassified* | YES — but hard licensure gate | Prior "restrictive" flag is **stale**. The old 72-hour-supply limit (BPC 4127.2; 16 CCR 1735.2/1751) was **superseded by SB 1193 (Hill, Ch. 484, Stats. 2016)**, which created CA outsourcing-facility licensure authorizing nonpatient-specific distribution. **Gate:** BPC 4129.2 — a nonresident outsourcing facility "shall not compound sterile … or nonsterile drug products for distribution or use into this state without an outsourcing license issued by the board." Must be **concurrently licensed** with the board if compounding for nonpatient-specific distribution into CA. **License not issued/renewed until the location is inspected by the board** | **Nonresident Outsourcing Facility License**, CA State Board of Pharmacy | HIGH | [BPC 4129.1](https://law.justia.com/codes/california/code-bpc/division-2/chapter-9/article-7-7/section-4129-1/) · [BPC 4129.2](https://codes.findlaw.com/ca/business-and-professions-code/bpc-sect-4129-2.html) · [SB 1193](https://www.leginfo.ca.gov/pub/15-16/bill/sen/sb_1151-1200/sb_1193_bill_20160829_enrolled.htm) · [CA app packet](https://www.pharmacy.ca.gov/forms/outsrc_app_pkt.pdf) |
| **ALABAMA** ⚠️ *reclassified* | UNRESOLVED — not confirmed prohibited | The only documented restriction is **narrower** than "office use prohibited": AL Board material states **"503B outsourcers may not supply medications to pharmacies for delivery to patients"** — a 503B→503A channel rule, **not** a 503B→prescriber-office rule. I could **not** locate affirmative rule text authorizing office-use sales to practitioners either. Rule 680-X-2-.23 was under amendment 2025–26; verify current text | Annual **Board of Pharmacy permit** for outsourcing facilities (Ala. Admin. Code r. 680-X-2-.23); requires an **Alabama-licensed supervising pharmacist** for the location (per 680-X-2-.12) | **MEDIUM — treat as UNVERIFIED** | [680-X-2-.23](https://regulations.justia.com/states/alabama/title-680/chapter-680-x-2/section-680-x-2-23/) · [AL 503B app](https://albop.com/oodoardu/2024/01/503B-2024-2.pdf) · [2025 amendment proposal](https://albop.com/oodoardu/2025/12/Pharmacy_Alabama_State_Board_of___Amend_Rule_680-X-2-_23_Proposal.pdf) |
| **NEW JERSEY** ⚠️ *reclassified* | YES from a 503B | N.J.A.C. 13:39-11.18: absent a patient-specific prescription, **pharmacists/technicians/interns/externs** "shall not prepare compounded sterile preparations for human use for a licensed prescriber to use in his or her practice, **except to the extent permitted by Federal law**." The federal carve-out is precisely what a 503B operates under → **the NJ ban binds 503A pharmacies, not 503Bs**. Separate NJ restrictions that *do* bite: 503B→503A pharmacy sales reportedly prohibited; **practitioner redispensing** (sending dispensed product home with the patient) prohibited | NJ Board of Pharmacy registration/permit — **exact nonresident 503B credential name UNVERIFIED** | MEDIUM-HIGH on the 503A/503B distinction; **LOW on license name** | [N.J.A.C. 13:39-11.18](https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-13-39-11-18) · [NJAC 13:39 subch. 11](https://regulations.justia.com/states/new-jersey/title-13/chapter-39/subchapter-11) |

---

## (b) GREEN / YELLOW / RED TIERING FOR BUYER-CAMPAIGN TARGETING

### 🟢 GREEN — Express authorization; campaign freely once supplier licensure is confirmed
**Nevada, Texas, Colorado, Oregon, New Mexico, Arizona, Utah, Idaho, North Carolina** (9 states)

These have statutory or regulatory language that *affirmatively contemplates* non-patient-specific distribution to practitioners. Nevada is the single best target — NRS 639.268 names practitioners explicitly, requires no third-party order, and expressly reaches controlled substances. Texas is second-best (defined "office use" term plus a dedicated rule). Colorado and Oregon define the nonresident 503B category *by* its no-prescription shipping function.

*Campaign gate for all GREEN states: confirm the specific 503B holds that state's license before any outreach.*

### 🟡 YELLOW — Permitted, but a real gate changes the pitch or the target list
| State | Why yellow | Campaign adjustment |
|---|---|---|
| **California** | Board-inspection-gated nonresident license | Only pitch CA buyers for 503Bs already holding a current CA license — verify on CA BOP license lookup first. Not a market to open speculatively |
| **Georgia** | Schedule II–V exclusion + board quantity limits | **Do not pitch compounded testosterone or any controlled office stock into GA.** Non-controlled lines (ophthalmics, IV nutrients, non-CS aesthetics) are fine |
| **Michigan** | 503B must hold a **Michigan pharmacy license** with MI-licensed PIC | Supplier-side gate. Confirm before building a MI buyer list |
| **Ohio** | Buyer may need a TDDD license | Add TDDD status to the buyer qualification script; some med spas/IV clinics will not qualify |
| **Washington** | Office-use permission inferred, not express; wholesaler license + 2-yr site inspection; active GLP-1 enforcement posture | Proceed, but avoid leading with compounded GLP-1s |
| **Tennessee** | "Not commercially available" + prescriber-order conditions of unconfirmed applicability to 503Bs | Safe for genuinely non-commercial formulations; get board clarity before pitching commercial-equivalent items |
| **New Jersey** | Office use OK via federal carve-out, but redispensing banned and 503A channel restricted | Pitch administer-on-site only. Explicitly exclude take-home dispensing from the value proposition |

### 🔴 RED / HOLD
**Alabama — HOLD, not prohibited.** I found neither a prohibition on office-use purchase nor affirmative authorization. The documented AL restriction is the 503B→pharmacy channel only. **Recommendation: downgrade from the client's prior "RED/restrictive" to "unresolved — board confirmation required."** One phone call to the AL Board of Pharmacy resolves this and may open the market.

**No priority state is confirmed to prohibit clinic purchase of office-use preparations from a properly licensed 503B.**

---

## (c) CONFLICTS, SILENCE, AND UNVERIFIED ITEMS

1. **The 503A/503B conflation is the dominant source of error in public sources.** Pew (2018) "39 states + DC prohibit sterile office stock" and GAO "27 states authorize office use" both describe 503A pharmacies. Any 50-state survey that does not state which section it is describing should be discarded for this campaign's purposes.

2. **California's 72-hour rule is stale law still circulating.** Secondary sources citing BPC 4127.2 / 16 CCR 1735.2 & 1751 for CA office-use limits describe pre-2016 law superseded by SB 1193. Reject any survey that still tiers CA as office-use-prohibited on that basis.

3. **All three prior "restrictive" flags trace to different channels.** CA = licensure gate (not a ban); AL = 503B→pharmacy channel; NJ = 503A pharmacy rule + redispensing ban. None is a clinic office-use prohibition.

4. **Georgia's controlled-substance exclusion — genuinely ambiguous, highest-stakes open item.** O.C.G.A. §26-4-86 says no Schedule II–V substance "shall be eligible for such designation." Whether "such designation" constrains what a licensed 503B may ship for office use, or only the 503A office-use designation process, cannot be resolved from available text. **Get a GA board opinion or counsel sign-off before any GA TRT campaign.** A wrong call here is exactly the failure mode the brief warns against.

5. **Tennessee's "not commercially available" condition** — unclear whether enforced against 503B office-use shipments or only 503A compounding. UNVERIFIED.

6. **Utah's exact nonresident 503B license class** — UNVERIFIED. Class C (wholesaler/distributor/manufacturer) is the likely vehicle but I could not confirm it.

7. **New Jersey's nonresident 503B credential name** — UNVERIFIED.

8. **Washington's office-use permission** — rests on absence of prohibition plus the existence of a wholesaler-licensure pathway for 503Bs shipping in. No express authorizing text located. Treat as inference.

9. **Arizona's permit name** — MEDIUM confidence. Arizona regulates 503Bs under the manufacturer framework; R4-23-607 lists several nonresident permit types without my having confirmed which one a 503B takes.

10. **Idaho / New Jersey / Mississippi 503B→503A bans** — single secondary source, MEDIUM confidence. Irrelevant to clinic office use but material if the 503B also sells to pharmacies.

---

## (d) CROSS-CUTTING FEDERAL CONSTRAINT — BELONGS IN THE CAMPAIGN SCRIPT

**The 503B wholesaling prohibition is a bigger practical risk to this client's buyer segments than any state office-use rule.**

FDCA §503B(a)(8) requires that a compounded drug "will not be sold or transferred by an entity other than the outsourcing facility that compounded such drug," while expressly *not* prohibiting "administration of a drug in a health care setting or dispensing a drug pursuant to a prescription." FDA's June 2023 draft guidance interprets "sold or transferred" to capture movements **whether or not money changes hands**, and expressly counts **clinics** among "entities other than the outsourcing facility."

Practical effect for med spas, IV therapy clinics, and TRT practices:
- ✅ Administering office stock on site to their own patients — permitted
- ❌ Sending vials/syringes home with patients — likely an impermissible transfer
- ❌ Transferring stock between commonly-owned but separately-registered locations — likely impermissible
- ❌ Any "resale" framing in marketing materials

Combined with NJ's explicit redispensing ban and Georgia's CS exclusion, **"administer on site, never resell or send home"** should be a standing qualification question in buyer outreach — it protects both the clinic and the 503B.

**Also cross-cutting:** any Schedule III product (testosterone) requires DEA registration at the receiving clinic, plus state controlled-substance registration in most states.

Sources: [FDA wholesaling draft guidance](https://www.fda.gov/media/179073/download) · [Federal Register notice](https://www.federalregister.gov/documents/2023/06/28/2023-13767/prohibition-on-wholesaling-under-section-503b-of-the-federal-food-drug-and-cosmetic-act-draft) · [Frier Levitt analysis](https://www.frierlevitt.com/articles/prohibition-of-wholesaling-by-503b-outsourcing-facilities-implications-for-health-systems-clinics-pharmacies-and-physician-offices/) · [21 USC 353b](https://uscode.house.gov/view.xhtml?req=granuleid%3AUSC-prelim-title21-section353b&num=0&edition=prelim)

---

## RECOMMENDED NEXT STEPS

1. **Re-run this with fetch access enabled.** The egress block prevented primary-source verification. Priority re-verification targets: GA §26-4-86 CS exclusion, WA express office-use authority, AL office-use status, UT and NJ license names.
2. **Resolve Alabama with one board phone call** — likely converts a RED to GREEN/YELLOW.
3. **Get GA counsel sign-off before any TRT-focused Georgia campaign.**
4. **Build a per-supplier license matrix.** Every GREEN state still requires that the specific 503B hold that state's license. The binding constraint on campaign scope is supplier licensure, not state permissiveness.

---

## ALL SOURCE URLS

**Federal/framework:** [21 USC 353b](https://uscode.house.gov/view.xhtml?req=granuleid%3AUSC-prelim-title21-section353b&num=0&edition=prelim) · [FDA wholesaling draft guidance](https://www.fda.gov/media/179073/download) · [Federal Register](https://www.federalregister.gov/documents/2023/06/28/2023-13767/prohibition-on-wholesaling-under-section-503b-of-the-federal-food-drug-and-cosmetic-act-draft) · [FDA outsourcing facility Q&A](https://www.fda.gov/drugs/human-drug-compounding/questions-and-answers-outsourcing-facility-registration) · [FDA 503A prescription requirement guidance](https://www.fda.gov/files/drugs/published/Prescription-Requirement-Under-Section-503A-of-the-Federal-Food--Drug--and-Cosmetic-Act-Guidance-for-Industry.pdf) · [FDA aligning federal/state regulation](https://www.fda.gov/media/100224/download) · [Pew state oversight](https://www.pew.org/en/research-and-analysis/reports/2018/02/state-oversight-of-drug-compounding) · [GAO-17-64](https://www.gao.gov/products/gao-17-64) · [CRS R45069](https://www.congress.gov/crs-product/R45069) · [FDLI state patchwork](https://www.fdli.org/2022/09/state-by-state-patchwork-creates-onerous-burdens-for-503b-outsourcing-facilities/) · [ProRx state licensing](https://prorxpharma.com/state-licensing-for-503b-outsourcing-facilities/) · [ProRx 2025 eGuide](https://prorxpharma.com/wp-content/uploads/2025/12/ProRX-eGuide-2025.pdf) · [Frier Levitt 503B](https://www.frierlevitt.com/articles/thinking-about-starting-a-503b-outsourcing-facility-heres-what-you-need-to-know/) · [Pharmacy Times 503B-to-503A](https://www.pharmacytimes.com/view/regulatory-considerations-regarding-the-503b-to-503a-compounding-model-for-community-pharmacies) · [APC state resources](https://a4pc.org/state)

**State sources** are listed inline in the matrix rows above.