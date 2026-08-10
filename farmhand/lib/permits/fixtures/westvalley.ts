/**
 * Peoria and Buckeye fixtures, built from the live-verified field names and
 * values. Raw source-shaped rows, so tests exercise the same row-mappers as
 * live ingest.
 */

import type { PeoriaRow } from "../adapters/peoria";
import { PEORIA_RES_PV_CODE, PEORIA_COM_PV_CODE, PEORIA_BATTERY_FLAG } from "../adapters/peoria";
import type { BuckeyeRow } from "../adapters/buckeye";

/**
 * Peoria rows. Structured everywhere: occupancy from the checklist code,
 * battery from the checkbox, year from the permit-number prefix.
 *
 *   19PV0001 / 30500001  RES PV 2019, no battery                -> TARGET
 *   22PV0002 / 30500002  RES PV 2022, no battery                -> TARGET
 *   21PV0003 / 30500003  RES PV 2021 + battery row same parcel  -> excluded
 *   20PV0004 / 30500004  COM PV 2020                            -> excluded (commercial)
 *   25PV0005 / 30500005  RES PV 2025                            -> excluded (too new)
 *   24PV0006 / 30500006  RES PV 2024                            -> TARGET (window edge)
 */
export function peoriaFixtureRows(): PeoriaRow[] {
  const res = (alt: string, apn: string, addr: string) => ({
    USER_B1_ALT_ID: alt,
    USER_B1_PARCEL_NBR: apn,
    USER_B1_FULL_ADDRESS: addr,
    USER_B1_CHECKLIST_COMMENT: PEORIA_RES_PV_CODE,
    USER_B1_CHECKBOX_DESC: "",
    USER_B1_APPL_STATUS: "Final",
    USER_B1_PER_TYPE: "Building",
    USER_B1_PER_SUB_TYPE: "Photovoltaic",
  });
  return [
    res("19PV0001", "305-00-001", "1 W PEORIA AVE"),
    res("22PV0002", "305-00-002", "2 W PEORIA AVE"),
    res("21PV0003", "305-00-003", "3 W PEORIA AVE"),
    {
      USER_B1_ALT_ID: "21BAT0003",
      USER_B1_PARCEL_NBR: "305-00-003",
      USER_B1_FULL_ADDRESS: "3 W PEORIA AVE",
      USER_B1_CHECKLIST_COMMENT: "",
      USER_B1_CHECKBOX_DESC: PEORIA_BATTERY_FLAG,
      USER_B1_APPL_STATUS: "Final",
    },
    {
      USER_B1_ALT_ID: "20PV0004",
      USER_B1_PARCEL_NBR: "305-00-004",
      USER_B1_FULL_ADDRESS: "4 W PEORIA AVE",
      USER_B1_CHECKLIST_COMMENT: PEORIA_COM_PV_CODE,
      USER_B1_CHECKBOX_DESC: "",
      USER_B1_APPL_STATUS: "Final",
    },
    res("25PV0005", "305-00-005", "5 W PEORIA AVE"),
    res("24PV0006", "305-00-006", "6 W PEORIA AVE"),
  ];
}

export const PEORIA_EXPECTED_TARGETS = ["30500001", "30500002", "30500006"];

/**
 * Buckeye rows. The workclass says Photovoltaic, never Solar. Battery is
 * free-text only, addresses are mostly blank, the APN is the join key.
 *
 *   BLD-001 / 30600001  Photovoltaic System, Finaled, no battery -> TARGET
 *   BLD-002 / 30600002  Photovoltaic Standard Plan + battery text -> excluded
 *   BLD-003 / 30600003  Photovoltaic, status not Finaled          -> excluded (unknown)
 *   BLD-004 / 30600004  Photovoltaic, blank address               -> TARGET (APN join)
 */
export function buckeyeFixtureRows(now: string): BuckeyeRow[] {
  const ms = (yearsAgo: number) => Date.parse(now) - yearsAgo * 365.25 * 86400000;
  return [
    {
      permitnumber: "BLD-001",
      parcelnumber: "306-00-001",
      permitstatus: "Finaled",
      workclass: "Photovoltaic System",
      permitdesc: "INSTALL 7.2 KW DC ROOF MOUNTED PHOTOVOLTAIC SYSTEM",
      finalizedate: ms(4),
      issuedate: ms(4.1),
      situsaddress: "1 N WATSON RD",
      permittype: "Residential",
    },
    {
      permitnumber: "BLD-002",
      parcelnumber: "306-00-002",
      permitstatus: "Finaled",
      workclass: "Photovoltaic Standard Plan",
      permitdesc: "8.0 KW DC PHOTOVOLTAIC WITH TESLA POWERWALL BATTERY BACKUP",
      finalizedate: ms(3),
      situsaddress: "",
      addressline1: "2 N WATSON RD",
      permittype: "Residential",
    },
    {
      permitnumber: "BLD-003",
      parcelnumber: "306-00-003",
      permitstatus: "Issued",
      workclass: "Photovoltaic System",
      permitdesc: "6.0 KW DC ROOF MOUNTED PHOTOVOLTAIC",
      issuedate: ms(3),
      situsaddress: "",
      permittype: "Residential",
    },
    {
      permitnumber: "BLD-004",
      parcelnumber: "306-00-004",
      permitstatus: "Finaled",
      workclass: "Photovoltaic System",
      permitdesc: "5.5 KW DC ROOFTOP PHOTOVOLTAIC SYSTEM",
      finalizedate: ms(5),
      // Both address fields blank — the live layer's normal case for solar rows.
      situsaddress: "",
      addressline1: "",
      permittype: "Residential",
    },
  ];
}

export const BUCKEYE_EXPECTED_TARGETS = ["30600001", "30600004"];
