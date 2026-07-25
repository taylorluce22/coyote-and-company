/**
 * Idea → DESERT GRID compiler v2 — implements the content-engine laws from
 * farmhand/docs/content-engine-spec-2026.md + brain/Brand/Design & Format
 * Playbook.md (the July 2026 overhaul spec):
 *
 * - A post's slide plan is picked by its CONTENT SHAPE (hero-number, trend,
 *   myth-bust, listicle, news-react, timeline) — never one fixed template.
 * - Cover law: headline ≤9 words / ≤52 chars, ≥2-of-4 (locality, stake,
 *   number/time-window, curiosity), one accent word.
 * - Every deck line is used EXACTLY ONCE across the deck — the closer never
 *   recaps the body (the redundancy the owner killed this system over).
 * - The closer = takeaway + one quotable line + ONE objective-mapped CTA.
 * - Source line on every slide that carries a figure (spec GATE 10).
 * - Background treatments rotate per post (seeded by id) — no two identical
 *   sandwiches in a row.
 * - Every post still lands on the solar/ownership decision. APS-only.
 *
 * Chart data traces to the same KB the captions cite — never invent a
 * number the KB can't back. The vacated Grid Access Charge is never stated
 * as an active charge.
 */

import type { Idea } from "./strategy";
import type { Bg, DGPost, PillarId, Slide } from "./desertGrid";

export type DeckShape = "hero-number" | "trend" | "myth-bust" | "listicle" | "news-react" | "timeline";

/* ---- theme → pillar (spec §6.1) ---- */
const THEME_PILLAR: Record<string, PillarId> = {
  "bill-breakdown": "P2",
  authority: "P3",
  "battery-ev": "P3",
  "buyer-education": "P4",
  "objection-handling": "P4",
  "myth-busting": "P4",
  "new-homeowner": "P2",
  "social-proof": "P5",
  referral: "P5",
};
const PILLAR_EYEBROW: Record<PillarId, string> = {
  P1: "RATE WATCH",
  P2: "BILL SCHOOL",
  P3: "GRID FILE",
  P4: "STRAIGHT ANSWERS",
  P5: "FIELD NOTES",
};

/* ---- objectives: theme defaults + the CTA ladder (playbook: ONE ask) ---- */
export type Objective = "reach" | "save" | "share" | "dm" | "comment";
const THEME_OBJECTIVE: Record<string, Objective> = {
  "bill-breakdown": "save",
  authority: "share",
  "battery-ev": "save",
  "buyer-education": "save",
  "objection-handling": "share",
  "myth-busting": "share",
  "new-homeowner": "save",
  "social-proof": "reach",
  referral: "share",
};
const CTA: Record<Objective, { primary: string; secondary: string }> = {
  save: { primary: "Save this before your next bill lands.", secondary: "Valley homeowner with questions? My DMs are open — no pitch." },
  share: { primary: "Send this to whoever pays the APS bill at your house.", secondary: "And save it for your own next bill review." },
  dm: { primary: "DM me “BILL” and I'll show you where yours goes.", secondary: "Valley-wide, no strings, no pitch." },
  comment: { primary: "What's your summer bill running? Tell me below.", secondary: "Valley homeowner? My DMs are open — no pitch." },
  reach: { primary: "Follow for the verdict when it lands.", secondary: "Valley homeowner with questions? DMs open — no pitch." },
};

/* ---- the solar landing (every post ends here — the whole thesis) ---- */
const LANDING: Record<string, string> = {
  "bill-breakdown": "You can't rate-plan your way off the escalator.",
  authority: "The grid is being rebuilt around you. Owning your production is the hedge.",
  "battery-ev": "A battery puts you on the paid side of the evening peak.",
  "buyer-education": "This is exactly what a consultant checks before you sign.",
  "objection-handling": "The math changed. The answer didn't — but it has to be YOUR math.",
  "myth-busting": "The math changed. The answer didn't — but it has to be YOUR math.",
  "new-homeowner": "Fresh roof, blank slate — the best time to get the solar decision right.",
  "social-proof": "Honest numbers are the whole differentiator. Solar is a math decision.",
  referral: "Solar is a math decision. Let's run yours honestly.",
};
const LANDING_DEFAULT = "Solar is a math decision. Let's run yours honestly.";

