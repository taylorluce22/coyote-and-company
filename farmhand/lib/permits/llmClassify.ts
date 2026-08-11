/**
 * LLM classification stage — the one real capability gap versus the commercial
 * vendors.
 *
 * Shovels.ai (the market leader) sources exactly the way we do: jurisdiction
 * open-data portals, building-department APIs, public-records requests, then
 * assessor and contractor-licensing data for enrichment. No private feed, no
 * bulk licensing deal with Accela or Tyler. Their scale (millions of permits a
 * month) is scale, not access.
 *
 * What they do differently is classify with trained models rather than keyword
 * rules, and they say why: every city has its own permitting terminology. That
 * is precisely the failure this project has hit three times —
 *   SOLAR returning exactly zero rows in Buckeye (the word is Photovoltaic),
 *   "C of C Issued" versus "Finaled" in Mesa,
 *   ESS matching ADDRESS in a SQL LIKE.
 * Each looked like a correct query and quietly answered a different question.
 *
 * So this is a SECOND path, not a replacement:
 *
 *   RULES are the fast path and the regression baseline. Deterministic, free,
 *   instant, and covered by a fixture corpus — they stay authoritative for
 *   everything they can decide confidently.
 *
 *   THE LLM handles what the rules mark ambiguous, and every row of a newly
 *   onboarded jurisdiction until its vocabulary has been learned and folded
 *   back into the rules.
 *
 * Every permit carries its tags, the method that produced them, and a
 * confidence, so the two paths stay auditable and their disagreement is
 * measurable — that disagreement rate is how a new city's vocabulary gets
 * discovered instead of guessed.
 *
 * Transport note: this calls the Anthropic REST API with fetch, matching
 * lib/claudeScript.ts, rather than adding the SDK as a second way to call the
 * same API from one codebase.
 */

import { PERMIT_TAGS, type Classification, type PermitTag } from "./taxonomy";

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-opus-5";

export function llmClassifyEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Stable prefix, cached. Everything volatile (the permit batch) goes in the
 * user turn AFTER this, so the cache survives across batches.
 */
const SYSTEM_PROMPT = `You classify US residential and commercial building permits by the work they authorize, from the permit's free-text scope of work.

Assign every applicable tag from this fixed taxonomy:
${PERMIT_TAGS.join(", ")}

Rules that matter for this dataset:

BATTERY is independent of SOLAR. A permit can be SOLAR only, BATTERY only, or both. Tag BATTERY whenever the scope includes energy storage, by any name — a battery, an ESS or BESS, a Powerwall, an Enphase Encharge or IQ Battery, a Generac PWRcell, a FranklinWH, a sonnen, an EG4, a SimpliPhi, an LG RESU, a backup gateway, or a capacity stated in kWh. Note that kW DC or kW AC describes array size, not storage.

Tag SOLAR only when the permit INSTALLS photovoltaics. Electrical work done in service of a PV system — a service panel upgrade, a meter main combo, a subpanel, a bi-directional meter — is ELECTRICAL or ELECTRIC_METER, not SOLAR, even when the text names PV or solar as the reason for the work. A permit that installs an array AND upgrades the panel gets both tags. Solar thermal (pool heating, water heating) is WATER_HEATER or POOL_AND_HOT_TUB, not SOLAR.

Jurisdictions use different words for the same work. Photovoltaic, PV, and solar all mean SOLAR here. Judge by what the work IS, not by whether a particular keyword appears.

For each permit return its tags, a confidence between 0 and 1, and a short reason. Use low confidence honestly when the scope text is genuinely ambiguous or too sparse to judge — a low-confidence answer is more useful than a confident guess, because low-confidence rows get human review.`;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "tags", "confidence", "reason"],
        properties: {
          index: { type: "integer", description: "0-based index of the permit in the input list" },
          tags: { type: "array", items: { enum: [...PERMIT_TAGS] } },
          confidence: { type: "number", description: "0 to 1" },
          reason: { type: "string", description: "one short clause" },
        },
      },
    },
  },
} as const;

export interface LlmClassifyOptions {
  fetchImpl?: typeof fetch;
  /** Per-call timeout. Classification batches are small; this is not a long generation. */
  timeoutMs?: number;
}

