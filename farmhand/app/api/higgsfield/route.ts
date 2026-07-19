import { NextRequest, NextResponse } from "next/server";

/**
 * Higgsfield AI image generation (Soul model) for the Post Studio.
 *
 * GET  /api/higgsfield            → { configured }
 * GET  /api/higgsfield?img=<url>  → proxies a generated image (same-origin so
 *                                   the Studio's canvas pipeline can process it)
 * POST /api/higgsfield { prompt } → starts a Soul text2image job, polls until
 *                                   done, returns { images: [urls] }
 * POST { prompts: string[], seed?, aspect? }
 *      → whole-post mode: one job per slide prompt (max 6), all on the same
 *        model with a shared seed for a congruent carousel. Returns
 *        { images: (url|null)[] } ordered to match the prompts.
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

const ASPECTS = new Set(["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"]);

/** One started generation job: its start payload + how to poll it. */
type Job = { startJson: unknown; statusUrl: string | null; ids: string[] };

export async function POST(req: NextRequest) {
  const auth = creds();
  if (!auth) return NextResponse.json({ configured: false, needsCreds: true, images: [] });

  let body: { prompt?: unknown; prompts?: unknown; seed?: unknown; aspect?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const list = Array.isArray(body.prompts)
    ? (body.prompts as unknown[]).map((p) => String(p || "").trim().slice(0, 800)).filter(Boolean).slice(0, 6)
    : [];
  const single = String(body.prompt || "").trim().slice(0, 800);
  const multi = list.length > 0;
  const prompts = multi ? list : single ? [single] : [];
  if (!prompts.length) return NextResponse.json({ configured: true, images: [], error: "empty prompt" });

  const aspect = ASPECTS.has(String(body.aspect)) ? String(body.aspect) : "1:1";
  const seedNum = Math.round(Number(body.seed));
  const seed = Number.isFinite(seedNum) && seedNum >= 1 && seedNum <= 1_000_000 ? seedNum : null;

  const headers = { Authorization: auth, "Content-Type": "application/json" };

  // Canonical official-API shapes (verified against a working wrapper of
  // platform.higgsfield.ai): model routes take RAW JSON bodies — no
  // params/arguments wrapper — and return { request_id } to poll at
  // /requests/{id}/status with results in images[].url. Soul's real image
  // endpoint is higgsfield-ai/soul/standard. The legacy /v1 route (params-
  // wrapped) stays as a last resort. A shared seed (where the model takes
  // one) keeps a multi-slide batch visually congruent.
  const attempts: { path: string; make: (p: string) => unknown }[] = [
    { path: "/higgsfield-ai/soul/standard", make: (p) => ({ prompt: p, aspect_ratio: aspect, resolution: "1080p", ...(seed ? { seed } : {}) }) },
    { path: "/bytedance/seedream/v4/text-to-image", make: (p) => ({ prompt: p, aspect_ratio: aspect, resolution: "2K" }) },
    { path: "/flux-pro/kontext/max/text-to-image", make: (p) => ({ prompt: p, aspect_ratio: aspect, ...(seed ? { seed } : {}) }) },
    { path: "/v1/text2image/soul", make: (p) => ({ params: { prompt: p, width_and_height: "1536x1536" } }) },
  ];

  const startOn = async (a: (typeof attempts)[number], p: string): Promise<{ ok: true; job: Job } | { ok: false; fail: string }> => {
    const r = await fetch(`${BASE}${a.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(a.make(p)),
      signal: AbortSignal.timeout(30000),
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, fail: `${a.path} → ${r.status}: ${text.slice(0, 120)}` };
    let j: unknown = {};
    try {
      j = JSON.parse(text);
    } catch {}
    // model-path routes hand back an absolute status_url — poll it verbatim
    const statusUrl = typeof (j as { status_url?: unknown })?.status_url === "string" ? (j as { status_url: string }).status_url : null;
    return { ok: true, job: { startJson: j, statusUrl, ids: jobIds(j) } };
  };

  try {
    // walk the model ladder with the first prompt to find the live path…
    let attempt: (typeof attempts)[number] | null = null;
    let firstJob: Job | null = null;
    const failures: string[] = [];
    for (const a of attempts) {
      const r = await startOn(a, prompts[0]);
      if (r.ok) {
        attempt = a;
        firstJob = r.job;
        break;
      }
      failures.push(r.fail);
    }
    if (!attempt || !firstJob) {
      return NextResponse.json({
        configured: true,
        images: multi ? prompts.map(() => null) : [],
        error: `all models unavailable — ${failures.join(" · ")}`,
      });
    }
    // …then start the rest of the batch on that same path in parallel
    const rest = await Promise.all(
      prompts.slice(1).map(async (p) => {
        try {
          const r = await startOn(attempt!, p);
          return r.ok ? r.job : null;
        } catch {
          return null;
        }
      })
    );
    const jobs: (Job | null)[] = [firstJob, ...rest];

    // some responses may already carry result URLs
    const found: string[][] = jobs.map((j) => (j ? imageUrls(j.startJson) : []));
    const failStatus: (string | null)[] = jobs.map(() => null);

    // poll every unfinished job until completed / failed (shared deadline)
    const deadline = Date.now() + (multi ? 110000 : 70000);
    const pending = () => jobs.some((j, i) => j && !found[i].length && !failStatus[i]);
    while (pending() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      await Promise.all(
        jobs.map(async (j, i) => {
          if (!j || found[i].length || failStatus[i]) return;
          const targets = j.statusUrl ? [j.statusUrl] : j.ids.map((id) => `${BASE}/requests/${id}/status`);
          for (const target of targets) {
            try {
              const st = await fetch(target, { headers, signal: AbortSignal.timeout(15000) });
              if (!st.ok) continue;
              const sj = await st.json();
              const status = String((sj as { status?: unknown })?.status || "");
              if (/failed|nsfw|error/i.test(status)) {
                failStatus[i] = status;
                return;
              }
              const urls = imageUrls(sj);
              if (urls.length) {
                found[i] = urls;
                return;
              }
            } catch {}
          }
        })
      );
    }

    if (multi) {
      // ordered one-url-per-prompt; a failed/timed-out slide is null so the
      // client can keep the rest of the carousel
      const images = found.map((f) => f[0] ?? null);
      const got = images.filter(Boolean).length;
      return NextResponse.json({
        configured: true,
        images,
        ...(got ? {} : { error: "timed out waiting for images — try again" }),
      });
    }
    if (failStatus[0]) return NextResponse.json({ configured: true, images: [], error: `generation ${failStatus[0]}` });
    if (!found[0].length) return NextResponse.json({ configured: true, images: [], error: "timed out waiting for the image — try again" });
    return NextResponse.json({ configured: true, images: found[0].slice(0, 4) });
  } catch (e) {
    return NextResponse.json({ configured: true, images: [], error: e instanceof Error ? e.message.slice(0, 200) : "request failed" });
  }
}
