/* ============================================================
   Farmhand demo data — authentic content from the design handoff.
   Persona: Jess, residential realtor, Gilbert AZ.
   ============================================================ */

export type Channel = "Instagram" | "Facebook" | "Nextdoor";

export interface EnginePost {
  id: string;
  channel: Channel;
  when: string;
  layer: "VOLUME" | "PERSONAL";
  title: string;
  preview: string;
  thumb: string;
  thumbLabel: string;
}

export const ENGINE_POSTS: EnginePost[] = [
  {
    id: "e1",
    channel: "Instagram",
    when: "Today · 8:00 AM",
    layer: "VOLUME",
    title: "What Gilbert homes actually sold for in June",
    preview:
      "12 closings in 85234 last month. Median: $487K — up 2.1% from May. The three that went over asking all had one thing in common…",
    thumb: "linear-gradient(135deg, #3B2B63, #1C4666)",
    thumbLabel: "MARKET\nGRAPHIC",
  },
  {
    id: "e2",
    channel: "Facebook",
    when: "Today · 12:30 PM",
    layer: "PERSONAL",
    title: "I handed the Ramirez family their keys today",
    preview:
      "We searched for eight months. Two heartbreaks, one perfect backyard for the twins. This is my favorite part of the job. Welcome home. 🔑",
    thumb: "linear-gradient(135deg, #6A3B2B, #8A5A2B)",
    thumbLabel: "YOUR\nPHOTO",
  },
  {
    id: "e3",
    channel: "Nextdoor",
    when: "Tomorrow · 9:00 AM",
    layer: "VOLUME",
    title: "Monsoon season roof check: 5 things to look at this weekend",
    preview:
      "Before the July storms hit: check these five spots on your roof now — #3 is the one that causes 80% of insurance claims in the East Valley…",
    thumb: "linear-gradient(135deg, #2B4A3B, #1C6650)",
    thumbLabel: "TIP\nCARD",
  },
  {
    id: "e4",
    channel: "Instagram",
    when: "Tomorrow · 5:30 PM",
    layer: "PERSONAL",
    title: "Val Vista Lakes evening walk — neighborhood spotlight",
    preview:
      "The lake path at 6pm is why my buyers keep asking about this neighborhood. Current listings, HOA truth, and what $520K gets you here…",
    thumb: "linear-gradient(135deg, #2B3A63, #563B7A)",
    thumbLabel: "YOUR\nB-ROLL",
  },
];

/* ---- Post Studio ---- */
export const STUDIO_ACCENTS: Record<string, string> = {
  market: "#4DA6FF",
  story: "#FF9A62",
  tips: "#37D98A",
  spotlight: "#B98CFF",
};

export const STUDIO_META: Record<
  string,
  { pillar: string; seed: string; cta: string }
> = {
  e1: { pillar: "market", seed: "fh-sold-map", cta: "Save this for your next price conversation." },
  e2: { pillar: "story", seed: "fh-close1", cta: "Know someone house-hunting? Send them this." },
  e3: { pillar: "tips", seed: "fh-desert1", cta: "Save the checklist. Roof first, storms later." },
  e4: { pillar: "spotlight", seed: "fh-lake1", cta: "Want the Val Vista breakdown? Comment TOUR." },
};

export interface LibImg {
  seed: string;
  alt: string;
  tier: string;
}

