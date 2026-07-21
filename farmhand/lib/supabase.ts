/**
 * Supabase access layer — the shared memory layer's low-level client.
 *
 * Follows the same philosophy as lib/kv.ts: plain fetch against the REST API
 * (PostgREST), no SDK, works in any serverless runtime. Server-side only — it
 * uses the service_role key, which bypasses RLS, so this file must never be
 * imported into client components.
 *
 * If no project is configured it degrades gracefully: supabaseEnabled() is
 * false and every op is a safe no-op / empty read, so the whole app keeps
 * running on localStorage + KV exactly as it does today. The moment the three
 * env vars land in Vercel, every call below starts persisting for real — no
 * other code change needed.
 *
 * Env:
 *   SUPABASE_URL           https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE  service_role key (SECRET — full access)
 *   SUPABASE_ANON_KEY      anon key (fallback only; can't bypass RLS)
 */

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
// prefer the service_role key (bypasses RLS for server writes); fall back to
// anon so a read-only setup still probes as configured
const KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || "";

export function supabaseEnabled(): boolean {
  return !!(URL_BASE && KEY);
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

const restUrl = (table: string) => `${URL_BASE}/rest/v1/${table}`;

/**
 * SELECT rows. `query` is a raw PostgREST query string, e.g.
 *   "workspace=eq.solar&order=created_at.desc&limit=50"
 * Returns [] on any failure or when Supabase isn't configured.
 */
export async function sbSelect<T = Record<string, unknown>>(
  table: string,
  query = ""
): Promise<T[]> {
  if (!supabaseEnabled()) return [];
  try {
    const r = await fetch(`${restUrl(table)}${query ? `?${query}` : ""}`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    return (await r.json()) as T[];
  } catch {
    return [];
  }
}

/**
 * INSERT rows. Returns true on success (2xx). No-op → false when not configured.
 */
export async function sbInsert(table: string, rows: unknown[]): Promise<boolean> {
  if (!supabaseEnabled() || !rows.length) return false;
  try {
    const r = await fetch(restUrl(table), {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * UPSERT rows on a unique constraint. `onConflict` is the comma-separated
 * column list of the unique/PK target, e.g. "workspace,app_id". Existing rows
 * are merged (updated); new ones inserted. Returns true on success.
 */
export async function sbUpsert(
  table: string,
  rows: unknown[],
  onConflict: string
): Promise<boolean> {
  if (!supabaseEnabled() || !rows.length) return false;
  try {
    const r = await fetch(`${restUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * DELETE rows matching a PostgREST filter, e.g. "workspace=eq.solar&app_id=eq.x".
 * A filter is REQUIRED — an empty filter is refused so we can never wipe a table.
 */
export async function sbDelete(table: string, filter: string): Promise<boolean> {
  if (!supabaseEnabled() || !filter) return false;
  try {
    const r = await fetch(`${restUrl(table)}?${filter}`, {
      method: "DELETE",
      headers: headers({ Prefer: "return=minimal" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** PostgREST value-escaping for a filter's right-hand side (eq.<value>). */
export function sbEq(column: string, value: string): string {
  return `${column}=eq.${encodeURIComponent(value)}`;
}
