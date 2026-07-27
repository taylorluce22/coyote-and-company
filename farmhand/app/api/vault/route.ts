import { NextRequest, NextResponse } from "next/server";
import { del, list, put } from "@vercel/blob";
import { lookup } from "dns/promises";

/**
 * Server-side media vault — the browser never holds media again.
 *
 * The old clip vault kept video/audio Blobs in IndexedDB; reading and
 * writing multi-MB blobs on the main thread is exactly what kept freezing
 * Chrome. Now every generated asset lives in Vercel Blob under a
 * deterministic key and the client stores/streams URLs only:
 *
 *   vault/<client>/<reelId>/clip-<beat>.mp4    Higgsfield beat clip
 *   vault/<client>/<reelId>/vo-<beat>.mp3      ElevenLabs narration segment
 *   vault/<client>/<reelId>/draft.mp4          assembled draft reel
 *   vault/<client>/refs/<jobId>.mp4            preserved reference video
 *
 * Deterministic keys + allowOverwrite mean regeneration replaces in place —
 * the manifest is just a prefix listing, no database.
 *
 * GET  ?client=&reelId=            → { clips: [{beat,url}], vos: [{beat,url}], draft? }
 * POST { phase: "ingest", client, reelId, beat, sourceUrl }
 *      → SERVER fetches the finished Higgsfield clip and stores it under
 *        the vault key — the bytes go CDN→function→Blob, never through the
 *        browser. Returns { url }.
 * POST { phase: "delete", client, reelId, extraUrls? }
 *      → burn everything under the reel's prefix (+ listed vault/ urls,
 *        e.g. the preserved reference) when a card is deleted.
 */

export const maxDuration = 120;

const SEG = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const seg = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return SEG.test(s) ? s : null;
};
const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

const isVaultUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.replace(/^\/+/, "").startsWith("vault/");
  } catch {
    return false;
  }
};

/** SSRF guard for ingest sources — Higgsfield result URLs live on varied
    CDN hosts, so allow public https, but RESOLVE the hostname and judge the
    resolved addresses (a string regex misses integer/octal/hex IP literals,
    which the resolver happily maps to private space), pin the port to 443,
    and re-check every redirect hop. Known residual: fetch re-resolves DNS
    itself (TOCTOU) — acceptable for this app's single-owner posture. */
function ipIsPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (low.startsWith("fe80:") || low.startsWith("fc") || low.startsWith("fd")) return true;
    if (low.startsWith("::ffff:")) return ipIsPrivate(low.slice(7));
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b2] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 172 && b2 >= 16 && b2 <= 31) || (a === 192 && b2 === 168) || (a === 169 && b2 === 254) || a >= 224;
}
async function hostBlocked(u: URL): Promise<string | null> {
  if (u.protocol !== "https:") return "https only";
  if (u.port && u.port !== "443") return "non-standard port";
  const h = u.hostname.toLowerCase();
  if (h.startsWith("[") || h === "localhost" || h.endsWith(".internal") || h.endsWith(".local")) return "private address";
  try {
    const addrs = await lookup(h, { all: true });
    if (!addrs.length || addrs.some((a) => ipIsPrivate(a.address))) return "private address";
  } catch {
    return "unresolvable host";
  }
  return null;
}

const MAX_INGEST_BYTES = 100 * 1024 * 1024;

async function fetchPublicVideo(rawUrl: string): Promise<{ bytes: Uint8Array; contentType: string } | { error: string }> {
  if (rawUrl.length > 2000) return { error: "source url too long" };
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { error: "bad source url" };
  }
  const deadline = AbortSignal.timeout(90000);
  let res: Response | null = null;
  for (let hop = 0; hop < 6; hop++) {
    const blocked = await hostBlocked(u);
    if (blocked) return { error: blocked };
    res = await fetch(u.toString(), { signal: deadline, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { error: "source redirected nowhere" };
      u = new URL(loc, u);
      res = null;
      continue;
    }
    break;
  }
  if (!res) return { error: "source redirects too many times" };
  if (!res.ok) return { error: `source answered ${res.status}` };
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_INGEST_BYTES) return { error: "source is over the 100MB cap" };
  const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (ct.startsWith("text/") || ct.includes("html")) return { error: "source is a web page, not a video" };
  // STREAM with a cumulative cap — a chunked body that lies about (or
  // omits) Content-Length must abort at the cap, never buffer unbounded
  if (!res.body) return { error: "source returned no body" };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_INGEST_BYTES) {
        reader.cancel().catch(() => {});
        return { error: "source is over the 100MB cap" };
      }
      chunks.push(value);
    }
  }
  if (total < 10_000) return { error: "source returned almost no data" };
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  return { bytes, contentType: ct.startsWith("video/") ? ct : "video/mp4" };
}

