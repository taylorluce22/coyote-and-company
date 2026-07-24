/**
 * Generation cost & usage metering (E4) — image/reel/copy generation costs real
 * money per unit, so every generation is logged per client and capped. This is
 * the margin guardrail: without it, one runaway batch silently destroys the
 * gross margin the whole service model depends on.
 *
 * Client-side ledger (localStorage, namespaced per client) — matches the plan's
 * "per-client counter" scope; a server-authoritative meter is E7-era. The unit
 * costs are Farmhand-internal estimates in cents, centralized so a provider
 * price change is a one-line edit and never leaks native credits into the UI.
 */

export type GenKind = "image" | "reel" | "copy";

/** Farmhand-internal blended cost estimate per unit, in cents. Tune as real
    provider costs get measured (Week 1 of the plan). */
export const UNIT_COST_CENTS: Record<GenKind, number> = { image: 12, reel: 60, copy: 1 };

/** Default monthly image allowance per client (Territory tier = 60 images). */
export const DEFAULT_IMAGE_CAP = 60;

interface GenEvent { ts: number; k: GenKind; n: number }

const LEDGER_KEY = (client: string) => `farmhand-meter::${client}`;
const CAP_KEY = (client: string) => `farmhand-meter-cap::${client}`;
const MAX_EVENTS = 4000;

function read(client: string): GenEvent[] {
  try { const raw = localStorage.getItem(LEDGER_KEY(client)); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

/** Record a generation against a client's ledger. Call once per unit produced. */
export function record(client: string, kind: GenKind, n = 1): void {
  if (!client || n <= 0) return;
  try {
    const list = read(client);
    list.push({ ts: Date.now(), k: kind, n });
    localStorage.setItem(LEDGER_KEY(client), JSON.stringify(list.slice(-MAX_EVENTS)));
  } catch {}
}

function monthKey(ts: number): string { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}`; }

export interface MonthUsage { image: number; reel: number; copy: number; costCents: number }

/** Totals for a client in a given month (defaults to the current month). */
export function monthUsage(client: string, at: number = Date.now()): MonthUsage {
  const mk = monthKey(at);
  const u: MonthUsage = { image: 0, reel: 0, copy: 0, costCents: 0 };
  for (const e of read(client)) {
    if (monthKey(e.ts) !== mk) continue;
    u[e.k] += e.n;
    u.costCents += (UNIT_COST_CENTS[e.k] || 0) * e.n;
  }
  return u;
}

export function imageCap(client: string): number {
  try { const raw = localStorage.getItem(CAP_KEY(client)); const n = raw ? parseInt(raw, 10) : NaN; return Number.isFinite(n) && n >= 0 ? n : DEFAULT_IMAGE_CAP; } catch { return DEFAULT_IMAGE_CAP; }
}

export function setImageCap(client: string, cap: number): void {
  try { localStorage.setItem(CAP_KEY(client), String(Math.max(0, Math.floor(cap)))); } catch {}
}

export interface AllowanceState { used: number; cap: number; pct: number; blocked: boolean; warn: boolean; remaining: number }

/** Where a client stands against its monthly image allowance. `blocked` at 100%,
    `warn` at 80% (E4-2). `need` is how many the next action wants to generate. */
export function imageAllowance(client: string, need = 0): AllowanceState {
  const used = monthUsage(client).image;
  const cap = imageCap(client);
  const pct = cap > 0 ? used / cap : 0;
  const remaining = Math.max(0, cap - used);
  return { used, cap, pct, remaining, warn: pct >= 0.8 && pct < 1, blocked: used + need > cap };
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ——— ledger portability (client bundle export/import + purge) ———

export interface MeterExport { ledger: unknown; cap: string | null }

/** Snapshot a client's meter ledger + cap for a bundle. */
export function exportMeter(client: string): MeterExport {
  let ledger: unknown = null;
  let cap: string | null = null;
  try { ledger = JSON.parse(localStorage.getItem(LEDGER_KEY(client)) || "null"); } catch {}
  try { cap = localStorage.getItem(CAP_KEY(client)); } catch {}
  return { ledger, cap };
}

/** Restore a meter ledger + cap into a client (used on bundle import). */
export function importMeter(client: string, data?: MeterExport): void {
  if (!data) return;
  try { if (Array.isArray(data.ledger)) localStorage.setItem(LEDGER_KEY(client), JSON.stringify(data.ledger)); } catch {}
  try { if (data.cap != null) localStorage.setItem(CAP_KEY(client), data.cap); } catch {}
}

/** Remove a client's meter ledger + cap (when the client is purged). */
export function purgeMeter(client: string): void {
  try { localStorage.removeItem(LEDGER_KEY(client)); localStorage.removeItem(CAP_KEY(client)); } catch {}
}
