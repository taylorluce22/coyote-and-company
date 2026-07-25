/**
 * Idea → DESERT GRID compiler. Takes a content-engine idea (title, angle,
 * theme + its authored deck lines) and emits a DGPost slide object the
 * shared DGSlideView renders: editorial cover, a real data slide when the
 * subject has chartable KB numbers, smart-brevity bullets for the argument,
 * and ALWAYS a closer that lands the education back on the solar decision —
 * education about APS rules is the setup, owning your production is the
 * payoff, every single post.
 *
 * Chart data here traces to the same KB the captions cite
 * (farmhand/docs/az-energy-knowledge-2026.md and the rising-costs doc) —
 * never invent a number in a chart that the KB can't back.
 */

import type { Idea } from "./strategy";
import type { DGPost, PillarId, Slide } from "./desertGrid";

/* ---- theme → pillar (spec §6.1) ---- */
const THEME_PILLAR: Record<string, PillarId> = {
  "bill-breakdown": "P2",
  authority: "P3",
  "battery-ev": "P3",
  "buyer-education": "P4",
  "objection-handling": "P4",
  "myth-busting": "P4",
  "new-homeowner": "P2",
};
const PILLAR_EYEBROW: Record<PillarId, string> = {
  P1: "RATE WATCH",
  P2: "BILL SCHOOL",
  P3: "GRID FILE",
  P4: "STRAIGHT ANSWERS",
  P5: "FIELD NOTES",
};

/* ---- the solar landing (the whole point of the closer slide) ---- */
const LANDING: Record<string, { headline: string; cta1: string }> = {
  "bill-breakdown": { headline: "You can't rate-plan your way off the escalator.", cta1: "Producing your own power is the hedge." },
  authority: { headline: "The grid is being rebuilt around you.", cta1: "Owning your production is the hedge." },
  "battery-ev": { headline: "A battery puts you on the paid side of the evening peak.", cta1: "Want the math on your house? DM me." },
  "buyer-education": { headline: "This is exactly what a consultant checks before you sign.", cta1: "Second set of eyes on any quote — DM me." },
  "objection-handling": { headline: "The math changed. The answer didn't.", cta1: "But it has to be YOUR math — DM me, no pitch." },
  "myth-busting": { headline: "The math changed. The answer didn't.", cta1: "But it has to be YOUR math — DM me, no pitch." },
  "new-homeowner": { headline: "Fresh roof, blank slate.", cta1: "The best time to get the solar decision right." },
};
const LANDING_DEFAULT = { headline: "Solar is a math decision.", cta1: "Let's run yours honestly — DM me, no pitch." };

/* ---- chartable subjects: title/angle keywords → an authored data slide.
   Numbers mirror the KB verbatim — this bank is the chart layer of the same
   facts the deck lines and captions already cite. ---- */
