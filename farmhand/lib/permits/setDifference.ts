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
import { assessResidential } from "./residential";
import { batteryDetectionMethodFor } from "./batteryMatcher";

export interface SetDifferenceOptions {
  /** ISO timestamp injected by the caller. */
  now: string;
  /** Installs younger than this are excluded (default 24 months). */
  minAgeMonths?: number;
  /** Installs older than this are excluded (default 20 years). */
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
  /** Battery permits carrying no date at all. They still subtract; surfaced so the policy is visible. */
  undatedBatteryPermits: number;
  /** Targets flagged for review by the keyword-independent second-PV-permit check. */
  parcelsFlaggedSecondPvPermit: number;
  /** Parcels rejected by the residential gate (commercial/municipal arrays). */
  parcelsCommercial: number;
  /** Why each was rejected, tallied — lets the gate be audited from a live run. */
  commercialReasonCounts: Record<string, number>;
  /** Parcels with neither a stated size nor a residential permit type. Excluded, not assumed. */
  parcelsUnknownOccupancy: number;
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
  // 2–20 years: young enough that the array is still worth pairing a battery
  // with, old enough that the installer's own storage upsell has passed.
  const minAgeMonths = opts.minAgeMonths ?? 24;
  const maxAgeYears = opts.maxAgeYears ?? 20;
  const keepUndated = opts.keepUndated ?? true;
  const nowMs = Date.parse(opts.now);

  const batteryApns = new Set<string>();
  const combinedApns = new Set<string>();
  const ancillaryApns = new Set<string>();
  const incompleteApns = new Set<string>();
  const ambiguousApns = new Set<string>();
  const commercialApns = new Set<string>();
  const commercialReasons = new Map<string, string>();
  const unknownOccupancyApns = new Set<string>();
  const systemKw = new Map<string, number>();
  const solarByApn = new Map<string, PermitRecord[]>();
  let missingApn = 0;
  let undatedBatteryPermits = 0;

