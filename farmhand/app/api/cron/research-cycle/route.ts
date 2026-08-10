import { NextRequest, NextResponse } from "next/server";
import { memoryEnabled } from "@/lib/memory";
import { runWeeklyCycle } from "@/lib/researchLoop";

/**
 * The pre-launch research cycle. Vercel Cron fires this weekly (vercel.json):
 * Researcher sweep → Competitor Audit (biweekly, even ISO weeks) → CMO review
 * over the Content Queue → Data Analyst growth check → Orchestrator log.
 *
 * Guardrails (docs/prelaunch-research-activation-2026.md Step 3): every output
 * is a draft, a KB claim, or a log entry. Nothing posts, schedules, or
 * advances status — Taylor approves queue items one by one in the app.
 *
 * Same CRON_SECRET convention as /api/cron/hunt.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  if (!memoryEnabled()) {
    return NextResponse.json({ ok: false, reason: "shared memory layer not configured (Supabase env vars)" });
  }
  const result = await runWeeklyCycle();
  return NextResponse.json({ ok: true, ...result });
}