const CHART_BANK: { re: RegExp; slide: Slide }[] = [
  {
    re: /export|6\.2¢|drops? (again )?in september|step.?down/i,
    slide: { a: "A03", bg: "paper", title: "Your export credit steps down every September.", standfirst: "APS RCP rate, ¢/kWh exported", points: [[0, 8.5], [1, 7.4], [2, 6.857], [3, 6.171]], startLabel: "8.5¢ '17", endLabel: "6.171¢", note: "locked 10 yrs at your interconnection date", source: "APS Rate Rider RCP schedules" },
  },
  {
    re: /isn'?t going (back )?down|33%|climbed|doubling/i,
    slide: { a: "A03", bg: "paper", title: "The Arizona bill only moves one way.", standfirst: "AZ average residential bill, $/month", points: [[2014, 120], [2019, 138], [2024, 160]], startLabel: "$120 '14", endLabel: "$160 '24", note: "+33% in a decade — and the pace is picking up", source: "EIA residential data" },
  },
  {
    re: /keeps climbing|rate case|14%|asking for more|wants ~?14/i,
    slide: { a: "A02", bg: "paper", title: "Arizona's utilities are asking for more.", standfirst: "2025–26 requested residential increase", rows: [{ label: "APS", pct: 100, value: "14%", hot: true }, { label: "TEP", pct: 100, value: "14%" }], ctx: "APS is yours — about $20/month more, on top of 2024's 8%.", source: "ACC filings · 2026" },
  },
  {
    re: /4–7pm|4-7pm|on.?peak|bill spikes|34¢|window nobody/i,
    slide: { a: "A02", bg: "paper", title: "Three hours do the damage.", standfirst: "APS summer weekday price, ¢/kWh", rows: [{ label: "4–7pm", pct: 100, value: "34¢", hot: true }, { label: "Off-peak", pct: 35, value: "12¢" }], ctx: "A 3x spread, every weekday, all summer. WHEN you use power matters more than how much.", source: "APS TOU-E schedule" },
  },
  {
    re: /data center|gigawatt|20 gw/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "20", unit: "GW", sub: "of data-center requests waiting in APS's interconnection queue.", ctx: "4.5 GW already committed — against an 8.6 GW all-time record peak.", source: "APS resource plan filings" },
  },
  {
    re: /battery can earn|storage rewards|\$660|pay to use your (home )?battery/i,
    slide: { a: "A01", bg: "paper", eyebrow: "GRID FILE", num: "$660", unit: "/summer", sub: "what a typical home battery can earn from APS Storage Rewards.", ctx: "About $110 per average kW your battery shares during grid events — on top of the 22¢ evening spread it's already arbitraging.", source: "APS Storage Rewards program" },
  },
  {
    re: /bankrupt|100 solar companies|vet yours/i,
    slide: { a: "A01", bg: "night", eyebrow: "STRAIGHT ANSWERS", num: "~100", unit: "", sub: "U.S. solar companies gone bankrupt since 2023.", ctx: "Titan, SunPower, Sunnova, Freedom Forever among them. Warranties don't service themselves.", source: "AZ solar market · 2023–26" },
  },
  {
    re: /113 days|hottest year|100°/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "113", unit: "days", sub: "straight of 100°F+ — a Phoenix record.", ctx: "2024 was the hottest year ever recorded here; 2025 came second. Your AC never got a break.", source: "NWS Phoenix" },
  },
  {
    re: /suddenly a lease|7 in 10|lease wave|tpo wave/i,
    slide: { a: "A01", bg: "paper", eyebrow: "STRAIGHT ANSWERS", num: "7/10", unit: "", sub: "new AZ solar deals in 2026 are leases or PPAs.", ctx: "A tax-code story, not a trick — but read the escalator: 0.99–2.99%/yr for 20–25 years.", source: "AZ solar market · 2026" },
  },
  {
    re: /cfpb|cheap.*financing|dealer fee/i,
    slide: { a: "A01", bg: "night", eyebrow: "STRAIGHT ANSWERS", num: "+30%", unit: "", sub: "what hidden dealer fees can add to a financed solar loan's principal.", ctx: "Rolled into the payment, not the rate — the APR you're shown doesn't reveal it. Ask for the cash price first.", source: "CFPB solar-lending report" },
  },
  {
    re: /federal (solar )?credit is gone|30% federal/i,
    slide: { a: "A10", bg: "paper", eyebrow: "STRAIGHT ANSWERS", myth: "Solar stopped making sense when the 30% federal credit died.", fact: "Arizona still stacks its $1,000 credit + sales- and property-tax exemptions — and high-bill homes still pencil.", verdict: "The math changed, not the answer. It has to be YOUR math now.", source: "IRS FS-2025-05 · AZ DOR" },
  },
  {
    re: /terms follow the house|selling.*home with solar|transfer/i,
    slide: { a: "A10", bg: "paper", eyebrow: "BILL SCHOOL", myth: "Solar complicates selling the house.", fact: "On APS, legacy net metering and the export-rate lock follow the house to the next owner — a locked 2018 rate is worth real money.", verdict: "Ask for the interconnection date before you price 'free solar' into any offer.", source: "APS RCP rate rider" },
  },
];

