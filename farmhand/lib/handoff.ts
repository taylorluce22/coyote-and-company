/**
 * Phone handoff — move a full client bundle to another device with a single
 * link, using only infrastructure the app already has (Vercel Blob).
 *
 * Security model: the bundle is AES-GCM encrypted in the browser with a
 * random 256-bit key that travels ONLY in the link's #fragment — fragments
 * never reach any server, so the blob at rest is ciphertext to everyone
 * (including Vercel). The blob self-deletes after a successful import and
 * the receiver strips the URL immediately.
 */

import type { ClientBundle } from "./clients";

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return data;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") return data;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return data; // sender had no CompressionStream — data was never gzipped
  }
}

/** Encrypt a bundle for transfer. Returns the ciphertext and the url-safe key. */
export async function packHandoff(bundle: ClientBundle): Promise<{ payload: Uint8Array; key: string }> {
  const raw = await gzip(enc.encode(JSON.stringify(bundle)));
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw as BufferSource));
  const payload = new Uint8Array(iv.length + ct.length);
  payload.set(iv, 0);
  payload.set(ct, iv.length);
  return { payload, key: b64url(keyBytes) };
}

/** Decrypt a fetched handoff payload back into a bundle. */
export async function unpackHandoff(payload: ArrayBuffer, keyB64: string): Promise<ClientBundle> {
  const bytes = new Uint8Array(payload);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const key = await crypto.subtle.importKey("raw", fromB64url(keyB64), "AES-GCM", false, ["decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  return JSON.parse(dec.decode(await gunzip(raw))) as ClientBundle;
}

/** Build the one-time link. The key rides in the #fragment — never sent to servers. */
export function handoffLink(blobUrl: string, key: string): string {
  return `${location.origin}/?ho=${encodeURIComponent(blobUrl)}#hk=${key}`;
}

/** Parse an incoming handoff link on the receiving device. */
export function parseHandoff(): { blobUrl: string; key: string } | null {
  try {
    const ho = new URLSearchParams(location.search).get("ho");
    const m = location.hash.match(/hk=([A-Za-z0-9_-]+)/);
    if (!ho || !m) return null;
    const u = new URL(ho);
    if (!/\.vercel-storage\.com$/.test(u.hostname) || !u.pathname.includes("handoff")) return null;
    return { blobUrl: ho, key: m[1] };
  } catch {
    return null;
  }
}
