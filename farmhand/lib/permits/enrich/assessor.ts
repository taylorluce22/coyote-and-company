/**
 * ENRICH, hop 1: APN -> owner, occupancy, and property facts.
 *
 * ============================================================================
 * NO TOKEN. NO API KEY. NO CONTACT FORM.
 * ============================================================================
 *
 * The plan used to be the Maricopa Assessor API behind a free token requested
 * by email. That was unnecessary: the county publishes the entire assessment
 * roll as a public, unauthenticated ArcGIS layer. 1,742,671 parcels, 101
 * fields. A full join against all 6,197 Buckeye targets matched 6,192 — a
 * 99.9% hit rate — in about thirty seconds.
 *
 *   PRIMARY   Parcel_Data_View / ASR_Parcels    (fields used below)
 *   FALLBACK  Parcels_view / T_PARCELS          1,759,743 rows, different
 *                                               field names, same content
 *
 * JOIN KEY: the assessor's APN field is the bare 8–9 character form with no
 * dashes, which matches Buckeye `parcelnumber` and Mesa `parcel_number`
 * directly. APNDash carries the 503-96-720 form, for display only.
 *
 * ============================================================================
 * THIS IS NOT AN OWNER LOOKUP — IT IS FOUR THINGS WE COULD NOT DO BEFORE
 * ============================================================================
 *
 * 1. OWNER OCCUPANCY. Owner mailing address vs. property address. On the
 *    Buckeye set: 5,490 owner-occupied, 670 absentee, 214 flagged Rental. An
 *    absentee owner is a landlord, not a battery buyer, so absentee is a
 *    SEPARATE SEGMENT and out of the default queue — pitching one wastes a
 *    dial.
 *
 * 2. A REAL RESIDENTIAL GATE. PropertyUseDescription is authoritative ("SFR
 *    GRADE 010-3 URBAN SUBDIVIDED"). Of 6,192 matched Buckeye targets, 6,156
 *    are SFR and 36 are not — and those 36 are exactly the commercial
 *    contamination the description-text rules kept missing. This becomes the
 *    PRIMARY residential gate; the kW-size heuristic demotes to a secondary
 *    check.
 *
 * 3. SEGMENTATION. Pool is populated (1,335 of the Buckeye targets have one),
 *    and a pool is a large summer load — a concrete reason that household
 *    benefits from storage. Livable area, construction year and full cash
 *    value are free qualification on top.
 *
 * 4. A DELIVERABLE ADDRESS. Every lead now has a mailing address, which makes
 *    the mail channel the compliance design already routes cell-only
 *    households toward actually buildable.
 *
 * WHAT IS STILL NOT FREE: phone numbers. They exist in no public record. That
 * remains the licensed, marketing-permissible append behind the compliance
 * gate, unchanged. Nothing here makes the list call-ready.
 */

import { arcgisQueryAll } from "../adapters/arcgis";
import { normalizeApn, type AssessorData, type LeadSegment, type Provenance, type Sourced } from "../types";

/** The record shape lives in ../types so COMPLY can read it without importing this module. */
export type AssessorRecord = AssessorData;

export const ASSESSOR_SOURCE = "maricopa-assessor-arcgis";

export const ASSESSOR_LAYER =
  "https://services.arcgis.com/ykpntM6e3tHvzKRJ/arcgis/rest/services/Parcel_Data_View/FeatureServer/0";

/** Equivalent layer, different field names. Kept as a fallback, not a mirror to merge. */
export const ASSESSOR_FALLBACK_LAYER =
  "https://services.arcgis.com/ykpntM6e3tHvzKRJ/arcgis/rest/services/Parcels_view/FeatureServer/0";

/** Live-verified counts. A future run that departs from these is a regression, not a market shift. */
export const ASSESSOR_VERIFIED = {
  parcelsPrimary: 1742671,
  parcelsFallback: 1759743,
  fieldsPrimary: 101,
  buckeyeTargets: 6197,
  buckeyeMatched: 6192,
  buckeyeOwnerOccupied: 5490,
  buckeyeAbsentee: 670,
  buckeyeRentalFlagged: 214,
  buckeyeSfr: 6156,
  buckeyeNonSfr: 36,
  buckeyeWithPool: 1335,
  /** Buckeye's permit system covers some 85340 addresses that the assessor calls Litchfield Park. */
  buckeyeRowsInLitchfieldPark: 293,
  /** Sums to buckeyeMatched — the histogram and the join agree. */
  buckeyeInstallYears: { 2019: 735, 2020: 1141, 2021: 1402, 2022: 1364, 2023: 1207, 2024: 343 } as Record<number, number>,
} as const;