const trim = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…");

/** First strong number-ish token in a title → the cover's hot word. */
function hotWordIn(title: string): string | undefined {
  const m = title.match(/(\$[\d,.]+\/?\w*|[\d,.]+%|[\d.]+¢(\/kWh)?|\d[–-]\d+\s?[ap]m|\b\d{2,4}\b( GW| days| gigawatts?)?|\b\d\/\d\b)/);
  return m ? m[0].trim() : undefined;
}

/** The cover kicker from the angle — internal workflow labels stripped. */
function kickerFrom(angle: string): string {
  let a = angle.split(" — ")[0];
  // "objection-handling with real numbers: …" style prefixes are workflow
  // notes, not audience copy — drop everything up to the colon
  const label = a.match(/^([a-z][\w-]*(\s[\w-]+){0,3}):\s+(.+)$/);
  if (label && !/\d/.test(label[1])) a = label[3];
  return trim(a.charAt(0).toUpperCase() + a.slice(1), 90);
}

/** One deck line → an A08 bullet. Empty lead = render as plain body (never
    force a bold split mid-number or mid-phrase). */
function bulletFrom(line: string): { lead: string; body: string } {
  const dash = line.split(" — ");
  if (dash.length > 1 && dash[0].length >= 10 && dash[0].length <= 60 && !/\d[,.]?$/.test(dash[0]))
    return { lead: dash[0].trim(), body: dash.slice(1).join(" — ").trim() };
  const dot = line.match(/^(.{10,60}?[.:])\s+(.+)$/);
  if (dot && !/\d[,.]?$/.test(dot[1].replace(/[.:]$/, ""))) return { lead: dot[1].replace(/[.:]$/, "").trim(), body: dot[2].trim() };
  return { lead: "", body: line };
}

/** Compress a deck line to a closer-recap beat: first clause, no dangling dash. */
function recapFrom(line: string): string {
  const clause = line.split(" — ")[0].split(/(?<=[.!?])\s/)[0].replace(/[.,;:]$/, "");
  return trim(clause, 64);
}

/**
 * Compile an idea into a DESERT GRID post: cover → data slide (when the
 * subject charts) → the argument → solar closer. Zero image credits.
 */
export function compileDG(idea: Idea): DGPost {
  const pillar = THEME_PILLAR[idea.theme] || "P2";
  const eyebrow = PILLAR_EYEBROW[pillar];
  const deck = (idea.deck || []).filter(Boolean);
  const slides: Slide[] = [];

  // 1 · editorial cover
  slides.push({
    a: "A06",
    bg: "night",
    eyebrow,
    headline: idea.title.replace(/\.$/, ""),
    hotWord: hotWordIn(idea.title),
    kicker: kickerFrom(idea.angle),
  });

  // 2 · the data slide, when this subject has chartable KB numbers —
  // the TITLE is the subject, so it matches first; the angle only breaks ties
  const chart = CHART_BANK.find((c) => c.re.test(idea.title)) || CHART_BANK.find((c) => c.re.test(idea.angle));
  if (chart) slides.push(chart.slide);

  // 3 · the argument — authored deck lines as smart-brevity bullets
  if (deck.length) {
    slides.push({
      a: "A08",
      bg: "paper",
      eyebrow,
      label: "THE FULLER STORY",
      bullets: deck.slice(0, 3).map(bulletFrom),
    });
  }

  // 4 · the closer — every post lands back on the solar decision
  const landing = LANDING[idea.theme] || LANDING_DEFAULT;
  slides.push({
    a: "A16",
    bg: "night",
    eyebrow: "THE BOTTOM LINE",
    headline: landing.headline,
    recap: (deck.length ? deck : [idea.angle]).slice(0, 3).map(recapFrom),
    cta1: landing.cta1,
    cta2: "Valley homeowner? Save this — and my DMs are open. No pitch.",
  });

  return { id: `dg-${idea.id}`, pillar, title: idea.title, objective: "save", slides };
}
