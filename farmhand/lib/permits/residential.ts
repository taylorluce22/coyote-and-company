/**
 * Residential gate — separate from, and downstream of, the install gate.
 *
 * The first live Mesa run returned 111 targets. Hand-classification found only
 * ~20–25 were genuine residential rooftop installs. The rest split into two
 * groups, and they need two different gates:
 *
 *   ~20 were never residential — parking canopies, carports, shade structures
 *        over parking lots, a flagpole with solar lighting. Commercial and
 *        municipal arrays. That is THIS module.
 *   ~36 were electrical/service work that isn't a PV install at all. That is
 *        the install gate in classify.ts.
 *
 * Signals here, in the order they actually carry weight:
 *   (a) SYSTEM SIZE — a residential rooftop array is essentially never above
 *       ~30 kW DC. 1019.83 KW DC and 712.215 KWDC are commercial by size alone.
 *       No size stated is UNKNOWN, never a pass.
 *   (b) PERMIT TYPE — Mesa carries permit_type and type_of_work, and they say
 *       RES on residential work. Strongest single signal when present.
 *   (c) STRUCTURE WORDS — canopy AND canopies, carport, shade structure,
 *       parking lot, light/camera pole, flagpole, bus stop.
 *   (d) NAMED ENTITY — an organization in the description implies commercial
 *       or municipal. Weakest, and dangerous: see the approval-clause guard.
 *
 * Two traps found in the live data, both guarded below:
 *
 *   "IND-2873. 6.300 KW DC ROOF MOUNTED SOLAR..." is a REAL residential row.
 *   Its description opens with a permit reference containing IND. So RES/COM
 *   markers are read ONLY from the permit_type and type_of_work fields, never
 *   from description text.
 *
 *   "SELF-INSTALL (BY OWNER) OF ROOFTOP PV SOLAR SYSTEM, CONDITIONED ON CITY
 *   OF MESA AND SRP APPROVAL" is also a REAL residential row, and it names a
 *   municipality. The named-entity signal must not fire on a permitting
 *   authority or utility appearing in an approval clause.
 */

import type { PermitRecord } from "./types";
import { parseDcKw } from "./systemSize";

/** Above this, it is not a house. */
export const RESIDENTIAL_MAX_KW_DC = 30;

export type ResidentialVerdict = "residential" | "commercial" | "unknown";

export interface ResidentialAssessment {
  verdict: ResidentialVerdict;
  /** Largest DC rating found, when the description states one. */
  kwDc?: number;
  /** Why it landed where it did — surfaced in stats so the operator can audit the gate. */
  reason: string;
}

/** Structures that carry an array but are never a house roof. Plurals matter. */
const COMMERCIAL_STRUCTURE_PATTERNS: RegExp[] = [
  /\bCANOP(?:Y|IES)\b/, // both forms: matching only CANOPY is how the Chase and
  /\bCARPORTS?\b/, //      Mesa Public Library arrays got through the first run
  /\bSHADE\s+STRUCTURES?\b/,
  /\bPARKING\s+(?:LOT|GARAGE|STRUCTURE)/,
  /\bLIGHT\s+POLES?\b/,
  /\bCAMERA\s+POLES?\b/,
  /\bFLAG\s?POLES?\b/,
  /\bBUS\s+STOPS?\b/,
  /\bAWNINGS?\b/,
  /\bPERGOLAS?\b/,
];

/** Organization / institution markers. Weak signal — see the approval guard. */
const NAMED_ENTITY_PATTERNS: RegExp[] = [
  /\b(?:JP\s*MORGAN|CHASE|WELLS\s+FARGO|WALMART|TARGET|COSTCO|AMAZON|FEDEX|UPS)\b/,
  /\bCITY\s+OF\s+[A-Z]/,
  /\bTOWN\s+OF\s+[A-Z]/,
  /\bCOUNTY\s+OF\s+[A-Z]/,
  /\b(?:PUBLIC\s+)?LIBRARY\b/,
  /\b(?:ELEMENTARY|MIDDLE|HIGH)\s+SCHOOL\b/,
  /\bSCHOOL\s+DISTRICT\b/,
  /\b(?:HOSPITAL|CHURCH|TEMPLE|MOSQUE|SYNAGOGUE)\b/,
  /\bMODEL\s+HOME\s+COMPLEX\b/,
  /\b(?:CORPORATE|BUSINESS)\s+(?:PARK|CENTER)\b/,
  /\bSHOPPING\s+CENTER\b/,
  /\bDISTRIBUTION\s+CENTER\b/,
  /\b(?:APARTMENTS?|CONDOMINIUMS?)\b/,
  /\bLLC\b|\bINC\b|\bCORP\b/,
];

