/**
 * Idea → Studio copy. Turns a content-generator idea (including the solar
 * knowledge-base bank) into real channel copy the Composer can render as
 * slides: hook = the idea title, body = KB facts matched to the idea's theme
 * and the territory's UTILITY, close = a soft local CTA. This is what makes
 * the Studio propose posts from the idea engine instead of canned demo copy.
 */

import { KB } from "./azEnergyKb";
import { utilityForTerritory } from "./azTerritories";
import { solarLanding } from "./dgCompile";
import type { Idea, StrategyProfile } from "./strategy";

export interface IdeaCopyPack {
  handle: string;
  meta: string;
  long: string;
  short: string;
  alt: string;
  cta: string;
  hashtags: string[];
  /** Editorial-mode caption — the LESSON, structured per the content-engine
      spec §3.8 (hook line → education → solar landing → source → CTA).
      Distinct from `long`, which doubles as the photo-mode slide source. */
  caption: string;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** theme → [primary, alternate] KB angles, resolved per utility. */
function factsFor(theme: string, u: "aps" | "unknown"): [string, string] {
  switch (theme) {
    case "bill-breakdown":
      return [KB.rates[u], KB.ratePlanCheck[u]];
    case "battery-ev":
      return [KB.battery[u], KB.rates[u]];
    case "objection-handling":
      return [KB.tax.any, KB.honestPayback.any];
    case "buyer-education":
      return [KB.installerQuality.any, KB.export[u]];
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
export function ideaFactPair(idea: Idea): { utility: "aps" | "unknown"; facts: [string, string] } {
  const rawU = utilityForTerritory(idea.territory);
  const u: "aps" | "unknown" = rawU === "aps" ? "aps" : "unknown";
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
  // CTAs stay Valley-general and interchangeable — "Valley homeowners", not
  // a single city. A specific city appears only when it's the SUBJECT of
  // the post, never bolted onto the ask.
  const cta =
    channel === "nd"
      ? `Happy to run these numbers for your address, neighbors — just ask below.`
      : `Save this — and if you're in the Valley with questions, DM me. No pitch.`;

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

  // hashtag law (spec §3.8): 5–10 hyper-relevant = 2 local + 3 topical + 2 category
  const cityTag = t.city.toLowerCase().replace(/[^a-z]/g, "");
  const hashtags = [cityTag, "westvalleyaz", "aps", "arizonasolar", "energybills", "homeenergy", "utilitybills"];

  // Editorial caption — the LESSON (spec §3.8): the slides carry fragments
  // and proof objects; the caption carries the full sentences, the exact
  // numbers (IG search indexes them), the solar landing, and the source.
  const line1 = (idea.hook ? `${idea.hook.headline} ${idea.hook.kicker}` : `${idea.title}.`).slice(0, 125);
  const captionBody = (deck || [cap(slideClause(fact)) + ".", cap(slideClause(altFact)) + "."]).map((d) => d.replace(/^\d+\.\s*/, "")).join("\n\n");
  const caption = [
    line1,
    captionBody,
    solarLanding(idea.theme),
    idea.source ? `Source: ${idea.source}` : "",
    cta,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    handle: strategy.name ? `${strategy.name.toLowerCase().replace(/\s+/g, ".")}.solar.az` : "solar.az",
    meta: `${channel === "ig" ? "Instagram" : channel === "fb" ? "Facebook" : "Nextdoor"} · from your idea engine`,
    long,
    short,
    alt,
    cta,
    hashtags,
    caption,
  };
}
