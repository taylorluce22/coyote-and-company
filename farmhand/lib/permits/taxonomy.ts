/**
 * Permit classification taxonomy.
 *
 * These fifteen tags are the taxonomy the commercial permit-data vendors use.
 * Adopting it rather than inventing our own buys two things: a proven set of
 * boundaries, and comparability if we ever benchmark against a vendor feed.
 *
 * The detail that matters most for this product: BATTERY is a FIRST-CLASS TAG,
 * separate from SOLAR. That independently confirms what enumerating the three
 * jurisdictions' permit vocabularies already showed — no city files storage as
 * its own permit type, so battery is a CLASSIFICATION problem, not a
 * permit-type lookup. Every serious vendor solves it by classifying text.
 */

export const PERMIT_TAGS = [
  "SOLAR",
  "BATTERY",
  "EV_CHARGER",
  "ROOFING",
  "ELECTRICAL",
  "ELECTRIC_METER",
  "GENERATOR",
  "HVAC",
  "HEAT_PUMP",
  "POOL_AND_HOT_TUB",
  "WATER_HEATER",
  "NEW_CONSTRUCTION",
  "ADDITION",
  "ADU",
  "REMODEL",
] as const;

export type PermitTag = (typeof PERMIT_TAGS)[number];

/** How a permit's tags were decided. Both paths stay auditable and comparable. */
export type ClassificationMethod = "rule" | "llm" | "source";

export interface Classification {
  tags: PermitTag[];
  method: ClassificationMethod;
  /** 0–1. Rule matches report 1 for a keyword hit; the LLM reports its own. */
  confidence: number;
}