export const STUDIO_LIB: Record<string, LibImg[]> = {
  e1: [
    { seed: "fh-sold-map", alt: "Your photo: Gilbert street at dusk", tier: "YOURS" },
    { seed: "fh-street1", alt: "Your photo: Heritage District", tier: "YOURS" },
    { seed: "fh-tmpl-stats", alt: "Template: June sold-price stat card", tier: "TEMPLATE" },
    { seed: "fh-tmpl-map", alt: "Template: 85234 sold map", tier: "TEMPLATE" },
    { seed: "fh-stk-aerial", alt: "Stock: desert suburb aerial", tier: "PEXELS" },
    { seed: "fh-stk-keys", alt: "Stock: keys and contract", tier: "UNSPLASH" },
  ],
  e2: [
    { seed: "fh-close1", alt: "Your photo: key handoff", tier: "YOURS" },
    { seed: "fh-family1", alt: "Your photo: buyers on porch", tier: "YOURS" },
    { seed: "fh-house1", alt: "Your photo: Willow St exterior", tier: "YOURS" },
    { seed: "fh-open1", alt: "Your photo: staging moment", tier: "YOURS" },
    { seed: "fh-stk-hands", alt: "Stock: hands with house keys", tier: "PEXELS" },
    { seed: "fh-stk-porch", alt: "Stock: family at doorway", tier: "PIXABAY" },
  ],
  e3: [
    { seed: "fh-desert1", alt: "Your photo: monsoon clouds", tier: "YOURS" },
    { seed: "fh-house2", alt: "Your photo: backyard pre-storm", tier: "YOURS" },
    { seed: "fh-tmpl-check", alt: "Template: 5-point roof checklist", tier: "TEMPLATE" },
    { seed: "fh-stk-roof1", alt: "Stock: desert roofline", tier: "PEXELS" },
    { seed: "fh-stk-storm1", alt: "Stock: storm front", tier: "UNSPLASH" },
    { seed: "fh-stk-rain1", alt: "Stock: rain on tiles", tier: "PIXABAY" },
  ],
  e4: [
    { seed: "fh-lake1", alt: "Your photo: Val Vista lake path", tier: "YOURS" },
    { seed: "fh-street1", alt: "Your photo: evening street", tier: "YOURS" },
    { seed: "fh-cactus1", alt: "Your photo: saguaro golden hour", tier: "YOURS" },
    { seed: "fh-tmpl-spot", alt: "Template: neighborhood stat strip", tier: "TEMPLATE" },
    { seed: "fh-stk-lake", alt: "Stock: community lake", tier: "PEXELS" },
    { seed: "fh-stk-walk", alt: "Stock: suburban walking path", tier: "UNSPLASH" },
  ],
};

/* ---- Composer ---- */
export type CompCh = "ig" | "fb" | "nd";

export const COMP_COPY: Record<
  CompCh,
  { handle: string; meta: string; long: string; short: string; alt: string }
> = {
  ig: {
    handle: "jess.sells.gilbert",
    meta: "Instagram · carousel",
    long: "Before the July storms hit: 5 spots on your roof to check this weekend. 🌩\n\n#3 causes 80% of monsoon insurance claims in the East Valley — and it takes 4 minutes to check.\n\nSwipe for the list. Save it for Saturday morning.",
    short:
      "5 roof spots to check before monsoon season — #3 causes 80% of East Valley claims. Swipe + save. 🌩",
    alt: "Monsoon prep, the realtor version: the 5 roof checks I do at every showing this time of year. Swipe through — #3 is the one that surprises people.",
  },
  fb: {
    handle: "Jess Carter · Realtor",
    meta: "Facebook · photo post",
    long: "East Valley friends — before the July storms roll in, take 10 minutes this weekend for a roof check.\n\nThe five spots that matter:\n1. Scuppers and flat-roof drains (clear the spring debris)\n2. Tile slippage on the south face\n3. Flashing around vents — this one causes 80% of monsoon claims\n4. Overhanging mesquite branches\n5. Coating cracks on flat sections\n\nTen minutes now beats a $4,000 ceiling repair in August.",
    short:
      "Monsoon prep PSA: check your scuppers, tile, flashing, branches, and coating this weekend. 10 minutes now beats a $4K ceiling repair in August.",
    alt: "Every August I get the same sad phone calls after the first big storm. This year, do the 10-minute roof check first — here are the 5 spots that matter.",
  },
  nd: {
    handle: "Jess Carter · Gilbert",
    meta: "Nextdoor · business post",
    long: "Hi neighbors — PSA from someone who walks a LOT of Gilbert roofs: before the storms hit, give yours a 10-minute check.\n\nScuppers, tile slippage, vent flashing, overhanging branches, coating cracks. The flashing is the one that causes most monsoon claims around here.\n\nStay dry out there! ⛈",
    short:
      "PSA neighbors: 10-minute roof check before the storms — scuppers, tile, flashing, branches, coating. Flashing causes most claims here. Stay dry! ⛈",
    alt: "Neighbors: monsoon season is close. A 10-minute roof check now (especially your vent flashing) saves the August insurance headache. Happy to share my full checklist.",
  },
};

export interface CompImg {
  seed: string;
  alt: string;
  tier: string;
  provider?: string;
}