  for (const rec of records) {
    // A source that classifies its own rows always beats reading the text.
    // Peoria publishes a battery checkbox and a RES/COM checklist code, so
    // running its rows through the keyword classifier would only add error.
    const cls = rec.classOverride ?? classifyDescription(rec.description);
    if (cls === "other") continue;
    if (!rec.apn) {
      missingApn += 1;
      continue;
    }
    // Battery evidence subtracts regardless of permit status. Someone who has
    // merely PULLED a battery permit is getting a battery; waiting for it to
    // final before excluding them would put them on the call list in the
    // meantime.
    if (cls === "battery" || cls === "solar+battery") {
      batteryApns.add(rec.apn);
      // A storage permit with no date still proves a battery exists on the
      // parcel, so it subtracts — the safe direction. Counted here so the
      // number is visible rather than absorbed: Buckeye has 102 of these.
      if (!rec.finaledAt && !rec.issuedAt && !rec.finaledYear) undatedBatteryPermits += 1;
    }
    if (cls === "solar+battery") combinedApns.add(rec.apn);
    if (cls === "solar-ancillary") {
      ancillaryApns.add(rec.apn);
      continue;
    }
    if (cls === "solar") {
      // Only a COMPLETED solar permit means a system is on the roof. An issued
      // or in-review permit is a job that hasn't happened yet, and ambiguous
      // statuses are surfaced rather than assumed either way.
      if (rec.completionStatus !== "complete") {
        if (rec.completionStatus === "incomplete") incompleteApns.add(rec.apn);
        else ambiguousApns.add(rec.apn);
        continue;
      }
      // Residential gate, separate from the install gate above. The first live
      // run put ~20 parking canopies, carports and a municipal flagpole on the
      // list; none of them are a household anyone can sell a battery to.
      const res = rec.occupancyOverride
        ? { verdict: rec.occupancyOverride, reason: "source-classified occupancy", kwDc: undefined }
        : assessResidential(rec);
      if (res.verdict === "commercial") {
        commercialApns.add(rec.apn);
        commercialReasons.set(rec.apn, res.reason);
        continue;
      }
      if (res.verdict === "unknown") {
        unknownOccupancyApns.add(rec.apn);
        continue;
      }
      const list = solarByApn.get(rec.apn) ?? [];
      list.push(rec);
      solarByApn.set(rec.apn, list);
      if (res.kwDc !== undefined) systemKw.set(rec.apn, Math.max(systemKw.get(rec.apn) ?? 0, res.kwDc));
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
    // Anchor preference: a real completion date, then the source's own stated
    // completion YEAR, then the issue date. "C of C Issued" is Mesa's dominant
    // completed status and does not always carry finaled_date, so without the
    // finaled_year rung most completed permits would silently fall back to the
    // issue date and read as installs that are younger than they are.
    const dated = permits
      .map((p) => {
        if (p.finaledAt) return { p, ms: Date.parse(p.finaledAt), anchor: p.finaledAt, src: "finaled" as const };
        if (p.finaledYear) {
          const anchor = `${p.finaledYear}-07-01T00:00:00.000Z`; // mid-year, year-precision only
          return { p, ms: Date.parse(anchor), anchor, src: "finaled-year" as const };
        }
        if (p.issuedAt) return { p, ms: Date.parse(p.issuedAt), anchor: p.issuedAt, src: "issued" as const };
        return { p, ms: NaN, anchor: undefined, src: "unverified" as const };
      })
      .filter((x) => Number.isFinite(x.ms));
    let recency: TargetParcel["recency"];
    let newestSolarIssuedAt: string | undefined;
    let completionSource: TargetParcel["completionSource"] = "unverified";
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
      completionSource = newest.src;
      installYear = newest.p.finaledYear ?? new Date(newest.ms).getUTCFullYear();
      const ageMs = nowMs - newest.ms;
      if (ageMs < minAgeMonths * MONTH_MS || ageMs > maxAgeYears * 12 * MONTH_MS) {
        excludedByWindow += 1;
        continue;
      }
      recency = "in-window";
    }
    // Keyword-independent safety net. In Buckeye a battery retrofit lands as a
    // SECOND 'Photovoltaic System' permit on the parcel — the same workclass a
    // new install gets — so a second PV permit dated after the first is a
    // battery candidate that no keyword can see. Measured: of 7661 parcels,
    // 7392 have exactly one PV permit and 269 have more; 171 of those carry no
    // battery keyword anywhere and sampled as genuine array expansions
    // ("ADDING MODULES", "AND DERATE MAIN BREAKER"). So this flags rather than
    // excludes — roughly 2% of parcels — and flagged parcels stay out of the
    // default dial queue until a human looks.
    const reviewFlags: string[] = [];
    if (dated.length > 1) {
      const sorted = [...dated].sort((a, b) => a.ms - b.ms);
      if (sorted[sorted.length - 1].ms > sorted[0].ms) reviewFlags.push("second-pv-permit");
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
      systemKwDc: systemKw.get(apn),
      contractor: permits.find((p) => p.contractor)?.contractor,
      batteryEvidence: "permit-data-only",
      batteryDetectionMethod: batteryDetectionMethodFor(first.jurisdiction),
      ...(reviewFlags.length ? { reviewFlags } : {}),
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
      parcelsCommercial: [...commercialApns].filter((a) => !solarByApn.has(a)).length,
      commercialReasonCounts: [...commercialApns]
        .filter((a) => !solarByApn.has(a))
        .reduce<Record<string, number>>((acc, a) => {
          const r = commercialReasons.get(a) ?? "unspecified";
          acc[r] = (acc[r] ?? 0) + 1;
          return acc;
        }, {}),
      parcelsUnknownOccupancy: [...unknownOccupancyApns].filter((a) => !solarByApn.has(a)).length,
      excludedByBattery,
      excludedByWindow,
      permitsMissingApn: missingApn,
      undatedBatteryPermits,
      parcelsFlaggedSecondPvPermit: targets.filter((t) => t.reviewFlags?.includes("second-pv-permit")).length,
      targets: targets.length,
    },
  };
}
