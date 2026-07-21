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
 * ~4.5MB body limit on this route). This route fetches those bytes,
 * resumable-uploads them to Gemini's Files API, waits for processing, asks
 * Gemini to analyze, and deletes the Blob copy — nothing survives here
 * except the analysis JSON, which the client persists to reelVault.
 *
 * GET  → { configured }
 * POST { url, contentType, label, source } → { configured, analysis, error? }
 */

export const maxDuration = 300;

const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

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

export async function GET() {
  return NextResponse.json({ configured: !!process.env.GEMINI_API_KEY });
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ configured: false });

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const blobUrl = clamp(b.url, 600);
  const label = clamp(b.label, 120);
  const source = b.source === "reference" ? "reference" : "own";
  const contentType = clamp(b.contentType, 60) || "video/mp4";
  if (!blobUrl) return NextResponse.json({ configured: true, error: "no video url" });

  let bytes: ArrayBuffer;
  try {
    const videoRes = await fetch(blobUrl, { signal: AbortSignal.timeout(60000) });
    if (!videoRes.ok) return NextResponse.json({ configured: true, error: `couldn't read the uploaded clip: ${videoRes.status}` });
    bytes = await videoRes.arrayBuffer();
  } catch {
    return NextResponse.json({ configured: true, error: "couldn't read the uploaded clip" });
  }

  try {
    const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`, {
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
    if (!startRes.ok || !uploadUrl) {
      return NextResponse.json({ configured: true, error: `Gemini upload start failed: ${startRes.status}` });
    }

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
    if (!uploadRes.ok) {
      return NextResponse.json({ configured: true, error: `Gemini upload failed: ${uploadRes.status}` });
    }
    const uploaded = await uploadRes.json();
    let fileInfo: { uri?: string; name?: string; mimeType?: string; state?: string } = uploaded?.file || {};
    if (!fileInfo.uri || !fileInfo.name) return NextResponse.json({ configured: true, error: "Gemini upload returned no file" });

    const started = Date.now();
    while (fileInfo.state === "PROCESSING" && Date.now() - started < 90000) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileInfo.name}?key=${key}`, { signal: AbortSignal.timeout(15000) });
      if (pollRes.ok) fileInfo = await pollRes.json();
    }
    if (fileInfo.state !== "ACTIVE") {
      return NextResponse.json({ configured: true, error: "Gemini is still processing this clip — try analyzing again in a minute" });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const genRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ fileData: { fileUri: fileInfo.uri, mimeType: fileInfo.mimeType || contentType } }, { text: SCHEMA_PROMPT }],
          },
        ],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!genRes.ok) {
      return NextResponse.json({ configured: true, error: `analysis failed: ${genRes.status}: ${(await genRes.text().catch(() => "")).slice(0, 200)}` });
    }
    const genData = await genRes.json();
    let text = String(genData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text);
    } catch {
      return NextResponse.json({ configured: true, error: "analysis returned malformed JSON — try again" });
    }

    return NextResponse.json({ configured: true, analysis, source, label: label || undefined });
  } catch (e) {
    return NextResponse.json({ configured: true, error: e instanceof Error ? e.message.slice(0, 200) : "video analysis failed" });
  } finally {
    del(blobUrl).catch(() => {});
  }
}
