/**
 * Claude connector — the Stage-2 ADAPTATION layer. Gemini stays the eyes
 * (native video understanding, Stage-1 extraction); when ANTHROPIC_API_KEY
 * is set, Claude is the pen: it takes the structured style genome plus the
 * owner's inputs and writes the original adapted script. One prompt builder
 * (`buildAdaptationPrompt`) serves both lanes — the in-flight video analysis
 * and /api/reel-script's re-adapt-without-re-analysis lane — so the
 * adaptation contract exists exactly once.
 */

import { genomeJson, type ReferenceVideoAnalysis } from "./styleGenome";

const API = "https://api.anthropic.com/v1";
const VERSION = "2023-06-01";
const model = () => process.env.ANTHROPIC_MODEL || "claude-opus-5";

export async function claudeVerify(key: string): Promise<"valid" | "invalid" | "error"> {
  try {
    const r = await fetch(`${API}/models`, {
      headers: { "x-api-key": key, "anthropic-version": VERSION },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) return "valid";
    if (r.status === 401 || r.status === 403) return "invalid";
    return "error";
  } catch {
    return "error";
  }
}

/** One Claude call → JSON text out (no markdown fences), or null on any failure. */
export async function claudeJson(key: string, prompt: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${API}/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model(),
        // shared cap for thinking + text on Opus — 6000 truncated long
        // scripts mid-JSON (verified by adversarial review)
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    const data = await r.json();
    // the model may lead with thinking blocks — take the TEXT blocks only
    // (content[0].text was empty whenever the model thought first)
    const blocks: Array<{ type?: string; text?: string }> = Array.isArray(data?.content) ? data.content : [];
    let text = blocks
      .filter((bl) => bl?.type === "text" && typeof bl.text === "string")
      .map((bl) => bl.text as string)
      .join("")
      .trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const BEAT_SHAPE = `[{
  "shot": "one-line summary",
  "camera": "exact camera language: framing, angle, movement",
  "visualDetail": "EVERY visible element: subject and action, props with colors/materials, background, lighting direction and mood, what MOVES — reproducible by an artist who never saw the reference",
  "onScreenText": "exact text, max 7 words, or 'none'",
  "textStyle": "font vibe, size, color, placement, how it animates on/off",
  "say": "spoken line, word for word, fitted to the duration at ~2.5 words/second",
  "duration": "~Ns",
  "genPrompt": "complete self-contained text-to-video prompt for THIS beat: 9:16 vertical, full visualDetail + camera + lighting + palette + motion as one paragraph of concrete visual language — no vague adjectives, no on-screen text (captions are added in the edit)"
}]`;

/** The owner's Stage-2 inputs beyond the topic itself. All optional — empty
    fields simply don't appear in the prompt. */
export interface AdaptationInputs {
  topic: { title: string; angle: string; facts: string[] };
  audience?: string;
  offer?: string;
  cta?: string;
  tone?: string;
  aesthetic?: string;
}

/** THE adaptation prompt — Stage 2 of the pipeline. Style comes from the
    genome (preserve side); every word, example, claim and topic-visual is
    replaced (replace side). Used by adaptRemake (video flow) and
    /api/reel-script (re-adapt lane). */
export function buildAdaptationPrompt(opts: {
  genome: ReferenceVideoAnalysis | null;
  summary?: string;
  /** legacy styleDna blob or a named style — used only when no genome exists */
  styleFallback?: string;
  inputs: AdaptationInputs;
  /** target runtime in seconds; omitted = match the reference's beat map */
  seconds?: number;
}): string {
  const { genome, summary, styleFallback, inputs, seconds } = opts;
  const t = inputs.topic;
  const preserve = genome?.preserveVsReplace?.preserve || [];
  const replace = genome?.preserveVsReplace?.replace || [];
  const extras = [
    inputs.audience && `AUDIENCE: ${inputs.audience}`,
    inputs.offer && `OFFER: ${inputs.offer}`,
    inputs.cta && `CTA DIRECTION: ${inputs.cta}`,
    inputs.tone && `TONE: ${inputs.tone}`,
    inputs.aesthetic && `AESTHETIC INTENT: ${inputs.aesthetic}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are an elite short-form video director. This is STAGE 2 (ADAPTATION) of a 3-stage pipeline: a reference reel was already decoded into a structured style genome. Your job is a fully ORIGINAL reel that preserves the genome's style logic and replaces its topic entirely.

${
  genome
    ? `<reference_style_genome>
${genomeJson(genome)}
</reference_style_genome>`
    : `<reference_style>
${summary ? `Summary: ${summary}\n` : ""}${styleFallback || "Director's choice — whatever best serves the topic."}
</reference_style>`
}

<preserve>
${preserve.length ? preserve.map((p) => `- ${p}`).join("\n") : "- the genome's structural formula, pacing, hook mechanics, visual language, editing rhythm, and persuasion moves"}
</preserve>

<replace>
${replace.length ? replace.map((r) => `- ${r}`).join("\n") : ""}
- ALL wording, examples, claims, numbers, metaphors, and topic-specific visuals — nothing the reference said or showed may reappear
</replace>

<adaptation_inputs>
TOPIC: ${t.title}
ANGLE: ${t.angle}
VERIFIED FACTS (the only numbers/claims allowed — keep them exact):
${t.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}${extras ? `\n${extras}` : ""}
</adaptation_inputs>

<output_contract>
Return ONLY valid JSON, no markdown fences, exactly:
{ "concept": "one sentence: the original reel concept — what it is and why it stops a scroll", "hookLine": "...", "beats": ${BEAT_SHAPE}, "cta": "...", "productionNotes": ["edit/assembly note: caption timing, transitions, sound design, pacing", "..."] }
</output_contract>

<quality_bars>
- Beat durations sum to ${seconds ? `~${seconds}s` : "the reference beat map's runtime"}; every "say" fits its duration at ~2.5 words/second — count the words.
- The hook lands inside the first 2 seconds, visual AND verbal — never a greeting, never a self-introduction.
- ONE recurring protagonist described IDENTICALLY in every genPrompt (generators have no memory between prompts).
- ORIGINALITY IS CHECKED MECHANICALLY: no phrase of 4+ consecutive words from the reference's dialogue may appear in your script; translate its visual metaphors into this topic's equivalents (its prop-with-a-price-tag becomes a prop embodying THIS topic's numbers) — never copy them literally.
- At least one verified fact's number appears verbatim in a "say" line — that is the proof beat.
- On-screen text: exact words, max 7 per beat, never inside genPrompt. No vague adjectives ("engaging", "dynamic") anywhere in visualDetail or genPrompt — name concrete subjects, materials, colors, light.
</quality_bars>

<editorial_rules>
The voice is an Arizona residential solar consultant; APS territory only (never SRP); end connected to the solar/ownership decision; CTA stays Valley-general ("Valley homeowners", never one city)${inputs.cta ? " while following the CTA direction above" : ""}; no emojis in on-screen text; every number from the verified facts verbatim.
</editorial_rules>`;
}

const asStr = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

/** Claude's JSON goes straight into the vault and the renderer — a
    non-string field must never crash a saved reel card. Coerce hard. */
export function sanitizeRemake(raw: Record<string, unknown>): Record<string, unknown> | null {
  const beats = (Array.isArray(raw.beats) ? raw.beats : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && !Array.isArray(b))
    .map((b) => {
      const out: Record<string, string> = {};
      (["shot", "camera", "visualDetail", "onScreenText", "textStyle", "say", "duration", "genPrompt"] as const).forEach((k) => {
        const v = asStr(b[k], 2000);
        if (v) out[k] = v;
      });
      return out;
    })
    .filter((b) => Object.keys(b).length > 0)
    .slice(0, 14);
  if (!beats.length) return null;
  return {
    concept: asStr(raw.concept, 400) || undefined,
    hookLine: asStr(raw.hookLine, 300) || undefined,
    beats,
    cta: asStr(raw.cta, 300) || undefined,
    productionNotes: (Array.isArray(raw.productionNotes) ? raw.productionNotes : [])
      .filter((n): n is string => typeof n === "string")
      .map((n) => n.slice(0, 400))
      .slice(0, 10),
  };
}

/** Rewrite a Gemini-produced remake with Claude's craft, driven by the
    structured genome when Stage 1 produced one (legacy styleDna otherwise).
    The analysis is the ground truth about the reference; Claude's job is a
    superior ORIGINAL script, not a different analysis. */
export async function adaptRemake(
  analysis: Record<string, unknown>,
  topic: { title: string; angle: string; facts: string[] },
  timeoutMs = 75000
): Promise<Record<string, unknown> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const genome = (analysis.genome as ReferenceVideoAnalysis | undefined) || null;
  const prompt = buildAdaptationPrompt({
    genome,
    summary: String(analysis.summary || ""),
    styleFallback: genome ? undefined : JSON.stringify(analysis.styleDna || {}),
    inputs: { topic },
  });
  const out = await claudeJson(key, prompt, timeoutMs);
  return out ? sanitizeRemake(out) : null;
}
