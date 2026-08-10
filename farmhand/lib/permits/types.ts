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

export type Jurisdiction = "mesa" | "tempe" | "scottsdale";

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
  completionSource: "finaled" | "issued" | "unverified";
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
  /** Whether the date above is a real completion date or a fallback. Never silently a derived value. */
  completionSource: "finaled" | "issued" | "unverified";
  /** Install year straight from the source, when the source states one. */
  installYear?: number;
  /** Contractor of record on the solar permit — useful for spotting a defunct installer. */
  contractor?: string;
  /** Utility named in the permit text. Absent means unknown, not "not SRP". */
  utility?: UtilityMention;
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
  phone?: Sourced<PhoneData>;
  /** National DNC scrub result. Stale (> 31 days) scrubs block dialing in COMPLY. */
  dnc?: { status: "clear" | "listed" | "unknown"; scrubbedAt: string; receipt?: string };
  /** Internal do-not-call — honored instantly, retained 10 years. */
  internalDnc?: boolean;
  optedOutAt?: string;
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
