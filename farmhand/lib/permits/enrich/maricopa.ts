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

const norm = (k: string) => k.toLowerCase().replace(/[^a-z]/g, "");

/** Read a candidate key directly off ONE object. No descent — the caller controls scope. */
function readKey(obj: Record<string, unknown>, candidates: string[]): string {
  const wanted = candidates.map(norm);
  for (const [key, value] of Object.entries(obj)) {
    if (wanted.includes(norm(key)) && typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Find the single object that carries the owner name, and return THAT object.
 *
 * Owner name and mailing address must come from the same record. Scanning the
 * payload twice from the root lets the name descend into one subtree and the
 * address into another, which stitches a real person's name onto a different
 * person's address — a fabricated record that looks perfectly well-formed.
 * Returning one node keeps the pair intact.
 */
function findOwnerRecord(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4 || node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findOwnerRecord(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (readKey(obj, OWNER_KEYS)) return obj;
    for (const value of Object.values(obj)) {
      const hit = findOwnerRecord(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
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
 * Fetch owner details for one APN. Returns null on a miss — the lead simply
 * stays unenriched, which is always preferable to a wrong owner.
 *
 * Only the APN-keyed endpoint is used. A free-text /search/property fallback
 * was removed: its results are not guaranteed to be the requested parcel, so
 * taking an owner from them attaches some other household's name to this
 * address and stamps it with assessor provenance, which reads as verified.
 * A failed lookup is a miss, not an invitation to guess.
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
    return null;
  }
  const record = findOwnerRecord(payload);
  if (!record) return null;
  const name = readKey(record, OWNER_KEYS);
  if (!name) return null;
  const mailingAddress = readKey(record, MAILING_KEYS) || undefined;
  const prov: Provenance = { source: MARICOPA_SOURCE, fetchedAt: opts.now };
  return {
    value: {
      name: name.slice(0, 120),
      mailingAddress: mailingAddress?.slice(0, 200),
      // Undefined, not false: with no situs address to compare there is no
      // evidence either way, and a hard `false` reads as "confirmed absentee".
      ownerOccupied:
        mailingAddress && situsAddress.trim() ? sameStreet(situsAddress, mailingAddress) : undefined,
    },
    prov,
  };
}
