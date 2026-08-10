# Jurisdiction adapters

## The rule that governs this directory

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
| `mesa` | **live-verified** | Socrata SODA, dataset `dzpk-hxfb` |
| `goodyear` | not built | Accela Citizen Access |
| `peoria` | not built | Accela (`devservices.peoriaaz.gov`) |
| `glendale` | not built | SmartGov public portal |
| `buckeye` | not built | own development services |
| `litchfield-park` | not built | own development services |
| `maricopa-unincorporated` | not built | county ArcGIS feature layer |
| `tempe`, `scottsdale` | not built | P1, unscoped |

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
