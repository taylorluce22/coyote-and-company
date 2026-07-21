import { NextRequest, NextResponse } from "next/server";
import { memoryEnabled, pullWorkspace, pushWorkspace, logAgentRun, type WorkspaceSnapshot } from "@/lib/memory";

/**
 * The Shared Memory Layer bridge (Supabase).
 *
 * GET  /api/memory                 → { configured }              status probe (Connectors screen)
 * GET  /api/memory?workspace=solar → { configured, snapshot }    pull the workspace's records
 * POST /api/memory { workspace, snapshot } → { ok }              push (upsert) the workspace's records
 * POST /api/memory { workspace, run }      → { ok }              append one agent run to the shared log
 *
 * Everything degrades gracefully: if Supabase isn't configured, GET returns
 * { configured: false } and POST is a no-op, so the app runs on localStorage
 * exactly as before. The moment the env vars land it starts persisting.
 */

export const dynamic = "force-dynamic";

const clean = (w: unknown): "default" | "solar" => (w === "default" ? "default" : "solar");

export async function GET(req: NextRequest) {
  const configured = memoryEnabled();
  const wsParam = req.nextUrl.searchParams.get("workspace");
  if (!configured || !wsParam) return NextResponse.json({ configured });
  const snapshot = await pullWorkspace(clean(wsParam));
  return NextResponse.json({ configured, snapshot });
}

export async function POST(req: NextRequest) {
  if (!memoryEnabled()) return NextResponse.json({ ok: false, configured: false });

  let body: { workspace?: string; snapshot?: WorkspaceSnapshot; run?: { agent?: string; summary?: string; needsHuman?: string; data?: Record<string, unknown> } } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const workspace = clean(body.workspace);

  // append one agent run to the shared log
  if (body.run && body.run.agent && body.run.summary) {
    const ok = await logAgentRun(
      { agent: String(body.run.agent), summary: String(body.run.summary), needsHuman: body.run.needsHuman, data: body.run.data },
      workspace
    );
    return NextResponse.json({ ok });
  }

  // push a workspace snapshot (upsert)
  if (body.snapshot && typeof body.snapshot === "object") {
    const ok = await pushWorkspace(body.snapshot, workspace);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ ok: false, error: "nothing to do" }, { status: 400 });
}
