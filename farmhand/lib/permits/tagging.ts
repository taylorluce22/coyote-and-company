/**
 * Two-path classification: deterministic rules first, LLM only where the rules
 * cannot decide.
 *
 * The rules are the fast path AND the regression baseline. They are free,
 * instant, and pinned by the fixture corpus in fixtures/battery.ts, so they stay
 * authoritative for everything they can decide — including, always, SOLAR and
 * BATTERY, which come from classifyDescription()/hasBatteryEvidence() rather
 * than being re-derived here. There is exactly one battery matcher in this
 * codebase and this file does not become a second one.
 *
 * The LLM runs over the rows the rules mark ambiguous, and over EVERY row of a
 * jurisdiction whose vocabulary has not been learned yet. It can only ever ADD
 * tags to a row the rules left empty; it is never allowed to clear a rule tag.
 * That asymmetry is what makes the stage safe to ship: the worst case is that
 * it contributes nothing.
 *
 * The disagreement rate is the actual deliverable. When rules and LLM split on
 * SOLAR or BATTERY, that is a vocabulary gap pointing at itself — the same
 * gap that made a SOLAR keyword return zero rows in a city that writes
 * Photovoltaic. Measuring it is how a new city's terminology gets discovered on
 * day one instead of never.
 */

import { classifyDescription } from "./classify";
import { classifyWithLlm, needsLlmReview, tagsDisagree, type LlmClassifyOptions } from "./llmClassify";
import type { Classification, PermitTag } from "./taxonomy";
import type { Jurisdiction, PermitClass, PermitRecord } from "./types";

/**
 * Jurisdictions whose permit vocabulary has been enumerated live — every
 * workclass, permit type, and status value read off the source, not assumed.
 * Only these three qualify today. Everything else gets the full LLM pass on
 * every row until its vocabulary has been enumerated and folded into the rules.
 */
export const LEARNED_JURISDICTIONS: ReadonlySet<Jurisdiction> = new Set<Jurisdiction>([
  "mesa",
  "buckeye",
  "peoria",
]);

export function jurisdictionLearned(j: Jurisdiction): boolean {
  return LEARNED_JURISDICTIONS.has(j);
}

/**
 * Secondary tags. SOLAR and BATTERY are deliberately absent — those two come
 * from the battery matcher and the install-evidence gate, and duplicating them
 * here would create a second source of truth for the only two tags the product
 * actually turns on.
 *
 * ROOFING excludes "ROOF MOUNT"/"ROOFTOP" for the same reason it is PV install
 * evidence: on a solar permit those words describe the mounting, not roof work.
 */
const SECONDARY_TAG_PATTERNS: Array<[Exclude<PermitTag, "SOLAR" | "BATTERY">, RegExp]> = [
  ["EV_CHARGER", /\bEVSE\b|\bELECTRIC\s+VEHICLE\b|\bEV\s+(?:CHARGER|CHARGING)\b|\bCHARGING\s+STATION\b|\bWALL\s+CONNECTOR\b/],
  ["ROOFING", /\bRE-?ROOF\w*\b|\bROOFING\b|\bSHINGLES?\b|\bROOF\s+(?:REPLACE|REPAIR|TEAR)\w*\b/],
  [
    "ELECTRICAL",
    /\bELECTRICAL\b|\bSUB-?PANEL\b|\bMAIN\s+(?:SERVICE\s+)?PANEL\b|\bSERVICE\s+(?:PANEL\s+)?UPGRADE\b|\bMPU\b|\b\d+\s?A(?:MP)?\s+(?:SERVICE|PANEL)\b/,
  ],
  ["ELECTRIC_METER", /\bMETER\b/],
  ["GENERATOR", /\bGENERATORS?\b|\bGENERAC\b|\bSTANDBY\s+POWER\b/],
  ["HVAC", /\bHVAC\b|\bAIR\s+CONDITION\w*\b|\bFURNACE\b|\bCONDENSER\b|\bA\/C\b|\bDUCTWORK\b/],
  ["HEAT_PUMP", /\bHEAT\s+PUMPS?\b|\bMINI-?SPLITS?\b/],
  ["POOL_AND_HOT_TUB", /\bPOOLS?\b|\bSPAS?\b|\bHOT\s+TUBS?\b/],
  ["WATER_HEATER", /\bWATER\s+HEATERS?\b|\bTANKLESS\b/],
  ["NEW_CONSTRUCTION", /\bNEW\s+CONSTRUCTION\b|\bNEW\s+(?:SINGLE\s+FAMILY|SFR|SFD|RESIDENCE|DWELLING|HOME)\b|\bNEW\s+SFR\b/],
  ["ADDITION", /\bADDITIONS?\b/],
  ["ADU", /\bADU\b|\bACCESSORY\s+DWELLING\b|\bCASITA\b|\bGUEST\s+HOUSE\b/],
  ["REMODEL", /\bREMODEL\w*\b|\bRENOVATIONS?\b|\bTENANT\s+IMPROVEMENT\b/],
];

