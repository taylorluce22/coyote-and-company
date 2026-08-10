/**
 * ENRICH, hop 1: APN -> owner via the Maricopa County Assessor API.
 *
 * Free token (request via mcassessor.maricopa.gov contact form, subject
 * "API Token/Question"), sent in the AUTHORIZATION header. Env:
 * MARICOPA_ASSESSOR_TOKEN.
 *
 * Endpoints used:
 *   GET /parcel/{apn}/owner-details   — owner name + mailing address
 *   GET /search/property/?q={query}   — fallback when an APN misses
 *
 * Response key names are tolerant-scanned (the API's exact casing isn't
 * pinned down here) — verify against a live response on first run and
 * tighten if needed. Never fabricate: anything not present in the response
 * stays absent, and every extracted field carries provenance.
 */

import type { OwnerData, Provenance, Sourced } from "../types";

const BASE = "https://mcassessor.maricopa.gov";
export const MARICOPA_SOURCE = "maricopa-assessor";

export function maricopaEnabled(): boolean {
  return !!process.env.MARICOPA_ASSESSOR_TOKEN;
}

interface MaricopaFetchOptions {
  now: string;
  fetchImpl?: typeof fetch;
}

async function getJson(path: string, opts: MaricopaFetchOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${BASE}${path}`, {
    headers: {
      Accept: "application/json",
      AUTHORIZATION: process.env.MARICOPA_ASSESSOR_TOKEN ?? "",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`maricopa ${res.status} on ${path}`);
  return res.json();
}

/** Depth-first scan for the first string value under any of the candidate key names (case/format-insensitive). */
function scanForKey(node: unknown, candidates: string[], depth = 0): string {
  if (depth > 4 || node == null) return "";
  const wanted = candidates.map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = scanForKey(item, candidates, depth + 1);
      if (hit) return hit;
    }
    return "";
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const norm = key.toLowerCase().replace(/[^a-z]/g, "");
      if (wanted.includes(norm) && typeof value === "string" && value.trim()) return value.trim();
    }
    for (const value of Object.values(obj)) {
      const hit = scanForKey(value, candidates, depth + 1);
      if (hit) return hit;
    }
  }
  return "";
}

const OWNER_KEYS = ["Ownership", "OwnerName", "Owner_Name", "Owner"];
const MAILING_KEYS = ["MailingAddress", "Mailing_Address", "OwnerAddress", "MailAddress"];

function sameStreet(a: string, b: string): boolean {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.startsWith(nb.slice(0, 12)) || nb.startsWith(na.slice(0, 12));
}

/**
 * Fetch owner details for one APN. Returns null on a miss (unknown parcel,
 * no owner fields in the payload) — the lead simply stays unenriched.
 */
export async function fetchOwner(
  apn: string,
  situsAddress: string,
  opts: MaricopaFetchOptions
): Promise<Sourced<OwnerData> | null> {
  if (!maricopaEnabled()) return null;
  let payload: unknown;
  try {
    payload = await getJson(`/parcel/${encodeURIComponent(apn)}/owner-details`, opts);
  } catch {
    // fallback: free-text property search by situs address
    try {
      payload = await getJson(`/search/property/?q=${encodeURIComponent(situsAddress || apn)}`, opts);
    } catch {
      return null;
    }
  }
  const name = scanForKey(payload, OWNER_KEYS);
  if (!name) return null;
  const mailingAddress = scanForKey(payload, MAILING_KEYS) || undefined;
  const prov: Provenance = { source: MARICOPA_SOURCE, fetchedAt: opts.now };
  return {
    value: {
      name: name.slice(0, 120),
      mailingAddress: mailingAddress?.slice(0, 200),
      ownerOccupied: mailingAddress ? sameStreet(situsAddress, mailingAddress) : undefined,
    },
    prov,
  };
}
