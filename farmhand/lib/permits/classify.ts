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
 * Patterns are word-bounded where the keyword is short: a substring match for
 * ESS would fire on ADDRESS/ASSESSMENT/ACCESS, and KWH must still match when
 * glued to a number ("13.5KWH").
 */

import type { PermitClass } from "./types";

const BATTERY_PATTERNS: RegExp[] = [
  /\bBATTER(?:Y|IES)\b/,
  /\bPOWER ?WALL/, // POWERWALL, POWERWALL3, POWER WALL
  /\bPW ?3\b/,
  /\bENERGY STORAGE\b/,
  /\bESS\b/,
  /\bB\.?E\.?S\.?S\b/, // B.E.S.S / BESS
  /(?:\d\s*|\b)KWH\b/, // battery capacity is quoted in kWh; PV size is kW DC
];

/** Unambiguous PV evidence — immune to the thermal exclusions below. */
const PV_STRONG_PATTERNS: RegExp[] = [/\bPV\b/, /\bPHOTO ?VOLTAIC\b/];

const SOLAR_PATTERNS: RegExp[] = [...PV_STRONG_PATTERNS, /\bSOLAR\b/];

/** Solar-thermal scopes (water/pool heat) are not PV — no battery retrofit angle. */
const THERMAL_PATTERNS: RegExp[] = [
  /\bSOLAR (?:HOT )?WATER\b/,
  /\bSOLAR POOL\b/,
  /\bPOOL (?:HEAT|HEATER|HEATING)\b/,
  /\bWATER HEATER\b/,
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
