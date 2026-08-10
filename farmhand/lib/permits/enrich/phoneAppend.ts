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

function normalizeLineType(raw: unknown): LineType {
  const s = String(raw ?? "").toLowerCase();
  if (/cell|wireless|mobile/.test(s)) return "wireless";
  if (/land|fixed/.test(s)) return "landline";
  if (/voip/.test(s)) return "voip";
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
      const number = String(row?.Phone ?? row?.CellPhone ?? "").replace(/\D/g, "");
      if (!row || number.length < 10) return { apn: b.apn, phone: null, prov };
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