export const COMP_IMGS: Record<string, CompImg> = {
  t1a: { seed: "fh-desert1", alt: "Your photo: monsoon clouds over rooftops", tier: "YOUR PHOTO" },
  t1b: { seed: "fh-house2", alt: "Your photo: backyard before the storm", tier: "YOUR PHOTO" },
  t1c: { seed: "fh-street1", alt: "Your photo: Heritage District street", tier: "YOUR B-ROLL" },
  t3a: { seed: "fh-tmpl1", alt: "Branded template: 5 roof checks list", tier: "TEMPLATE" },
  t3b: { seed: "fh-tmpl2", alt: "Branded template: monsoon stat card", tier: "TEMPLATE" },
  t3c: { seed: "fh-tmpl3", alt: "Branded template: checklist carousel cover", tier: "TEMPLATE" },
  t4a: { seed: "fh-stk-roof1", alt: "Stock: desert home roofline", tier: "STOCK · PEXELS", provider: "PEXELS" },
  t4b: { seed: "fh-stk-storm1", alt: "Stock: storm clouds", tier: "STOCK · UNSPLASH", provider: "UNSPLASH" },
  t4c: { seed: "fh-stk-rain1", alt: "Stock: rain on rooftop", tier: "STOCK · PIXABAY", provider: "PIXABAY" },
};

export const COMP_RATIOS: Record<
  string,
  { label: string; w: number; h: number; box: string; ar: string }
> = {
  portrait: { label: "4:5", w: 1080, h: 1350, box: "300px", ar: "4/5" },
  square: { label: "1:1", w: 1080, h: 1080, box: "320px", ar: "1/1" },
  story: { label: "9:16", w: 1080, h: 1920, box: "260px", ar: "9/16" },
};

export const COMP_ACCENTS: Record<string, string> = {
  cyan: "#38BDF8",
  violet: "#B98CFF",
  green: "#37D98A",
  amber: "#FFC23D",
  rose: "#FF5D8F",
};

export const COMP_TIERS = [
  {
    num: "1",
    name: "Your photos",
    note: "Upload straight from your computer or iPhone library — always preferred over stock.",
    ids: ["t1a", "t1b", "t1c"],
    color: "#41D98A",
  },
  {
    num: "2",
    name: "Branded templates",
    note: "Your colors + license footer, built for list and stat posts like this one.",
    ids: ["t3a", "t3b", "t3c"],
    color: "#C9A8FF",
  },
  {
    num: "3",
    name: "On-demand stock",
    note: "Perplexity-expanded search across free APIs. Decoration only — clearly not your listing.",
    ids: ["t4a", "t4b", "t4c"],
    color: "#FFC23D",
  },
];

/* ---- Channel Directory ---- */
export const CHANNELS = [
  { platform: "FB GROUP", plat: "#7DD3FC", name: "East Valley Homeowners", members: "14.2K", cadence: "post 2×/wk", rules: "No listings except the pinned Promo Monday thread. Value posts welcome daily.", promo: "Promo Monday", promoOn: true, health: "active", healthColor: "#41D98A", last: "2 days ago" },
  { platform: "NEXTDOOR", plat: "#26E0C8", name: "Gilbert Neighbors", members: "8.9K", cadence: "post 1×/wk", rules: "Business posts allowed from a verified page. Keep it neighborly, no hard sells.", promo: "Business post OK", promoOn: true, health: "active", healthColor: "#41D98A", last: "4 days ago" },
  { platform: "FB GROUP", plat: "#7DD3FC", name: "85234 Local Chat", members: "5.1K", cadence: "post 1×/wk", rules: "Helpful window only. No promotion of services. Neighbor-to-neighbor tips.", promo: "No promo", promoOn: false, health: "active", healthColor: "#41D98A", last: "6 days ago" },
  { platform: "NEXTDOOR", plat: "#26E0C8", name: "Val Vista Lakes", members: "3.4K", cadence: "post 1×/wk", rules: "Neighborhood-specific. Spotlights and market updates perform well here.", promo: "Spotlights OK", promoOn: true, health: "warm", healthColor: "#FFC23D", last: "12 days ago" },
  { platform: "FB GROUP", plat: "#7DD3FC", name: "Power Ranch Community", members: "9.7K", cadence: "post 2×/wk", rules: "Promo allowed Fridays only. Otherwise value + community engagement.", promo: "Promo Friday", promoOn: true, health: "quiet", healthColor: "#FF5D8F", last: "3 weeks ago" },
  { platform: "FORUM", plat: "#C9A8FF", name: "AZ Real Estate Talk", members: "2.1K", cadence: "post 1×/mo", rules: "Long-form market analysis. Link to your content, don't dump listings.", promo: "Links OK", promoOn: true, health: "warm", healthColor: "#FFC23D", last: "16 days ago" },
];