/**
 * Contexts where naming a city or utility means "who approves this", not
 * "who owns this". Without this guard the named-entity rule rejects a genuine
 * homeowner self-install for citing the city it needs approval from.
 */
const APPROVAL_CLAUSE_PATTERNS: RegExp[] = [
  /\bCONDITIONED\s+ON\b/,
  /\bSUBJECT\s+TO\b/,
  /\bAPPROVAL\b/,
  /\bAPPROVED\s+BY\b/,
  /\bPER\s+[A-Z\s]{0,24}(?:SPECIFICATION|REQUIREMENT|STANDARD)/,
  /\bINSPECTION\s+BY\b/,
];

/** Residential markers — read ONLY from source type fields, never description text. */
const RES_TYPE_PATTERNS: RegExp[] = [
  /\bRES\b/,
  /\bRESIDENTIAL\b/,
  /\bSFR\b/,
  /\bSINGLE[\s-]?FAMILY\b/,
  /\bDUPLEX\b/,
  /\bTOWNH(?:OME|OUSE)\b/,
];

const COM_TYPE_PATTERNS: RegExp[] = [
  /\bCOMM?\b/,
  /\bCOMMERCIAL\b/,
  /\bINDUSTRIAL\b/,
  /\bMULTI[\s-]?FAMILY\b/,
  /\bMUNICIPAL\b/,
  /\bGOVERNMENT\b/,
];

/**
 * Largest DC rating stated, in kW.
 *
 * The parsing itself lives in systemSize.ts, because the unit of measure turned
 * out to be the thing that separates a panel addition from a battery — a much
 * bigger job than sizing a gate. This is the same function under the name the
 * residential gate has always called it by.
 */
export { parseDcKw as parseKwDc };

function typeFieldsSay(rec: PermitRecord, patterns: RegExp[]): boolean {
  // Deliberately excludes rec.description: a real residential row began
  // "IND-2873." and would read as industrial from its text alone.
  const fields = `${rec.permitType ?? ""} ${rec.workType ?? ""}`.toUpperCase();
  return patterns.some((r) => r.test(fields));
}

export function assessResidential(rec: PermitRecord): ResidentialAssessment {
  const d = rec.description.toUpperCase();
  const kwDc = parseDcKw(rec.description);

  // (a) Size is decisive when stated — nothing on a house roof is this big.
  if (kwDc !== undefined && kwDc > RESIDENTIAL_MAX_KW_DC) {
    return { verdict: "commercial", kwDc, reason: `${kwDc} kW DC exceeds the ${RESIDENTIAL_MAX_KW_DC} kW residential ceiling` };
  }

  // (c) Structure words are decisive regardless of size.
  const structure = COMMERCIAL_STRUCTURE_PATTERNS.find((r) => r.test(d));
  if (structure) {
    return { verdict: "commercial", kwDc, reason: `commercial structure (${structure.source})` };
  }

  // (b) Source type fields — the strongest signal when present.
  if (typeFieldsSay(rec, COM_TYPE_PATTERNS)) {
    return { verdict: "commercial", kwDc, reason: "permit/work type is commercial" };
  }
  const resType = typeFieldsSay(rec, RES_TYPE_PATTERNS);

  // (d) Named entity — weakest, and suppressed inside an approval clause,
  // where a city or utility is the approver rather than the owner.
  const inApprovalClause = APPROVAL_CLAUSE_PATTERNS.some((r) => r.test(d));
  const entity = NAMED_ENTITY_PATTERNS.find((r) => r.test(d));
  if (entity && !inApprovalClause && !resType) {
    return { verdict: "commercial", kwDc, reason: `named organization (${entity.source})` };
  }

  if (resType) {
    return { verdict: "residential", kwDc, reason: "permit/work type is residential" };
  }
  if (kwDc !== undefined) {
    return { verdict: "residential", kwDc, reason: `${kwDc} kW DC within residential range` };
  }
  // No size, no type, nothing structural: genuinely unknown. Not a pass.
  return { verdict: "unknown", kwDc, reason: "no system size and no residential permit type" };
}
