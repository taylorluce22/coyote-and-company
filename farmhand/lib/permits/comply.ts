/**
 * COMPLY — first-class HARD GATE. The system is structurally unable to dial:
 * no code path in the app emits a dialable phone number unless BOTH
 *   1. the gate is armed  — evaluateGate() passes every requirement, and
 *   2. dialing is enabled — the PERMITS_DIALING_ENABLED env var is "true".
 * The env var ships ABSENT (dialing OFF): flipping it is a deliberate
 * server-config act, not a UI click. Until then the module is list-building
 * + compliance-armed only, and every API response masks numbers.
 *
 * Gate requirements (all of):
 *   (a) FTC SAN on file — the DNC-registry subscription account number;
 *   (b) AZ telephonic-seller registration status recorded — the
 *       ROC-licensed-installer path is confirmed, so this is the free
 *       limited registration under A.R.S. 44-1272.01 (a flag to record,
 *       not a blocker to wait on);
 *   (c) wireless suppression active (config default ON — A.R.S.
 *       44-1278(B)(3) likely bars cold calls to AZ cell phones);
 *   (d) National DNC scrub no older than 31 days.
 *
 * Per-number rules on top of the gate: internal do-not-call honored
 * instantly (list retained 10 years); wireless/voip/unknown line types
 * suppressed while suppression is on; per-lead scrub result must be "clear"
 * and fresh; call-window guard 8am–9pm legal bound at the CALLED party's
 * location derived from the parcel address (never area code), default
 * window 9am–8pm.
 *
 * Manual click-to-dial only, one human-initiated call at a time. NO
 * predictive/power dialer, NO prerecorded or AI voice, NO ringless
 * voicemail, NO cold SMS — none of that machinery exists in this codebase,
 * and it must not be added behind this gate.
 *
 * Pure lib: callers inject `now`.
 */

import type { EnrichedLead } from "./types";
import { canonicalPhone } from "./phone";

export const DNC_SCRUB_MAX_AGE_DAYS = 31;
export const INTERNAL_DNC_RETENTION_YEARS = 10;
export const COMPLIANCE_LOG_RETENTION_YEARS = 5; // minimum — nothing here auto-prunes
export const LEGAL_CALL_START_HOUR = 8; // 8am at the called party's location
export const LEGAL_CALL_END_HOUR = 21; // 9pm
export const DEFAULT_CALL_START_HOUR = 9;
export const DEFAULT_CALL_END_HOUR = 20;

export interface ComplianceState {
  /** FTC Subscription Account Number for National DNC registry access. */
  san?: { number: string; recordedAt: string };
  azRegistration?: {
    status: "not_filed" | "filed" | "active";
    kind: "roc-limited-44-1272.01" | "full";
    reference?: string;
    recordedAt: string;
  };
  /** Default ON. Turning it off disarms the whole gate — no wireless carve-out without a consent model. */
  wirelessSuppression: boolean;
  /** Completed National DNC scrub for this client's current numbers. */
  lastDncScrubAt?: string;
  /** Clamped into the 8–21 legal bound; defaults 9–20. */
  callWindow: { startHour: number; endHour: number };
}

export function defaultComplianceState(): ComplianceState {
  return {
    wirelessSuppression: true,
    callWindow: { startHour: DEFAULT_CALL_START_HOUR, endHour: DEFAULT_CALL_END_HOUR },
  };
}

export function clampCallWindow(w: { startHour: number; endHour: number }): { startHour: number; endHour: number } {
  const start = Math.max(LEGAL_CALL_START_HOUR, Math.min(20, Math.floor(w.startHour)));
  const end = Math.max(start + 1, Math.min(LEGAL_CALL_END_HOUR, Math.floor(w.endHour)));
  return { startHour: start, endHour: end };
}

