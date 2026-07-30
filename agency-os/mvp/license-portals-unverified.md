# License Verification Portals — UNVERIFIED URL LIST

> **Every URL below was assembled from search results and NONE was loaded** — this
> container's gateway blocked all outbound requests. Treat this as a starting list to
> check, not a verified reference. Confirm each portal loads and searches the way you
> expect before it goes into the Verify workbench, and correct this file as you go.
> Boards reorganize their sites frequently.

## ⚠️ BLOCKER — THE VERIFICATION STEP OF THIS TASK COULD NOT BE PERFORMED

**No URL in this report was actually loaded.** This environment's egress proxy denied every outbound host. Confirmed via `http://127.0.0.1:41605/__agentproxy/status`, which logged `connect_rejected — "gateway answered 403 to CONNECT (policy denial)"` for every host attempted, including `npiregistry.cms.hhs.gov`, `gls.azmd.gov`, `pharmacy.az.gov`, `azdo.gov`, `azcarecheck.azdhs.gov`, and control hosts `example.com` and `en.wikipedia.org`. `/root/.ccr/README.md` §"403 / 407 from the proxy" states this is an org egress-policy denial and instructs: *"Do not retry or route around it — report the blocked host."* I did not attempt to circumvent it.

The task's explicit core requirement — *"Actually visit/fetch each portal URL to confirm it loads and is the right page"* — is therefore **unmet for 100% of URLs below**. WebSearch was the only working channel.

**Do not hand the table below to a compliance team as verified.** For primary-source verification under credentialing standards (Joint Commission/NCQA), a URL list assembled from a search index and unloaded is not evidence. Every row needs a human to open it before use. Two concrete hazards found while researching:

1. **Search summaries fabricated URLs.** The engine's prose asserted `azbn.gov/license-verification` (absent from indexed results) and asserted the *medical* board URL `nsbme.us.thentiacloud.net` for the *osteopathic* board, whose actual indexed URL is `nsbom.portalus.thentiacloud.net`. I excluded prose-only URLs and recorded only real indexed links — but this shows the failure mode.
2. **Heavy SEO-aggregator contamination.** `verificationlicense.org`, `state-medical-board.org`, `boardofnursings.org`, `medical-license-lookup.com`, `meshverify.com`, `healthguideusa.org`, `aequor.com`, `nurselicenseguide.com` ranked highly. **None are primary sources.** They are excluded below; ensure they don't leak into the final SOP.

---

## (a) CANDIDATE PORTAL TABLE — ALL ROWS UNVERIFIED, REQUIRE MANUAL CONFIRMATION

Confidence = strength of search-index corroboration only, **not** load confirmation.

