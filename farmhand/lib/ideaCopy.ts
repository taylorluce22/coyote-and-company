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
      return [KB.export[u], KB.trust.any];
    case "new-homeowner":
      return [KB.ratePlanCheck[u], KB.export[u]];
    case "authority":
      return [KB.gridDemand.any, KB.rateCase.any];
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

/** First self-contained clause of a KB fact — slide-length, never a wall of text. */
function slideClause(fact: string): string {
  const first = fact.split(" — ")[0].split(/(?<=[.!?])\s+/)[0].trim();
  return (first.length >= 25 ? first : fact.slice(0, 140).trim()).replace(/\.+$/, "");
}

export function ideaCopy(idea: Idea, strategy: StrategyProfile, channel: "ig" | "fb" | "nd"): IdeaCopyPack {
  const t = idea.territory;
  const { utility: u, facts } = ideaFactPair(idea);
  const [fact, altFact] = facts;
  // The education is statewide; the geography belongs in the ACTION. The CTA
  // is the one place the territory shows up — "run this for YOUR house here".
  const cta =
    channel === "nd"
      ? `Happy to run these numbers for your address, neighbors — just ask below.`
      : `Save this — and DM me when you want it run for your own ${t.name} numbers.`;

  const deck = Array.isArray(idea.deck) && idea.deck.length ? idea.deck : null;
  let long: string;
  let alt: string;
  let short: string;
  if (deck) {
    // authored deck: every slide was written to deliver the title's promise
    long = [idea.title, ...deck].join("\n\n");
    alt = deck.length > 1 ? [idea.title, ...deck.slice(1), deck[0]].join("\n\n") : long;
    short = `${idea.title} — ${deck[0].replace(/^\d+\.\s*/, "")}`;
  } else {
    // fallback (older persisted ideas): same-subject KB facts, clipped to
    // slide length so a slide can never be a wall of text
    long = `${idea.title}\n\n${cap(slideClause(fact))}.\n\n${cap(slideClause(altFact))}.`;
    alt = `${idea.title}\n\n${cap(slideClause(altFact))}.\n\n${cap(slideClause(fact))}.`;
    short = `${idea.title} — ${fact.split(" — ")[0]}. DM me for the numbers on your house.`;
  }

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
