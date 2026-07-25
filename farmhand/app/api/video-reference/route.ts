import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";

/**
 * Reel coach — watches an actual video (visuals + audio together, via
 * Gemini's native video understanding) and returns a structured coaching
 * breakdown for Farmhand's content agents: hook strength, pacing, visual
 * style, what's said, and the reusable content pattern.
 *
 * Flow: the browser has already uploaded the clip straight to Vercel Blob
 * (see /api/video-reference/blob-upload — large iPhone reels blow past the
 * ~4.5MB body limit on this route).
 *
 * CLIENT-DRIVEN PHASES (the crash-proof shape, same idea as the Higgsfield
 * pollBatch flow in Composer): the old design did blob-fetch + Gemini upload
 * + processing poll + generateContent in ONE serverless invocation — on a
 * real-size reel that regularly outlived the platform's function budget and
 * died mid-flight, so the owner saw "won't analyze" every single time. Now
 * the browser drives three short invocations via a `phase` field:
 *
 *   POST { phase: "start", url, contentType, label }
 *        → fetch blob → resumable-upload to Gemini Files API → delete blob
 *        → { fileName, fileUri, mimeType, state }   (the long pole)
 *   POST { phase: "status", fileName }
 *        → single Files API GET → { state }         (client polls every ~3s)
 *   POST { phase: "analyze", fileUri, mimeType, source, label, topic? }
 *        → generateContent only → { analysis }
 *
 * No `phase` field = the original monolithic flow (kept for back-compat),
 * built from the exact same helpers so there is one implementation of each
 * step. The Blob copy is always deleted in "start" (or in the monolithic
 * finally) — nothing survives here except the analysis JSON, which the
 * client persists to reelVault.
 *
 * GET  → { configured }
 * POST → { configured, ... } per phase above
 */

// maxDuration applies to the whole route (Next.js can't set it per-phase).
// 300s covers the monolithic fallback; the phased calls each finish far
// inside it. If the deployment's plan caps function time lower, "start" on a
// very large clip can still be killed by the platform — the client surfaces
// that as "trim the clip" guidance (Gemini only needs the style, not the
// full runtime).
export const maxDuration = 300;

const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

const GEMINI_BASE = "https://generativelanguage.googleapis.com";

const SCHEMA_PROMPT = `You are coaching a solar consultant's Instagram content strategy. Watch this clip closely — the visuals AND the audio together — and return ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:

{
  "summary": "one or two plain sentences describing what happens in the clip",
  "hook": {
    "firstTwoSeconds": "what's on screen / happening in the first 1-2 seconds",
    "technique": "the hook technique used, e.g. question, bold claim, visual pattern-interrupt, direct address, none",
    "strength": "strong | medium | weak",
    "why": "why it does or doesn't stop a scroll"
  },
  "structure": {
    "estimatedCuts": <integer>,
    "pacing": "description of edit rhythm / pacing",
    "onScreenText": "describe any on-screen text or captions, or 'none'",
    "ctaPresent": <boolean>,
    "ctaNotes": "what the call-to-action is, or 'none'"
  },
  "visualStyle": {
    "setting": "...",
    "lighting": "...",
    "framing": "camera framing and movement",
    "wardrobe": "...",
    "brandingVisible": "describe any visible logos or branding, or 'none'"
  },
  "audio": {
    "spokenContent": "as close to a transcript as you can manage of what is said, or 'no speech'",
    "tone": "delivery tone",
    "music": "describe any background music or sound design, or 'none'"
  },
  "contentPattern": "the reusable structural pattern/format this reel follows, described so someone could replicate the FORMAT with different content",
  "coachingNotes": ["specific actionable takeaway", "another one", "..."]
}

Be specific and concrete — this feeds a content-strategy knowledge base, not a general video description. If something can't be determined, say so plainly rather than guessing.`;

/** Style-match mode: decode the reference's style DNA beat by beat AND write
    the shot-for-shot remake script using the owner's topic — same Gemini
    pass, since the model is already watching the video. */
