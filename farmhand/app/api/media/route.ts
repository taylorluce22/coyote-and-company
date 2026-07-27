import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin media streamer — the thing that makes vault media actually
 * PLAY inline.
 *
 * Why this exists: the vault's Blob URLs are cross-origin
 * (*.public.blob.vercel-storage.com vs the app's own host). The store
 * answers Range requests correctly (206 + the right bytes), but it does
 * not expose `Content-Range` / `Accept-Ranges` to the PAGE, and without
 * those headers a browser media engine can't build a seekable stream — it
 * parks at readyState 0 and never renders a frame. A full GET works
 * (that's why the download links worked), which is exactly how this
 * slipped past every earlier test.
 *
 * GET/HEAD /api/media?u=<encoded vault blob url>[&v=<cache-bust>]
 *   → proxies the blob SAME-ORIGIN with real HTTP range semantics:
 *     206 + Content-Range + Accept-Ranges + Content-Length + Content-Type
 *     on a partial request, 200 + Accept-Ranges on a full one. The body is
 *     STREAMED through (never buffered in the function), so a 100MB clip
 *     costs the same memory as a 1MB one.
 *
 * Only OUR store, only the vault/ prefix — the same guard the rest of the
 * media surfaces use. `u` is validated as a pure string check so every
 * range request stays cheap (media engines issue many).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** Only our Blob store, only permanent vault media. */
function vaultTarget(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!u.hostname.endsWith(".blob.vercel-storage.com")) return null;
    if (!u.pathname.replace(/^\/+/, "").startsWith("vault/")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const TYPE_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};
const typeFor = (url: string, upstream: string | null): string => {
  if (upstream && upstream !== "application/octet-stream" && upstream !== "binary/octet-stream") return upstream;
  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  return TYPE_BY_EXT[ext] || "application/octet-stream";
};

async function serve(req: NextRequest, method: "GET" | "HEAD") {
  const target = vaultTarget(req.nextUrl.searchParams.get("u") || "");
  if (!target) return new NextResponse("bad media url", { status: 400 });

  const range = req.headers.get("range") || "";
  try {
    const upstream = await fetch(target, {
      method,
      // forward the byte range verbatim — the store honors it
      headers: range ? { Range: range } : undefined,
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse("media unavailable", { status: upstream.status === 404 ? 404 : 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", typeFor(target, upstream.headers.get("content-type")));
    // THE FIX: these two must reach the page, or the media engine hangs
    headers.set("Accept-Ranges", "bytes");
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    // vault keys are overwritable (regen/re-assemble) — keep the TTL short
    headers.set("Cache-Control", "public, max-age=60");

    if (method === "HEAD") return new NextResponse(null, { status: upstream.status, headers });
    // stream the body straight through — flat memory regardless of size
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return new NextResponse("media fetch failed", { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return serve(req, "GET");
}

export async function HEAD(req: NextRequest) {
  return serve(req, "HEAD");
}
