/**
 * Battery attach rate by solar-install year — the pipeline's standing data
 * quality check, and the strongest evidence the business thesis has.
 *
 * Two cities, two entirely unrelated detection methods, measured independently:
 *
 *   year   Buckeye (free-text regex)   Peoria (structured 'Battery Storage' flag)
 *   2019            1.7%                          0.9%
 *   2020            2.1%                          2.6%
 *   2021            2.7%                          4.3%
 *   2022            3.5%                          5.4%
 *   2023            3.0%                          6.0%
 *   2024           18.8%                         29.0%
 *   2025           56.6%                         57.2%
 *   2026           78.6%                         68.0%
 *
 * 2025 lands at 56.6 versus 57.2 across a regex over free text and a checkbox
 * in a different city's permit system. Agreement that close between unrelated
 * methods means the detection is measuring something real rather than
 * producing a keyword artifact.
 *
 * It also states the business case directly: the 2019–2023 cohort installed
 * solar when almost nobody attached storage, and that cohort is exactly who
 * this system targets.
 *
 * So the shape is a fixture. If a city's curve departs sharply from it, the
 * most likely cause is not a change in consumer behavior — it is that battery
 * detection broke in that city. That has already happened twice: a SQL
 * `LIKE '%ESS %'` matching "ADDRESS", and a `LIKE '% ESS%'` missing a
 * description that starts with "ESS". Neither announced itself.
 */

import type { PermitRecord } from "./types";
import { classifyDescription } from "./classify";

export interface AttachRateYear {
  year: number;
  solarParcels: number;
  batteryParcels: number;
  /** Percentage, 0–100, rounded to one decimal. */
  ratePct: number;
}

/** Verified live 2026-08-10. Percentages. */
export const ATTACH_RATE_BASELINE: Record<string, Record<number, number>> = {
  buckeye: { 2019: 1.7, 2020: 2.1, 2021: 2.7, 2022: 3.5, 2023: 3.0, 2024: 18.8, 2025: 56.6, 2026: 78.6 },
  peoria: { 2019: 0.9, 2020: 2.6, 2021: 4.3, 2022: 5.4, 2023: 6.0, 2024: 29.0, 2025: 57.2, 2026: 68.0 },
};

/** The era boundary: storage attach was negligible before 2024 and mainstream after. */
export const LOW_ATTACH_YEARS_MAX = 2023;
export const LOW_ATTACH_CEILING_PCT = 12;
export const HIGH_ATTACH_FLOOR_PCT = 25;

/**
 * Attach rate per install year, computed per parcel (not per permit) so a
 * parcel with three solar permits counts once.
 */
export function computeAttachRateByYear(records: PermitRecord[]): AttachRateYear[] {
  const solarByYear = new Map<number, Set<string>>();
  const batteryApns = new Set<string>();
  const yearByApn = new Map<string, number>();

  for (const rec of records) {
    if (!rec.apn) continue;
    const cls = rec.classOverride ?? classifyDescription(rec.description);
    const year = rec.finaledYear ?? (rec.finaledAt ? new Date(rec.finaledAt).getUTCFullYear() : undefined);

    if (cls === "battery" || cls === "solar+battery") batteryApns.add(rec.apn);
    if (cls === "solar" || cls === "solar+battery") {
      if (year === undefined) continue;
      // Newest solar year wins, matching how the recency window anchors.
      const prev = yearByApn.get(rec.apn);
      if (prev === undefined || year > prev) yearByApn.set(rec.apn, year);
    }
  }

  for (const [apn, year] of yearByApn) {
    const set = solarByYear.get(year) ?? new Set<string>();
    set.add(apn);
    solarByYear.set(year, set);
  }

  return [...solarByYear.entries()]
    .map(([year, apns]) => {
      const battery = [...apns].filter((a) => batteryApns.has(a)).length;
      return {
        year,
        solarParcels: apns.size,
        batteryParcels: battery,
        ratePct: apns.size ? Math.round((battery / apns.size) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => a.year - b.year);
}

export interface AttachRateWarning {
  year: number;
  observedPct: number;
  expectedPct?: number;
  message: string;
}

/**
 * Flag curves that don't look like the verified shape. A city whose pre-2024
 * attach rate suddenly reads high, or whose 2025 reads near zero, has almost
 * certainly broken its battery detection rather than discovered a genuinely
 * different market.
 */
export function checkAttachRateShape(
  jurisdiction: string,
  observed: AttachRateYear[],
  opts: { minParcelsToJudge?: number } = {}
): AttachRateWarning[] {
  const minParcels = opts.minParcelsToJudge ?? 50;
  const baseline = ATTACH_RATE_BASELINE[jurisdiction];
  const warnings: AttachRateWarning[] = [];

  for (const row of observed) {
    // Thin years are noisy; judging them produces false alarms.
    if (row.solarParcels < minParcels) continue;

    if (row.year <= LOW_ATTACH_YEARS_MAX && row.ratePct > LOW_ATTACH_CEILING_PCT) {
      warnings.push({
        year: row.year,
        observedPct: row.ratePct,
        expectedPct: baseline?.[row.year],
        message: `${jurisdiction} ${row.year}: attach rate ${row.ratePct}% exceeds the ${LOW_ATTACH_CEILING_PCT}% pre-2024 ceiling — battery detection may be over-matching (this is what a SQL LIKE hitting ADDRESS looks like)`,
      });
    }
    if (row.year >= 2025 && row.ratePct < HIGH_ATTACH_FLOOR_PCT) {
      warnings.push({
        year: row.year,
        observedPct: row.ratePct,
        expectedPct: baseline?.[row.year],
        message: `${jurisdiction} ${row.year}: attach rate ${row.ratePct}% is below the ${HIGH_ATTACH_FLOOR_PCT}% floor for a post-2024 year — battery detection may be under-matching, which ships battery homes as targets`,
      });
    }
    const expected = baseline?.[row.year];
    if (expected !== undefined && Math.abs(row.ratePct - expected) > Math.max(10, expected * 0.5)) {
      warnings.push({
        year: row.year,
        observedPct: row.ratePct,
        expectedPct: expected,
        message: `${jurisdiction} ${row.year}: attach rate ${row.ratePct}% departs sharply from the verified ${expected}%`,
      });
    }
  }
  return warnings;
}
