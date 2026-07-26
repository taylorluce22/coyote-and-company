/**
 * Claude connector — the advanced scriptwriter. Gemini stays the eyes
 * (native video understanding); when ANTHROPIC_API_KEY is set, Claude
 * becomes the pen: every style-match remake is rewritten with
 * production-grade craft before it lands in the vault. No new UI — the
 * connector upgrades the existing flows invisibly.
 */

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

const asStr = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

/** Claude's JSON goes straight into the vault and the renderer — a
    non-string field must never crash a saved reel card. Coerce hard. */
function sanitizeRemake(raw: Record<string, unknown>): Record<string, unknown> | null {
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
    hookLine: asStr(raw.hookLine, 300) || undefined,
    beats,
    cta: asStr(raw.cta, 300) || undefined,
    productionNotes: (Array.isArray(raw.productionNotes) ? raw.productionNotes : [])
      .filter((n): n is string => typeof n === "string")
      .map((n) => n.slice(0, 400))
      .slice(0, 10),
  };
}

/** Rewrite a Gemini-produced remake with Claude's craft. The analysis
    (styleDna, summary, structure) is the ground truth about the reference;
    Claude's job is a superior SCRIPT, not a different analysis. */
export async function polishRemake(
  analysis: Record<string, unknown>,
  topic: { title: string; angle: string; facts: string[] },
  timeoutMs = 75000
): Promise<Record<string, unknown> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const dna = JSON.stringify(analysis.styleDna || {});
  const summary = String(analysis.summary || "");
  const prompt = `You are an elite short-form video director. A reference reel was analyzed; your job is the definitive shot-for-shot REMAKE SCRIPT of that reel's style applied to a new topic. Return ONLY valid JSON: { "hookLine": "...", "beats": ${BEAT_SHAPE}, "cta": "...", "productionNotes": ["..."] }

REFERENCE (ground truth — reproduce this style faithfully):
Summary: ${summary}
Style DNA: ${dna}

QUALITY BARS (each is checked): beat durations sum to the reference's runtime; every "say" fits its duration at ~2.5 words/second — count the words; the hook lands in the first 2 seconds, visual AND verbal; ONE recurring protagonist described IDENTICALLY in every genPrompt (generators have no memory between prompts); translate the reference's visual metaphors into this topic's equivalents (its prop-with-a-price-tag becomes a prop embodying THIS topic's numbers) — never copy them literally; on-screen text max 7 words, never inside genPrompt.

THE TOPIC: ${topic.title}
Angle: ${topic.angle}
VERIFIED FACTS (the only numbers/claims allowed — keep them exact):
${topic.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Editorial rules: the voice is an Arizona residential solar consultant; APS territory only (never SRP); end connected to the solar/ownership decision; CTA stays Valley-general ("Valley homeowners", never one city); no emojis in on-screen text; every number from the verified facts verbatim.`;
  const out = await claudeJson(key, prompt, timeoutMs);
  return out ? sanitizeRemake(out) : null;
}
