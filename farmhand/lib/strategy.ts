/**
 * StrategyProfile — the personalization spine.
 * Onboarding writes it; every screen renders from it.
 * Persisted in the app store (localStorage today, Supabase adapter later).
 */

import { SOLAR_KB_CONTENT } from "./azEnergyKb";
import { AZ_TERRITORY_CATALOG, TERRITORY_HEXES } from "./azTerritories";

export type ProspectingMode = "observer" | "participant" | "connector";
export type Segment = "luxury" | "growth" | "entry" | "custom";

export interface Territory {
  slug: string;
  name: string;
  city: string;
  segment: Segment;
  status: "own" | "building" | "exploring";
  img?: string;
  hex: string;
  kind?: "neighborhood" | "zip" | "subdivision" | "school-zone";
  // solar vertical: which electric utility serves this territory (aps |
  // verify — the business is APS-only). Anything not confirmed APS gets
  // verify-first framing, never APS rate math.
  utility?: string;
}

export interface StrategyProfile {
  vertical?: "realtor" | "solar"; // which LocalOS vertical this account runs (default realtor)
  name: string;
  brokerage: string;
  licenseNo: string;
  experience: "new" | "building" | "established";
  homeBase: string;
  territories: Territory[];
  positioning: string[]; // ≤2
  idealClient: "buyers" | "sellers" | "both" | "investors";
  strengths: string; // "what do clients say you're great at"
  platforms: string[];
  tone: string[]; // 3 chips
  cameraComfort: "love" | "tolerate" | "avoid";
  prospectingMode: ProspectingMode;
  followUpHonesty: "great" | "week" | "drop";
  offLimits: string;
  postingTarget: 3 | 5 | 7; // posts per week they can actually sustain
  goal90d: "listings" | "buyers" | "new-market" | "revival";
  timeBudget: "daily20" | "few-hours" | "weekend-batch";
}

/** Arizona territory picker seeds. PV = luxury prestige, Buckeye = growth volume. */
export const AZ_AREAS: Omit<Territory, "status">[] = [
  { slug: "paradise-valley", name: "Paradise Valley", city: "Paradise Valley", segment: "luxury", hex: "#FF5D8F", img: "/neighborhoods/paradise-valley.jpg" },
  { slug: "buckeye", name: "Buckeye", city: "Buckeye", segment: "growth", hex: "#FF9A62", img: "/neighborhoods/buckeye.jpg" },
  { slug: "scottsdale-north", name: "North Scottsdale", city: "Scottsdale", segment: "luxury", hex: "#C9A8FF", img: "/neighborhoods/scottsdale.jpg" },
  { slug: "gilbert-val-vista", name: "Val Vista Lakes", city: "Gilbert", segment: "entry", hex: "#38BDF8", img: "/neighborhoods/val-vista-lakes.jpg" },
  { slug: "gilbert-agritopia", name: "Agritopia", city: "Gilbert", segment: "growth", hex: "#41D98A", img: "/neighborhoods/agritopia.jpg" },
  { slug: "gilbert-heritage", name: "Heritage District", city: "Gilbert", segment: "entry", hex: "#26E0C8", img: "/neighborhoods/heritage-district.jpg" },
  { slug: "queen-creek", name: "Queen Creek", city: "Queen Creek", segment: "growth", hex: "#FFC23D", img: "/neighborhoods/queen-creek.jpg" },
  { slug: "surprise", name: "Surprise", city: "Surprise", segment: "entry", hex: "#7DD3FC", img: "/neighborhoods/surprise.jpg" },
];

export const POSITIONING_OPTS = [
  { key: "luxury", label: "Luxury & prestige" },
  { key: "growth", label: "Suburban growth" },
  { key: "first-time", label: "First-time buyers" },
  { key: "investor", label: "Investors" },
  { key: "relocation", label: "Relocation" },
  { key: "generalist", label: "Generalist" },
];

export const TONE_CHIPS = ["warm", "sharp", "funny", "data-driven", "neighborly", "polished", "direct", "storyteller"];

