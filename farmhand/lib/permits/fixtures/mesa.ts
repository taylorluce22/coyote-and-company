/**
 * Mesa fixture rows — raw Socrata-shaped objects using the LIVE-VERIFIED field
 * names, so tests exercise the same mesaRowToRecord() path as real ingest.
 * Description and status strings mirror text observed in the live dataset.
 *
 * Expected outcome per parcel (recency window 6 months – 5 years):
 *   30433501  completed solar, 18mo old                -> TARGET
 *   30433502  solar + separate POWERWALL3 permit       -> excluded (battery)
 *   30433503  combined "PV SOLAR WITH BATTERY 13.5KWH" -> excluded (combined)
 *   30433504  B.E.S.S. battery only                    -> not a solar parcel
 *   30433505  SOLAR WATER HEATER only                  -> thermal, not PV
 *   30433506  completed solar, 7 years old             -> excluded (too old)
 *   30433507  completed solar; text contains ADDRESS   -> TARGET (ESS boundary)
 *   (blank)   solar with empty parcel_number           -> counted missingApn
 *   30433509  completed solar, 2 months old            -> excluded (too new)
 *   30433510  solar + separate "ESS INSTALL 27 KWH"    -> excluded (battery)
 *   30433511  completed solar, no dates at all         -> TARGET, recency unknown
 *   30433512  THE ANCILLARY TRAP — real Mesa text, a
 *             225 AMP panel/meter upgrade FOR PV SOLAR -> excluded (not an install)
 *   30433513  install that ALSO upgrades the panel     -> TARGET (array present)
 *   30433514  solar, status "Issued" (not complete)    -> excluded (incomplete)
 *   30433515  solar, status "Finaled – C of C          -> excluded, flagged
 *             Required" with an EN DASH                   ambiguous (not complete)
 */

import type { SocrataRow } from "../adapters/mesa";

function isoDaysAgo(now: string, days: number): string {
  return new Date(Date.parse(now) - days * 24 * 60 * 60 * 1000).toISOString();
}

export const EXPECTED_TARGET_APNS = ["30433501", "30433507", "30433511", "30433513"];

/**
 * All twelve status strings observed live, with their real counts. The
 * "Finaled – C of C Required" entry carries a genuine EN DASH (U+2013) so the
 * normalizer is exercised on the real byte sequence, and so a naive
 * startsWith("Finaled") is caught.
 */
export const MESA_STATUS_FIXTURES: Array<{
  status: string;
  count: number;
  expect: "complete" | "incomplete" | "ambiguous";
}> = [
  { status: "C of C Issued", count: 1107, expect: "complete" },
  { status: "Finaled", count: 146, expect: "complete" },
  { status: "C of O Issued", count: 15, expect: "complete" },
  { status: "Issued", count: 77, expect: "incomplete" },
  { status: "Fees Due", count: 33, expect: "incomplete" },
  { status: "Revisions Required", count: 17, expect: "incomplete" },
  { status: "Fees Paid", count: 13, expect: "incomplete" },
  { status: "In Review", count: 7, expect: "incomplete" },
  { status: "Ready to Issue", count: 1, expect: "incomplete" },
  { status: "Submitted", count: 1, expect: "incomplete" },
  { status: "Finaled – C of C Required", count: 4, expect: "ambiguous" },
  { status: "Closed", count: 1, expect: "ambiguous" },
];

