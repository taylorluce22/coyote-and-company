/**
 * INGEST — Buckeye, AZ. Tyler EnerGov, 51440 permit rows.
 *
 * https://maps.buckeyeaz.gov/server/rest/services/Hosted/EnergovPermitswReviewHistory2/FeatureServer/0
 * Public, no auth. Verified live 2026-08-10.
 *
 * THE FACT THAT DEFINES THIS ADAPTER:
 *
 *   workclass LIKE '%SOLAR%'  returns EXACTLY ZERO.
 *
 * Buckeye classifies solar as PHOTOVOLTAIC. UPPER(workclass) LIKE
 * '%PHOTOVOLTAIC%' returns 8942, and 8066 of those are permitstatus='Finaled'.
 * The two values are 'Photovoltaic System' and 'Photovoltaic Standard Plan'.
 *
 * A SOLAR-keyword adapter would return zero here and read as a coverage gap —
 * "Buckeye must not publish solar permits" — rather than as a bug. That is the
 * same failure shape as the ESS over-fetch and the ZIP-as-city filter: a query
 * that looks right and quietly answers a different question. The keyword set
 * below is asserted in the test suite for exactly that reason.
 *
 * Two more verified constraints:
 *
 *   ADDRESSES ARE WEAK. addressline1 is populated on ~21% of rows and
 *   situsaddress came back blank on sampled solar rows. Join on parcelnumber
 *   (99.8% populated) or geometry, never on address.
 *
 *   BATTERY IS FREE-TEXT ONLY. UPPER(permitdesc) LIKE '%BATTERY%' returns 222
 *   and there is no battery entry among the 106 workclass values. So Buckeye
 *   needs the full hardened battery keyword set and every record is flagged
 *   batteryDetection="description-only" — weaker than Peoria's source flag,
 *   and surfaced rather than assumed equivalent.
 */

import type { PermitRecord } from "../types";
import { normalizeApn } from "../types";
import { detectUtility } from "../utility";
import { arcgisQueryAll } from "./arcgis";

export const BUCKEYE_LAYER =
  "https://maps.buckeyeaz.gov/server/rest/services/Hosted/EnergovPermitswReviewHistory2/FeatureServer/0";

const FIELDS = {
  permitNumber: "permitnumber",
  apn: "parcelnumber",
  status: "permitstatus",
  finalizeDate: "finalizedate",
  issueDate: "issuedate",
  applyDate: "applydate",
  workClass: "workclass",
  description: "permitdesc",
  permitType: "permittype",
  situsAddress: "situsaddress",
  addressLine1: "addressline1",
  postalCode: "postalcode",
} as const;

const PAGE_SIZE = 2000; // layer maxRecordCount

/**
 * Buckeye's word for solar. NOT "solar" — that returns zero rows.
 * Values seen: 'Photovoltaic System', 'Photovoltaic Standard Plan'.
 */
export const BUCKEYE_SOLAR_WORKCLASS_KEYWORD = "PHOTOVOLTAIC";

/** Verified live counts — a large divergence means something broke. */
export const BUCKEYE_VERIFIED = {
  totalRows: 51440,
  workclassSolarKeyword: 0, // the trap: LIKE '%SOLAR%' finds nothing
  workclassPhotovoltaic: 8942,
  photovoltaicFinaled: 8066,
  batteryDescriptionMatches: 222,
  apnPopulatedPct: 99.8,
  addressLine1PopulatedPct: 21,
} as const;

export type BuckeyeRow = Record<string, unknown>;

function epochToIso(v: unknown): string | undefined {
  // EnerGov/ArcGIS date fields come back as epoch milliseconds.
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Only 'Finaled' is confirmed to mean complete. The layer has 18 status values
 * and the rest of the vocabulary has not been enumerated, so everything else is
 * "unknown" rather than guessed into complete or incomplete.
 */
export function classifyBuckeyeStatus(raw: unknown): PermitRecord["completionStatus"] {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "unknown";
  if (s === "FINALED") return "complete";
  return "unknown";
}

export function buckeyeRowToRecord(row: BuckeyeRow, fetchedAt: string): PermitRecord {
  const description = String(row[FIELDS.description] ?? "").trim().slice(0, 2000);
  const finaledAt = epochToIso(row[FIELDS.finalizeDate]);
  const issuedAt = epochToIso(row[FIELDS.issueDate]);
  // situsaddress is blank on sampled solar rows and addressline1 is ~21%
  // populated, so this is best-effort display text only. The join key is the APN.
  const address = (String(row[FIELDS.situsAddress] ?? "").trim() ||
    String(row[FIELDS.addressLine1] ?? "").trim()).slice(0, 160);

  return {
    jurisdiction: "buckeye",
    permitNumber: String(row[FIELDS.permitNumber] ?? "").trim().slice(0, 60),
    apn: normalizeApn(row[FIELDS.apn]),
    address,
    description,
    issuedAt,
    finaledAt,
    finaledYear: finaledAt ? new Date(finaledAt).getUTCFullYear() : undefined,
    completionSource: finaledAt ? "finaled" : issuedAt ? "issued" : "unverified",
    workType: String(row[FIELDS.workClass] ?? "").trim() || undefined,
    permitType: String(row[FIELDS.permitType] ?? "").trim() || undefined,
    status: String(row[FIELDS.status] ?? "").trim() || undefined,
    completionStatus: classifyBuckeyeStatus(row[FIELDS.status]),
    utility: detectUtility(description),
    // No structured battery field exists here — the shared keyword classifier
    // does the work, and the weaker provenance travels with the record.
    batteryDetection: "description-only",
    fetchedAt,
  };
}

export interface BuckeyeFetchOptions {
  now: string;
  fetchImpl?: typeof fetch;
  maxRows?: number;
}

export function buckeyeWhere(): string {
  const desc = `UPPER(${FIELDS.description})`;
  // Photovoltaic by workclass, plus anything whose description carries battery
  // or PV wording, since battery permits are not their own workclass here.
  return [
    `UPPER(${FIELDS.workClass}) LIKE '%${BUCKEYE_SOLAR_WORKCLASS_KEYWORD}%'`,
    `${desc} LIKE '%PHOTOVOLTAIC%'`,
    `${desc} LIKE '%SOLAR%'`,
    `${desc} LIKE '%BATTER%'`,
    `${desc} LIKE '%POWERWALL%'`,
    `${desc} LIKE '%STORAGE%'`,
    `${desc} LIKE '%KWH%'`,
    `${desc} LIKE '%BESS%'`,
    `${desc} LIKE '% ESS%'`,
  ].join(" OR ");
}

export async function fetchBuckeyePermits(opts: BuckeyeFetchOptions): Promise<PermitRecord[]> {
  const rows = await arcgisQueryAll<BuckeyeRow>({
    layerUrl: BUCKEYE_LAYER,
    where: buckeyeWhere(),
    outFields: Object.values(FIELDS),
    pageSize: PAGE_SIZE,
    maxRows: opts.maxRows ?? 30000,
    orderBy: FIELDS.permitNumber,
    fetchImpl: opts.fetchImpl,
  });
  return rows.map((r) => buckeyeRowToRecord(r, opts.now));
}
