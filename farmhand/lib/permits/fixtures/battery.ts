/**
 * Battery matcher corpus.
 *
 * This exists as its own fixture suite because of a structural finding: there
 * is no battery permit type in ANY of the three live systems, so in Buckeye
 * and Mesa a word-bounded regex over free text is the ONLY battery signal that
 * exists. The matcher carries the correctness of the product in two of three
 * cities, and a false negative here puts a battery-owning household on a cold
 * call list.
 *
 * NEGATIVES matter as much as positives: every one below is a string that a
 * plausible-looking matcher has actually mis-fired on.
 */

export const BATTERY_POSITIVES: Array<{ text: string; why: string }> = [
  { text: "TESLA POWERWALL 3", why: "canonical" },
  { text: "TESLA POWER WALL", why: "space variant" },
  { text: "TESLA POWER-WALL 2", why: "hyphen variant" },
  { text: "PW3 INSTALL", why: "abbreviated" },
  { text: "PW 2 BACKUP", why: "abbreviated with space, PW2 as well as PW3" },
  { text: "INSTALL B.E.S.S. 27 KWH", why: "dotted acronym" },
  { text: "BESS 13.5 KWH", why: "undotted acronym" },
  { text: "ESS INSTALL 27 KWH", why: "bare ESS, the token SQL cannot safely match" },
  { text: "ENERGY STORAGE SYSTEM", why: "spelled out" },
  { text: "ENERGY-STORAGE SYSTEM", why: "hyphenated" },
  { text: "STORAGE SYSTEM 10 KWH", why: "storage system phrasing" },
  { text: "13.5 KWH BACKUP", why: "capacity in kWh" },
  { text: "13.5KWH BACKUP", why: "capacity glued to the number" },
  { text: "ENPHASE ENCHARGE 10", why: "brand: Enphase" },
  { text: "IQ BATTERY 5P", why: "brand: Enphase IQ" },
  { text: "GENERAC PWRCELL", why: "brand: Generac" },
  { text: "FRANKLIN WH APOWER", why: "brand: FranklinWH, spaced" },
  { text: "FRANKLINWH APOWER", why: "brand: FranklinWH, joined" },
  { text: "SONNEN ECOLINX", why: "brand: sonnen" },
  { text: "EG4 18KPV", why: "brand: EG4" },
  { text: "SIMPLIPHI PHI 3.8", why: "brand: SimpliPhi" },
  { text: "LG RESU 10H", why: "brand: LG RESU" },
  { text: "TESLA BACKUP GATEWAY", why: "gateway phrasing" },
  { text: "ENERGY BANK INSTALL", why: "energy bank phrasing" },
  { text: "TESLA INVERTER AND GATEWAY", why: "bare TESLA — 614 Buckeye permits never say Powerwall" },
  { text: "PV SOLAR 7.2 KW WITH BATTERY BACKUP 13.5KWH", why: "combined permit, the load-bearing case" },
  { text: "200 AMP PANEL UPGRADE FOR TESLA POWERWALL", why: "ancillary work still proves a battery" },
];

export const BATTERY_NEGATIVES: Array<{ text: string; why: string }> = [
  { text: "PV SOLAR 6 KW AT SAME ADDRESS", why: "ADDRESS contains ESS — the SQL LIKE trap" },
  { text: "PROCESS UPGRADE AT SITE", why: "PROCESS contains ESS" },
  { text: "ASSESSMENT OF EXISTING ROOF", why: "ASSESSMENT contains ESS" },
  { text: "ACCESS PANEL REPLACEMENT", why: "ACCESS contains ESS" },
  { text: "PLAN RESULTS ATTACHED", why: "RESULTS contains RESU — 815 Buckeye rows" },
  { text: "RESUBMIT CORRECTED PLANS", why: "RESUBMIT contains RESU" },
  { text: "8.40 KW DC PV SOLAR", why: "a plain PV install: kW DC is array size, not kWh capacity" },
  { text: "7.20 KW DC PV SOLAR ROOF MOUNT", why: "plain PV install" },
  { text: "SOLAR WATER HEATER REPLACEMENT", why: "solar thermal, no storage" },
  { text: "INSTALL 225 AMP PANEL METER MAIN COMBO FOR PV SOLAR", why: "ancillary electrical, no battery" },
  { text: "REPLACE 200-AMP ELECTRICAL PANEL FOR NEW PV SOLAR", why: "ancillary electrical, no battery" },
  { text: "ADDING MODULES TO EXISTING ARRAY", why: "array expansion — the second-PV-permit case, not a battery" },
  { text: "AND DERATE MAIN BREAKER", why: "array expansion companion text" },
];
