import { NextResponse } from "next/server";
import { memoryEnabled, getAgentRuns } from "@/lib/memory";

/**
 * Latest run per agent — powers the last-run timestamps on the brain graph
 * (Agent Network cards + Knowledge Vault nodes). Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  if (!memoryEnabled()) return NextResponse.json({ configured: false, latest: {} });
  const runs = (await getAgentRuns(undefined, 100)) as Array<{
    agent?: string;
    summary?: string;
    created_at?: string;
  }>;
  const latest: Record<string, { at: string; summary: string }> = {};
  for (const r of runs) {
    const agent = String(r.agent || "").trim();
    const at = String(r.created_at || "");
    if (!agent || !at) continue;
    if (!latest[agent] || at > latest[agent].at) latest[agent] = { at, summary: String(r.summary || "").slice(0, 200) };
  }
  return NextResponse.json({ configured: true, latest });
}
