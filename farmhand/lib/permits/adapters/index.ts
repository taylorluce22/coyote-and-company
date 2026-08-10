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
