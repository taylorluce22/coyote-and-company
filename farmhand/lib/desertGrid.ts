/* ============================================================
   DESERT GRID — the content-engine design system, in code.
   Mirrors farmhand/docs/content-engine-spec-2026.md: brand tokens,
   archetype params (the post-object schema §7.1), and sample posts
   built from the spec's Arizona fact bank (§6.2). The TemplateStudio
   screen renders these; later the engine emits the same objects.
   ============================================================ */

/** Brand tokens (spec §1.2) — 5 colors, max 3 per slide. */
export const DG = {
  paper: "#F4F0E6",
  ink: "#14161A",
  hot: "#E8622C", // "this costs you money / the number that matters" — ≤15% of pixels, one per slide
  cool: "#0F5A63", // the reader's win: solar / battery / savings
  neutral: "#B9B2A2", // status quo / comparison
  alert: "#9E1B14", // rare, ≤1 element/carousel
  night: "#101820", // alt surface, ≤2 slides/carousel
} as const;

/** Content pillars (spec §6.1) — rotate, never two in a row. */
export const PILLARS = {
  P1: { label: "Rate Watch", eyebrow: "RATE WATCH" },
  P2: { label: "Bill School", eyebrow: "BILL SCHOOL" },
  P3: { label: "The Grid File", eyebrow: "GRID FILE" },
  P4: { label: "Straight Answers", eyebrow: "STRAIGHT ANSWERS" },
  P5: { label: "Field Notes", eyebrow: "FIELD NOTES" },
} as const;

export type PillarId = keyof typeof PILLARS;
export type Bg = "paper" | "night" | "photo";

/* ---- archetype metadata (the rotating library, spec §2) ---- */
export interface ArchetypeMeta {
  id: string;
  name: string;
  shape: string; // the content shape it fits
}
export const ARCHETYPES: ArchetypeMeta[] = [
  { id: "A01", name: "Hero number", shape: "one surprising figure" },
  { id: "A02", name: "Ranked bar", shape: "a ranking / who pays most" },
  { id: "A03", name: "Annotated line", shape: "a trend over time" },
  { id: "A06", name: "Editorial cover", shape: "opening any explainer" },
  { id: "A08", name: "Smart-brevity bullets", shape: "a 3-beat argument" },
  { id: "A09", name: "Photo + scrim", shape: "field proof / on location" },
  { id: "A10", name: "Split myth-bust", shape: "correcting a belief" },
  { id: "A14", name: "Comparison scorecard", shape: "choosing between options" },
  { id: "A16", name: "Closer + CTA", shape: "the last slide" },
];

/* ---- the slide param schema (a subset of spec §7.1, per archetype) ---- */
export type Slide =
  | { a: "A06"; bg: Bg; eyebrow: string; headline: string; hotWord?: string; kicker: string }
  | { a: "A01"; bg: Bg; eyebrow: string; num: string; unit: string; sub: string; ctx?: string; source: string }
  | { a: "A03"; bg: Bg; title: string; standfirst: string; points: [number, number][]; startLabel: string; endLabel: string; note?: string; source: string }
  | { a: "A02"; bg: Bg; title: string; standfirst: string; rows: { label: string; pct: number; value: string; hot?: boolean }[]; ctx?: string; source: string }
  | { a: "A08"; bg: Bg; eyebrow: string; label: string; bullets: { lead: string; body: string }[]; source?: string }
  | { a: "A10"; bg: Bg; eyebrow: string; myth: string; fact: string; verdict: string; source: string }
  | { a: "A14"; bg: Bg; title: string; cols: string[]; rows: { attr: string; cells: string[] }[]; bestCol: number; source: string }
  | { a: "A09"; bg: "photo"; eyebrow: string; caption: string; micro: string }
  | { a: "A16"; bg: Bg; eyebrow: string; headline: string; recap: string[]; cta1: string; cta2: string };

export interface DGPost {
  id: string;
  pillar: PillarId;
  title: string; // internal
  objective: "reach" | "save" | "share" | "comment" | "dm";
  slides: Slide[];
}