export const PLATFORM_OPTS = [
  { key: "instagram", label: "Instagram" },
  { key: "fb-page", label: "Facebook Page" },
  { key: "fb-groups", label: "Facebook Groups" },
  { key: "nextdoor", label: "Nextdoor" },
  { key: "reddit", label: "Reddit" },
];

/**
 * Solar-vertical default territories — the owner's REAL configuration, so a
 * fresh device (phone, new browser) boots straight into the all-West-Valley
 * APS-only strategy with nothing to re-select. This is the "run all West
 * Valley" decision (July 2026 pivot) applied as the default: the entire
 * territory catalog, not a starter subset.
 */
export const SOLAR_TERRITORIES: Territory[] = AZ_TERRITORY_CATALOG.map((c, i) => ({
  slug: c.slug,
  name: c.name,
  city: c.city,
  segment: "growth" as const,
  status: "building" as const,
  hex: TERRITORY_HEXES[i % TERRITORY_HEXES.length],
  utility: c.utility,
}));

export const DEFAULT_STRATEGY: StrategyProfile = {
  name: "Jess",
  brokerage: "Desert Sky Realty",
  licenseNo: "AZ-SA-6841029",
  experience: "building",
  homeBase: "Gilbert",
  territories: AZ_AREAS.slice(3, 6).map((a) => ({ ...a, status: "building" as const })),
  positioning: ["growth"],
  idealClient: "both",
  strengths: "",
  platforms: ["instagram", "fb-page", "fb-groups"],
  tone: ["warm", "neighborly", "data-driven"],
  cameraComfort: "tolerate",
  prospectingMode: "participant",
  followUpHonesty: "week",
  offLimits: "",
  postingTarget: 5,
  goal90d: "listings",
  timeBudget: "daily20",
};

/* ------------------------------------------------------------------ */
/* Derived configuration — how the profile personalizes the app        */
/* ------------------------------------------------------------------ */

/** Content idea templates keyed by segment + positioning. */
const IDEA_BANK: Record<string, { title: string; angle: string; format: "carousel" | "reel" | "story" | "text"; theme: string }[]> = {
  luxury: [
    { title: "What longer days-on-market means for {n} sellers", angle: "calm, data-first take — position as the steady hand", format: "carousel", theme: "seller-education" },
    { title: "What ${price} actually buys in {n} right now", angle: "3-property comparison carousel, no addresses", format: "carousel", theme: "market" },
    { title: "The {n} micro-markets most agents lump together", angle: "insider segmentation — instant authority", format: "text", theme: "authority" },
    { title: "Anatomy of a quiet {n} sale", angle: "how discreet listings work — luxury sellers care", format: "text", theme: "seller-education" },
  ],
  growth: [
    { title: "Why families keep choosing {n}", angle: "schools + commute + new builds, told through one family's decision", format: "carousel", theme: "community" },
    { title: "New-build vs. resale in {n}: the honest math", angle: "monthly-cost table — screenshots get shared", format: "carousel", theme: "buyer-education" },
    { title: "{n} in 90 seconds for out-of-state buyers", angle: "reel: drive-through + 3 numbers + 1 tip", format: "reel", theme: "community" },
    { title: "What ${price} gets you in {n} vs. 10 miles closer in", angle: "the trade-off post — sparks comments", format: "carousel", theme: "market" },
  ],
  entry: [
    { title: "First-home playbook for {n}", angle: "5 steps, zero jargon, save-worthy checklist", format: "carousel", theme: "buyer-education" },
    { title: "The {n} streets where starter homes still exist", angle: "hyper-specific = trust; no addresses, just areas", format: "text", theme: "market" },
    { title: "Rent vs. buy in {n} this year", angle: "real numbers with today's rates — update quarterly", format: "carousel", theme: "buyer-education" },
  ],
};

