#!/usr/bin/env python3
"""
Transform raw prospect research CSVs into CRM-ready import files.

Input:  research CSVs with header
        Name,City,State,Website,Phone,Specialty,Owner or Medical Director,Source URL,Notes
Output: buyers-import.csv    (matches mvp/csv/buyers.csv columns)
        contacts-import.csv  (skeleton rows for named people found; emails filled by tooling later)
        qualification-worklist.csv  (rows missing the medical-director signal, i.e. work to do before outreach)
        rejects.csv          (carve-out states, duplicates, malformed — never silently dropped)

Usage:  python3 import-prospects.py <input_dir> <output_dir> [--batch YYYYMM]

Carve-outs enforced here as a backstop, independent of whatever the research produced:
FL (Patient Brokering Act + broker permit regime) and CA/AL/NJ (office-use restrictions).
See docs/10-regulatory-research.md sections 3 and 6.
"""

import argparse
import csv
import difflib
import pathlib
import re
import sys
from datetime import date

# FL settled; CA/AL/NJ disputed pending board confirmation -- see
# docs/10-regulatory-research.md section 6 and gtm/state-office-use-matrix.md.
CARVE_OUT_STATES = {"FL", "CA", "AL", "NJ"}

# Research specialty label -> CRM Buyer Type single-select value
BUYER_TYPE_MAP = {
    "med spa": "Med Spa w/ Medical Director",
    "medspa": "Med Spa w/ Medical Director",
    "medical spa": "Med Spa w/ Medical Director",
    "aesthetics": "Med Spa w/ Medical Director",
    "iv therapy": "Physician Clinic",
    "iv hydration": "Physician Clinic",
    "men's health": "Physician Clinic",
    "mens health": "Physician Clinic",
    "trt": "Physician Clinic",
    "ophthalmology": "Physician Clinic",
    "eye": "Physician Clinic",
    "asc": "Hospital",
    "pharmacy": "503A Pharmacy",
}

# Buyer types that cannot be qualified without an identified supervising clinician
NEEDS_MEDICAL_DIRECTOR = {"Med Spa w/ Medical Director"}


def normalize_name(name: str) -> str:
    """Aggressive normalization for dedupe: lowercase, drop punctuation, entity suffixes,
    and finally ALL whitespace — so 'Med Spa'/'MedSpa' and 'Eye Care'/'Eyecare' collapse
    to the same key. Over-merging two genuinely different businesses whose names differ
    only by spacing is rare; every merge is recorded in rejects.csv, so nothing is lost
    silently."""
    n = name.lower().strip()
    n = re.sub(r"[^\w\s]", " ", n)
    n = re.sub(
        r"\b(llc|inc|pllc|pc|pa|ltd|corp|co|the|and|of|md|do|dr)\b", " ", n
    )
    return re.sub(r"\s+", "", n)


def map_buyer_type(specialty: str) -> str:
    s = (specialty or "").lower()
    for key, val in BUYER_TYPE_MAP.items():
        if key in s:
            return val
    return "Physician Clinic"


