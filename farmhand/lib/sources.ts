/**
 * Source discovery — where should this professional be engaging?
 *
 * Two layers, merged:
 *  1. KNOWLEDGE BASE (below): curated AZ communities + name patterns that
 *     reliably exist for AZ cities. Zero-setup — works with no API key.
 *  2. LIVE RESEARCH (/api/discover): Perplexity's online model researches
 *     real, currently-active communities for any territory + profession.
 *     Enabled by setting PERPLEXITY_API_KEY in the deployment env.
 */

import type { Territory } from "./strategy";

export type SourcePlatform = "facebook" | "reddit" | "nextdoor" | "forum";

export interface SourceEntry {
  id: string;
  name: string;
  platform: SourcePlatform;
  territorySlug: string;
  territoryName: string;
  why: string;
  size?: string;
  status: "suggested" | "added" | "dismissed";
  origin: "knowledge-base" | "live-research";
}

export const PLATFORM_META: Record<SourcePlatform, { label: string; color: string; icon: string }> = {
  facebook: { label: "Facebook", color: "#7DA7FF", icon: "ƒ" },
  reddit: { label: "Reddit", color: "#FF9A62", icon: "◉" },
  nextdoor: { label: "Nextdoor", color: "#41D98A", icon: "✦" },
  forum: { label: "Forum", color: "#C9A8FF", icon: "⌗" },
};

/* ------------------------------------------------------------------ */
/* Curated AZ knowledge base (real-estate profession, Phase 1)         */
/* ------------------------------------------------------------------ */

interface BankRow {
  name: string;
  platform: SourcePlatform;
  why: string;
  size?: string;
}

/** Statewide — relevant to every AZ territory. */
const AZ_STATEWIDE: BankRow[] = [
  { name: "r/phoenix", platform: "reddit", why: "Metro-wide hub — relocation and neighborhood questions daily; answer helpfully, never pitch.", size: "~450k" },
  { name: "r/arizona", platform: "reddit", why: "Statewide catch-all; moving-to-AZ threads surface weekly.", size: "~350k" },
  { name: "r/MovingtoPhoenix", platform: "reddit", why: "Purpose-built for relocation questions — the highest-signal subreddit for agents.", size: "~15k" },
  { name: "City-Data Phoenix forum", platform: "forum", why: "Long-form relocation research threads; answers rank on Google for years." },
];

/** Territory-specific curated entries, keyed by strategy slug. */
const BY_TERRITORY: Record<string, BankRow[]> = {
  "paradise-valley": [
    { name: "Paradise Valley Living (Facebook)", platform: "facebook", why: "Affluent resident group — lifestyle and community threads; luxury sellers watch quietly here." },
    { name: "r/Scottsdale", platform: "reddit", why: "PV questions land here constantly (no dedicated PV sub); golf, HOA and estate topics.", size: "~40k" },
    { name: "Nextdoor · Paradise Valley", platform: "nextdoor", why: "Highest-value Nextdoor in the state; recommendations carry serious weight." },
    { name: "Camelback Corridor professionals (Facebook)", platform: "facebook", why: "Adjacent professional network — referral relationships more than direct leads." },
  ],
  buckeye: [
    { name: "Buckeye AZ Community Group (Facebook)", platform: "facebook", why: "The main resident group — new-arrival questions weekly as the city grows." },
    { name: "Verrado Community (Facebook)", platform: "facebook", why: "Buckeye's flagship master-planned community; HOA and builder threads are constant." },
    { name: "Moving to Buckeye / West Valley (Facebook)", platform: "facebook", why: "Relocation-specific — out-of-state families comparing Buckeye vs. Surprise vs. Goodyear." },
    { name: "Nextdoor · Buckeye", platform: "nextdoor", why: "Growth-market Nextdoor skews new residents — exactly who needs an area expert." },
    { name: "r/WestValleyAZ", platform: "reddit", why: "West Valley catch-all; Buckeye new-build threads appear regularly." },
  ],
  "scottsdale-north": [
    { name: "r/Scottsdale", platform: "reddit", why: "Active city sub — market and neighborhood comparison threads.", size: "~40k" },
    { name: "North Scottsdale Neighbors (Facebook)", platform: "facebook", why: "DC Ranch / Troon / Grayhawk residents; luxury-adjacent community talk." },
    { name: "Nextdoor · North Scottsdale", platform: "nextdoor", why: "Recommendation-driven; strong for reputation building." },
  ],
  "gilbert-val-vista": [
    { name: "Val Vista Lakes Neighbors (Facebook)", platform: "facebook", why: "The community's main group — HOA, lake and event threads you can genuinely help in." },
    { name: "Gilbert AZ Community (Facebook)", platform: "facebook", why: "Town-wide group; broad reach for neighborhood-level expertise." },
    { name: "Nextdoor · Val Vista Lakes", platform: "nextdoor", why: "Hyperlocal recommendations — where 'anyone know a realtor?' actually gets asked." },
  ],
  "gilbert-agritopia": [
    { name: "Agritopia Residents (Facebook)", platform: "facebook", why: "Tight-knit community group — farm-stand and event threads; show up as a neighbor first." },
    { name: "Gilbert Foodies (Facebook)", platform: "facebook", why: "Agritopia's restaurants anchor this group — soft-touch local presence." },
    { name: "r/gilbert", platform: "reddit", why: "Small but growing town sub; low competition for helpful answers." },
  ],
  "gilbert-heritage": [
    { name: "Downtown Gilbert (Facebook)", platform: "facebook", why: "Heritage District events and business threads — date-night and festival content performs." },
    { name: "Gilbert AZ Community (Facebook)", platform: "facebook", why: "Town-wide reach for district spotlights." },
    { name: "Nextdoor · Heritage District", platform: "nextdoor", why: "Older housing stock = renovation and sell-vs-improve questions." },
  ],
  "queen-creek": [
    { name: "Queen Creek 101 (Facebook)", platform: "facebook", why: "Large resident group — growth, schools and new-build threads daily." },
    { name: "Moving to Queen Creek (Facebook)", platform: "facebook", why: "Relocation-specific; families comparing QC vs. Gilbert vs. San Tan Valley." },
    { name: "Nextdoor · Queen Creek", platform: "nextdoor", why: "New-resident heavy; recommendation threads are frequent." },
  ],
  surprise: [
    { name: "Surprise AZ Community (Facebook)", platform: "facebook", why: "Main city group — retiree and first-time-buyer mix." },
    { name: "Surprise/West Valley Newcomers (Facebook)", platform: "facebook", why: "Newcomer-focused — exactly the audience for area-guide content." },
    { name: "Nextdoor · Surprise", platform: "nextdoor", why: "Strong 55+ presence; trust-based referrals dominate." },
  ],
};

