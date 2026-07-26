import { NextRequest, NextResponse } from "next/server";
import { buildAdaptationPrompt, claudeJson, claudeVerify, sanitizeRemake } from "@/lib/claudeScript";
import { qualityCheck, sanitizeGenome } from "@/lib/styleGenome";

/**
 * Reel Script Studio — the standalone Stage-2 ADAPTATION lane.
 *
 * Two modes, one route:
 *  - GENOME MODE (the re-adapt lane): pass `genome` — the structured
 *    reference-video analysis saved in the reel vault — plus a topic and
 *    optional adaptation inputs (audience/offer/cta/tone/aesthetic), and the
 *    adaptation stage re-runs WITHOUT re-analyzing the video: new topic, same
 *    style DNA. This is what the Reel Coach "Re-adapt" button calls.
 *  - FREESTYLE MODE (original behavior): no genome — topic + style name (+
 *    optional legacy styleDna string) in, a full production-grade script out.
 *
 * Output is the same v2 beat format either way (camera language, complete
 * visual detail, exact captions with animation notes, word-count-fitted VO,
 * and a paste-ready AI-generation prompt per shot), plus `quality` — the
 * originality/specificity flags from lib/styleGenome's validator.
 */

// covers the sequential worst case: Claude attempt (100s) then the full
// Gemini fallback (100s) with margin
export const maxDuration = 300;

const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const GEMINI_BASE = "https://generativelanguage.googleapis.com";

const freestylePrompt = (
  topic: { title: string; angle: string; facts: string[] },
  styleName: string,
  styleDna: string,
  seconds: number
) => `You are an elite short-form video director and scriptwriter for Instagram Reels. Write a complete, production-ready ${seconds}-second reel script about the topic below. Return ONLY valid JSON (no markdown fences) in exactly this shape:

{
  "summary": "one sentence: what this reel is and why it stops a scroll",
  "styleSpec": "the visual style system in 2-3 sentences: rendering style, palette, text treatment, energy",
  "remake": {
    "hookLine": "the opening spoken or on-screen line — a pattern-interrupt or bold claim, never a greeting",
    "beats": [{
      "shot": "one-line summary of this beat",
      "camera": "exact camera language: framing, angle, movement",
      "visualDetail": "EVERY visible element, specifically: subject and what it's doing, props with colors/materials, background, lighting direction and mood, what MOVES — written so an artist who never spoke to you could reproduce the frame",
      "onScreenText": "the exact on-screen text, max 7 words, or 'none'",
      "textStyle": "font vibe, size, color, placement, and HOW it animates on/off",
      "say": "the spoken line, word for word, sized to fit the duration at ~2.5 words per second",
      "duration": "~Ns",
      "genPrompt": "a complete, self-contained text-to-video generation prompt for THIS beat: 9:16 vertical, the full visualDetail + camera + lighting + palette + motion in one paragraph of concrete visual language — no vague words like 'engaging', and DO NOT include the on-screen text (captions are added in the edit)"
    }],
    "cta": "the closing call-to-action",
    "productionNotes": ["edit/assembly note: caption timing, transitions, sound design, pacing", "..."]
  }
}

QUALITY BARS (each is checked):
- Beat durations must sum to ~${seconds}s; "say" lines must fit their durations at ~2.5 words/second — count the words.
- The hook lands inside the first 2 seconds and is visual AND verbal.
- Keep ONE recurring subject/protagonist across beats and describe it IDENTICALLY in every genPrompt (generators have no memory between prompts).
- Find a concrete visual metaphor that embodies the topic's numbers — a prop, an object, a scene — and build the reel around it. Never settle for "person talking" unless the style demands it.
- On-screen text: exact words, max 7 per beat, never inside genPrompt.

VISUAL STYLE: ${styleName}${styleDna ? `\nSTYLE DNA to reproduce faithfully (from a reference reel the owner admires): ${styleDna}` : ""}

THE TOPIC: ${topic.title}
Angle: ${topic.angle}
VERIFIED FACTS (the only numbers/claims the script may use — keep them exact):
${topic.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Editorial rules: the voice is an Arizona residential solar consultant; APS territory only (never SRP); the script must end connected to the solar/ownership decision; call-to-action stays Valley-general ("Valley homeowners", never one city); no emojis in on-screen text; every number must come from the verified facts verbatim.`;

