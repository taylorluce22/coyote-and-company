# Lead-Gen Permit System — 2026

Recreated in-repo from the working spec (the original on-device draft of this
doc was never pushed; this version is the canonical one going forward).

## GOAL

A client-isolated Farmhand lead-gen module that finds Arizona homes with a
solar PV permit but **no** battery/energy-storage permit, enriches to
owner + phone, and feeds a compliance-gated **manual** call queue — dialing
shipped **OFF**. Lists are drafts for Taylor's review.

Four idempotent, incremental stages:

| Stage | What it does |
| --- | --- |
| **INGEST** | Per-jurisdiction adapters pull permit rows into normalized `PermitRecord`s |
| **FILTER** | Classify descriptions + per-parcel set-difference → target parcels |
| **ENRICH** | Parcel → owner (Maricopa Assessor) → phone (pluggable append) |
| **COMPLY** | Hard gate; the system is structurally unable to dial until it passes |

## INGEST — P0: Mesa (live-verified 2026-08-10)

- Socrata SODA API, dataset `dzpk-hxfb`, base
  `https://data.mesaaz.gov/resource/dzpk-hxfb.json`, supports `$where` SoQL.
- APN field: `parcel_number`. Free text: `description_of_work` — literal
  strings like `8.40 KW DC PV SOLAR`, `TESLA POWERWALL3`, `B.E.S.S.`.
- Verified counts: `description_of_work LIKE %SOLAR%` = 1422 rows,
  `LIKE %BATTERY%` = 1649 rows.
- Optional `MESA_SOCRATA_APP_TOKEN` env for higher rate limits.
- P1 adapters (queued): Tempe, Scottsdale.

## FILTER

- SOLAR keywords: `PV`, `PHOTOVOLTAIC`, `SOLAR` — excluding solar
  water/pool-heat scopes.
- BATTERY keywords: `BATTERY`, `POWERWALL`, `PW3`, `ENERGY STORAGE`, `ESS`
  (word-bounded — must not match ADDRESS), `B.E.S.S`, `kWh`.
- Set-difference is **per property, keyed by APN** (`parcel_number`).
- **Critical false-positive rule:** a single combined permit like
  `PV SOLAR ... WITH BATTERY` means that parcel HAS a battery — battery
  keywords are scanned **inside** solar permit descriptions, not just in
  separate battery permits.
- Recency window parameterized: solar permit ~6 months–5 years old is the
  prime retrofit target (both bounds configurable; undated permits kept and
  flagged `recency: "unknown"`).
- Output: CSV / queue of target parcels.

## ENRICH

- Join APN → Maricopa Assessor API (free token):
  `/parcel/{apn}/owner-details` and `/search/property/?q=` for owner +
  mailing address.
- Pluggable phone-append interface (Datazapp first) that **must** return a
  wireless/landline line-type flag.
- Per-field provenance stored (source + fetch date). Never fabricate a
  number — no source, no value.

## COMPLY — first-class HARD GATE

The system must be structurally unable to dial until **all** of:

- (a) FTC **SAN** on file;
- (b) **AZ telephonic-seller registration status recorded** — the
  ROC-licensed-installer path is confirmed, so this is the free limited
  registration under **A.R.S. 44-1272.01** (build the flag, don't block on
  it). **Recording it is not permission to call — see below;**
- (c) **wireless suppression** active.

### Registration is not exemption — A.R.S. 44-1273

**A.R.S. 44-1273** lists the exempt sellers and then carves out two sections
by name:

> "The following sellers are not required to register and, **except for
> section 44-1278, subsection B and section 44-1282**, are exempt from this
> article."

44-1278(B) is the calling-**conduct** section. So the ROC path and the free
limited registration remove the **registration** requirement and nothing
else: every calling restriction still binds. Nor does working through an
agent insulate anyone — 44-1278(B) binds "any seller or solicitor or anyone
acting on their behalf."

The `az_registration` flag in the gate therefore means **"status recorded,"
never "exemption obtained,"** and no check in the gate may relax because of
it.

### Wireless: the binding constraint is federal