/** Conversion pack — applies to every territory; the content that books appointments. */
const CONVERSION_BANK: { title: string; angle: string; format: "carousel" | "reel" | "story" | "text"; theme: string }[] = [
  { title: "3 things {n} sellers fix that buyers never notice", angle: "myth-busting saves sellers money — instant trust", format: "carousel", theme: "myth-busting" },
  { title: "“We'll just wait for rates to drop” — the honest math", angle: "objection-handling with real numbers, zero pressure", format: "carousel", theme: "objection-handling" },
  { title: "What my last {n} client said after closing", angle: "social proof — quote card, first name only, with permission", format: "story", theme: "social-proof" },
  { title: "How I knew this {n} home was overpriced (and what we did)", angle: "story of advocacy — sellers remember who protects them", format: "reel", theme: "seller-education" },
  { title: "The question I wish every buyer asked me", angle: "authority through generosity — answer it fully", format: "text", theme: "authority" },
  { title: "Know someone moving to {n}? Here's what I send them", angle: "referral prompt disguised as a resource — highly shareable", format: "carousel", theme: "referral" },
];

/* --------- solar content banks — AZ homeowner education, Instagram-first ---------- */

/* decks = the post's actual slides, written to deliver the title's promise */
const SOLAR_IDEA_BANK: IdeaSeed[] = [
  {
    title: "What a $320 APS bill looks like after solar in {n}",
    angle: "real before/after bill breakdown — screenshots get shared and saved",
    format: "carousel",
    theme: "bill-breakdown",
    deck: [
      "A $320 summer bill is mostly the 4–7pm window: about 34¢/kWh on-peak vs ~12¢ off-peak.",
      "Solar sized to your usage kills the daytime piece. Shifting big loads off-peak kills most of the rest.",
      "Exports only earn ~6.2¢/kWh — so right-sizing beats over-sizing every single time.",
    ],
  },
  {
    title: "The 3 questions to ask ANY solar company before you talk price",
    angle: "authority through generosity — quality and process before price; protects people from bad installs",
    format: "carousel",
    theme: "buyer-education",
    deck: [
      "1. Who's actually on my roof — your crew or subs — and how is every penetration flashed?",
      "2. Which export rate and rate plan does your savings math assume? (APS credits ~6.2¢/kWh, locked 10 years.)",
      "3. Who answers the phone in year five if something goes wrong?",
    ],
  },
  {
    title: "The October bill cliff nobody warns you about",
    angle: "the summer shutoff moratorium pauses bills but doesn't forgive them — resource-first honesty about the debt cliff, assistance before solar",
    format: "carousel",
    theme: "bill-breakdown",
    deck: [
      "APS and other regulated utilities can't disconnect you June 1 – Oct 15. But the balance isn't forgiven — it all comes due when the pause lifts.",
      "Assistance agencies report people walking in with $1,600 October balances. If summer bills are burying you, act in July — not October.",
      "Free moves first: a payment plan before the debt stacks, a rate-plan check, and shifting the big loads out of the 4–7pm window.",
    ],
  },
  {
    title: "Why Arizona's 'free solar' ads aren't free — the honest version",
    angle: "call out your own industry's worst pitch; honesty is the differentiator",
    format: "text",
    theme: "myth-busting",
    deck: [
      "'Free solar' means a lease or PPA: you buy the power, they own the system on your roof.",
      "It prices differently because the leasing company can still claim a commercial tax credit — homeowners can't anymore.",
      "Sometimes a lease genuinely fits. But nobody is giving away $25k of hardware. Ever.",
    ],
  },
  {
    title: "The rate-plan check that saves {n} homeowners money BEFORE solar",
    angle: "on-peak vs off-peak explained — free value first, no pitch",
    format: "carousel",
    theme: "bill-breakdown",
    deck: [
      "APS runs three main plans — flat, time-of-use, and demand. Being on the wrong one costs real money.",
      "Matching your plan to how you actually live is free and takes about ten minutes.",
      "I run this check before quoting anyone — sometimes it shrinks the bill enough to change the system size.",
    ],
  },
  {
    title: "How much roof a real 10kW system needs in {n}",
    angle: "reel: pace out a roof on camera — concrete beats abstract",
    format: "reel",
    theme: "buyer-education",
    deck: [
      "A 10kW system is roughly 24–25 modern panels — call it 500+ square feet of clear, well-facing roof.",
      "Vents, valleys and fire setbacks eat more space than people expect. Paper designs love to ignore them.",
      "Tight roof? A smaller system plus load-shifting usually beats cramming panels onto bad angles.",
    ],
  },
  {
    title: "West-facing vs. south-facing in AZ: what the production data says",
    angle: "counterintuitive local knowledge (west wins on-peak) — instant credibility",
    format: "text",
    theme: "authority",
    deck: [
      "South-facing wins on total annual kWh. West-facing wins where it counts: the 4–7pm on-peak window.",
      "When on-peak power costs ~34¢ and exports pay ~6.2¢, WHEN you produce beats how much.",
      "The best designs here often split the array — south for volume, west for the expensive hours.",
    ],
  },
  {
    title: "Buying a new build in {n}? Read this before the builder's solar offer",
    angle: "new-homeowner moment — they're deciding NOW and nobody's helping them",
    format: "carousel",
    theme: "new-homeowner",
    deck: [
      "Builder solar rolls into the mortgage — convenient, but compare its price per watt against outside quotes first.",
      "Confirm the lot is on APS and ask which rate plan the builder's math assumes — exports credit ~6.2¢/kWh, locked 10 years.",
      "Get the rate plan and export terms in writing before closing — 'solar-ready' and 'solar-smart' are not the same thing.",
    ],
  },
  {
    title: "EV + solar in {n}: the real math for charging at home",
    angle: "the EV crowd runs the numbers — give them numbers worth running",
    format: "carousel",
    theme: "battery-ev",
    deck: [
      "A typical EV adds roughly 3,000–4,000 kWh a year — charging at 4–7pm on APS costs about 3x the overnight rate.",
      "Overnight off-peak charging is the free fix. Panels sized for the extra load are the permanent one.",
      "Exports only pay ~6.2¢ on APS — so size for what you'll actually use, EV included, not for bragging rights.",
    ],
  },
  {
    title: "How to read your neighbor's solar brag post",
    angle: "kWh vs. savings vs. offset — decode the jargon people actually see on Nextdoor",
    format: "text",
    theme: "myth-busting",
    deck: [
      "kWh produced is not dollars saved. Production is weather; savings are rate-plan math.",
      "'100% offset' means annual energy, not a $0 bill — fixed charges and evening peaks still land.",
      "The numbers that matter: what they paid per watt, and what their evening usage looks like. Ask those.",
    ],
  },
];

