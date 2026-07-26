import { NextRequest, NextResponse } from "next/server";

/**
 * ElevenLabs voiceover lane — turns a remake script's per-beat "say" lines
 * into narration segments, and clones the owner's voice for the personal
 * content lane (the 70/30 educational-to-personal mix).
 *
 * GET  /api/tts             → { configured }
 * GET  /api/tts?verify=1    → { elevenlabs: "valid" | "invalid" | "error" | "missing" }
 * POST { text, voiceId? }   → audio/mpeg bytes (one narration segment).
 *      voiceId resolution: request voiceId (workspace narrator override or
 *      the user's cloned voice) → ELEVENLABS_VOICE_ID env (the brand
 *      narrator default) → error asking for one. TTS is synchronous — no
 *      job polling; the CLIENT owns per-beat sequencing and banks each
 *      segment into the clip vault as it returns.
 * POST { phase: "voices" }  → { voices: [{ id, name, category }] } — the
 *      account's voice roster, for auditioning/picking the narrator.
 * POST { phase: "clone", name, audio: dataURL } → { voiceId } — Instant
 *      Voice Cloning from a recorded sample (~30-60s of speech).
 *
 * Voice policy (2026): ElevenLabs' legacy Default voices (Adam/Rachel/…)
 * retire Dec 31 2026 and are closed to new accounts — the narrator default
 * must be a Voice Library or designed/cloned voice. That's why the default
 * is a CONFIG VALUE (ELEVENLABS_VOICE_ID), never a hardcoded legacy id.
 *
 * Auth: xi-api-key header. Key lives ONLY in Vercel env: ELEVENLABS_API_KEY.
 * Non-secret knobs: ELEVENLABS_VOICE_ID (default narrator),
 * ELEVENLABS_MODEL (default eleven_multilingual_v2).
 */

export const maxDuration = 60;

const EL_BASE = "https://api.elevenlabs.io/v1";
const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function GET(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (req.nextUrl.searchParams.get("verify")) {
    if (!key) return NextResponse.json({ elevenlabs: "missing" });
    try {
      const r = await fetch(`${EL_BASE}/user`, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return NextResponse.json({ elevenlabs: "valid" });
      if (r.status === 401 || r.status === 403) return NextResponse.json({ elevenlabs: "invalid" });
      return NextResponse.json({ elevenlabs: "error" });
    } catch {
      return NextResponse.json({ elevenlabs: "error" });
    }
  }
  return NextResponse.json({ configured: !!key });
}

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ configured: false });

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const phase = clamp(b.phase, 20);

  /* ---- voice roster: audition/pick the narrator ---- */
  if (phase === "voices") {
    try {
      const r = await fetch(`${EL_BASE}/voices`, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) return NextResponse.json({ configured: true, error: `couldn't list voices: ${r.status}` });
      const j = (await r.json()) as { voices?: Array<{ voice_id?: string; name?: string; category?: string }> };
      const voices = (j.voices || [])
        .map((v) => ({ id: clamp(v.voice_id, 64), name: clamp(v.name, 80), category: clamp(v.category, 40) }))
        .filter((v) => v.id)
        .slice(0, 60);
      return NextResponse.json({ configured: true, voices });
    } catch {
      return NextResponse.json({ configured: true, error: "couldn't reach ElevenLabs — try again" });
    }
  }

  /* ---- instant voice clone from a recorded sample ---- */
  if (phase === "clone") {
    const name = clamp(b.name, 60) || "My voice";
    const audio = String(b.audio || "");
    const m = audio.match(/^data:(audio\/[\w.+-]+|video\/webm);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return NextResponse.json({ configured: true, error: "no usable audio sample — record again" });
    let bytes: Buffer;
    try {
      bytes = Buffer.from(m[2], "base64");
    } catch {
      return NextResponse.json({ configured: true, error: "the sample couldn't be decoded — record again" });
    }
    if (bytes.byteLength < 40_000) return NextResponse.json({ configured: true, error: "that sample is too short — read the script for at least ~30 seconds" });
    if (bytes.byteLength > 15_000_000) return NextResponse.json({ configured: true, error: "that sample is too big — keep it under ~90 seconds" });
    try {
      const mime = m[1] === "video/webm" ? "audio/webm" : m[1];
      const form = new FormData();
      form.append("name", name);
      form.append("files", new Blob([new Uint8Array(bytes)], { type: mime }), `sample.${mime.includes("webm") ? "webm" : mime.includes("mp4") ? "m4a" : "mp3"}`);
      form.append("description", "Farmhand personal narration voice");
      const r = await fetch(`${EL_BASE}/voices/add`, {
        method: "POST",
        headers: { "xi-api-key": key },
        body: form,
        signal: AbortSignal.timeout(45000),
      });
      const j = (await r.json().catch(() => ({}))) as { voice_id?: string; detail?: { message?: string } | string };
      if (!r.ok || !j.voice_id) {
        const detail = typeof j.detail === "string" ? j.detail : j.detail?.message || `clone failed: ${r.status}`;
        return NextResponse.json({ configured: true, error: clamp(detail, 200) });
      }
      return NextResponse.json({ configured: true, voiceId: j.voice_id });
    } catch {
      return NextResponse.json({ configured: true, error: "the clone didn't finish — try again" });
    }
  }

  /* ---- one narration segment: text → mp3 bytes ---- */
  const text = clamp(b.text, 1200);
  if (!text) return NextResponse.json({ configured: true, error: "no text" });
  const voiceId = clamp(b.voiceId, 64) || clamp(process.env.ELEVENLABS_VOICE_ID, 64);
  if (!voiceId) {
    return NextResponse.json({
      configured: true,
      error: "No narrator voice configured — pick one in Settings › Spoken voice, or set ELEVENLABS_VOICE_ID in Vercel.",
    });
  }
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  try {
    const r = await fetch(`${EL_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: model,
        // calm, consistent local-expert read — not performative
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      const detail = clamp(await r.text().catch(() => ""), 200);
      return NextResponse.json({ configured: true, error: `narration failed: ${r.status}${detail ? ` — ${detail}` : ""}` });
    }
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 1000) return NextResponse.json({ configured: true, error: "ElevenLabs returned empty audio — try again" });
    return new NextResponse(buf, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ configured: true, error: "narration timed out — try again" });
  }
}
