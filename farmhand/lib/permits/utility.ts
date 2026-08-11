/**
 * Utility named in the permit text.
 *
 * Permit descriptions sometimes name the utility outright ("PER SRP
 * SPECIFICATIONS"). That's a direct, per-parcel signal and it beats inferring
 * service territory from the jurisdiction — territories interleave street by
 * street in the Valley, so a city-level lookup is a guess where this is a fact.
 *
 * It matters commercially because the solar business qualifies on utility:
 * SRP homes are out of market, APS homes are in. A parcel whose own permit says
 * SRP can be set aside before anyone spends an enrichment credit on it.
 *
 * Absence of a mention means nothing — most descriptions don't name a utility.
 * This returns undefined in that case and the caller falls back to territory
 * lookup; it never guesses.
 */

import type { UtilityMention } from "./types";

const PATTERNS: Array<{ utility: UtilityMention; re: RegExp }> = [
  // Bounded to avoid matching inside unrelated words; SRP and APS are short.
  { utility: "SRP", re: /\bSRP\b|\bSALT RIVER PROJECT\b/ },
  { utility: "APS", re: /\bAPS\b|\bARIZONA PUBLIC SERVICE\b/ },
  { utility: "TEP", re: /\bTEP\b|\bTUCSON ELECTRIC POWER\b/ },
  { utility: "TRICO", re: /\bTRICO\b/ },
  { utility: "SSVEC", re: /\bSSVEC\b|\bSULPHUR SPRINGS VALLEY\b/ },
];

/**
 * The utility this description names, or undefined when it names none — or
 * names more than one, which is not a usable signal.
 */
export function detectUtility(description: string): UtilityMention | undefined {
  const d = description.toUpperCase();
  const hits = PATTERNS.filter((p) => p.re.test(d)).map((p) => p.utility);
  return hits.length === 1 ? hits[0] : undefined;
}
