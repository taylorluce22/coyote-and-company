#!/usr/bin/env python3
"""
Build real buyer prospect lists from authoritative sources.

Run this on a machine with normal internet access (your laptop, or a server).
It writes CSVs in the research format that mvp/import-prospects.py consumes,
so the pipeline is:  build-prospects.py  ->  import-prospects.py  ->  CRM import.

SOURCE 1 (default, free, no API key): NPPES NPI Registry
    The federal registry of healthcare providers. Authoritative, current, and it
    covers every specialty that bills or holds an NPI: ophthalmology, dermatology,
    urology, orthopedics, ENT, ASCs, pharmacies, primary care.
    API docs: https://npiregistry.cms.hhs.gov/api-page

SOURCE 2 (optional, needs a key): Google Places API
    Needed for the segments NPPES largely misses -- med spas, IV hydration lounges,
    and cash-pay wellness clinics often operate without an organizational NPI.
    Get a key: https://developers.google.com/maps/documentation/places/web-service
    Cost note: Places Text Search is billed per request; a few hundred queries is
    typically a few dollars and new accounts have free credit.

Examples
--------
  # Ophthalmology practices in Arizona (no key needed)
  python3 build-prospects.py nppes --taxonomy ophthalmology --state AZ -o ophtho-AZ.csv

  # Multiple specialties and states at once
  python3 build-prospects.py nppes --taxonomy ophthalmology,dermatology \\
      --state AZ,TX,CO,NV -o clinics.csv

  # Med spas in Phoenix metro (needs GOOGLE_PLACES_API_KEY)
  python3 build-prospects.py places --query "med spa" \\
      --cities "Phoenix AZ,Scottsdale AZ,Mesa AZ,Tempe AZ" -o medspa-AZ.csv

  # List available taxonomy shortcuts
  python3 build-prospects.py taxonomies
"""

import argparse
import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request

NPPES_API = "https://npiregistry.cms.hhs.gov/api/"
PLACES_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"

# Carve-outs from docs/10-regulatory-research.md sections 3 and 6. Enforced here as
# well as in import-prospects.py -- cheaper to never collect the row than to filter it.
CARVE_OUT_STATES = {"FL", "CA", "AL", "NJ"}

CSV_HEADER = [
    "Name", "City", "State", "Website", "Phone",
    "Specialty", "Owner or Medical Director", "Source URL", "Notes",
]

# Friendly name -> NPPES taxonomy code (organizational and individual providers)
TAXONOMIES = {
    "ophthalmology": "207W00000X",
    "dermatology": "207N00000X",
    "orthopedics": "207X00000X",
    "otolaryngology": "207Y00000X",
    "urology": "208800000X",
    "plastic-surgery": "208200000X",
    "family-medicine": "207Q00000X",
    "internal-medicine": "207R00000X",
    "obgyn": "207V00000X",
    "pain-medicine": "208VP0014X",
    "asc": "261QA1903X",
    "clinic-primary-care": "261QP2300X",
    "clinic-multispecialty": "261QM1300X",
    "pharmacy-community": "3336C0003X",
    "pharmacy-specialty": "3336S0011X",
    "nurse-practitioner": "363L00000X",
}


def http_json(url: str, params: dict, retries: int = 3) -> dict:
    """GET with query params, parse JSON, retry on transient failures."""
    qs = urllib.parse.urlencode(params)
    full = f"{url}?{qs}"
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                full, headers={"User-Agent": "agency-os-prospect-builder/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - surface any transport error to caller
            last_err = exc
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"request failed after {retries} attempts: {full}\n{last_err}")


def pick_location(addresses: list) -> dict:
    """NPPES returns MAILING and LOCATION addresses; we want the practice location."""
    for addr in addresses or []:
        if addr.get("address_purpose") == "LOCATION":
            return addr
    return (addresses or [{}])[0]


