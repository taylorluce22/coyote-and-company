/**
 * Market Pulse signal packs — curated per territory (live feeds are Phase 2;
 * the shape stays identical so swapping in a real data source changes nothing
 * downstream). Each signal carries a ready-made content angle.
 */

export interface MarketSignal {
  id: string;
  territorySlug: string;
  territoryName: string;
  kind: "price" | "velocity" | "development" | "news";
  headline: string;
  detail: string;
  angle: string; // the "make content from this" hook
  color: string;
}

const PACKS: Record<string, Omit<MarketSignal, "id" | "territorySlug" | "territoryName" | "color">[]> = {
  "paradise-valley": [
    { kind: "price", headline: "PV median sits near $3.4M", detail: "Days-on-market up ~12% this quarter — sellers are testing the air", angle: "“What longer days-on-market actually means for PV sellers” — the calm, data-first take" },
    { kind: "velocity", headline: "Fairway lots moving faster than hillside", detail: "Golf-adjacent closings outpacing view lots 2:1 this quarter", angle: "“The two Paradise Valleys: fairway vs. hillside” — insider segmentation post" },
    { kind: "development", headline: "Teardown-rebuild activity climbing", detail: "Permit activity on 1970s ranches keeps rising", angle: "“Anatomy of a PV teardown: what your lot is really worth” — seller magnet" },
  ],
  buckeye: [
    { kind: "news", headline: "Buckeye again a top-3 fastest-growing US city", detail: "Census keeps ranking it near the top for net new residents", angle: "“Why everyone's moving to Buckeye — from someone who works here” — relocation reel" },
    { kind: "price", headline: "New builds under $450K still available", detail: "Multiple communities with quick-move-in inventory this month", angle: "“New-build vs. resale in Buckeye: the honest monthly-payment math” — shareable table" },
    { kind: "development", headline: "Verrado keeps expanding districts", detail: "New phases + commercial pads announced", angle: "“Verrado in 90 seconds for out-of-state buyers” — drive-through reel" },
  ],
  "gilbert-val-vista": [
    { kind: "price", headline: "85234 median hit $487K in June", detail: "Steady against the metro dip; lakefront premium holding", angle: "“What actually sold in 85234 last month” carousel — your best-performing format" },
  ],
  "gilbert-agritopia": [
    { kind: "news", headline: "Agritopia farm-events calendar filling up", detail: "Fall market dates announced; foot traffic season starting", angle: "“A Saturday in Agritopia” — community content that sellers remember" },
  ],
  "gilbert-heritage": [
    { kind: "news", headline: "Global Village Festival · Jul 12", detail: "Downtown Gilbert's biggest week of the month", angle: "Neighborhood-spotlight post + go comment in the event threads" },
  ],
};

const BY_SEGMENT: Record<string, Omit<MarketSignal, "id" | "territorySlug" | "territoryName" | "color">> = {
  luxury: { kind: "price", headline: "Luxury inventory tight, showings selective", detail: "High-end buyers touring fewer, better-prepped homes", angle: "“How luxury listings get shown now” — authority post for sellers" },
  growth: { kind: "velocity", headline: "Family relocation season is peaking", detail: "School-calendar moves drive summer demand in growth corridors", angle: "“Moving before the school year: the 6-week plan” — save-worthy checklist" },
  entry: { kind: "price", headline: "Entry-level inventory still the tightest slice", detail: "Sub-$400K listings drawing multiple offers fastest", angle: "“How first-time buyers win here without overpaying” — trust builder" },
  custom: { kind: "news", headline: "Your market, your angle", detail: "Pick the local story worth telling this week", angle: "Neighborhood spotlight — one street, one story, one number" },
};

import type { Territory } from "./strategy";
import { utilityForTerritory } from "./azTerritories";

/**
 * Solar pulse packs — built from the AZ energy knowledge base (real tariff
 * numbers, rate-case status, VPP pay), selected by the territory's UTILITY so
 * an APS neighborhood never gets an SRP angle. The realtor packs above were
 * showing "family relocation season" on a solar account — wrong business.
 */
type SignalSeed = Omit<MarketSignal, "id" | "territorySlug" | "territoryName" | "color">;

