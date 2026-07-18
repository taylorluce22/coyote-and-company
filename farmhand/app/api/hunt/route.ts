import { NextRequest, NextResponse } from "next/server";
import { runHunt } from "@/lib/huntServer";

/**
 * Web-wide lead hunt (live, on-demand) — searches the ENTIRE web for real
 * people with buying / selling / relocation / investing intent in the agent's
 * territories, returned scored and ready for the inbox. Shares its brain with
 * the always-on cron job (see lib/huntServer + /api/cron/hunt).
 *
 * GET  /api/hunt   → { configured: boolean }
 * POST /api/hunt   { territories, profession, city, idealClient, intents,
 *                    guidance, good[], bad[], sinceDays } → { configured, leads }
 */

export async function GET() {
  return NextResponse.json({ configured: !!process.env.PERPLEXITY_API_KEY });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {}

  const result = await runHunt({
    territories: Array.isArray(body.territories) ? (body.territories as unknown[]).map(String) : [],
    vertical: body.vertical ? String(body.vertical) : undefined,
    deep: body.deep === true,
    profession: body.profession ? String(body.profession) : undefined,
    city: body.city ? String(body.city) : undefined,
    idealClient: body.idealClient ? String(body.idealClient) : undefined,
    intents: Array.isArray(body.intents) ? (body.intents as unknown[]).map(String) : undefined,
    guidance: body.guidance ? String(body.guidance) : undefined,
    good: Array.isArray(body.good) ? (body.good as unknown[]).map(String) : undefined,
    bad: Array.isArray(body.bad) ? (body.bad as unknown[]).map(String) : undefined,
    sinceDays: body.sinceDays != null ? Number(body.sinceDays) : undefined,
  });

  return NextResponse.json(result);
}
