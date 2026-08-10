import { NextRequest, NextResponse } from "next/server";
import { kvEnabled } from "@/lib/kv";
import {
  clampCallWindow,
  evaluateGate,
  leadDialVerdict,
  maskPhone,
  type ComplianceState,
} from "@/lib/permits/comply";
import {
  addInternalDnc,
  appendComplianceLog,
  getComplianceLog,
  getComplianceState,
  getInternalDnc,
  getLeads,
  setComplianceState,
  upsertLeads,
} from "@/lib/permits/store";
import type { EnrichedLead } from "@/lib/permits/types";

/**
 * COMPLY — the hard gate in front of the manual call queue.
 *
 * The structural rule of this route: a phone number leaves the server
 * UNMASKED only inside the dial-queue payload, and only when
 * gate.canDial === true (every gate requirement satisfied AND the
 * PERMITS_DIALING_ENABLED env var — which ships absent — is "true").
 * There is no other endpoint anywhere in the app that returns these
 * numbers. Manual click-to-dial only; nothing here automates a call.
 *
 * GET  /api/permits/comply?client=x
 *        → { enabled, state, gate, queue, suppressed, log: last 50 }
 *          queue rows carry tel: numbers only when gate.canDial
 * POST { action: "setState", client, san?, azRegistration?, wirelessSuppression?, callWindow? }
 * POST { action: "recordScrub", client, receipt, listedNumbers?: string[] }
 *        marks every phone-bearing lead clear/listed, stamps the 31-day clock
 * POST { action: "optOut", client, number, apn?, reason? }
 *        internal DNC — honored instantly, retained 10 years
 * POST { action: "logCall", client, apn, outcome, notes? }
 *        compliance log entry for a manually placed call
 * POST { action: "logVendor", client, vendor, detail }
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!kvEnabled()) return NextResponse.json({ enabled: false });
  const client = req.nextUrl.searchParams.get("client") ?? "";
  const now = new Date().toISOString();
  const [state, leads, idnc, log] = await Promise.all([
    getComplianceState(client),
    getLeads(client),
    getInternalDnc(client),
    getComplianceLog(client),
  ]);
  const gate = evaluateGate(state, now);
  const idncNumbers = new Set(idnc.map((e) => e.number));

  const queue: Array<Record<string, unknown>> = [];
  const suppressed: Array<{ apn: string; reason: string }> = [];
  for (const lead of leads) {
    if (!lead.phone) continue;
    const verdict = leadDialVerdict(lead, state, idncNumbers, now);
    if (verdict.eligible) {
      queue.push({
        apn: lead.apn,
        address: lead.address,
        owner: lead.owner?.value.name ?? "",
        lineType: lead.phone.value.lineType,
        phoneMasked: maskPhone(lead.phone.value.number),
        // The one and only unmasked exit, gated twice (armed + env):
        ...(gate.canDial ? { phone: lead.phone.value.number } : {}),
        provenance: lead.phone.prov,
      });
    } else {
      suppressed.push({ apn: lead.apn, reason: verdict.reason });
    }
  }

  return NextResponse.json({
    enabled: true,
    state,
    gate,
    counts: { leads: leads.length, withPhone: leads.filter((l) => l.phone).length, queue: queue.length, suppressed: suppressed.length },
    queue,
    suppressed,
    internalDnc: idnc.length,
    log: log.slice(-50),
  });
}

interface ComplyPostBody {
  action?: string;
  client?: string;
  san?: string;
  azRegistration?: { status?: string; kind?: string; reference?: string };
  wirelessSuppression?: boolean;
  callWindow?: { startHour?: number; endHour?: number };
  receipt?: string;
  listedNumbers?: string[];
  number?: string;
  apn?: string;
  reason?: string;
  outcome?: string;
  notes?: string;
  vendor?: string;
  detail?: string;
}

export async function POST(req: NextRequest) {
  if (!kvEnabled()) return NextResponse.json({ ok: false, enabled: false });
  let body: ComplyPostBody = {};
  try {
    body = await req.json();
  } catch {}
  const action = String(body.action ?? "");
  const client = String(body.client ?? "");
  const now = new Date().toISOString();

  if (action === "setState") {
    const state = await getComplianceState(client);
    const next: ComplianceState = { ...state };
    if (typeof body.san === "string" && body.san.trim()) {
      next.san = { number: body.san.trim().slice(0, 40), recordedAt: now };
    }
    if (body.azRegistration) {
      const status = ["not_filed", "filed", "active"].includes(String(body.azRegistration.status))
        ? (String(body.azRegistration.status) as "not_filed" | "filed" | "active")
        : "filed";
      next.azRegistration = {
        status,
        kind: body.azRegistration.kind === "full" ? "full" : "roc-limited-44-1272.01",
        reference: body.azRegistration.reference ? String(body.azRegistration.reference).slice(0, 60) : undefined,
        recordedAt: now,
      };
    }
    if (typeof body.wirelessSuppression === "boolean") next.wirelessSuppression = body.wirelessSuppression;
    if (body.callWindow) {
      next.callWindow = clampCallWindow({
        startHour: Number(body.callWindow.startHour ?? next.callWindow.startHour),
        endHour: Number(body.callWindow.endHour ?? next.callWindow.endHour),
      });
    }
    await setComplianceState(client, next);
    await appendComplianceLog(client, {
      at: now,
      kind: "gate-change",
      detail: "compliance state updated",
      data: {
        sanOnFile: !!next.san,
        azRegistration: next.azRegistration?.status ?? "not recorded",
        wirelessSuppression: next.wirelessSuppression,
        callWindow: next.callWindow,
      },
    });
    return NextResponse.json({ ok: true, state: next, gate: evaluateGate(next, now) });
  }

  if (action === "recordScrub") {
    const receipt = String(body.receipt ?? "").slice(0, 200);
    if (!receipt) return NextResponse.json({ ok: false, error: "scrub receipt required — no receipt, no scrub" });
    const listed = new Set((body.listedNumbers ?? []).map((n) => String(n).replace(/\D/g, "")));
    const leads = await getLeads(client);
    const updated: EnrichedLead[] = [];
    for (const lead of leads) {
      const num = lead.phone?.value.number;
      if (!num) continue;
      updated.push({
        ...lead,
        dnc: { status: listed.has(num) ? "listed" : "clear", scrubbedAt: now, receipt },
        updatedAt: now,
      });
    }
    if (updated.length) await upsertLeads(client, updated);
    const state = await getComplianceState(client);
    const next = { ...state, lastDncScrubAt: now };
    await setComplianceState(client, next);
    await appendComplianceLog(client, {
      at: now,
      kind: "scrub",
      detail: `National DNC scrub recorded: ${updated.length} numbers, ${listed.size} listed`,
      data: { receipt, scrubbed: updated.length, listed: listed.size },
    });
    return NextResponse.json({ ok: true, scrubbed: updated.length, listed: listed.size, gate: evaluateGate(next, now) });
  }

  if (action === "optOut") {
    const number = String(body.number ?? "").replace(/\D/g, "");
    if (number.length < 10) return NextResponse.json({ ok: false, error: "10+ digit number required" });
    const apn = body.apn ? String(body.apn) : undefined;
    await addInternalDnc(client, { number, addedAt: now, apn, reason: body.reason ? String(body.reason).slice(0, 200) : undefined });
    const leads = await getLeads(client);
    const hit = leads.filter((l) => l.phone?.value.number === number || (apn && l.apn === apn));
    if (hit.length) {
      await upsertLeads(client, hit.map((l) => ({ ...l, internalDnc: true, optedOutAt: now, updatedAt: now })));
    }
    await appendComplianceLog(client, {
      at: now,
      kind: "opt-out",
      detail: `internal DNC add (${maskPhone(number)})`,
      data: { number, apn, reason: body.reason },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "logCall") {
    const apn = String(body.apn ?? "").trim();
    if (!apn) return NextResponse.json({ ok: false, error: "apn required" });
    const state = await getComplianceState(client);
    const gate = evaluateGate(state, now);
    if (!gate.canDial) {
      // A call log with dialing off means someone dialed around the system — record it as such.
      await appendComplianceLog(client, {
        at: now,
        kind: "call",
        detail: `call logged while gate closed (${gate.blockers.join("; ") || "dialing disabled"}) — investigate`,
        data: { apn, outcome: body.outcome, notes: body.notes },
      });
      return NextResponse.json({ ok: true, warning: "gate is closed — call logged and flagged" });
    }
    await appendComplianceLog(client, {
      at: now,
      kind: "call",
      detail: `manual call: ${String(body.outcome ?? "no outcome").slice(0, 80)}`,
      data: { apn, outcome: body.outcome, notes: String(body.notes ?? "").slice(0, 500) },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "logVendor") {
    const vendor = String(body.vendor ?? "").trim();
    if (!vendor) return NextResponse.json({ ok: false, error: "vendor required" });
    await appendComplianceLog(client, {
      at: now,
      kind: "vendor-license",
      detail: `vendor record: ${vendor.slice(0, 80)}`,
      data: { vendor, detail: String(body.detail ?? "").slice(0, 500) },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" });
}
