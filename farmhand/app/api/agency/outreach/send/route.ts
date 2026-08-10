import { NextRequest, NextResponse } from "next/server";
import { supabaseEnabled, sbSelect, sbUpdate } from "@/lib/supabase";
import { gmailEnabled, sendDraft } from "@/lib/gmailSend";

/**
 * Agency OS · Send one queued draft.
 *
 * POST /api/agency/outreach/send { id }  → sends THAT row's Gmail draft.
 *
 * Deliberate design limits — these are the guardrails, not incidental:
 *   · one row per request, identified by its queue id. There is no
 *     send-all and no send-by-filter, so a stray call can't empty the queue.
 *   · only rows in status 'queued' send. A row already sent is a no-op,
 *     so a double-click or a retry can't send twice.
 *   · the draft is the payload — this route never composes or edits a body.
 *   · no cron, no agent path, no scheduled trigger calls this. It exists to
 *     serve a button a human just pressed.
 */

export const dynamic = "force-dynamic";

const WS = "agency";
const TABLE = "agency_outreach";

type Row = {
  id: string;
  facility: string;
  email: string;
  status: string;
  gmail_draft_id: string | null;
  data: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  if (!supabaseEnabled()) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 503 });
  if (!gmailEnabled()) {
    return NextResponse.json(
      { ok: false, error: "gmail not configured — see docs/gmail-send-setup.md" },
      { status: 503 }
    );
  }

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const rows = await sbSelect<Row>(
    TABLE,
    `workspace=eq.${WS}&id=eq.${encodeURIComponent(body.id)}&limit=1`
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "row not found" }, { status: 404 });

  if (row.status !== "queued") {
    // idempotent: already handled, nothing to do
    return NextResponse.json({ ok: false, error: `row is '${row.status}', not queued`, alreadyHandled: true });
  }
  if (!row.gmail_draft_id) {
    return NextResponse.json({ ok: false, error: "row has no gmail draft id" }, { status: 400 });
  }

  const result = await sendDraft(row.gmail_draft_id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, facility: row.facility });
  }

  await sbUpdate(TABLE, `workspace=eq.${WS}&id=eq.${encodeURIComponent(row.id)}`, {
    status: "sent",
    sent_on: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
    data: {
      ...(row.data || {}),
      sent_via: "agency-os",
      gmail_message_id: result.messageId,
      gmail_thread_id_after_send: result.threadId,
    },
  });

  return NextResponse.json({ ok: true, facility: row.facility, messageId: result.messageId });
}
