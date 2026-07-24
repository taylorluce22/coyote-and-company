/**
 * Shared Memory Layer — the typed domain API over Supabase (lib/supabase.ts).
 *
 * This is what the app's /api/memory route and (eventually) each agent call.
 * Every domain maps to one table. All reads return [] and all writes no-op
 * when Supabase isn't configured, so nothing here can break the app before the
 * project exists — it simply does nothing until the env vars land.
 *
 * Operator multi-client mode: each client is its own row-space in the shared
 * memory layer, keyed by the `workspace` column = the real client id. The id is
 * sanitized (safe charset, bounded length) but NEVER collapsed to a single
 * bucket — collapsing it would merge every client's records together.
 */

import { sbSelect, sbUpsert, sbInsert, sbDelete, sbEq, supabaseEnabled } from "./supabase";

export const memoryEnabled = supabaseEnabled;

export type Workspace = string;
/** Preserve the real client id; only sanitize to a safe, bounded key. */
const ws = (w?: string): Workspace => {
  const s = (w || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  return s || "default";
};

/* ---- agent_runs — the shared run log ------------------------------------ */

export interface AgentRun {
  agent: string;
  summary: string;
  needsHuman?: string;
  data?: Record<string, unknown>;
}

export async function logAgentRun(run: AgentRun, workspace?: string): Promise<boolean> {
  return sbInsert("agent_runs", [
    {
      workspace: ws(workspace),
      agent: run.agent,
      summary: run.summary,
      needs_human: run.needsHuman ?? null,
      data: run.data ?? {},
    },
  ]);
}

export async function getAgentRuns(workspace?: string, limit = 50) {
  return sbSelect("agent_runs", `${sbEq("workspace", ws(workspace))}&order=created_at.desc&limit=${limit}`);
}

/* ---- leads — server-hunted leads ---------------------------------------- */

interface LeadLike {
  key?: string;
  url?: string;
  score?: number;
  platform?: string;
  intent?: string;
  territory?: string;
}

export async function upsertLeads(leads: LeadLike[], workspace?: string): Promise<boolean> {
  // Collapse duplicate dedup_keys WITHIN this batch first. PostgREST's
  // merge-duplicates upsert compiles to a single INSERT … ON CONFLICT DO
  // UPDATE, and Postgres rejects the WHOLE request (SQLSTATE 21000) if the
  // payload names the same conflict target twice — which is the expected case
  // when a hunt re-cites one url across two searches. Keep the highest score.
  const byKey = new Map<string, Record<string, unknown>>();
  for (const l of leads) {
    const dedup = String(l.key || l.url || "").trim();
    if (!dedup) continue;
    const prev = byKey.get(dedup);
    const prevScore = typeof prev?.score === "number" ? (prev.score as number) : -1;
    const thisScore = typeof l.score === "number" ? l.score : -1;
    if (prev && thisScore < prevScore) continue; // keep the stronger existing one
    byKey.set(dedup, {
      workspace: ws(workspace),
      dedup_key: dedup,
      score: typeof l.score === "number" ? l.score : null,
      platform: l.platform ?? null,
      intent: l.intent ?? null,
      territory: l.territory ?? null,
      data: l,
    });
  }
  return sbUpsert("leads", [...byKey.values()], "workspace,dedup_key");
}

export async function getStoredLeads(workspace?: string, limit = 200) {
  const rows = await sbSelect<{ data: unknown }>(
    "leads",
    `${sbEq("workspace", ws(workspace))}&order=found_at.desc&limit=${limit}`
  );
  return rows.map((r) => r.data);
}

/* ---- generic app-record sync (contacts / opportunities / posts / reels) --
   Each of these is a client array keyed by an `id`. syncRecords upserts the
   whole array by (workspace, app_id); pullRecords returns the full records. -- */

interface Synced {
  table: string;
  flat: (rec: Record<string, unknown>) => Record<string, unknown>;
}

const DOMAINS: Record<string, Synced> = {
  contacts: {
    table: "contacts",
    flat: (r) => ({ name: r.name ?? null, stage: r.stage ?? null, warmth: r.warmth ?? null }),
  },
  opportunities: {
    table: "opportunities",
    flat: (r) => ({ status: r.status ?? null, territory: r.territory ?? null }),
  },
  plannedPosts: {
    table: "planned_posts",
    flat: (r) => ({ status: r.status ?? null, pillar: r.pillar ?? null }),
  },
  reels: {
    table: "reel_analyses",
    flat: (r) => ({ label: r.label ?? null, source: r.source ?? null }),
  },
};

export async function syncRecords(
  domain: keyof typeof DOMAINS,
  records: Record<string, unknown>[],
  workspace?: string
): Promise<boolean> {
  const d = DOMAINS[domain];
  if (!d) return false;
  const rows = records
    .map((r) => {
      const appId = String(r.id ?? "").trim();
      if (!appId) return null;
      return { workspace: ws(workspace), app_id: appId, ...d.flat(r), data: r };
    })
    .filter(Boolean);
  if (!rows.length) return true; // nothing to push is a success, not a failure
  return sbUpsert(d.table, rows, "workspace,app_id");
}

export async function pullRecords(domain: keyof typeof DOMAINS, workspace?: string, limit = 500) {
  const d = DOMAINS[domain];
  if (!d) return [];
  const rows = await sbSelect<{ data: unknown }>(d.table, `${sbEq("workspace", ws(workspace))}&limit=${limit}`);
  return rows.map((r) => r.data);
}

export async function deleteRecord(
  domain: keyof typeof DOMAINS,
  appId: string,
  workspace?: string
): Promise<boolean> {
  const d = DOMAINS[domain];
  if (!d || !appId) return false;
  return sbDelete(d.table, `${sbEq("workspace", ws(workspace))}&${sbEq("app_id", appId)}`);
}

/* ---- kb_refs — accuracy-gate source registry ---------------------------- */

export interface KbRef {
  claim: string;
  label?: string; // fact | projection | contested | industry-claim
  source?: string;
  url?: string;
  data?: Record<string, unknown>;
}

export async function addKbRefs(refs: KbRef[], workspace?: string): Promise<boolean> {
  const rows = refs
    .filter((r) => r.claim && r.claim.trim())
    .map((r) => ({
      workspace: ws(workspace),
      claim: r.claim,
      label: r.label ?? null,
      source: r.source ?? null,
      url: r.url ?? null,
      data: r.data ?? {},
    }));
  return sbInsert("kb_refs", rows);
}

export async function getKbRefs(workspace?: string, limit = 200) {
  return sbSelect("kb_refs", `${sbEq("workspace", ws(workspace))}&order=created_at.desc&limit=${limit}`);
}

/* ---- whole-workspace snapshot (the app's push/pull sync) ----------------- */

export interface WorkspaceSnapshot {
  contacts?: Record<string, unknown>[];
  opportunities?: Record<string, unknown>[];
  plannedPosts?: Record<string, unknown>[];
  reels?: Record<string, unknown>[];
}

/** Push the client's persisted arrays up (upsert — never deletes). */
export async function pushWorkspace(snapshot: WorkspaceSnapshot, workspace?: string): Promise<boolean> {
  const snap = snapshot as Record<string, unknown>;
  const results = await Promise.all(
    (Object.keys(DOMAINS) as (keyof typeof DOMAINS)[]).map((domain) => {
      const recs = snap[domain];
      return Array.isArray(recs) ? syncRecords(domain, recs as Record<string, unknown>[], workspace) : Promise.resolve(true);
    })
  );
  return results.every(Boolean);
}

/** Pull the full workspace snapshot back down. */
export async function pullWorkspace(workspace?: string): Promise<WorkspaceSnapshot> {
  const [contacts, opportunities, plannedPosts, reels] = await Promise.all([
    pullRecords("contacts", workspace),
    pullRecords("opportunities", workspace),
    pullRecords("plannedPosts", workspace),
    pullRecords("reels", workspace),
  ]);
  return {
    contacts: contacts as Record<string, unknown>[],
    opportunities: opportunities as Record<string, unknown>[],
    plannedPosts: plannedPosts as Record<string, unknown>[],
    reels: reels as Record<string, unknown>[],
  };
}
