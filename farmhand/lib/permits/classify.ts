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

/**
 * Battery evidence. Word-bounded, ALWAYS — and never expressed as a SQL LIKE.
 *
 * THE RULE, learned twice the hard way: SQL is a coarse over-fetch net only.
 * Precision matching happens here, in code, with word boundaries. Both
 * directions of that mistake have now been observed:
 *
 *   LIKE '%ESS %'  matches "ADDRESS " → false battery hits → real targets
 *                  wrongly excluded (this cost ~105 Buckeye targets).
 *   LIKE '% ESS%'  misses "ESS INSTALL 27 KWH" at the start of a description
 *                  → battery permits never fetched → battery homes shipped
 *                  as targets, which is the worse direction.
 *
 * Neither is fixable by fiddling with the wildcard. Over-fetch broadly in SQL,
 * decide here.
 *
 * Two entries look odd and are load-bearing:
 *   \bRESU\b  — LG's battery line. Unbounded, RESU matches RESULTS and
 *               RESUBMIT (815 Buckeye rows).
 *   \bTESLA\b — 614 Buckeye permits name Tesla, many of which never say
 *               Powerwall. This does over-exclude Tesla solar-only homes, and
 *               that is the accepted trade: excluding a real target is cheap,
 *               calling a battery owner is not.
 */
const BATTERY_PATTERNS: RegExp[] = [
  /\bBATTER(?:Y|IES)\b/,
  /\bIQ BATTER/, // Enphase IQ Battery
  new RegExp(`\\bPOWER${SEP}WALL\\b`), // POWERWALL, POWER WALL, POWER-WALL
  new RegExp(`\\bPW${SEP}[23]\\b`), // PW2 and PW3
  new RegExp(`\\bENERGY${SEP}STORAGE\\b`),
  new RegExp(`\\bSTORAGE${SEP}SYSTEM\\b`),
  /\bENERGY BANK\b/,
  /\bBACKUP GATEWAY\b/,
  /\bESS\b/,
  /\bBESS\b/,
  /\bB\.?E\.?S\.?S\b/,
  // Storage brands. A permit often names the product and nothing else.
  /\bENCHARGE\b/,
  /\bPWRCELL\b/,
  new RegExp(`\\bFRANKLIN${SEP}WH\\b`),
  /\bSONNEN\b/,
  /\bEG4\b/,
  /\bSIMPLIPHI\b/,
  /\bRESU\b/,
  /\bTESLA\b/,
  /\d+(?:\.\d+)?\s?KWH\b/, // capacity is quoted in kWh; PV size is kW DC
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
 * Positive evidence that this permit INSTALLS a photovoltaic array.
 *
 * The gate is stated this way round on purpose. An earlier version asked "does
 * this mention a panel?" and tried to enumerate every ancillary phrasing; the
 * first live run leaked ~36 electrical and service-panel permits through it,
 * including "REPLACE 200-AMP ELECTRICAL PANEL WITH 400-AMP ELECTRICAL PLAN AND
 * INSTALL BI-DIRECTIONAL ELECTRICAL METER FOR NEW PV SOLAR" — which names PV
 * SOLAR but installs a meter. Enumerating the negative space never converges.
 *
 * So a solar-worded permit counts as an install only when it affirmatively
 * shows an array: a kW rating, roof or ground mounting, modules, an array, or
 * a named PV system. Everything else is ancillary, whatever it mentions.
 *
 * Both live keepers satisfy this:
 *   "IND-2873. 6.300 KW DC ROOF MOUNTED SOLAR WITH (N) 225A MAIN SERVICE PANEL"
 *   "SELF-INSTALL (BY OWNER) OF ROOFTOP PV SOLAR SYSTEM, CONDITIONED ON ..."
 * and both keep their panel mentions, because mentioning a panel was never
 * the disqualifier — failing to install PV is.
 */
const PV_INSTALL_EVIDENCE: RegExp[] = [
  /\b\d+(?:[.,]\d+)?\s*KW\b/,
  /\bMODULES?\b/,
  /\bARRAY\b/,
  /\bROOF\s*(?:TOP)?\s*[- ]?MOUNT/,
  /\bROOFTOP\b/,
  /\bGROUND\s*[- ]?MOUNT/,
  /\b(?:SOLAR|PV)\s+PANELS?\b/,
];

/**
 * Naming a "PV SOLAR SYSTEM" is weaker evidence than the list above, because
 * the phrase appears just as readily as the BENEFICIARY of ancillary work
 * ("INSTALL SUBPANEL FOR PV SOLAR SYSTEM") as it does as the subject of an
 * install. It only counts when no purpose clause is pointing at it.
 */
const PV_SYSTEM_MENTION = /\b(?:PV|SOLAR)(?:\s+\w+){0,2}\s+SYSTEM\b/;

/** "...FOR PV SOLAR", "...FOR THE NEW SOLAR SYSTEM" — solar as the beneficiary, not the work. */
const PURPOSE_CLAUSE = /\bFOR\s+(?:A\s+|THE\s+|NEW\s+|FUTURE\s+){0,2}(?:PV|SOLAR)/;

export function hasBatteryEvidence(desc: string): boolean {
  const d = desc.toUpperCase();
  return BATTERY_PATTERNS.some((r) => r.test(d));
}

/** Affirmative evidence that an array is going in. */
export function hasPvInstallEvidence(desc: string): boolean {
  const d = desc.toUpperCase();
  if (PV_INSTALL_EVIDENCE.some((r) => r.test(d))) return true;
  return PV_SYSTEM_MENTION.test(d) && !PURPOSE_CLAUSE.test(d);
}

/**
 * True when a solar-worded permit does not actually install PV. A permit that
 * does both ("INSTALL 7.5 KW PV SOLAR AND 200 AMP MAIN PANEL UPGRADE") is a
 * real install and is not caught here.
 */
export function isAncillaryScope(desc: string): boolean {
  return !hasPvInstallEvidence(desc);
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
