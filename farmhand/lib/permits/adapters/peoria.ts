/**
 * INGEST — Peoria, AZ. The best source in the program.
 *
 * https://gis.peoriaaz.gov/arcgis/rest/services/Accela/Solar_Parcels/MapServer/0
 * Public, no auth, no token. Verified live 2026-08-10.
 *
 * It is a purpose-built SOLAR layer, which changes the shape of the work here:
 *
 *   - 8312 rows, every one USER_B1_APPL_STATUS='Final'. Completed-only is free;
 *     there is no status vocabulary to decode and no incomplete permits to
 *     filter out.
 *   - Occupancy is STRUCTURED: USER_B1_CHECKLIST_COMMENT is '801 - Photovoltaic
 *     RES' (7364) or '806 - Photovoltaic COM' (65). No description heuristics.
 *   - Battery is STRUCTURED: USER_B1_CHECKBOX_DESC='Battery Storage' (883). No
 *     free-text keyword matching, and therefore none of its failure modes.
 *
 * So this adapter sets classOverride and occupancyOverride and lets the shared
 * set-difference do the rest. Running Peoria through the text classifier would
 * only add error to data the city has already classified.
 *
 * THE ONE CAVEAT: the layer has NO DATE FIELD. Year is decoded from the
 * permit-number prefix (USER_B1_ALT_ID like '26%'), so completionSource is
 * "permit-number-prefix" — weaker than a completion date and labeled as such.
 * Verified year histogram of solar parcels:
 *   2019:1160  2020:1168  2021:1335  2022:1451  2023:832  2024:541
 *   2025:509   2026:97                                  (sums to 7093)
 * History starts in 2019, so a "2 to 20 year" window really means 2019–2024
 * here. The depth does not exist; do not imply it.
 *
 * Two companion layers, not used by this adapter but worth recording:
 *   .../Peoria_Building_Permit_All/FeatureServer/3 — dates + installer, but a
 *     ROLLING 12-MONTH WINDOW (verified min IssDate 2025-08-12). It must be
 *     polled and accumulated over time; it is not history and must never be
 *     treated as such.
 *   .../PeoriaBuildingPermitProgress/FeatureServer/1 — 124 fields including
 *     OWN_NAME and owner mailing address, which may remove the assessor join
 *     for Peoria entirely.
 */

import type { PermitRecord } from "../types";
import { normalizeApn } from "../types";
import { arcgisQueryAll } from "./arcgis";

export const PEORIA_SOLAR_LAYER =
  "https://gis.peoriaaz.gov/arcgis/rest/services/Accela/Solar_Parcels/MapServer/0";

/** Companion layers — recorded for the follow-on work, not queried here. */
export const PEORIA_PERMIT_ALL_LAYER =
  "https://gis.peoriaaz.gov/arcgis/rest/services/Accela/Peoria_Building_Permit_All/FeatureServer/3";
export const PEORIA_PERMIT_PROGRESS_LAYER =
  "https://gis.peoriaaz.gov/arcgis/rest/services/Accela/PeoriaBuildingPermitProgress/FeatureServer/1";

const FIELDS = {
  permitNumber: "USER_B1_ALT_ID",
  address: "USER_B1_FULL_ADDRESS",
  apn: "USER_B1_PARCEL_NBR",
  group: "USER_B1_PER_GROUP",
  type: "USER_B1_PER_TYPE",
  subType: "USER_B1_PER_SUB_TYPE",
  checkbox: "USER_B1_CHECKBOX_DESC",
  checklist: "USER_B1_CHECKLIST_COMMENT",
  status: "USER_B1_APPL_STATUS",
} as const;

const PAGE_SIZE = 5000; // layer maxRecordCount
export const PEORIA_RES_PV_CODE = "801 - Photovoltaic RES";
export const PEORIA_COM_PV_CODE = "806 - Photovoltaic COM";
export const PEORIA_BATTERY_FLAG = "Battery Storage";

