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
import { hasBatteryEvidence, batteryDetectionMethodFor } from "../lib/permits/batteryMatcher";
import { BATTERY_POSITIVES, BATTERY_NEGATIVES } from "../lib/permits/fixtures/battery";
import { BATTERY_COARSE_TOKENS } from "../lib/permits/coarseNet";
import {
  computeAttachRateByYear,
  checkAttachRateShape,
  ATTACH_RATE_BASELINE,
  LOW_ATTACH_CEILING_PCT,
  HIGH_ATTACH_FLOOR_PCT,
} from "../lib/permits/attachRate";
import { assessResidential, parseKwDc } from "../lib/permits/residential";
import { classifyMesaStatus, MESA_COMPLETED_SOLAR_BASELINE, MESA_SOLAR_MATCH_BASELINE } from "../lib/permits/status";
import { detectUtility } from "../lib/permits/utility";
import { peoriaRowToRecord, peoriaYearFromPermitNumber, PEORIA_VERIFIED } from "../lib/permits/adapters/peoria";
import {
  buckeyeRowToRecord,
  buckeyeWhere,
  classifyBuckeyeStatus,
  BUCKEYE_VERIFIED,
  BUCKEYE_SOLAR_WORKCLASSES,
  BUCKEYE_PV_STATUSES,
  BUCKEYE_LAYER,
} from "../lib/permits/adapters/buckeye";
import { arcgisDistinctValues, assertVocabulary, VocabularyDriftError } from "../lib/permits/adapters/arcgis";
import {
  peoriaFixtureRows,
  buckeyeFixtureRows,
  PEORIA_EXPECTED_TARGETS,
  BUCKEYE_EXPECTED_TARGETS,
} from "../lib/permits/fixtures/westvalley";
import { normalizeApn } from "../lib/permits/types";
import { PERMIT_TAGS } from "../lib/permits/taxonomy";
import { ruleTags, tagPermits, jurisdictionLearned } from "../lib/permits/tagging";
import { classifyWithLlm, llmClassifyEnabled, needsLlmReview, tagsDisagree } from "../lib/permits/llmClassify";
import { defaultComplianceState, evaluateGate, leadDialVerdict, type ComplianceState } from "../lib/permits/comply";
import type { EnrichedLead, Jurisdiction, PermitRecord } from "../lib/permits/types";

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
  check(
    "every target carries battery_evidence=permit-data-only (unpermitted retrofits are invisible)",
    targets.length > 0 && targets.every((t) => t.batteryEvidence === "permit-data-only")
  );

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

