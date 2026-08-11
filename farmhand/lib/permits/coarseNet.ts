/**
 * The coarse over-fetch net used in SQL, and nothing more.
 *
 * SQL LIKE is incapable of word boundaries, so it must never be asked to
 * DECIDE whether a permit is a battery. It is only allowed to widen the net;
 * `classifyDescription()` makes the call in code, with word-bounded regex.
 *
 * Both failure directions have been observed live:
 *   LIKE '%ESS %'  matches "ADDRESS " → false battery hits → real targets
 *                  wrongly excluded.
 *   LIKE '% ESS%'  misses a description that STARTS with "ESS INSTALL" →
 *                  battery permits never fetched → battery homes shipped as
 *                  targets.
 *
 * Every token below is a safe substring: one that cannot appear inside an
 * unrelated common word. Notably absent are the short, dangerous ones — ESS,
 * BESS, RESU — which are recovered anyway, because a permit naming a battery
 * essentially always also carries BATTERY, STORAGE, KWH, or a brand name.
 * Over-fetching costs a few rows; under-fetching costs correctness.
 */

export const BATTERY_COARSE_TOKENS = [
  "BATTERY",
  "BATTERIES",
  "STORAGE",
  "TESLA",
  "KWH",
  "POWERWALL",
  "POWER WALL",
  "BACKUP",
  "ENPHASE",
  "SOLAREDGE",
  "GATEWAY",
  "EG4",
  "FRANKLIN",
  "ENCHARGE",
  "ENERGY BANK",
  "SONNEN",
  "PWRCELL",
  "SIMPLIPHI",
] as const;

export const SOLAR_COARSE_TOKENS = [
  "SOLAR",
  "PHOTOVOLTAIC",
  "PHOTO-VOLTAIC",
  "PHOTO VOLTAIC",
  "PV",
] as const;

/** Build an OR'd list of LIKE predicates over an already-uppercased field expression. */
export function likeAny(fieldExpr: string, tokens: readonly string[]): string {
  return tokens.map((t) => `${fieldExpr} LIKE '%${t.replace(/'/g, "''")}%'`).join(" OR ");
}
