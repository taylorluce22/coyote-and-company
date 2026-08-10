import { NextRequest, NextResponse } from "next/server";
import { supabaseEnabled, sbSelect, sbInsert, sbUpdate } from "@/lib/supabase";
import { summarizeOutreach } from "@/lib/agencyOutreach.mjs";

/**
 * Agency OS · Outreach queue (Sonoran Clinical Partners).
 *
 * GET   /api/agency/outreach            → { configured, summary }
 * POST  /api/agency/outreach { rows }   → register drafts that already exist
 *                                          in Gmail (agent-side after drafting)
 * PATCH /api/agency/outreach { id, status } → queued|sent|replied|skipped
 *
 * This route does not send email and holds no mail credentials. Sending stays
 * in Taylor's hands in Gmail; the OS links to the draft and records the state.
 */

export const dynamic = "force-dynamic";

const WS = "agency";
const TABLE = "agency_outreach";
const STATUSES = new Set(["queued", "sent", "replied", "skipped"]);

export async function GET() {
  if (!supabaseEnabled()) return NextResponse.json({ configured: false });
  const rows = await sbSelect(TABLE, `workspace=eq.${WS}&order=drafted_on.desc&limit=2000`);
  return NextResponse.json({ configured: true, summary: summarizeOutreach(rows) });
}

export async function POST(req: NextRequest) {
  if (!supabaseEnabled()) return NextResponse.json({ ok: false, configured: false });
  let body: { rows?: Record<string, unknown>[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "rows required" }, { status: 400 });
  }
  // A queue row must point at a real Gmail draft — otherwise the screen would
  // offer a button that opens nothing.
  const bad = rows.find((r) => !r.facility || !r.email || !r.gmail_draft_id);
  if (bad) {
    return NextResponse.json(
      { ok: false, error: "each row needs facility, email, gmail_draft_id" },
      { status: 400 }
    );
  }
  const ok = await sbInsert(
    TABLE,
    rows.map((r) => ({ workspace: WS, ...r }))
  );
  return NextResponse.json({ ok, count: rows.length });
}

export async function PATCH(req: NextRequest) {
  if (!supabaseEnabled()) return NextResponse.json({ ok: false, configured: false });
  let body: { id?: string; status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const { id, status } = body;
  if (!id || !status || !STATUSES.has(status)) {
    return NextResponse.json(
      { ok: false, error: "id and status (queued|sent|replied|skipped) required" },
      { status: 400 }
    );
  }
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    // sent_on is set when it becomes sent and cleared if it's moved back
    sent_on: status === "sent" ? new Date().toISOString().slice(0, 10) : null,
  };
  const ok = await sbUpdate(TABLE, `workspace=eq.${WS}&id=eq.${encodeURIComponent(id)}`, patch);
  return NextResponse.json({ ok });
}
