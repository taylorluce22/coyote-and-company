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
2. Maricopa enrichment
3. Phone-append interface
4. COMPLY gate
5. P1 adapters: Tempe, Scottsdale

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
- Next: client-scoped store + `/api/permits` route.