/** West Valley adapters: Peoria (structured) and Buckeye (the PHOTOVOLTAIC trap). */
function runWestValleyRegressions(now: string) {
  console.log("== West Valley adapters");

  // --- Peoria: structured occupancy and battery, year from permit prefix.
  const peoriaRecords = peoriaFixtureRows()
    .map((r) => peoriaRowToRecord(r, now))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  check("peoria rows map", peoriaRecords.length === 7, `got ${peoriaRecords.length}`);
  check(
    "peoria battery row uses the SOURCE FLAG, not free text",
    peoriaRecords.some((r) => r.classOverride === "battery" && r.batteryDetection === "source-flag")
  );
  check(
    "peoria RES code sets occupancy structurally",
    peoriaRecords.find((r) => r.permitNumber === "19PV0001")?.occupancyOverride === "residential"
  );
  check(
    "peoria COM code sets occupancy commercial",
    peoriaRecords.find((r) => r.permitNumber === "20PV0004")?.occupancyOverride === "commercial"
  );
  check("peoria year decodes from permit prefix", peoriaYearFromPermitNumber("26PV0001", 2026) === 2026);
  check("peoria year rejects an implausible prefix", peoriaYearFromPermitNumber("99PV0001", 2026) === undefined);
  check(
    "peoria completion source is labeled permit-number-prefix, not a date",
    peoriaRecords[0].completionSource === "permit-number-prefix"
  );
  check(
    "peoria history starts 2019 — the source has no 20 years of depth",
    Math.min(...Object.keys(PEORIA_VERIFIED.yearHistogram).map(Number)) === PEORIA_VERIFIED.historyStartsYear
  );
  check(
    `peoria year histogram sums to ${PEORIA_VERIFIED.distinctResPvParcels} distinct RES PV parcels`,
    Object.values(PEORIA_VERIFIED.yearHistogram).reduce((a, b) => a + b, 0) ===
      PEORIA_VERIFIED.distinctResPvParcels
  );
  const peoriaOut = solarWithoutBattery(peoriaRecords, { now });
  const peoriaApns = peoriaOut.targets.map((t) => t.apn).sort();
  check(
    `peoria targets = ${PEORIA_EXPECTED_TARGETS.join(", ")}`,
    JSON.stringify(peoriaApns) === JSON.stringify([...PEORIA_EXPECTED_TARGETS].sort()),
    `got ${peoriaApns.join(", ") || "(none)"}`
  );
  check("peoria battery parcel excluded via source flag", !peoriaApns.includes("30500003"));
  check("peoria commercial parcel excluded via checklist code", !peoriaApns.includes("30500004"));

  // --- Buckeye: the single most important fact about this source.
  const where = buckeyeWhere().toUpperCase();
  check(
    "buckeye queries PHOTOVOLTAIC — a SOLAR-only workclass query returns zero rows",
    where.includes("PHOTOVOLTAIC") && BUCKEYE_VERIFIED.workclassSolarKeyword === 0
  );
  check("buckeye battery keywords present (free text is the only source here)", where.includes("BATTER"));

  const buckeyeRecords = buckeyeFixtureRows(now).map((r) => buckeyeRowToRecord(r, now));
  check(
    "buckeye flags weaker battery provenance",
    buckeyeRecords.every((r) => r.batteryDetection === "description-only")
  );
  check(
    "buckeye 'Finaled' complete, 'Issued' incomplete (vocabulary now enumerated, not guessed)",
    classifyBuckeyeStatus("Finaled") === "complete" && classifyBuckeyeStatus("Issued") === "incomplete"
  );
  check(
    "buckeye keeps a row whose address fields are both blank (APN is the join key)",
    buckeyeRecords.find((r) => r.permitNumber === "BLD-004")?.apn === "30600004"
  );
  const buckeyeOut = solarWithoutBattery(buckeyeRecords, { now });
  const buckeyeApns = buckeyeOut.targets.map((t) => t.apn).sort();
  check(
    `buckeye targets = ${BUCKEYE_EXPECTED_TARGETS.join(", ")}`,
    JSON.stringify(buckeyeApns) === JSON.stringify([...BUCKEYE_EXPECTED_TARGETS].sort()),
    `got ${buckeyeApns.join(", ") || "(none)"}`
  );
  check("buckeye battery-in-description parcel excluded", !buckeyeApns.includes("30600002"));
  check("buckeye non-Finaled parcel excluded", !buckeyeApns.includes("30600003"));

  // Keyword-independent safety net: a second PV permit dated after the first.
  const twoPv = [
    ...buckeyeFixtureRows(now).slice(0, 1),
    {
      permitnumber: "BLD-001B",
      parcelnumber: "306-00-001",
      permitstatus: "Finaled",
      workclass: "Photovoltaic System",
      // No battery keyword anywhere — this is exactly the case no matcher sees.
      permitdesc: "ADDING MODULES TO EXISTING ARRAY AND DERATE MAIN BREAKER",
      finalizedate: Date.parse(now) - 3 * 365.25 * 86400000,
      permittype: "Residential",
    },
  ].map((r) => buckeyeRowToRecord(r, now));
  const twoPvOut = solarWithoutBattery(twoPv, { now });
  const flagged = twoPvOut.targets.find((t) => t.apn === "30600001");
  check("second PV permit dated after the first is flagged", !!flagged?.reviewFlags?.includes("second-pv-permit"));
  check("and it is counted in stats", twoPvOut.stats.parcelsFlaggedSecondPvPermit === 1);
  check(
    "no battery keyword is involved — the check is keyword-independent",
    !hasBatteryEvidence("ADDING MODULES TO EXISTING ARRAY AND DERATE MAIN BREAKER")
  );
  const flaggedLead: EnrichedLead = {
    apn: "30600001", jurisdiction: "buckeye", address: "1 N WATSON RD",
    phone: { value: { number: "6025551234", lineType: "landline" }, prov: { source: "manual", fetchedAt: now } },
    dnc: { status: "clear", scrubbedAt: now, receipt: "R" },
    needsReview: true, reviewFlags: ["second-pv-permit"], updatedAt: now,
  };
  const openState: ComplianceState = {
    san: { number: "S", recordedAt: now },
    azRegistration: { status: "filed", kind: "roc-limited-44-1272.01", recordedAt: now },
    wirelessSuppression: true, lastDncScrubAt: now, callWindow: { startHour: 8, endHour: 21 },
  };
  check(
    "a flagged lead stays OUT of the dial queue",
    !leadDialVerdict(flaggedLead, openState, new Set(), now).eligible
  );
  check(
    "targets carry the per-jurisdiction detection method",
    twoPvOut.targets.every((t) => t.batteryDetectionMethod === "description_text")
  );
}

