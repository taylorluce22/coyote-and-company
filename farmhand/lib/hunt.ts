/**
 * Lead Engine — web-wide hunt types + the trainable memory that steers it.
 * The engine (Perplexity live web search, see /api/hunt) reads LeadTraining to
 * decide what to look for and how to score. Every thumbs up/down the agent
 * gives feeds back into `good` / `bad`, so it sharpens with use.
 */

import { redditEstimatedMs } from "./postAge";

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
  ageVerified?: "exact" | "page" | "estimated" | "reported" | "unverified"; // HOW postedAgo was established (see lib/postAge)
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
  guidance:
    "The highest-value lead for me is someone asking for recommendations on where to live in Arizona — " +
    "'anyone recommend a good area', 'where should I live', 'best neighborhoods/suburbs for families or " +
    "professionals', or someone moving to Arizona (from out of state or relocating within AZ) who wants advice " +
    "on where to settle. These people usually don't have an agent yet — that's what makes them valuable. " +
    "Prioritize posts like this over generic market talk, price debates, or investor chatter.",
  good: [],
  bad: [],
  minScore: 55,
  intents: ["relocation", "referral", "buyer"],
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

/**
 * Normalize a lead URL for dedup. A bare query-string strip isn't enough —
 * the same Reddit thread comes back as old.reddit.com, www.reddit.com,
 * m.reddit.com, or a trailing-slash variant depending on which search lane
 * (or which run) found it, and those all pointed at the same post without
 * deduping against each other.
 */
export function normalizeLeadUrl(url: string): string {
  let u = url.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, "");
  u = u.replace(/^(www\.|old\.|new\.|np\.|amp\.|m\.)/, "");
  u = u.replace(/[#?].*$/, "");
  u = u.replace(/\/+$/, "");
  return u;
}

/**
 * Fingerprint a lead by its title, not just its URL. The same real post can
 * come back under genuinely different URL forms across search lanes/runs
 * (a different permalink shape, a crosspost, a share-link wrapper) — a pure
 * URL dedup misses those. This catches "the same story again" even when the
 * link itself isn't byte-identical.
 */
export function leadFingerprint(l: Pick<Lead, "title" | "source">): string {
  const t = l.title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${l.source.toLowerCase().trim()}::${t}`;
}

/**
 * Deterministic backstop for the "salon/bar/nightlife counted as a lead"
 * failure mode — the prompt tells the model to exclude these, but an LLM
 * following an instruction isn't a guarantee the way a code check is. If the
 * text names a non-housing local service/activity AND has no real housing
 * signal alongside it, it's not a lead, full stop.
 */
const NON_HOUSING_SERVICE =
  /\b(salon|barber|hair ?dresser|nail salon|day ?spa|restaurant|\bbars?\b|nightlife|\bdj\b|night ?club|dentist|orthodontist|doctor|physician|mechanic|auto shop|plumber|electrician|contractor|handyman|lawyer|attorney|veterinarian|\bvet\b|therapist|tattoo|gym|yoga studio|day ?care|babysitter|hair salon)\b/i;
const HOUSING_SIGNAL =
  /\b(neighborhood|neighbourhood|\bhoa\b|school district|moving to|relocat\w*|renting|rent an? (apartment|house|home|place)|buy(ing)? a (house|home)|realtor|real estate|housing market|where (should|to) (i|we) live|subdivision|down ?payment|closing costs|listing agent|open house)\b/i;

export function isLikelyHousingLead(text: string): boolean {
  const t = text.toLowerCase();
  if (NON_HOUSING_SERVICE.test(t) && !HOUSING_SIGNAL.test(t)) return false;
  return true;
}

/**
 * Parse a "postedAgo" string ("15m", "3h", "2d", "3w", "6mo", "4y", "2021",
 * "Jul 2") into approximate days. Returns null when unparseable.
 */
export function postAgeDays(postedAgo: string | undefined | null): number | null {
  if (!postedAgo) return null;
  const s = postedAgo.trim().toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(minute|min|m\b|hour|hr|h\b|day|d\b|week|wk|w\b|month|mo\b|year|yr|y\b)/);
  if (m) {
    const n = parseFloat(m[1]);
    const u = m[2][0] === "m" && m[2].startsWith("mo") ? "mo" : m[2][0];
    if (u === "m" && !m[2].startsWith("mo")) return n / (24 * 60); // minutes
    if (u === "h") return n / 24;
    if (u === "d") return n;
    if (u === "w") return n * 7;
    if (u === "mo") return n * 30;
    if (u === "y") return n * 365;
  }
  // a bare year like "2021" — treat as very old if it's not the current era
  const y = s.match(/^(20\d\d)$/);
  if (y) return 365; // any bare-year answer is at minimum months old
  return null;
}

/**
 * Deterministic staleness check for Reddit links — no API needed. Reddit post
 * IDs are sequential base36; 6-character IDs ran out in early 2023, so any
 * /comments/<id>/ with an ID of 6 chars or fewer is YEARS old — and Reddit
 * archives posts after 6 months, so it can't even be replied to. This is the
 * exact failure that surfaced live: a 4-year-old archived thread presented as
 * a fresh lead.
 */
export function isAncientRedditUrl(url: string): boolean {
  const m = url.toLowerCase().match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/);
  if (!m) return false;
  return m[1].length <= 6;
}

/** Combined recency gate: too old by its own reported age, or provably ancient by URL. */
export function isTooOld(lead: Pick<Lead, "url" | "postedAgo">, sinceDays: number): boolean {
  if (isAncientRedditUrl(lead.url)) return true;
  const age = postAgeDays(lead.postedAgo);
  // allow 2x slack on the reported age — "recent-ish" beats losing real leads
  // to fuzzy model dating; provably-ancient is handled by the URL check above
  if (age != null && age > sinceDays * 2) return true;
  return false;
}

/**
 * Inbox hygiene: the recency/age gates filter NEW captures, but the inbox is
 * a persisted list — anything captured before those gates shipped stays
 * displayed until manually skipped. This decides whether an already-stored
 * engine capture is provably stale and should be auto-purged on load.
 * Deliberately conservative: only engine-captured items (extKey "web:"), only
 * untouched ones (never anything the user engaged with or is watching), and
 * only when staleness is provable (ancient Reddit URL, or an age the engine
 * itself recorded as ~8 months+).
 */
export function isProvablyStaleLead(o: { url?: string; postedAgo?: string; extKey?: string; status?: string }): boolean {
  if (!o.extKey || !o.extKey.startsWith("web:")) return false;
  if (o.status === "engaged" || o.status === "watching") return false;
  if (o.url && isAncientRedditUrl(o.url)) return true;
  // era-estimate ANY reddit URL from its sequential ID (offline, no network) —
  // catches 2023+ posts that are past Reddit's ~6-month archive line, which
  // the coarse 6-char check above can't see
  if (o.url) {
    const est = redditEstimatedMs(o.url);
    if (est != null && (Date.now() - est) / 86_400_000 > 240) return true;
  }
  const age = postAgeDays(o.postedAgo);
  if (age != null && age > 240) return true;
  return false;
}