**A.R.S. 44-1278(B)(3)** bars an unsolicited telephone sales call to any
**"mobile or telephone paging device"** — pager-era drafting, with no
Arizona case law and no AG opinion construing it. That ambiguity is a reason
to stay conservative, not a reason to feel covered.

The constraint that actually binds is **47 CFR 64.1200(e)**, which extends
the federal Do-Not-Call rules to **wireless** numbers with **no autodialer
element** — manual dialing does not help. Private right of action at **$500
per call, $1,500 if willful**, and the **Ninth Circuit** (binding in
Arizona) held in **Chennette v. Porch.com** that a cell number on the
registry is **presumptively residential**.

Consequence, enforced in `leadDialVerdict`: **DNC scrubbing is mandatory for
wireless as well as landline.** The scrub check runs *before* the line-type
check, so a wireless number is never blocked merely "because suppression is
on" — relaxing suppression must not be able to expose an unscrubbed cell.

Also enforced:

- **DNC scrub** re-run on a **31-day-max** clock, for **every line type**;
  stale numbers blocked.
- Wireless-flagged numbers additionally suppressed from the dial queue by
  default (config flag, default **ON**).
- **Internal do-not-call list** honored instantly, retained **10 years**.
- **Call-window guard** 8am–9pm at the **called party's location by
  address** (not area code); default window 9am–8pm.
- **MANUAL click-to-dial only**, one human-initiated call at a time. NO
  predictive/power dialer, NO prerecorded or AI voice, NO ringless
  voicemail, NO cold SMS.
- Auto-generated **compliance log** (call log, scrub receipts + SAN,
  opt-outs, vendor licenses) retained **5+ years**.

Ship state: list-building + compliance-armed with dialing **OFF**
(server-side `PERMITS_DIALING_ENABLED` env, absent by default; the dial
queue never returns phone numbers unless the env is set AND the gate
passes).

## Channels — audience upload is OFF the table

**Google Customer Match: prohibited for this list.** Google's policy permits
only customer data "collected in the first-party context… where customers
shared their information directly with you." Permit and assessor records are
public records, not first-party data — nobody on this list gave us anything.
Google separately prohibits ad creative implying knowledge of personally
identifiable information, which a "we see you have solar and no battery"
creative plainly does.

**Meta: unverified, do not upload.** Meta's customer-list terms are
robots-blocked, so nobody has actually read them. Unverified is not
permission.

**The compliant pattern, and it is the roadmap item:** mail drives to a
landing page; Pixel/Tag audiences are then built from **website visitors**,
which is first-party by definition and matches at device level rather than
by name. The mailing address now on every enriched lead is what makes that
buildable.

No audience-upload feature exists in this codebase, and none may be added.

## Data scope — these sources start in 2019

Buckeye and Peoria both begin in **2019**, verified: Buckeye has zero
photovoltaic permits finalized before 2019-01-01, one permit of any type
applied in 2018, and zero in 2016–2017. That is an **EnerGov system
cutover**, not a filter artifact.

So the 2-to-20-year retrofit window can only ever return 2019-onward from
these sources. Each adapter records `historyStartsYear`, and **no export or
summary may imply twenty years of coverage.** Pre-2019 history is a
records-request item, not a code item.

## Client isolation

Every store key is namespaced per Farmhand client
(`fh:<clientId>:permits:*`) using the same sanitizer discipline as the
memory layer — never collapse clients into a single bucket, never reuse the
single-tenant `fh:default` lead-store namespace.

## Build order

1. Mesa adapter + set-difference + CSV, proven end-to-end ✅
2. Maricopa enrichment ✅
3. Phone-append interface ✅
4. COMPLY gate ✅
5. P1 adapters: Tempe, Scottsdale (queued)

## Environment variables

| Var | Purpose |
| --- | --- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | store (Upstash/Vercel-KV, already used by leadStore) |
| `MESA_SOCRATA_APP_TOKEN` | optional, higher Socrata rate limits |
| `MARICOPA_ASSESSOR_TOKEN` | free assessor API token (contact form, subject "API Token/Question") |
| `DATAZAPP_API_KEY` (+ optional `DATAZAPP_API_URL`) | phone append |
| `PERMITS_DIALING_ENABLED` | **ships absent = dialing OFF.** Setting it to `true` is the deliberate act that allows the dial queue to return unmasked numbers — and only when the gate is also armed |
| `ANTHROPIC_API_KEY` | optional. Absent = the LLM classification stage is inert and the deterministic rules run alone |
| `ANTHROPIC_MODEL` | optional override; defaults to `claude-opus-5` |

