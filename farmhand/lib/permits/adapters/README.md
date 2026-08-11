# Jurisdiction adapters

## The rule that governs every adapter: vocabulary, not access

**These are not scraping targets. They are ArcGIS REST query APIs, and the
failure mode is vocabulary.**

Every city names the same thing differently:

| City | How it says "solar" |
| --- | --- |
| Mesa | free text `PV SOLAR` in `description_of_work` |
| Buckeye | `workclass` = `Photovoltaic System` / `Photovoltaic Standard Plan` — `SOLAR` matches **zero rows** |
| Peoria | checklist code `801 - Photovoltaic RES` |

A keyword list carried from one city to another is *guaranteed* to return zero
or near-zero somewhere, and it will look like a coverage gap rather than a bug.
This has now bitten three times: the `ESS` over-fetch, the ZIP-as-city filter,
and Buckeye's `SOLAR`-vs-`Photovoltaic`. Same shape each time — a query that
reads correctly and quietly answers a different question.

So, for every new jurisdiction:

1. **Start by enumerating** the distinct values of the classification and status
   fields with `returnDistinctValues=true` — `arcgisDistinctValues()` in
   `arcgis.ts` — and record them in the adapter as named constants.
2. **Assert the vocabulary before every fetch.** `assertVocabulary()` throws
   `VocabularyDriftError` when a configured value stops matching rows.
3. **An adapter that returns zero rows is an ERROR, never a result.** Both the
   Peoria and Buckeye fetchers throw on an empty result rather than returning
   `[]`.
4. **Page with a stable `orderByFields`.** Without one, `resultOffset` paging
   repeats and skips rows. Buckeye uses `objectid ASC`.

## Data scope: Buckeye and Peoria both start in 2019

Verified, not inferred: Buckeye has **zero** photovoltaic permits finalized
before 2019-01-01, **one** permit of any type applied in 2018, and **zero** in
2016 and 2017. Peoria's year histogram likewise starts at 2019. That is a
**system cutover to EnerGov**, not a filter artifact and not a gap in our query.

Two consequences that belong in code rather than in someone's head:

1. The 2-to-20-year retrofit window can only ever return **2019 onward** from
   these sources. Every adapter records `historyStartsYear`, and
   `HISTORY_STARTS` in `index.ts` collects them so an export can state the real
   coverage instead of implying twenty years of it.
2. Pre-2019 history is a **records-request item, not a code item**. No adapter
   change reaches it.

## The rule about county data

**Never infer a city from a ZIP code on county data.**

Maricopa County's permit layer covers *unincorporated* territory only. Verified
2026-08-10 by counting `WorkClass='Solar'` per ZIP against the county layer:

| ZIP | Nominal city | County-layer solar rows |
| --- | --- | --- |
| 85395 | Goodyear | 1 |
| 85308 | Glendale | 3 |
| 85383 | Peoria | 91 |
| 85326 | Buckeye | 127 |
| 85340 | Litchfield Park | 290 |

The two ZIPs lying wholly inside city limits return essentially nothing. The
three with real counts are the ones that sprawl past city limits into
unincorporated county — so those rows are county residents who happen to share
a ZIP with a city, not residents of that city.

A ZIP filter over this layer therefore looks completely reasonable and silently
returns the wrong population. That is the same failure shape as the `ESS`
over-fetch bug: a filter that reads correctly and quietly answers a different
question than the one asked. If a county row ever needs a city assigned, use
geometry — point-in-polygon against city limits — never the ZIP.

## Adapter inventory

| Jurisdiction | Status | Source |
| --- | --- | --- |
| `mesa` | **built, live-verified** | Socrata SODA, dataset `dzpk-hxfb` |
| `peoria` | **built, live-verified** | ArcGIS `Accela/Solar_Parcels/MapServer/0` |
| `buckeye` | **built, live-verified** | ArcGIS `Hosted/EnergovPermitswReviewHistory2/FeatureServer/0` |
| `glendale` | **deferred — PDF only** | monthly Combined Permits Report PDFs |
| `goodyear` | **not buildable** | no usable public data |
| `litchfield-park` | **won't build** | no API; ~80% of the ZIP is county anyway |
| `maricopa-unincorporated` | not built | county ArcGIS layer — see licensing note below |
| `tucson` | **backlog — endpoint verified** | ArcGIS `Building_Permits/FeatureServer` (PDSD) |
| `tempe` | **backlog — endpoint verified** | ArcGIS `Building_Permits/FeatureServer` |
| `gilbert` | **backlog — vocabulary UNKNOWN** | ArcGIS `Permits/FeatureServer` |
| `scottsdale` | not built | P1, unscoped |

### Backlog: Tucson, Tempe, Gilbert

Three live endpoints are verified and none of them has an adapter yet. Tucson
and Tempe are ordinary next builds. Gilbert is not, and the reason is worth
reading before anyone picks it up.

**Gilbert is a live demonstration of the fail-loud-on-zero rule.** A
`WorkClass LIKE '%SOLAR%'` query against its layer returned **2 rows out of
~215,000, both Cancelled**. A city of 280,000 in Arizona did not issue two solar
permits. That result is a fact about the query, not about Gilbert — the same
shape as Buckeye, where `SOLAR` returned zero because the word in that system is
`Photovoltaic`.

