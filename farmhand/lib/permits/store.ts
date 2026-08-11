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
import type { EnrichedLead, PermitRecord, TargetParcel } from "./types";
import {
  defaultComplianceState,
  type ComplianceLogEntry,
  type ComplianceState,
  type InternalDncEntry,
} from "./comply";

/**
 * Runaway backstop, not a working limit. Truncating permit records is not a
 * neutral space saving: drop a parcel's BATTERY permit while its solar permit
 * survives and the set-difference promotes that parcel to a target — a
 * battery-equipped home on the call list. Mesa alone contributes roughly 3k
 * rows and Tempe and Scottsdale are queued, so this sits far above real
 * volume, and hitting it is reported rather than absorbed.
 */
const MAX_RECORDS = 60000;

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
): Promise<{ total: number; added: number; truncated: number }> {
  const existing = await getRecords(client);
  const byKey = new Map(existing.map((r) => [recordKey(r), r]));
  let added = 0;
  for (const r of fresh) {
    const key = recordKey(r);
    if (!byKey.has(key)) added += 1;
    byKey.set(key, r); // re-ingest refreshes the stored copy (newer fetchedAt)
  }
  const all = [...byKey.values()];
  const truncated = Math.max(0, all.length - MAX_RECORDS);
  const merged = truncated ? all.slice(-MAX_RECORDS) : all;
  await kvSetJSON(`${ns(client)}:records`, merged);
  return { total: merged.length, added, truncated };
}

export async function getTargets(client: string): Promise<TargetParcel[]> {
  return (await kvGetJSON<TargetParcel[]>(`${ns(client)}:targets`)) ?? [];
}

export async function setTargets(client: string, targets: TargetParcel[]): Promise<void> {
  await kvSetJSON(`${ns(client)}:targets`, targets);
}

export async function getLeads(client: string): Promise<EnrichedLead[]> {
  return (await kvGetJSON<EnrichedLead[]>(`${ns(client)}:leads`)) ?? [];
}

/**
 * Upsert by APN. The incoming object is authoritative for exactly the keys it
 * carries; keys it omits keep their stored value, so a re-seed (which sends
 * only parcel fields) never disturbs enrichment.
 *
 * The merge is a plain spread on purpose. An earlier version pinned each
 * sensitive field with `lead.dnc ?? prev.dnc`, which made the fields
 * impossible to clear: replacing a lead's phone number left the previous
 * number's scrub result attached, so a number that was never scrubbed carried
 * the old number's "clear" verdict and receipt as its compliance evidence.
 * Passing `dnc: undefined` explicitly now clears it.
 */
export async function upsertLeads(client: string, fresh: EnrichedLead[]): Promise<number> {
  const existing = await getLeads(client);
  const byApn = new Map(existing.map((l) => [l.apn, l]));
  for (const lead of fresh) {
    const prev = byApn.get(lead.apn);
    byApn.set(lead.apn, prev ? { ...prev, ...lead } : lead);
  }
  const merged = [...byApn.values()];
  await kvSetJSON(`${ns(client)}:leads`, merged);
  return merged.length;
}

export async function getComplianceState(client: string): Promise<ComplianceState> {
  return (await kvGetJSON<ComplianceState>(`${ns(client)}:comply`)) ?? defaultComplianceState();
}

export async function setComplianceState(client: string, state: ComplianceState): Promise<void> {
  await kvSetJSON(`${ns(client)}:comply`, state);
}

/**
 * Append-only compliance log — call log, scrub receipts, opt-outs, vendor
 * licenses, gate changes. Retention requirement is 5+ years.
 *
 * Known limitation, deliberately left visible rather than papered over: this
 * stores the whole log as one KV value and rewrites it on every append, so at
 * genuine retention scale the write outgrows the KV timeout. The cap below is
 * a runaway backstop far above manual-dialing volume, and reaching it is
 * reported to the caller instead of silently discarding the oldest entries —
 * which would drop exactly the records still inside the retention window. A
 * durable append-only store is required before dialing is enabled; see the
 * open items in docs/lead-gen-permit-system-2026.md.
 */
const MAX_LOG_ENTRIES = 50000;

export async function appendComplianceLog(
  client: string,
  entry: ComplianceLogEntry
): Promise<{ ok: boolean; atCap: boolean }> {
  const log = (await kvGetJSON<ComplianceLogEntry[]>(`${ns(client)}:log`)) ?? [];
  if (log.length >= MAX_LOG_ENTRIES) return { ok: false, atCap: true };
  log.push(entry);
  await kvSetJSON(`${ns(client)}:log`, log);
  return { ok: true, atCap: false };
}

export async function getComplianceLog(client: string): Promise<ComplianceLogEntry[]> {
  return (await kvGetJSON<ComplianceLogEntry[]>(`${ns(client)}:log`)) ?? [];
}

/** Internal do-not-call list — honored instantly, retained 10 years, never auto-pruned. */
export async function getInternalDnc(client: string): Promise<InternalDncEntry[]> {
  return (await kvGetJSON<InternalDncEntry[]>(`${ns(client)}:idnc`)) ?? [];
}

export async function addInternalDnc(client: string, entry: InternalDncEntry): Promise<void> {
  const list = await getInternalDnc(client);
  if (!list.some((e) => e.number === entry.number)) {
    list.push(entry);
    await kvSetJSON(`${ns(client)}:idnc`, list);
  }
}

export async function getMeta(client: string): Promise<PermitMeta> {
  return (await kvGetJSON<PermitMeta>(`${ns(client)}:meta`)) ?? {};
}

export async function patchMeta(client: string, patch: Partial<PermitMeta>): Promise<void> {
  const meta = await getMeta(client);
  await kvSetJSON(`${ns(client)}:meta`, { ...meta, ...patch });
}
