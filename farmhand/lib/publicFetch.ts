/**
 * Guarded fetch of an arbitrary PUBLIC url (server-side only).
 *
 * Anything that takes a user-supplied URL and fetches it from our servers
 * is an SSRF primitive unless it's guarded: the hostname is RESOLVED and
 * judged by its IP (a string regex misses integer/octal/hex literals that
 * resolvers happily map into private space), the port is pinned, every
 * redirect hop is re-validated, and the body is streamed against a hard
 * cap so a chunked response that lies about Content-Length can't exhaust
 * function memory.
 *
 * NOTE: /api/vault carries its own copy of this guard (shipped + verified
 * earlier). Consolidate it onto this module the next time that route is
 * touched for another reason — not worth destabilizing a verified path
 * for a pure refactor.
 */

import { lookup } from "dns/promises";

export function ipIsPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (low.startsWith("fe80:") || low.startsWith("fc") || low.startsWith("fd")) return true;
    if (low.startsWith("::ffff:")) return ipIsPrivate(low.slice(7));
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224;
}

export async function hostBlocked(u: URL): Promise<string | null> {
  if (u.protocol !== "https:" && u.protocol !== "http:") return "http(s) only";
  if (u.port && u.port !== "443" && u.port !== "80") return "non-standard port";
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

export interface FetchedBody {
  bytes: Uint8Array;
  contentType: string;
  finalUrl: string;
}

/** Fetch a public URL with the guard + a streamed byte cap. */
export async function fetchPublic(
  rawUrl: string,
  opts: { maxBytes: number; timeoutMs?: number; accept?: string } = { maxBytes: 3 * 1024 * 1024 }
): Promise<FetchedBody | { error: string }> {
  if (!rawUrl || rawUrl.length > 2000) return { error: "bad url" };
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { error: "that doesn't look like a link" };
  }
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? 25000);
  let res: Response | null = null;
  for (let hop = 0; hop < 6; hop++) {
    const blocked = await hostBlocked(u);
    if (blocked) return { error: blocked };
    try {
      res = await fetch(u.toString(), {
        signal: deadline,
        redirect: "manual",
        headers: {
          // news sites reject unknown agents outright
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          Accept: opts.accept || "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      });
    } catch {
      return { error: "couldn't reach that link" };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { error: "the link redirected nowhere" };
      try {
        u = new URL(loc, u);
      } catch {
        return { error: "the link redirected somewhere invalid" };
      }
      res = null;
      continue;
    }
    break;
  }
  if (!res) return { error: "too many redirects" };
  if (!res.ok) return { error: `the site answered ${res.status}${res.status === 403 ? " (it blocks automated readers — paste the text instead)" : ""}` };

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > opts.maxBytes) return { error: "that page is too large" };
  if (!res.body) return { error: "the site returned no content" };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > opts.maxBytes) {
        reader.cancel().catch(() => {});
        return { error: "that page is too large" };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  return {
    bytes,
    contentType: (res.headers.get("content-type") || "").split(";")[0].trim(),
    finalUrl: u.toString(),
  };
}