def fetch_nppes(taxonomy_code: str, state: str, city: str | None, limit_total: int) -> list[dict]:
    """Page through NPPES for organizational providers. skip caps at 1000, limit at 200."""
    rows, skip = [], 0
    while skip <= 1000 and len(rows) < limit_total:
        params = {
            "version": "2.1",
            "enumeration_type": "NPI-2",   # organizations, not individuals
            "taxonomy_description": taxonomy_code,
            "state": state,
            "limit": 200,
            "skip": skip,
        }
        if city:
            params["city"] = city
        data = http_json(NPPES_API, params)
        if data.get("Errors"):
            print(f"    NPPES error: {data['Errors']}", file=sys.stderr)
            break
        results = data.get("results") or []
        if not results:
            break
        rows.extend(results)
        if len(results) < 200:
            break
        skip += 200
        time.sleep(0.3)  # be polite to a free public API
    return rows[:limit_total]


def nppes_to_csv_rows(results: list[dict], specialty_label: str) -> list[list[str]]:
    out = []
    for r in results:
        basic = r.get("basic") or {}
        name = (basic.get("organization_name") or "").strip()
        if not name:
            continue
        addr = pick_location(r.get("addresses"))
        state = (addr.get("state") or "").strip().upper()
        if state in CARVE_OUT_STATES:
            continue
        npi = r.get("number", "")
        # authorized_official_* is the org's named contact in NPPES -- a genuine
        # decision-maker signal, not a guess.
        official = " ".join(
            x for x in [
                basic.get("authorized_official_first_name", ""),
                basic.get("authorized_official_last_name", ""),
            ] if x
        ).strip()
        title = basic.get("authorized_official_title_or_position", "")
        if official and title:
            official = f"{official} ({title})"
        out.append([
            name,
            (addr.get("city") or "").title(),
            state,
            "",  # NPPES has no website field
            (addr.get("telephone_number") or "").strip(),
            specialty_label,
            official,
            f"https://npiregistry.cms.hhs.gov/provider-view/{npi}",
            f"NPI {npi}",
        ])
    return out


def cmd_nppes(args) -> int:
    taxes = [t.strip() for t in args.taxonomy.split(",") if t.strip()]
    states = [s.strip().upper() for s in args.state.split(",") if s.strip()]
    cities = [c.strip() for c in args.city.split(",")] if args.city else [None]

    unknown = [t for t in taxes if t not in TAXONOMIES]
    if unknown:
        print(f"Unknown taxonomy shortcut(s): {unknown}", file=sys.stderr)
        print(f"Available: {', '.join(sorted(TAXONOMIES))}", file=sys.stderr)
        return 2

    blocked = [s for s in states if s in CARVE_OUT_STATES]
    if blocked:
        print(f"Refusing carve-out state(s) {blocked} -- see docs/10-regulatory-research.md", file=sys.stderr)
        states = [s for s in states if s not in CARVE_OUT_STATES]
        if not states:
            return 2

    all_rows: list[list[str]] = []
    for tax in taxes:
        code = TAXONOMIES[tax]
        for st in states:
            for city in cities:
                where = f"{tax}/{st}" + (f"/{city}" if city else "")
                print(f"  querying NPPES: {where} ...", file=sys.stderr)
                try:
                    results = fetch_nppes(code, st, city, args.max_per_query)
                except RuntimeError as exc:
                    print(f"    FAILED: {exc}", file=sys.stderr)
                    continue
                rows = nppes_to_csv_rows(results, tax)
                print(f"    {len(rows)} organizations", file=sys.stderr)
                all_rows.extend(rows)
    return write_csv(all_rows, args.out)