| State | Board type | Candidate URL | Conf. | Search-by / Notes |
|---|---|---|---|---|
| AZ | Medical (MD) | `https://gls.azmd.gov/glsuiteweb/clients/azbom/public/WebVerificationSearch.aspx` | Med | GLSuite platform. Name/license no. Legacy stack — migration risk, verify first. |
| AZ | Osteopathic (DO) | `https://azdo.gov/do-center/license-verification` | Med | Separate DO board. Landing page; actual search tool URL not resolved. |
| AZ | Pharmacy | `https://pharmacy.az.gov/verify` → `https://azbop.igovsolution.net/online/Lookups/AZIndividual_Lookup.aspx` | Med | iGov platform. **Individual lookup only** — separate permit/site lookup for pharmacy permits not located. |
| AZ | Nursing | `https://azbn.gov/licenses-and-certifications/primary-source-verification` | Med | **Important:** RN/LPN/APRN primary source = **Nursys**, not AZBN. AZBN portal covers CNA/LNA/CMA/LHA only. For NP verification use Nursys. |
| AZ | Facility | `https://azcarecheck.azdhs.gov/` | Low | AZDHS "AZ Care Check." Med-spa coverage unconfirmed. |
| TX | Medical (MD+DO) | `https://www.tmb.texas.gov/resources/for-the-public/look-up-a-license` | High | TMB licenses both MD and DO. Name/license/city/county/specialty. |
| TX | Pharmacy | `https://www.pharmacy.texas.gov/dbsearch/default.asp` | High | Split searches: pharmacist, **pharmacy (site)**, intern, technician. Site search by license no./pharmacy name/owner/city. |
| TX | Nursing | `https://www.bon.texas.gov/licensure_verification.asp` | High | RN/LVN/APRN. |
| TX | Facility | `https://txhhs.my.site.com/TULIP/s/public-search` | Med | **TULIP** — statewide Salesforce platform; HHSC absorbed ASC licensing from DSHS. Also `/s/ltc-provider-search`. Which search covers ASC unconfirmed. |
| CO | All (Med/Pharm/Nursing) | `https://apps2.colorado.gov/dora/licensing/lookup/licenselookup.aspx` | **Low** | **Unresolved conflict** — three competing hosts indexed: `apps2.colorado.gov`, `www.colorado.gov/dora/...`, and prose-asserted `apps.colorado.gov`. Cannot determine canonical vs. redirect without loading. DORA/DPO single lookup covers all three boards. |
| CO | HPPP profiles | `https://dpo.colorado.gov/HPPP/Search` | Low | Healthcare Professions Profile Program, now folded into DPO Online Services. |
| NV | Medical (MD) | `https://nsbme.us.thentiacloud.net/webs/nsbme/register/#` | Med | Thentia platform (recent migration). |
| NV | Osteopathic (DO) | `https://nsbom.portalus.thentiacloud.net/webs/portal/register/` | Med | Separate DO board (`bom.nv.gov`). Note legacy `osteo.state.nv.us` also indexed — stale. |
| NV | Pharmacy | *not researched* | — | Gap. |
| NV | Nursing | *not researched* | — | Gap. |
| UT | All (DOPL) | `https://secure.utah.gov/llv/search/index.html` | Med | Consolidated DOPL. Last name or license no. + profession. Note `dopl.utah.gov` and `commerce.utah.gov/dopl` both indexed. |
| GA | Medical (MD+DO) | `https://gateway.medicalboard.georgia.gov/verification/search.aspx` | Med | Composite Board licenses MD **and** DO. Separate from SOS. |
| GA | Pharmacy | `https://gbp.georgia.gov/` | **Low** | **GOALS migration in flux.** Search indicates pharmacists "not licensed by SOS." Direct lookup URL not resolved. |
| GA | Nursing | — | **Low** | GOALS migration: nursing reportedly **still on legacy "My License"** while other boards moved to GOALS. No working URL isolated. |
| TN | All + facilities | `https://apps.health.tn.gov/Licensure/` | High | Single TDH portal. Board dropdown (Board of Medical Examiners = MD/DO), wildcard `*` supported. **Also does facilities** via "Licensed Health Facilities." |
| NC | Medical (MD+DO) | `https://www.ncmedboard.org/` | Low | Landing page only; deep lookup URL not isolated. |
| NC | Pharmacy | `https://portal.ncbop.org/verification/search.aspx` | High | **People** by license no./name; **facility permits** by permit no./business name/city/state. |
| NC | Nursing | `https://portal.ncbon.com/licenseverification/search.aspx` | High | Interstate verification via **Nursys only**. |
| WA | All providers + facilities | `https://fortress.wa.gov/doh/providercredentialsearch/` | High | DOH covers MD, DO, pharmacy, nursing **and facilities** in one. Landing: `https://doh.wa.gov/licenses-permits-and-certificates/provider-credential-search`. Bulk data: `data.wa.gov` dataset `qxh8-f4bd`. |
| OR | Medical (MD+DO) | `https://omb.oregon.gov/search` **or** `https://techmedweb.omb.state.or.us/search` | Med | Two hosts indexed, likely alias — **unconfirmed which is canonical.** Covers MD/DO/DPM/PA/LAc. |
| OR | Pharmacy | `https://orbop.mylicense.com/verification/` | Med | MyLicense platform. Individuals **and facilities**; board states it is the primary source. |
| OR | Nursing | `https://osbn.boardsofnursing.org/licenselookup` | Med | Nurse/NA. |
| NM | Medical | `https://nmrldlpi.my.site.com/nmmb/s/searchlicense` | **Low** | **Migration in progress** — legacy `nmmb.state.nm.us/licensing/` also live. New Salesforce (`my.site.com`) platform under RLD. Cannot confirm which is authoritative. |
| NM | Pharmacy | `https://www.rld.nm.gov/boards-and-commissions/individual-boards-and-commissions/pharmacy/pharmacy-look-up-a-license/` | Med | RLD statewide tool; select "Board of Pharmacy" under Profession. |
| NM | Nursing | `https://nmbn.boardsofnursing.org/licenselookup` | Low | Prose-asserted; weak corroboration. |
| ID | Medical / Pharmacy / Nursing | `https://dopl.idaho.gov/` (nursing: `/bon/bon-license-search/`) | Med | **Consolidated** — Idaho folded Medicine, Pharmacy, Nursing into DOPL. Per-board search paths (`/bom/`, `/bop/`, `/bon/`). A general search at `/rec/rec-license-search/` is indexed but that's Real Estate — **do not assume it's the health search.** |

**Facility/med-spa licensing — largely unresolved.** Only TX (TULIP), AZ (AZ Care Check), TN (in-portal), and WA (in-portal) produced candidates. CO, NV, UT, GA, NC, OR, NM, ID facility lookups were not researched. Separately: most states have **no med-spa-specific license**; med spas are typically regulated through the supervising physician's license and corporate-practice-of-medicine rules, so a "med spa facility lookup" may not exist as a distinct portal in most of these states. That's a substantive scoping question worth settling before building the SOP.

