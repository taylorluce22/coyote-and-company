/**
 * ENRICH, hop 2: owner/address -> phone via a pluggable append provider.
 *
 * Contract every provider must honor:
 *   - a match ALWAYS carries a lineType flag (wireless suppression in COMPLY
 *     depends on it; a provider that can't say returns "unknown", which the
 *     default-ON suppression treats as wireless);
 *   - never fabricate: no number in the vendor response -> phone stays null;
 *   - every returned number carries provenance (provider id + fetch date).
 *
 * Datazapp is the first wired provider. Manual entry is not a provider —
 * hand-sourced numbers enter through the setPhone API action with
 * source "manual".
 */

import type { LineType, PhoneData, Provenance } from "../types";
import { canonicalPhone, isDialable } from "../phone";

export interface PhoneAppendInput {
  apn: string;
  ownerName?: string;
  address: string;
  mailingAddress?: string;
}

export interface PhoneAppendMatch {
  apn: string;
  /** null = provider had no number for this input. Never invented. */
  phone: PhoneData | null;
  prov: Provenance;
}

export interface PhoneAppendProvider {
  id: string;
  label: string;
  configured(): boolean;
  append(
    batch: PhoneAppendInput[],
    opts: { now: string; fetchImpl?: typeof fetch }
  ): Promise<PhoneAppendMatch[]>;
}

/**
 * VOIP is tested FIRST on purpose. Vendors label these lines "Fixed VOIP" and
 * "Non-Fixed VOIP"; a /land|fixed/ test running first captures both as
 * "landline" — the one line type the suppression rule lets through. Getting
 * this order wrong misclassifies in the only direction that can put a call
 * through to a number that should have been held back.
 */
export function normalizeLineType(raw: unknown): LineType {
  const s = String(raw ?? "").toLowerCase();
  if (/voip/.test(s)) return "voip";
  if (/cell|wireless|mobile/.test(s)) return "wireless";
  if (/land ?line|landline|fixed|residential|business/.test(s)) return "landline";
  return "unknown";
}

/**
 * Datazapp phone append. Env: DATAZAPP_API_KEY. The request/response shape
 * below follows Datazapp's Append API v2 conventions — VERIFY against the
 * current Datazapp docs before the first paid run, then remove this note.
 */
const DATAZAPP_URL = process.env.DATAZAPP_API_URL || "https://secureapi.datazapp.com/Appendv2";

export const datazappProvider: PhoneAppendProvider = {
  id: "datazapp",
  label: "Datazapp phone append",
  configured: () => !!process.env.DATAZAPP_API_KEY,
  async append(batch, opts) {
    if (!this.configured()) throw new Error("DATAZAPP_API_KEY not set");
    const fetchImpl = opts.fetchImpl ?? fetch;
    const res = await fetchImpl(DATAZAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        ApiKey: process.env.DATAZAPP_API_KEY,
        AppendModule: "PhoneAppendAPI",
        AppendType: 1,
        Data: batch.map((b) => ({
          Name: b.ownerName ?? "",
          Address: b.mailingAddress || b.address,
          UniqueId: b.apn,
        })),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`datazapp ${res.status}`);
    const payload = (await res.json()) as {
      ResponseDetail?: { Data?: Array<Record<string, unknown>> };
    };
    const rows = payload?.ResponseDetail?.Data ?? [];
    const prov: Provenance = { source: "datazapp", fetchedAt: opts.now };
    const byId = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const id = String(row.UniqueId ?? "");
      if (id) byId.set(id, row);
    }
    return batch.map((b) => {
      const row = byId.get(b.apn);
      // `||` not `??`: a vendor row with Phone: "" and a populated CellPhone is a
      // match, not a miss — `??` only falls through on null/undefined.
      const number = canonicalPhone(String(row?.Phone || row?.CellPhone || ""));
      if (!row || !isDialable(number)) return { apn: b.apn, phone: null, prov };
      return {
        apn: b.apn,
        phone: { number, lineType: normalizeLineType(row.PhoneType ?? row.LineType) },
        prov,
      };
    });
  },
};

export const PHONE_PROVIDERS: Record<string, PhoneAppendProvider> = {
  datazapp: datazappProvider,
};

export function getPhoneProvider(id: string): PhoneAppendProvider | null {
  return PHONE_PROVIDERS[id] ?? null;
}
