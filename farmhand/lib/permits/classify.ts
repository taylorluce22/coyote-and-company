/**
 * FILTER stage, part 1: classify a permit's description_of_work.
 *
 * The one rule that keeps the target list honest: battery evidence INSIDE a
 * solar permit description ("PV SOLAR ... WITH BATTERY") means the parcel HAS
 * a battery. Classifying that permit as plain "solar" would put a
 * battery-equipped home on the cold-call list — the exact false positive this
 * module exists to prevent. So classification is per-description and the
 * combined case gets its own class.
 *
 * Separator tolerance is deliberate throughout: permit clerks type
 * "POWER-WALL", "PHOTO-VOLTAIC", "ENERGY  STORAGE" with a double space. Every
 * multi-word pattern accepts space, hyphen, or slash, because a battery
 * keyword that fails to match is a false positive on the call list.
 *
 * Patterns are word-bounded where the keyword is short: a substring match for
 * ESS would fire on ADDRESS/ASSESSMENT/ACCESS, and KWH must still match when
 * glued to a number ("13.5KWH").
 */

import type { PermitClass } from "./types";

/** Space, hyphen, slash, or nothing — between the words of a compound keyword. */
const SEP = "[\\s\\-/]*";

const BATTERY_PATTERNS: RegExp[] = [
  /\bBATTER(?:Y|IES)\b/,
  new RegExp(`\\bPOWER${SEP}WALL`), // POWERWALL, POWER WALL, POWER-WALL
  new RegExp(`\\bPW${SEP}3\\b`),
  new RegExp(`\\bENERGY${SEP}STORAGE\\b`),
  new RegExp(`\\bSTORAGE${SEP}SYSTEM\\b`),
  /\bESS\b/,
  /\bBESS\b/,
  /\bB\.E\.S\.S\.?/,
  /(?:\d\s*|\b)KWH\b/, // battery capacity is quoted in kWh; PV size is kW DC
];

/** Unambiguous PV evidence — immune to the thermal exclusions below. */
const PV_STRONG_PATTERNS: RegExp[] = [
  /\bPV\b/,
  new RegExp(`\\bPHOTO${SEP}VOLTAIC\\b`),
];

const SOLAR_PATTERNS: RegExp[] = [...PV_STRONG_PATTERNS, /\bSOLAR\b/];

/**
 * Solar-thermal scopes are not PV — no battery retrofit angle. These only
 * apply when the description has NO strong PV token, so a real PV permit that
 * also mentions a water heater still classifies as solar.
 */
const THERMAL_PATTERNS: RegExp[] = [
  /\bSOLAR\s+THERMAL\b/,
  /\bTHERMAL\s+SOLAR\b/,
  /\bSOLAR\s+(?:HOT\s+)?WATER\b/,
  /\bSOLAR\s+POOL\b/,
  /\bSOLAR\s+(?:HEAT|HEATER|HEATING)\b/,
  /\bWATER\s+HEATER\b/,
  /\bPOOL\s+(?:HEAT|HEATER|HEATING)\b/,
  /\bSOLAR\s+(?:TUBE|TUBES|SCREEN|SCREENS|SHADE|SHADES|LIGHT|LIGHTS)\b/,
  /\bSOLAR\s+ATTIC\s+FAN\b/,
];

export function hasBatteryEvidence(desc: string): boolean {
  const d = desc.toUpperCase();
  return BATTERY_PATTERNS.some((r) => r.test(d));
}

export function classifyDescription(desc: string): PermitClass {
  const d = desc.toUpperCase();
  const battery = BATTERY_PATTERNS.some((r) => r.test(d));
  const solarHit = SOLAR_PATTERNS.some((r) => r.test(d));
  const pvStrong = PV_STRONG_PATTERNS.some((r) => r.test(d));
  const thermalOnly = solarHit && !pvStrong && THERMAL_PATTERNS.some((r) => r.test(d));
  const solar = solarHit && !thermalOnly;
  if (solar && battery) return "solar+battery";
  if (solar) return "solar";
  if (battery) return "battery";
  return "other";
}