const SOLAR_APS: SignalSeed[] = [
  { kind: "news", headline: "APS is asking for ~16% more on residential bills", detail: "Rate-case decision due by Dec 31, 2026; new rates likely early 2027 — on top of 2024's 8%", angle: "“What the APS rate case means for {n} bills” — neutral explainer, locals share these" },
  { kind: "price", headline: "The 4–7pm window runs ~34¢/kWh all summer", detail: "APS on-peak vs ~12¢ off-peak — a 3x spread most homeowners never look at", angle: "“The 4–7pm rule every APS home should know” — save-worthy carousel" },
  { kind: "news", headline: "APS's solar export rate drops again September 1", detail: "6.2¢/kWh today, stepped down ~10% every year since 2017 (started at 12.9¢)", angle: "“Waiting on solar has a literal price in {n}” — the export step-down explained" },
  { kind: "development", headline: "APS now pays home batteries — $110 per avg kW each summer", detail: "Storage Rewards: a typical battery earns $330–660/season sharing capacity during grid events", angle: "“Your battery can earn ~$660 a summer from APS” — VPP explainer for {n}" },
];

const SOLAR_SRP: SignalSeed[] = [
  { kind: "price", headline: "July/August 6–9pm hits ~40¢/kWh on SRP's new plans", detail: "E-28 summer-peak on-peak — among the highest retail power prices in Arizona", angle: "“Why your July SRP bill spiked: the 40¢ window nobody explains” — for {n}" },
  { kind: "price", headline: "SRP demand plans bill your single worst 30 minutes", detail: "A battery shaving an 8kW evening spike to 2kW saves ~$40–112/month (~$800+/yr)", angle: "“The $800/year battery move for SRP demand-plan homes in {n}” — worked math" },
  { kind: "news", headline: "SRP's plan overhaul is live — old plans sunset by Nov 2029", detail: "New $20–40 tiered monthly charge, new time-of-day plans, net metering retired", angle: "“Which new SRP plan actually fits your {n} home” — the honest guide" },
  { kind: "development", headline: "SRP pays exports just 3.45¢/kWh — half of APS", detail: "SRP solar lives or dies on self-consumption and batteries, not selling power back", angle: "“Why SRP solar is a battery story, not an export story” — position as the expert" },
];

const SOLAR_OTHER: SignalSeed[] = [
  { kind: "news", headline: "This area is NOT on APS or SRP rates", detail: "ED3/ED2 territories have their own export rules and fees — never quote APS/SRP numbers here", angle: "“The rate-plan mistake solar companies make in {n}” — instant local credibility" },
];

const SOLAR_GENERAL: SignalSeed[] = [
  { kind: "development", headline: "~20 GW of data centers want onto Arizona's grid", detail: "APS's own filings; 76% of its projected sales growth is data centers + large industrial", angle: "“What data centers mean (and honestly don't) for {n} power bills”" },
  { kind: "news", headline: "The 30% federal solar credit is gone for purchases", detail: "Installs completed after Dec 31, 2025 get $0 federal; AZ's $1,000 credit + tax exemptions remain", angle: "“The honest 2026 solar math for {n}” — objection-handling with real numbers" },
];

function solarSignalsFor(t: Territory): SignalSeed[] {
  const u = utilityForTerritory(t);
  const bank = u === "aps" ? SOLAR_APS : u === "srp" ? SOLAR_SRP : SOLAR_OTHER;
  // deterministic rotation per territory so different cards show different
  // angles instead of three copies of the same headline
  const off = Math.abs([...t.slug].reduce((a, ch) => a + ch.charCodeAt(0), 0));
  const rotated = [...bank.slice(off % bank.length), ...bank.slice(0, off % bank.length)];
  return [...rotated, SOLAR_GENERAL[off % SOLAR_GENERAL.length]].map((s) => ({
    ...s,
    detail: s.detail.replace(/\{n\}/g, t.name),
    angle: s.angle.replace(/\{n\}/g, t.name),
  }));
}

/** Full signal pack for one territory. */
export function signalsFor(t: Territory, vertical?: string): MarketSignal[] {
  const pack = vertical === "solar" ? solarSignalsFor(t) : PACKS[t.slug] ?? [BY_SEGMENT[t.segment] ?? BY_SEGMENT.custom];
  return pack.map((p, i) => ({ ...p, id: `${t.slug}-sig-${i}`, territorySlug: t.slug, territoryName: t.name, color: t.hex }));
}

export function pulseFor(territories: Territory[], max = 3, vertical?: string): MarketSignal[] {
  const out: MarketSignal[] = [];
  territories.forEach((t) => out.push(...signalsFor(t, vertical)));
  // round-robin so every territory gets representation before any repeats
  const bySlug = new Map<string, MarketSignal[]>();
  out.forEach((s) => bySlug.set(s.territorySlug, [...(bySlug.get(s.territorySlug) || []), s]));
  const rr: MarketSignal[] = [];
  let added = true;
  while (rr.length < max && added) {
    added = false;
    for (const list of bySlug.values()) {
      const next = list.shift();
      if (next && rr.length < max) {
        rr.push(next);
        added = true;
      }
    }
  }
  return rr;
}
