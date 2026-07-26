import { NextRequest, NextResponse, after } from "next/server";
import { del, list, put } from "@vercel/blob";
import { polishRemake } from "@/lib/claudeScript";

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
 * SERVER-DRIVEN JOBS (the phone-can-leave shape): the phased flow above
 * still needs the BROWSER to hold a request open for every step — on a
 * phone, a locked screen or a backgrounded tab kills whichever request is
 * in flight and the run "never finishes". Jobs flip ownership: the client
 * uploads to Blob, then fires ONE fast call and the SERVER runs the whole
 * pipeline in the background (`after()`), journaling progress as immutable
 * records in Blob at reeljobs/<jobId>/<ms>-<state>.json. The client (or a
 * later visit — records survive the tab) just peeks:
 *
 *   POST { phase: "job-start", jobId, url|remoteUrl, contentType, label, source, topic? }
 *        → responds { accepted } immediately; after(): blob/link → Gemini
 *          → poll ACTIVE → analyze → "done" record (video blob deleted)
 *   POST { phase: "job-status", jobId }
 *        → { jobState: received|processing|analyzing|error|done, ... }
 *   POST { phase: "job-continue", jobId }
 *        → re-enters the pipeline from the journaled Gemini file when the
 *          first invocation ran out of budget (big clip, slow processing)
 *   POST { phase: "job-ack", jobId }
 *        → deletes the job records (client has banked the analysis)
 *
 * Records are IMMUTABLE — each state transition is a NEW pathname, so CDN
 * caching can never serve a stale state. "done" wins over anything later
 * (a raced retry's error can't mask a finished analysis).
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
    pass, since the model is already watching the video.

    v2 script writer: the owner produces the remake with AI video generation,
    and v1's loose beats ("shot: show a graphic") lost all the detail on the
    way into the generator. Every beat now carries full production language —
    camera, every visible element, text animation — plus a paste-ready
    per-beat generation prompt, so the details survive into the output. */
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
    "beats": [{
      "shot": "one-line summary of this beat",
      "camera": "exact camera language: framing, angle, movement (e.g. 'tight low-angle push-in, subject centered, slight handheld drift')",
      "visualDetail": "EVERY visible element, specifically: subject and what it's doing, props with colors/materials, background, lighting direction and mood, any motion — written so an artist who never saw the reference could reproduce the frame",
      "onScreenText": "the exact on-screen text for this beat, or 'none'",
      "textStyle": "font vibe, size, color, placement, and HOW it animates on/off, matching the reference's text system",
      "say": "the spoken line, word for word, sized to fit the duration at ~2.5 words per second",
      "duration": "~Ns",
      "genPrompt": "a complete, self-contained text-to-video generation prompt for THIS beat: 9:16 vertical, the full visualDetail + camera + lighting + color grade + motion in one paragraph of concrete visual language — no vague words like 'engaging' or 'dynamic', no references to 'the reference video', and DO NOT include the on-screen text in the prompt (captions are added in the edit)"
    }],
    "cta": "the closing call-to-action in this reel's style",
    "productionNotes": ["edit/assembly note needed to nail this style: caption timing, transition types, sound design, pacing", "..."]
  }
}`
  ) +
  `

STYLE-MATCH BRIEF: after analyzing the clip, use "styleDna" to decode its style beat by beat (5-10 beats covering the full runtime), then write "remake" — a complete shot-for-shot script that reproduces THIS clip's format, pacing, visual treatment and energy, but about the topic below.

