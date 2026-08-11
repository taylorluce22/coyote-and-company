/**
 * INGEST — jurisdiction adapter registry.
 * P0: mesa (live). P1 (queued, not yet built): tempe, scottsdale.
 */

import type { Jurisdiction, PermitRecord } from "../types";
import { fetchMesaPermits } from "./mesa";
import { fetchPeoriaPermits } from "./peoria";
import { fetchBuckeyePermits } from "./buckeye";

export interface PermitAdapter {
  id: Jurisdiction;
  label: string;
  fetchPermits(opts: { now: string; fetchImpl?: typeof fetch; maxRows?: number }): Promise<PermitRecord[]>;
}

export const ADAPTERS: Partial<Record<Jurisdiction, PermitAdapter>> = {
  mesa: {
    id: "mesa",
    label: "Mesa, AZ (Socrata dzpk-hxfb)",
    fetchPermits: fetchMesaPermits,
  },
  peoria: {
    id: "peoria",
    label: "Peoria, AZ (ArcGIS Solar_Parcels — structured PV + battery flags)",
    fetchPermits: fetchPeoriaPermits,
  },
  buckeye: {
    id: "buckeye",
    label: "Buckeye, AZ (ArcGIS EnerGov — workclass Photovoltaic, not Solar)",
    fetchPermits: fetchBuckeyePermits,
  },
};

export function getAdapter(id: string): PermitAdapter | null {
  return (ADAPTERS as Record<string, PermitAdapter | undefined>)[id] ?? null;
}

/**
 * Earliest install year each source can actually produce.
 *
 * Buckeye and Peoria both cut over to EnerGov in 2019: Buckeye has zero
 * photovoltaic permits finalized before 2019-01-01, one permit of any type
 * applied in 2018, zero in 2016–2017. That is the SOURCE's history, not our
 * filter, and pre-2019 permits are a records-request item no code change
 * reaches.
 *
 * It is recorded here so an export can state its real coverage. The retrofit
 * window is nominally 2–20 years; from these two cities it can only ever
 * return 2019 onward, and nothing downstream may imply otherwise.
 */
export const HISTORY_STARTS: Partial<Record<Jurisdiction, number>> = {
  // Mesa is deliberately absent: its history depth has not been verified the
  // way these two were, and a guessed year here would read as a measured one.
  peoria: 2019,
  buckeye: 2019,
};

/** Human-readable coverage note for an export header or UI caption. */
export function coverageNote(jurisdiction: Jurisdiction): string {
  const start = HISTORY_STARTS[jurisdiction];
  return start
    ? `${jurisdiction}: permit history starts ${start} — the 2–20 year window cannot reach earlier than that from this source`
    : `${jurisdiction}: permit history depth not verified`;
}
