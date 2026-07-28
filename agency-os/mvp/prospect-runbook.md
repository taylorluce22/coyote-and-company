# Prospect Building Runbook

Two scripts, run on **your machine** (not this container — its network gateway blocks outbound requests to fda.gov, NPPES, Google, and state sites, which is why buyer lists can't be built from here):

```
build-prospects.py   →  raw research CSVs   →  import-prospects.py  →  CRM import files
```

Both are plain Python 3, standard library only. No install needed beyond Python.

## Step 1 — Licensed provider organizations (free, no API key)

NPPES is the federal NPI registry: authoritative, current, and free. It covers every specialty that holds an NPI — ophthalmology, dermatology, urology, orthopedics, ENT, ASCs, pharmacies. Each record includes the practice location, phone, and the organization's **authorized official by name** (a real decision-maker signal, straight from the registry).

```bash
python3 build-prospects.py taxonomies          # see available specialty shortcuts

# One specialty, one state
python3 build-prospects.py nppes --taxonomy ophthalmology --state AZ -o raw/ophtho-AZ.csv

# Several at once (this is the realistic launch pull)
python3 build-prospects.py nppes \
  --taxonomy ophthalmology,dermatology,urology,plastic-surgery \
  --state AZ,TX,CO,NV \
  -o raw/clinics-launch.csv
```

Notes:
- The API caps a single query at 1,200 results (limit 200 × skip 1000). If a specialty×state pull hits the cap, narrow it with `--city "Phoenix,Scottsdale,Mesa,Tucson"` and the script will page per city.
- Carve-out states (FL, CA, AL, NJ) are refused at the source — cheaper than filtering later.

## Step 2 — Med spas and IV clinics (needs a Google Places key)

These segments largely don't hold organizational NPIs, so NPPES misses them. Google Places is the practical source.

1. Get a key: https://developers.google.com/maps/documentation/places/web-service (new accounts get free credit; a few hundred queries is typically a few dollars).
2. `export GOOGLE_PLACES_API_KEY=your_key_here`

```bash
python3 build-prospects.py places \
  --query "med spa,medical spa,IV therapy,IV hydration,men's health clinic" \
  --cities "Phoenix AZ,Scottsdale AZ,Mesa AZ,Tempe AZ,Tucson AZ,Las Vegas NV,Henderson NV,Denver CO,Dallas TX,Austin TX,Houston TX,San Antonio TX" \
  --details \
  -o raw/wellness-launch.csv
```

`--details` costs an extra API call per business but returns website and phone — worth it.

Places returns at most 60 results per query+city pair, so more cities beats broader queries.

## Step 3 — Transform to CRM imports

```bash
python3 import-prospects.py raw/ out/ --batch 202608
```

Produces in `out/`:

| File | What to do with it |
|---|---|
| `buyers-import.csv` | Import to CRM **Buyers** table |
| `contacts-import.csv` | Import to CRM **Contacts** (emails are blank — filled in step 4) |
| `qualification-worklist.csv` | Med spas/IV clinics with no identified medical director. **These cannot be qualified as buyers until you find one** — that's the eligibility gate, so this is real work, not optional cleanup |
| `near-duplicate-review.csv` | Likely-same businesses flagged for your eyeball. Never auto-merged — collapsing two genuinely different practices silently costs you a prospect |
| `rejects.csv` | Carve-out states, exact duplicates, malformed rows. Nothing is dropped silently |

## Step 4 — Emails, then enrollment

1. Find contact emails (Hunter/Apollo-class tool, or published addresses on practice sites).
2. **Verify every address through MillionVerifier before it enters the CRM.** Only `Deliverable` is enrollable — that's gate G1, and the nightly sweep enforces it.
3. Import contacts, run the founder qualification pass, then the campaign gate sweep handles enrollment.

## Expected yield (launch pull)

Rough planning numbers, not promises: ophthalmology + derm + urology + plastics across AZ/TX/CO/NV should return several hundred organizations from NPPES; med spa/IV/men's-health Places queries across 12 metros should return several hundred more. Budget an afternoon for step 4's qualification pass — that's the part that actually gates outreach.

## Why this instead of scraped lists

A prospect list is only worth what its accuracy allows. NPPES rows are federal registry records with an NPI you can verify in one click; Places rows are live business listings. Both beat a list assembled from search snippets, which is what any agent working without direct network access would have produced — and a fabricated row doesn't just waste a send, it burns sender reputation and your time on a business that was never there.