def cmd_places(args) -> int:
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        print("Set GOOGLE_PLACES_API_KEY in your environment first.", file=sys.stderr)
        print("Get one at https://developers.google.com/maps/documentation/places/web-service", file=sys.stderr)
        return 2

    queries = [q.strip() for q in args.query.split(",") if q.strip()]
    cities = [c.strip() for c in args.cities.split(",") if c.strip()]
    all_rows: list[list[str]] = []

    for city in cities:
        for query in queries:
            print(f"  querying Places: '{query}' in {city} ...", file=sys.stderr)
            token, page, found = None, 0, 0
            while page < 3:  # Places returns at most 3 pages (60 results)
                params = {"query": f"{query} in {city}", "key": key}
                if token:
                    params = {"pagetoken": token, "key": key}
                    time.sleep(2)  # next_page_token needs a moment to become valid
                try:
                    data = http_json(PLACES_TEXT_SEARCH, params)
                except RuntimeError as exc:
                    print(f"    FAILED: {exc}", file=sys.stderr)
                    break
                status = data.get("status")
                if status not in ("OK", "ZERO_RESULTS"):
                    print(f"    Places status {status}: {data.get('error_message','')}", file=sys.stderr)
                    break
                for place in data.get("results", []):
                    addr = place.get("formatted_address", "")
                    state = ""
                    parts = [p.strip() for p in addr.split(",")]
                    if len(parts) >= 2:
                        tail = parts[-2].split()  # "AZ 85004"
                        if tail:
                            state = tail[0].upper()[:2]
                    if state in CARVE_OUT_STATES:
                        continue
                    pid = place.get("place_id", "")
                    website, phone = "", ""
                    if args.details and pid:
                        try:
                            det = http_json(PLACES_DETAILS, {
                                "place_id": pid,
                                "fields": "website,formatted_phone_number",
                                "key": key,
                            })
                            res = det.get("result", {})
                            website = res.get("website", "")
                            phone = res.get("formatted_phone_number", "")
                        except RuntimeError:
                            pass
                        time.sleep(0.1)
                    all_rows.append([
                        place.get("name", ""),
                        parts[-3] if len(parts) >= 3 else city.split()[0],
                        state,
                        website,
                        phone,
                        query,
                        "",  # medical director: research step, never guessed
                        f"https://www.google.com/maps/place/?q=place_id:{pid}",
                        "source: google places; medical director unverified",
                    ])
                    found += 1
                token = data.get("next_page_token")
                page += 1
                if not token:
                    break
            print(f"    {found} places", file=sys.stderr)
    return write_csv(all_rows, args.out)


def write_csv(rows: list[list[str]], out_path: str) -> int:
    # Dedupe within this run on normalized name + state; import-prospects.py does the
    # authoritative cross-file dedupe and near-duplicate flagging.
    seen, unique = set(), []
    for row in rows:
        key = ("".join(ch for ch in row[0].lower() if ch.isalnum()), row[2])
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(CSV_HEADER)
        w.writerows(unique)
    print(f"\nWrote {len(unique)} unique rows to {out_path} ({len(rows) - len(unique)} in-run duplicates dropped)")
    print("Next: python3 import-prospects.py <dir with this file> <output dir>")
    return 0


def cmd_taxonomies(_args) -> int:
    print("NPPES taxonomy shortcuts:\n")
    for name, code in sorted(TAXONOMIES.items()):
        print(f"  {name:24} {code}")
    print("\nFull code list: https://taxonomy.nucc.org/")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("nppes", help="pull licensed provider organizations (free, no key)")
    p1.add_argument("--taxonomy", required=True, help="comma-separated shortcuts; see 'taxonomies'")
    p1.add_argument("--state", required=True, help="comma-separated 2-letter states")
    p1.add_argument("--city", default="", help="optional comma-separated cities to narrow")
    p1.add_argument("--max-per-query", type=int, default=1200)
    p1.add_argument("-o", "--out", required=True)
    p1.set_defaults(func=cmd_nppes)

    p2 = sub.add_parser("places", help="pull med spas / IV clinics (needs GOOGLE_PLACES_API_KEY)")
    p2.add_argument("--query", required=True, help='comma-separated search terms, e.g. "med spa,IV therapy"')
    p2.add_argument("--cities", required=True, help='comma-separated "City ST" values')
    p2.add_argument("--details", action="store_true", help="fetch website+phone per place (extra API cost)")
    p2.add_argument("-o", "--out", required=True)
    p2.set_defaults(func=cmd_places)

    p3 = sub.add_parser("taxonomies", help="list taxonomy shortcuts")
    p3.set_defaults(func=cmd_taxonomies)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