/* ---- Reply Assistant ---- */
export const ASSISTANT_DEFAULT_INPUT =
  "Anyone know a good realtor in Gilbert? Just moved to Val Vista and looking to buy in the spring — no idea where to start with this market.";

export function assistantReplies(tone: string): string[] {
  const base: Record<string, string> = {
    warm: "Welcome to Val Vista — you picked a great pocket of Gilbert! Spring's actually a smart time to buy here; inventory opens up right after the winter visitors head home. Happy to share what's realistically selling in your price range, no pressure at all. The lake path alone sells most people. 🏡",
    expert: "Good timing on the spring plan. Val Vista and the surrounding 85234 zip have been sitting around a $487K median with about 5–6 weeks of inventory — a bit more balanced than last year. The move is getting pre-approved now so you're ready when the March/April listings hit. Happy to walk you through comps whenever you want.",
    brief: "Welcome to Val Vista! Spring's a smart time to buy here — inventory opens up. Happy to share what's selling in your range, no pressure.",
  };
  const t = base[tone] || base.warm;
  return [
    t,
    "Oh you're gonna love Val Vista! Spring's honestly the sweet spot to buy around here — everything opens up once the snowbirds leave. Lmk if you want the real scoop on what's selling, zero pressure. That lake path though. 🙌",
    base.brief,
  ];
}

/* ---- Results ---- */
export const RESULTS_STATS = [
  { label: "Posts completed", value: "23 / 26", sub: "planned this month", color: "#C9A8FF" },
  { label: "Week planned", value: "7 / 7", sub: "posts on best times", color: "#FFC23D" },
  { label: "Farm coverage", value: "6 / 8", sub: "groups active this week", color: "#FFC23D" },
];

export const RESULTS_LOG = [
  { channel: "DM", note: "Val Vista buyer from the market carousel", when: "2h ago", col: "#7DD3FC" },
  { channel: "COMMENT", note: "Roof-tip post — 3 neighbors asked for the checklist", when: "1d ago", col: "#C9A8FF" },
  { channel: "CALL", note: "Seller from Promo Monday just-sold share", when: "2d ago", col: "#FFC23D" },
  { channel: "DM", note: "Higley thread reply → coffee booked", when: "4d ago", col: "#7DD3FC" },
];

/* ---- Settings ---- */
export const SET_VOICE = [
  { key: "warm", label: "Warm & neighborly", def: true },
  { key: "story", label: "Story-driven posts", def: true },
  { key: "emoji", label: "Light emoji use", def: false },
];
export const SET_IMG_PREFS = [
  { key: "desert", label: "Desert landscaping only (no green lawns)", def: true },
  { key: "noreuse", label: "Never reuse stock near other agents", def: true },
];
export const SET_CONNECTIONS = [
  { name: "Claude — content", status: "connected", color: "#41D98A" },
  { name: "Perplexity — local intel", status: "connected", color: "#41D98A" },
  { name: "Instagram", status: "connected", color: "#41D98A" },
  { name: "Facebook Page", status: "connected", color: "#41D98A" },
  { name: "Nextdoor Business", status: "connect →", color: "#FFC23D" },
];

/* ---- Dashboard ---- */
export const TICKER_POOL = [
  { icon: "▣", color: "#C9A8FF", text: "Post published to Instagram — June sold report", when: "8:00a" },
  { icon: "◈", color: "#7DD3FC", text: "New comment in East Valley Homeowners", when: "9:12a" },
  { icon: "✓", color: "#41D98A", text: "Nextdoor monsoon tip approved & scheduled", when: "9:40a" },
  { icon: "⚑", color: "#FFC23D", text: "Scout: Global Village Festival flagged — Jul 12", when: "10:05a" },
  { icon: "◉", color: "#FF9A62", text: "DM from Val Vista Lakes group member", when: "10:31a" },
  { icon: "▣", color: "#C9A8FF", text: "Facebook keys post queued — 12:30 PM slot", when: "11:02a" },
  { icon: "◈", color: "#26E0C8", text: "85234 Local Chat: helpful window opens 6 PM", when: "11:48a" },
  { icon: "✚", color: "#41D98A", text: "Inbound lead logged from Gilbert Neighbors", when: "12:15p" },
];

