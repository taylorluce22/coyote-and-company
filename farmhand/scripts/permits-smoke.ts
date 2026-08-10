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

import { mesaRowToRecord, fetchMesaPermits, mesaSoqlWhere } from "../lib/permits/adapters/mesa";
import { canonicalPhone, isDialable } from "../lib/permits/phone";
import { normalizeLineType } from "../lib/permits/enrich/phoneAppend";
import { mesaFixtureRows, EXPECTED_TARGET_APNS, MESA_STATUS_FIXTURES, LIVE_CONTAMINANTS } from "../lib/permits/fixtures/mesa";
import { solarWithoutBattery } from "../lib/permits/setDifference";
import { targetsToCsv } from "../lib/permits/csv";
import { classifyDescription, isAncillaryScope } from "../lib/permits/classify";
import { assessResidential, parseKwDc } from "../lib/permits/residential";
import { classifyMesaStatus, MESA_COMPLETED_SOLAR_BASELINE, MESA_SOLAR_MATCH_BASELINE } from "../lib/permits/status";
import { detectUtility } from "../lib/permits/utility";
import { normalizeApn } from "../lib/permits/types";
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
    classifyDescription("PV SOLAR 9.6 KW DC — PROCESS UPGRADE AT SAME ADDRESS") === "solar"
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
  check("completed-solar parcels counted", stats.parcelsWithSolar === 8, `got ${stats.parcelsWithSolar}`);
  check("battery parcels counted", stats.parcelsWithBattery === 4, `got ${stats.parcelsWithBattery}`);
  check("combined-permit parcel excluded", stats.combinedPermitParcels === 1 && !targetApns.includes("30433503"));
  check("separate-battery parcels excluded", stats.excludedByBattery === 2, `got ${stats.excludedByBattery}`);
  check("recency window excludes too-old + too-new", stats.excludedByWindow === 2, `got ${stats.excludedByWindow}`);
  check("missing-APN permit counted, not listed", stats.permitsMissingApn === 1, `got ${stats.permitsMissingApn}`);
  check("undated parcel kept with recency unknown", targets.some((t) => t.apn === "30433511" && t.recency === "unknown"));
  check("ancillary-only parcel not a target", stats.parcelsAncillaryOnly === 1 && !targetApns.includes("30433512"));
  check("incomplete solar parcel not a target", stats.parcelsIncompleteSolar === 1 && !targetApns.includes("30433514"));
  check("ambiguous-status parcel not a target", stats.parcelsAmbiguousStatus === 1 && !targetApns.includes("30433515"));
  check(
    "install date comes from finaled_date, flagged as such",
    targets.find((t) => t.apn === "30433501")?.completionSource === "finaled"
  );
  check("install year read from source, not derived", !!targets.find((t) => t.apn === "30433501")?.installYear);
  check("contractor carried through", targets.find((t) => t.apn === "30433501")?.contractor === "SOLARCITY CORP");

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

/**
 * Regressions for defects found by the 2026-08-10 adversarial audit. Each check
 * fails on the code as it was before the hardening pass.
 */
