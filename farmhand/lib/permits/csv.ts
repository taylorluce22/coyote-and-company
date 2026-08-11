/**
 * CSV output for the FILTER stage — the reviewable draft list.
 * Lists are drafts for Taylor's review, never a dial list by themselves.
 */

import type { TargetParcel } from "./types";

function cell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function targetsToCsv(targets: TargetParcel[]): string {
  const header = [
    "apn",
    "jurisdiction",
    "address",
    "install_date",
    "install_year",
    "completion_date_source",
    "recency",
    "contractor",
    "utility",
    "battery_evidence",
    "battery_detection_method",
    "review_flags",
    "solar_permit_numbers",
    "solar_descriptions",
  ];
  const rows = targets.map((t) =>
    [
      t.apn,
      t.jurisdiction,
      t.address,
      t.newestSolarIssuedAt ?? "",
      t.installYear ?? "",
      t.completionSource,
      t.recency,
      t.contractor ?? "",
      t.utility ?? "",
      t.batteryEvidence,
      t.batteryDetectionMethod,
      (t.reviewFlags ?? []).join("; "),
      t.solarPermits.map((p) => p.permitNumber).join("; "),
      t.solarPermits.map((p) => p.description).join(" | "),
    ]
      .map(cell)
      .join(",")
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}
