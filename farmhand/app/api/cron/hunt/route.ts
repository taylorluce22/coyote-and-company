import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import { getConfig, mergeLeads } from "@/lib/leadStore";
import { runHunt } from "@/lib/huntServer";

/**
 * The always-on hunt. Vercel Cron calls this on a schedule (see vercel.json)
 * so leads are found around the clock — even with the app and laptop closed.
 * It reads the agent's stored config (territories + training the app synced
 * up), hunts the whole web, and merges new leads into the store for the app to
 * pick up next time it opens.
 *
 * Secured by CRON_SECRET when set: Vercel sends it as a Bearer token on cron
 * invocations. If unset, we still run (so it works out of the box) but setting
 * it is recommended to stop anyone from triggering the endpoint.
 */

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  if (!kvEnabled()) {
    return NextResponse.json({ ok: false, reason: "no lead store configured (set KV/Upstash env vars)" });
  }

  const config = await getConfig();
  if (!config?.territories?.length) {
    return NextResponse.json({ ok: true, ran: false, reason: "no hunt config yet — open the app once to sync it up" });
  }

  const result = await runHunt(config);
  if (!result.configured) {
    return NextResponse.json({ ok: false, reason: "PERPLEXITY_API_KEY not set" });
  }
  const added = await mergeLeads(result.leads, Date.now());
  return NextResponse.json({ ok: true, ran: true, found: result.leads.length, added, error: result.error });
}