def clean_state(state: str) -> str:
    return (state or "").strip().upper()[:2]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir")
    ap.add_argument("output_dir")
    ap.add_argument("--batch", default=date.today().strftime("%Y%m"))
    args = ap.parse_args()

    in_dir = pathlib.Path(args.input_dir)
    out_dir = pathlib.Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(in_dir.glob("*.csv"))
    if not files:
        print(f"No CSV files found in {in_dir}", file=sys.stderr)
        return 1

    buyers, contacts, worklist, rejects = [], [], [], []
    seen: dict[tuple[str, str], str] = {}
    # Evidence for the near-duplicate review: city/phone/source per accepted row.
    # buyers-import.csv doesn't carry these (its columns mirror the CRM buyers
    # table), but a human deciding "same practice or not?" needs them ON the
    # review row — the first run produced 602 name-pairs with no way to judge
    # any of them without grepping the raw CSV per pair.
    meta: dict[tuple[str, str], tuple[str, str, str]] = {}

    for path in files:
        with path.open(newline="", encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                name = (row.get("Name") or "").strip()
                state = clean_state(row.get("State", ""))
                source_file = path.name

                if not name or not state:
                    rejects.append([name, state, source_file, "missing name or state"])
                    continue

                if state in CARVE_OUT_STATES:
                    rejects.append(
                        [name, state, source_file, f"carve-out state {state}"]
                    )
                    continue

                key = (normalize_name(name), state)
                if key in seen:
                    rejects.append(
                        [name, state, source_file, f"duplicate of row from {seen[key]}"]
                    )
                    continue
                seen[key] = source_file
                meta[key] = (
                    (row.get("City") or "").strip().title(),
                    re.sub(r"\D", "", row.get("Phone") or "")[-10:],  # digits, last 10
                    (row.get("Source URL") or "").strip(),
                )

                specialty = row.get("Specialty", "")
                buyer_type = map_buyer_type(specialty)
                director = (row.get("Owner or Medical Director") or "").strip()
                batch = f"import:{pathlib.Path(source_file).stem}-{args.batch}"

                buyers.append(
                    [
                        name,
                        "",                       # DBA
                        buyer_type,
                        state,
                        (row.get("Website") or "").strip(),
                        "Prospect",               # Status — qualification happens in CRM
                        "Founder",                # Owner
                        batch,
                    ]
                )

                if director:
                    contacts.append(
                        [
                            director,
                            "Owner / Medical Director",
                            "",                   # Email — filled by finder + verifier
                            "Unverified",
                            (row.get("Phone") or "").strip(),
                            "New",
                            batch,
                            name,                 # trailing helper column: link target
                        ]
                    )

                if buyer_type in NEEDS_MEDICAL_DIRECTOR and not director:
                    worklist.append(
                        [
                            name,
                            (row.get("City") or "").strip(),
                            state,
                            (row.get("Website") or "").strip(),
                            "find medical director / supervising clinician before qualifying",
                            (row.get("Source URL") or "").strip(),
                        ]
                    )

    # Near-duplicate detection. Per WF6 in docs/04-workflows.md, fuzzy matches are
    # FLAGGED for a human merge decision and never auto-merged: two genuinely distinct
    # practices can have very similar names, and silently collapsing them loses a real
    # prospect. Compared within-state only; O(n^2) per state is fine at this scale.
    # Two triggers, because pure edit-ratio misses the most common real-world variant:
    # one name simply appends a word ("Valley Eye Care" vs "Valley Eyecare Center PC"
    # scores only 0.81). Containment catches those. Threshold is deliberately more
    # sensitive than the 0.92 in WF6 — a false flag costs one glance at a review row,
    # a missed duplicate costs a double-contacted prospect.
    NEAR_DUPE_RATIO = 0.88
    MIN_CONTAINMENT_LEN = 8
    by_state: dict[str, list[tuple[str, str]]] = {}
    for row in buyers:
        by_state.setdefault(row[3], []).append((row[0], normalize_name(row[0])))

    # Each flagged pair gets the registry's own evidence and a verdict, then the
    # file is sorted so the real merge work sits at the top. NOTHING is merged
    # here (WF6: fuzzy matches are a human decision) — the verdict only orders
    # and frames the review:
    #   LIKELY SAME      both rows share a phone number. One practice, two name
    #                    spellings. These are the rows worth careful eyes.
    #   LIKELY DISTINCT  different city AND different phone. NPPES names are
    #                    formulaic ("Valley Eye Care" / "West Valley Eye Care
    #                    Center"), so most flags land here — skim, don't study.
    #   REVIEW           evidence incomplete or mixed. Actual judgment calls.
    VERDICT_ORDER = {"LIKELY SAME": 0, "REVIEW": 1, "LIKELY DISTINCT": 2}
    near_dupes: list[list[str]] = []
    for st, entries in by_state.items():
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                a, b = entries[i][1], entries[j][1]
                ratio = difflib.SequenceMatcher(None, a, b).ratio()
                shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
                contained = (
                    len(shorter) >= MIN_CONTAINMENT_LEN and shorter in longer
                )
                if ratio >= NEAR_DUPE_RATIO or contained:
                    reason = "containment" if contained else "similarity"
                    city_a, phone_a, url_a = meta.get((a, st), ("", "", ""))
                    city_b, phone_b, url_b = meta.get((b, st), ("", "", ""))
                    if phone_a and phone_a == phone_b:
                        verdict = "LIKELY SAME"
                    elif (
                        city_a and city_b and city_a != city_b
                        and phone_a and phone_b and phone_a != phone_b
                    ):
                        verdict = "LIKELY DISTINCT"
                    else:
                        verdict = "REVIEW"
                    near_dupes.append(
                        [
                            verdict,
                            entries[i][0], city_a, phone_a, url_a,
                            entries[j][0], city_b, phone_b, url_b,
                            st,
                            f"{ratio:.3f} ({reason})",
                        ]
                    )
    near_dupes.sort(key=lambda r: (VERDICT_ORDER.get(r[0], 1), r[9], r[1]))

    def write(fname: str, header: list[str], rows: list[list[str]]) -> None:
        with (out_dir / fname).open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(header)
            w.writerows(rows)
        print(f"{fname:28} {len(rows):5} rows")

    write(
        "buyers-import.csv",
        ["Name", "DBA", "Buyer Type", "State", "Website", "Status", "Owner", "Source"],
        buyers,
    )
    write(
        "contacts-import.csv",
        [
            "Name",
            "Title",
            "Email",
            "Email Status",
            "Phone",
            "Outreach Status",
            "Source",
            "Buyer",
        ],
        contacts,
    )
    write(
        "qualification-worklist.csv",
        ["Name", "City", "State", "Website", "Action", "Source URL"],
        worklist,
    )
    write("rejects.csv", ["Name", "State", "Source File", "Reason"], rejects)
    write(
        "near-duplicate-review.csv",
        [
            "Verdict",
            "Name A", "City A", "Phone A", "Registry A",
            "Name B", "City B", "Phone B", "Registry B",
            "State", "Similarity",
        ],
        near_dupes,
    )

    by_verdict = {v: 0 for v in VERDICT_ORDER}
    for r in near_dupes:
        by_verdict[r[0]] = by_verdict.get(r[0], 0) + 1

    print(f"\nSource files: {len(files)}")
    print(f"Unique buyers: {len(buyers)}   contacts: {len(contacts)}")
    print(f"Need director research before outreach: {len(worklist)}")
    print(f"Rejected: {len(rejects)} (see rejects.csv — nothing dropped silently)")
    print(
        f"Near-duplicate pairs for human review: {len(near_dupes)} "
        "(not auto-merged, per WF6)"
    )
    print(
        f"  likely same (shared phone — review these): {by_verdict['LIKELY SAME']}\n"
        f"  judgment calls (mixed evidence):           {by_verdict['REVIEW']}\n"
        f"  likely distinct (diff city+phone — skim):  {by_verdict['LIKELY DISTINCT']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