const styleMatchPrompt = (topic: { title: string; angle: string; facts: string[] }) =>
  SCHEMA_PROMPT.replace(
    `  "coachingNotes": ["specific actionable takeaway", "another one", "..."]
}`,
    `  "coachingNotes": ["specific actionable takeaway", "another one", "..."],
  "styleDna": {
    "beats": [{ "t": "0-2s", "visual": "what's on screen", "onScreenText": "text shown or 'none'", "textStyle": "how the text looks/appears/animates", "transition": "cut/zoom/swipe/etc" }],
    "textTreatment": "the overall on-screen text system: font vibe, size, color, placement, animation style",
    "colorAndGrade": "color palette and grade of the footage",
    "energy": "the pacing/energy signature in one sentence"
  },
  "remake": {
    "hookLine": "the opening line (spoken or on-screen) that applies THIS reel's hook technique to the topic below",
    "beats": [{ "shot": "exactly what to film or show", "say": "the spoken line, word for word", "onScreenText": "the on-screen text for this beat", "duration": "~Ns" }],
    "cta": "the closing call-to-action in this reel's style",
    "productionNotes": ["location/gear/edit note needed to nail this style", "..."]
  }
}`
  ) +
  `

STYLE-MATCH BRIEF: after analyzing the clip, use "styleDna" to decode its style beat by beat (5-10 beats covering the full runtime), then write "remake" — a complete shot-for-shot script that reproduces THIS clip's format, pacing, text treatment and energy, but about the topic below. The remake must be filmable by one person with a phone in a day.

THE TOPIC: ${topic.title}
Angle: ${topic.angle}
VERIFIED FACTS (the only numbers/claims the remake may use — keep them exact):
${topic.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Remake rules: an Arizona residential solar consultant is the on-camera voice; APS territory only (never SRP); the script must end connected to the solar/ownership decision; call-to-action stays Valley-general ("Valley homeowners", never one city); no emojis in on-screen text; every number must come from the verified facts verbatim.`;

/* ------------------------------------------------------------------ */
/* shared step helpers — used by BOTH the phased flow and the          */
/* monolithic fallback, so each step exists exactly once               */
/* ------------------------------------------------------------------ */

type GeminiFile = { uri?: string; name?: string; mimeType?: string; state?: string };
type Fail = { error: string };
const fail = (error: string): Fail => ({ error });
const isFail = (x: unknown): x is Fail => !!x && typeof x === "object" && "error" in (x as Record<string, unknown>);

/** Step 1a: pull the clip bytes back out of Vercel Blob. */
async function fetchBlobBytes(blobUrl: string): Promise<ArrayBuffer | Fail> {
  try {
    const videoRes = await fetch(blobUrl, { signal: AbortSignal.timeout(60000) });
    if (!videoRes.ok) return fail(`couldn't read the uploaded clip: ${videoRes.status}`);
    return await videoRes.arrayBuffer();
  } catch {
    return fail("couldn't read the uploaded clip");
  }
}

/** Step 1b: resumable-upload the bytes to Gemini's Files API. */
async function geminiUpload(key: string, bytes: ArrayBuffer, contentType: string, label: string): Promise<GeminiFile | Fail> {
  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": contentType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: label || "reel" } }),
    signal: AbortSignal.timeout(20000),
  });
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!startRes.ok || !uploadUrl) return fail(`Gemini upload start failed: ${startRes.status}`);

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
    signal: AbortSignal.timeout(180000),
  });
  if (!uploadRes.ok) return fail(`Gemini upload failed: ${uploadRes.status}`);
  const uploaded = await uploadRes.json();
  const fileInfo: GeminiFile = uploaded?.file || {};
  if (!fileInfo.uri || !fileInfo.name) return fail("Gemini upload returned no file");
  return fileInfo;
}

/** Step 2: one Files API GET — the client polls this in the phased flow.
    NOT_FOUND state means the upload expired on Gemini's side (~48h TTL). */
async function geminiFileStatus(key: string, fileName: string): Promise<GeminiFile | Fail> {
  try {
    const res = await fetch(`${GEMINI_BASE}/v1beta/${fileName}?key=${key}`, { signal: AbortSignal.timeout(15000) });
    if (res.status === 403 || res.status === 404) return { name: fileName, state: "NOT_FOUND" };
    if (!res.ok) return fail(`Gemini status check failed: ${res.status}`);
    return (await res.json()) as GeminiFile;
  } catch {
    return fail("Gemini status check failed");
  }
}

/** Step 3: generateContent against the (ACTIVE) file — analysis JSON out. */
async function geminiAnalyze(
  key: string,
  fileUri: string,
  mimeType: string,
  topic: { title: string; angle: string; facts: string[] } | null
): Promise<{ analysis: Record<string, unknown> } | Fail> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const genRes = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ fileData: { fileUri, mimeType } }, { text: topic ? styleMatchPrompt(topic) : SCHEMA_PROMPT }],
        },
      ],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!genRes.ok) {
    return fail(`analysis failed: ${genRes.status}: ${(await genRes.text().catch(() => "")).slice(0, 200)}`);
  }
  const genData = await genRes.json();
  let text = String(genData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return { analysis: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return fail("analysis returned malformed JSON — try again");
  }
}

/** Sanitize the optional style-match topic (reference clips only). */
function parseTopic(b: Record<string, unknown>, source: "own" | "reference") {
  const rawTopic = (b.topic || null) as { title?: unknown; angle?: unknown; facts?: unknown } | null;
  return source === "reference" && rawTopic && rawTopic.title
    ? {
        title: clamp(rawTopic.title, 160),
        angle: clamp(rawTopic.angle, 300),
        facts: (Array.isArray(rawTopic.facts) ? rawTopic.facts : []).map((f) => clamp(f, 400)).filter(Boolean).slice(0, 5),
      }
    : null;
}

