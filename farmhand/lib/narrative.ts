/**
 * Editorial narrative gate — the content engine's thesis, enforced.
 *
 * The solar content engine exists to educate homeowners on rising electricity
 * prices and the tactics utilities use to raise bills (rate cases, surcharges,
 * fees, plan changes) — with solar + battery ownership as the homeowner's
 * hedge. Every headline and post angle must BUILD that case or expose a
 * tactic. Angles that read as reassurance ("threat removed", "rates might
 * drop", "regulators have it handled") relieve the pain the content is meant
 * to surface — they undercut the sell and never ship.
 *
 * The primary gate is the generation prompt (/api/discover intel mode); this
 * module is the deterministic backstop, applied server-side on fresh items AND
 * at render time so previously-persisted off-narrative angles disappear too.
 * Facts are never altered — this is a framing gate, not a fact filter.
 */

const RELIEF_SIGNATURES: RegExp[] = [
  /remov\w+[^.]{0,40}threat/,           // "removing an immediate cost threat"
  /no longer (a )?(threat|concern|worry)/,
  /(crisis|threat) averted/,
  /good news for (ratepayers|homeowners|customers)/,
  /can (relax|rest easy|breathe easy)/,
  /reassur/,
  /(bills?|rates?|costs?)[^.]{0,30}\b(drop|fall|going down|go down|decrease)/,
  /lower(ing)?[^.]{0,24}(future )?(costs?|bills?|rates?)/, // "potentially lowering future costs"
  /sav(e|ing)[^.]{0,32}(per year|a year|\/year|annually)/, // "saving households ~$220/year"
];

/** Solar-benefit framing IS the sell — never treat it as relief language. */
const SOLAR_VALUE = /(solar|battery|panels?)[^.]{0,30}(sav|cut|lower|protect|lock|shield|hedge)/;

/** True when a post angle reads as utility/regulator reassurance instead of
    pain or tactic — i.e. it contradicts the education narrative. */
export function offNarrative(angle: string): boolean {
  const a = (angle || "").toLowerCase();
  if (!a) return false;
  if (SOLAR_VALUE.test(a)) return false;
  return RELIEF_SIGNATURES.some((r) => r.test(a));
}

/** Filter helper for intel item lists. */
export function onNarrativeItems<T extends { angle: string }>(items: T[]): T[] {
  return items.filter((it) => !offNarrative(it.angle));
}