const SOLAR_CONVERSION_BANK: IdeaSeed[] = [
  {
    title: "What my last {n} install actually cost per watt",
    angle: "radical transparency — real numbers are rare in solar and get remembered",
    format: "carousel",
    theme: "social-proof",
    deck: [
      "Price per watt, pre-incentive, all-in — the one number that makes every solar quote comparable.",
      "Arizona's honest range is wide, and confusing quotes keep it that way on purpose.",
      "I share real numbers because this industry mostly won't. That's the whole differentiator.",
    ],
  },
  {
    title: "3 red flags I found in a quote someone sent me this week",
    angle: "story of advocacy — position as the person who reviews quotes, not sells them",
    format: "story",
    theme: "authority",
    deck: [
      "Red flag 1: savings math built on old export rates. APS pays ~6.2¢/kWh now — not the 12.9¢ of 2017.",
      "Red flag 2: no price per watt anywhere on the page. That is never an accident.",
      "Red flag 3: 'the federal credit covers 30%.' For homeowner purchases installed after 2025, it's $0.",
    ],
  },
  {
    title: "“We'll wait for the tech to get better” — the honest math on waiting",
    angle: "objection-handling with real payback numbers, zero pressure",
    format: "carousel",
    theme: "objection-handling",
    deck: [
      "Panel tech improves single digits a year. APS's export rate has dropped ~10% every September since 2017.",
      "Waiting a year buys slightly better panels, a permanently worse export lock, and another summer of 34–40¢ evenings.",
      "Honest answer: under a ~$150 bill, waiting can be right. Above it, the math usually says otherwise.",
    ],
  },
  {
    title: "What happened when I told a {n} homeowner NOT to go solar",
    angle: "the anti-pitch — nothing builds trust faster than a no",
    format: "text",
    theme: "social-proof",
    deck: [
      "When the bill is under ~$150, the roof is near end-of-life, or shade is real — the right call is 'not yet'. I say so.",
      "Without the federal credit, payback runs 10+ years. Forcing it onto the wrong house makes that worse.",
      "An honest 'no' today is how you earn the referral 'yes' tomorrow. It's also just the right thing.",
    ],
  },
  {
    title: "Know someone with a $300+ summer bill? Here's what I send them",
    angle: "referral prompt disguised as a resource — highly shareable",
    format: "carousel",
    theme: "referral",
    deck: [
      "First: the rate-plan check. It's free and sometimes fixes a chunk of the bill in ten minutes.",
      "Then the honest solar screen: bill over ~$150, decent sun, a roof with life left, staying put 5+ years.",
      "Clear both? Then we talk panels. Send this to the friend with the scary bill.",
    ],
  },
  {
    title: "The free quote review I do (and why confusing quotes are on purpose)",
    angle: "a service offer that's genuinely useful — the softest possible CTA",
    format: "text",
    theme: "referral",
    deck: [
      "Solar quotes hide the two numbers that matter: price per watt, and the export rate the savings assume.",
      "I review any quote free — yours, your neighbor's, the door-knocker's. No strings.",
      "Worst case, you learn your quote is solid. Best case, I save you from a 25-year mistake.",
    ],
  },
];