export async function GET(req: NextRequest) {
  const client = seg(req.nextUrl.searchParams.get("client"));
  const reelId = seg(req.nextUrl.searchParams.get("reelId"));
  if (!client || !reelId) return NextResponse.json({ error: "bad client/reel id" }, { status: 400 });
  try {
    const { blobs } = await list({ prefix: `vault/${client}/${reelId}/`, limit: 200 });
    const clips: Array<{ beat: number; url: string }> = [];
    const vos: Array<{ beat: number; url: string }> = [];
    let draft: string | undefined;
    for (const b of blobs) {
      const name = b.pathname.split("/").pop() || "";
      const mClip = name.match(/^clip-(\d+)\.mp4$/);
      const mVo = name.match(/^vo-(\d+)\.mp3$/);
      if (mClip) clips.push({ beat: Number(mClip[1]), url: b.url });
      else if (mVo) vos.push({ beat: Number(mVo[1]), url: b.url });
      else if (name === "draft.mp4") draft = b.url;
    }
    clips.sort((a, b) => a.beat - b.beat);
    vos.sort((a, b) => a.beat - b.beat);
    return NextResponse.json({ clips, vos, ...(draft ? { draft } : {}) });
  } catch {
    return NextResponse.json({ error: "vault listing failed — try again" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const phase = clamp(b.phase, 20);
  const client = seg(b.client);
  const reelId = seg(b.reelId);

  if (phase === "ingest") {
    if (!client || !reelId) return NextResponse.json({ error: "bad client/reel id" }, { status: 400 });
    const beat = Math.round(Number(b.beat));
    if (!Number.isFinite(beat) || beat < 0 || beat > 30) return NextResponse.json({ error: "bad beat index" }, { status: 400 });
    const sourceUrl = String(b.sourceUrl ?? "").trim();
    try {
      const got = await fetchPublicVideo(sourceUrl);
      if ("error" in got) return NextResponse.json({ error: `couldn't pull the clip: ${got.error}` }, { status: 502 });
      const blob = await put(`vault/${client}/${reelId}/clip-${beat}.mp4`, got.bytes as unknown as ArrayBuffer, {
        access: "public",
        contentType: got.contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        // overwritable key — a long CDN TTL would serve a stale clip after a regen
        cacheControlMaxAge: 60,
      });
      return NextResponse.json({ url: blob.url, bytes: got.bytes.byteLength });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "ingest failed" }, { status: 500 });
    }
  }

  if (phase === "delete") {
    if (!client || !reelId) return NextResponse.json({ error: "bad client/reel id" }, { status: 400 });
    try {
      const { blobs } = await list({ prefix: `vault/${client}/${reelId}/`, limit: 200 });
      const urls = blobs.map((x) => x.url);
      // extras: e.g. the preserved reference under vault/<client>/refs/ —
      // scoped to THIS client's vault area, so a crafted request can never
      // reach another client's media (or any other store area)
      const extras = (Array.isArray(b.extraUrls) ? b.extraUrls : [])
        .map((u) => clamp(u, 600))
        .filter((u) => {
          try {
            return isVaultUrl(u) && new URL(u).pathname.replace(/^\/+/, "").startsWith(`vault/${client}/`);
          } catch {
            return false;
          }
        })
        .slice(0, 10);
      const all = [...urls, ...extras];
      if (all.length) await del(all);
      return NextResponse.json({ ok: true, deleted: all.length });
    } catch {
      return NextResponse.json({ error: "vault delete failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "unknown phase" }, { status: 400 });
}
