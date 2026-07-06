/**
 * People — CRM-lite built for how agents actually make money:
 * fast response, disciplined follow-up, sphere nurture, referral chains.
 * Transparent rules everywhere; no black boxes.
 */

export const STAGES = [
  { key: "new", label: "New", color: "#FF5D8F" },
  { key: "contacted", label: "Contacted", color: "#7DD3FC" },
  { key: "engaged", label: "Engaged", color: "#38BDF8" },
  { key: "nurtured", label: "Nurtured", color: "#C9A8FF" },
  { key: "appointment", label: "Appointment", color: "#FFC23D" },
  { key: "consult", label: "Consult", color: "#FF9A62" },
  { key: "active", label: "Active", color: "#41D98A" },
  { key: "under_contract", label: "Under Contract", color: "#26E0C8" },
  { key: "closed_won", label: "Closed ✓", color: "#F4F3F8" },
  { key: "closed_lost", label: "Lost", color: "#5E5C72" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const ORIGINS = ["instagram", "facebook", "reddit", "group", "referral", "website", "event", "manual"] as const;
export type Origin = (typeof ORIGINS)[number];

export type Warmth = "cold" | "warming" | "warm" | "hot";
export type Motivation = "buying" | "selling" | "both" | "curious";
export type PersonType = "lead" | "buyer" | "seller" | "sphere" | "past_client" | "referral_partner";

export interface Note {
  t: string;
  at: number; // ms
}

export interface Contact {
  id: string;
  name: string;
  origin: Origin;
  territory?: string;
  stage: StageKey;
  warmth: Warmth;
  note: string; // headline context (kept for compat; details live in notes[])
  notes: Note[];
  phone?: string;
  email?: string;
  motivation?: Motivation;
  ctype: PersonType;
  tags: string[];
  dnc?: boolean; // do-not-contact: hard-blocks drafting & contact suggestions
  sourceContext?: string; // the post/thread/event that produced them
  referrer?: string; // who sent them, if referral
  createdAt: number; // ms
  lastTouchAt: number; // ms — updated on any note/log/stage change
  nextTouchAt?: number; // ms
}

export const WARMTH_META: Record<Warmth, { color: string; label: string }> = {
  cold: { color: "#8B89A0", label: "COLD" },
  warming: { color: "#7DD3FC", label: "WARMING" },
  warm: { color: "#FFC23D", label: "WARM" },
  hot: { color: "#FF5D8F", label: "HOT" },
};

const DAY = 86400000;

/* ---------------- derived helpers (all rule-based, all visible) -------- */

export function ageLabel(ms: number): string {
  const d = Date.now() - ms;
  if (d < 3600000) return `${Math.max(1, Math.round(d / 60000))}m`;
  if (d < DAY) return `${Math.round(d / 3600000)}h`;
  return `${Math.round(d / DAY)}d`;
}

/** Respond-queue urgency: green <1h, amber <24h, red beyond. */
export function slaColor(createdAt: number): string {
  const d = Date.now() - createdAt;
  return d < 3600000 ? "#41D98A" : d < DAY ? "#FFC23D" : "#FF5D8F";
}

export function isOverdue(c: Contact): boolean {
  return !!c.nextTouchAt && c.nextTouchAt < Date.now() && !c.stage.startsWith("closed");
}

export function isStale(c: Contact): boolean {
  return Date.now() - c.lastTouchAt > 30 * DAY && !c.stage.startsWith("closed") && c.stage !== "new";
}

export function needsResponse(c: Contact): boolean {
  return c.stage === "new" && !c.dnc;
}

/** Migrate any previously-persisted contact (old shapes) to the new record. */
export function normalizeContact(raw: Record<string, unknown>): Contact {
  const now = Date.now();
  const oldStageMap: Record<string, StageKey> = {
    discovered: "new",
    responded: "engaged",
    closed: "closed_won",
  };
  const stage = (STAGES.some((s) => s.key === raw.stage) ? raw.stage : oldStageMap[String(raw.stage)] || "new") as StageKey;
  return {
    id: String(raw.id ?? `c-${now}`),
    name: String(raw.name ?? "Unknown"),
    origin: (ORIGINS as readonly string[]).includes(String(raw.origin)) ? (raw.origin as Origin) : "manual",
    territory: raw.territory ? String(raw.territory) : undefined,
    stage,
    warmth: (["cold", "warming", "warm", "hot"] as const).includes(raw.warmth as Warmth) ? (raw.warmth as Warmth) : "cold",
    note: String(raw.note ?? ""),
    notes: Array.isArray(raw.notes) ? (raw.notes as Note[]) : [],
    phone: raw.phone ? String(raw.phone) : undefined,
    email: raw.email ? String(raw.email) : undefined,
    motivation: raw.motivation as Motivation | undefined,
    ctype: (["lead", "buyer", "seller", "sphere", "past_client", "referral_partner"] as const).includes(raw.ctype as PersonType)
      ? (raw.ctype as PersonType)
      : "lead",
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    dnc: !!raw.dnc,
    sourceContext: raw.sourceContext ? String(raw.sourceContext) : undefined,
    referrer: raw.referrer ? String(raw.referrer) : undefined,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now - 7 * DAY,
    lastTouchAt: typeof raw.lastTouchAt === "number" ? raw.lastTouchAt : now - 3 * DAY,
    nextTouchAt: typeof raw.nextTouchAt === "number" ? raw.nextTouchAt : undefined,
  };
}

/* ---------------- demo seeds (cleared by clean-data mode) --------------- */

function seed(partial: Partial<Contact> & { id: string; name: string; ageDays: number; touchDays: number }): Contact {
  const now = Date.now();
  return normalizeContact({
    ...partial,
    createdAt: now - partial.ageDays * DAY,
    lastTouchAt: now - partial.touchDays * DAY,
  } as Record<string, unknown>);
}

export const SEED_CONTACTS: Contact[] = [
  seed({ id: "c1", name: "Dana M.", origin: "group", territory: "Val Vista Lakes", stage: "engaged", warmth: "warm", ctype: "seller", motivation: "selling", note: "Asked about lakefront comps in VVL Neighbors thread — DM'd you first", ageDays: 6, touchDays: 2, nextTouchAt: Date.now() - 3600000 }),
  seed({ id: "c2", name: "The Ruiz family", origin: "referral", territory: "Agritopia", stage: "consult", warmth: "hot", ctype: "buyer", motivation: "buying", referrer: "Kim T. (past client)", note: "Referred by past client · pre-approved · wants spring close", ageDays: 12, touchDays: 1, nextTouchAt: Date.now() + DAY }),
  seed({ id: "c3", name: "@sunfan_az", origin: "instagram", territory: "Heritage District", stage: "engaged", warmth: "warming", ctype: "lead", note: "Saves every downtown reel · commented twice this month", ageDays: 20, touchDays: 5 }),
  seed({ id: "c4", name: "Mark T.", origin: "reddit", territory: "Relocation", stage: "new", warmth: "cold", ctype: "buyer", motivation: "buying", note: "r/MovingtoPhoenix — relocating from Chicago in fall, no reply yet", ageDays: 0.2, touchDays: 0.2 }),
  seed({ id: "c5", name: "Kim T.", origin: "manual", territory: "Val Vista Lakes", stage: "nurtured", warmth: "warm", ctype: "past_client", note: "Closed 2023 · sends referrals · loves market updates", ageDays: 400, touchDays: 35 }),
];

/** First-response script, drafted in the agent's voice. */
export function firstResponseScript(c: Contact, agentName: string, tone: string[]): string {
  const warm = tone.includes("warm") || tone.includes("neighborly");
  const opener = warm ? `Hi ${c.name.split(" ")[0]}, this is ${agentName} — ` : `${c.name.split(" ")[0]}, ${agentName} here — `;
  if (c.origin === "event") return `${opener}great meeting you at the open house! No pressure at all — just wanted to say thanks for stopping by. If any questions came up after you left, I'm happy to help.`;
  if (c.motivation === "selling") return `${opener}thanks for reaching out about your home. Happy to pull together what's actually selling near you — no obligation, just real numbers. When's a good time for a quick call?`;
  if (c.motivation === "buying") return `${opener}saw your note about the area — happy to share the honest lay of the land whenever useful. What matters most to you in the move?`;
  return `${opener}thanks for connecting! I live and breathe this area, so if anything home-related ever comes up, consider me your no-pressure resource.`;
}
