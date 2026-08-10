/**
 * Mesa fixture rows — raw Socrata-shaped objects so tests exercise the same
 * mesaRowToRecord() path as live ingest. Description strings mirror literal
 * text observed in the live dataset ("8.40 KW DC PV SOLAR",
 * "TESLA POWERWALL3", "B.E.S.S.").
 *
 * Dates are derived from a fixed `now` so expectations are deterministic.
 * Expected outcome per parcel (recency window 6 months – 5 years):
 *   APN-A  solar only, 18mo old                  -> TARGET
 *   APN-B  solar + separate POWERWALL3 permit    -> excluded (battery parcel)
 *   APN-C  single combined "PV SOLAR WITH        -> excluded (combined-permit
 *          BATTERY BACKUP 13.5 KWH" permit          rule — the critical false
 *                                                   positive)
 *   APN-D  B.E.S.S. battery only                 -> not a solar parcel
 *   APN-E  SOLAR WATER HEATER only               -> thermal, not PV
 *   APN-F  solar, 7 years old                    -> excluded (too old)
 *   APN-G  solar; description contains ADDRESS   -> TARGET (proves \bESS\b
 *          and PROCESS                              doesn't misfire)
 *   (none) solar with empty parcel_number        -> counted missingApn
 *   APN-I  solar, 2 months old                   -> excluded (too new)
 *   APN-J  solar + separate "ESS INSTALL 27 KWH" -> excluded (battery parcel)
 *   APN-K  solar, no date field at all           -> TARGET, recency "unknown"
 */

import type { SocrataRow } from "../adapters/mesa";

function isoDaysAgo(now: string, days: number): string {
  return new Date(Date.parse(now) - days * 24 * 60 * 60 * 1000).toISOString();
}

export const EXPECTED_TARGET_APNS = ["APNA00000", "APNG00000", "APNK00000"];

export function mesaFixtureRows(now: string): SocrataRow[] {
  return [
    {
      permit_number: "BLD2025-00001",
      parcel_number: "APN-A00-000",
      address: "101 E MAIN ST",
      description_of_work: "8.40 KW DC PV SOLAR",
      issued_date: isoDaysAgo(now, 548), // ~18 months
    },
    {
      permit_number: "BLD2025-00002",
      parcel_number: "APN-B00-000",
      address: "202 W BROWN RD",
      description_of_work: "7.20 KW DC PV SOLAR ROOF MOUNT",
      issued_date: isoDaysAgo(now, 700),
    },
    {
      permit_number: "BLD2025-00003",
      parcel_number: "APN-B00-000",
      address: "202 W BROWN RD",
      description_of_work: "TESLA POWERWALL3",
      issued_date: isoDaysAgo(now, 200),
    },
    {
      permit_number: "BLD2025-00004",
      parcel_number: "APN-C00-000",
      address: "303 N STAPLEY DR",
      description_of_work: "PV SOLAR 7.2 KW WITH BATTERY BACKUP 13.5KWH",
      issued_date: isoDaysAgo(now, 400),
    },
    {
      permit_number: "BLD2025-00005",
      parcel_number: "APN-D00-000",
      address: "404 S GILBERT RD",
      description_of_work: "INSTALL B.E.S.S. 27 KWH",
      issued_date: isoDaysAgo(now, 300),
    },
    {
      permit_number: "BLD2025-00006",
      parcel_number: "APN-E00-000",
      address: "505 E SOUTHERN AVE",
      description_of_work: "SOLAR WATER HEATER REPLACEMENT",
      issued_date: isoDaysAgo(now, 365),
    },
    {
      permit_number: "BLD2019-00007",
      parcel_number: "APN-F00-000",
      address: "606 N COUNTRY CLUB DR",
      description_of_work: "PHOTOVOLTAIC 6.00 KW DC SOLAR",
      issued_date: isoDaysAgo(now, 2555), // ~7 years
    },
    {
      permit_number: "BLD2025-00008",
      parcel_number: "APN-G00-000",
      address: "707 W UNIVERSITY DR",
      description_of_work: "PV SOLAR 9.6 KW DC — PROCESS PANEL UPGRADE AT SAME ADDRESS",
      issued_date: isoDaysAgo(now, 365),
    },
    {
      permit_number: "BLD2025-00009",
      parcel_number: "",
      address: "808 E MCKELLIPS RD",
      description_of_work: "PV SOLAR 5.0 KW DC",
      issued_date: isoDaysAgo(now, 365),
    },
    {
      permit_number: "BLD2026-00010",
      parcel_number: "APN-I00-000",
      address: "909 S DOBSON RD",
      description_of_work: "PHOTOVOLTAIC ROOF MOUNT 6.5 KW DC SOLAR",
      issued_date: isoDaysAgo(now, 60), // ~2 months — too new
    },
    {
      permit_number: "BLD2025-00011",
      parcel_number: "APN-J00-000",
      address: "111 N HORNE",
      description_of_work: "PV SOLAR 8.0 KW DC",
      issued_date: isoDaysAgo(now, 500),
    },
    {
      permit_number: "BLD2025-00012",
      parcel_number: "APN-J00-000",
      address: "111 N HORNE",
      description_of_work: "ESS INSTALL 27 KWH",
      issued_date: isoDaysAgo(now, 100),
    },
    {
      permit_number: "BLD2025-00013",
      parcel_number: "APN-K00-000",
      address: "222 E 8TH AVE",
      description_of_work: "PV SOLAR 4.8 KW DC",
      // no date field at all -> recency "unknown"
    },
  ];
}