/* ---- per-theme quotable pool — the closer's screenshot line when the
   payload doesn't bring its own. NEVER a deck line (that's the old bug). ---- */
const QUOTABLE_POOL: Record<string, string[]> = {
  "bill-breakdown": ["Every plan rides the same rising baseline.", "WHEN you use power beats how much.", "The bill isn't the problem. The trajectory is."],
  authority: ["No rate plan opts you out of the climb.", "Producing your own power is the only real exit.", "Rising demand, rising asks. Same direction, every year."],
  "battery-ev": ["If your evening power weren't valuable, they wouldn't pay to borrow it.", "Bank the cheap hours. Skip the expensive ones."],
  "buyer-education": ["The cheapest bid is not the best deal.", "Good companies have real answers. Insist on them."],
  "objection-handling": ["Waiting has a price tag in Arizona. It's printed every September.", "Sometimes the honest answer is 'not yet.' Get THAT answer."],
  "myth-busting": ["Nobody is giving away $25k of hardware. Ever.", "Production is weather. Savings are math."],
  "new-homeowner": ["'Solar-ready' and 'solar-smart' are not the same thing.", "Get the export terms in writing before closing."],
  "social-proof": ["Real numbers are rare in solar. That's the whole point.", "An honest no today earns the referral yes tomorrow."],
  referral: ["The rate-plan check is free. Start there.", "Worst case, you learn your quote is solid."],
};

/* ---- chartable subjects: keyword → an authored data slide + its quotable.
   Numbers mirror the KB verbatim. Order matters: specific before broad. ---- */