/** Name-pattern fallback for any territory not in the curated bank. */
function patternRows(t: Territory): BankRow[] {
  return [
    { name: `${t.city} Community Group (Facebook)`, platform: "facebook", why: `Most AZ cities have a main resident group under this name — search it and join as a neighbor.` },
    { name: `Moving to ${t.city} (Facebook)`, platform: "facebook", why: "Relocation groups exist for nearly every growing AZ city — highest-intent audience there is." },
    { name: `Nextdoor · ${t.name}`, platform: "nextdoor", why: "Claim your Nextdoor neighborhood — recommendation threads are where local trust converts." },
  ];
}

/* ---------- solar banks — homeowner/energy spaces, not realtor groups ---------- */

/** Statewide solar — relevant to every AZ solar territory. */
const SOLAR_STATEWIDE: BankRow[] = [
  { name: "r/solar", platform: "reddit", why: "The main solar sub — quote reviews and 'is it worth it' threads daily; AZ questions are frequent.", size: "~300k" },
  { name: "r/solarenergy", platform: "reddit", why: "Second solar hub; homeowner-level questions with less pro noise." },
  { name: "r/phoenix", platform: "reddit", why: "Metro hub — summer-bill rants and APS/SRP threads spike every July; answer with real numbers.", size: "~450k" },
  { name: "r/arizona", platform: "reddit", why: "Statewide — rate-case and utility news threads where expertise stands out.", size: "~350k" },
  { name: "DIY Solar Forum (diysolarforum.com)", platform: "forum", why: "Serious owners and researchers; Arizona threads rank on Google for years." },
];

/**
 * Curated solar rows for the hot-spot territories (from the July 2026
 * territory research). Group names follow the predictable patterns AZ
 * communities actually use — search and join as a neighbor.
 */