REMAKE QUALITY BARS (each one is checked):
- Beat durations must sum to roughly the reference's runtime, and each "say" line must actually fit its duration at ~2.5 words/second — count the words.
- "visualDetail" and "genPrompt" carry the craft: name the exact subject, style (e.g. "stylized 3D caricature render", "clean flat motion graphics", "phone-shot talking head"), materials, colors from the reference's grade, light direction, and what MOVES during the beat. A generated clip is only as detailed as this text.
- Visual continuity: keep the same protagonist/style across beats — describe the recurring subject identically in every genPrompt (generators have no memory between prompts).
- The metaphors must translate, not copy: find this topic's equivalent of the reference's visual ideas (its prop-with-a-price-tag becomes a prop that embodies THIS topic's numbers).
- On-screen text: exact words, no more than 7 per beat, and never inside genPrompt.

THE TOPIC: ${topic.title}
Angle: ${topic.angle}
VERIFIED FACTS (the only numbers/claims the remake may use — keep them exact):
${topic.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Remake rules: the voice is an Arizona residential solar consultant; APS territory only (never SRP); the script must end connected to the solar/ownership decision; call-to-action stays Valley-general ("Valley homeowners", never one city); no emojis in on-screen text; every number must come from the verified facts verbatim.`;

/* ------------------------------------------------------------------ */
/* shared step helpers — used by BOTH the phased flow and the          */
/* monolithic fallback, so each step exists exactly once               */
/* ------------------------------------------------------------------ */

type GeminiFile = { uri?: string; name?: string; mimeType?: string; state?: string };
type Fail = { error: string };
const fail = (error: string): Fail => ({ error });
const isFail = (x: unknown): x is Fail => !!x && typeof x === "object" && "error" in (x as Record<string, unknown>);

/** The `url` params must actually point at OUR Blob store — this route
    fetches them server-side, so an arbitrary URL here would be an SSRF
    read primitive (fetch internal address → forward bytes to Gemini →
    read them back out of the analysis). */
function isBlobStoreUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Stricter still for urls we also DELETE: they must live under the reel
    upload prefix (enforced at token time in blob-upload/route.ts), so a
    crafted url can never point this route's store-wide token at someone
    else's blob (e.g. a handoff bundle). */
function isReelBlobUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".blob.vercel-storage.com") &&
      u.pathname.replace(/^\/+/, "").startsWith("reels/")
    );
  } catch {
    return false;
  }
}

/** Step 1a: pull the clip bytes back out of Vercel Blob. */
async function fetchBlobBytes(blobUrl: string): Promise<ArrayBuffer | Fail> {
  if (!isReelBlobUrl(blobUrl)) return fail("bad video url");
  try {
    const videoRes = await fetch(blobUrl, { signal: AbortSignal.timeout(60000) });
    if (!videoRes.ok) return fail(`couldn't read the uploaded clip: ${videoRes.status}`);
    return await videoRes.arrayBuffer();
  } catch {
    return fail("couldn't read the uploaded clip");
  }
}

/** Remote-link lane: the browser never touches the file — the server fetches
    a direct video URL (Dropbox/Drive/iCloud direct links) and hands it to
    Gemini. Built for the owner's machines, where local file handling kept
    freezing the tab. */