So: **enumerate Gilbert's full `WorkClass` vocabulary with
`returnDistinctValues` before writing a line of adapter code**, exactly as
Buckeye's 105 workclasses were enumerated. Do not build against a keyword guess,
and do not let a near-zero count reach a fixture — `assertVocabulary` and the
throw-on-zero-rows guard in `buckeye.ts` exist because this failure is silent
otherwise: the adapter runs, the tests pass, and the city simply contributes
nothing.

Tucson and Tempe get the same treatment on principle (one real record, full
field list, status vocabulary with counts), but neither is currently showing the
warning sign Gilbert is.

### Peoria — the best source in the program

A purpose-built solar layer: 8312 rows, all `USER_B1_APPL_STATUS='Final'`, so
completed-only is free. Occupancy and battery are both **structured**
(`'801 - Photovoltaic RES'` / `'806 - Photovoltaic COM'`, and a
`'Battery Storage'` checkbox), which is why the adapter sets `classOverride`
and `occupancyOverride` — a source that classifies its own rows always beats
reading free text.

Its one weakness: **no date field**. Year is decoded from the permit-number
prefix, so `completionSource` is `permit-number-prefix`. History starts in
2019, so a "2–20 year" window really means 2019–2024 here. The depth does not
exist and must not be implied.

### Buckeye — the keyword trap

`workclass LIKE '%SOLAR%'` returns **exactly zero**. Buckeye's word is
**Photovoltaic** (`'Photovoltaic System'`, `'Photovoltaic Standard Plan'`):
8942 rows, 8066 of them `Finaled`. A solar-keyword adapter reports zero and
reads as a coverage gap rather than a bug — the same failure shape as the ESS
over-fetch. The test suite asserts the keyword for that reason.

Addresses are unusable (`addressline1` ~21% populated, `situsaddress` blank on
sampled solar rows) — **join on `parcelnumber` or geometry, never address**.
Battery is free-text only (no battery workclass among 106 values), so every
Buckeye record carries `batteryDetection: "description-only"`.

### Glendale — deferred, and it cannot satisfy completed-only

No API. Granicus SmartGov; the GIS `Building_Safety` folder returns *Token
Required* and the AGOL org publishes no permit datasets. The only record-level
publication is a monthly PDF series:
<https://www.glendaleaz.gov/Work/Building-Safety-Codes-Services/Permit-Reports>

The Combined Permits Report carries Permit Number, Permit Type, Issued Date,
**Owner Name**, Property Street Address, Contractor License No, Construction
Type, Value, Permit Fee. Solar is permit type `12PHOT`, construction type
`RES PHOTOVOLATAIC GRID-TIED` — **match that misspelling literally, it is the
city's own**. Roughly 85 residential PV permits a month.

The gap: **no APN, no permit status, no completion date** — issued date only.
So if the parser is built, every Glendale lead must carry
`completion_status=unconfirmed` and stay out of the default queue, per the
completed-only rule. Scrape the index page for links; do **not** construct
filenames, since the path segment and spellings vary month to month.

### Goodyear — not buildable, and it is a request, not code

The published layer is a 245-row stub with 8 distinct `JobDescription` values,
all commercial (mini mart, carport, addition, hospital, tenant improvement,
repair garage, hotel, school). Solar count is zero, confirmed twice. The schema
is genuinely good (`ParcelId`, `OwnerName`, `CompletionDate`, `FullAddress`,
contractor license) but the residential universe is simply not published, and
Accela ACA is web-UI only. Getting Goodyear means asking the city for a data
extract — an owner action, not an engineering one.

### Litchfield Park — deliberately skipped

3.3 sq mi, ~6,800 people, no GIS org and no permit API; the GovBuilt portal is
a one-record lookup that appears to cover licensing and code cases rather than
building permits. ZIP 85340 is 31.3 sq mi and ~33,800 people, so the city is
roughly 10% of the land and 20% of the population — the other 80% is
unincorporated county and already falls under the county layer. Not worth an
adapter.

## Licensing — unresolved, owner + counsel

The Maricopa County permit layer's license restricts commercial download and
resale without a sublicensing agreement, citing **A.R.S. 39-121.03**. A
lead-generation pipeline is a commercial purpose, so this is a real question
before the county layer is used — and it is a decision for Taylor and counsel,
not something to resolve in code.

It does **not** touch Peoria or Buckeye, which are city sources under their own
terms.

## What "live-verified" requires

Mesa is the only adapter whose field names came from a real record rather than a
guess, and the difference mattered: the first version guessed at permit number,
address and date field names from candidate lists, and every address in the
first live run came back empty. It also omitted `ESS`/`BESS`/`KWH` from the
server-side filter on an assumption about how battery permits are worded, which
would have shipped battery-equipped homes as targets.

So before an adapter here is written, one real record from that jurisdiction has
to be in hand — the full field list, plus the status vocabulary with counts.
Writing an adapter against a plausible-looking schema is how both of those bugs
happened, and the tests pass the whole time because fixtures are built from the
same guess.
