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

export function bankFor(t: Territory): SourceEntry[] {
  const rows = BY_TERRITORY[t.slug] ?? patternRows(t);
  return rows.map((r, i) => ({
    ...r,
    id: `kb-${t.slug}-${i}`,
    territorySlug: t.slug,
    territoryName: t.name,
    status: "suggested" as const,
    origin: "knowledge-base" as const,
  }));
}

export function statewide(): SourceEntry[] {
  return AZ_STATEWIDE.map((r, i) => ({
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
