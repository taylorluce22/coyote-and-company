/**
 * Permit completion status — which permits represent a system that actually
 * went in, versus one still moving through the counter.
 *
 * Mesa, verified live 2026-08-10 across the 1422 permits matching SOLAR:
 *
 *   C of C Issued              1107  complete
 *   Finaled                     146  complete
 *   C of O Issued                15  complete
 *   Issued                       77  not complete
 *   Fees Due                     33  not complete
 *   Revisions Required           17  not complete
 *   Fees Paid                    13  not complete
 *   In Review                     7  not complete
 *   Finaled – C of C Required     4  AMBIGUOUS (en dash!)
 *   Closed                        1  AMBIGUOUS
 *   Ready to Issue                1  not complete
 *   Submitted                     1  not complete
 *
 * Two traps live in that table.
 *
 * First, "Finaled" is NOT the dominant completion status for solar — it's 146
 * of roughly 1268 completed. "C of C Issued" is, at 1107. An adapter built
 * around Finaled drops about 89% of Mesa's completed solar permits and reports
 * a healthy-looking number while doing it.
 *
 * Second, "Finaled – C of C Required" uses an EN DASH, and it still requires a
 * certificate of completion — it is not complete. A substring or startsWith
 * test on "Finaled" captures it as complete. So comparison here is exact match
 * against a normalized set, never a prefix or substring test, and normalization
 * folds every Unicode dash to a plain hyphen before comparing.
 */

export type CompletionStatus = "complete" | "incomplete" | "ambiguous" | "unknown";

/**
 * Fold to a comparable form: every Unicode dash variant to a plain hyphen,
 * runs of whitespace to one space, trimmed, upper case.
 */
export function normalizeStatus(raw: unknown): string {
  return String(raw ?? "")
    // U+2010..U+2015 hyphen/dash family, U+2212 minus, U+2E3A/B long dashes.
    .replace(/[‐-―−⸺⸻]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const MESA_COMPLETE = new Set(["C OF C ISSUED", "FINALED", "C OF O ISSUED"]);

const MESA_INCOMPLETE = new Set([
  "ISSUED",
  "FEES DUE",
  "FEES PAID",
  "IN REVIEW",
  "READY TO ISSUE",
  "REVISIONS REQUIRED",
  "SUBMITTED",
]);

/**
 * Neither counted nor discarded. "Finaled - C of C Required" still owes a
 * certificate; "Closed" doesn't say why it closed. Both get surfaced so the
 * operator decides, rather than being absorbed into a bucket by guesswork.
 */
const MESA_AMBIGUOUS = new Set(["FINALED - C OF C REQUIRED", "CLOSED"]);

export function classifyMesaStatus(raw: unknown): CompletionStatus {
  const s = normalizeStatus(raw);
  if (!s) return "unknown";
  if (MESA_COMPLETE.has(s)) return "complete";
  if (MESA_INCOMPLETE.has(s)) return "incomplete";
  if (MESA_AMBIGUOUS.has(s)) return "ambiguous";
  // A status string nobody has seen before is reported, not assumed either way.
  return "unknown";
}

/** Honest denominator for Mesa yield reporting: completed solar permits, not all SOLAR matches. */
export const MESA_COMPLETED_SOLAR_BASELINE = 1268;
export const MESA_SOLAR_MATCH_BASELINE = 1422;
