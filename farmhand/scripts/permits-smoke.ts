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

async function main() {
  const now = new Date().toISOString();
  if (process.argv.includes("--live")) {
    await runLive(now);
  } else {
    runFixtureProof(now);
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