const MAX_REMOTE_BYTES = 220 * 1024 * 1024;
function remoteUrlBlocked(u: URL): string | null {
  if (u.protocol !== "https:") return "the link must be https";
  const h = u.hostname.toLowerCase();
  if (h.startsWith("[")) return "that link points somewhere private"; // IPv6 literals — the private-range checks below are IPv4-only
  if (
    h === "localhost" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".internal") ||
    h.endsWith(".local")
  )
    return "that link points somewhere private";
  return null;
}
/** Normalize common share links into direct-download form. */
function directify(raw: string): string {
  try {
    const u = new URL(raw);
    // Dropbox share → direct content
    if (/(^|\.)dropbox\.com$/.test(u.hostname)) {
      u.searchParams.set("dl", "1");
      return u.toString();
    }
    // Google Drive share → direct download
    const gd = raw.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (gd) return `https://drive.google.com/uc?export=download&id=${gd[1]}`;
    return raw;
  } catch {
    return raw;
  }
}
async function fetchRemoteBytes(rawUrl: string): Promise<{ bytes: ArrayBuffer; contentType: string } | Fail> {
  let u: URL;
  try {
    u = new URL(directify(rawUrl));
  } catch {
    return fail("that doesn't look like a link");
  }
  try {
    // 90s cap keeps the whole start phase (fetch + Gemini upload) inside
    // the 300s function budget: 90 + 20 + 180 = 290. Redirects are followed
    // MANUALLY so every hop is re-checked against the private-host guard —
    // a public link 302-ing to an internal address must not be fetched.
    const deadline = AbortSignal.timeout(90000);
    let res: Response | null = null;
    for (let hop = 0; hop < 6; hop++) {
      const blocked = remoteUrlBlocked(u);
      if (blocked) return fail(blocked);
      res = await fetch(u.toString(), { signal: deadline, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return fail("the link redirected nowhere — use a direct video link");
        u = new URL(loc, u);
        res = null;
        continue;
      }
      break;
    }
    if (!res) return fail("that link redirects too many times — use a direct video link");
    if (!res.ok) return fail(`the link answered ${res.status} — make sure it's a direct, public video link`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_REMOTE_BYTES) return fail("that video is over the ~200MB cap — trim it shorter first");
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (ct.startsWith("text/") || ct.includes("html"))
      return fail("the link returned a web page, not a video — use a DIRECT download link (Dropbox: change ?dl=0 to ?dl=1)");
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_REMOTE_BYTES) return fail("that video is over the ~200MB cap — trim it shorter first");
    if (bytes.byteLength < 50_000) return fail("the link returned almost no data — make sure it's a direct video link");
    return { bytes, contentType: ct.startsWith("video/") ? ct : "video/mp4" };
  } catch {
    return fail("couldn't fetch that link — check it opens the raw video in an incognito tab");
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

/** Step 1a+1b for BIG clips: stream Blob → Gemini in 32MB resumable-upload
    chunks, so a 1GB clip never sits in serverless memory (the buffered
    geminiUpload above would OOM the function well before that). Chunk
    offsets must be multiples of 256KB per the protocol — 32MB is. */
async function geminiUploadFromBlob(key: string, blobUrl: string, contentType: string, label: string): Promise<GeminiFile | Fail> {
  if (!isReelBlobUrl(blobUrl)) return fail("bad video url");
  let videoRes: Response;
  try {
    // one signal covers headers AND the whole body read below
    videoRes = await fetch(blobUrl, { signal: AbortSignal.timeout(240000) });
  } catch {
    return fail("couldn't read the uploaded clip");
  }
  if (!videoRes.ok || !videoRes.body) return fail(`couldn't read the uploaded clip: ${videoRes.status}`);
  const size = Number(videoRes.headers.get("content-length") || 0);
  if (!size) {
    // no length header — fall back to buffering (only plausible for small clips)
    try {
      return await geminiUpload(key, await videoRes.arrayBuffer(), contentType, label);
    } catch {
      return fail("couldn't read the uploaded clip");
    }
  }

  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
      "X-Goog-Upload-Header-Content-Type": contentType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: label || "reel" } }),
    signal: AbortSignal.timeout(20000),
  });
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!startRes.ok || !uploadUrl) return fail(`Gemini upload start failed: ${startRes.status}`);

  const CHUNK = 32 * 1024 * 1024;
  let offset = 0;
  const send = async (bytes: Uint8Array, last: boolean): Promise<Response> => {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Offset": String(offset),
        "X-Goog-Upload-Command": last ? (bytes.byteLength ? "upload, finalize" : "finalize") : "upload",
      },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`Gemini upload failed: ${res.status}`);
    offset += bytes.byteLength;
    return res;
  };

  let final: Response;
  try {
    const reader = videoRes.body.getReader();
    let held: Uint8Array[] = [];
    let heldLen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        held.push(value);
        heldLen += value.byteLength;
      }
      // forward every FULL chunk; the finalize always happens after the loop
      while (heldLen >= CHUNK) {
        const chunk = new Uint8Array(CHUNK);
        let filled = 0;
        while (filled < CHUNK) {
          const head = held[0];
          const take = Math.min(head.byteLength, CHUNK - filled);
          chunk.set(head.subarray(0, take), filled);
          filled += take;
          if (take === head.byteLength) held.shift();
          else held[0] = head.subarray(take);
        }
        heldLen -= CHUNK;
        await send(chunk, false);
      }
      if (done) break;
    }
    const rest = new Uint8Array(heldLen);
    let f = 0;
    for (const p of held) {
      rest.set(p, f);
      f += p.byteLength;
    }
    held = [];
    final = await send(rest, true);
  } catch (e) {
    return fail(e instanceof Error ? e.message.slice(0, 120) : "Gemini upload failed");
  }
  const uploaded = await final.json().catch(() => null);
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
  // default tracks the deployed GEMINI_MODEL env var (set in Vercel) — the
  // old gemini-2.5-flash default started failing when Google retired it
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
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
    const parsed = JSON.parse(text) as Record<string, unknown>;
    // Claude connector: when wired, the stronger writer rewrites the remake
    // from Gemini's style DNA — Gemini stays the eyes, Claude becomes the pen
    if (topic && process.env.ANTHROPIC_API_KEY) {
      const better = await polishRemake(parsed, topic);
      if (better) parsed.remake = better;
    }
    return { analysis: parsed };
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

