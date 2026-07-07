/**
 * Lead Engine — web-wide hunt types + the trainable memory that steers it.
 * The engine (Perplexity live web search, see /api/hunt) reads LeadTraining to
 * decide what to look for and how to score. Every thumbs up/down the agent
 * gives feeds back into `good` / `bad`, so it sharpens with use.
 */

export interface Lead {
  title: string;
  snippet: string;
  url: string;
  source: string;
  platform: string; // reddit | facebook | nextdoor | quora | forum | x | news | web
  intent: string; // buyer | seller | relocation | renter | investor | referral | signal
  score: number; // 0-100 strength + actionability
  why: string;
  territory: string;
  postedAgo?: string;
}

export interface LeadTraining {
  guidance: string; // "what a great lead looks like" — the agent's own words
  good: string[]; // snippets the agent gave a thumbs up (find more like these)
  bad: string[]; // snippets the agent gave a thumbs down (avoid these)
  minScore: number; // auto-capture threshold (0-100)
  intents: string[]; // which intent types to hunt for
  sinceDays: number; // recency window
  autoOn: boolean; // auto-run on open + on interval
}

export const DEFAULT_TRAINING: LeadTraining = {
  guidance: "",
  good: [],
  bad: [],
  minScore: 55,
  intents: ["relocation", "buyer", "seller", "investor"],
  sinceDays: 45,
  autoOn: true,
};

export const INTENT_OPTS: { key: string; label: string }[] = [
  { key: "relocation", label: "Relocating in" },
  { key: "buyer", label: "Buyers" },
  { key: "seller", label: "Sellers" },
  { key: "investor", label: "Investors" },
  { key: "renter", label: "Renters" },
  { key: "referral", label: "Referral asks" },
];

export const INTENT_COLOR: Record<string, string> = {
  buyer: "#41D98A",
  seller: "#FFC23D",
  relocation: "#7DD3FC",
  investor: "#C9A8FF",
  renter: "#26E0C8",
  referral: "#FF9A62",
  signal: "#8B89A0",
};

export const PLATFORM_LABEL: Record<string, string> = {
  reddit: "Reddit",
  facebook: "Facebook",
  nextdoor: "Nextdoor",
  quora: "Quora",
  forum: "Forum",
  x: "X",
  news: "News",
  web: "Web",
  biggerpockets: "BiggerPockets",
  citydata: "City-Data",
};

/** Keep the trained memory bounded — most-recent exemplars matter most. */
export function pushExemplar(list: string[], snippet: string, cap = 8): string[] {
  const s = snippet.trim().slice(0, 200);
  if (!s) return list;
  const next = [s, ...list.filter((x) => x !== s)];
  return next.slice(0, cap);
}