/**
 * The vocabulary rule, which is the real lesson of this program: these sources
 * differ in VOCABULARY, not access. A shared keyword list is guaranteed to
 * return zero somewhere, and zero must be an error rather than a result.
 */
async function runVocabularyGuardRegressions() {
  console.log("== vocabulary guard");

  const stubFetch = (distinct: string[]) =>
    (async () =>
      new Response(
        JSON.stringify({ features: distinct.map((v) => ({ attributes: { workclass: v } })) }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as unknown as typeof fetch;

  const live = await arcgisDistinctValues(
    "https://example.test/layer/0",
    "workclass",
    "1=1",
    stubFetch(["Photovoltaic System", "Photovoltaic Standard Plan"])
  );
  check("distinct values read back", live.length === 2 && live.includes("Photovoltaic System"));

  let threw = false;
  try {
    await assertVocabulary(
      "https://example.test/layer/0",
      [{ field: "workclass", expected: ["Photovoltaic System", "Solar PV"] }],
      stubFetch(["Photovoltaic System", "Photovoltaic Standard Plan"])
    );
  } catch (err) {
    threw = err instanceof VocabularyDriftError && err.missing.includes("Solar PV");
  }
  check("a configured value that matches nothing raises VocabularyDriftError", threw);

  let ok = true;
  try {
    await assertVocabulary(
      "https://example.test/layer/0",
      [{ field: "workclass", expected: [...BUCKEYE_SOLAR_WORKCLASSES] }],
      stubFetch(["Photovoltaic System", "Photovoltaic Standard Plan", "Reroof"])
    );
  } catch {
    ok = false;
  }
  check("an intact vocabulary passes", ok);

  // The trap, stated as an assertion: Buckeye renaming its workclass must
  // surface as an error, not as "Buckeye has no solar permits".
  let renamedCaught = false;
  try {
    await assertVocabulary(
      BUCKEYE_LAYER,
      [{ field: "workclass", expected: [...BUCKEYE_SOLAR_WORKCLASSES] }],
      stubFetch(["Solar System", "Solar Standard Plan"]) // city renamed it
    );
  } catch (err) {
    renamedCaught = err instanceof VocabularyDriftError;
  }
  check("a renamed workclass is an ERROR, never a silently empty city", renamedCaught);

  // Buckeye status vocabulary, now fully enumerated.
  check("buckeye 'Finaled' is complete", classifyBuckeyeStatus("Finaled") === "complete");
  check(
    "the other 13 enumerated statuses are incomplete, not unknown",
    BUCKEYE_PV_STATUSES.filter((s) => s !== "Finaled").every((s) => classifyBuckeyeStatus(s) === "incomplete")
  );
  check("a status outside the enumerated 14 is unknown", classifyBuckeyeStatus("Withdrawn") === "unknown");
  check("buckeye enumerated 14 PV statuses", BUCKEYE_PV_STATUSES.length === 14);

  // Buckeye's verified derivation must reconcile.
  const v = BUCKEYE_VERIFIED;
  check(
    `buckeye derivation reconciles: ${v.distinctParcels} − ${v.excludedCombinedPermit} − ${v.excludedSeparateBattery} − ${v.excludedTooNew} = ${v.targets}`,
    v.distinctParcels - v.excludedCombinedPermit - v.excludedSeparateBattery - v.excludedTooNew === v.targets
  );
  check(
    "buckeye undated storage permits are counted, not ignored",
    v.undatedStoragePermits === 102
  );
  check(
    "combined-permit rule outweighs separate battery permits (870 vs 90) — the inside-description scan is load-bearing",
    v.excludedCombinedPermit > v.excludedSeparateBattery * 3
  );
  check("buckeye history starts 2019 — no 20 years of depth to claim", v.historyStartsYear === 2019);
  check("buckeye has a real completion date on every finaled row", v.missingFinalDate === 0);
}

/**
 * Battery detection: the SQL-LIKE trap, the strict matcher, and the attach-rate
 * cross-validation that proves detection is measuring something real.
 */
function runBatteryDetectionRegressions(now: string) {
  console.log("== battery matcher corpus (core infrastructure)");
  // There is no battery permit type in ANY of the three systems, so in Buckeye
  // and Mesa this regex is the only battery signal that exists.
  for (const c of BATTERY_POSITIVES) {
    check(`+ "${c.text.slice(0, 44)}" (${c.why})`, hasBatteryEvidence(c.text));
  }
  for (const c of BATTERY_NEGATIVES) {
    check(`- "${c.text.slice(0, 44)}" (${c.why})`, !hasBatteryEvidence(c.text));
  }
  check(
    "detection method is per-jurisdiction: peoria structured, buckeye/mesa text",
    batteryDetectionMethodFor("peoria") === "structured_flag" &&
      batteryDetectionMethodFor("buckeye") === "description_text" &&
      batteryDetectionMethodFor("mesa") === "description_text"
  );

  console.log("== battery detection");

  // THE RULE: SQL LIKE cannot express a word boundary. Both spellings fail,
  // in opposite and equally unacceptable directions.
  const like = (hay: string, needle: string) => hay.includes(needle);
  check("SQL trap: LIKE '%ESS %' matches 'ADDRESS ' — false battery hit", like("ADDRESS ", "ESS "));
  check(
    "SQL trap: LIKE '% ESS%' MISSES 'ESS INSTALL 27 KWH' — battery permit never fetched",
    !like("ESS INSTALL 27 KWH", " ESS")
  );
  check(
    "so the coarse net contains no ESS/BESS/RESU at all",
    !BATTERY_COARSE_TOKENS.some((t) => ["ESS", "BESS", "RESU"].includes(t))
  );
  check(
    "and 'ESS INSTALL 27 KWH' is still reachable via a safe coarse token",
    BATTERY_COARSE_TOKENS.some((t) => "ESS INSTALL 27 KWH".includes(t))
  );
  check(
    "word-bounded classifier makes the real call: ADDRESS is not a battery",
    classifyDescription("PV SOLAR 6 KW AT SAME ADDRESS") === "solar"
  );

  // The coarse net must span ALL workclasses, not just photovoltaic: 87% of
  // Buckeye battery permits file under 'Photovoltaic System' (already fetched)
  // but 134 sit under 'Misc' and would be lost if the net were narrowed.
  const where = buckeyeWhere();
  const clauses = where.split(/\s+OR\s+/i);
  check(
    "coarse net is NOT restricted to the PV workclass",
    clauses.some((c) => /permitdesc/i.test(c) && !/workclass/i.test(c))
  );
  check("coarse net reaches battery text on any workclass", where.toUpperCase().includes("BATTERY"));

  // Attach-rate cross-validation: the shape, and detection breaking.
  console.log("== attach rate (data quality check)");
  for (const city of ["buckeye", "peoria"]) {
    const base = ATTACH_RATE_BASELINE[city];
    check(
      `${city} pre-2024 attach stays under ${LOW_ATTACH_CEILING_PCT}%`,
      [2019, 2020, 2021, 2022, 2023].every((y) => base[y] < LOW_ATTACH_CEILING_PCT)
    );
    check(`${city} 2025 attach is above ${HIGH_ATTACH_FLOOR_PCT}%`, base[2025] > HIGH_ATTACH_FLOOR_PCT);
  }
  check(
    "cross-validation: two unrelated methods agree on 2025 within 1 point (56.6 vs 57.2)",
    Math.abs(ATTACH_RATE_BASELINE.buckeye[2025] - ATTACH_RATE_BASELINE.peoria[2025]) < 1
  );

  const record = (apn: string, year: number, desc: string, cls?: "solar" | "battery"): PermitRecord => ({
    jurisdiction: "buckeye", permitNumber: `P-${apn}-${year}`, apn, address: "", description: desc,
    finaledAt: `${year}-06-01T00:00:00.000Z`, finaledYear: year,
    completionSource: "finaled", completionStatus: "complete", classOverride: cls, fetchedAt: now,
  });
  // A healthy 2021: 60 parcels, 2 with batteries -> ~3.3%.
  const healthy: PermitRecord[] = [];
  for (let i = 0; i < 60; i++) healthy.push(record(`4000${i}`, 2021, "7 KW DC ROOF MOUNTED PV SOLAR"));
  for (let i = 0; i < 2; i++) healthy.push(record(`4000${i}`, 2021, "TESLA POWERWALL", "battery"));
  const healthyRates = computeAttachRateByYear(healthy);
  check("attach rate computes per parcel", healthyRates[0]?.solarParcels === 60);
  check("healthy 2021 curve raises no warning", checkAttachRateShape("buckeye", healthyRates).length === 0);

  // Detection over-matching: half the 2021 parcels wrongly flagged.
  const broken = [...healthy];
  for (let i = 0; i < 30; i++) broken.push(record(`4000${i}`, 2021, "SAME ADDRESS", "battery"));
  const brokenWarnings = checkAttachRateShape("buckeye", computeAttachRateByYear(broken));
  check("a pre-2024 attach spike is flagged as broken detection", brokenWarnings.length > 0);
  check(
    "the warning names the likely cause",
    brokenWarnings.some((w) => /over-matching/.test(w.message))
  );
}

/**
 * The LLM path, proven WITHOUT an API key: every request goes through a stubbed
 * fetch, so this suite stays offline and deterministic. What is being checked is
 * not the model's judgment — it is that the second path can only ever add
 * information, and fails closed on every abnormal response.
 */
async function runLlmClassificationRegressions(now: string) {
  console.log("== taxonomy + rule tagging");

  check("BATTERY is a first-class tag, independent of SOLAR", PERMIT_TAGS.includes("BATTERY"));
  check("taxonomy is the vendor 15", PERMIT_TAGS.length === 15);

  const install = ruleTags("6.3 KW DC ROOF MOUNTED SOLAR WITH (N) 225A MAIN SERVICE PANEL");
  check("a real PV install tags SOLAR", install.tags.includes("SOLAR"));
  check("...and its panel work tags ELECTRICAL too", install.tags.includes("ELECTRICAL"));
  check("...by rule, at full confidence", install.method === "rule" && install.confidence === 1);

  // The ancillary boundary is the one the vendors draw the same way: a permit
  // that names PV as the REASON for electrical work is not a solar install.
  const ancillary = ruleTags(
    "REPLACE 200-AMP ELECTRICAL PANEL WITH 400-AMP AND INSTALL BI-DIRECTIONAL ELECTRICAL METER FOR NEW PV SOLAR"
  );
  check("an ancillary meter permit does NOT tag SOLAR", !ancillary.tags.includes("SOLAR"));
  check("...it tags ELECTRICAL and ELECTRIC_METER", ancillary.tags.includes("ELECTRICAL") && ancillary.tags.includes("ELECTRIC_METER"));

  check(
    "battery text tags BATTERY without SOLAR",
    (() => {
      const t = ruleTags("INSTALL (2) TESLA POWERWALL 3 WITH BACKUP GATEWAY").tags;
      return t.includes("BATTERY") && !t.includes("SOLAR");
    })()
  );
  check(
    "a structural class from the source is labeled method=source, not rule",
    ruleTags("", "battery").method === "source"
  );
  check(
    "ROOF MOUNT on a solar permit is not roofing work",
    !ruleTags("7 KW ROOF MOUNTED PV SOLAR").tags.includes("ROOFING")
  );

  console.log("== llm classification stage (stubbed transport)");

  check("mesa/buckeye/peoria vocabularies are learned", ["mesa", "buckeye", "peoria"].every((j) => jurisdictionLearned(j as Jurisdiction)));
  check("a city we have never enumerated is not", !jurisdictionLearned("tempe"));
  check(
    "every row of an unlearned jurisdiction goes to the LLM, even a confident one",
    needsLlmReview("7 KW ROOF MOUNTED PV SOLAR", ["SOLAR"], false)
  );
  check(
    "in a learned city only substantive rows the rules missed do",
    needsLlmReview("ADDING MODULES TO EXISTING ARRAY AT REAR OF PROPERTY", [], true) &&
      !needsLlmReview("PV SOLAR", ["SOLAR"], true) &&
      !needsLlmReview("MISC", [], true)
  );
  check("disagreement is measured on SOLAR/BATTERY only", tagsDisagree(["SOLAR"], ["SOLAR", "ROOFING"]) === false);
  check("...and a BATTERY split is a disagreement", tagsDisagree(["SOLAR"], ["SOLAR", "BATTERY"]));

  const stub = (body: unknown, ok = true): typeof fetch =>
    (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  const reply = (results: unknown[]) => ({
    stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "..." }, { type: "text", text: JSON.stringify({ results }) }],
  });

  const priorKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  try {
    const good = await classifyWithLlm(["ADDING MODULES TO EXISTING ARRAY"], {
      fetchImpl: stub(reply([{ index: 0, tags: ["SOLAR"], confidence: 0.8, reason: "installs modules" }])),
    });
    check("a well-formed answer round-trips", good.length === 1 && good[0].tags[0] === "SOLAR");
    check("...labeled method=llm with its own confidence", good[0]?.method === "llm" && good[0]?.confidence === 0.8);

    const dirty = await classifyWithLlm(["X", "Y"], {
      fetchImpl: stub(
        reply([
          { index: 0, tags: ["SOLAR", "NOT_A_TAG"], confidence: 4, reason: "" },
          { index: 9, tags: ["BATTERY"], confidence: 1, reason: "out of range" },
        ])
      ),
    });
    check("tags outside the taxonomy are dropped", dirty.length === 1 && dirty[0].tags.length === 1);
    check("confidence is clamped to 0..1", dirty[0]?.confidence === 1);
    check("an index pointing outside the batch is dropped, never misassigned", !dirty.some((d) => d.index === 9));

    // Failure modes, all of which must return [] so the caller keeps its rules.
    check(
      "a refusal short-circuits before content is read",
      (await classifyWithLlm(["X"], { fetchImpl: stub({ stop_reason: "refusal", content: [] }) })).length === 0
    );
    check(
      "an HTTP error returns nothing rather than throwing",
      (await classifyWithLlm(["X"], { fetchImpl: stub({}, false) })).length === 0
    );
    check(
      "unparseable content returns nothing",
      (await classifyWithLlm(["X"], { fetchImpl: stub({ content: [{ type: "text", text: "sorry!" }] }) })).length === 0
    );
    check(
      "a thinking-only response returns nothing",
      (await classifyWithLlm(["X"], { fetchImpl: stub({ content: [{ type: "thinking", thinking: "hm" }] }) })).length === 0
    );

    // ADD-ONLY, the property the whole stage rests on.
    const rec = (desc: string, j: Jurisdiction): PermitRecord => ({
      jurisdiction: j, permitNumber: "P1", apn: "12345678", address: "", description: desc,
      completionSource: "unverified", completionStatus: "unknown", fetchedAt: now,
    });
    const hostile = await tagPermits([rec("7 KW DC ROOF MOUNTED PV SOLAR", "tempe")], {
      useLlm: true,
      fetchImpl: stub(reply([{ index: 0, tags: ["ROOFING"], confidence: 0.9, reason: "wrong" }])),
    });
    check(
      "the LLM cannot clear a rule tag: SOLAR survives a contradicting answer",
      hostile.records[0].classification?.tags.includes("SOLAR") === true
    );
    check("...and the contradiction is counted, not silently dropped", hostile.stats.disagreements === 1);
    check(
      "...against the jurisdiction, which is where a vocabulary gap shows up",
      hostile.stats.disagreementsByJurisdiction.tempe === 1
    );

    // The real Buckeye row: an array install that never writes "solar" or "PV",
    // so the keyword rules return nothing. This is the case the second path exists for.
    const filled = await tagPermits([rec("ADDING MODULES TO EXISTING ARRAY AT REAR OF PROPERTY", "tempe")], {
      useLlm: true,
      fetchImpl: stub(reply([{ index: 0, tags: ["SOLAR"], confidence: 0.7, reason: "array install" }])),
    });
    check("the LLM fills a row the rules left empty", filled.stats.llmAddedTags === 1);
    check("...and that row is labeled llm, not rule", filled.records[0].classification?.method === "llm");

    const learnedOnly = await tagPermits([rec("7 KW DC ROOF MOUNTED PV SOLAR", "mesa")], {
      useLlm: true,
      fetchImpl: stub(reply([{ index: 0, tags: ["ROOFING"], confidence: 1, reason: "should never run" }])),
    });
    check(
      "a confident row in a learned city never reaches the LLM at all",
      learnedOnly.stats.sentToLlm === 0 && learnedOnly.stats.ruleOnly === 1
    );

    const off = await tagPermits([rec("SOMETHING UNRECOGNIZED ENTIRELY BY THE RULES", "tempe")], {
      fetchImpl: stub(reply([{ index: 0, tags: ["SOLAR"], confidence: 1, reason: "" }])),
    });
    check("the stage is off by default — rules still run, no call is made", off.stats.sentToLlm === 0);
    check("...and records still come back classified", off.records[0].classification?.method === "rule");
  } finally {
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = priorKey;
  }

  check("with no API key configured the stage is simply off", (() => {
    const k = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const enabled = llmClassifyEnabled();
    if (k !== undefined) process.env.ANTHROPIC_API_KEY = k;
    return !enabled;
  })());
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
    runWestValleyRegressions(now);
    await runVocabularyGuardRegressions();
    runBatteryDetectionRegressions(now);
    await runLlmClassificationRegressions(now);
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
