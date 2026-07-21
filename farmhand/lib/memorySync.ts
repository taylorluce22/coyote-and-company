"use client";

/**
 * Client side of the Shared Memory Layer. Talks to /api/memory (which talks to
 * Supabase). Every function is safe when Supabase isn't configured: the status
 * check caches false and pull/push become no-ops, so the app behaves exactly as
 * it does on localStorage today. The instant the env vars land, sync turns on.
 *
 * Sync model (deliberately conservative for a first wiring):
 *  • pull merges cloud records the local device hasn't seen (by id) — LOCAL
 *    ALWAYS WINS on conflict, so nothing the user did in this tab is clobbered
 *    by an older cloud copy.
 *  • push upserts the local arrays up, so the cloud always trails the newest
 *    local state. Debounced by the store.
 */

export interface SyncSnapshot {
  contacts?: unknown[];
  opportunities?: unknown[];
  plannedPosts?: unknown[];
}

let configuredCache: boolean | null = null;

/** Is the shared memory layer live? Cached after the first probe. */
export async function memoryConfigured(): Promise<boolean> {
  if (configuredCache !== null) return configuredCache;
  try {
    const r = await fetch("/api/memory", { cache: "no-store" });
    const j = await r.json();
    configuredCache = !!j.configured;
  } catch {
    configuredCache = false;
  }
  return configuredCache;
}

export async function pullSnapshot(workspace: string): Promise<SyncSnapshot | null> {
  try {
    const r = await fetch(`/api/memory?workspace=${encodeURIComponent(workspace)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.configured || !j.snapshot) return null;
    return j.snapshot as SyncSnapshot;
  } catch {
    return null;
  }
}

export async function pushSnapshot(workspace: string, snapshot: SyncSnapshot): Promise<void> {
  try {
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, snapshot }),
      keepalive: true,
    });
  } catch {}
}

/**
 * Merge cloud records into local by `id` — local wins on conflict. Cloud only
 * fills in records this device has never seen. Order: local first, then extras.
 */
export function mergeById<T extends { id?: string }>(local: T[], cloud: T[]): T[] {
  const have = new Set(local.map((r) => r && r.id).filter(Boolean));
  const extra = cloud.filter((r) => r && r.id && !have.has(r.id));
  return extra.length ? [...local, ...extra] : local;
}
