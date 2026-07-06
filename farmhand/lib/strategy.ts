/**
 * StrategyProfile — the personalization spine.
 * Onboarding writes it; every screen renders from it.
 * Persisted in the app store (localStorage today, Supabase adapter later).
 */

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
}

export interface StrategyProfile {
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

export interface Idea {
  id: string;
  territory: Territory;
  title: string;
  angle: string;
  format: "carousel" | "reel" | "story" | "text";
  theme: string;
}

export function ideasFor(profile: StrategyProfile): Idea[] {
  const out: Idea[] = [];
  profile.territories.forEach((t, ti) => {
    const bank = [...(IDEA_BANK[t.segment] ?? IDEA_BANK.growth), ...CONVERSION_BANK.slice(ti % 2, (ti % 2) + 4)];
    const price = t.segment === "luxury" ? "2M" : t.segment === "growth" ? "450K" : "350K";
    bank.forEach((b, i) => {
      out.push({
        id: `${t.slug}-${i}`,
        territory: t,
        title: b.title.replace(/\{n\}/g, t.name).replace(/\{price\}/g, price),
        angle: b.angle,
        format: b.format,
        theme: b.theme,
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
    out.push(
      { name: `${t.name} Neighbors`, kind: "fb_group", territory: t.name },
      { name: `${t.city} Buy Nothing / Community`, kind: "fb_group", territory: t.name },
      { name: `Nextdoor · ${t.name}`, kind: "nextdoor", territory: t.name }
    );
  });
  out.push(
    { name: "r/phoenix", kind: "subreddit", territory: "All AZ" },
    { name: "r/arizona", kind: "subreddit", territory: "All AZ" },
    { name: "r/MovingtoPhoenix", kind: "subreddit", territory: "Relocation" }
  );
  return out;
}
