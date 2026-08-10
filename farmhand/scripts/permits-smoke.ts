/**
 * End-to-end proof of the permit lead-gen FILTER pipeline:
 * raw rows -> adapter mapping -> classify -> per-APN set-difference -> CSV.
 *
 * Default run uses fixtures (deterministic, offline):
 *   npm run permits:smoke
 * Live run against Mesa Socrata (needs network egress to data.mesaaz.gov):
 *   npm run permits:smoke -- --live
 *
 * Exits non-zero if any expectation fails.
 */

import { mesaRowToRecord, fetchMesaPermits } from "../lib/permits/adapters/mesa";
import { mesaFixtureRows, EXPECTED_TARGET_APNS } from "../lib/permits/fixtures/mesa";
import { solarWithoutBattery } from "../lib/permits/setDifference";
import { targetsToCsv } from "../lib/permits/csv";
import { classifyDescription } from "../lib/permits/classify";
import { defaultComplianceState, evaluateGate, leadDialVerdict, type ComplianceState } from "../lib/permits/comply";
import type { EnrichedLead } from "../lib/permits/types";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "  ok " : " FAIL"} ${label}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function runFixtureProof(now: string) {
  console.log("== classifier spot checks");
  check("'8.40 KW DC PV SOLAR' -> solar", classifyDescription("8.40 KW DC PV SOLAR") === "solar");
  check("'TESLA POWERWALL3' -> battery", classifyDescription("TESLA POWERWALL3") === "battery");
  check("'INSTALL B.E.S.S. 27 KWH' -> battery", classifyDescription("INSTALL B.E.S.S. 27 KWH") === "battery");
  check(
    "combined 'PV SOLAR ... WITH BATTERY BACKUP 13.5KWH' -> solar+battery",
    classifyDescription("PV SOLAR 7.2 KW WITH BATTERY BACKUP 13.5KWH") === "solar+battery"
  );
  check(
    "'SOLAR WATER HEATER REPLACEMENT' -> other (thermal, not PV)",
    classifyDescription("SOLAR WATER HEATER REPLACEMENT") === "other"
  );
  check(
    "ESS word boundary: ADDRESS/PROCESS don't misfire",
    classifyDescription("PV SOLAR 9.6 KW DC — PROCESS PANEL UPGRADE AT SAME ADDRESS") === "solar"
  );

  console.log("== fixture ingest -> set-difference");
  const records = mesaFixtureRows(now).map((r) => mesaRowToRecord(r, now));
  const { targets, stats } = solarWithoutBattery(records, { now });

  console.log("   stats:", JSON.stringify(stats));
  const targetApns = targets.map((t) => t.apn).sort();
  const expected = [...EXPECTED_TARGET_APNS].sort();
  check(
    `targets = ${expected.join(", ")}`,
    JSON.stringify(targetApns) === JSON.stringify(expected),
    `got ${targetApns.join(", ") || "(none)"}`
  );
  check("solar parcels counted", stats.parcelsWithSolar === 7, `got ${stats.parcelsWithSolar}`);
  check("battery parcels counted", stats.parcelsWithBattery === 4, `got ${stats.parcelsWithBattery}`);
  check("combined-permit parcel excluded (APN-C)", stats.combinedPermitParcels === 1 && !targetApns.includes("APNC00000"));
  check("separate-battery parcels excluded (APN-B, APN-J)", stats.excludedByBattery === 2, `got ${stats.excludedByBattery}`);
  check("recency window excludes too-old + too-new", stats.excludedByWindow === 2, `got ${stats.excludedByWindow}`);
  check("missing-APN permit counted, not listed", stats.permitsMissingApn === 1, `got ${stats.permitsMissingApn}`);
  check("undated parcel kept with recency unknown", targets.some((t) => t.apn === "APNK00000" && t.recency === "unknown"));

  console.log("== CSV output");
  const csv = targetsToCsv(targets);
  console.log(csv);
  check("CSV has header + one row per target", csv.trim().split("\n").length === targets.length + 1);
}

