import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import { getAdapter, ADAPTERS } from "@/lib/permits/adapters";
import { solarWithoutBattery } from "@/lib/permits/setDifference";
import { computeAttachRateByYear, checkAttachRateShape } from "@/lib/permits/attachRate";
import { targetsToCsv } from "@/lib/permits/csv";
import {
  getLeads,
  getMeta,
  getRecords,
  getTargets,
  mergeRecords,
  patchMeta,
  setTargets,
  upsertLeads,
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
        minAgeMonths: num(body.minAgeMonths, 24, 0, 120),
        maxAgeYears: num(body.maxAgeYears, 20, 1, 30),
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
      const { total, added, truncated } = await mergeRecords(client, fetched);
      const meta = await getMeta(client);
      await patchMeta(client, {
        lastIngestAt: now,
        lastIngestCounts: { ...meta.lastIngestCounts, [adapter.id]: fetched.length },
      });
      return NextResponse.json({
        ok: true,
        fetched: fetched.length,
        added,
        total,
        truncated,
        // Dropped records can remove the battery permit that disqualifies a
        // parcel, so this surfaces rather than sitting in the store unseen.
        ...(truncated ? { warning: `${truncated} oldest permit records dropped at the storage cap — target list may contain false positives` } : {}),
      });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err).slice(0, 300) });
    }
  }

  if (action === "filter") {
    const records = await getRecords(client);
    if (!records.length) return NextResponse.json({ ok: false, error: "no ingested records — run ingest first" });
    const { targets, stats } = solarWithoutBattery(records, {
      now,
      minAgeMonths: num(body.minAgeMonths, 24, 0, 120),
      maxAgeYears: num(body.maxAgeYears, 20, 1, 30),
    });
    await setTargets(client, targets);
    await patchMeta(client, { lastFilterAt: now });

    // Standing data-quality check. Battery attach rate by install year has a
    // verified shape (near-zero before 2024, >50% by 2025) confirmed
    // independently in two cities by two unrelated detection methods. A city
    // whose curve departs from it has almost certainly broken its battery
    // detection rather than found a different market — and broken detection is
    // silent, so it gets checked on every run.
    const byJurisdiction = new Map<string, typeof records>();
    for (const rec of records) {
      const list = byJurisdiction.get(rec.jurisdiction) ?? [];
      list.push(rec);
      byJurisdiction.set(rec.jurisdiction, list);
    }
    const attachRates: Record<string, unknown> = {};
    const dataQualityWarnings: string[] = [];
    for (const [jurisdiction, recs] of byJurisdiction) {
      const rates = computeAttachRateByYear(recs);
      attachRates[jurisdiction] = rates;
      for (const w of checkAttachRateShape(jurisdiction, rates)) dataQualityWarnings.push(w.message);
    }

    // Reconcile existing leads against the new target set. A parcel that just
    // dropped out — because its battery permit finally landed in the ingest —
    // must stop being callable, and a parcel that came back must become
    // callable again. Leads are retired, never deleted: the row carries
    // opt-out and scrub history that has to outlive the target list.
    const leads = await getLeads(client);
    if (leads.length) {
      const targetApns = new Set(targets.map((t) => t.apn));
      const changed = leads
        .filter((l) => !!l.retired !== !targetApns.has(l.apn))
        .map((l) => ({ ...l, retired: !targetApns.has(l.apn), updatedAt: now }));
      if (changed.length) await upsertLeads(client, changed);
      return NextResponse.json({
        ok: true,
        stats,
        targets: targets.slice(0, 200),
        leadsRetired: changed.filter((l) => l.retired).length,
        leadsRestored: changed.filter((l) => !l.retired).length,
        attachRates,
        dataQualityWarnings,
      });
    }
    return NextResponse.json({ ok: true, stats, targets: targets.slice(0, 200), attachRates, dataQualityWarnings });
  }

  return NextResponse.json({ ok: false, error: "unknown action" });
}
