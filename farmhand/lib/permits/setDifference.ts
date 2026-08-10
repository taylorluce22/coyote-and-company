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
  parcelsWithSolar: number;
  parcelsWithBattery: number;
  /** Parcels whose battery evidence came from inside a solar permit description. */
  combinedPermitParcels: number;
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
  const solarByApn = new Map<string, PermitRecord[]>();
  let missingApn = 0;

  for (const rec of records) {
    const cls = classifyDescription(rec.description);
    if (cls === "other") continue;
    if (!rec.apn) {
      missingApn += 1;
      continue;
    }
    if (cls === "battery" || cls === "solar+battery") batteryApns.add(rec.apn);
    if (cls === "solar+battery") combinedApns.add(rec.apn);
    if (cls === "solar") {
      const list = solarByApn.get(rec.apn) ?? [];
      list.push(rec);
      solarByApn.set(rec.apn, list);
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
    const dated = permits
      .map((p) => ({ p, ms: p.issuedAt ? Date.parse(p.issuedAt) : NaN }))
      .filter((x) => Number.isFinite(x.ms));
    let recency: TargetParcel["recency"];
    let newestSolarIssuedAt: string | undefined;
    if (dated.length === 0) {
      if (!keepUndated) {
        excludedByWindow += 1;
        continue;
      }
      recency = "unknown";
    } else {
      const newest = dated.reduce((a, b) => (a.ms >= b.ms ? a : b));
      newestSolarIssuedAt = newest.p.issuedAt;
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
      excludedByBattery,
      excludedByWindow,
      permitsMissingApn: missingApn,
      targets: targets.length,
    },
  };
}
