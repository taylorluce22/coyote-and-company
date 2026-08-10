/**
 * Permit lead-gen store over the KV layer — client-scoped from day one.
 *
 * Client-isolation invariant: every key carries the sanitized client id
 * (fh:<client>:permits:*). Same sanitizer discipline as lib/memory.ts —
 * NEVER collapse clients into a single bucket, and never reuse the
 * single-tenant fh:default lead-store namespace.
 *
 * All mutating ops are upserts keyed by stable ids, so INGEST and FILTER
 * re-runs are idempotent. Callers inject `now` (libs stay pure).
 */

import { kvGetJSON, kvSetJSON } from "@/lib/kv";
import type { PermitRecord, TargetParcel } from "./types";

const MAX_RECORDS = 6000;

export function sanitizeClient(client?: string): string {
  return (
    (client || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 64) || "default"
  );
}

const ns = (client: string) => `fh:${sanitizeClient(client)}:permits`;

export interface PermitMeta {
  lastIngestAt?: string;
  lastIngestCounts?: Record<string, number>;
  lastFilterAt?: string;
}

export async function getRecords(client: string): Promise<PermitRecord[]> {
  return (await kvGetJSON<PermitRecord[]>(`${ns(client)}:records`)) ?? [];
}

/** Stable identity for a permit row — survives re-ingest even when the source has no permit number. */
function recordKey(r: PermitRecord): string {
  return `${r.jurisdiction}:${r.permitNumber || `${r.apn}:${r.description.slice(0, 40)}`}`;
}

export async function mergeRecords(
  client: string,
  fresh: PermitRecord[]
): Promise<{ total: number; added: number }> {
  const existing = await getRecords(client);
  const byKey = new Map(existing.map((r) => [recordKey(r), r]));
  let added = 0;
  for (const r of fresh) {
    const key = recordKey(r);
    if (!byKey.has(key)) added += 1;
    byKey.set(key, r); // re-ingest refreshes the stored copy (newer fetchedAt)
  }
  const merged = [...byKey.values()].slice(-MAX_RECORDS);
  await kvSetJSON(`${ns(client)}:records`, merged);
  return { total: merged.length, added };
}

export async function getTargets(client: string): Promise<TargetParcel[]> {
  return (await kvGetJSON<TargetParcel[]>(`${ns(client)}:targets`)) ?? [];
}

export async function setTargets(client: string, targets: TargetParcel[]): Promise<void> {
  await kvSetJSON(`${ns(client)}:targets`, targets);
}

export async function getMeta(client: string): Promise<PermitMeta> {
  return (await kvGetJSON<PermitMeta>(`${ns(client)}:meta`)) ?? {};
}

export async function patchMeta(client: string, patch: Partial<PermitMeta>): Promise<void> {
  const meta = await getMeta(client);
  await kvSetJSON(`${ns(client)}:meta`, { ...meta, ...patch });
}
