/**
 * BATTERY MATCHER — core infrastructure, not a helper.
 *
 * ============================================================================
 * THE STRUCTURAL FINDING THAT MAKES THIS MODULE LOAD-BEARING
 * ============================================================================
 *
 * There is NO battery permit type in any of the three live systems. This was
 * established by enumerating the full permit vocabulary in each, so it is a
 * fact about how AZ jurisdictions file storage — not a gap in the search.
 *
 *   BUCKEYE — 105 workclass values, none of them battery, storage or ESS. Of
 *     1273 battery permits, 1104 (87%) are filed under workclass
 *     'Photovoltaic System' — the IDENTICAL label a solar install gets — plus
 *     3 under 'Photovoltaic Standard Plan' and 134 under 'Misc', with the
 *     remainder scattered across Antenna, Generator, Run, Alarms. permittype
 *     is only trade-level (Building/Electrical/Mechanical/Plumbing ×
 *     Residential/Commercial) and permitclass has no storage entry either.
 *
 *   PEORIA — PER_TYPE is only Miscellaneous/Residential/Commercial and
 *     PER_SUB_TYPE only Miscellaneous Residential, Miscellaneous Commercial,
 *     SolarPV, Swimming Pool-Spa-Hot Tub, Commercial Accessory Use. Battery
 *     exists ONLY as a checkbox attribute on a permit record
 *     (USER_B1_CHECKBOX_DESC='Battery Storage') — an attribute, not a
 *     category. That is why Peoria is the best structured signal we have and
 *     also why it is unique.
 *
 *   MESA — no battery category. 1251 battery-mentioning permits sit at
 *     type_of_work='Electrical', which is exactly where 1123 solar permits
 *     also sit. The identical bucket.
 *
 * Consequence: reading descriptions is not a shortcut anyone chose. In Buckeye
 * and Mesa it is the ONLY battery signal that exists. This matcher therefore
 * carries the correctness of the entire product in two of three cities, and it
 * gets its own fixture corpus (fixtures/battery.ts) rather than a few spot
 * checks inside a classifier test.
 *
 * ============================================================================
 * THE RULE
 * ============================================================================
 *
 * Word-bounded regex, in code, ALWAYS. Never SQL LIKE — LIKE cannot express a
 * word boundary, and both failure directions have been observed live:
 *   LIKE '%ESS %' matches "ADDRESS " → real targets wrongly excluded.
 *   LIKE '% ESS%' misses "ESS INSTALL 27 KWH" → battery homes shipped as
 *     targets, the worse direction.
 * SQL over-fetches with safe substrings only (see coarseNet.ts); this decides.
 */

/** Space, hyphen, slash, or nothing — permit clerks type all of them. */
const SEP = "[\\s\\-/]*";

/**
 * Battery evidence patterns.
 *
 * Two entries look odd on sight and are load-bearing:
 *   \bRESU\b  — LG's storage line. Unbounded, RESU matches RESULTS and
 *               RESUBMIT (815 Buckeye rows).
 *   \bTESLA\b — 614 Buckeye permits name Tesla without ever writing
 *               "Powerwall". This does over-exclude Tesla solar-only homes,
 *               and that is the accepted trade: excluding a real target is
 *               cheap, calling a battery owner is not. It is also the entry
 *               most likely to cost genuine volume — revisit it first if
 *               counts come in low.
 */
export const BATTERY_PATTERNS: RegExp[] = [
  /\bBATTER(?:Y|IES)\b/,
  /\bIQ BATTER/, // Enphase IQ Battery
  new RegExp(`\\bPOWER${SEP}WALL\\b`),
  new RegExp(`\\bPW${SEP}[23]\\b`),
  new RegExp(`\\bENERGY${SEP}STORAGE\\b`),
  new RegExp(`\\bSTORAGE${SEP}SYSTEM\\b`),
  /\bENERGY BANK\b/,
  /\bBACKUP GATEWAY\b/,
  /\bESS\b/,
  /\bBESS\b/,
  /\bB\.?E\.?S\.?S\b/,
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

export function hasBatteryEvidence(desc: string): boolean {
  const d = desc.toUpperCase();
  return BATTERY_PATTERNS.some((r) => r.test(d));
}

/** Which pattern fired — for auditing a live run without re-deriving by hand. */
export function batteryMatchReason(desc: string): string | undefined {
  const d = desc.toUpperCase();
  return BATTERY_PATTERNS.find((r) => r.test(d))?.source;
}

/**
 * How a jurisdiction's battery signal is obtained. The confidence difference
 * between a checkbox and a regex over free text is real, so it travels on
 * every row rather than being assumed uniform.
 */
export type BatteryDetectionMethod = "structured_flag" | "description_text" | "none";

export const BATTERY_DETECTION_METHOD: Record<string, BatteryDetectionMethod> = {
  peoria: "structured_flag", // USER_B1_CHECKBOX_DESC='Battery Storage'
  buckeye: "description_text", // no battery workclass exists
  mesa: "description_text", // no battery category exists
  glendale: "none", // PDF only, no scope text reliable enough
  goodyear: "none",
  "litchfield-park": "none",
  "maricopa-unincorporated": "description_text",
  tempe: "description_text",
  scottsdale: "description_text",
  // Backlog cities. Both default to reading text, and both stay "unlearned"
  // (see tagging.ts) until their vocabularies have actually been enumerated —
  // Gilbert's especially, where a SOLAR keyword returned 2 rows out of 215k.
  tucson: "description_text",
  gilbert: "description_text",
};

export function batteryDetectionMethodFor(jurisdiction: string): BatteryDetectionMethod {
  return BATTERY_DETECTION_METHOD[jurisdiction] ?? "description_text";
}