export interface Idea {
  id: string;
  territory: Territory;
  title: string;
  angle: string;
  format: "carousel" | "reel" | "story" | "text";
  theme: string;
  /** authored slide lines that deliver the title's promise ({n} resolved) */
  deck?: string[];
  /* ---- content-engine metadata (July 2026 overhaul) — all optional so
     persisted ideas and the realtor bank keep working; the compiler falls
     back to theme defaults + heuristics when absent ---- */
  pillar?: "P1" | "P2" | "P3" | "P4" | "P5";
  objective?: "reach" | "save" | "share" | "dm" | "comment";
  shape?: "hero-number" | "trend" | "myth-bust" | "listicle" | "news-react" | "timeline";
  /** ≤9 words — the closer headline. NEVER a deck line. */
  takeaway?: string;
  /** authored cover passing the ≤9-word/≤52-char law */
  hook?: { headline: string; kicker: string; hotWord?: string };
  /** doc + date for the deck's numbers, e.g. "ACC docket · Jul 2026" */
  source?: string;
  /** news-lane item — Studio shows a re-verify banner */
  perishable?: boolean;
  /** verbatim public-record quote for the news-react receipt slide */
  receipt?: { quote: string; attrib: string; provenance: string };
}

/** Bank-entry shape shared by all solar idea banks. */
export type IdeaSeed = Omit<Idea, "id" | "territory">;

const slugId = (s: string) => s.toLowerCase().replace(/\{n\}/g, "n").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** No two consecutive ideas share a theme — the list itself models the
    playbook's "never two pillars in a row" rhythm. Greedy round-robin. */
function interleaveByTheme(ideas: Idea[]): Idea[] {
  const buckets = new Map<string, Idea[]>();
  ideas.forEach((i) => buckets.set(i.theme, [...(buckets.get(i.theme) || []), i]));
  const out: Idea[] = [];
  let last = "";
  while (out.length < ideas.length) {
    // biggest bucket that isn't the last-used theme; fall back if forced
    const order = [...buckets.entries()].filter(([, v]) => v.length).sort((a, b) => b[1].length - a[1].length);
    const pick = order.find(([k]) => k !== last) || order[0];
    if (!pick) break;
    out.push(pick[1].shift() as Idea);
    last = pick[0];
  }
  return out;
}