function runAuditRegressions(now: string) {
  console.log("== audit regressions");

  // The ingest filter must be able to fetch every permit the classifier can
  // call battery evidence. A standalone "ESS INSTALL 27 KWH" permit was
  // classified correctly offline but never fetched live, so its parcel kept
  // its solar permit and landed on the call list.
  const where = mesaSoqlWhere().toUpperCase();
  const mustFetch = [
    "ESS INSTALL 27 KWH",
    "BESS 13.5 KWH",
    "TESLA POWER-WALL 3",
    "ENERGY-STORAGE SYSTEM",
    "PHOTO-VOLTAIC 6 KW",
  ];
  for (const desc of mustFetch) {
    const reachable = where
      .split(" OR ")
      .some((clause) => {
        const m = clause.match(/LIKE '%(.+)%'/);
        return m ? desc.includes(m[1]) : false;
      });
    check(`coarse filter fetches "${desc}"`, reachable);
  }

  check("hyphenated POWER-WALL is battery", classifyDescription("TESLA POWER-WALL 3") === "battery");
  check("BESS (undotted) is battery", classifyDescription("BESS 13.5 KWH") === "battery");
  check("hyphenated ENERGY-STORAGE is battery", classifyDescription("ENERGY-STORAGE SYSTEM") === "battery");
  check("hyphenated PHOTO-VOLTAIC is solar", classifyDescription("PHOTO-VOLTAIC 6 KW") === "solar");
  check(
    "combined permit with hyphenated battery term still excluded",
    classifyDescription("PV SOLAR 7.2 KW WITH POWER-WALL 3") === "solar+battery"
  );
  check("'SOLAR THERMAL SYSTEM' is not PV", classifyDescription("SOLAR THERMAL SYSTEM") === "other");
  check("'SOLAR ATTIC FAN' is not PV", classifyDescription("SOLAR ATTIC FAN") === "other");
  check(
    "real PV permit that also touches a water heater stays solar",
    classifyDescription("PV SOLAR 8 KW DC AND WATER HEATER REPLACEMENT") === "solar"
  );

  // Phone canonicalization: an 11-digit stored number and a 10-digit scrub
  // result are the same number. Comparing them raw stamped listed numbers
  // "clear" and let opt-outs fail to suppress their own lead.
  check("canonical: +1 (602) 555-1234 -> 6025551234", canonicalPhone("+1 (602) 555-1234") === "6025551234");
  check("canonical: 602-555-1234 -> 6025551234", canonicalPhone("602-555-1234") === "6025551234");
  check("canonical forms of the same number match", canonicalPhone("16025551234") === canonicalPhone("(602) 555-1234"));
  check("isDialable rejects a short number", !isDialable(canonicalPhone("555-1234")));

  // Line type: "Fixed VOIP" must not read as the one dialable type.
  check("'Fixed VOIP' is voip, not landline", normalizeLineType("Fixed VOIP") === "voip");
  check("'Non-Fixed VOIP' is voip", normalizeLineType("Non-Fixed VOIP") === "voip");
  check("'Wireless' still wireless", normalizeLineType("Wireless") === "wireless");
  check("'Landline' still landline", normalizeLineType("Landline") === "landline");

  const openWindow: ComplianceState = {
    san: { number: "SAN-1", recordedAt: now },
    azRegistration: { status: "filed", kind: "roc-limited-44-1272.01", recordedAt: now },
    wirelessSuppression: true,
    lastDncScrubAt: now,
    callWindow: { startHour: 8, endHour: 21 },
  };
  const lead: EnrichedLead = {
    apn: "APNA00000",
    jurisdiction: "mesa",
    address: "101 E MAIN ST",
    phone: { value: { number: "16025551234", lineType: "landline" }, prov: { source: "manual", fetchedAt: now } },
    dnc: { status: "clear", scrubbedAt: now, receipt: "R-1" },
    updatedAt: now,
  };
  check(
    "opt-out in a different format still suppresses the lead",
    !leadDialVerdict(lead, openWindow, new Set([canonicalPhone("(602) 555-1234")]), now).eligible
  );
  check(
    "a retired lead is never dialable",
    !leadDialVerdict({ ...lead, retired: true }, openWindow, new Set(), now).eligible
  );
}

/**
 * Regressions for the 2026-08-10 live-schema addendum: Mesa completion status,
 * the en-dash parsing trap, install semantics, and utility detection.
 */