## STATUS

_Updated as work lands. Timezone: America/Phoenix._

- **2026-08-10 — Stage 1 landed.** `farmhand/lib/permits/`: types,
  keyword classifier (word-bounded ESS/PW3/kWh patterns, thermal-solar
  exclusion, combined-permit rule), per-APN set-difference with
  parameterized recency window, CSV output, Mesa Socrata adapter
  (coarse SoQL over-fetch + local classification, paginated, injectable
  fetch). Proof: `npm run permits:smoke` (in `farmhand/`) runs raw
  fixture rows through the adapter's own row-mapper → classifier →
  set-difference → CSV; 15/15 checks pass, including the combined-permit
  exclusion and the ESS/ADDRESS word-boundary guard. `--live` flag runs
  the same pipeline against the real Socrata endpoint (blocked from this
  build container's egress policy; run from Vercel or a dev machine).
  Note: Mesa permit-number/address/issue-date field names are not yet
  live-verified — adapter tries documented candidate lists and degrades
  to `recency: "unknown"`; verify on first live run and promote into
  `VERIFIED_FIELDS` in `adapters/mesa.ts`.
- **2026-08-10 — Stage 2 landed.** Client-scoped KV store
  (`fh:<client>:permits:*`, memory-layer sanitizer, idempotent upserts)
  + `/api/permits`: state summary, CSV download, `ingest` / `filter`
  actions, and a stateless `preview` action (live fetch → filter → CSV,
  no KV) for proving adapters from a deployed environment.
- **2026-08-10 — Stage 3 landed.** ENRICH: Maricopa assessor client
  (`/parcel/{apn}/owner-details` with `/search/property/` fallback,
  tolerant response-key scan — tighten against a live response on first
  run), owner-occupied heuristic, and the `PhoneAppendProvider` contract
  (line-type flag mandatory; vendor miss ⇒ null; per-field provenance).
  Datazapp wired as first provider — **verify its request/response shape
  against current Datazapp docs before the first paid run.** Manual
  numbers enter via `setPhone` with source `"manual"`.
- **2026-08-10 — Stage 4 landed.** COMPLY hard gate + manual call queue +
  append-only compliance log. Structural no-dial guarantee: the comply
  route's dial-queue payload is the only place an unmasked number ever
  leaves the server, and it requires gate-armed AND
  `PERMITS_DIALING_ENABLED=true` (absent in every environment). Smoke
  script proves 15 gate/verdict cases: fresh state not armed; armed but
  env-off can't dial; stale scrub / suppression-off / missing SAN /
  missing AZ registration each disarm; wireless + unknown line types
  suppressed; DNC-listed, unscrubbed, internal-DNC, and opted-out numbers
  blocked; call window follows the Phoenix clock.
- **2026-08-10 — Stage 5 landed.** `Permit Leads` screen in Farmhand
  (Targets / Enrich / Comply / Call queue tabs), scoped to the active
  client. Queue enforces one-call-at-a-time in the UI (call button locks
  until an outcome is logged) and renders a `tel:` link only when the
  server sent an unmasked number. Nav entry + screen registered in the
  app shell.
- **2026-08-10 — Adversarial audit + hardening pass.** An independent
  multi-agent audit of the branch against its own claimed guarantees found
  real defects, including two that falsified claims made above. Fixed, each
  with a regression check (suite is now 53 checks):
  - **The no-dial guarantee was false.** `optOut` wrote the raw number into
    the compliance-log entry's `data`, and the COMPLY `GET` returned the last
    50 log entries verbatim — a second, ungated exit for a full phone number
    regardless of gate state. Log entries are now redacted on the way out;
    the stored record keeps the raw number as retained evidence.
  - **The live ingest could not fetch the battery permits it subtracts.**
    `COARSE_KEYWORDS` omitted `ESS`/`BESS`/`KWH`, so a Mesa permit reading
    only "ESS INSTALL 27 KWH" was never fetched, its parcel never subtracted,
    and the parcel shipped as a target. The fixture suite passed because it
    bypasses the SoQL filter entirely — an offline green run said nothing
    about the live path. Bare `ESS` is space-prefixed (`%  ESS%` can't match
    ADDRESS); `STORAGE`/`KWH`/`BESS` catch the rest.
  - **No canonical phone form.** An 11-digit stored number never matched a
    10-digit scrub result, so DNC-listed numbers were stamped `clear`, and an
    opt-out recorded in one format never suppressed a lead stored in another.
    New `lib/permits/phone.ts`; every store and compare canonicalizes.
  - **"Fixed VOIP" classified as landline** — the one line type suppression
    lets through. VOIP is now tested first.
  - **Replacing a number kept the old number's scrub** as its compliance
    evidence (`dnc: lead.dnc ?? prev.dnc` made the field unclearable).
  - **Assessor enrichment could fabricate a household**: the free-text
    `/search/property` fallback attached an owner from a record never
    verified to be the requested parcel, and name and mailing address were
    two independent scans that could pair across records. Fallback removed
    (a miss beats a wrong owner); both fields now read from one record.
  - **Retired leads stayed callable.** The queue reads leads, which were
    never reconciled with targets, so a parcel correctly subtracted by a
    later filter kept its phone number in the queue forever. Filter now
    retires and restores leads; retired rows are held out but never deleted,
    because the row carries opt-out history.
  - Also: silent record truncation now reported (and the cap raised well
    above real volume), descriptions no longer truncated before
    classification, hyphen/separator tolerance across all compound keywords,
    solar-thermal scopes excluded properly, AZ registration status defaults
    to `not_filed` instead of `filed`, empty-string vendor `Phone` no longer
    masks a populated `CellPhone`.
- **Known and NOT fixed — required before dialing is enabled:** the KV layer
  swallows write failures (`kvSetJSON` returns void; a lost opt-out write is
  indistinguishable from a successful one), and read-modify-write on the log,
  the internal DNC list, and leads has no atomicity, so concurrent writes can
  drop an entry. The compliance log is also stored as a single rewritten
  value, which will outgrow the KV timeout at retention scale. These need a
  durable append-only store, not a patch.
- **2026-08-10 — First live Mesa run, and the residential gate it forced.**
  Run from the Vercel preview in a signed-in browser (the preview is
  SSO-protected; curl from outside 401s). Returned `totalPermits` 10033,
  `parcelsWithSolar` 323, `targets` 111, every row with a populated address
  and date — so the promoted field names resolve. Against the previous
  build the same call gave `parcelsWithSolar` 739 / `targets` 353 with every
  address empty, so the completion and ancillary gates were demonstrably
  working. Hand-classifying all 111 found only ~20–25 genuine residential
  rooftop installs: ~20 were commercial or municipal (parking canopies,
  carports, shade structures, a flagpole with solar lighting) and ~36 were
  electrical/service work still passing the ancillary gate. Fixed:
  - **The install gate was inverted.** It asked "does this mention a panel?"
    and tried to enumerate ancillary phrasings — which never converges. It
    now asks "does this install PV?", requiring affirmative evidence (a kW
    rating, roof/ground mount, modules, array, solar panels). A bare
    "PV SOLAR SYSTEM" mention counts only outside a purpose clause, since
    "INSTALL SUBPANEL **FOR** PV SOLAR SYSTEM" names the beneficiary.
  - **New residential gate** (`lib/permits/residential.ts`), separate from
    the install gate: system size with a 30 kW DC ceiling (no size stated is
    *unknown*, never a pass), residential permit type, commercial structure
    words (`CANOPY` **and** `CANOPIES` — matching only the singular is how
    the Chase and Mesa Public Library arrays got through), and named
    organizations.
  - **Two guards against overcorrecting**, both from real keeper rows:
    RES/COM markers are read only from `permit_type`/`type_of_work`, never
    description text, because a genuine residential row opens
    "IND-2873."; and the named-entity signal is suppressed inside an
    approval clause, because "CONDITIONED ON CITY OF MESA AND SRP APPROVAL"
    is a homeowner self-install, not a municipal project.
  - **Date anchoring** now prefers `finaled_date`, then the source's own
    `finaled_year` at year precision, then `issued_date` — each labeled in
    `completion_date_source`. Mesa's dominant completed status
    ("C of C Issued") does not always carry `finaled_date`, so without the
    year rung most completed permits silently read as issue-dated.
  - **Recency window is now 2–20 years** (was 6 months–5 years).
  - Stats now report `parcelsCommercial` with a per-reason tally,
    `parcelsUnknownOccupancy`, and per-parcel `systemKwDc`, so the next live
    run shows exactly which signal is doing the work.
- **2026-08-10 — County-layer coverage settled; West Valley needs city
  adapters.** Maricopa County permits only unincorporated territory.
  Confirmed by `WorkClass='Solar'` counts per ZIP against the county layer:
  Goodyear 85395 = 1 and Glendale 85308 = 3 (both wholly inside city limits,
  i.e. nothing), versus Litchfield Park 85340 = 290, Buckeye 85326 = 127,
  Peoria 85383 = 91 — exactly the ZIPs that sprawl past city limits. Those
  are county residents sharing a ZIP with a city. Consequences, recorded in
  `lib/permits/adapters/README.md`: all five West Valley cities need their
  own adapters; county rows are labeled `jurisdiction=maricopa-unincorporated`;
  and **ZIP must never be used as a city filter on county data** — it looks
  right and silently returns the wrong population, the same failure shape as
  the ESS over-fetch.
- **2026-08-10 — West Valley adapters: Peoria and Buckeye built.** Both from
  live-verified endpoints, both public and unauthenticated. Full source notes
  in `farmhand/lib/permits/adapters/README.md`.
  - **Peoria** (`Accela/Solar_Parcels/MapServer/0`) is the best source in the
    program: a purpose-built solar layer, 8312 rows, all `Final`, with
    occupancy AND battery published as **structured fields** rather than free
    text. The filter now honors `classOverride`/`occupancyOverride` so a
    source that classifies its own rows beats the keyword heuristics.
    Caveat encoded: no date field, so year decodes from the permit-number
    prefix and `completion_date_source=permit-number-prefix`; history starts
    2019, so "2–20 years" is really 2019–2024 and the extra depth is not
    claimed.
  - **Buckeye** (`Hosted/EnergovPermitswReviewHistory2/FeatureServer/0`):
    `workclass LIKE '%SOLAR%'` returns **exactly zero** — the city's word is
    **Photovoltaic** (8942 rows, 8066 `Finaled`). A solar-keyword adapter
    would report zero and read as a coverage gap rather than a bug, so the
    keyword is asserted in the suite. Addresses are unusable (~21%
    populated), so the join is on `parcelnumber`; battery is free-text only
    and every record carries `batteryDetection=description-only`.
  - **Glendale** deferred: no API, monthly PDFs only, and no APN, status or
    completion date — so if the parser is built every Glendale lead must
    carry `completion_status=unconfirmed` and stay out of the default queue.
  - **Goodyear** not buildable — the published layer is a 245-row commercial
    stub with zero solar. This becomes a data request to the city, an owner
    action rather than an engineering one.
  - **Litchfield Park** skipped: no permit API, and ~80% of ZIP 85340 is
    unincorporated county already covered by the county layer.
- **⚠ OPEN LEGAL QUESTION — owner + counsel, alongside the telemarketing
  gate.** The Maricopa County permit layer's license restricts commercial
  download and resale without a sublicensing agreement, citing **A.R.S.
  39-121.03**, and a lead-generation pipeline is a commercial purpose. This
  is not an engineering decision and is recorded here rather than resolved.
  It does not affect Peoria or Buckeye, which are city sources under their
  own terms — so it does not block the West Valley work.
- **2026-08-10 — Battery detection audit: a real bug, and a cross-validation.**
  - **The bug, which would have shipped.** Matching battery terms in SQL with
    `LIKE '%ESS %'` also matches `"ADDRESS "` — the trailing space doesn't
    save it. That over-excluded real targets. The version in the repo had the
    mirror-image defect: `LIKE '% ESS%'` *misses* a description starting
    `"ESS INSTALL 27 KWH"`, so the battery permit is never fetched and the
    battery home ships as a target — the worse direction.
    **Rule, now enforced in code: never do battery matching in SQL `LIKE`.**
    SQL is a coarse over-fetch net of safe substrings only
    (`lib/permits/coarseNet.ts`, which contains no `ESS`/`BESS`/`RESU`);
    the word-bounded classifier decides.
  - **Corrected Buckeye count: 6168 targets, not 6063** — it went *up*,
    because the false positives were excluding real homes. Reconciles exactly:
    7661 − 870 (combined) − 90 (later separate battery) − 533 (under 2 years).
  - **Strict matcher ported**, adding the storage brands: Enphase Encharge /
    IQ Battery, Generac PWRcell, FranklinWH, sonnen, EG4, SimpliPhi, LG RESU,
    Tesla Backup Gateway, energy bank, and bare `TESLA`. Two entries are
    load-bearing and look odd: `\bRESU\b` must stay word-bounded (unbounded it
    matches RESULTS and RESUBMIT — 815 Buckeye rows), and `\bTESLA\b` earns
    its place because 614 Buckeye permits name Tesla without ever saying
    Powerwall.
  - **Cross-validation — the strongest evidence the thesis has.** Battery
    attach rate by solar year, computed independently in two cities by two
    unrelated methods (Buckeye free-text regex, Peoria structured flag):

    | year | Buckeye | Peoria |
    | --- | --- | --- |
    | 2019 | 1.7% | 0.9% |
    | 2020 | 2.1% | 2.6% |
    | 2021 | 2.7% | 4.3% |
    | 2022 | 3.5% | 5.4% |
    | 2023 | 3.0% | 6.0% |
    | 2024 | 18.8% | 29.0% |
    | 2025 | **56.6%** | **57.2%** |
    | 2026 | 78.6% | 68.0% |

    2025 agreeing to within 0.6 points across a regex and a checkbox in
    different permit systems means the detection measures something real
    rather than a keyword artifact. It also states the business case: the
    2019–2023 cohort installed when almost nobody attached storage, and that
    is exactly the cohort this system targets.
  - **Built as a standing data-quality check** (`lib/permits/attachRate.ts`,
    run on every `filter`): attach rate by year per jurisdiction, with
    warnings when a curve departs from the verified shape — because broken
    battery detection is silent, and a departure is far more likely to be a
    detection bug than a changed market.
  - Also verified: Peoria's 883 battery rows are 697 sharing a solar permit id
    and 186 standalone, so retrofit-only batteries do appear there.
- **Two limits stated plainly, not papered over:**
  1. **102 Buckeye storage permits carry neither a finalize nor an issue
     date.** Policy adopted: they still subtract their parcel, because an
     undated storage permit is still proof of a battery, and excluding is the
     safe direction. The count is reported as `undatedBatteryPermits` rather
     than absorbed silently.
  2. **This measures PERMITTED batteries only.** An unpermitted retrofit is
     invisible. Every target now carries `battery_evidence=permit-data-only`
     in the record and in the CSV, so "no battery permit" is never mistaken
     downstream for "no battery".
- **2026-08-10 — STRUCTURAL FINDING: there is no battery permit type
  anywhere.** Established by enumerating the full permit vocabulary in all
  three live systems. This is a fact about how AZ jurisdictions file storage,
  not a gap in the search, and it determines the whole detection design.
  - **Buckeye** — 105 workclass values, none battery/storage/ESS. Of 1273
    battery permits, **1104 (87%) file under workclass `Photovoltaic System`,
    the identical label a solar install gets**, plus 3 under `Photovoltaic
    Standard Plan` and 134 under `Misc`; the rest scatter across Antenna,
    Generator, Run, Alarms. `permittype` is trade-level only;
    `permitclass` has no storage entry.
  - **Peoria** — `PER_TYPE` is only Miscellaneous/Residential/Commercial and
    `PER_SUB_TYPE` only Miscellaneous Residential/Commercial, SolarPV,
    Swimming Pool-Spa-Hot Tub, Commercial Accessory Use. Battery exists ONLY
    as a checkbox attribute (`USER_B1_CHECKBOX_DESC='Battery Storage'`) — an
    attribute on a permit, not a category. That is why Peoria is our best
    structured signal and why it is unique.
  - **Mesa** — no battery category. 1251 battery-mentioning permits sit at
    `type_of_work='Electrical'`, exactly where 1123 solar permits also sit.
    The identical bucket.

  Four consequences, all encoded:
  1. **Description parsing is not a shortcut — in Buckeye and Mesa it is the
     only battery signal that exists.** The matcher is now its own module
     (`lib/permits/batteryMatcher.ts`) with its own corpus
     (`fixtures/battery.ts`, 27 positives and 13 negatives, every negative a
     string a plausible matcher has actually mis-fired on).
  2. **The coarse net keeps running across ALL workclasses, never narrowed to
     photovoltaic.** Because 87% of battery permits already file under
     `Photovoltaic System`, those records are *already inside* the data we
     fetch — we were never missing them, only misreading them. Narrowing the
     net would lose the 134 filed under `Misc`. A regression asserts the
     description clauses are not conditioned on workclass.
  3. **New keyword-independent safety net.** In Buckeye a battery retrofit
     lands as a SECOND `Photovoltaic System` permit on the parcel. Measured:
     of 7661 parcels, 7392 have exactly one PV permit and 269 have more, of
     which 171 carry no battery keyword and sample as genuine array
     expansions ("ADDING MODULES", "AND DERATE MAIN BREAKER"). So a target
     holding a second PV permit dated after the first is flagged
     `second-pv-permit` and **held out of the default dial queue** — ~2% of
     parcels, caught with no keywords at all.
  4. **`battery_detection_method` per jurisdiction** on every row —
     `peoria=structured_flag`, `buckeye=description_text`,
     `mesa=description_text` — so the confidence difference between a
     checkbox and a regex is visible in the record rather than assumed
     uniform. `battery_evidence=permit-data-only` stays on every lead.

  One thing this finding also exposed: **Buckeye's workclass is itself a
  structured SOLAR signal and has to be used.** Real PV permits there carry
  descriptions with no solar keyword at all ("ADDING MODULES TO EXISTING
  ARRAY AND DERATE MAIN BREAKER"), so text-only classification drops them.
  Battery still comes from the description, because the workclass label
  cannot separate a battery from an install — only the text can.
- **2026-08-10 — Recorded negative result: no independent utility signal
  exists.** Checked whether utility interconnection data could corroborate
  battery detection. It cannot: APS and SRP publish nothing residential, the
  ACC REST reports carry no storage field and those rules were repealed in
  March 2026, and EIA is state-level only. The one real dataset is **LBNL
  Tracking the Sun**, which does list APS/SRP/TEP as active data providers
  and carries a `technology_type` flag separating PV-only from PV+Storage
  from Storage-only — but its finest geography is ZIP+4, so it is a
  **calibration layer, never a per-home join**. Worth pulling later to
  measure our expected false-positive rate; not a build dependency.
  **Permit data remains the only address-resolvable battery signal that
  exists.**
- **2026-08-11 — Competitive intel, and the one real capability gap: LLM
  classification.** How the commercial vendors do this is now known, and the
  headline is that **there is no private feed**. Shovels.ai — the market
  leader, millions of permits a month — sources exactly the way this system
  does: jurisdiction open-data portals, building-department APIs,
  public-records requests, then assessor and contractor-licensing data for
  enrichment. No bulk licensing deal with Accela or Tyler. Their advantage is
  scale, not access, and scale is not what stands between us and a working
  list.

  The one thing they genuinely do better is **classify with models instead of
  keywords**, and their stated reason is the exact failure this project has hit
  three times: every city has its own permitting terminology. `SOLAR` returning
  zero rows in Buckeye (the word is `Photovoltaic`), `C of C Issued` vs
  `Finaled` in Mesa, `ESS` matching `ADDRESS` in a SQL LIKE. Each read as a
  correct query and quietly answered a different question.

  So this landed as a **second path, not a replacement** — `lib/permits/`:

  1. **`taxonomy.ts`** — the vendors' 15-tag taxonomy adopted as-is, for proven
     boundaries and comparability against a vendor feed if we ever benchmark.
     **BATTERY is a first-class tag, separate from SOLAR**, which independently
     confirms what enumerating three cities' permit vocabularies already
     showed: no city files storage as its own permit type, so battery is a
     *classification* problem and every serious vendor solves it by classifying
     text.
  2. **`llmClassify.ts`** — Anthropic Messages API over raw `fetch`, matching
     `lib/claudeScript.ts` rather than adding the SDK as a second way to call
     the same API. Cached system prompt (taxonomy + rules are identical every
     batch), structured JSON output, low effort — classification is mechanical
     judgment and the cost lever is what makes a per-row pass affordable across
     a new city. Returns `[]` on missing key, HTTP error, refusal, or
     unparseable content, so the caller always keeps its rule answer.
  3. **`tagging.ts`** — the two paths joined. Rules are the fast path and the
     regression baseline; SOLAR and BATTERY still come from
     `classifyDescription()`/`hasBatteryEvidence()`, so there is exactly one
     battery matcher in the codebase. The LLM runs on rows the rules mark
     ambiguous and on **every row of a jurisdiction whose vocabulary has not
     been learned** — today only `mesa`, `buckeye`, `peoria` count as learned.
     It is **ADD-ONLY**: it may fill a row the rules left empty and may never
     clear a rule tag. Worst case it contributes nothing.
  4. **Disagreement is the actual deliverable.** Every permit carries
     `classification { tags, method, confidence }` — `rule`, `llm`, or `source`
     — and rule-vs-LLM splits on SOLAR/BATTERY are counted per jurisdiction.
     That count *is* the vocabulary-gap detector: it is how a new city's
     terminology gets discovered on day one instead of never.

  34 new checks, all against a **stubbed transport** so the suite stays offline
  and needs no API key (244 total). The stage is **off by default** —
  `useLlm` opt-in, and absent `ANTHROPIC_API_KEY` it is simply inert.

  **Build vs. buy — buy nothing, and the reason is specific.** Sourcing parity
  is established above. Shovels refreshes monthly, which is the same cadence we
  can hold, so there is no freshness argument either. Plumb Intelligence is
  AZ-only and closer to our footprint, but **battery is not a separate tag in
  its schema** — so it cannot answer the question this product is built on.
  Decisive point: **nobody sells the packaged list.** Every vendor sells permit
  records; none sells "solar without battery." That derivation is the product,
  and it is the part no purchase would replace.

  Three new endpoints verified live and added to the adapter backlog
  (`lib/permits/adapters/README.md`): **Tucson** and **Tempe** as ordinary next
  builds, and **Gilbert with a caution** — a `WorkClass LIKE '%SOLAR%'` query
  there returned 2 rows out of ~215,000, both Cancelled, in a city of 280,000.
  That is the query being wrong, not a fact about Gilbert. Its full `WorkClass`
  vocabulary gets enumerated before any adapter is written; the backlog entry
  records it as a live demonstration of the fail-loud-on-zero rule.
- **Ship state: list-building + compliance-armed, dialing OFF.** ✅
- Open items, in order:
  1. First live run (from Vercel or any machine with egress to
     `data.mesaaz.gov`): `npm run permits:smoke -- --live`, or POST
     `{action:"preview"}` to `/api/permits`. Verify permit-number /
     address / issue-date field names; promote to `VERIFIED_FIELDS`.
  2. Request the Maricopa assessor token; confirm owner-details response
     keys against the tolerant scanner.
  3. Verify the Datazapp API contract before funding an append batch.
  4. Get the SAN + file the A.R.S. 44-1272.01 limited registration;
     record both in the Comply tab.
  5. P1 adapters, in order: **Tucson** and **Tempe** (endpoints verified),
     then **Gilbert** — but enumerate Gilbert's full `WorkClass` vocabulary
     first; a SOLAR keyword there returns 2 rows out of 215k. Then Scottsdale.
  6. Run the LLM stage over a real ambiguous slice with a key configured and
     read the per-jurisdiction disagreement counts — anything Tucson/Tempe
     disagrees on is that city's vocabulary telling us what the rules miss.
