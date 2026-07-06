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

export function pulseFor(territories: Territory[], max = 3): MarketSignal[] {
  const out: MarketSignal[] = [];
  territories.forEach((t) => {
    const pack = PACKS[t.slug] ?? [BY_SEGMENT[t.segment] ?? BY_SEGMENT.custom];
    pack.forEach((p, i) =>
      out.push({ ...p, id: `${t.slug}-sig-${i}`, territorySlug: t.slug, territoryName: t.name, color: t.hex })
    );
  });
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
