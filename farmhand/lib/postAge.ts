/**
 * Post-age VERIFICATION — establishing how old a lead's source post actually
 * is, instead of trusting the search model's reported age. Three mechanisms,
 * strongest first:
 *
 * 1. X/Twitter: EXACT. Status IDs are Snowflakes — the top bits are a
 *    millisecond timestamp. Decoded offline, no network, no trust.
 * 2. Web pages (Quora, City-Data, forums, news, blogs): fetch the page
 *    server-side and parse its machine-readable publish date (JSON-LD
 *    datePublished, article:published_time, <time datetime>).
 * 3. Reddit: ESTIMATED. Post IDs are sequential base36 — anchor points map ID
 *    ranges to eras. Too coarse to verify "3 days old", but decisive for the
 *    failure that matters: Reddit archives posts after ~6 months, so anything
 *    estimated older than 8 months is rejected outright. (Reddit blocks
 *    datacenter IPs from its JSON API, so exact lookup isn't possible
 *    without OAuth creds.)
 */

export type AgeSource = "exact" | "page" | "estimated" | "reported" | "unverified";

export interface AgeCheck {
  keep: boolean;
  ageDays?: number;
  source: AgeSource;
}

/* ------------------------------- X / Twitter ------------------------------- */

const TWITTER_EPOCH_MS = 1288834974657n;

/** Exact post time from a tweet's Snowflake ID. Null if not an X status URL. */
export function xStatusAgeMs(url: string, nowMs: number): number | null {
  const m = url.match(/(?:^|\.)(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{10,20})/i) || url.match(/\/\/(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{10,20})/i);
  if (!m) return null;
  try {
    const ts = Number((BigInt(m[1]) >> 22n) + TWITTER_EPOCH_MS);
    if (!Number.isFinite(ts) || ts < 1288834974657 || ts > nowMs + 86400000) return null;
    return nowMs - ts;
  } catch {
    return null;
  }
}

/* --------------------------------- Reddit ---------------------------------- */

/**
 * Era anchors: (base36 t3 post-id, approximate epoch ms). Sequential IDs make
 * interpolation sound; anchors are approximate (±weeks), which is why the
 * result is only used with a wide 8-month reject threshold — far coarser than
 * the anchor error.
 */
const REDDIT_ANCHORS: [string, number][] = [
  ["zzzzzz", Date.UTC(2022, 11, 15)], // 6-char IDs exhausted ~Dec 2022; everything after is 7 chars
  ["12s0000", Date.UTC(2023, 3, 1)],
  ["15m0000", Date.UTC(2023, 6, 15)],
  ["18m0000", Date.UTC(2023, 11, 1)],
  ["1bm0000", Date.UTC(2024, 3, 1)],
  ["1em0000", Date.UTC(2024, 8, 1)],
  ["1hm0000", Date.UTC(2025, 0, 15)],
  ["1lm0000", Date.UTC(2025, 6, 1)],
  ["1pm0000", Date.UTC(2026, 0, 1)],
].map(([id, ms]) => [id as string, ms as number]);

/** Approximate post time for a reddit /comments/<id> URL. Null if not reddit. */
export function redditEstimatedMs(url: string): number | null {
  const m = url.toLowerCase().match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/);
  if (!m) return null;
  const v = parseInt(m[1], 36);
  if (!Number.isFinite(v)) return null;
  const pts = REDDIT_ANCHORS.map(([id, ms]) => [parseInt(id, 36), ms] as [number, number]);
  if (v <= pts[0][0]) {
    // pre-2023 (6-char era). ID growth was wildly non-linear back then, so no
    // interpolation — a flat "old" date is all the reject gate needs.
    return Date.UTC(2020, 0, 1);
  }
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [v0, t0] = pts[i - 1];
      const [v1, t1] = pts[i];
      return t0 + ((v - v0) / (v1 - v0)) * (t1 - t0);
    }
  }
  // beyond the last anchor — extrapolate at the last segment's rate
  const [v0, t0] = pts[pts.length - 2];
  const [v1, t1] = pts[pts.length - 1];
  return t1 + ((v - v1) / (v1 - v0)) * (t1 - t0);
}

/* ------------------------------- Web pages --------------------------------- */

const DATE_PATTERNS: RegExp[] = [
  /"datePublished"\s*:\s*"([^"]{8,40})"/i,
  /"dateCreated"\s*:\s*"([^"]{8,40})"/i,
  /property=["']article:published_time["'][^>]*content=["']([^"']{8,40})["']/i,
  /content=["']([^"']{8,40})["'][^>]*property=["']article:published_time["']/i,
  /<time[^>]+datetime=["']([^"']{8,40})["']/i,
];

/**
 * Fetch a page and parse its machine-readable publish date. Skips hosts that
 * block datacenter fetches (reddit, x, facebook). Returns epoch ms or null.
 */
export async function fetchPublishedMs(url: string): Promise<number | null> {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/reddit\.com|twitter\.com|(^|\.)x\.com|facebook\.com|instagram\.com/.test(host)) return null;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FarmhandLeadVerify/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(4500),
      redirect: "follow",
    });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 300_000);
    for (const re of DATE_PATTERNS) {
      const m = html.match(re);
      if (m) {
        const t = Date.parse(m[1]);
        if (Number.isFinite(t) && t > Date.UTC(2000, 0, 1)) return t;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------ Combined check ----------------------------- */

const DAY_MS = 86_400_000;
const REDDIT_ARCHIVE_REJECT_DAYS = 240; // archived at ~180d; anchors are ±weeks, so reject with margin

/** Render an age in days as a compact label ("3d", "5w", "2mo"). */
export function ageLabelFromDays(days: number): string {
  if (days < 1) return "today";
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/**
 * Verify one lead's age as strongly as its platform allows.
 * `reportedAgeDays` is the parsed model claim (null when absent/unparseable).
 */
export async function verifyAge(
  url: string,
  reportedAgeDays: number | null,
  sinceDays: number,
  nowMs: number
): Promise<AgeCheck> {
  // exact: X snowflake
  const xAge = xStatusAgeMs(url, nowMs);
  if (xAge != null) {
    const days = xAge / DAY_MS;
    return { keep: days <= sinceDays * 2, ageDays: days, source: "exact" };
  }
  // estimated: reddit id interpolation — reject archived-era with margin
  const rMs = redditEstimatedMs(url);
  if (rMs != null) {
    const days = (nowMs - rMs) / DAY_MS;
    if (days > REDDIT_ARCHIVE_REJECT_DAYS) return { keep: false, ageDays: days, source: "estimated" };
    // within the estimate's error bars of "recent": trust the reported age for
    // display, but the estimate stands as the actionability gate
    return { keep: true, ageDays: reportedAgeDays ?? days, source: reportedAgeDays != null ? "reported" : "estimated" };
  }
  // page date: everything else that allows server fetches
  const pMs = await fetchPublishedMs(url);
  if (pMs != null) {
    const days = (nowMs - pMs) / DAY_MS;
    return { keep: days <= sinceDays * 2, ageDays: days, source: "page" };
  }
  // no verification possible — fall back to the model's claim (already gated
  // upstream by isTooOld) and say so honestly
  if (reportedAgeDays != null) return { keep: reportedAgeDays <= sinceDays * 2, ageDays: reportedAgeDays, source: "reported" };
  return { keep: true, source: "unverified" };
}
