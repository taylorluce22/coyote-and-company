import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import { getConfig, getLeads, getMeta, setConfig } from "@/lib/leadStore";
import type { HuntConfig } from "@/lib/huntServer";

/**
 * The bridge between the app and the always-on hunt store.
 *
 * GET  /api/leads   → { enabled, leads, meta, hasConfig }
 *                     the app pulls what the scheduled job found while it was
 *                     closed and merges it into the inbox.
 * POST /api/leads   { config }  → { ok }
 *                     the app pushes the agent's current territories + training
 *                     up so the cron job hunts with the latest instructions.
 */

export async function GET() {
  if (!kvEnabled()) return NextResponse.json({ enabled: false, leads: [], meta: null, hasConfig: false });
  const [leads, meta, config] = await Promise.all([getLeads(), getMeta(), getConfig()]);
  return NextResponse.json({ enabled: true, leads, meta, hasConfig: !!config });
}

export async function POST(req: NextRequest) {
  if (!kvEnabled()) return NextResponse.json({ ok: false, enabled: false });
  let body: { config?: Partial<HuntConfig> } = {};
  try {
    body = await req.json();
  } catch {}
  const c = body.config || {};
  const territories = Array.isArray(c.territories) ? c.territories.map(String).filter(Boolean).slice(0, 6) : [];
  if (!territories.length) return NextResponse.json({ ok: false, error: "no territories" });

  const config: HuntConfig = {
    territories,
    vertical: c.vertical ? String(c.vertical) : "realtor",
    profession: c.profession ? String(c.profession) : undefined,
    city: c.city ? String(c.city) : "Arizona",
    idealClient: c.idealClient ? String(c.idealClient) : "both",
    intents: Array.isArray(c.intents) ? c.intents.map(String).slice(0, 6) : undefined,
    guidance: c.guidance ? String(c.guidance).slice(0, 800) : "",
    good: Array.isArray(c.good) ? c.good.map(String).slice(0, 6) : [],
    bad: Array.isArray(c.bad) ? c.bad.map(String).slice(0, 6) : [],
    sinceDays: c.sinceDays != null ? Number(c.sinceDays) : 45,
  };
  await setConfig(config);
  return NextResponse.json({ ok: true });
}
