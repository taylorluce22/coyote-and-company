/**
 * THE UNIT OF MEASURE IS THE DISCRIMINATOR.
 *
 * ============================================================================
 * THE QUESTION AND THE NEGATIVE RESULT THAT CAME FIRST
 * ============================================================================
 *
 * A parcel with a 2017 PV permit and a 2021 PV permit, both filed under the
 * identical workclass: is the second one an array addition or a hidden
 * battery? Buckeye files storage under 'Photovoltaic System' — the same label
 * a new install gets — so no permit-type lookup can answer it.
 *
 * All 8942 Buckeye photovoltaic permits were pulled with full metadata and
 * tested. STRUCTURAL METADATA IS USELESS AS A DISCRIMINATOR. Battery-mentioning
 * PV permits and non-battery PV permits are statistically identical:
 *
 *   permittype   'Electrical - Residential' for 100% of BOTH
 *   permitclass  'Photovoltaic System' for BOTH
 *   squarefeet   zero for 95.2% vs 97.0%
 *   value        $27,943 avg vs $28,484 avg
 *   KW DC named  ~95% of BOTH
 *
 * Do not build a classifier on value, squarefeet, permittype or permitclass.
 * It will not work. That is a measured result, not an intuition.
 *
 * ============================================================================
 * WHAT DOES WORK
 * ============================================================================
 *
 * Panels are described in DC POWER (kW DC, W DC). Batteries are described in
 * ENERGY CAPACITY (kWh). Buckeye has 1113 permits containing KWH. So, in
 * precedence order:
 *
 *   1. battery keyword OR a kWh figure  -> BATTERY, exclude the parcel
 *   2. else a DC power rating           -> PANEL install or addition, KEEP
 *   3. else                             -> manual review
 *
 * VALIDATION: of 405 second-or-later PV permits on parcels with no battery
 * keyword anywhere, 295 stated KW DC under a strict regex and 9 did not. All 9
 * were read by hand and NONE is a battery — four are panel installs written in
 * watts ("4760W DC/ 4060W AC"), one is lowercase kW with a module count, one is
 * a commercial school canopy written "191,40 KW(DC)" with a comma decimal, and
 * three are electrical modifications to an existing solar system. Zero
 * batteries in the residual.
 *
 * Consequence for the queue: a second PV permit in Buckeye is essentially never
 * a hidden battery, so `second-pv-permit` is an INFORMATIONAL NOTE, not a
 * quarantine. Those parcels stay in the queue.
 */

import { hasBatteryEvidence } from "./batteryMatcher";

/**
 * Every DC-power format observed live, in one pattern.
 *
 *   KW DC · KWDC · kW DC · W DC · KW(DC) · "191,40" (comma decimal)
 *
 * `(?!H)` after the unit is load-bearing: without it "13.5 KWH" parses as a
 * 13.5 kW array, which is the exact inversion this module exists to prevent —
 * an energy capacity read as a DC power rating.
 */
const DC_POWER_RE = /(\d+(?:[.,]\d+)?)\s*(K?W)(?!H)\s*\(?\s*(DC|AC)?\s*\)?/gi;

/**
 * "191,40" is a comma DECIMAL (a real Buckeye row); "1,234" is a thousands
 * separator. One or two digits after the comma means decimal, three means
 * thousands — which is how both are written in practice.
 */
function parseNumber(raw: string): number {
  const decimalComma = /^\d+,\d{1,2}$/.test(raw);
  return Number(decimalComma ? raw.replace(",", ".") : raw.replace(/,/g, ""));
}

/**
 * Watts to kilowatts, and ONLY for watt-denominated values.
 *
 * The stated rule was "divide any DC value above 1000 by 1000", to stop a
 * genuine 4760W house array from reading as a 4760 kW commercial plant. That is
 * right about watts and wrong about kilowatts: "1019.83 KW DC" is a real Mesa
 * value from an actual commercial array, and dividing it would turn a
 * 1019.83 kW plant into a 1.02 kW house and walk it straight through the
 * residential gate. So the normalization keys off the UNIT, which achieves the
 * intent without inverting the case it was meant to protect.
 *
 * A value written "4760 KW DC" is left alone: ambiguous, and excluding a
 * possible commercial row is the cheap direction.
 */
function toKw(value: number, unit: string): number {
  if (/^K/i.test(unit)) return value; // already kilowatts
  return value > 1000 ? value / 1000 : value; // watts: 4760W -> 4.76, 8.295W -> 8.295
}

/**
 * Largest DC power rating stated, in kW. Prefers an explicitly DC-marked
 * figure, ignores AC entirely, and falls back to an unmarked kW rating.
 * Returns undefined when no rating is stated — unknown, never a pass.
 */
export function parseDcKw(description: string): number | undefined {
  const d = description.toUpperCase();
  const dc: number[] = [];
  const unmarked: number[] = [];
  let m: RegExpExecArray | null;
  DC_POWER_RE.lastIndex = 0;
  while ((m = DC_POWER_RE.exec(d)) !== null) {
    const value = parseNumber(m[1]);
    if (!Number.isFinite(value)) continue;
    const kw = toKw(value, m[2]);
    if (m[3] === "DC") dc.push(kw);
    else if (m[3] !== "AC") unmarked.push(kw);
  }
  if (dc.length) return Math.max(...dc);
  // Unmarked ratings ("4.1kW (10 MODULES, 1 INVERTER)") count; AC-marked ones
  // never do, not even as a fallback. An AC figure understates the array and
  // would quietly become the system size on a permit that states only AC.
  return unmarked.length ? Math.max(...unmarked) : undefined;
}