export function mesaFixtureRows(now: string): SocrataRow[] {
  const complete = (daysAgo: number | null) =>
    daysAgo === null
      ? { status: "C of C Issued" }
      : {
          status: "C of C Issued",
          finaled_date: isoDaysAgo(now, daysAgo),
          finaled_year: new Date(Date.parse(now) - daysAgo * 86400000).getUTCFullYear(),
          issued_date: isoDaysAgo(now, daysAgo + 30),
        };

  return [
    {
      permit_number: "BLD2025-00001",
      parcel_number: "30433501",
      property_address: "101 E MAIN ST",
      description_of_work: "8.40 KW DC PV SOLAR",
      applicant: "SOLARCITY CORP",
      type_of_work: "Res (SFR) -- Solar",
      permit_type: "Building",
      ...complete(548),
    },
    {
      permit_number: "BLD2025-00002",
      parcel_number: "30433502",
      property_address: "202 W BROWN RD",
      description_of_work: "7.20 KW DC PV SOLAR ROOF MOUNT",
      ...complete(700),
    },
    {
      permit_number: "BLD2025-00003",
      parcel_number: "30433502",
      property_address: "202 W BROWN RD",
      description_of_work: "TESLA POWERWALL3",
      ...complete(200),
    },
    {
      permit_number: "BLD2025-00004",
      parcel_number: "30433503",
      property_address: "303 N STAPLEY DR",
      description_of_work: "PV SOLAR 7.2 KW WITH BATTERY BACKUP 13.5KWH",
      ...complete(400),
    },
    {
      permit_number: "BLD2025-00005",
      parcel_number: "30433504",
      property_address: "404 S GILBERT RD",
      description_of_work: "INSTALL B.E.S.S. 27 KWH",
      ...complete(300),
    },
    {
      permit_number: "BLD2025-00006",
      parcel_number: "30433505",
      property_address: "505 E SOUTHERN AVE",
      description_of_work: "SOLAR WATER HEATER REPLACEMENT",
      ...complete(365),
    },
    {
      permit_number: "BLD2019-00007",
      parcel_number: "30433506",
      property_address: "606 N COUNTRY CLUB DR",
      description_of_work: "PHOTOVOLTAIC 6.00 KW DC SOLAR",
      ...complete(2555),
    },
    {
      permit_number: "BLD2025-00008",
      parcel_number: "30433507",
      property_address: "707 W UNIVERSITY DR",
      description_of_work: "PV SOLAR 9.6 KW DC — PROCESS UPGRADE AT SAME ADDRESS",
      ...complete(365),
    },
    {
      permit_number: "BLD2025-00009",
      parcel_number: "",
      property_address: "808 E MCKELLIPS RD",
      description_of_work: "PV SOLAR 5.0 KW DC",
      ...complete(365),
    },
    {
      permit_number: "BLD2026-00010",
      parcel_number: "30433509",
      property_address: "909 S DOBSON RD",
      description_of_work: "PHOTOVOLTAIC ROOF MOUNT 6.5 KW DC SOLAR",
      ...complete(60),
    },
    {
      permit_number: "BLD2025-00011",
      parcel_number: "30433510",
      property_address: "111 N HORNE",
      description_of_work: "PV SOLAR 8.0 KW DC",
      ...complete(500),
    },
    {
      permit_number: "BLD2025-00012",
      parcel_number: "30433510",
      property_address: "111 N HORNE",
      description_of_work: "ESS INSTALL 27 KWH",
      ...complete(100),
    },
    {
      permit_number: "BLD2025-00013",
      parcel_number: "30433511",
      property_address: "222 E 8TH AVE",
      description_of_work: "PV SOLAR 4.8 KW DC",
      ...complete(null), // completed, but no dates at all -> recency "unknown"
    },
    {
      // The live trap, verbatim shape: an electrical permit whose subject is a
      // service panel, done FOR a PV system. Must not count as an install.
      permit_number: "BLD2025-00014",
      parcel_number: "30433512",
      property_address: "333 W BASELINE RD",
      description_of_work:
        "ELECTRICAL PERMIT TO INSTALL 225 AMP PANEL METER MAIN COMBO FOR PV SOLAR PER SRP SPECIFICATIONS",
      type_of_work: "Res (OTH) -- Electrical",
      ...complete(365),
    },
    {
      // The other side of the trap: a real array that also upgrades the panel.
      permit_number: "BLD2025-00015",
      parcel_number: "30433513",
      property_address: "444 E GUADALUPE RD",
      description_of_work: "INSTALL 7.5 KW PV SOLAR AND 200 AMP MAIN PANEL UPGRADE",
      ...complete(365),
    },
    {
      permit_number: "BLD2026-00016",
      parcel_number: "30433514",
      property_address: "555 N GREENFIELD RD",
      description_of_work: "PV SOLAR 6.0 KW DC",
      status: "Issued", // permitted, not built
      issued_date: isoDaysAgo(now, 400),
    },
    {
      permit_number: "BLD2026-00017",
      parcel_number: "30433515",
      property_address: "666 S POWER RD",
      description_of_work: "PV SOLAR 5.5 KW DC",
      status: "Finaled – C of C Required", // EN DASH — still owes a certificate
      finaled_date: isoDaysAgo(now, 400),
      issued_date: isoDaysAgo(now, 430),
    },
  ];
}
