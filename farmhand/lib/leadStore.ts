/**
 * Server-side lead store — the memory the always-on hunt writes to and the app
 * reads from. Single-namespace today (one agent); the keys are prefixed so a
 * per-user layer can slot in later without a migration.
 */

import { leadFingerprint, normalizeLeadUrl, type Lead } from "./hunt";
import type { HuntConfig } from "./huntServer";
import { kvEnabled, kvGetJSON, kvSetJSON } from "./kv";

const NS = "fh:default";
const CONFIG_KEY = `${NS}:huntConfig`;
const LEADS_KEY = `${NS}:leads`;
const META_KEY = `${NS}:huntMeta`;
const MAX_LEADS = 200;

export interface StoredLead extends Lead {
  key: string; // dedup key (normalized url)
  foundAt: number; // epoch ms when the scheduled job first saw it
}

export interface HuntMeta {
  lastRunAt: number;
  lastCount: number; // new leads added on the last run
  totalRuns: number;
}

export function leadKey(l: Lead): string {
  return normalizeLeadUrl(l.url);
}

export async function getConfig(): Promise<HuntConfig | null> {
  return kvGetJSON<HuntConfig>(CONFIG_KEY);
}

export async function setConfig(cfg: HuntConfig): Promise<void> {
  await kvSetJSON(CONFIG_KEY, cfg);
}

export async function getLeads(): Promise<StoredLead[]> {
  return (await kvGetJSON<StoredLead[]>(LEADS_KEY)) || [];
}

export async function getMeta(): Promise<HuntMeta | null> {
  return kvGetJSON<HuntMeta>(META_KEY);
}

/**
 * Merge freshly-hunted leads into the store, deduped by normalized url AND by
 * title fingerprint — Perplexity can re-cite the same real post under a
 * genuinely different URL form (a crosspost, a share-link wrapper) across
 * separate scheduled runs, and a URL-only check misses that. Newest first,
 * capped. Returns how many were genuinely new. `now` is passed in so callers
 * control the clock (routes have Date; libs stay pure).
 */
export async function mergeLeads(fresh: Lead[], now: number): Promise<number> {
  if (!kvEnabled()) return 0;
  const existing = await getLeads();
  const haveUrl = new Set(existing.map((l) => l.key));
  const haveTitle = new Set(existing.map((l) => leadFingerprint(l)));
  const added: StoredLead[] = [];
  for (const l of fresh) {
    const key = leadKey(l);
    const titleKey = leadFingerprint(l);
    if (!key || haveUrl.has(key) || haveTitle.has(titleKey)) continue;
    haveUrl.add(key);
    haveTitle.add(titleKey);
    added.push({ ...l, key, foundAt: now });
  }
  if (added.length) {
    const next = [...added, ...existing].slice(0, MAX_LEADS);
    await kvSetJSON(LEADS_KEY, next);
  }
  const meta = (await getMeta()) || { lastRunAt: 0, lastCount: 0, totalRuns: 0 };
  await kvSetJSON(META_KEY, { lastRunAt: now, lastCount: added.length, totalRuns: meta.totalRuns + 1 });
  return added.length;
}
