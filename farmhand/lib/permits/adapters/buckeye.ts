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
 * that looks right and quietly answers a different question. So the exact
 * workclass values are enumerated (not approximated with a LIKE) and asserted
 * against the live layer before every fetch; drift raises an error.
 *
 * This is the best source in the program on one axis that matters more than
 * volume: every row carries a REAL finalizedate. No year inference, unlike
 * Peoria's permit-number prefix. 0 of 8066 finaled rows were missing it.
 *
 * Two more verified constraints:
 *
 *   ADDRESSES ARE WEAK. addressline1 is populated on ~21% of rows and
 *   situsaddress came back blank on sampled solar rows. Join on parcelnumber
 *   (99.8% populated) or geometry, never on address.
 *
 *   BATTERY IS FREE-TEXT ONLY — there is no battery workclass. The keyword set
 *   matched 2575 permits across 1816 parcels, and every record is flagged
 *   batteryDetection="description-only", weaker than Peoria's source flag and
 *   surfaced rather than assumed equivalent.
 */

import type { PermitRecord } from "../types";
import { normalizeApn } from "../types";
import { detectUtility } from "../utility";
import { arcgisQueryAll, assertVocabulary } from "./arcgis";
import { BATTERY_COARSE_TOKENS, SOLAR_COARSE_TOKENS, likeAny } from "../coarseNet";

export const BUCKEYE_LAYER =
  "https://maps.buckeyeaz.gov/server/rest/services/Hosted/EnergovPermitswReviewHistory2/FeatureServer/0";

const FIELDS = {
  objectId: "objectid",
  permitNumber: "permitnumber",
  apn: "parcelnumber",
  status: "permitstatus",
  finalizeDate: "finalizedate",
  issueDate: "issuedate",
  applyDate: "applydate",
  workClass: "workclass",
  permitClass: "permitclass",
  description: "permitdesc",
  projectName: "projectname",
  permitType: "permittype",
  squareFeet: "squarefeet",
  value: "value",
  situsAddress: "situsaddress",
  addressLine1: "addressline1",
  city: "city",
  postalCode: "postalcode",
} as const;

const PAGE_SIZE = 2000; // layer maxRecordCount

/**
 * The EXACT solar workclass values, enumerated live with returnDistinctValues
 * rather than approximated with a LIKE. Buckeye's word is "Photovoltaic";
 * "Solar" matches nothing at all.
 */
export const BUCKEYE_SOLAR_WORKCLASSES = [
  "Photovoltaic System",
  "Photovoltaic Standard Plan",
] as const;

/**
 * All 14 permitstatus values observed on PV rows. Only "Finaled" means the
 * system is in. The rest are either in-flight or terminal-without-completion,
 * and enumerating them is what lets a genuinely unseen status be reported as
 * unknown instead of quietly bucketed.
 */
export const BUCKEYE_PV_STATUSES = [
  "Amended",
  "Applied",
  "Applied - Online",
  "Approved",
  "Cancelled",
  "Expired",
  "Finaled",
  "Issued",
  "On Hold",
  "Re-Issued",
  "Ready",
  "Returned to Applicant",
  "Routed for Subsequent Review",
  "Void",
] as const;

export const BUCKEYE_COMPLETE_STATUS = "Finaled";

/**
 * Verified live 2026-08-10 by pulling and processing all 8066 finaled rows,
 * then re-derived after the SQL-LIKE battery bug was found and fixed.
 *
 * Derivation, which reconciles exactly (7661 − 870 − 90 − 533 = 6168):
 *   8066 finaled photovoltaic permits over 7661 distinct parcels
 *   − 870 parcels whose SOLAR permit description itself mentions a battery
 *   −  90 parcels with a separate battery permit dated on/after the solar
 *   − 533 parcels completed less than 2 years ago
 *   −   0 too old, and 0 rows missing a final date
 *   = 6168 targets
 *
 * The count went UP from an earlier 6063 because matching battery terms in
 * SQL with LIKE '%ESS %' also matched "ADDRESS ", wrongly excluding ~105 real
 * homes. That error at least failed safe; the reverse spelling would not have.
 *
 * Note which rule carries the weight: the combined-permit scan (870) does
 * nearly ten times the work of separate battery permits (90). Scanning for
 * battery keywords INSIDE solar descriptions is the load-bearing rule here,
 * exactly as it was in Mesa.
 */
