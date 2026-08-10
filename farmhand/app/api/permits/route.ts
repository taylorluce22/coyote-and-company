import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import { getAdapter, ADAPTERS } from "@/lib/permits/adapters";
import { solarWithoutBattery } from "@/lib/permits/setDifference";
import { targetsToCsv } from "@/lib/permits/csv";
import {
  getMeta,
  getRecords,
  getTargets,
  mergeRecords,
  patchMeta,
  setTargets,
} from "@/lib/permits/store";

/**
 * Permit lead-gen — INGEST + FILTER stages. Everything is scoped to the
 * Farmhand client passed as `client` (isolation invariant: no client param
 * means the "default" bucket only, never a merged view).
 *
 * GET  /api/permits?client=x → { enabled, adapters, meta, records, targets }
 *                              state summary; `targets` is the current draft
 *                              list (no phone data lives at this layer).
 * POST /api/permits { action: "ingest", client, jurisdiction, maxRows? }
 *                            → { ok, fetched, added, total }
 *      POST { action: "filter", client, minAgeMonths?, maxAgeYears? }
 *                            → { ok, stats, targets }
 *      POST { action: "preview", jurisdiction, minAgeMonths?, maxAgeYears?, maxRows? }
 *                            → { ok, stats, targets, csv }  stateless one-shot
 *                              (live fetch -> filter, nothing stored) — works
 *                              without KV; used to prove an adapter live.
 * GET  /api/permits?client=x&format=csv → text/csv of the stored target list.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client") ?? "";
  if (!kvEnabled()) {
    return NextResponse.json({ enabled: false, adapters: Object.keys(ADAPTERS), meta: {}, records: 0, targets: [] });
  }
  const [meta, records, targets] = await Promise.all([
    getMeta(client),
    getRecords(client),
    getTargets(client),
  ]);
  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new Response(targetsToCsv(targets), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=permit-targets.csv",
      },
    });
  }
  return NextResponse.json({
    enabled: true,
    adapters: Object.keys(ADAPTERS),
    meta,
    records: records.length,
    targets,
  });
}

interface PermitsPostBody {
  action?: string;
  client?: string;
  jurisdiction?: string;
  maxRows?: number;
  minAgeMonths?: number;
  maxAgeYears?: number;
}

export async function POST(req: NextRequest) {
  let body: PermitsPostBody = {};
  try {
    body = await req.json();
  } catch {}
  const action = String(body.action ?? "");
  const client = String(body.client ?? "");
  const now = new Date().toISOString();

  if (action === "preview") {
    const adapter = getAdapter(String(body.jurisdiction ?? "mesa"));
    if (!adapter) return NextResponse.json({ ok: false, error: "unknown jurisdiction" });
    try {
      const records = await adapter.fetchPermits({ now, maxRows: num(body.maxRows, 20000, 100, 50000) });
      const { targets, stats } = solarWithoutBattery(records, {
        now,
        minAgeMonths: num(body.minAgeMonths, 6, 0, 120),
        maxAgeYears: num(body.maxAgeYears, 5, 1, 30),
      });
      return NextResponse.json({ ok: true, stats, targets: targets.slice(0, 200), csv: targetsToCsv(targets) });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err).slice(0, 300) });
    }
  }

  if (!kvEnabled()) return NextResponse.json({ ok: false, enabled: false });

  if (action === "ingest") {
    const adapter = getAdapter(String(body.jurisdiction ?? "mesa"));
    if (!adapter) return NextResponse.json({ ok: false, error: "unknown jurisdiction" });
    try {
      const fetched = await adapter.fetchPermits({ now, maxRows: num(body.maxRows, 20000, 100, 50000) });
      const { total, added } = await mergeRecords(client, fetched);
      const meta = await getMeta(client);
      await patchMeta(client, {
        lastIngestAt: now,
        lastIngestCounts: { ...meta.lastIngestCounts, [adapter.id]: fetched.length },
      });
      return NextResponse.json({ ok: true, fetched: fetched.length, added, total });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err).slice(0, 300) });
    }
  }

  if (action === "filter") {
    const records = await getRecords(client);
    if (!records.length) return NextResponse.json({ ok: false, error: "no ingested records — run ingest first" });
    const { targets, stats } = solarWithoutBattery(records, {
      now,
      minAgeMonths: num(body.minAgeMonths, 6, 0, 120),
      maxAgeYears: num(body.maxAgeYears, 5, 1, 30),
    });
    await setTargets(client, targets);
    await patchMeta(client, { lastFilterAt: now });
    return NextResponse.json({ ok: true, stats, targets: targets.slice(0, 200) });
  }

  return NextResponse.json({ ok: false, error: "unknown action" });
}