/**
 * A kWh figure — energy capacity, which is how storage is described and how PV
 * never is. Both spellings matter: "27 KWH" has a word boundary before KWH,
 * "13.5KWH" does not.
 */
export function hasEnergyCapacity(description: string): boolean {
  const d = description.toUpperCase();
  return /\bKWH\b/.test(d) || /\d\s?KWH\b/.test(d);
}

export type PvUnitVerdict = "battery" | "panels" | "review";

export interface PvUnitAssessment {
  verdict: PvUnitVerdict;
  /** DC rating in kW when the permit states one. */
  kwDc?: number;
  reason: string;
}

/** The three-step precedence above, applied to one permit description. */
export function assessPvUnits(description: string): PvUnitAssessment {
  if (hasBatteryEvidence(description)) {
    return { verdict: "battery", reason: "battery keyword" };
  }
  if (hasEnergyCapacity(description)) {
    return { verdict: "battery", reason: "kWh figure — energy capacity, not DC power" };
  }
  const kwDc = parseDcKw(description);
  if (kwDc !== undefined) {
    return { verdict: "panels", kwDc, reason: `${kwDc} kW DC stated` };
  }
  return { verdict: "review", reason: "no battery evidence and no DC rating stated" };
}

/**
 * Permit numbers referenced inside a description — "PV INSTALL ON PERMIT
 * ELECR-22-0699", "(ELECR-20-11490)". 43.7% of second permits say they are
 * additions and usually cite the original inline, which gives a verified chain
 * of work on the property rather than an inferred one.
 */
export function parseLinkedPermits(description: string): string[] {
  const out = new Set<string>();
  const re = /\b([A-Z]{2,6}[A-Z0-9]{0,4}-\d{2}-\d{3,6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(description.toUpperCase())) !== null) out.add(m[1]);
  return [...out].slice(0, 5);
}

/** The permit says in words that it extends an existing system. */
export function mentionsExpansion(description: string): boolean {
  const d = description.toUpperCase();
  return (
    // `.` rather than `[^.]` between the verb and its object: "ADDING 2.92 KW
    // DC TO AN EXISTING SYSTEM" has a decimal point in the middle of the very
    // phrase being matched, so excluding periods excluded the real rows.
    /\bADD(?:ING|ITION|ED)?\b.{0,60}\bEXISTING\b/.test(d) ||
    /\bADD(?:ING|ITION|ED)?\b.{0,20}\bMODULES?\b/.test(d) ||
    /\bEXPAND(?:ING|SION)?\b.{0,40}\b(?:SYSTEM|ARRAY)\b/.test(d)
  );
}

/**
 * The live derivation this module is pinned to. Buckeye, all 8942
 * photovoltaic permits.
 */
export const BUCKEYE_UNIT_VALIDATION = {
  photovoltaicPermits: 8942,
  permitsMentioningKwh: 1113,
  /** Second-or-later PV permits on parcels with NO battery keyword anywhere. */
  secondOrLaterNoBatteryKeyword: 405,
  /** Of those, stated KW DC under the original strict regex. */
  statedKwDcStrict: 295,
  /** Did not — all 9 read by hand. */
  residualUnparsed: 9,
  /** How many of the residual turned out to be batteries. */
  residualBatteries: 0,
  /** Share of second permits that say in words that they are additions. */
  expansionWordingPct: 43.7,
  /** Metadata that does NOT discriminate — do not build a classifier on these. */
  uselessDiscriminators: ["value", "squarefeet", "permittype", "permitclass"],
} as const;

/** The nine hand-read residuals — the regex must now parse the six that state a size. */
export const RESIDUAL_UNPARSED_SAMPLES: ReadonlyArray<{ text: string; kwDc?: number; why: string }> = [
  { text: "3.060W DC / 3.000W AC", kwDc: 3.06, why: "panel install written in watts" },
  { text: "4760W DC/ 4060W AC", kwDc: 4.76, why: "watts above 1000 — normalize or it reads commercial" },
  { text: "9860W DC / 10000W AC", kwDc: 9.86, why: "watts, no space before unit" },
  { text: "8.295 W DC", kwDc: 8.295, why: "watts below 1000 — already kW-scaled, leave alone" },
  { text: "4.1kW (10 MODULES, 1 INVERTER)", kwDc: 4.1, why: "lowercase kW, no DC marker" },
  { text: "191,40 KW(DC)", kwDc: 191.4, why: "comma decimal + parenthesised DC; commercial school canopy" },
  {
    text: "DERATE MAIN BREAKER TO 175 AMPS **PV INSTALL ON PERMIT ELECR-22-0699**",
    why: "electrical modification to an existing system — review, not battery",
  },
  {
    text: "INSTALL BREAKER IN MAIN PANEL; CONNECTION TYPE CHANGED FROM LINE SIDE TAP TO BACK-FED BREAKER",
    why: "electrical modification — review, not battery",
  },
  {
    text: "CHANGING DERATE FROM EXISTING SOLAR SYSTEM TO LINE SIDE TAP",
    why: "electrical modification — review, not battery",
  },
];
