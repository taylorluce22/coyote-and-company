# Buyer Sourcing Playbook

Ready to execute the day supplier #1 signs — buyer targeting is driven by that supplier's product categories and license map, so this playbook is parameterized by specialty. Launch carve-outs apply throughout: **no FL buyers; no CA/AL/NJ for office-use compounded products.**

## 1. List sources by specialty (priority order per `supplier-targets.md` demand research)

| Specialty | Best sources | Notes |
|---|---|---|
| **Med spas / aesthetics** | Google Maps extraction (Outscraper/Apify: "med spa", "medical spa" by city) · AmSpa public directory · Yelp categories · Instagram location tags for enrichment | Most med spas have no NPI — Maps extraction is the primary source. Qualification must confirm a medical director (their sites usually name one) — that's what makes them an eligible buyer type |
| **IV hydration clinics** | Google Maps ("IV therapy", "IV hydration", "IV bar") · franchise directories (chains publish locations) | Same no-NPI pattern. Compliance-literate pitch lands well here (NAD+/glutathione office-stock issues are their headache) |
| **Men's health / TRT clinics** | Google Maps ("men's health clinic", "TRT clinic", "low T") · franchise location pages (e.g., Gameday) · NPPES | Franchise HQs can be one deal for many locations — flag chains separately |
| **Physician clinics (derm, ophtho, ortho, ENT)** | **NPPES NPI Registry (free API)** — filter by taxonomy code + state; org records include address/phone | The workhorse for licensed-provider specialties. Taxonomy examples: 207N00000X dermatology, 207W00000X ophthalmology, 207X00000X ortho, 207Y00000X ENT |
| **503A pharmacies** | NPPES (taxonomy 3336C0003X community pharmacy; 3336S0011X specialty) · state board license rosters (many boards publish downloadable license lists) | Board rosters double as the license-verification source — one pull, two uses |
| **ASCs** | NPPES (261QA1903X) · state ASC license lists | For ophtho/ortho supplier categories |

## 2. Contact discovery & enrichment

1. Org list from the sources above → dedupe (normalized name + state, per WF6).
2. Decision-maker discovery: practice website team pages → owner/office manager/practice administrator; LinkedIn for title confirmation. For med spas: owner or medical director. For pharmacies: pharmacist-in-charge/owner (state board rosters name the PIC).
3. Email discovery: published addresses first; then a finder tool (Hunter/Apollo-class) with a signed DPA; **every address through MillionVerifier before it touches the CRM** (import spec below). Track CA-resident record counts at import (RC7 threshold watch).
4. Phone numbers: keep for manual calls only (no automated calling/texting — red line).

## 3. Import spec (matches `mvp/csv/` + `base-setup.md` exactly)

Buyers: Name, DBA, Buyer Type, State, Website, Status=Prospect, Owner=Founder, Source=`import:{batch-id}`.
Contacts: Name, Title, Email, Email Status (from verifier), Outreach Status=New, Source=`import:{batch-id}`.
Batch id convention: `{specialty}-{state}-{yyyymm}` (e.g., `medspa-AZ-202608`). Rejected rows land in a `rejects-{batch-id}.csv` with reasons — never silently dropped.

## 4. Qualification checklist per buyer type (G1 fields before any enrollment)

| Buyer type | Required before Eligible | Required before Verified (product campaigns / introductions) |
|---|---|---|
| Med spa | Buyer Type set · state · contact title · deliverable email · **medical director identified** | Medical director's license primary-source verified · intended-use attestation signed |
| Physician clinic | Buyer Type · state · title · deliverable email | Practice owner/physician license verified (state medical board) |
| 503A pharmacy | Buyer Type · state · title · deliverable email | Pharmacy permit verified (state board of pharmacy) |
| IV clinic | Same as med spa | Medical director/NP license verified per state supervision rules |

## 5. License-verification cheat sheet — launch states

Primary-source portals (the Verify workbench pre-fills these URLs by state + license type):

| State | Medical board lookup | Pharmacy board lookup |
|---|---|---|
| AZ | azmd.gov (MD) / azdo.gov (DO) verification | pharmacy.az.gov license verification |
| TX | Texas Medical Board lookup (tmb.state.tx.us) | pharmacy.texas.gov license search |
| CO | DORA license lookup (apps2.colorado.gov/dora/licensing) | same DORA portal |
| NV | Nevada State Board of Medical Examiners lookup | bop.nv.gov verification |
| UT | DOPL verify (secure.utah.gov/llv) | same DOPL portal |
| WA | DOH provider credential search | same DOH portal |
| OR | OMB verification (omb.oregon.gov) | pharmacy.oregon.gov |
| NM | NM Medical Board lookup | nm pharmacy board (rld.nm.gov) |
| ID | Idaho Board of Medicine lookup | Idaho BOP (dopl.idaho.gov) |
| Nationwide | NPPES NPI Registry API (npiregistry.cms.hhs.gov) — org existence + taxonomy cross-check | — |

(Verify each URL at first use and correct in this file — boards reorganize their sites often. Evidence = dated screenshot/PDF to Drive, link pasted in the credential record. The verification click itself stays human — it's the product.)

## 6. Sequencing plan for supplier #1

Week 1 after signing: pull the supplier's license map → pick the 3 best states (license coverage × specialty demand × no carve-out) → build `{specialty}-{state}` batches of 200–400 orgs each → enrich + verify emails → founder qualification pass (batch, ~1–2 hrs per 100) → enroll the qualified into the buyer campaign (B1–B4 templates) under the nightly gate sweep. Target: first qualified meetings within 3 weeks of supplier signature; introductions same week as meetings.