export interface LlmClassifyResult extends Classification {
  index: number;
  reason: string;
}

interface AnthropicResponse {
  stop_reason?: string;
  stop_details?: { category?: string | null; explanation?: string } | null;
  content?: Array<{ type?: string; text?: string }>;
}

const TAG_SET = new Set<string>(PERMIT_TAGS);

/**
 * Classify a batch of permit descriptions.
 *
 * Returns [] when the API key is absent, the request fails, or the model
 * declines — the caller keeps its rule-path answer. This stage may only ever
 * ADD information; it must never be able to blank out a rule classification.
 */
export async function classifyWithLlm(
  descriptions: string[],
  opts: LlmClassifyOptions = {}
): Promise<LlmClassifyResult[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || descriptions.length === 0) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;

  const batch = descriptions
    .map((d, i) => `${i}. ${d.replace(/\s+/g, " ").trim().slice(0, 600)}`)
    .join("\n");

  try {
    const res = await fetchImpl(API, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL(),
        // Shared cap across thinking and text on Opus 5, which thinks by
        // default. Sized for a batch of short structured rows.
        max_tokens: 8192,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            // The taxonomy and rules are identical on every batch; caching
            // them means only the permit list is billed at full rate.
            cache_control: { type: "ephemeral" },
          },
        ],
        output_config: {
          // Classification is mechanical judgment, not deep reasoning, and
          // low effort is strong on this model — the cost lever that keeps a
          // per-row LLM pass affordable across a new jurisdiction.
          effort: "low",
          format: { type: "json_schema", schema: RESULT_SCHEMA },
        },
        messages: [{ role: "user", content: `Classify these permits:\n\n${batch}` }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as AnthropicResponse;

    // Opus 5 can decline; a refusal is HTTP 200 with empty or partial content,
    // so stop_reason has to be checked before reading content at all.
    if (data.stop_reason === "refusal") return [];

    // Thinking blocks come first and carry empty text by default — take the
    // text blocks only.
    const text = (data.content ?? [])
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("")
      .trim();
    if (!text) return [];

    const parsed = JSON.parse(text) as { results?: unknown };
    if (!Array.isArray(parsed.results)) return [];

    return parsed.results.flatMap((raw): LlmClassifyResult[] => {
      const r = raw as Record<string, unknown>;
      const index = Number(r.index);
      if (!Number.isInteger(index) || index < 0 || index >= descriptions.length) return [];
      const tags = Array.isArray(r.tags)
        ? (r.tags.map(String).filter((t) => TAG_SET.has(t)) as PermitTag[])
        : [];
      const confidence = Number(r.confidence);
      return [
        {
          index,
          tags,
          method: "llm",
          confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
          reason: String(r.reason ?? "").slice(0, 200),
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * When is the rule path not enough?
 *
 * Two cases, and the second is the important one: a jurisdiction whose
 * vocabulary has not been learned yet. Buckeye's workclass said Photovoltaic
 * and a SOLAR-keyword rule returned zero — that is what an unlearned
 * vocabulary looks like, and it reads as a coverage gap rather than a bug.
 * Running the LLM over every row of a new city until its terminology is folded
 * into the rules is how that gets caught on day one instead of never.
 */
export function needsLlmReview(
  description: string,
  ruleTags: PermitTag[],
  jurisdictionLearned: boolean
): boolean {
  if (!jurisdictionLearned) return true;
  // Rules found nothing, but the text is substantive enough that "nothing"
  // is more likely a vocabulary miss than an genuinely unrelated permit.
  return ruleTags.length === 0 && description.trim().length >= 25;
}

/** Rule and LLM disagreed on the tags that matter. Tracked to find vocabulary gaps. */
export function tagsDisagree(ruleTags: PermitTag[], llmTags: PermitTag[]): boolean {
  const significant = (t: PermitTag[]) =>
    new Set(t.filter((x) => x === "SOLAR" || x === "BATTERY"));
  const a = significant(ruleTags);
  const b = significant(llmTags);
  if (a.size !== b.size) return true;
  for (const t of a) if (!b.has(t)) return true;
  return false;
}