const SOLAR_BY_TERRITORY: Record<string, BankRow[]> = {
  "buckeye-city": [
    { name: "Buckeye AZ Community Group (Facebook)", platform: "facebook", why: "Main resident group of one of America's fastest-growing cities — new-homeowner energy questions weekly." },
    { name: "Verrado Community (Facebook)", platform: "facebook", why: "Flagship master plan — HOA/builder threads constant; solar comes up on every summer bill cycle." },
    { name: "Tartesso Community (Facebook)", platform: "facebook", why: "Young families, big unshaded roofs, long commutes — the research's #1 affordable APS profile." },
    { name: "Nextdoor · Buckeye", platform: "nextdoor", why: "New-resident heavy; 'anyone gone solar?' recommendation threads are where trust converts." },
    { name: "r/WestValleyAZ", platform: "reddit", why: "West Valley catch-all — new-build and utility-bill threads appear regularly." },
  ],
  "peoria-city": [
    { name: "Vistancia Community (Facebook)", platform: "facebook", why: "The corridor's anchor master plan — affluent owners with pools comparing summer bills." },
    { name: "Aloravita Neighbors (Facebook)", platform: "facebook", why: "Brand-new 67th & Happy Valley community — first-energy-decision homeowners." },
    { name: "Peoria AZ Community (Facebook)", platform: "facebook", why: "City-wide resident group; APS rate-plan confusion posts are routine." },
    { name: "Nextdoor · Vistancia / North Peoria", platform: "nextdoor", why: "Premium new-build streets — referrals carry weight here." },
  ],
  "queen-creek-city": [
    { name: "Queen Creek 101 (Facebook)", platform: "facebook", why: "Large resident group — growth and new-build threads daily; SRP bill season lights it up." },
    { name: "Barney Farms Community (Facebook)", platform: "facebook", why: "Fulton's lake community — the research's top affluent SRP family profile." },
    { name: "Nextdoor · Queen Creek", platform: "nextdoor", why: "New-resident heavy; demand-charge confusion makes real expertise stand out." },
    { name: "r/QueenCreek", platform: "reddit", why: "Small town sub — low competition for genuinely helpful answers." },
  ],
  "mesa-gateway": [
    { name: "Eastmark Community (Facebook)", platform: "facebook", why: "One of the most active community groups in AZ — mature, high-income, referral-rich." },
    { name: "Hawes Crossing / Cadence Residents (Facebook)", platform: "facebook", why: "The Gateway boom's newest roofs — SRP plan questions from day one." },
    { name: "Nextdoor · East Mesa / Gateway", platform: "nextdoor", why: "Dense newer streets; recommendation threads convert." },
    { name: "r/mesa", platform: "reddit", why: "City sub — SRP and summer-bill threads recur.", size: "~20k" },
  ],
  "san-tan-valley-city": [
    { name: "San Tan Valley 101 / Community (Facebook)", platform: "facebook", why: "Pinal County's boom corridor — Bella Vista Farms and Soleo families comparing bills." },
    { name: "Nextdoor · San Tan Valley", platform: "nextdoor", why: "Unsaturated market — early presence compounds." },
    { name: "r/SanTanValley", platform: "reddit", why: "Small but growing; new-build and utility threads." },
  ],
  "surprise-city": [
    { name: "Surprise AZ Community (Facebook)", platform: "facebook", why: "Main city group — Marley Park/Asante families plus 55+ backup-power interest." },
    { name: "Sterling Grove Residents (Facebook)", platform: "facebook", why: "Toll Brothers golf community — premium battery economics." },
    { name: "Nextdoor · Surprise", platform: "nextdoor", why: "Strong 55+ presence; trust-based referrals dominate." },
  ],
  "goodyear-city": [
    { name: "Estrella Community (Facebook)", platform: "facebook", why: "The master plan's resident hub — pools + big cooling loads, years of new phases left." },
    { name: "Goodyear AZ Community (Facebook)", platform: "facebook", why: "City-wide group — verify utility per address (Agua Fria splits APS/SRP)." },
    { name: "Nextdoor · Estrella / Goodyear", platform: "nextdoor", why: "High-usage family streets; recommendation threads are frequent." },
  ],
};

/** Solar pattern fallback — development-name based, since new-build resident
    groups are where fresh homeowners ask their first energy questions. */
function solarPatternRows(t: Territory): BankRow[] {
  return [
    { name: `${t.name} Residents / Community (Facebook)`, platform: "facebook", why: "New-build communities run resident groups under predictable names — search and join as a neighbor." },
    { name: `${t.city} AZ Community (Facebook)`, platform: "facebook", why: "The city's main resident group — summer-bill and rate-plan threads every year." },
    { name: `Nextdoor · ${t.name}`, platform: "nextdoor", why: "'Anyone gone solar?' recommendation threads are where local trust converts." },
  ];
}

export function bankFor(t: Territory, vertical?: string): SourceEntry[] {
  const rows =
    vertical === "solar"
      ? SOLAR_BY_TERRITORY[t.slug] ?? solarPatternRows(t)
      : BY_TERRITORY[t.slug] ?? patternRows(t);
  return rows.map((r, i) => ({
    ...r,
    id: `kb-${t.slug}-${i}`,
    territorySlug: t.slug,
    territoryName: t.name,
    status: "suggested" as const,
    origin: "knowledge-base" as const,
  }));
}

export function statewide(vertical?: string): SourceEntry[] {
  return (vertical === "solar" ? SOLAR_STATEWIDE : AZ_STATEWIDE).map((r, i) => ({
    ...r,
    id: `kb-az-${i}`,
    territorySlug: "arizona",
    territoryName: "All Arizona",
    status: "suggested" as const,
    origin: "knowledge-base" as const,
  }));
}

/** Merge new entries into existing, deduping by normalized name. */
export function mergeSources(existing: SourceEntry[], incoming: SourceEntry[]): SourceEntry[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const seen = new Set(existing.map((s) => norm(s.name)));
  return [...existing, ...incoming.filter((s) => !seen.has(norm(s.name)))];
}