async function runLive(now: string) {
  console.log("== LIVE ingest from Mesa Socrata (dzpk-hxfb)");
  const records = await fetchMesaPermits({ now });
  console.log(`   fetched ${records.length} coarse-matched permits`);
  const { targets, stats } = solarWithoutBattery(records, { now });
  console.log("   stats:", JSON.stringify(stats, null, 2));
  console.log(`   -> ${targets.length} target parcels (solar, no battery, in window)`);
  console.log(targetsToCsv(targets.slice(0, 20)));
}

function runGateProof(now: string) {
  console.log("== COMPLY hard gate");
  const empty = defaultComplianceState();
  const emptyGate = evaluateGate(empty, now);
  check("fresh state: gate NOT armed", !emptyGate.armed && emptyGate.blockers.length === 3);
  check("dialing ships OFF (env absent)", !emptyGate.dialingEnabled && !emptyGate.canDial);

  const armedState: ComplianceState = {
    san: { number: "SAN-TEST-1", recordedAt: now },
    azRegistration: { status: "filed", kind: "roc-limited-44-1272.01", recordedAt: now },
    wirelessSuppression: true,
    lastDncScrubAt: now,
    callWindow: { startHour: 9, endHour: 20 },
  };
  const armedGate = evaluateGate(armedState, now);
  check("SAN + AZ reg + suppression + fresh scrub: armed", armedGate.armed);
  check("armed but env OFF: still cannot dial", !armedGate.canDial);
  check(
    "stale scrub (32 days) disarms",
    !evaluateGate(
      { ...armedState, lastDncScrubAt: new Date(Date.parse(now) - 32 * 86400000).toISOString() },
      now
    ).armed
  );
  check("suppression OFF disarms", !evaluateGate({ ...armedState, wirelessSuppression: false }, now).armed);
  check("missing SAN disarms", !evaluateGate({ ...armedState, san: undefined }, now).armed);
  check(
    "missing AZ registration disarms",
    !evaluateGate({ ...armedState, azRegistration: undefined }, now).armed
  );

  // Force an in-window check regardless of when this runs: window spans the full legal day.
  const openWindow: ComplianceState = { ...armedState, callWindow: { startHour: 8, endHour: 21 } };
  const baseLead: EnrichedLead = {
    apn: "APNA00000",
    jurisdiction: "mesa",
    address: "101 E MAIN ST",
    phone: { value: { number: "4805551234", lineType: "landline" }, prov: { source: "manual", fetchedAt: now } },
    dnc: { status: "clear", scrubbedAt: now, receipt: "R-1" },
    updatedAt: now,
  };
  const idnc = new Set<string>();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", hour: "numeric", hour12: false }).format(new Date(now))
  ) % 24;
  const inLegalWindow = hour >= 8 && hour < 21;
  const v = leadDialVerdict(baseLead, openWindow, idnc, now);
  check("clear landline lead: verdict matches Phoenix clock", v.eligible === inLegalWindow);
  const wireless = leadDialVerdict(
    { ...baseLead, phone: { value: { number: "4805551234", lineType: "wireless" }, prov: baseLead.phone!.prov } },
    openWindow, idnc, now
  );
  check("wireless suppressed while flag ON", !wireless.eligible);
  const unknownType = leadDialVerdict(
    { ...baseLead, phone: { value: { number: "4805551234", lineType: "unknown" }, prov: baseLead.phone!.prov } },
    openWindow, idnc, now
  );
  check("unknown line type treated as wireless (suppressed)", !unknownType.eligible);
  check("DNC-listed blocked", !leadDialVerdict({ ...baseLead, dnc: { status: "listed", scrubbedAt: now } }, openWindow, idnc, now).eligible);
  check("unscrubbed blocked", !leadDialVerdict({ ...baseLead, dnc: undefined }, openWindow, idnc, now).eligible);
  check(
    "internal DNC honored instantly",
    !leadDialVerdict(baseLead, openWindow, new Set(["4805551234"]), now).eligible
  );
  check("opt-out honored instantly", !leadDialVerdict({ ...baseLead, optedOutAt: now }, openWindow, idnc, now).eligible);
}

async function main() {
  const now = new Date().toISOString();
  if (process.argv.includes("--live")) {
    await runLive(now);
  } else {
    runFixtureProof(now);
    runGateProof(now);
  }
  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