export function scrubIsFresh(scrubbedAt: string | undefined, nowIso: string): boolean {
  if (!scrubbedAt) return false;
  const age = Date.parse(nowIso) - Date.parse(scrubbedAt);
  return Number.isFinite(age) && age >= 0 && age <= DNC_SCRUB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export interface GateResult {
  /** Every compliance requirement satisfied. */
  armed: boolean;
  /** Server config PERMITS_DIALING_ENABLED === "true". Ships absent = OFF. */
  dialingEnabled: boolean;
  /** armed AND dialingEnabled — the only condition under which a phone number leaves the server unmasked. */
  canDial: boolean;
  blockers: string[];
}

export function dialingEnabledByEnv(): boolean {
  return process.env.PERMITS_DIALING_ENABLED === "true";
}

export function evaluateGate(state: ComplianceState, nowIso: string): GateResult {
  const blockers: string[] = [];
  if (!state.san?.number) blockers.push("FTC SAN not on file");
  if (!state.azRegistration?.recordedAt) {
    blockers.push("AZ telephonic-seller registration not recorded (ROC path: free limited registration, A.R.S. 44-1272.01)");
  }
  if (!state.wirelessSuppression) blockers.push("wireless suppression is OFF — must be active to arm");
  if (!scrubIsFresh(state.lastDncScrubAt, nowIso)) {
    blockers.push(`National DNC scrub missing or older than ${DNC_SCRUB_MAX_AGE_DAYS} days`);
  }
  const armed = blockers.length === 0;
  const dialingEnabled = dialingEnabledByEnv();
  return { armed, dialingEnabled, canDial: armed && dialingEnabled, blockers };
}

/**
 * Timezone at the CALLED party's location, from the parcel address — never
 * from the phone's area code. P0 jurisdictions are all Arizona (Mesa /
 * Maricopa County): America/Phoenix, no DST. Revisit when an adapter
 * outside Arizona lands.
 */
export function timezoneForLead(_lead: Pick<EnrichedLead, "address" | "jurisdiction">): string {
  return "America/Phoenix";
}

export function localHour(nowIso: string, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(
    new Date(nowIso)
  );
  return Number(h) % 24;
}

export function withinCallWindow(state: ComplianceState, nowIso: string, timeZone: string): boolean {
  const w = clampCallWindow(state.callWindow);
  const hour = localHour(nowIso, timeZone);
  return hour >= w.startHour && hour < w.endHour;
}

export type DialVerdict = { eligible: true } | { eligible: false; reason: string };

/**
 * Per-lead eligibility, applied on top of an armed gate. Order matters:
 * opt-outs and the internal DNC list are honored before anything else.
 */
export function leadDialVerdict(
  lead: EnrichedLead,
  state: ComplianceState,
  internalDncNumbers: ReadonlySet<string>,
  nowIso: string
): DialVerdict {
  if (lead.optedOutAt || lead.internalDnc) return { eligible: false, reason: "internal do-not-call" };
  if (lead.retired) return { eligible: false, reason: "retired — no longer in the current target list" };
  if (lead.needsReview) {
    return {
      eligible: false,
      reason: `held for review: ${(lead.reviewFlags ?? ["unspecified"]).join(", ")}`,
    };
  }
  const phone = lead.phone?.value;
  if (!phone?.number) return { eligible: false, reason: "no phone on file" };
  // Caller supplies a canonicalized set; canonicalize this side too so the
  // membership test can't miss on formatting.
  if (internalDncNumbers.has(canonicalPhone(phone.number))) {
    return { eligible: false, reason: "internal do-not-call" };
  }
  if (state.wirelessSuppression && phone.lineType !== "landline") {
    return { eligible: false, reason: `line type ${phone.lineType} suppressed (wireless suppression ON)` };
  }
  if (!lead.dnc || lead.dnc.status === "unknown") return { eligible: false, reason: "not DNC-scrubbed" };
  if (lead.dnc.status === "listed") return { eligible: false, reason: "on National DNC registry" };
  if (!scrubIsFresh(lead.dnc.scrubbedAt, nowIso)) {
    return { eligible: false, reason: `DNC scrub older than ${DNC_SCRUB_MAX_AGE_DAYS} days` };
  }
  if (!withinCallWindow(state, nowIso, timezoneForLead(lead))) {
    return { eligible: false, reason: "outside call window at called party's local time" };
  }
  return { eligible: true };
}

/** Mask a number for any response where canDial is false: structural inability to dial. */
export function maskPhone(number: string): string {
  return number.length <= 4 ? "****" : `•••-•••-${number.slice(-4)}`;
}

export type ComplianceLogKind =
  | "gate-change"
  | "scrub"
  | "call"
  | "opt-out"
  | "config"
  | "vendor-license";

export interface ComplianceLogEntry {
  at: string;
  kind: ComplianceLogKind;
  detail: string;
  data?: Record<string, unknown>;
}

export interface InternalDncEntry {
  number: string;
  addedAt: string; // retained 10 years minimum — never auto-pruned
  apn?: string;
  reason?: string;
}
