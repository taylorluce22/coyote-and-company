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
- (b) **AZ telephonic-seller registration** status recorded — the
  ROC-licensed-installer path is confirmed, so this is the free limited
  registration under **A.R.S. 44-1272.01** (build the flag, don't block on
  it);
- (c) **wireless suppression** active.

Also enforced:

- **DNC scrub** re-run on a **31-day-max** clock; stale numbers blocked.
- Wireless-flagged numbers suppressed from the dial queue by default
  (config flag, default **ON**) — A.R.S. 44-1278(B)(3) likely bars cold
  calls to AZ cell phones.
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
  5. P1 adapters: Tempe, Scottsdale.
