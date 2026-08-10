import { NextRequest, NextResponse } from "next/server";
import { memoryEnabled } from "@/lib/memory";
import { ingestPostMetrics } from "@/lib/researchLoop";

/**
 * Data Analyst — per-post engagement ingest.
 * POST /api/metrics { appId, metrics: { views, likes, comments, saves, shares, follows } }
 * Merges the numbers into the planned-post record and logs the capture to the
 * shared run log, so Growth Strategy has real data from post #1.
 * Numbers come from Taylor reading the IG insights screen — never estimated.
 */

export const dynamic = "force-dynamic";

const NUMERIC = ["views", "likes", "comments", "saves", "shares", "follows", "reach", "profileVisits"];

export async function POST(req: NextRequest) {
  if (!memoryEnabled()) return NextResponse.json({ ok: false, reason: "memory layer not configured" });
  let body: { appId?: string; metrics?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const appId = String(body.appId || "").trim();
  if (!appId || !body.metrics) {
    return NextResponse.json({ ok: false, error: "appId and metrics required" }, { status: 400 });
  }
  const metrics: Record<string, number> = {};
  for (const k of NUMERIC) {
    const v = body.metrics[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) metrics[k] = v;
  }
  if (!Object.keys(metrics).length) {
    return NextResponse.json({ ok: false, error: `no valid numeric metrics (accepted: ${NUMERIC.join(", ")})` }, { status: 400 });
  }
  const res = await ingestPostMetrics(appId, metrics);
  return NextResponse.json(res, { status: res.ok ? 200 : 404 });
}
