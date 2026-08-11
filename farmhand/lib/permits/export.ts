/**
 * The enriched export — permit derivation joined to assessor facts, per
 * jurisdiction, as a DRAFT for Taylor's review. Dialing is still off.
 *
 * Two deliberate absences:
 *
 *   NO PHONE COLUMN. Phone numbers are not in this file and must not be added
 *   to it. They live behind the COMPLY gate, and an export is a file that gets
 *   mailed around — the one artifact most likely to leave the system.
 *
 *   NO IMPLIED DEPTH. Buckeye and Peoria both start in 2019 (EnerGov cutover),
 *   so the coverage note travels with the file. A "2–20 year window" heading
 *   over 2019-onward data reads as twenty years of coverage.
 *
 * City comes from the ASSESSOR, not from the issuing jurisdiction: 293 of the
 * Buckeye targets sit at addresses the assessor calls Litchfield Park, because
 * Buckeye's permit system covers part of 85340. The issuing city is where the
 * paperwork was filed; the assessor's city is where the house is.
 */

import { coverageNote, HISTORY_STARTS } from "./adapters";
import type { EnrichedLead, Jurisdiction, TargetParcel } from "./types";
import { normalizeApn } from "./types";

export const EXPORT_COLUMNS = [
  "apn",
  "apn_dash",
  "owner_name",
  "property_address",
  "property_city",
  "property_zip",
  "mailing_address",
  "mailing_city",
  "mailing_state",
  "mailing_zip",
  "owner_occupied",
  "is_rental",
  "property_use",
  "install_year",
  "solar_completed_date",
  "system_kw_dc",
  "permit_count",
  "livable_sqft",
  "year_built",
  "pool",
  "stories",
  "full_cash_value",
  "utility",
  "jurisdiction",
  "battery_evidence",
  "battery_detection_method",
  "completion_status_source",
] as const;

function cell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Booleans export as yes/no/blank — blank means unknown, which is not the same as no. */
const yesNo = (v: boolean | undefined): string => (v === undefined ? "" : v ? "yes" : "no");

export interface ExportOptions {
  /** Restrict to one issuing jurisdiction. Omit for everything. */
  jurisdiction?: Jurisdiction;
  /** Include leads held for review / outside the primary segment (default false). */
  includeHeldBack?: boolean;
}

export interface ExportRow {
  lead: EnrichedLead;
  target?: TargetParcel;
}

/**
 * Pair each lead with its target parcel. A lead with no matching target is a
 * retired parcel; it still exports (its permit facts are simply blank) rather
 * than vanishing, because a row disappearing from a draft with no trace is how
 * a reviewer stops trusting the draft.
 */
export function joinLeadsToTargets(leads: EnrichedLead[], targets: TargetParcel[]): ExportRow[] {
  const byApn = new Map(targets.map((t) => [normalizeApn(t.apn), t]));
  return leads.map((lead) => ({ lead, target: byApn.get(normalizeApn(lead.apn)) }));
}

/**
 * Sort: install year ASCENDING (oldest installs first — they have had the
 * longest to want storage), then system size DESCENDING (a bigger array is a
 * bigger battery opportunity). Undated rows sort last so they never head the
 * file.
 */
export function sortForExport(rows: ExportRow[]): ExportRow[] {
  return [...rows].sort((a, b) => {
    const ay = a.target?.installYear ?? Number.POSITIVE_INFINITY;
    const by = b.target?.installYear ?? Number.POSITIVE_INFINITY;
    if (ay !== by) return ay - by;
    const asz = a.target?.totalSystemKwDc ?? a.target?.systemKwDc ?? -1;
    const bsz = b.target?.totalSystemKwDc ?? b.target?.systemKwDc ?? -1;
    if (asz !== bsz) return bsz - asz;
    return a.lead.apn < b.lead.apn ? -1 : a.lead.apn > b.lead.apn ? 1 : 0;
  });
}

export function selectExportRows(
  leads: EnrichedLead[],
  targets: TargetParcel[],
  opts: ExportOptions = {}
): ExportRow[] {
  const rows = joinLeadsToTargets(leads, targets).filter(({ lead }) => {
    if (opts.jurisdiction && lead.jurisdiction !== opts.jurisdiction) return false;
    if (lead.retired) return false;
    if (opts.includeHeldBack) return true;
    // Held-back rows are excluded from the default draft, not deleted: the
    // absentee and non-residential segments are separate campaigns, and
    // needsReview rows are genuinely undecided.
    if (lead.needsReview) return false;
    if (lead.segment && lead.segment !== "primary") return false;
    return true;
  });
  return sortForExport(rows);
}

