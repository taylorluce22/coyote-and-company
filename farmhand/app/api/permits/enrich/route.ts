import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import { maricopaEnabled, fetchOwner } from "@/lib/permits/enrich/maricopa";
import { getPhoneProvider, PHONE_PROVIDERS } from "@/lib/permits/enrich/phoneAppend";
import { getLeads, getTargets, upsertLeads } from "@/lib/permits/store";
import type { EnrichedLead, LineType } from "@/lib/permits/types";

/**
 * ENRICH stage: target parcels -> owner (Maricopa Assessor) -> phone
 * (pluggable append). Client-scoped like everything else in the module.
 * Phone numbers live here and in COMPLY only — never in the FILTER layer.
 *
 * GET  /api/permits/enrich → { enabled, maricopa, providers } capability probe
 * POST { action: "seed", client }
 *        stored targets -> lead rows (idempotent; existing enrichment kept)
 * POST { action: "owners", client, limit? }
 *        fills missing owners from the assessor, sequentially, small batches
 * POST { action: "phones", client, provider, limit? }
 *        fills missing phones for owner-bearing leads via the append provider
 * POST { action: "setPhone", client, apn, number, lineType }
 *        manual hand-sourced number, provenance source "manual"
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({
    enabled: kvEnabled(),
    maricopa: maricopaEnabled(),
    providers: Object.fromEntries(
      Object.values(PHONE_PROVIDERS).map((p) => [p.id, { label: p.label, configured: p.configured() }])
    ),
  });
}

interface EnrichPostBody {
  action?: string;
  client?: string;
  limit?: number;
  provider?: string;
  apn?: string;
  number?: string;
  lineType?: string;
}

const LINE_TYPES: LineType[] = ["wireless", "landline", "voip", "unknown"];

export async function POST(req: NextRequest) {
  if (!kvEnabled()) return NextResponse.json({ ok: false, enabled: false });
  let body: EnrichPostBody = {};
  try {
    body = await req.json();
  } catch {}
  const action = String(body.action ?? "");
  const client = String(body.client ?? "");
  const limit = Math.min(100, Math.max(1, Number(body.limit) || 25));
  const now = new Date().toISOString();

  if (action === "seed") {
    const targets = await getTargets(client);
    if (!targets.length) return NextResponse.json({ ok: false, error: "no targets — run filter first" });
    const leads: EnrichedLead[] = targets.map((t) => ({
      apn: t.apn,
      jurisdiction: t.jurisdiction,
      address: t.address,
      newestSolarIssuedAt: t.newestSolarIssuedAt,
      updatedAt: now,
    }));
    const total = await upsertLeads(client, leads);
    return NextResponse.json({ ok: true, seeded: leads.length, total });
  }

  if (action === "owners") {
    if (!maricopaEnabled()) return NextResponse.json({ ok: false, error: "MARICOPA_ASSESSOR_TOKEN not set" });
    const leads = await getLeads(client);
    const missing = leads.filter((l) => !l.owner).slice(0, limit);
    let found = 0;
    const updated: EnrichedLead[] = [];
    for (const lead of missing) {
      const owner = await fetchOwner(lead.apn, lead.address, { now });
      if (owner) {
        found += 1;
        updated.push({ ...lead, owner, updatedAt: now });
      }
    }
    if (updated.length) await upsertLeads(client, updated);
    return NextResponse.json({ ok: true, attempted: missing.length, found, remaining: leads.filter((l) => !l.owner).length - found });
  }

  if (action === "phones") {
    const provider = getPhoneProvider(String(body.provider ?? "datazapp"));
    if (!provider) return NextResponse.json({ ok: false, error: "unknown provider" });
    if (!provider.configured()) return NextResponse.json({ ok: false, error: `${provider.id} not configured` });
    const leads = await getLeads(client);
    const batch = leads.filter((l) => l.owner && !l.phone).slice(0, limit);
    if (!batch.length) return NextResponse.json({ ok: true, attempted: 0, found: 0 });
    try {
      const matches = await provider.append(
        batch.map((l) => ({
          apn: l.apn,
          ownerName: l.owner?.value.name,
          address: l.address,
          mailingAddress: l.owner?.value.mailingAddress,
        })),
        { now }
      );
      const byApn = new Map(matches.map((m) => [m.apn, m]));
      const updated: EnrichedLead[] = [];
      let found = 0;
      for (const lead of batch) {
        const m = byApn.get(lead.apn);
        if (m?.phone) {
          found += 1;
          updated.push({ ...lead, phone: { value: m.phone, prov: m.prov }, updatedAt: now });
        }
      }
      if (updated.length) await upsertLeads(client, updated);
      return NextResponse.json({ ok: true, attempted: batch.length, found });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err).slice(0, 300) });
    }
  }

  if (action === "setPhone") {
    const apn = String(body.apn ?? "").trim();
    const number = String(body.number ?? "").replace(/\D/g, "");
    const lineType = LINE_TYPES.includes(body.lineType as LineType) ? (body.lineType as LineType) : "unknown";
    if (!apn || number.length < 10) return NextResponse.json({ ok: false, error: "apn and a 10+ digit number required" });
    const leads = await getLeads(client);
    const lead = leads.find((l) => l.apn === apn);
    if (!lead) return NextResponse.json({ ok: false, error: "unknown apn" });
    await upsertLeads(client, [
      { ...lead, phone: { value: { number, lineType }, prov: { source: "manual", fetchedAt: now } }, updatedAt: now },
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" });
}
