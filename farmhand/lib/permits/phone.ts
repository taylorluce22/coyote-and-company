/**
 * Canonical phone form — the join key for every compliance comparison.
 *
 * Numbers arrive from three places in three shapes: a vendor append
 * ("+1 (602) 555-1234"), a hand-typed manual entry ("602-555-1234"), and an
 * operator's DNC-scrub result list. Before this module existed each consumer
 * did its own `replace(/\D/g, "")` and compared with `===`, so an 11-digit
 * stored number never matched a 10-digit scrub result: the number was stamped
 * "clear" because it wasn't found in the listed set, and an opt-out recorded
 * against one format never suppressed a lead stored in the other. Both
 * failures point the unsafe way — toward calling someone who said no.
 *
 * Every number entering the store or being compared MUST go through
 * canonicalPhone() first.
 */

/** NANP canonical form: 10 digits, country code dropped. Returns "" when there's nothing usable. */
export function canonicalPhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/** A number we could actually dial: a complete NANP subscriber number. */
export function isDialable(canonical: string): boolean {
  return canonical.length === 10;
}