export async function GET(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;

  // verify: actually call Gemini (models.list is free) to catch a placeholder key
  if (req.nextUrl.searchParams.get("verify")) {
    if (!key) return NextResponse.json({ gemini: "missing" });
    try {
      const res = await fetch(
        `${GEMINI_BASE}/v1beta/models?key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(15000), next: { revalidate: 0 } }
      );
      if (res.ok) return NextResponse.json({ gemini: "valid" });
      if (res.status === 400 || res.status === 401 || res.status === 403) return NextResponse.json({ gemini: "invalid" });
      return NextResponse.json({ gemini: "error" });
    } catch {
      return NextResponse.json({ gemini: "error" });
    }
  }

  return NextResponse.json({ configured: !!key });
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ configured: false });

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const phase = typeof b.phase === "string" ? b.phase : "";
  const label = clamp(b.label, 120);
  const source = b.source === "reference" ? "reference" : "own";
  const contentType = clamp(b.contentType, 60) || "video/mp4";

  /* ---- phase "start": blob → Gemini Files API, blob deleted, out fast ---- */
  if (phase === "start") {
    const blobUrl = clamp(b.url, 600);
    if (!blobUrl) return NextResponse.json({ configured: true, error: "no video url" });
    try {
      const bytes = await fetchBlobBytes(blobUrl);
      if (isFail(bytes)) return NextResponse.json({ configured: true, error: bytes.error });
      const fileInfo = await geminiUpload(key, bytes, contentType, label);
      if (isFail(fileInfo)) return NextResponse.json({ configured: true, error: fileInfo.error });
      return NextResponse.json({
        configured: true,
        fileName: fileInfo.name,
        fileUri: fileInfo.uri,
        mimeType: fileInfo.mimeType || contentType,
        state: fileInfo.state || "PROCESSING",
      });
    } catch (e) {
      return NextResponse.json({ configured: true, error: e instanceof Error ? e.message.slice(0, 200) : "video upload failed" });
    } finally {
      // the clip has either landed at Gemini or the attempt failed — either
      // way the Blob copy is done; never leak blobs (they cost storage)
      del(blobUrl).catch(() => {});
    }
  }

  /* ---- phase "status": single Files API GET, client owns the poll loop ---- */
  if (phase === "status") {
    const fileName = clamp(b.fileName, 200);
    if (!/^files\/[A-Za-z0-9._-]+$/.test(fileName)) return NextResponse.json({ configured: true, error: "bad file name" });
    const info = await geminiFileStatus(key, fileName);
    if (isFail(info)) return NextResponse.json({ configured: true, error: info.error });
    return NextResponse.json({ configured: true, state: info.state || "PROCESSING" });
  }

  /* ---- phase "analyze": generateContent only ---- */
  if (phase === "analyze") {
    const fileUri = clamp(b.fileUri, 600);
    if (!fileUri.startsWith(`${GEMINI_BASE}/`)) return NextResponse.json({ configured: true, error: "bad file uri" });
    const mimeType = clamp(b.mimeType, 60) || contentType;
    const topic = parseTopic(b, source);
    try {
      const out = await geminiAnalyze(key, fileUri, mimeType, topic);
      if (isFail(out)) return NextResponse.json({ configured: true, error: out.error });
      return NextResponse.json({ configured: true, analysis: out.analysis, source, label: label || undefined });
    } catch (e) {
      return NextResponse.json({ configured: true, error: e instanceof Error ? e.message.slice(0, 200) : "video analysis failed" });
    }
  }

  /* ---- no phase: original monolithic flow (back-compat), same helpers ---- */
  const blobUrl = clamp(b.url, 600);
  if (!blobUrl) return NextResponse.json({ configured: true, error: "no video url" });
  const topic = parseTopic(b, source);

  try {
    const bytes = await fetchBlobBytes(blobUrl);
    if (isFail(bytes)) return NextResponse.json({ configured: true, error: bytes.error });

    let fileInfo = await geminiUpload(key, bytes, contentType, label);
    if (isFail(fileInfo)) return NextResponse.json({ configured: true, error: fileInfo.error });

    const started = Date.now();
    while (fileInfo.state === "PROCESSING" && Date.now() - started < 90000) {
      await new Promise((r) => setTimeout(r, 3000));
      const polled = await geminiFileStatus(key, fileInfo.name as string);
      if (!isFail(polled)) fileInfo = polled;
    }
    if (fileInfo.state !== "ACTIVE") {
      return NextResponse.json({ configured: true, error: "Gemini is still processing this clip — try analyzing again in a minute" });
    }

    const out = await geminiAnalyze(key, fileInfo.uri as string, fileInfo.mimeType || contentType, topic);
    if (isFail(out)) return NextResponse.json({ configured: true, error: out.error });

    return NextResponse.json({ configured: true, analysis: out.analysis, source, label: label || undefined });
  } catch (e) {
    return NextResponse.json({ configured: true, error: e instanceof Error ? e.message.slice(0, 200) : "video analysis failed" });
  } finally {
    del(blobUrl).catch(() => {});
  }
}
