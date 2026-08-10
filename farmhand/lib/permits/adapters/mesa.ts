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

export const MESA_DATASET_URL = "https://data.mesaaz.gov/resource/dzpk-hxfb.json";

/** Live-verified 2026-08-10. */
const VERIFIED_FIELDS = {
  apn: "parcel_number",
  description: "description_of_work",
} as const;

const PERMIT_NUMBER_CANDIDATES = [
  "permit_number",
  "permit_no",
  "record_number",
  "case_number",
  "permit_id",
];
const ADDRESS_CANDIDATES = [
  "address",
  "site_address",
  "full_address",
  "permit_address",
  "project_address",
];
const DATE_CANDIDATES = [
  "issued_date",
  "issue_date",
  "permit_issued_date",
  "issueddate",
  "final_date",
  "applied_date",
];

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

function pick(row: SocrataRow, candidates: string[]): string {
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickDate(row: SocrataRow): string | undefined {
  for (const key of DATE_CANDIDATES) {
    const v = row[key];
    if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return v;
  }
  return undefined;
}

/** Map one raw Socrata row to a PermitRecord. Exported so fixtures exercise the same path as live ingest. */
export function mesaRowToRecord(row: SocrataRow, fetchedAt: string): PermitRecord {
  return {
    jurisdiction: "mesa",
    permitNumber: pick(row, PERMIT_NUMBER_CANDIDATES),
    apn: normalizeApn(row[VERIFIED_FIELDS.apn]),
    address: pick(row, ADDRESS_CANDIDATES).slice(0, 160),
    description: String(row[VERIFIED_FIELDS.description] ?? "")
      .trim()
      .slice(0, MAX_DESCRIPTION),
    issuedAt: pickDate(row),
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
