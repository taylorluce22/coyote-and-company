/**
 * Lead-gen permit system — shared types.
 *
 * Stage flow: INGEST (per-jurisdiction adapters) -> FILTER (classify +
 * per-parcel set-difference) -> ENRICH (parcel -> owner -> phone) ->
 * COMPLY (hard gate before any dial affordance).
 *
 * Libs stay pure: no Date.now() in here — callers (routes, scripts) inject
 * `now` so the same inputs always produce the same outputs (idempotent stages).
 */

import type { CompletionStatus } from "./status";
import type { BatteryDetectionMethod } from "./batteryMatcher";
import type { Classification } from "./taxonomy";

/**
 * Where an install date came from. Sources differ in what they publish, and a
 * weaker provenance must never be presented as a completion date: Peoria has
 * no date field at all and its year is decoded from the permit-number prefix.
 */
export type CompletionDateSource =
  | "finaled"
  | "finaled-year"
  | "issued"
  | "permit-number-prefix"
  | "unverified";

/**
 * Permit-issuing jurisdictions. Each incorporated city issues its own permits;
 * Maricopa County issues only for UNINCORPORATED territory.
 *
 * "maricopa-unincorporated" is named that way deliberately. Verified 2026-08-10
 * by querying the county layer for WorkClass='Solar' by ZIP: the two ZIPs that
 * sit wholly inside city limits returned 1 (Goodyear 85395) and 3 (Glendale
 * 85308) — zero for practical purposes — while the ZIPs with real counts
 * (Litchfield Park 85340 = 290, Buckeye 85326 = 127, Peoria 85383 = 91) are
 * exactly the ones that sprawl past city limits into unincorporated county.
 * Those rows are county residents who share a ZIP with a city, not city
 * residents. Labeling the jurisdiction plainly keeps anyone downstream from
 * reading them as Goodyear or Glendale leads.
 */
export type Jurisdiction =
  | "mesa"
  | "tempe"
  | "scottsdale"
  | "gilbert"
  | "tucson"
  | "goodyear"
  | "buckeye"
  | "litchfield-park"
  | "glendale"
  | "peoria"
  | "maricopa-unincorporated";

/** One permit as ingested from a jurisdiction source, normalized. */
export interface PermitRecord {
  jurisdiction: Jurisdiction;
  permitNumber: string;
  /** Assessor parcel number, normalized via normalizeApn(). Empty when the source row had none. */
  apn: string;
  address: string;
  /** Free-text scope of work (Mesa: description_of_work), truncated for storage. */
  description: string;
  /** ISO date the permit was issued, when the source exposes one. */
  issuedAt?: string;
  /** ISO date the permit was finaled — completion, i.e. when the system actually went in. */
  finaledAt?: string;
  /** Install year straight from the source, not derived. */
  finaledYear?: number;
  /**
   * Which field the recency window should trust, and where it came from. A
   * source with no completion field must say so rather than let install year
   * be quietly computed from the issue date.
   */
  completionSource: CompletionDateSource;
  /** Contractor / applicant of record (Mesa: applicant, e.g. "SOLARCITY CORP"). */
  contractor?: string;
  /** Source work-type classification (Mesa: type_of_work, e.g. "Res (OTH) -- Electrical"). */
  workType?: string;
  /** Source permit-type classification (Mesa: permit_type). */
  permitType?: string;
  /** Source permit status verbatim (Mesa: status). */
  status?: string;
  /** That status folded into whether the work is actually done. */
  completionStatus: CompletionStatus;
  /** Utility named in the description text, when it names one. */
  utility?: UtilityMention;
  /**
   * Classification stated STRUCTURALLY by the source, which always beats
   * reading the free text. Peoria publishes a battery flag
   * (USER_B1_CHECKBOX_DESC='Battery Storage') and a PV checklist code, so
   * guessing from a description there would only introduce error.
   */
  classOverride?: PermitClass;
  /**
   * Occupancy stated structurally by the source. Peoria's checklist separates
   * '801 - Photovoltaic RES' from '806 - Photovoltaic COM' outright.
   */
  occupancyOverride?: "residential" | "commercial";
  /** How battery presence was determined — free text is weaker and worth surfacing. */
  batteryDetection?: "source-flag" | "description-only";
  /**
   * Taxonomy tags plus HOW they were decided and with what confidence. Tags,
   * method and confidence travel together as one object so a row can never
   * carry LLM tags labeled as a rule match. Absent means the row has not been
   * through the tagging stage; PermitClass remains what the set-difference
   * runs on.
   */
  classification?: Classification;
  /** ISO timestamp of the ingest fetch — record-level provenance. */
  fetchedAt: string;
}