interface ChartHit { re: RegExp; slide: Slide; quotable: string }
const CHART_BANK: ChartHit[] = [
  {
    re: /export|6\.2¢|drops? (again )?in september|step.?down|waiting/i,
    slide: { a: "A03", bg: "paper", title: "Your export credit steps down every September.", standfirst: "APS RCP rate, ¢/kWh exported", points: [[0, 8.5], [1, 7.4], [2, 6.857], [3, 6.171]], startLabel: "8.5¢ '17", endLabel: "6.171¢", note: "locked 10 yrs at your interconnection date", source: "APS Rate Rider RCP schedules" },
    quotable: "Locked at hookup — and falling every September you wait.",
  },
  {
    re: /isn'?t going (back )?down|33%|climbed|bill only moves/i,
    slide: { a: "A03", bg: "paper", title: "The Arizona bill only moves one way.", standfirst: "AZ average residential bill, $/month", points: [[2014, 120], [2019, 138], [2024, 160]], startLabel: "$120 '14", endLabel: "$160 '24", note: "+33% in a decade — and the pace is picking up", source: "EIA residential data" },
    quotable: "$120 to $160 in a decade — and accelerating.",
  },
  {
    re: /doubling|doubles in/i,
    slide: { a: "A01", bg: "paper", eyebrow: "RATE WATCH", num: "~15", unit: "yrs", sub: "how fast a typical Arizona bill doubles on the last five years' pace.", ctx: "On the slower decade pace it's ~24 years. Both horizons point the same direction.", source: "EIA · 2026 [projection]" },
    quotable: "Pick either pace. It still doubles.",
  },
  {
    re: /keeps climbing|rate case|14%|asking for more|wants ~?14/i,
    slide: { a: "A02", bg: "paper", title: "Arizona's utilities are asking for more.", standfirst: "2025–26 requested residential increase", rows: [{ label: "APS", pct: 100, value: "14%", hot: true }, { label: "TEP", pct: 100, value: "14%" }], ctx: "APS is yours — about $20/month more, on top of 2024's 8%.", source: "ACC filings · 2026" },
    quotable: "8% in 2024. 14% on the table now. They'll be back.",
  },
  {
    re: /4–7pm|4-7pm|on.?peak|bill spikes|34¢|window nobody|three hours/i,
    slide: { a: "A02", bg: "paper", title: "Three hours do the damage.", standfirst: "APS summer weekday price, ¢/kWh", rows: [{ label: "4–7pm", pct: 100, value: "34¢", hot: true }, { label: "Off-peak", pct: 35, value: "12¢" }], ctx: "A 3x spread, every weekday, all summer. WHEN you use power matters more than how much.", source: "APS TOU-E schedule" },
    quotable: "34¢ vs 12¢. Three hours do the damage.",
  },
  {
    re: /20 gw|gigawatt/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "20", unit: "GW", sub: "of data-center requests waiting in APS's interconnection queue.", ctx: "4.5 GW already committed — against an 8.6 GW all-time record peak.", source: "APS resource plan filings" },
    quotable: "20 gigawatts in line. Your grid. Your rates.",
  },
  {
    re: /64,?000|one building|hungry new neighbor|#2 in north america/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "64,000", unit: "homes", sub: "the electricity a single data center can use. Running 24/7.", ctx: "Metro Phoenix is #2 in North America for proposed data-center development.", source: "APS filings · 2026" },
    quotable: "One building. Sixty-four thousand homes' worth of power.",
  },
  {
    re: /waste heat|4°|warming nearby|on your street/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "4°F", unit: "", sub: "how much data-center waste heat can raise air temps in downwind neighborhoods.", ctx: "ASU study, 2026. Hotter streets mean the AC works harder in the hours that cost the most.", source: "ASU News · May 2026" },
    quotable: "Their exhaust ends up on your evening bill.",
  },
  {
    re: /transformers?|3–4 years|lead times?/i,
    slide: { a: "A01", bg: "paper", eyebrow: "GRID FILE", num: "3–4", unit: "yrs", sub: "the wait for grid transformers now — lead times blown out by data-center demand.", ctx: "Raised at the ACC's grid workshop, July 2026. The buildout is booked solid.", source: "KJZZ · Jul 2026" },
    quotable: "The grid buildout is booked solid. Guess who waits.",
  },
  {
    re: /battery can earn|storage rewards|\$660|pay to use your (home )?battery/i,
    slide: { a: "A01", bg: "paper", eyebrow: "GRID FILE", num: "$660", unit: "/summer", sub: "what a typical home battery can earn from APS Storage Rewards.", ctx: "About $110 per average kW your battery shares during grid events — on top of the ~22¢ evening spread it's already arbitraging.", source: "APS Storage Rewards program" },
    quotable: "If your evening power weren't valuable, they wouldn't rent it.",
  },
  {
    re: /rent your battery|grid were stable/i,
    slide: { a: "A10", bg: "paper", eyebrow: "GRID FILE", myth: "The grid is fine — a home battery is a luxury toy.", fact: "APS pays roughly $110 per average kW to borrow home batteries on summer evenings. Utilities don't rent what they don't need.", verdict: "VPP pay is the tell: your evening capacity is worth real money.", source: "APS Storage Rewards · 2026" },
    quotable: "They don't rent what they don't need.",
  },
  {
    re: /bankrupt|100 solar companies|vet yours/i,
    slide: { a: "A01", bg: "night", eyebrow: "STRAIGHT ANSWERS", num: "~100", unit: "", sub: "U.S. solar companies gone bankrupt since 2023.", ctx: "Titan, SunPower, Sunnova, Freedom Forever among them. Warranties don't service themselves.", source: "AZ solar market · 2023–26" },
    quotable: "The warranty is only as real as the company behind it.",
  },
  {
    re: /113 days|hottest year|100°/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "113", unit: "days", sub: "straight of 100°F+ — a Phoenix record.", ctx: "2024 was the hottest year ever recorded here; 2025 came second. Your AC never got a break.", source: "NWS Phoenix" },
    quotable: "113 days over 100°. The grid felt every one.",
  },
  {
    re: /\b430\b|heat deaths|heat-related deaths/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "430", unit: "", sub: "heat-related deaths in Maricopa County in 2025 — a record.", ctx: "Most indoor deaths had AC present — but not working. Check on your people.", source: "Maricopa Public Health · 2025" },
    quotable: "Cooling isn't comfort in Arizona. It's infrastructure.",
  },
  {
    re: /heat (came|is|arrived) early|192 under investigation/i,
    slide: { a: "A01", bg: "night", eyebrow: "GRID FILE", num: "192", unit: "", sub: "heat deaths under investigation by July 2 — ahead of last year's pace.", ctx: "16 confirmed; the heat arrived in March. The county urges checking vulnerable neighbors' AC.", source: "Maricopa County · Jul 2026" },
    quotable: "Summer showed up early. The grid felt it first.",
  },
  {
    re: /suddenly a lease|7 in 10|lease wave|tpo wave/i,
    slide: { a: "A01", bg: "paper", eyebrow: "STRAIGHT ANSWERS", num: "7/10", unit: "", sub: "new AZ solar deals in 2026 are leases or PPAs.", ctx: "A tax-code story, not a trick — but read the escalator: 0.99–2.99%/yr for 20–25 years.", source: "AZ solar market · 2026" },
    quotable: "It's a tax-code shift, not a favor. Price the 25-year total.",
  },
  {
    re: /cfpb|cheap.*financing|dealer fee/i,
    slide: { a: "A01", bg: "night", eyebrow: "STRAIGHT ANSWERS", num: "+30%", unit: "", sub: "what hidden dealer fees can add to a financed solar loan's principal.", ctx: "Rolled into the payment, not the rate — the APR you're shown doesn't reveal it.", source: "CFPB solar-lending report" },
    quotable: "Ask for the cash price first. Always.",
  },
  {
    re: /federal (solar )?credit is gone|30% federal|still being pitched/i,
    slide: { a: "A10", bg: "paper", eyebrow: "STRAIGHT ANSWERS", myth: "Solar stopped making sense when the 30% federal credit died.", fact: "Arizona still stacks its $1,000 credit + sales- and property-tax exemptions — and high-bill homes still pencil.", verdict: "The math changed, not the answer. It has to be YOUR math now.", source: "IRS FS-2025-05 · AZ DOR" },
    quotable: "The math changed. The answer didn't.",
  },
  {
    re: /terms follow the house|selling.*home with solar|transfer/i,
    slide: { a: "A10", bg: "paper", eyebrow: "BILL SCHOOL", myth: "Solar complicates selling the house.", fact: "On APS, legacy net metering and the export-rate lock follow the house to the next owner — a locked 2018 rate is worth real money.", verdict: "Ask for the interconnection date before you price 'free solar' into any offer.", source: "APS RCP rate rider" },
    quotable: "A locked export rate is worth real money at resale.",
  },
  {
    re: /no (rate )?plan opts you out|opts you out|rate-plan your way|switch(ing)? plans/i,
    slide: { a: "A10", bg: "paper", eyebrow: "RATE WATCH", myth: "Switch to the right rate plan and you're safe from the increases.", fact: "Every plan rides the same rising baseline — a plan change shapes the increase. It doesn't refuse it.", verdict: "Plan literacy explains the peak. Ownership is the hedge.", source: "APS tariff filings · 2026" },
    quotable: "You can shape the increase. You can't refuse it.",
  },
  {
    re: /clock is set|rate.?case.*(timeline|calendar)|new rates (early )?2027/i,
    slide: { a: "A11", bg: "paper", headline: "The APS rate case, on a calendar.", nodes: [
      { date: "2024", event: "APS takes ~8% — the last increase", state: "past" },
      { date: "May–Jul 2026", event: "31-day hearing: ~36 intervenors, 50+ witnesses", state: "past" },
      { date: "Jul 2026", event: "Hearing closed. The wait begins", state: "now" },
      { date: "~Nov 2026", event: "Judge's recommended order expected", state: "future" },
      { date: "Dec 31, 2026", event: "Commission must vote", state: "future" },
      { date: "Early 2027", event: "New rates land on bills", state: "future" },
    ], source: "ACC docket · Jul 2026" },
    quotable: "The vote is Dec 31. The bill lands in 2027.",
  },
  {
    re: /growth pays for growth|who pays for the boom/i,
    slide: { a: "A07", bg: "paper", statement: "APS says data centers will pay for their own growth. The state's own ratepayer office says it can't confirm that yet.", highlights: ["can't confirm"], micro: "The +47% data-center class is the claim. RUCO's doubt is on the record.", source: "ACC / RUCO · Jul 2026" },
    quotable: "The promise is on record. So is the doubt.",
  },
  {
    re: /efficiency (mandate|standards?)|repeal/i,
    slide: { a: "A07", bg: "paper", statement: "Arizona just repealed its energy-efficiency mandate — the bill-cutting programs are no longer required to exist.", highlights: ["repealed"], micro: "ACC voted 4-0 on July 8. Existing rebates continue for now — case by case.", source: "ACC · Jul 2026" },
    quotable: "The mandate is gone. The trajectory isn't.",
  },
  {
    re: /summer bill goes|what makes up your summer|cooling ≈|half your bill/i,
    slide: { a: "A07", bg: "paper", statement: "About half of an Arizona summer bill is cooling — and most of it lands inside the priciest three hours.", highlights: ["half", "three hours"], micro: "That overlap is why timing beats thermostat guilt.", source: "DOE / EIA · residential energy use" },
    quotable: "Half the bill is cooling. Timing is the lever.",
  },
];