function runSchemaRegressions() {
  console.log("== live-schema regressions (Mesa)");

  // All twelve observed status strings, including the genuine EN DASH one.
  let statusTotal = 0;
  let completeTotal = 0;
  for (const f of MESA_STATUS_FIXTURES) {
    statusTotal += f.count;
    if (f.expect === "complete") completeTotal += f.count;
    check(`status "${f.status}" -> ${f.expect}`, classifyMesaStatus(f.status) === f.expect);
  }
  check(`status fixtures sum to the live SOLAR total (${MESA_SOLAR_MATCH_BASELINE})`, statusTotal === MESA_SOLAR_MATCH_BASELINE, `got ${statusTotal}`);
  check(`completed solar baseline is ${MESA_COMPLETED_SOLAR_BASELINE}, not ${MESA_SOLAR_MATCH_BASELINE}`, completeTotal === MESA_COMPLETED_SOLAR_BASELINE, `got ${completeTotal}`);

  // The trap that a substring test would fall into.
  check(
    "en-dash 'Finaled – C of C Required' is NOT complete",
    classifyMesaStatus("Finaled – C of C Required") === "ambiguous"
  );
  check(
    "hyphen variant normalizes the same way",
    classifyMesaStatus("Finaled - C of C Required") === "ambiguous"
  );
  check(
    "a naive startsWith('Finaled') would have been wrong — exact match holds",
    classifyMesaStatus("Finaled") === "complete" &&
      classifyMesaStatus("Finaled – C of C Required") !== "complete"
  );
  check("unseen status is 'unknown', not assumed", classifyMesaStatus("Withdrawn") === "unknown");
  check("whitespace/case noise normalizes", classifyMesaStatus("  c of c   ISSUED ") === "complete");

  // Install semantics.
  const trap = "ELECTRICAL PERMIT TO INSTALL 225 AMP PANEL METER MAIN COMBO FOR PV SOLAR";
  check("live trap: panel/meter upgrade FOR PV SOLAR is ancillary", classifyDescription(trap) === "solar-ancillary");
  check("ancillary detector agrees", isAncillaryScope(trap));
  check(
    "service upgrade for solar is ancillary",
    classifyDescription("200 AMP SERVICE UPGRADE FOR SOLAR") === "solar-ancillary"
  );
  check(
    "subpanel for solar is ancillary",
    classifyDescription("INSTALL SUBPANEL FOR PV SOLAR SYSTEM") === "solar-ancillary"
  );
  check(
    "install that ALSO upgrades the panel is still a real install",
    classifyDescription("INSTALL 7.5 KW PV SOLAR AND 200 AMP MAIN PANEL UPGRADE") === "solar"
  );
  check(
    "'SOLAR PANELS' is an array, not a service panel",
    classifyDescription("INSTALL ROOF MOUNTED SOLAR PANELS") === "solar"
  );
  check("plain PV install unaffected", classifyDescription("8.40 KW DC PV SOLAR") === "solar");
  check(
    "panel upgrade for a POWERWALL still subtracts as battery",
    classifyDescription("200 AMP PANEL UPGRADE FOR TESLA POWERWALL") === "battery"
  );

  // Utility named in the text — direct signal.
  check("SRP detected from 'PER SRP SPECIFICATIONS'", detectUtility("... FOR PV SOLAR PER SRP SPECIFICATIONS") === "SRP");
  check("APS detected", detectUtility("PV SOLAR PER APS INTERCONNECTION") === "APS");
  check("no utility named -> undefined", detectUtility("8.40 KW DC PV SOLAR") === undefined);
  check("two utilities named -> undefined, not a guess", detectUtility("SRP AND APS COORDINATION") === undefined);

  // APN join key: Mesa's 8-digit bare form and Maricopa's dashed form must meet.
  check("Mesa bare APN normalizes", normalizeApn("30433505") === "30433505");
  check("Maricopa dashed APN normalizes to the same key", normalizeApn("304-33-505") === "30433505");
}

/**
 * Regressions against the VERBATIM rows that contaminated the first live run.
 * Every string here came out of real Mesa data, not out of imagination.
 */
