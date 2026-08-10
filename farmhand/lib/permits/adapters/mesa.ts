/**
 * INGEST — Mesa, AZ (P0 jurisdiction).
 *
 * Source: City of Mesa open data (Socrata SODA API), Building Permits dataset
 * dzpk-hxfb. Live-verified 2026-08-10:
 *   - base: https://data.mesaaz.gov/resource/dzpk-hxfb.json (supports $where SoQL)
 *   - APN field: parcel_number
 *   - free text: description_of_work — carries literal strings like
 *     "8.40 KW DC PV SOLAR", "TESLA POWERWALL3", "B.E.S.S."
 *   - description_of_work LIKE %SOLAR% = 1422 rows, LIKE %BATTERY% = 1649 rows
 *
 * The SoQL $where is a coarse over-fetch (any solar-ish OR battery-ish
 * keyword); the local classifier makes the real call. ESS and bare KWH are
 * deliberately absent from the server filter — %ESS% would match ADDRESS —
 * standalone-ESS permits are expected to also say BATTERY / ENERGY STORAGE /
 * B.E.S.S, which the filter does cover.
 *
 * Permit-number / address / issue-date field names are NOT yet live-verified;
 * the adapter tries the candidate lists below in order and keeps working when
 * none match (records land with recency "unknown"). Verify on first live run
 * and promote the winners into VERIFIED_FIELDS.
 */

import type { PermitRecord } from "../types";
import { normalizeApn } from "../types";
import { classifyMesaStatus } from "../status";
import { detectUtility } from "../utility";

export const MESA_DATASET_URL = "https://data.mesaaz.gov/resource/dzpk-hxfb.json";

/**
 * Live-verified against a real record 2026-08-10. No candidate-list guessing
 * remains: every field below was confirmed present on an actual Mesa row.
 *
 * finaled_date is the completion date and finaled_year is the install year, so
 * neither has to be inferred from the issue date on this jurisdiction.
 */
const VERIFIED_FIELDS = {
  permitNumber: "permit_number",
  address: "property_address",
  apn: "parcel_number", // 8-digit, no dashes, e.g. 30433505
  description: "description_of_work",
  status: "status",
  issuedDate: "issued_date",
  finaledDate: "finaled_date",
  finaledYear: "finaled_year",
  contractor: "applicant", // e.g. "SOLARCITY CORP"
  workType: "type_of_work", // e.g. "Res (OTH) -- Electrical"
  permitType: "permit_type",
  valuation: "total_valuation",
} as const;

/**
 * Coarse server-side over-fetch. Every token the local classifier can treat as
 * battery evidence MUST have a match here, or the battery permit is never
 * fetched, never subtracts its parcel, and that parcel lands on the call list
 * as a false positive — the failure the whole module exists to prevent.
 *
 * The earlier revision omitted ESS/BESS/KWH on the theory that a standalone
 * ESS permit would also say BATTERY or ENERGY STORAGE. That was an assumption,
 * not a verified fact, and a real Mesa description reading only
 * "ESS INSTALL 27 KWH" would have been silently skipped. Bare "ESS" can't be
 * used raw (LIKE '%ESS%' matches ADDRESS), so it's space-prefixed; STORAGE and
 * KWH are safe as substrings and catch the same permits by another route.
 * Over-fetching costs a few rows — under-fetching costs list correctness.
 */
const COARSE_KEYWORDS = [
  "SOLAR",
  "PHOTOVOLTAIC",
  "PHOTO-VOLTAIC",
  "PHOTO VOLTAIC",
  "PV",
  "BATTER",
  "POWERWALL",
  "POWER WALL",
  "POWER-WALL",
  "PW3",
  "STORAGE",
  " ESS",
  "BESS",
  "B.E.S.S",
  "KWH",
];

const PAGE_SIZE = 1000;
/**
 * Classification runs on the STORED copy, so anything trimmed here is invisible
 * to battery detection forever. A combined scope that lists the PV array first
 * and the storage system in a trailing clause is exactly the description that
 * runs long, so this has to be generous enough to never cut one in half.
 */
const MAX_DESCRIPTION = 2000;

export type SocrataRow = Record<string, unknown>;

function str(row: SocrataRow, key: string, max = 160): string {
  const v = row[key];
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function date(row: SocrataRow, key: string): string | undefined {
  const v = row[key];
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : undefined;
}

/** Map one raw Socrata row to a PermitRecord. Exported so fixtures exercise the same path as live ingest. */
export function mesaRowToRecord(row: SocrataRow, fetchedAt: string): PermitRecord {
  const description = String(row[VERIFIED_FIELDS.description] ?? "")
    .trim()
    .slice(0, MAX_DESCRIPTION);
  const finaledAt = date(row, VERIFIED_FIELDS.finaledDate);
  const issuedAt = date(row, VERIFIED_FIELDS.issuedDate);
  const rawYear = Number(row[VERIFIED_FIELDS.finaledYear]);

  return {
    jurisdiction: "mesa",
    permitNumber: str(row, VERIFIED_FIELDS.permitNumber, 60),
    apn: normalizeApn(row[VERIFIED_FIELDS.apn]),
    address: str(row, VERIFIED_FIELDS.address),
    description,
    issuedAt,
    finaledAt,
    finaledYear: Number.isFinite(rawYear) && rawYear > 1900 ? rawYear : undefined,
    // Mesa exposes a real completion date, so recency never has to be guessed
    // from the issue date here. Jurisdictions without one must say "unverified"
    // rather than let an install year be quietly derived.
    completionSource: finaledAt ? "finaled" : issuedAt ? "issued" : "unverified",
    status: str(row, VERIFIED_FIELDS.status, 60),
    completionStatus: classifyMesaStatus(row[VERIFIED_FIELDS.status]),
    contractor: str(row, VERIFIED_FIELDS.contractor, 120) || undefined,
    workType: str(row, VERIFIED_FIELDS.workType, 80) || undefined,
    permitType: str(row, VERIFIED_FIELDS.permitType, 80) || undefined,
    utility: detectUtility(description),
    fetchedAt,
  };
}

export function mesaSoqlWhere(): string {
  const field = `upper(${VERIFIED_FIELDS.description})`;
  return COARSE_KEYWORDS.map((k) => `${field} like '%${k}%'`).join(" OR ");
}

export interface MesaFetchOptions {
  /** ISO timestamp injected by the caller — stamped as fetchedAt provenance. */
  now: string;
  fetchImpl?: typeof fetch;
  /** Hard cap on rows pulled across all pages (default 20000). */
  maxRows?: number;
}

export async function fetchMesaPermits(opts: MesaFetchOptions): Promise<PermitRecord[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRows = opts.maxRows ?? 20000;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.MESA_SOCRATA_APP_TOKEN;
  if (token) headers["X-App-Token"] = token;

  const records: PermitRecord[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      $where: mesaSoqlWhere(),
      $order: ":id",
      $limit: String(Math.min(PAGE_SIZE, maxRows - offset)),
      $offset: String(offset),
    });
    const res = await fetchImpl(`${MESA_DATASET_URL}?${params}`, {
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`mesa socrata ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
    const rows = (await res.json()) as SocrataRow[];
    for (const row of rows) records.push(mesaRowToRecord(row, opts.now));
    if (rows.length < PAGE_SIZE) break;
  }
  return records;
}
