import { NextRequest, NextResponse } from "next/server";
import { supabaseEnabled, sbSelect, sbInsert } from "@/lib/supabase";
import { computeMoney } from "@/lib/agencyMoney.mjs";

/**
 * Agency OS · Money layer (Sonoran Clinical Partners).
 *
 * GET  /api/agency/money → { configured, money, counts }
 *   Computes the MRR snapshot from real Supabase rows (agreements,
 *   meetings, collections; workspace 'agency'). Same graceful-degrade
 *   contract as /api/memory: no keys → { configured: false }.
 *
 * POST /api/agency/money { kind, row } → { ok }
 *   Records one row. kind: "agreement" | "meeting" | "collection".
 *   Server-side only (service_role); the browser never writes directly.
 */

export const dynamic = "force-dynamic";

const WS = "agency";

type MoneySnapshot = Record<string, unknown>;

async function loadRows() {
  const [agreements, meetings, collections] = await Promise.all([
    sbSelect("agency_agreements", `workspace=eq.${WS}&order=created_at.desc&limit=500`),
    sbSelect("agency_meetings", `workspace=eq.${WS}&order=held_on.desc&limit=2000`),
    sbSelect("agency_collections", `workspace=eq.${WS}&order=collected_on.desc&limit=5000`),
  ]);
  return { agreements, meetings, collections };
}

export async function GET() {
  if (!supabaseEnabled()) return NextResponse.json({ configured: false });
  const rows = await loadRows();
  const money = computeMoney(rows) as MoneySnapshot;
  return NextResponse.json({
    configured: true,
    money,
    counts: {
      agreements: rows.agreements.length,
      meetings: rows.meetings.length,
      collections: rows.collections.length,
    },
  });
}

const TABLES: Record<string, { table: string; required: string[] }> = {
  agreement: { table: "agency_agreements", required: ["supplier", "status", "commission_pct"] },
  meeting: { table: "agency_meetings", required: ["supplier", "buyer", "held_on"] },
  collection: { table: "agency_collections", required: ["supplier", "buyer", "amount", "collected_on"] },
};

export async function POST(req: NextRequest) {
  if (!supabaseEnabled()) return NextResponse.json({ ok: false, configured: false });
  let body: { kind?: string; row?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const spec = body.kind ? TABLES[body.kind] : undefined;
  if (!spec || !body.row) {
    return NextResponse.json({ ok: false, error: "kind must be agreement|meeting|collection, with row" }, { status: 400 });
  }
  const missing = spec.required.filter((k) => body.row![k] === undefined || body.row![k] === "");
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `missing: ${missing.join(", ")}` }, { status: 400 });
  }
  const ok = await sbInsert(spec.table, [{ workspace: WS, ...body.row }]);
  return NextResponse.json({ ok });
}