/**
 * Fold a PermitClass into taxonomy tags.
 *
 * "solar-ancillary" maps to ELECTRICAL and NOT to SOLAR on purpose — that is
 * the whole point of the class, and it is the tag boundary the vendors draw
 * too. A meter-main permit that names PV as its reason is electrical work.
 */
function tagsFromClass(cls: PermitClass): PermitTag[] {
  switch (cls) {
    case "solar":
      return ["SOLAR"];
    case "battery":
      return ["BATTERY"];
    case "solar+battery":
      return ["SOLAR", "BATTERY"];
    case "solar-ancillary":
      return ["ELECTRICAL"];
    default:
      return [];
  }
}

/**
 * Rule-path tags for one description.
 *
 * When the source states the class structurally (Peoria's battery checkbox and
 * PV checklist code), that beats reading free text and the method says "source"
 * so the provenance difference survives downstream.
 */
export function ruleTags(description: string, classOverride?: PermitClass): Classification {
  const cls = classOverride ?? classifyDescription(description);
  const tags = new Set<PermitTag>(tagsFromClass(cls));
  const d = description.toUpperCase();
  for (const [tag, re] of SECONDARY_TAG_PATTERNS) if (re.test(d)) tags.add(tag);
  const out = [...tags];
  return {
    tags: out,
    method: classOverride ? "source" : "rule",
    confidence: out.length > 0 ? 1 : 0,
  };
}

export interface TaggingStats {
  total: number;
  /** Rows the rules settled on their own. */
  ruleOnly: number;
  /** Rows sent to the LLM (ambiguous, or an unlearned jurisdiction). */
  sentToLlm: number;
  /** Rows the LLM actually answered — the rest kept their rule answer. */
  llmAnswered: number;
  /** Rows where the LLM added tags the rules had missed entirely. */
  llmAddedTags: number;
  /** Rows where rule and LLM split on SOLAR or BATTERY — the vocabulary signal. */
  disagreements: number;
  /** Per-jurisdiction disagreement counts, which is where a vocabulary gap shows up. */
  disagreementsByJurisdiction: Record<string, number>;
}

export interface TagBatchOptions extends LlmClassifyOptions {
  /** Off by default. The rule path runs regardless; this only adds the second path. */
  useLlm?: boolean;
  /** Cap on rows sent to the LLM in one call. */
  batchSize?: number;
}

/**
 * Classify a batch of permits and attach the result to each record.
 *
 * Returns the records with `classification` populated plus the stats. Records
 * are copied, not mutated — INGEST output stays the immutable thing FILTER
 * was handed.
 */
export async function tagPermits(
  records: PermitRecord[],
  opts: TagBatchOptions = {}
): Promise<{ records: PermitRecord[]; stats: TaggingStats }> {
  const stats: TaggingStats = {
    total: records.length,
    ruleOnly: 0,
    sentToLlm: 0,
    llmAnswered: 0,
    llmAddedTags: 0,
    disagreements: 0,
    disagreementsByJurisdiction: {},
  };

  const ruled = records.map((r) => ruleTags(r.description, r.classOverride));
  const pending: number[] = [];
  records.forEach((r, i) => {
    const learned = jurisdictionLearned(r.jurisdiction);
    // A structurally stated class is not a guess, so it is never "ambiguous"
    // however sparse the description is.
    const ambiguous = !r.classOverride && needsLlmReview(r.description, ruled[i].tags, learned);
    if (ambiguous) pending.push(i);
    else stats.ruleOnly += 1;
  });

  const out = records.map((r, i) => ({ ...r, classification: ruled[i] }));
  if (!opts.useLlm || pending.length === 0) return { records: out, stats };

  const size = Math.max(1, opts.batchSize ?? 40);
  for (let start = 0; start < pending.length; start += size) {
    const slice = pending.slice(start, start + size);
    stats.sentToLlm += slice.length;
    const answers = await classifyWithLlm(
      slice.map((i) => records[i].description),
      opts
    );
    for (const a of answers) {
      const i = slice[a.index];
      if (i === undefined) continue;
      stats.llmAnswered += 1;
      const rule = ruled[i];
      if (tagsDisagree(rule.tags, a.tags)) {
        stats.disagreements += 1;
        const j = records[i].jurisdiction;
        stats.disagreementsByJurisdiction[j] = (stats.disagreementsByJurisdiction[j] ?? 0) + 1;
      }
      // ADD-ONLY. The LLM fills in where the rules found nothing; where the
      // rules did find something, they keep it and the disagreement is recorded
      // instead. A second path must not be able to erase the baseline.
      if (rule.tags.length === 0 && a.tags.length > 0) {
        stats.llmAddedTags += 1;
        out[i] = {
          ...out[i],
          classification: { tags: a.tags, method: "llm", confidence: a.confidence },
        };
      }
    }
  }
  return { records: out, stats };
}