export function ideasFor(profile: StrategyProfile): Idea[] {
  const out: Idea[] = [];
  if (profile.vertical === "solar") {
    // v2 (July 2026 overhaul): territory is a LABEL, not a multiplier. One
    // bank — the FULL banks, no slice windows (the old ti%4 slicing left
    // half the KB permanently unreachable) — every idea surfaced exactly
    // once, deduped by title, {n} labels rotated across the territory list.
    const bank: IdeaSeed[] = [...SOLAR_KB_CONTENT, ...SOLAR_IDEA_BANK, ...SOLAR_CONVERSION_BANK];
    const seen = new Set<string>();
    const terrs = profile.territories.length ? profile.territories : DEFAULT_STRATEGY.territories;
    bank.forEach((b, i) => {
      if (seen.has(b.title)) return;
      seen.add(b.title);
      const t = terrs[i % terrs.length];
      out.push({
        ...b,
        id: slugId(b.title),
        territory: t,
        title: b.title.replace(/\{n\}/g, t.name),
        deck: b.deck?.map((d) => d.replace(/\{n\}/g, t.name)),
      });
    });
    const rotated = interleaveByTheme(out);
    return profile.cameraComfort === "avoid" ? rotated.filter((i) => i.format !== "reel") : rotated;
  }
  profile.territories.forEach((t, ti) => {
    const bank = [...(IDEA_BANK[t.segment] ?? IDEA_BANK.growth), ...CONVERSION_BANK.slice(ti % 2, (ti % 2) + 4)];
    const price = t.segment === "luxury" ? "2M" : t.segment === "growth" ? "450K" : "350K";
    bank.forEach((b, i) => {
      const deck = (b as { deck?: string[] }).deck;
      out.push({
        id: `${t.slug}-${i}`,
        territory: t,
        title: b.title.replace(/\{n\}/g, t.name).replace(/\{price\}/g, price),
        angle: b.angle,
        format: b.format,
        theme: b.theme,
        ...(deck ? { deck: deck.map((d) => d.replace(/\{n\}/g, t.name)) } : {}),
      });
    });
  });
  // never assign formats the agent avoids
  return profile.cameraComfort === "avoid" ? out.filter((i) => i.format !== "reel") : out;
}

/** Engage cadence caps by prospecting comfort — visible in the UI, not secret. */
export function cadenceCap(mode: ProspectingMode): { perWeek: number; note: string } {
  if (mode === "observer") return { perWeek: 3, note: "Ease in: 3 suggested engagements a week, reading-first." };
  if (mode === "connector") return { perWeek: 14, note: "Max 2/day per community — presence, not flooding." };
  return { perWeek: 7, note: "About one useful comment a day across your communities." };
}

/** Suggested starter communities per territory (empty-state kit for Engage → Sources). */
export function suggestedSources(profile: StrategyProfile): { name: string; kind: string; territory: string }[] {
  const out: { name: string; kind: string; territory: string }[] = [];
  profile.territories.forEach((t) => {
    if (profile.vertical === "solar") {
      // new-build communities run resident groups under predictable names —
      // that's where fresh homeowners ask their first energy questions
      out.push(
        { name: `${t.name} Residents / Community (Facebook)`, kind: "fb_group", territory: t.name },
        { name: `Living in ${t.city} AZ (Facebook)`, kind: "fb_group", territory: t.name },
        { name: `Nextdoor · ${t.name}`, kind: "nextdoor", territory: t.name }
      );
    } else {
      out.push(
        { name: `${t.name} Neighbors`, kind: "fb_group", territory: t.name },
        { name: `${t.city} Buy Nothing / Community`, kind: "fb_group", territory: t.name },
        { name: `Nextdoor · ${t.name}`, kind: "nextdoor", territory: t.name }
      );
    }
  });
  if (profile.vertical === "solar") {
    out.push(
      { name: "r/solar", kind: "subreddit", territory: "All solar" },
      { name: "r/phoenix", kind: "subreddit", territory: "All AZ" },
      { name: "r/arizona", kind: "subreddit", territory: "All AZ" },
      { name: "r/TeslaSolar", kind: "subreddit", territory: "Battery / EV" },
      { name: "r/electricvehicles", kind: "subreddit", territory: "Battery / EV" }
    );
  } else {
    out.push(
      { name: "r/phoenix", kind: "subreddit", territory: "All AZ" },
      { name: "r/arizona", kind: "subreddit", territory: "All AZ" },
      { name: "r/MovingtoPhoenix", kind: "subreddit", territory: "Relocation" }
    );
  }
  return out;
}