/** Connector probe: configured = the Claude scriptwriter key is present.
    ?verify=1 actually calls Anthropic (models list is free) to catch a
    placeholder key — same pattern as the Gemini probe. */
export async function GET(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.nextUrl.searchParams.get("verify")) {
    if (!key) return NextResponse.json({ claude: "missing" });
    return NextResponse.json({ claude: await claudeVerify(key) });
  }
  return NextResponse.json({ configured: !!key });
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key && !process.env.ANTHROPIC_API_KEY) return NextResponse.json({ configured: false });
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const rawTopic = (b.topic || {}) as { title?: unknown; angle?: unknown; facts?: unknown };
  const topic = {
    title: clamp(rawTopic.title, 160),
    angle: clamp(rawTopic.angle, 300),
    facts: (Array.isArray(rawTopic.facts) ? rawTopic.facts : []).map((f) => clamp(f, 400)).filter(Boolean).slice(0, 5),
  };
  if (!topic.title) return NextResponse.json({ configured: true, error: "pick a topic first" });
  const styleName = clamp(b.styleName, 200) || "Director's choice — whatever best serves this topic";
  const styleDna = clamp(b.styleDna, 2000);
  const seconds = Math.min(60, Math.max(10, Number(b.seconds) || 30));
  // genome mode: the saved structured analysis rides in whole — the vault
  // already holds sanitized data, but this route is public, so coerce again
  const genome = sanitizeGenome(b.genome);
  const inputs = {
    topic,
    audience: clamp(b.audience, 200) || undefined,
    offer: clamp(b.offer, 200) || undefined,
    cta: clamp(b.cta, 200) || undefined,
    tone: clamp(b.tone, 200) || undefined,
    aesthetic: clamp(b.aesthetic, 300) || undefined,
  };

  const prompt = genome
    ? buildAdaptationPrompt({ genome, inputs, seconds: Number(b.seconds) ? seconds : undefined })
    : freestylePrompt(topic, styleName, styleDna, seconds);

  /** Genome-mode raw output is the flat adaptation contract — normalize both
      modes to { summary?, styleSpec?, remake } so every consumer sees one
      shape, then attach the quality flags. */
  const finish = (raw: Record<string, unknown>, writer: string) => {
    let script: Record<string, unknown> | null;
    if (genome) {
      const remake = sanitizeRemake(raw);
      script = remake ? { summary: remake.concept, remake } : null;
    } else {
      script = raw && typeof raw.remake === "object" ? raw : null;
    }
    if (!script) return null;
    const remake = script.remake as Parameters<typeof qualityCheck>[0];
    const referenceText = (genome?.beatMap || []).map((bt) => bt.dialogueOrText || "").join(" ");
    const quality = qualityCheck(remake, { referenceText, facts: topic.facts });
    return NextResponse.json({ configured: true, script, writer, ...(quality.length ? { quality } : {}) });
  };

  // Claude connector first — the advanced scriptwriter; Gemini is the fallback
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const raw = await claudeJson(anthropicKey, prompt, 100000);
    const res = raw && finish(raw, "claude");
    if (res) return res;
    // fall through to Gemini on any Claude failure
  }
  if (!key) return NextResponse.json({ configured: true, error: "script generation failed — check the Claude key in Connectors" });

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  try {
    const res = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(100000),
    });
    if (!res.ok) return NextResponse.json({ configured: true, error: `script generation failed: ${res.status}` });
    const data = await res.json();
    let text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      const out = finish(JSON.parse(text) as Record<string, unknown>, "gemini");
      if (out) return out;
      return NextResponse.json({ configured: true, error: "the script came back malformed — try again" });
    } catch {
      return NextResponse.json({ configured: true, error: "the script came back malformed — try again" });
    }
  } catch {
    return NextResponse.json({ configured: true, error: "script generation timed out — try again" });
  }
}