---

## (b) NPPES NPI REGISTRY API

**⚠️ `npiregistry.cms.hhs.gov` was blocked (403 at gateway). The API docs page could not be read and no live query was executed.** Everything below is from prior knowledge with partial search corroboration. **Run one live call before relying on it.**

**Base URL:** `https://npiregistry.cms.hhs.gov/api/`
**`version=2.1` is required** — omitting it returns an error.

| Parameter | Notes |
|---|---|
| `version` | Required. `2.1` |
| `number` | NPI number |
| `enumeration_type` | `NPI-1` individual, `NPI-2` **organization** |
| `organization_name` | Org name; wildcard `*` after ≥2 chars |
| `taxonomy_description` | Exact description or wildcard. **Search-corroborated caveat: documented as applying to Individual Providers** — for orgs, filter on returned taxonomy instead |
| `first_name`, `last_name`, `name_purpose` | Individuals; `name_purpose` = `AO`/`PROVIDER` |
| `address_purpose` | `LOCATION`, `MAILING`, `PRIMARY`, `SECONDARY` |
| `city`, `state`, `postal_code`, `country_code` | `state` = 2-letter |
| `limit` | Default 10, max 200 |
| `skip` | Max 1000 (→ ~1200 records max per query) |
| `pretty` | Formatted JSON |

**Example queries (untested):**
```
https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-2&state=AZ&taxonomy_description=Dermatology&limit=200
https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-2&organization_name=*medical+spa*&state=TX&limit=200
https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-2&taxonomy_description=Pharmacy&state=CO&limit=200&skip=200
```
Pagination: `limit`+`skip`; hard ceiling ~1200 per query — **partition by state/taxonomy** to avoid silent truncation.

**Taxonomy codes** (NUCC; codes are stable, but verify against `nucc.org` CSV):

| Specialty | Code | Conf. |
|---|---|---|
| Dermatology | `207N00000X` | High |
| Ophthalmology | `207W00000X` | High |
| Orthopaedic Surgery | `207X00000X` | High (search-corroborated) |
| Otolaryngology | `207Y00000X` | High |
| Family Medicine | `207Q00000X` | High |
| Internal Medicine | `207R00000X` | High |
| Pharmacy — Community/Retail | `3336C0003X` | **Search-corroborated** |
| Pharmacy — Specialty | `3336S0011X` | **Search-corroborated** |
| Ambulatory Surgical Center | `261QA1903X` | Med — memory only, **not corroborated** |
| Nurse Practitioner | `363L00000X` | Med — memory only, **not corroborated** |
| Clinic/Center (generic) | `261Q00000X` | Med (indexed) |

**Medical spa / aesthetics: NO dedicated NUCC taxonomy code exists.** This was the one item I could corroborate with reasonable confidence (four distinct searches, consistent negative). Med spas self-select an existing code — commonly `261Q00000X` (Clinic/Center), a physician code (`207N00000X` dermatology, `208200000X` plastic surgery), or `363L00000X` (NP). **Consequence for your compliance workflow: you cannot identify med spas in NPPES by taxonomy.** You'll need name-pattern matching on `organization_name` (`*med spa*`, `*medspa*`, `*aesthetic*`) plus manual review. NAICS `621340-13` covers medical spas but is not in NPPES.

---

## (c) STATES WHERE A WORKING LOOKUP COULD NOT BE CONFIRMED

**Formally: all 12** — nothing was loaded. Beyond that blanket failure, these have *substantive* unresolved problems that will not be fixed merely by regaining network access:

- **GEORGIA — worst.** Pharmacy and nursing lookups are mid-migration to **GOALS**, with nursing reportedly still on legacy "My License." No usable pharmacy or nursing lookup URL isolated. Needs direct research.
- **NEW MEXICO** — medical board mid-migration to Salesforce (`nmrldlpi.my.site.com`) with legacy `nmmb.state.nm.us` still live. Authoritative host unknown. Nursing URL weakly sourced.
- **COLORADO** — three competing host variants for the single DORA lookup; canonical vs. redirect undeterminable without loading.
- **NEVADA** — pharmacy and nursing not researched (ran out of viable verification path). Both DO/MD boards recently moved to Thentia.
- **NORTH CAROLINA** — medical board deep-link not isolated (landing page only).
- **OREGON** — two medical board hosts, canonical unknown.
- **IDAHO** — per-board search paths inferred, not confirmed; the one confirmed "license search" URL indexed is Real Estate, not health.
- **Facility/med-spa lookups** — unresolved for 8 of 12 states, and the underlying premise (that a med-spa facility license exists) is likely false in most.

**Recommended next step:** re-run this task in an environment with unrestricted egress, or have someone open each URL manually. I'd suggest against building the compliance SOP on this table as-is — for a primary-source verification workflow, an unverified URL that silently redirects to a stale or wrong board is worse than a known gap.