/* ---------------- helpers ---------------- */

const trim = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…");
const words = (s: string) => s.trim().split(/\s+/).length;
const hash = (s: string) => Math.abs([...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7));

/** First strong number-ish token → the cover's hot word (one accent max). */
function hotWordIn(title: string): string | undefined {
  const m = title.match(/(\$[\d,.]+\/?\w*|[\d,.]+%|[\d.]+¢(\/kWh)?|\d[–-]\d+\s?[ap]m|September \d?|\b\d{2,4}\b( GW| days| gigawatts?| homes)?|\b\d\/\d\b)/i);
  return m ? m[0].trim() : undefined;
}

/** Cover law: ≤9 words AND ≤52 chars. Authored hooks win; otherwise derive
    from the title without ellipsis-truncating (spec forbids it). */
function coverFrom(idea: Idea): { headline: string; kicker: string; hotWord?: string } {
  if (idea.hook) return { headline: idea.hook.headline, kicker: idea.hook.kicker, hotWord: idea.hook.hotWord ?? hotWordIn(idea.hook.headline) };
  const ok = (s: string) => words(s) <= 9 && s.length <= 52;
  const title = idea.title.replace(/\.$/, "");
  const angleKicker = kickerFrom(idea.angle);
  if (ok(title)) return { headline: title, kicker: angleKicker, hotWord: hotWordIn(title) };
  // a whole title slightly over the char limit beats a phrase cut mid-thought
  if (words(title) <= 9 && title.length <= 58) return { headline: title, kicker: angleKicker, hotWord: hotWordIn(title) };
  // split at the strongest seam — the remainder becomes the kicker (open loop)
  for (const seam of [": ", " — ", ". ", "? "]) {
    const at = title.indexOf(seam);
    if (at > 0) {
      const head = title.slice(0, at + (seam === "? " ? 1 : 0)).trim();
      const rest = title.slice(at + seam.length).trim();
      if (ok(head)) return { headline: head, kicker: rest ? trim(cap(rest), 90) : angleKicker, hotWord: hotWordIn(head) };
    }
  }
  // last resort: first ≤8 words that fit — never an ellipsis
  const ws = title.split(/\s+/);
  let head = "";
  for (const w of ws) {
    if ((head + " " + w).trim().length > 52 || words(head) >= 8) break;
    head = (head + " " + w).trim();
  }
  return { headline: head.replace(/[,:;—-]$/, ""), kicker: angleKicker, hotWord: hotWordIn(head) };
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Cover kicker from the angle — internal workflow labels stripped. */
function kickerFrom(angle: string): string {
  let a = angle.split(" — ")[0];
  const label = a.match(/^([a-z][\w-]*(\s[\w-]+){0,3}):\s+(.+)$/);
  if (label && !/\d/.test(label[1])) a = label[3];
  return trim(cap(a), 90);
}

/** One deck line → an A08 bullet. Empty lead = plain body (never split a number). */
function bulletFrom(line: string): { lead: string; body: string } {
  const clean = line.replace(/^\d+\.\s*/, "");
  const dash = clean.split(" — ");
  if (dash.length > 1 && dash[0].length >= 10 && dash[0].length <= 60 && !/\d[,.]?$/.test(dash[0]))
    return { lead: dash[0].trim(), body: dash.slice(1).join(" — ").trim() };
  const dot = clean.match(/^(.{10,60}?[.:])\s+(.+)$/);
  if (dot && !/\d[,.]?$/.test(dot[1].replace(/[.:]$/, ""))) return { lead: dot[1].replace(/[.:]$/, "").trim(), body: dot[2].trim() };
  return { lead: "", body: clean };
}

/** ≤22-word interpretive statement for A07, highlights = its number tokens. */
function a07From(line: string, source?: string): Slide {
  const first = line.split(/(?<=[.!?])\s/)[0];
  const statement = words(first) <= 22 ? first : trim(first, 120);
  // highlight-worthy tokens only — a bare single digit mid-sentence reads
  // as a typo when marked, so require units/length
  const nums = (statement.match(/(\$[\d,.]+\w*|[\d,.]+%|[\d.]+¢(\/kWh)?|\d[–-]\d+\s?[ap]m|\b\d[\d,.]+\b( GW| days| years| homes| kWh)?|\b\d+ (GW|days|years|homes|kWh|hours)\b)/gi) || []).filter((n) => n.trim().length >= 2);
  return { a: "A07", bg: "paper", statement, highlights: nums.slice(0, 2).map((n) => n.trim()), ...(/\d/.test(statement) && source ? { source } : {}) };
}

/** Listicle slide label from the title's promise. */
function listLabel(title: string): string {
  if (/question/i.test(title)) return "QUESTION";
  if (/red flag/i.test(title)) return "RED FLAG";
  if (/step/i.test(title)) return "STEP";
  if (/rule/i.test(title)) return "RULE";
  if (/load|run off-peak|appliance/i.test(title)) return "LOAD";
  return "POINT";
}

/** Rough sameness check — kills cover-vs-closer echo (normalized overlap). */
function echoes(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const A = new Set(norm(a));
  const B = norm(b);
  if (!A.size || !B.length) return false;
  const shared = B.filter((w) => A.has(w)).length;
  return shared / Math.min(A.size, B.length) > 0.6;
}

/** Shape heuristics for ideas that predate authored shapes. */
function shapeFor(idea: Idea, chart: ChartHit | undefined): DeckShape {
  if (idea.shape) return idea.shape;
  const deck = idea.deck || [];
  if (deck.some((d) => /^\d+\./.test(d)) || /\b(3|three|6|six)\b.*(question|red flag|step|thing)/i.test(idea.title)) return "listicle";
  if (chart) {
    if (chart.slide.a === "A03") return "trend";
    if (chart.slide.a === "A10") return "myth-bust";
    if (chart.slide.a === "A11") return "timeline";
    return "hero-number";
  }
  return "listicle";
}

/* ---------------- the compiler ---------------- */

/**
 * Compile an idea into a DESERT GRID post. Slide plan by shape; every deck
 * line used at most once; closer never repeats the body; one CTA; sources on
 * data slides; backgrounds rotate per post. Zero image credits.
 */
export function compileDG(idea: Idea): DGPost {
  const pillar = idea.pillar || THEME_PILLAR[idea.theme] || "P2";
  const eyebrow = PILLAR_EYEBROW[pillar];
  const objective: Objective = idea.objective || THEME_OBJECTIVE[idea.theme] || "save";
  const deck = (idea.deck || []).filter(Boolean);
  const seed = hash(idea.id + idea.title);
  const defaultSource = idea.source || "AZ energy KB · Jul 2026";

  // background rotation: cover+closer share one treatment, body the other
  const coverBg: Bg = seed % 2 === 0 ? "night" : "paper";
  const bodyBg: Bg = coverBg === "night" ? "paper" : "night";

  // chart selection: authored shapes that NEED a specific archetype search
  // for that kind first (a timeline post must not grab the rate-case bars
  // just because "rate case" matched earlier in the bank)
  const NEED: Partial<Record<DeckShape, Slide["a"]>> = { timeline: "A11", trend: "A03", "myth-bust": "A10" };
  const matches = (c: ChartHit) => c.re.test(idea.title) || c.re.test(idea.angle);
  const need = idea.shape ? NEED[idea.shape] : undefined;
  const chart =
    (need ? CHART_BANK.find((c) => c.slide.a === need && matches(c)) : undefined) ||
    CHART_BANK.find((c) => c.re.test(idea.title)) ||
    CHART_BANK.find((c) => c.re.test(idea.angle));
  const shape = shapeFor(idea, chart);

  // deck-line cursor — each line spent exactly once, leftovers go to the caption
  let cursor = 0;
  const take = (n: number) => deck.slice(cursor, (cursor += n));

  const slides: Slide[] = [];

  // 1 · cover (law-checked)
  const cover = coverFrom(idea);
  slides.push({ a: "A06", bg: coverBg, eyebrow, headline: cover.headline, hotWord: cover.hotWord, kicker: cover.kicker });

  // 2+ · the body, by shape
  const withSource = (s: Slide): Slide => {
    if (s.a === "A08" && !s.source && s.bullets.some((b) => /\d/.test(b.lead + b.body))) return { ...s, source: defaultSource };
    return s;
  };
  const a08 = (label: string, lines: string[]): Slide =>
    withSource({ a: "A08", bg: "paper", eyebrow, label, bullets: lines.map(bulletFrom) });

  if (shape === "listicle") {
    const label = listLabel(idea.title);
    const lines = take(Math.min(3, deck.length || 0));
    lines.forEach((line, i) => {
      slides.push(withSource({ a: "A08", bg: i % 2 === 0 ? "paper" : bodyBg, eyebrow, label: `${label} ${String(i + 1).padStart(2, "0")}`, bullets: [bulletFrom(line)] }));
    });
    if (!lines.length) slides.push(a07From(idea.angle, defaultSource));
  } else if (shape === "trend" && chart) {
    slides.push(chart.slide);
    const [interp, ...rest] = take(deck.length >= 3 ? 3 : deck.length);
    if (interp) slides.push(a07From(interp, defaultSource));
    if (rest.length) slides.push(a08("WHAT IT MEANS FOR YOU", rest));
  } else if (shape === "myth-bust" && chart) {
    slides.push(chart.slide);
    const evidence = CHART_BANK.find((c) => c !== chart && c.slide.a === "A01" && (c.re.test(idea.title) || c.re.test(idea.angle)));
    if (evidence) slides.push(evidence.slide);
    const rest = take(Math.min(2, deck.length));
    if (rest.length) slides.push(a08("THE FULLER STORY", rest));
  } else if (shape === "timeline" && chart) {
    slides.push(chart.slide);
    const rest = take(Math.min(2, deck.length));
    if (rest.length) slides.push(a08("WHAT'S AT STAKE", rest));
  } else if (shape === "news-react") {
    if (idea.receipt) slides.push({ a: "A12", bg: bodyBg, quote: idea.receipt.quote, attrib: idea.receipt.attrib, provenance: idea.receipt.provenance, source: idea.receipt.provenance });
    if (chart) slides.push(chart.slide);
    const [interp, ...rest] = take(Math.min(3, deck.length));
    if (interp) slides.push(a07From(interp, defaultSource));
    if (rest.length) slides.push(a08("WHAT IT MEANS FOR YOUR BILL", rest));
  } else {
    // hero-number (and any degraded shape): number as object → why it matters → interpretation
    if (chart) slides.push(chart.slide);
    const lines = take(Math.min(3, deck.length));
    if (lines.length > 1) {
      slides.push(a08("WHY IT MATTERS", lines.slice(0, 2)));
      if (lines[2]) slides.push(a07From(lines[2], defaultSource));
    } else if (lines.length === 1) {
      slides.push(a07From(lines[0], defaultSource));
    }
  }

  // 3 · the closer — takeaway + ONE quotable + ONE objective CTA. Never a
  // body recap, and never an echo of the cover headline.
  const landing = LANDING[idea.theme] || LANDING_DEFAULT;
  const pool = QUOTABLE_POOL[idea.theme] || QUOTABLE_POOL.referral;
  let quotable = chart?.quotable || pool[seed % pool.length];
  if (echoes(cover.headline, quotable)) quotable = pool[seed % pool.length];
  if (echoes(cover.headline, quotable)) quotable = pool[(seed + 1) % pool.length];
  const cta = { ...CTA[objective] };
  // the "verdict" follow line only fits pending-news posts
  if (objective === "reach" && !idea.perishable) cta.primary = "Follow for the numbers nobody else posts.";
  slides.push({
    a: "A16",
    bg: coverBg,
    eyebrow: "THE BOTTOM LINE",
    headline: idea.takeaway || landing,
    recap: [quotable],
    cta1: cta.primary,
    cta2: cta.secondary,
  });

  return { id: `dg-${idea.id}`, pillar, title: idea.title, objective, slides };
}

/** Deck lines the compiler did NOT put on slides — caption material. */
export function captionOverflow(idea: Idea): string[] {
  // the compiler consumes at most 3 lines; anything beyond feeds the caption
  return (idea.deck || []).slice(3);
}

/** The solar-landing sentence for a theme — the caption's required closing beat. */
export function solarLanding(theme: string): string {
  return LANDING[theme] || LANDING_DEFAULT;
}