export const FARM_CHIPS = [
  { name: "East Valley Homeowners", note: "Promo Mon", dot: "#41D98A" },
  { name: "Gilbert Neighbors", note: "hot thread", dot: "#41D98A" },
  { name: "85234 Local Chat", note: "helpful window", dot: "#41D98A" },
  { name: "Power Ranch Nextdoor", note: "3 wks quiet", dot: "#FFC23D" },
];

export const DASH_STATS = [
  { label: "Posts ready", value: "4", sub: "waiting for your approval", color: "#C9A8FF" },
  { label: "Week planned", value: "5/7", sub: "days with a post scheduled", color: "#FFC23D" },
  { label: "Inbound convos", value: "9", sub: "this month · your hero number", color: "#41D98A" },
  { label: "Farm coverage", value: "6/8", sub: "groups active this week", color: "#FFC23D" },
];

export const DASH_INTEL = [
  { tag: "EVENT", color: "#FFC23D", title: "Global Village Festival · Jul 12", angle: "Angle: neighborhood-spotlight post + group meetup comment" },
  { tag: "MARKET", color: "#C9A8FF", title: "85234 median hit $487K in June", angle: "Angle: 'what actually sold' carousel — your top format" },
  { tag: "THREAD", color: "#7DD3FC", title: "'Best neighborhoods near Higley?' — 17 replies", angle: "Angle: helpful reply, no pitch — Scout drafted one" },
];

/* 3D farm neighborhood clusters (also drives the iso fallback map) */
export const FARM_CLUSTERS = [
  { slug: "val-vista-lakes", img: "/neighborhoods/val-vista-lakes.jpg", hex: "#38BDF8", name: "Val Vista Lakes", stat: "12 posts · warm", live: true },
  { slug: "agritopia", img: "/neighborhoods/agritopia.jpg", hex: "#41D98A", name: "Agritopia", stat: "spotlight Jul 8", live: true },
  { slug: "85234-core", img: "/neighborhoods/85234-core.jpg", hex: "#A855F7", name: "85234 Core", stat: "market posts", live: true },
  { slug: "heritage-district", img: "/neighborhoods/heritage-district.jpg", hex: "#26E0C8", name: "Heritage District", stat: "festival Jul 12", live: true },
  { slug: "power-ranch", img: "/neighborhoods/power-ranch.jpg", hex: "#FFC23D", name: "Power Ranch", stat: "quiet · 3 wks", live: false },
  { slug: "paradise-valley", img: "/neighborhoods/paradise-valley.jpg", hex: "#FF5D8F", name: "Paradise Valley", stat: "golf-course luxury", live: true },
];

export const NAV_DEFS = [
  { id: "command", label: "Command Center", color: "#A855F7", glyph: "◎" },
  { id: "agents", label: "Agents", color: "#7DD3FC", glyph: "✦" },
  { id: "tasks", label: "Tasks", color: "#FFC23D", glyph: "▤" },
  { id: "schedule", label: "Schedule", color: "#C084FC", glyph: "◷" },
  { id: "tools", label: "Tools", color: "#26E0C8", glyph: "⚒" },
  { id: "connectors", label: "Connectors", color: "#7DD3FC", glyph: "⧉" },
  { id: "engage", label: "Lead Pipeline", color: "#38BDF8", glyph: "⇄" },
  { id: "insights", label: "Content Analytics", color: "#41D98A", glyph: "▦" },
  { id: "content", label: "Content", color: "#FF5D8F", glyph: "✎" },
  { id: "studio", label: "Template Studio", color: "#E8622C", glyph: "◈" },
  { id: "vault", label: "Knowledge Vault", color: "#7BE495", glyph: "✸" },
  { id: "settings", label: "Settings", color: "#8B89A0", glyph: "⚙" },
] as const;

// Rail ids + a few screens kept routable off-rail (reached via QuickPanel etc.)
export type TabId = (typeof NAV_DEFS)[number]["id"] | "today" | "market" | "pipeline";

export const IMG = (seed: string, w = 400, h = 500) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;
