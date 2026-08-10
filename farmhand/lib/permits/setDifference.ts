/**
 * FILTER stage, part 2: per-parcel set-difference.
 *
 * target parcels = { parcels with a solar PV permit }
 *                − { parcels with battery evidence anywhere }
 *
 * Battery evidence counts wherever it appears: a standalone battery permit OR
 * battery keywords inside a solar permit's own description (class
 * "solar+battery"). The subtraction is keyed by normalized APN, never by
 * address string.
 *
 * Recency window: a solar permit that's too new (< minAgeMonths) belongs to a
 * fresh install that may still add storage through the installer; too old
 * (> maxAgeYears) and the retrofit economics fade. Both bounds are
 * parameterized. Parcels whose source rows carried no usable issue date are
 * kept and flagged recency: "unknown" rather than silently dropped.
 *
 * Pure function of (records, options) — deterministic ordering, safe to re-run.
 */

import type { PermitRecord, TargetParcel } from "./types";
import { classifyDescription } from "./classify";

export interface SetDifferenceOptions {
  /** ISO timestamp injected by the caller. */
  now: string;
  /** Solar permits younger than this are excluded (default 6). */
  minAgeMonths?: number;
  /** Solar permits older than this are excluded (default 5). */
  maxAgeYears?: number;
  /** Keep parcels whose solar permits have no usable issue date (default true). */
  keepUndated?: boolean;
}

export interface SetDifferenceStats {
  totalPermits: number;
  /** Parcels with a COMPLETED solar install permit — the honest denominator. */
  parcelsWithSolar: number;
  parcelsWithBattery: number;
  /** Parcels whose battery evidence came from inside a solar permit description. */
  combinedPermitParcels: number;
  /** Parcels whose only solar permit was a panel/meter/service upgrade, not an install. */
  parcelsAncillaryOnly: number;
  /** Parcels whose solar permit hasn't completed yet. */
  parcelsIncompleteSolar: number;
  /** Parcels whose solar permit status couldn't be resolved either way — surfaced, not assumed. */
  parcelsAmbiguousStatus: number;
  excludedByBattery: number;
  excludedByWindow: number;
  permitsMissingApn: number;
  targets: number;
}

export interface SetDifferenceResult {
  targets: TargetParcel[];
  stats: SetDifferenceStats;
}

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

export function solarWithoutBattery(
  records: PermitRecord[],
  opts: SetDifferenceOptions
): SetDifferenceResult {
  const minAgeMonths = opts.minAgeMonths ?? 6;
  const maxAgeYears = opts.maxAgeYears ?? 5;
  const keepUndated = opts.keepUndated ?? true;
  const nowMs = Date.parse(opts.now);

  const batteryApns = new Set<string>();
  const combinedApns = new Set<string>();
  const ancillaryApns = new Set<string>();
  const incompleteApns = new Set<string>();
  const ambiguousApns = new Set<string>();
  const solarByApn = new Map<string, PermitRecord[]>();
  let missingApn = 0;

  for (const rec of records) {
    const cls = classifyDescription(rec.description);
    if (cls === "other") continue;
    if (!rec.apn) {
      missingApn += 1;
      continue;
    }
    // Battery evidence subtracts regardless of permit status. Someone who has
    // merely PULLED a battery permit is getting a battery; waiting for it to
    // final before excluding them would put them on the call list in the
    // meantime.
    if (cls === "battery" || cls === "solar+battery") batteryApns.add(rec.apn);
    if (cls === "solar+battery") combinedApns.add(rec.apn);
    if (cls === "solar-ancillary") {
      ancillaryApns.add(rec.apn);
      continue;
    }
    if (cls === "solar") {
      // Only a COMPLETED solar permit means a system is on the roof. An issued
      // or in-review permit is a job that hasn't happened yet, and ambiguous
      // statuses are surfaced rather than assumed either way.
      if (rec.completionStatus === "complete") {
        const list = solarByApn.get(rec.apn) ?? [];
        list.push(rec);
        solarByApn.set(rec.apn, list);
      } else if (rec.completionStatus === "ambiguous" || rec.completionStatus === "unknown") {
        ambiguousApns.add(rec.apn);
      } else {
        incompleteApns.add(rec.apn);
      }
    }
  }

  let excludedByBattery = 0;
  let excludedByWindow = 0;
  const targets: TargetParcel[] = [];

  for (const [apn, permits] of solarByApn) {
    if (batteryApns.has(apn)) {
      excludedByBattery += 1;
      continue;
    }
    // Completion date is the install date and is what the retrofit window
    // should measure from. Issue date is the fallback, and which one was used
    // travels with the row so a reported install year is never mistaken for a
    // verified one.
    const dated = permits
      .map((p) => {
        const anchor = p.finaledAt ?? p.issuedAt;
        return { p, ms: anchor ? Date.parse(anchor) : NaN, anchor };
      })
      .filter((x) => Number.isFinite(x.ms));
    let recency: TargetParcel["recency"];
    let newestSolarIssuedAt: string | undefined;
    let completionSource: PermitRecord["completionSource"] = "unverified";
    let installYear: number | undefined;
    if (dated.length === 0) {
      if (!keepUndated) {
        excludedByWindow += 1;
        continue;
      }
      recency = "unknown";
    } else {
      const newest = dated.reduce((a, b) => (a.ms >= b.ms ? a : b));
      newestSolarIssuedAt = newest.anchor;
      completionSource = newest.p.completionSource;
      installYear = newest.p.finaledYear;
      const ageMs = nowMs - newest.ms;
      if (ageMs < minAgeMonths * MONTH_MS || ageMs > maxAgeYears * 12 * MONTH_MS) {
        excludedByWindow += 1;
        continue;
      }
      recency = "in-window";
    }
    const first = permits[0];
    targets.push({
      apn,
      jurisdiction: first.jurisdiction,
      address: permits.find((p) => p.address)?.address ?? "",
      solarPermits: permits.map((p) => ({
        permitNumber: p.permitNumber,
        description: p.description,
        issuedAt: p.issuedAt,
      })),
      newestSolarIssuedAt,
      recency,
      completionSource,
      installYear,
      contractor: permits.find((p) => p.contractor)?.contractor,
      utility: permits.find((p) => p.utility)?.utility,
      computedAt: opts.now,
    });
  }

  targets.sort((a, b) => {
    const am = a.newestSolarIssuedAt ? Date.parse(a.newestSolarIssuedAt) : -1;
    const bm = b.newestSolarIssuedAt ? Date.parse(b.newestSolarIssuedAt) : -1;
    if (am !== bm) return bm - am; // newest first, undated last
    return a.apn < b.apn ? -1 : a.apn > b.apn ? 1 : 0;
  });

  return {
    targets,
    stats: {
      totalPermits: records.length,
      parcelsWithSolar: solarByApn.size,
      parcelsWithBattery: batteryApns.size,
      combinedPermitParcels: combinedApns.size,
      // Counted only where the parcel has no completed install permit of its
      // own, so a house that upgraded its panel AND has an array isn't
      // reported as ancillary-only.
      parcelsAncillaryOnly: [...ancillaryApns].filter((a) => !solarByApn.has(a)).length,
      parcelsIncompleteSolar: [...incompleteApns].filter((a) => !solarByApn.has(a)).length,
      parcelsAmbiguousStatus: [...ambiguousApns].filter((a) => !solarByApn.has(a)).length,
      excludedByBattery,
      excludedByWindow,
      permitsMissingApn: missingApn,
      targets: targets.length,
    },
  };
}
