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
  /** ISO timestamp of the ingest fetch — record-level provenance. */
  fetchedAt: string;
}

/** What a permit's description says it covers. */
export type PermitClass = "solar" | "battery" | "solar+battery" | "other";

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
  /** ISO timestamp of the FILTER run that produced this row. */
  computedAt: string;
}

/** Per-field provenance: where a value came from and when. Never fabricate — no source, no value. */
export interface Provenance {
  source: string;
  fetchedAt: string;
}

/** Normalize an APN for cross-source joins: uppercase, alphanumerics only. */
export function normalizeApn(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
}
