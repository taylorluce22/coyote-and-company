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

/**
 * Electrical infrastructure done IN SERVICE OF solar — not a PV install.
 *
 * Live Mesa record: "ELECTRICAL PERMIT TO INSTALL 225 AMP PANEL METER MAIN
 * COMBO FOR PV SOLAR", type_of_work "Res (OTH) -- Electrical". It matches
 * PV SOLAR cleanly, but the thing being installed is a service panel. Counting
 * it as an install puts a house on the target list on the strength of a panel
 * swap, and the house may have no array at all — or may have had one for a
 * decade.
 */
const ANCILLARY_SUBJECT_PATTERNS: RegExp[] = [
  /\b(?:MAIN|SERVICE|SUB)\s*PANEL\b/,
  /\bPANEL\s+(?:UPGRADE|CHANGE|CHANGE ?OUT|REPLACEMENT|SWAP|RELOCAT)/,
  /\bPANEL\s+METER\b/,
  /\bMETER\s+(?:MAIN|COMBO|SOCKET|BASE|CAN|RELOCAT)/,
  /\bMAIN\s+COMBO\b/,
  /\bMPU\b/,
  /\bSERVICE\s+(?:UPGRADE|CHANGE|ENTRANCE|REPLACEMENT|RECONNECT)/,
  /\bSUB\s?PANEL\b/,
  /\b\d{2,4}\s*AMP\b/, // "225 AMP" — a rating quoted on gear, never on an array
  /\bDERATE\b/,
  /\bRECONDUCTOR\b/,
  /\bLOAD\s+CENTER\b/,
];

/**
 * Evidence of an actual photovoltaic array, as opposed to gear that serves one.
 * A kW rating, modules, an array, roof mounting, or the literal phrase
 * "SOLAR/PV PANELS" (which is the array itself, not a load center).
 */
const PV_ARRAY_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*KW\b/,
  /\bMODULES?\b/,
  /\bARRAY\b/,
  /\bROOF\s*(?:TOP)?\s*MOUNT/,
  /\bGROUND\s*MOUNT/,
  /\b(?:SOLAR|PV)\s+PANELS?\b/,
  /\bINVERTER\b/,
];

export function hasBatteryEvidence(desc: string): boolean {
  const d = desc.toUpperCase();
  return BATTERY_PATTERNS.some((r) => r.test(d));
}

/**
 * True when the description's subject is electrical gear rather than an array.
 * A permit that does both ("INSTALL 7.5 KW PV SOLAR AND 200 AMP MAIN PANEL
 * UPGRADE") is a real install and must not be caught here — hence the array
 * check overriding the ancillary markers.
 */
export function isAncillaryScope(desc: string): boolean {
  const d = desc.toUpperCase();
  const ancillary = ANCILLARY_SUBJECT_PATTERNS.some((r) => r.test(d));
  const array = PV_ARRAY_PATTERNS.some((r) => r.test(d));
  return ancillary && !array;
}

export function classifyDescription(desc: string): PermitClass {
  const d = desc.toUpperCase();
  const battery = BATTERY_PATTERNS.some((r) => r.test(d));
  const solarHit = SOLAR_PATTERNS.some((r) => r.test(d));
  const pvStrong = PV_STRONG_PATTERNS.some((r) => r.test(d));
  const thermalOnly = solarHit && !pvStrong && THERMAL_PATTERNS.some((r) => r.test(d));
  const solar = solarHit && !thermalOnly;
  // Battery evidence wins over the ancillary test on purpose: a panel upgrade
  // "FOR POWERWALL" is still proof a battery is going in on that parcel, and
  // subtracting the parcel is the safe direction.
  if (solar && battery) return "solar+battery";
  if (battery) return "battery";
  if (solar) return isAncillaryScope(d) ? "solar-ancillary" : "solar";
  return "other";
}