const WORDMARK = "◆ Desert Grid";
export const HANDLE = "@yourhandle";
export { WORDMARK };

/* ---- sample posts, built from the fact bank (spec §6.2) ---- */
export const SAMPLE_POSTS: DGPost[] = [
  {
    id: "rate-watch-14",
    pillar: "P1",
    title: "APS wants 14% — the docket",
    objective: "share",
    slides: [
      { a: "A06", bg: "night", eyebrow: "RATE WATCH", headline: "APS wants 14%. Here's what the docket actually says.", hotWord: "14%", kicker: "Six slides. The filing number's on every one." },
      { a: "A01", bg: "paper", eyebrow: "THE ASK", num: "$20", unit: "/mo", sub: "What a typical APS home would pay on the new rates.", ctx: "On a ~$580M case — about a 14% residential increase.", source: "ACC Docket E-01773A-25-0105 · filed Jun 2025" },
      { a: "A03", bg: "paper", title: "Your export credit steps down every September.", standfirst: "APS RCP rate, ¢/kWh exported", points: [[0, 8.5], [1, 7.4], [2, 6.857], [3, 6.171]], startLabel: "8.5¢ '17", endLabel: "6.171¢", note: "locked 10 yrs at your hook-up date", source: "APS Rate Rider RCP schedules" },
      { a: "A02", bg: "paper", title: "Every Arizona utility is asking for more.", standfirst: "2025–26 requested residential increase", rows: [{ label: "APS", pct: 100, value: "14%", hot: true }, { label: "TEP", pct: 100, value: "14%" }, { label: "SRP", pct: 17, value: "2.4%" }], ctx: "APS is yours — and it's asking the most.", source: "ACC filings · APS, TEP, SRP · 2026" },
      { a: "A10", bg: "paper", eyebrow: "STRAIGHT ANSWERS", myth: "Solar stopped paying in Arizona — they gutted net metering.", fact: "APS still credits 6.171¢ and locks your rate for 10 years.", verdict: "The math changed, not the answer. It's a battery question now.", source: "APS RCP · Docket E-01773A-25-0105" },
      { a: "A16", bg: "night", eyebrow: "THE BOTTOM LINE", headline: "No rate plan opts you out of the climb.", recap: ["APS asking ~14% — about $20/mo more.", "Export credit drops every September.", "The only hedge is owning your production."], cta1: "Send this to whoever pays your APS bill.", cta2: "Save it for the next one, too." },
    ],
  },
  {
    id: "grid-file-heat",
    pillar: "P3",
    title: "Data centers + heat",
    objective: "share",
    slides: [
      { a: "A09", bg: "photo", eyebrow: "GRID FILE", caption: "The grid has a hungry new neighbor.", micro: "Phoenix metro · Jul 2026" },
      { a: "A01", bg: "paper", eyebrow: "THE DRAW", num: "20", unit: "%", sub: "Share of Arizona's electricity data centers may use by 2030.", ctx: "Their peak demand is growing ~100× faster than everyone else's.", source: "APS / 12News analysis · 2026" },
      { a: "A01", bg: "night", eyebrow: "THE HEAT", num: "430", unit: "", sub: "Heat-related deaths in Maricopa County in 2025 — a record.", source: "Maricopa County Public Health · 2025" },
      { a: "A08", bg: "paper", eyebrow: "GRID FILE", label: "WHY IT MATTERS", bullets: [{ lead: "New load", body: "extra-large user requests top 19,000 MW — 2× today's peak." }, { lead: "Who pays", body: "APS proposes a 45%+ rate on data centers so growth covers itself." }, { lead: "The fight", body: "the AG is challenging how much of it lands on homes." }], source: "ACC rate case materials · 2026" },
      { a: "A16", bg: "night", eyebrow: "THE BOTTOM LINE", headline: "Same grid, same heat, your home runs on it.", recap: ["Data centers = 20% of the grid by 2030.", "They compete for your evening power.", "Owning production is how you opt out."], cta1: "Send this to a Valley neighbor.", cta2: "Save it before the next bill." },
    ],
  },
];