const FIELDS = [
  "APN",
  "APNDash",
  "OwnerName",
  "OwnerAddressLine1",
  "OwnerAddressLine2",
  "OwnerCity",
  "OwnerState",
  "OwnerZipCode",
  "PropertyFullStreetAddress",
  "PropertyCity",
  "PropertyZipCode",
  "PropertyUseDescription",
  "Rental",
  "LivableArea_SqFt",
  "ConstructionYear",
  "Pool",
  "Stories",
  "RoofType",
  "AirConditioningType",
  "FullCashValue",
  "SalePrice",
  "SaleDate",
  "Latitude_DD",
  "Longitude_DD",
  "AssessorWebLink",
  "TreasurerWebLink",
] as const;

/** Fallback layer's names for the handful of fields it can supply. */
const FALLBACK_FIELDS = ["APN", "OWNER_NAME", "MAIL_ADDR1", "MAIL_ADDR2", "PHYSICAL_ADDRESS"] as const;

const str = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim();
  return s && s.toUpperCase() !== "NULL" ? s : undefined;
};
const numOrUndef = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
/** Y/YES/TRUE/1 are all used across these fields. Anything else is not a yes. */
const flag = (v: unknown): boolean | undefined => {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s || s === "NULL") return undefined;
  return ["Y", "YES", "TRUE", "1"].includes(s);
};

