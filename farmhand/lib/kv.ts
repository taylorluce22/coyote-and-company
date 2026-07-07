/**
 * Tiny KV layer for the always-on lead store. Talks to Upstash Redis over its
 * REST API (plain fetch — no SDK, works in any serverless runtime). Supports
 * both the Vercel-KV env names and the native Upstash ones, so either the
 * Vercel Marketplace integration or a direct Upstash database just works.
 *
 * If no store is configured it degrades gracefully: kvEnabled() is false and
 * every op is a safe no-op, so the app keeps running on client-side hunts.
 */

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export function kvEnabled(): boolean {
  return !!(REST_URL && REST_TOKEN);
}

async function command<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!kvEnabled()) return null;
  try {
    const r = await fetch(REST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { result?: T };
    return (data?.result ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const raw = await command<string>(["GET", key]);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJSON(key: string, value: unknown): Promise<void> {
  await command(["SET", key, JSON.stringify(value)]);
}
