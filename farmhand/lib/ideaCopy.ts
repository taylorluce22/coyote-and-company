/**
 * Idea → Studio copy. Turns a content-generator idea (including the solar
 * knowledge-base bank) into real channel copy the Composer can render as
 * slides: hook = the idea title, body = KB facts matched to the idea's theme
 * and the territory's UTILITY, close = a soft local CTA. This is what makes
 * the Studio propose posts from the idea engine instead of canned demo copy.
 */

import { KB } from "./azEnergyKb";
import { utilityForTerritory } from "./azTerritories";
import type { Idea, StrategyProfile } from "./strategy";

export interface IdeaCopyPack {
  handle: string;
  meta: string;
  long: string;
  short: string;
  alt: string;
  cta: string;
  hashtags: string[];
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** theme → [primary, alternate] KB angles, resolved per utility. */
function factsFor(theme: string, u: "aps" | "srp" | "unknown"): [string, string] {
  switch (theme) {
    case "bill-breakdown":
      return [KB.rates[u], KB.ratePlanCheck[u]];
    case "battery-ev":
      return [KB.battery[u], KB.rates[u]];
    case "objection-handling":
      return [KB.tax.any, KB.honestPayback.any];
    case "buyer-education":
      return [KB.export[u], KB.tax.any];
    case "new-homeowner":
      return [KB.ratePlanCheck[u], KB.export[u]];
    case "authority":
      return [KB.gridDemand.any, KB.export[u]];
    case "myth-busting":
      return [KB.honestPayback.any, KB.rates[u]];
    default:
      // social-proof, referral, anything new
      return [KB.honestPayback.any, KB.battery[u]];
  }
}

/** Resolve an idea's utility + its two same-subject KB facts (for the AI writer). */
export function ideaFactPair(idea: Idea): { utility: "aps" | "srp" | "unknown"; facts: [string, string] } {
  const rawU = utilityForTerritory(idea.territory);
  const u: "aps" | "srp" | "unknown" = rawU === "aps" || rawU === "srp" ? rawU : "unknown";
  return { utility: u, facts: factsFor(idea.theme, u) };
}

export function ideaCopy(idea: Idea, strategy: StrategyProfile, channel: "ig" | "fb" | "nd"): IdeaCopyPack {
  const t = idea.territory;
  const { utility: u, facts } = ideaFactPair(idea);
  const [fact, altFact] = facts;
  // honest local close — never a fabricated credential
  const who = `If you're in ${t.name}, this is the first thing I'd check before signing anything.`;
  const cta =
    channel === "nd"
      ? `Happy to run the numbers for your address, neighbors — just ask below.`
      : `Save this — and DM me if you want the math for your house.`;

  // both facts come from the same theme family, so the post stays on ONE
  // subject while having enough substance for a real carousel
  const long = `${idea.title}\n\n${cap(fact)}.\n\n${cap(altFact)}.\n\n${who}`;
  const alt = `${idea.title}\n\n${cap(altFact)}.\n\n${cap(fact)}.\n\n${who}`;
  const short = `${idea.title} — ${fact.split(" — ")[0]}. DM me for the numbers on your house.`;

  const cityTag = t.city.toLowerCase().replace(/[^a-z]/g, "");
  const nameTag = t.name.toLowerCase().replace(/[^a-z]/g, "");
  const hashtags = [
    "arizonasolar",
    "azsolar",
    cityTag,
    nameTag !== cityTag ? nameTag : "phoenixmetro",
    u === "srp" ? "srp" : "aps",
    "solarenergy",
    "azliving",
    "energybills",
  ];

  return {
    handle: strategy.name ? `${strategy.name.toLowerCase().replace(/\s+/g, ".")}.solar.az` : "solar.az",
    meta: `${channel === "ig" ? "Instagram" : channel === "fb" ? "Facebook" : "Nextdoor"} · from your idea engine`,
    long,
    short,
    alt,
    cta,
    hashtags,
  };
}