/** Street-address comparison for occupancy: case, punctuation and spacing all vary. */
export function sameStreetAddress(a?: string, b?: string): boolean | undefined {
  const norm = (s?: string) =>
    (s ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  // No evidence either way is UNDEFINED. A hard false here reads as "confirmed
  // absentee" and would push a real homeowner into the absentee segment.
  if (!na || !nb) return undefined;
  if (na === nb) return true;
  const head = (s: string) => s.slice(0, 14);
  return na.startsWith(head(nb)) || nb.startsWith(head(na));
}

/**
 * Single-family residential, per the assessor's own use description.
 *
 * This is authoritative in a way our description-text rules never were: on the
 * Buckeye set it caught the 36 non-residential parcels that survived every
 * text heuristic.
 */
export function isSfrUse(propertyUse?: string): boolean | undefined {
  if (!propertyUse) return undefined;
  const u = propertyUse.toUpperCase();
  if (/\bSFR\b/.test(u) || /\bSINGLE\s+FAMILY\b/.test(u)) return true;
  return false;
}

function toRecord(row: Record<string, unknown>): AssessorRecord | null {
  const apn = normalizeApn(row.APN);
  if (!apn) return null;
  const mailingAddress = [str(row.OwnerAddressLine1), str(row.OwnerAddressLine2)].filter(Boolean).join(" ") || undefined;
  const propertyAddress = str(row.PropertyFullStreetAddress);
  const propertyUse = str(row.PropertyUseDescription);
  return {
    apn,
    apnDash: str(row.APNDash),
    ownerName: str(row.OwnerName),
    mailingAddress,
    mailingCity: str(row.OwnerCity),
    mailingState: str(row.OwnerState),
    mailingZip: str(row.OwnerZipCode),
    propertyAddress,
    propertyCity: str(row.PropertyCity),
    propertyZip: str(row.PropertyZipCode),
    propertyUse,
    ownerOccupied: sameStreetAddress(str(row.OwnerAddressLine1), propertyAddress),
    isRental: flag(row.Rental),
    isSfr: isSfrUse(propertyUse),
    livableSqFt: numOrUndef(row.LivableArea_SqFt),
    yearBuilt: numOrUndef(row.ConstructionYear),
    pool: flag(row.Pool),
    stories: numOrUndef(row.Stories),
    roofType: str(row.RoofType),
    airConditioningType: str(row.AirConditioningType),
    fullCashValue: numOrUndef(row.FullCashValue),
    salePrice: numOrUndef(row.SalePrice),
    saleDate: str(row.SaleDate),
    latitude: numOrUndef(row.Latitude_DD),
    longitude: numOrUndef(row.Longitude_DD),
    assessorLink: str(row.AssessorWebLink),
    treasurerLink: str(row.TreasurerWebLink),
    layer: "primary",
  };
}

function toFallbackRecord(row: Record<string, unknown>): AssessorRecord | null {
  const apn = normalizeApn(row.APN);
  if (!apn) return null;
  const mailingAddress = [str(row.MAIL_ADDR1), str(row.MAIL_ADDR2)].filter(Boolean).join(" ") || undefined;
  const propertyAddress = str(row.PHYSICAL_ADDRESS);
  return {
    apn,
    ownerName: str(row.OWNER_NAME),
    mailingAddress,
    propertyAddress,
    ownerOccupied: sameStreetAddress(str(row.MAIL_ADDR1), propertyAddress),
    layer: "fallback",
  };
}

export interface AssessorFetchOptions {
  fetchImpl?: typeof fetch;
  /** APNs per request. The join is a WHERE APN IN (...) — big batches make long URLs. */
  batchSize?: number;
  /** Skip the fallback layer (tests, or when a partial answer is preferable to a second round trip). */
  noFallback?: boolean;
}

const quote = (apn: string) => `'${apn.replace(/'/g, "")}'`;

/**
 * Look up many APNs at once. Returns a map keyed by normalized APN; a parcel
 * the assessor does not have simply has no entry — never a fabricated one.
 *
 * A batch that comes back completely empty falls through to the fallback layer
 * before being reported as a miss, because "zero rows" from an ArcGIS layer is
 * far more often a field-name change than a genuine absence. That is the same
 * fail-loud-on-zero discipline the permit adapters use.
 */
export async function fetchAssessorRecords(
  apns: string[],
  opts: AssessorFetchOptions = {}
): Promise<Map<string, AssessorRecord>> {
  const out = new Map<string, AssessorRecord>();
  const wanted = [...new Set(apns.map(normalizeApn).filter(Boolean))];
  if (!wanted.length) return out;
  const batchSize = Math.max(1, Math.min(500, opts.batchSize ?? 200));

  for (let i = 0; i < wanted.length; i += batchSize) {
    const batch = wanted.slice(i, i + batchSize);
    const where = `APN IN (${batch.map(quote).join(",")})`;
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await arcgisQueryAll<Record<string, unknown>>({
        layerUrl: ASSESSOR_LAYER,
        where,
        outFields: [...FIELDS],
        pageSize: Math.min(1000, batchSize),
        maxRows: batch.length,
        fetchImpl: opts.fetchImpl,
      });
    } catch {
      rows = [];
    }
    for (const row of rows) {
      const rec = toRecord(row);
      if (rec) out.set(rec.apn, rec);
    }
    if (rows.length || opts.noFallback) continue;

    try {
      const fbRows = await arcgisQueryAll<Record<string, unknown>>({
        layerUrl: ASSESSOR_FALLBACK_LAYER,
        where,
        outFields: [...FALLBACK_FIELDS],
        pageSize: Math.min(1000, batchSize),
        maxRows: batch.length,
        fetchImpl: opts.fetchImpl,
      });
      for (const row of fbRows) {
        const rec = toFallbackRecord(row);
        if (rec && !out.has(rec.apn)) out.set(rec.apn, rec);
      }
    } catch {
      // Both layers unreachable for this batch: those APNs stay unenriched,
      // which is always preferable to a guessed owner.
    }
  }
  return out;
}

export function assessorProvenance(now: string): Provenance {
  return { source: ASSESSOR_SOURCE, fetchedAt: now };
}

export function sourcedAssessor(rec: AssessorRecord, now: string): Sourced<AssessorRecord> {
  return { value: rec, prov: assessorProvenance(now) };
}

/**
 * Which segment a lead belongs to.
 *
 * "absentee" and "non-residential" are not lesser leads, they are DIFFERENT
 * leads, and both stay out of the default dial queue: a landlord is not
 * buying a battery for a house they don't live in, and the 36 non-SFR parcels
 * are commercial contamination.
 */
export function segmentFor(rec: AssessorRecord | undefined): LeadSegment {
  if (!rec) return "unknown";
  if (rec.isSfr === false) return "non-residential";
  if (rec.isRental) return "rental";
  if (rec.ownerOccupied === false) return "absentee";
  if (rec.ownerOccupied === true) return "primary";
  return "unknown";
}

/** Segments that may appear in the default queue. Everything else is worked separately. */
export const DEFAULT_QUEUE_SEGMENTS: ReadonlySet<LeadSegment> = new Set<LeadSegment>(["primary"]);