function runLiveContaminationRegressions(now: string) {
  console.log("== live contamination regressions (real Mesa rows)");

  const asRecord = (description: string, permitType?: string, workType?: string) =>
    mesaRowToRecord(
      {
        permit_number: "X",
        parcel_number: "30400001",
        property_address: "1 TEST ST",
        description_of_work: description,
        status: "C of C Issued",
        permit_type: permitType,
        type_of_work: workType,
      },
      now
    );

  // (c) + (a): commercial structures and oversize systems.
  for (const desc of LIVE_CONTAMINANTS.commercial) {
    const verdict = assessResidential(asRecord(desc)).verdict;
    check(`commercial rejected: "${desc.slice(0, 52)}…"`, verdict === "commercial");
  }
  check(
    "plural CANOPIES caught (a CANOPY-only pattern is how these leaked)",
    assessResidential(asRecord("INSTALL (8) STEEL FRAMED PV SOLAR PARKING CANOPIES")).verdict === "commercial"
  );
  check(
    "singular CANOPY also caught",
    assessResidential(asRecord("PV SOLAR CANOPY OVER PATIO AREA")).verdict === "commercial"
  );
  check("1019.83 kW DC is commercial by size alone", parseKwDc("1019.83 KW DC / 815 KW AC") === 1019.83);
  check("712.215 KWDC parses", parseKwDc("712.215 KWDC") === 712.215);
  check(
    "size ceiling rejects 555 KW",
    assessResidential(asRecord("INSTALL 555 KW SOLAR ARRAY")).verdict === "commercial"
  );

  // The install gate: electrical/service work that names PV but installs none.
  for (const desc of LIVE_CONTAMINANTS.ancillary) {
    const cls = classifyDescription(desc);
    check(`ancillary rejected: "${desc.slice(0, 52)}…"`, cls !== "solar", `got ${cls}`);
  }
  check(
    "hyphenated 200-AMP no longer slips the gate",
    classifyDescription("REPLACE 200-AMP ELECTRICAL PANEL FOR NEW PV SOLAR") === "solar-ancillary"
  );

  // The keepers — and the two traps that would have wrongly rejected them.
  for (const desc of LIVE_CONTAMINANTS.keepers) {
    check(`keeper survives install gate: "${desc.slice(0, 46)}…"`, classifyDescription(desc) === "solar");
  }
  check(
    "keeper survives residential gate despite 'IND-2873.' in its text",
    assessResidential(asRecord(LIVE_CONTAMINANTS.keepers[0], "RES")).verdict === "residential"
  );
  check(
    "RES/COM markers are read from type fields, not description text",
    assessResidential(asRecord("IND-2873. 6.300 KW DC ROOF MOUNTED SOLAR", "RES")).verdict === "residential"
  );
  check(
    "keeper naming CITY OF MESA in an approval clause is NOT commercial",
    assessResidential(asRecord(LIVE_CONTAMINANTS.keepers[1], "RES")).verdict === "residential"
  );
  check(
    "same city name OUTSIDE an approval clause still reads commercial",
    assessResidential(asRecord("PV SOLAR ARRAY AT CITY OF MESA WATER TREATMENT PLANT")).verdict === "commercial"
  );
  check(
    "'does it install PV', not 'does it mention a panel' — panel mention kept",
    classifyDescription("6.300 KW DC ROOF MOUNTED SOLAR WITH (N) 225A MAIN SERVICE PANEL") === "solar"
  );
  check(
    "no size + no residential type is unknown, not a pass",
    assessResidential(asRecord("INSTALL ROOFTOP PV SOLAR SYSTEM")).verdict === "unknown"
  );
}

async function main() {
  const now = new Date().toISOString();
  if (process.argv.includes("--live")) {
    await runLive(now);
  } else {
    runFixtureProof(now);
    runGateProof(now);
    runAuditRegressions(now);
    runSchemaRegressions();
    runLiveContaminationRegressions(now);
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