export function exportRowsToCsv(rows: ExportRow[]): string {
  const body = rows.map(({ lead, target }) => {
    const a = lead.assessor?.value;
    return [
      lead.apn,
      a?.apnDash ?? "",
      a?.ownerName ?? lead.owner?.value.name ?? "",
      // Assessor situs address first: it is standardized, where the permit
      // address is whatever the applicant typed.
      a?.propertyAddress ?? lead.address ?? "",
      a?.propertyCity ?? "",
      a?.propertyZip ?? "",
      a?.mailingAddress ?? lead.owner?.value.mailingAddress ?? "",
      a?.mailingCity ?? "",
      a?.mailingState ?? "",
      a?.mailingZip ?? "",
      yesNo(a?.ownerOccupied ?? lead.owner?.value.ownerOccupied),
      yesNo(a?.isRental),
      a?.propertyUse ?? "",
      target?.installYear ?? "",
      target?.newestSolarIssuedAt ?? lead.newestSolarIssuedAt ?? "",
      target?.totalSystemKwDc ?? target?.systemKwDc ?? "",
      (target?.expansionCount ?? 0) + 1,
      a?.livableSqFt ?? "",
      a?.yearBuilt ?? "",
      yesNo(a?.pool),
      a?.stories ?? "",
      a?.fullCashValue ?? "",
      target?.utility ?? "",
      lead.jurisdiction,
      target?.batteryEvidence ?? "permit-data-only",
      target?.batteryDetectionMethod ?? "",
      target?.completionSource ?? "",
    ]
      .map(cell)
      .join(",");
  });
  return [EXPORT_COLUMNS.join(","), ...body].join("\n") + "\n";
}

export interface ExportSummary {
  rows: number;
  withAssessor: number;
  ownerOccupied: number;
  absentee: number;
  rentals: number;
  nonResidential: number;
  withPool: number;
  heldBack: number;
  byInstallYear: Record<number, number>;
  /** Cities as the ASSESSOR names them — not always the issuing jurisdiction. */
  byPropertyCity: Record<string, number>;
  /** Earliest year each included jurisdiction's source can produce. */
  coverage: string[];
}

export function summarizeExport(
  leads: EnrichedLead[],
  targets: TargetParcel[],
  opts: ExportOptions = {}
): ExportSummary {
  const included = selectExportRows(leads, targets, opts);
  const all = joinLeadsToTargets(leads, targets).filter(
    ({ lead }) => !lead.retired && (!opts.jurisdiction || lead.jurisdiction === opts.jurisdiction)
  );
  const byInstallYear: Record<number, number> = {};
  const byPropertyCity: Record<string, number> = {};
  let withAssessor = 0;
  let ownerOccupied = 0;
  let absentee = 0;
  let rentals = 0;
  let nonResidential = 0;
  let withPool = 0;
  for (const { lead, target } of all) {
    const a = lead.assessor?.value;
    if (a) withAssessor += 1;
    if (a?.ownerOccupied === true) ownerOccupied += 1;
    if (lead.segment === "absentee") absentee += 1;
    if (a?.isRental) rentals += 1;
    if (a?.isSfr === false) nonResidential += 1;
    if (a?.pool) withPool += 1;
    if (target?.installYear) byInstallYear[target.installYear] = (byInstallYear[target.installYear] ?? 0) + 1;
    const city = a?.propertyCity ?? "";
    if (city) byPropertyCity[city] = (byPropertyCity[city] ?? 0) + 1;
  }
  const jurisdictions = [...new Set(all.map(({ lead }) => lead.jurisdiction))];
  return {
    rows: included.length,
    withAssessor,
    ownerOccupied,
    absentee,
    rentals,
    nonResidential,
    withPool,
    heldBack: all.length - included.length,
    byInstallYear,
    byPropertyCity,
    coverage: jurisdictions.filter((j) => HISTORY_STARTS[j] !== undefined).map(coverageNote),
  };
}