export const BUCKEYE_VERIFIED = {
  totalRows: 51440,
  workclassSolarKeyword: 0, // the trap: LIKE '%SOLAR%' finds nothing
  workclassPhotovoltaic: 8942,
  photovoltaicFinaled: 8066,
  distinctParcels: 7661,
  excludedCombinedPermit: 870,
  excludedSeparateBattery: 90,
  excludedTooNew: 533,
  excludedTooOld: 0,
  missingFinalDate: 0,
  targets: 6168,
  batteryPermitMatches: 2575,
  batteryDistinctParcels: 1816,
  apnPopulatedPct: 99.8,
  addressLine1PopulatedPct: 21,
  /** Storage permits with neither a finalize nor an issue date — see the dating policy note. */
  undatedStoragePermits: 102,
  /** History starts here — same as Peoria. Do not claim 20 years of depth. */
  historyStartsYear: 2019,
} as const;

/** Buckeye's own parcel layer — may carry owner + mailing address, which would remove the assessor join. NOT yet verified. */
export const BUCKEYE_PARCEL_LAYER =
  "https://maps.buckeyeaz.gov/server/rest/services/Cadastral/Parcels/FeatureServer/0";

export type BuckeyeRow = Record<string, unknown>;

function epochToIso(v: unknown): string | undefined {
  // EnerGov/ArcGIS date fields come back as epoch milliseconds.
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * "Finaled" is complete. The other 13 enumerated values are in-flight or
 * terminal-without-completion, so they are incomplete — a real answer, not a
 * guess, because the vocabulary was enumerated live. Anything OUTSIDE those 14
 * is genuinely new and returns "unknown" rather than being folded into either
 * bucket.
 */
const BUCKEYE_STATUS_SET = new Set(BUCKEYE_PV_STATUSES.map((s) => s.toUpperCase()));

export function classifyBuckeyeStatus(raw: unknown): PermitRecord["completionStatus"] {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "unknown";
  if (s === BUCKEYE_COMPLETE_STATUS.toUpperCase()) return "complete";
  if (BUCKEYE_STATUS_SET.has(s)) return "incomplete";
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
    // No contractor field exists in this layer — projectname is not one, and
    // mapping it there would put a project label in a contractor column.
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

const sqlList = (values: readonly string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");

export function buckeyeWhere(): string {
  const desc = `UPPER(${FIELDS.description})`;
  // Exact workclass values, not a LIKE — the vocabulary is enumerated and
  // asserted, so drift raises an error instead of quietly matching less.
  //
  // Battery has no workclass here, so the description net widens the pull.
  // That net contains only SAFE substrings and never decides anything: no
  // ESS/BESS/RESU in SQL, because LIKE cannot express a word boundary. The
  // word-bounded classifier makes the call in code.
  return [
    `${FIELDS.workClass} IN (${sqlList(BUCKEYE_SOLAR_WORKCLASSES)})`,
    likeAny(desc, SOLAR_COARSE_TOKENS),
    likeAny(desc, BATTERY_COARSE_TOKENS),
  ].join(" OR ");
}

export async function fetchBuckeyePermits(opts: BuckeyeFetchOptions): Promise<PermitRecord[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  // Pre-flight: if a configured vocabulary value stops matching rows, fail
  // loudly. A renamed workclass would otherwise read as "Buckeye has no solar
  // permits" — a coverage gap rather than the bug it is.
  await assertVocabulary(
    BUCKEYE_LAYER,
    [
      { field: FIELDS.workClass, expected: [...BUCKEYE_SOLAR_WORKCLASSES] },
      {
        field: FIELDS.status,
        expected: [BUCKEYE_COMPLETE_STATUS],
        where: `${FIELDS.workClass} IN (${sqlList(BUCKEYE_SOLAR_WORKCLASSES)})`,
      },
    ],
    fetchImpl
  );

  const rows = await arcgisQueryAll<BuckeyeRow>({
    layerUrl: BUCKEYE_LAYER,
    where: buckeyeWhere(),
    outFields: Object.values(FIELDS),
    pageSize: PAGE_SIZE,
    maxRows: opts.maxRows ?? 30000,
    // objectid ASC: without a stable order, resultOffset paging repeats and
    // skips rows. Verified requirement on this layer.
    orderBy: `${FIELDS.objectId} ASC`,
    fetchImpl,
  });

  // An adapter that returns zero is an error, never a result.
  if (rows.length === 0) {
    throw new Error(
      "buckeye: query returned zero rows. The vocabulary check passed, so this is a query or layer change — not an empty city."
    );
  }
  return rows.map((r) => buckeyeRowToRecord(r, opts.now));
}