/**
 * What a permit's description says it covers.
 *
 * "solar-ancillary" is the trap case: a permit whose subject is electrical
 * infrastructure done IN SERVICE OF solar — a service-panel upgrade, a meter
 * main combo — rather than a PV install. Those descriptions mention PV SOLAR
 * cleanly and would otherwise put a house on the target list on the strength
 * of a panel swap.
 */
export type PermitClass = "solar" | "battery" | "solar+battery" | "solar-ancillary" | "other";

/** Utility named in the permit text. Direct signal, ahead of any jurisdiction lookup. */
export type UtilityMention = "SRP" | "APS" | "TEP" | "TRICO" | "SSVEC";

/**
 * A parcel with solar PV and no battery/energy-storage evidence anywhere —
 * the retrofit target the whole system exists to find.
 */
export interface TargetParcel {
  apn: string;
  jurisdiction: Jurisdiction;
  address: string;
  solarPermits: Array<{ permitNumber: string; description: string; issuedAt?: string }>;
  /** Newest solar issue date on the parcel, ISO — drives the recency window. */
  newestSolarIssuedAt?: string;
  /** "in-window" when the newest solar permit falls inside the recency window; "unknown" when the source had no usable date. */
  recency: "in-window" | "unknown";
  /** Whether the date above is a real completion date, a year-precision one, or a fallback. Never silently derived. */
  completionSource: CompletionDateSource;
  /** Largest DC rating on the parcel's solar permits, when stated. */
  systemKwDc?: number;
  /**
   * Sum of the DC ratings across every PV permit on the parcel — the system as
   * it stands today, not as first installed. A home that went 6.3 kW in 2020
   * and added 2.92 kW in 2023 is a homeowner who has already chosen to expand
   * once, which is a sales fact rather than a data-quality note.
   */
  totalSystemKwDc?: number;
  /** PV permits beyond the first. 0 means one install and no additions. */
  expansionCount?: number;
  /**
   * Permit numbers cited inside the parcel's own descriptions ("PV INSTALL ON
   * PERMIT ELECR-22-0699"). 43.7% of second permits name the original, which
   * makes the chain of work verified rather than inferred.
   */
  linkedPermits?: string[];
  /** Install year straight from the source, when the source states one. */
  installYear?: number;
  /** Contractor of record on the solar permit — useful for spotting a defunct installer. */
  contractor?: string;
  /** Utility named in the permit text. Absent means unknown, not "not SRP". */
  utility?: UtilityMention;
  /**
   * ALWAYS "permit-data-only". Every battery conclusion in this system rests on
   * PERMITTED batteries; an unpermitted retrofit is invisible to us. The field
   * exists so the limit travels on the record itself and nobody downstream
   * mistakes "no battery permit" for "no battery".
   */
  batteryEvidence: "permit-data-only";
  /**
   * How this jurisdiction's battery signal is obtained. Peoria has a checkbox;
   * Buckeye and Mesa have no battery permit type at all, so a regex over free
   * text is the only signal that exists. The confidence difference is real, so
   * it travels on the row instead of being assumed uniform.
   */
  batteryDetectionMethod: BatteryDetectionMethod;
  /**
   * QUARANTINE flags — these hold a parcel out of the default dial queue.
   * Reserved for cases where the data genuinely cannot decide, e.g. a PV
   * permit that states neither battery evidence nor a DC rating.
   */
  reviewFlags?: string[];
  /**
   * INFORMATIONAL notes — carried on the row, never a reason to hold it back.
   *
   * `second-pv-permit` lives here now. It was a quarantine flag on the theory
   * that a second PV permit might be a hidden battery; that was tested against
   * all 8942 Buckeye photovoltaic permits and it is not. Of 405 second-or-later
   * PV permits on parcels with no battery keyword, 295 stated a DC rating and
   * the 9 unparsed residuals were read by hand — zero batteries. Quarantining
   * ~2% of parcels for a risk that measured at zero is a cost with no benefit.
   */
  notes?: string[];
  /** ISO timestamp of the FILTER run that produced this row. */
  computedAt: string;
}

