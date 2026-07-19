import { NextRequest, NextResponse } from "next/server";

/**
 * Higgsfield AI image generation (Soul model) for the Post Studio.
 *
 * GET  /api/higgsfield            → { configured }
 * GET  /api/higgsfield?img=<url>  → proxies a generated image (same-origin so
 *                                   the Studio's canvas pipeline can process it)
 * POST /api/higgsfield { prompt } → starts a Soul text2image job, polls until
 *                                   done, returns { images: [urls] }
 *
 * Auth: Authorization: Key KEY_ID:KEY_SECRET (platform.higgsfield.ai).
 * Keys live ONLY in Vercel env: HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET.
 */

const BASE = "https://platform.higgsfield.ai";

function creds(): string | null {
  const id = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  return id && secret ? `Key ${id}:${secret}` : null;
}

/**
 * Pull result image URLs out of a response payload. The API returns them as
 * `images[].url` (per the official SDK) and they can be signed URLs with no
 * file extension — so collect the value of every `url`-named field, plus any
 * extension-bearing image links as a fallback. Videos are excluded.
 */
function imageUrls(payload: unknown): string[] {
  const urls = new Set<string>();
  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (k === "url" && typeof v === "string" && v.startsWith("https://") && !/\.(mp4|webm|mov)(\?|$)/i.test(v)) urls.add(v);
        else walk(v);
      }
    }
  };
  walk(payload);
  const re = /https?:\/\/[^\s"']+\.(?:png|jpe?g|webp)(?:\?[^\s"']*)?/gi;
  for (const m of JSON.stringify(payload ?? "").matchAll(re)) urls.add(m[0]);
  return [...urls];
}

/** Collect job/request ids from the job-set response, shape-tolerantly. */
function jobIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      const rec = o as Record<string, unknown>;
      for (const k of ["id", "request_id", "job_id"]) {
        if (typeof rec[k] === "string" && (rec[k] as string).length > 8) ids.add(rec[k] as string);
      }
      for (const v of Object.values(rec)) walk(v);
    }
  };
  walk(payload);
  return [...ids];
}

export async function GET(req: NextRequest) {
  const img = req.nextUrl.searchParams.get("img");
  if (!img) return NextResponse.json({ configured: !!creds() });

  // image proxy — only https, only image content, bounded size
  let u: URL;
  try {
    u = new URL(img);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (u.protocol !== "https:") return NextResponse.json({ error: "https only" }, { status: 400 });
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) return NextResponse.json({ error: "not an image" }, { status: 400 });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 15_000_000) return NextResponse.json({ error: "too large" }, { status: 400 });
    return new NextResponse(buf, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const auth = creds();
  if (!auth) return NextResponse.json({ configured: false, needsCreds: true, images: [] });

  let body: { prompt?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const prompt = String(body.prompt || "").trim().slice(0, 800);
  if (!prompt) return NextResponse.json({ configured: true, images: [], error: "empty prompt" });

  const headers = { Authorization: auth, "Content-Type": "application/json" };
  try {
    const start = await fetch(`${BASE}/v1/text2image/soul`, {
      method: "POST",
      headers,
      // the API requires generation parameters wrapped in a `params` object
      // (422 "missing body.params" otherwise — confirmed against the live API)
      body: JSON.stringify({ params: { prompt, width_and_height: "1536x1536" } }),
      signal: AbortSignal.timeout(30000),
    });
    const startText = await start.text();
    if (!start.ok) {
      return NextResponse.json({ configured: true, images: [], error: `higgsfield ${start.status}: ${startText.slice(0, 200)}` });
    }
    let startJson: unknown = {};
    try {
      startJson = JSON.parse(startText);
    } catch {}

    // some responses may already carry result URLs
    let found = imageUrls(startJson);
    const ids = jobIds(startJson);

    // poll each request id until completed / failed (~70s budget)
    const deadline = Date.now() + 70000;
    while (!found.length && ids.length && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      for (const id of ids) {
        try {
          const st = await fetch(`${BASE}/requests/${id}/status`, { headers, signal: AbortSignal.timeout(15000) });
          if (!st.ok) continue;
          const sj = await st.json();
          const status = String((sj as { status?: unknown })?.status || "");
          if (/failed|nsfw|error/i.test(status)) {
            return NextResponse.json({ configured: true, images: [], error: `generation ${status}` });
          }
          const urls = imageUrls(sj);
          if (urls.length) {
            found = urls;
            break;
          }
        } catch {}
      }
    }

    if (!found.length) return NextResponse.json({ configured: true, images: [], error: "timed out waiting for the image — try again" });
    return NextResponse.json({ configured: true, images: found.slice(0, 4) });
  } catch (e) {
    return NextResponse.json({ configured: true, images: [], error: e instanceof Error ? e.message.slice(0, 200) : "request failed" });
  }
}