/** Verified live counts — a large divergence from these means something broke. */
export const PEORIA_VERIFIED = {
  totalRows: 8312,
  resPv: 7364,
  comPv: 65,
  batteryRows: 883,
  distinctResPvParcels: 7093,
  yearHistogram: {
    2019: 1160, 2020: 1168, 2021: 1335, 2022: 1451,
    2023: 832, 2024: 541, 2025: 509, 2026: 97,
  } as Record<number, number>,
  /** Earliest year present. Anything older is absent from the source, not filtered out. */
  historyStartsYear: 2019,
} as const;

export type PeoriaRow = Record<string, unknown>;

/**
 * Decode the install year from the permit-number prefix.
 *
 * Permit numbers lead with a two-digit year ('26...' = 2026). Rejects anything
 * outside the plausible range rather than coercing, since a bad decode here
 * silently moves a parcel in or out of the recency window.
 */
export function peoriaYearFromPermitNumber(permitNumber: string, currentYear: number): number | undefined {
  const m = /^(\d{2})/.exec(permitNumber.trim());
  if (!m) return undefined;
  const year = 2000 + Number(m[1]);
  if (year < 1990 || year > currentYear + 1) return undefined;
  return year;
}

export function peoriaRowToRecord(row: PeoriaRow, fetchedAt: string): PermitRecord | null {
  const permitNumber = String(row[FIELDS.permitNumber] ?? "").trim();
  const checklist = String(row[FIELDS.checklist] ?? "").trim();
  const checkbox = String(row[FIELDS.checkbox] ?? "").trim();
  const isBattery = checkbox === PEORIA_BATTERY_FLAG;
  const isResPv = checklist === PEORIA_RES_PV_CODE;
  const isComPv = checklist === PEORIA_COM_PV_CODE;
  if (!isBattery && !isResPv && !isComPv) return null;

  const year = peoriaYearFromPermitNumber(permitNumber, new Date(fetchedAt).getUTCFullYear());

  return {
    jurisdiction: "peoria",
    permitNumber,
    apn: normalizeApn(row[FIELDS.apn]),
    address: String(row[FIELDS.address] ?? "").trim().slice(0, 160),
    // Kept for display only. Classification here comes from the structured
    // fields below, never from reading this string.
    description: [checklist, checkbox].filter(Boolean).join(" · ").slice(0, 300),
    finaledYear: year,
    completionSource: year ? "permit-number-prefix" : "unverified",
    permitType: String(row[FIELDS.type] ?? "").trim() || undefined,
    workType: String(row[FIELDS.subType] ?? "").trim() || undefined,
    status: String(row[FIELDS.status] ?? "").trim() || undefined,
    // Every row in this layer is 'Final'; the guard keeps that an assertion
    // about the data rather than an assumption baked into the code.
    completionStatus: String(row[FIELDS.status] ?? "").trim() === "Final" ? "complete" : "unknown",
    classOverride: isBattery ? "battery" : "solar",
    occupancyOverride: isBattery ? undefined : isComPv ? "commercial" : "residential",
    batteryDetection: "source-flag",
    fetchedAt,
  };
}

export interface PeoriaFetchOptions {
  now: string;
  fetchImpl?: typeof fetch;
  maxRows?: number;
}

export async function fetchPeoriaPermits(opts: PeoriaFetchOptions): Promise<PermitRecord[]> {
  const rows = await arcgisQueryAll<PeoriaRow>({
    layerUrl: PEORIA_SOLAR_LAYER,
    // Pull PV and battery rows in one sweep; both are needed for the
    // set-difference and the layer is small enough to take whole.
    where: `${FIELDS.checklist} IN ('${PEORIA_RES_PV_CODE}','${PEORIA_COM_PV_CODE}') OR ${FIELDS.checkbox} = '${PEORIA_BATTERY_FLAG}'`,
    outFields: Object.values(FIELDS),
    pageSize: PAGE_SIZE,
    maxRows: opts.maxRows ?? 20000,
    orderBy: FIELDS.permitNumber,
    fetchImpl: opts.fetchImpl,
  });
  return rows
    .map((r) => peoriaRowToRecord(r, opts.now))
    .filter((r): r is PermitRecord => r !== null);
}