/** Per-field provenance: where a value came from and when. Never fabricate — no source, no value. */
export interface Provenance {
  source: string;
  fetchedAt: string;
}

/** A value that only exists together with where it came from. */
export interface Sourced<T> {
  value: T;
  prov: Provenance;
}

/** Line type MUST be carried on every appended number — wireless suppression depends on it. */
export type LineType = "wireless" | "landline" | "voip" | "unknown";

export interface PhoneData {
  number: string; // E.164-ish digits as returned by the source
  lineType: LineType;
}

/**
 * One parcel as the Maricopa County Assessor publishes it — public ArcGIS
 * layer, no token. Far more than an owner lookup: occupancy, the authoritative
 * residential use code, and the property facts that qualify a household.
 * Shapes live here so lib/permits/enrich/assessor.ts and the COMPLY layer can
 * share them without importing each other.
 */
export interface AssessorData {
  apn: string;
  /** 503-96-720 display form. The bare form is the join key. */
  apnDash?: string;
  ownerName?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  propertyAddress?: string;
  /** Authoritative city — Buckeye's permit system covers 293 addresses the assessor calls Litchfield Park. */
  propertyCity?: string;
  propertyZip?: string;
  /** e.g. "SFR GRADE 010-3 URBAN SUBDIVIDED" — the real residential gate. */
  propertyUse?: string;
  /** Mailing and situs agree. Undefined when either is missing — never a guessed false. */
  ownerOccupied?: boolean;
  isRental?: boolean;
  isSfr?: boolean;
  livableSqFt?: number;
  yearBuilt?: number;
  /** A pool is a large summer load — a concrete reason storage helps this household. */
  pool?: boolean;
  stories?: number;
  roofType?: string;
  airConditioningType?: string;
  fullCashValue?: number;
  salePrice?: number;
  saleDate?: string;
  latitude?: number;
  longitude?: number;
  assessorLink?: string;
  treasurerLink?: string;
  /** Which layer answered. The fallback carries far fewer fields. */
  layer: "primary" | "fallback";
}

/**
 * Which population a lead belongs to. Absentee and non-residential are not
 * lesser leads, they are DIFFERENT leads: a landlord is not buying a battery
 * for a house they don't live in. Both are worked separately, never in the
 * default dial queue.
 */
export type LeadSegment = "primary" | "absentee" | "rental" | "non-residential" | "unknown";

export interface OwnerData {
  name: string;
  mailingAddress?: string;
  /** Situs and mailing address match — false suggests absentee owner. */
  ownerOccupied?: boolean;
}

/** ENRICH output: one row per target parcel, every enriched field with provenance. */
export interface EnrichedLead {
  apn: string;
  jurisdiction: Jurisdiction;
  address: string;
  newestSolarIssuedAt?: string;
  owner?: Sourced<OwnerData>;
  /** Full assessor record — occupancy, use code, and the qualification facts. */
  assessor?: Sourced<AssessorData>;
  /** Derived from the assessor record; only "primary" reaches the default queue. */
  segment?: LeadSegment;
  phone?: Sourced<PhoneData>;
  /** National DNC scrub result. Stale (> 31 days) scrubs block dialing in COMPLY. */
  dnc?: { status: "clear" | "listed" | "unknown"; scrubbedAt: string; receipt?: string };
  /** Internal do-not-call — honored instantly, retained 10 years. */
  internalDnc?: boolean;
  optedOutAt?: string;
  /** Held out of the dial queue pending human review — see TargetParcel.reviewFlags. */
  needsReview?: boolean;
  reviewFlags?: string[];
  /**
   * No longer in the current target list (a later FILTER run subtracted this
   * parcel). Held out of the dial queue but kept on file — deleting the row
   * would take its opt-out and scrub history with it.
   */
  retired?: boolean;
  updatedAt: string;
}

/** Normalize an APN for cross-source joins: uppercase, alphanumerics only. */
export function normalizeApn(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
}
