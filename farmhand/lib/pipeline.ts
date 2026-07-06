/** CRM-lite: contacts, stages, warmth. Transparent rules — no fake ML. */

export const STAGES = [
  { key: "discovered", label: "Discovered", color: "#8B89A0" },
  { key: "engaged", label: "Engaged", color: "#7DD3FC" },
  { key: "responded", label: "Responded", color: "#38BDF8" },
  { key: "nurtured", label: "Nurtured", color: "#C9A8FF" },
  { key: "consult", label: "Consult", color: "#FFC23D" },
  { key: "active", label: "Active", color: "#41D98A" },
  { key: "closed", label: "Closed", color: "#F4F3F8" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const ORIGINS = ["instagram", "facebook", "reddit", "group", "referral", "website", "event", "manual"] as const;
export type Origin = (typeof ORIGINS)[number];

export type Warmth = "cold" | "warming" | "warm" | "hot";

export interface Contact {
  id: string;
  name: string;
  origin: Origin;
  territory?: string;
  stage: StageKey;
  warmth: Warmth;
  note: string;
  lastTouch: string; // human-relative for demo; ISO once live
  nextTouch?: string;
}

export const WARMTH_META: Record<Warmth, { color: string; label: string }> = {
  cold: { color: "#8B89A0", label: "COLD" },
  warming: { color: "#7DD3FC", label: "WARMING" },
  warm: { color: "#FFC23D", label: "WARM" },
  hot: { color: "#FF5D8F", label: "HOT" },
};

/**
 * Warmth rule (shown in UI): recency × initiative × depth.
 * They contacted you = +2 · replied to you = +1 · gave contact info = +2 ·
 * asked for consult = hot. Decays one band per 3 weeks of silence.
 */
export const SEED_CONTACTS: Contact[] = [
  { id: "c1", name: "Dana M.", origin: "group", territory: "Val Vista Lakes", stage: "responded", warmth: "warm", note: "Asked about lakefront comps in VVL Neighbors thread — DM'd you first", lastTouch: "2d ago", nextTouch: "today" },
  { id: "c2", name: "The Ruiz family", origin: "referral", territory: "Agritopia", stage: "consult", warmth: "hot", note: "Referred by past client · pre-approved · wants spring close", lastTouch: "1d ago", nextTouch: "tomorrow" },
  { id: "c3", name: "@sunfan_az", origin: "instagram", territory: "Heritage District", stage: "engaged", warmth: "warming", note: "Saves every downtown reel · commented twice this month", lastTouch: "5d ago" },
  { id: "c4", name: "Mark T.", origin: "reddit", territory: "Relocation", stage: "discovered", warmth: "cold", note: "r/MovingtoPhoenix — relocating from Chicago in fall, no reply yet", lastTouch: "1w ago" },
];