/* ------------------------------------------------------------------ */
/* job machinery — immutable state journal in Blob + the background   */
/* pipeline that job-start / job-continue hand to after()             */
/* ------------------------------------------------------------------ */

type Topic = { title: string; angle: string; facts: string[] } | null;
type JobState = "received" | "processing" | "analyzing" | "error" | "done";
type JobRecord = { pathname: string; url: string; ms: number; state: JobState };

const JOB_ID_RE = /^[a-z0-9][a-z0-9-]{7,63}$/i;

/** Journal a state transition. New pathname per write — never overwritten,
    so a CDN-cached read can't be stale. Best-effort: the pipeline must not
    die because the journal hiccupped. */
async function writeJob(jobId: string, state: JobState, data: Record<string, unknown>): Promise<void> {
  const attempt = () =>
    put(`reeljobs/${jobId}/${Date.now()}-${state}.json`, JSON.stringify({ state, at: Date.now(), ...data }), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
  try {
    await attempt();
  } catch {
    // one retry — a swallowed journal write on done/error would strand the job
    try {
      await new Promise((r) => setTimeout(r, 1000));
      await attempt();
    } catch {}
  }
}

async function listJobRecords(jobId: string): Promise<JobRecord[]> {
  try {
    const { blobs } = await list({ prefix: `reeljobs/${jobId}/`, limit: 100 });
    return blobs
      .map((bl) => {
        const base = bl.pathname.split("/").pop() || "";
        const m = base.match(/^(\d+)-(received|processing|analyzing|error|done)\.json$/);
        return m ? { pathname: bl.pathname, url: bl.url, ms: Number(m[1]), state: m[2] as JobState } : null;
      })
      .filter((r): r is JobRecord => !!r)
      .sort((a, b) => a.ms - b.ms);
  } catch {
    return [];
  }
}

async function readJobRecord(rec: JobRecord): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(rec.url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** "done" beats everything (a raced retry's late error must not mask a
    finished analysis); otherwise latest write wins. */
function effectiveRecord(records: JobRecord[]): JobRecord | null {
  if (!records.length) return null;
  return records.find((r) => r.state === "done") || records[records.length - 1];
}

/** Re-sanitize a topic that round-tripped through the public journal. */
function sanitizeStoredTopic(raw: unknown): Topic {
  const t = raw as { title?: string; angle?: string; facts?: string[] } | null;
  return t && t.title
    ? {
        title: clamp(t.title, 160),
        angle: clamp(t.angle, 300),
        facts: (Array.isArray(t.facts) ? t.facts : []).map((f) => clamp(f, 400)).filter(Boolean).slice(0, 5),
      }
    : null;
}

/** The whole post-upload pipeline, run inside after() with the response
    already gone — every outcome lands in the journal, nowhere else.
    Continue-calls re-enter with fileUri set and skip the ingest step. */
async function runJobPipeline(
  key: string,
  jobId: string,
  opts: {
    blobUrl?: string;
    remoteUrl?: string;
    contentType: string;
    label: string;
    source: "own" | "reference";
    client?: string;
    topic: Topic;
    fileName?: string;
    fileUri?: string;
    mimeType?: string;
    t0: number;
  }
): Promise<void> {
  const timeLeft = () => 280000 - (Date.now() - opts.t0);
  try {
    let fileName = opts.fileName || "";
    let fileUri = opts.fileUri || "";
    let mimeType = opts.mimeType || opts.contentType;

    if (!fileUri) {
      // ingest: video → Gemini Files API
      let up: GeminiFile | Fail;
      if (opts.remoteUrl) {
        const got = await fetchRemoteBytes(opts.remoteUrl);
        if (isFail(got)) {
          await writeJob(jobId, "error", { error: got.error, retryable: false });
          return;
        }
        up = await geminiUpload(key, got.bytes, got.contentType, opts.label);
      } else {
        up = await geminiUploadFromBlob(key, opts.blobUrl || "", opts.contentType, opts.label);
      }
      if (isFail(up)) {
        // KEEP the Blob copy on a failed ingest — the received record's
        // videoUrl lets job-continue re-run this exact ingest without a
        // re-upload (deleting it here is why an early retry 404'd).
        // job-ack cleans it up once the job resolves either way.
        await writeJob(jobId, "error", { error: up.error, retryable: !opts.remoteUrl });
        return;
      }
      // the clip is safely at Gemini — the Blob copy is done; never leak
      // blobs (they cost storage)
      if (opts.blobUrl) del(opts.blobUrl).catch(() => {});
      fileName = up.name || "";
      fileUri = up.uri || "";
      mimeType = up.mimeType || mimeType;
      // journal everything a continue-invocation needs to finish the job
      await writeJob(jobId, "processing", { fileName, fileUri, mimeType, source: opts.source, label: opts.label, client: opts.client, topic: opts.topic });
    }

    // wait for Gemini processing, reserving 140s of budget for the analyze
    let state = "PROCESSING";
    while (state === "PROCESSING" && timeLeft() > 140000) {
      const info = await geminiFileStatus(key, fileName);
      if (!isFail(info)) state = String(info.state || "PROCESSING");
      if (state === "PROCESSING") await new Promise((r) => setTimeout(r, 4000));
    }
    if (state === "NOT_FOUND") {
      await writeJob(jobId, "error", { error: "That upload expired on Gemini's side — upload the clip again.", retryable: false });
      return;
    }
    if (state === "FAILED") {
      await writeJob(jobId, "error", { error: `Gemini couldn't process that video — trim it shorter and retry.`, retryable: false });
      return;
    }
    // budget spent while Gemini still chews — the journal's latest state
    // stays "processing"; job-status will see ACTIVE later and the client
    // kicks job-continue, which re-enters here with a fresh budget
    if (state !== "ACTIVE") return;

    await writeJob(jobId, "analyzing", {});
    const out = await geminiAnalyze(key, fileUri, mimeType, opts.topic);
    if (isFail(out)) {
      await writeJob(jobId, "error", { error: out.error, retryable: true });
      return;
    }
    await writeJob(jobId, "done", { analysis: out.analysis, source: opts.source, label: opts.label, client: opts.client });
  } catch (e) {
    await writeJob(jobId, "error", {
      error: e instanceof Error ? e.message.slice(0, 200) : "analysis pipeline failed",
      retryable: true,
    });
  }
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
  // optional shared-secret gate on the phases that ENUMERATE or DELETE
  // results. jobIds were unguessable until job-inbox made them listable —
  // when REEL_JOB_TOKEN is set (with NEXT_PUBLIC_REEL_JOB_TOKEN for the
  // app), strangers can no longer browse or burn finished analyses.
  const gate = process.env.REEL_JOB_TOKEN;
  if (gate && (phase === "job-inbox" || phase === "job-ack") && clamp(b.token, 200) !== gate) {
    return NextResponse.json({ configured: true, error: "not authorized" });
  }

  /* ---- phase "job-start": journal the job, respond fast, pipeline runs
          in the background — the phone is free to leave from here on ---- */
  if (phase === "job-start") {
    const jobId = clamp(b.jobId, 64);
    if (!JOB_ID_RE.test(jobId)) return NextResponse.json({ configured: true, error: "bad job id" });
    const blobUrl = clamp(b.url, 600);
    const remoteUrl = clamp(b.remoteUrl, 800);
    if (!blobUrl && !remoteUrl) return NextResponse.json({ configured: true, error: "no video url" });
    if (blobUrl && !isReelBlobUrl(blobUrl)) return NextResponse.json({ configured: true, error: "bad video url" });
    const topic = parseTopic(b, source);
    const t0 = Date.now();
    // journal EVERYTHING a continue-invocation needs to redo the ingest —
    // a platform-killed ingest must be re-runnable, and job-ack needs the
    // videoUrl to clean up a clip whose pipeline delete never ran
    const client = clamp(b.client, 60);
    await writeJob(jobId, "received", {
      label,
      source,
      client,
      contentType,
      topic,
      videoUrl: blobUrl || undefined,
      remoteUrl: remoteUrl || undefined,
    });
    after(() =>
      runJobPipeline(key, jobId, {
        blobUrl: blobUrl || undefined,
        remoteUrl: remoteUrl || undefined,
        contentType,
        label,
        source,
        client,
        topic,
        t0,
      })
    );
    return NextResponse.json({ configured: true, accepted: true, jobId });
  }

  /* ---- phase "job-status": read the journal, one fast peek ---- */
  if (phase === "job-status") {
    const jobId = clamp(b.jobId, 64);
    if (!JOB_ID_RE.test(jobId)) return NextResponse.json({ configured: true, error: "bad job id" });
    const records = await listJobRecords(jobId);
    const eff = effectiveRecord(records);
    if (!eff) return NextResponse.json({ configured: true, jobState: "none" });
    if (eff.state === "done") {
      const data = await readJobRecord(eff);
      // a flaky read of the done record must NOT report done — the client
      // would bank nothing and ack away the only copy of the analysis
      if (!data.analysis) return NextResponse.json({ configured: true, jobState: "processing", geminiState: "" });
      return NextResponse.json({ configured: true, jobState: "done", analysis: data.analysis, source: data.source, label: data.label, client: clamp(data.client, 60) || undefined });
    }
    if (eff.state === "error") {
      const data = await readJobRecord(eff);
      // NB: key is jobError, not error — phasePost treats a non-empty
      // `error` as a transport failure and would throw before the client's
      // error branch ever ran
      return NextResponse.json({ configured: true, jobState: "error", jobError: String(data.error || "The analysis failed — try again."), retryable: data.retryable === true });
    }
    if (eff.state === "processing") {
      // is Gemini done chewing? tells the client whether to kick job-continue
      const proc = await readJobRecord(eff);
      const fileName = String(proc.fileName || "");
      let geminiState = "";
      if (/^files\/[A-Za-z0-9._-]+$/.test(fileName)) {
        const info = await geminiFileStatus(key, fileName);
        if (!isFail(info)) geminiState = String(info.state || "");
      }
      // no pipeline is alive to journal a terminal Gemini state — converge
      // the journal here so every device sees the same ending
      if (geminiState === "FAILED" || geminiState === "NOT_FOUND") {
        const msg =
          geminiState === "NOT_FOUND"
            ? "That upload expired on Gemini's side — upload the clip again."
            : "Gemini couldn't process that video — trim it shorter and retry.";
        await writeJob(jobId, "error", { error: msg, retryable: false });
        return NextResponse.json({ configured: true, jobState: "error", jobError: msg, retryable: false });
      }
      return NextResponse.json({ configured: true, jobState: "processing", geminiState });
    }
    return NextResponse.json({ configured: true, jobState: eff.state });
  }

  /* ---- phase "job-continue": fresh budget for a stalled job ---- */
  if (phase === "job-continue") {
    const jobId = clamp(b.jobId, 64);
    if (!JOB_ID_RE.test(jobId)) return NextResponse.json({ configured: true, error: "bad job id" });
    const records = await listJobRecords(jobId);
    if (records.some((r) => r.state === "done")) return NextResponse.json({ configured: true, jobState: "done" });
    // in-flight guard: a fresh analyzing claim means a pipeline is (very
    // likely) still working — don't spawn a duplicate generateContent
    const anal = records.filter((r) => r.state === "analyzing").pop();
    if (anal && Date.now() - anal.ms < 3 * 60000) return NextResponse.json({ configured: true, jobState: "analyzing" });
    const t0 = Date.now();

    const procs = records.filter((r) => r.state === "processing");
    if (procs.length) {
      const proc = await readJobRecord(procs[procs.length - 1]);
      const fileUri = String(proc.fileUri || "");
      if (!fileUri.startsWith(`${GEMINI_BASE}/`)) return NextResponse.json({ configured: true, error: "nothing to continue — start the analysis again" });
      // claim BEFORE responding, so the very next job-status/continue sees
      // this invocation as in-flight (after() spin-up + list consistency
      // would otherwise leave a kick-again window)
      await writeJob(jobId, "analyzing", {});
      after(() =>
        runJobPipeline(key, jobId, {
          contentType,
          label: String(proc.label || ""),
          source: proc.source === "reference" ? "reference" : "own",
          client: clamp(proc.client, 60),
          topic: sanitizeStoredTopic(proc.topic),
          fileName: String(proc.fileName || ""),
          fileUri,
          mimeType: String(proc.mimeType || "video/mp4"),
          t0,
        })
      );
      return NextResponse.json({ configured: true, resumed: true });
    }

    // no processing record — the ingest invocation was killed before the
    // Gemini hand-off finished. The received record has everything needed
    // to re-run the ingest with a fresh budget.
    const rcvs = records.filter((r) => r.state === "received");
    if (!rcvs.length) return NextResponse.json({ configured: true, error: "nothing to continue — start the analysis again" });
    const rcv = await readJobRecord(rcvs[rcvs.length - 1]);
    const videoUrl = String(rcv.videoUrl || "");
    const rcvRemote = String(rcv.remoteUrl || "");
    if (!(videoUrl && isReelBlobUrl(videoUrl)) && !rcvRemote)
      return NextResponse.json({ configured: true, error: "nothing to continue — start the analysis again" });
    after(() =>
      runJobPipeline(key, jobId, {
        blobUrl: videoUrl && isReelBlobUrl(videoUrl) ? videoUrl : undefined,
        remoteUrl: rcvRemote || undefined,
        contentType: clamp(rcv.contentType, 60) || "video/mp4",
        label: clamp(rcv.label, 120),
        source: rcv.source === "reference" ? "reference" : "own",
        client: clamp(rcv.client, 60),
        topic: sanitizeStoredTopic(rcv.topic),
        t0,
      })
    );
    return NextResponse.json({ configured: true, resumed: true });
  }

  /* ---- phase "job-inbox": finished jobs started ANYWHERE (a Cowork
          terminal, another device) that no client has banked yet. Lets the
          app auto-collect results it never knew were started — the bridge
          that makes "agent uploads from the Mac, breakdown appears in the
          app" work with zero manual hand-off. ---- */
  if (phase === "job-inbox") {
    try {
      // full listing (paginated) — a store carrying stale journals must
      // never hide fresh results past the first page
      const all: Array<{ pathname: string; url: string }> = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page++) {
        const res = await list({ prefix: "reeljobs/", limit: 1000, cursor });
        all.push(...res.blobs);
        if (!res.hasMore || !res.cursor) break;
        cursor = res.cursor;
      }
      const newestAny = new Map<string, number>();
      const newestDone = new Map<string, { ms: number; url: string }>();
      const urlsByJob = new Map<string, string[]>();
      for (const bl of all) {
        const m = bl.pathname.match(/^reeljobs\/([A-Za-z0-9-]+)\/(\d+)-(received|processing|analyzing|error|done)\.json$/);
        if (!m) continue;
        const id = m[1];
        const ms = Number(m[2]);
        newestAny.set(id, Math.max(newestAny.get(id) || 0, ms));
        if (!urlsByJob.has(id)) urlsByJob.set(id, []);
        urlsByJob.get(id)!.push(bl.url);
        if (m[3] === "done") {
          const cur = newestDone.get(id);
          // ONE entry per job, newest done record wins — a retry that wrote
          // two done records must not import twice
          if (!cur || ms > cur.ms) newestDone.set(id, { ms, url: bl.url });
        }
      }
      // GC: a job untouched for 48h can never be resumed (Gemini file
      // expired) — burn its journal in the background
      const staleUrls: string[] = [];
      for (const [id, ms] of newestAny) {
        if (ms < Date.now() - 48 * 3600000) staleUrls.push(...(urlsByJob.get(id) || []));
      }
      if (staleUrls.length) after(() => del(staleUrls.slice(0, 300)).catch(() => {}));
      // 3-minute grace window: an actively-watched job banks through its
      // own path within seconds of done — the inbox must never race an
      // active watcher and ack a result out from under it
      const dones = [...newestDone.entries()]
        .map(([jobId, d]) => ({ jobId, ...d }))
        .filter((x) => x.ms > Date.now() - 40 * 3600000 && x.ms < Date.now() - 3 * 60000)
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 5);
      const reads = await Promise.all(dones.map((d) => readJobRecord({ pathname: "", url: d.url, ms: d.ms, state: "done" })));
      const jobs: Array<Record<string, unknown>> = [];
      dones.forEach((d, i) => {
        const rec = reads[i];
        if (rec.analysis) {
          jobs.push({
            jobId: d.jobId,
            label: clamp(rec.label, 120),
            source: rec.source === "reference" ? "reference" : "own",
            client: clamp(rec.client, 60) || undefined,
            at: d.ms,
          });
        }
      });
      return NextResponse.json({ configured: true, jobs });
    } catch {
      return NextResponse.json({ configured: true, jobs: [] });
    }
  }

  /* ---- phase "job-ack": the analysis is banked — burn the journal ---- */
  if (phase === "job-ack") {
    const jobId = clamp(b.jobId, 64);
    if (!JOB_ID_RE.test(jobId)) return NextResponse.json({ configured: true, error: "bad job id" });
    const records = await listJobRecords(jobId);
    const received = records.find((r) => r.state === "received");
    if (received) {
      const data = await readJobRecord(received);
      const videoUrl = String(data.videoUrl || "");
      if (videoUrl && isReelBlobUrl(videoUrl)) del(videoUrl).catch(() => {});
    }
    if (records.length) del(records.map((r) => r.url)).catch(() => {});
    return NextResponse.json({ configured: true, ok: true });
  }

  /* ---- phase "start": blob → Gemini Files API, blob deleted, out fast ---- */
  if (phase === "start") {
    const blobUrl = clamp(b.url, 600);
    const remoteUrl = clamp(b.remoteUrl, 800);
    if (!blobUrl && !remoteUrl) return NextResponse.json({ configured: true, error: "no video url" });
    // validated before the finally-block del can ever see it
    if (blobUrl && !isReelBlobUrl(blobUrl)) return NextResponse.json({ configured: true, error: "bad video url" });
    try {
      let bytes: ArrayBuffer;
      let ct = contentType;
      if (remoteUrl) {
        // link lane: server fetches the video — the browser never read it
        const got = await fetchRemoteBytes(remoteUrl);
        if (isFail(got)) return NextResponse.json({ configured: true, error: got.error });
        bytes = got.bytes;
        ct = got.contentType;
      } else {
        const got = await fetchBlobBytes(blobUrl);
        if (isFail(got)) return NextResponse.json({ configured: true, error: got.error });
        bytes = got;
      }
      const fileInfo = await geminiUpload(key, bytes, ct, label);
      if (isFail(fileInfo)) return NextResponse.json({ configured: true, error: fileInfo.error });
      return NextResponse.json({
        configured: true,
        fileName: fileInfo.name,
        fileUri: fileInfo.uri,
        mimeType: fileInfo.mimeType || ct,
        state: fileInfo.state || "PROCESSING",
      });
    } catch (e) {
      return NextResponse.json({ configured: true, error: e instanceof Error ? e.message.slice(0, 200) : "video upload failed" });
    } finally {
      // the clip has either landed at Gemini or the attempt failed — either
      // way the Blob copy is done; never leak blobs (they cost storage)
      if (blobUrl) del(blobUrl).catch(() => {});
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
  if (!isReelBlobUrl(blobUrl)) return NextResponse.json({ configured: true, error: "bad video url" });
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
