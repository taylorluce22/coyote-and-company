import { NextRequest, NextResponse, after } from "next/server";
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

export const maxDuration = 300;
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
  // The full cycle exceeds the 60s edge-response window (verified live:
  // first run 504'd at the edge while completing fine underneath). Respond
  // immediately and run the cycle in after() — the orchestrator's agent_runs
  // row is the completion record. ?sync=1 keeps the old awaited behavior for
  // manual debugging where the JSON result is wanted.
  if (req.nextUrl.searchParams.get("sync") === "1") {
    const result = await runWeeklyCycle();
    return NextResponse.json({ ok: true, ...result });
  }
  after(async () => {
    try {
      await runWeeklyCycle();
    } catch (e) {
      console.error("research-cycle failed:", e);
    }
  });
  return NextResponse.json(
    { ok: true, accepted: true, note: "cycle running; completion logged to agent_runs (orchestrator row)" },
    { status: 202 }
  );
}
