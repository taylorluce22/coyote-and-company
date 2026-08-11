import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import {
  fetchAssessorRecords,
  segmentFor,
  sourcedAssessor,
  assessorProvenance,
} from "@/lib/permits/enrich/assessor";
import { getPhoneProvider, PHONE_PROVIDERS } from "@/lib/permits/enrich/phoneAppend";
import { getLeads, getTargets, upsertLeads } from "@/lib/permits/store";
import type { EnrichedLead, LineType } from "@/lib/permits/types";
import { normalizeApn } from "@/lib/permits/types";
import { canonicalPhone, isDialable } from "@/lib/permits/phone";

/**
 * ENRICH stage: target parcels -> owner (Maricopa Assessor) -> phone
 * (pluggable append). Client-scoped like everything else in the module.
 * Phone numbers live here and in COMPLY only — never in the FILTER layer.
 *
 * GET  /api/permits/enrich → { enabled, maricopa, providers } capability probe
 * POST { action: "seed", client }
 *        stored targets -> lead rows (idempotent; existing enrichment kept)
 * POST { action: "owners", client, limit? }
 *        batched assessor join — owner, occupancy, use code, property facts
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
    // Public ArcGIS layer — nothing to configure, so this capability is always on.
    maricopa: true,
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
      // Everything seeded is in the current target set, so a parcel that was
      // retired by an earlier filter and has since come back is restored here.
      retired: false,
      // Quarantine flags only — TargetParcel.notes (second-pv-permit,
      // states-expansion) are information and must not hold a lead back.
      needsReview: !!t.reviewFlags?.length,
      reviewFlags: t.reviewFlags,
      updatedAt: now,
    }));
    const total = await upsertLeads(client, leads);
    return NextResponse.json({ ok: true, seeded: leads.length, total });
  }

  if (action === "owners") {
    // No token, no key: the county publishes the whole assessment roll as a
    // public ArcGIS layer, and the join runs in one batched query rather than
    // one HTTP round trip per parcel. 6,192 of 6,197 Buckeye targets matched.
    const leads = await getLeads(client);
    const missing = leads.filter((l) => !l.assessor).slice(0, limit);
    if (!missing.length) return NextResponse.json({ ok: true, attempted: 0, found: 0 });
    const records = await fetchAssessorRecords(missing.map((l) => l.apn));
    const updated: EnrichedLead[] = [];
    const segments: Record<string, number> = {};
    for (const lead of missing) {
      const rec = records.get(normalizeApn(lead.apn));
      if (!rec) continue;
      const segment = segmentFor(rec);
      segments[segment] = (segments[segment] ?? 0) + 1;
      updated.push({
        ...lead,
        assessor: sourcedAssessor(rec, now),
        segment,
        // The owner block stays populated because the phone-append provider
        // keys off it; the assessor record is the fuller source of the same
        // facts, not a replacement for the interface downstream expects.
        owner: rec.ownerName
          ? {
              value: {
                name: rec.ownerName,
                mailingAddress: rec.mailingAddress,
                ownerOccupied: rec.ownerOccupied,
              },
              prov: assessorProvenance(now),
            }
          : lead.owner,
        // PropertyUseDescription is authoritative where our description-text
        // rules were guesses: the 36 non-SFR parcels in the Buckeye set are
        // the commercial contamination every text heuristic missed.
        ...(rec.isSfr === false
          ? {
              needsReview: true,
              reviewFlags: [...new Set([...(lead.reviewFlags ?? []), "non-residential-use"])],
            }
          : {}),
        updatedAt: now,
      });
    }
    if (updated.length) await upsertLeads(client, updated);
    return NextResponse.json({
      ok: true,
      attempted: missing.length,
      found: updated.length,
      segments,
      remaining: leads.filter((l) => !l.assessor).length - updated.length,
      // Only "primary" reaches the default dial queue. Absentee owners and
      // rentals are a separate campaign, not a lesser one.
      note: "absentee, rental and non-residential segments are held out of the default dial queue",
    });
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
    const apn = normalizeApn(body.apn);
    const number = canonicalPhone(body.number);
    const lineType = LINE_TYPES.includes(body.lineType as LineType) ? (body.lineType as LineType) : "unknown";
    if (!apn || !isDialable(number)) return NextResponse.json({ ok: false, error: "apn and a 10-digit number required" });
    const leads = await getLeads(client);
    const lead = leads.find((l) => normalizeApn(l.apn) === apn);
    if (!lead) return NextResponse.json({ ok: false, error: "unknown apn" });
    await upsertLeads(client, [
      {
        ...lead,
        phone: { value: { number, lineType }, prov: { source: "manual", fetchedAt: now } },
        // A new number has never been scrubbed. Carrying the old number's
        // verdict and receipt forward would let it stand as compliance
        // evidence for a number the scrub never saw.
        dnc: undefined,
        updatedAt: now,
      },
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" });
}
