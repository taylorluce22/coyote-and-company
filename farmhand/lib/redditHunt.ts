/**
 * Native Reddit lane — the deterministic spine of the deep hunt.
 *
 * Perplexity's search index structurally under-indexes fresh individual
 * Reddit posts (it sees articles, guides, and listing pages), which is why
 * whole-web lanes kept coming back empty. Reddit's own official search API
 * has none of that problem: real posts, sorted newest-first, EXACT
 * timestamps, and an explicit archived/locked flag. No model in the loop for
 * discovery — posts are fetched, filtered, and scored by transparent rules,
 * so nothing can be hallucinated or misdated.
 *
 * Needs the free one-time Reddit script-app credentials (REDDIT_CLIENT_ID +
 * REDDIT_CLIENT_SECRET, reddit.com/prefs/apps) because Reddit blocks
 * anonymous requests from datacenter IPs. Returns needsCreds until then.
 */

import type { Lead } from "./hunt";
import { ageLabelFromDays } from "./postAge";
import { tagFor, verticalOf } from "./verticals";
import type { LaneDiag } from "./huntServer";

const UA = "web:farmhand-localos:v2.0 (lead engine, native search)";

let cachedToken: { token: string; exp: number } | null = null;

export async function getRedditToken(): Promise<string | null> {
  return getToken();
}

async function getToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token;
  try {
    const r = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.access_token) return null;
    cachedToken = { token: d.access_token, exp: Date.now() + Math.max(60, (d.expires_in || 3600) - 300) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  permalink: string;
  createdUtc: number;
  comments: number;
}

/**
 * Transparent, deterministic intent scoring — no model, no black box. The
 * owner judges final quality with thumbs; this just orders the queue.
 */
function scorePost(p: RedditPost, territories: string[], text: string): number {
  let s = 45;
  const t = text.toLowerCase();
  if (t.includes("?")) s += 10;
  if (/(recommend|anyone (know|use|used)|looking for|advice|help me|should i|worth it)/.test(t)) s += 15;
  if (/(quote|bid|proposal|per watt|estimate)/.test(t)) s += 15;
  if (territories.some((n) => t.includes(n.toLowerCase()))) s += 10;
  if (/(arizona|phoenix|\baz\b|scottsdale|mesa|gilbert|chandler|tempe|surprise|peoria|glendale)/.test(t)) s += 5;
  if (/(rant|vent|scam|hate|regret)/.test(t)) s -= 15;
  return Math.max(20, Math.min(95, s));
}

export interface RedditHuntResult {
  leads: Lead[];
  diag: LaneDiag;
  needsCreds: boolean;
}

export async function runRedditNative(
  cfg: { territories: string[]; vertical?: string },
  sinceDays: number
): Promise<RedditHuntResult> {
  const v = verticalOf(cfg.vertical);
  const diag: LaneDiag = {
    label: "reddit native",
    httpStatus: "error",
    rawParsedCount: 0,
    afterHousingFilterCount: 0,
    afterLaneKeepCount: 0,
  };

  const token = await getToken();
  if (!token) {
    diag.httpError =
      "REDDIT_CLIENT_ID/SECRET not set — this is the highest-yield lane (real fresh posts, exact ages). " +
      "Free one-time setup: reddit.com/prefs/apps → create app (type: script) → add both keys in Vercel → redeploy.";
    return { leads: [], diag, needsCreds: true };
  }

  const cutoff = Date.now() / 1000 - sinceDays * 86400;
  const seen = new Set<string>();
  const posts: RedditPost[] = [];
  let anyOk = false;

  const results = await Promise.allSettled(
    v.redditTerms.slice(0, 10).map(async (term) => {
      const params = new URLSearchParams({ q: `"${term}"`, restrict_sr: "1", sort: "new", t: "month", limit: "25" });
      const r = await fetch(`https://oauth.reddit.com/r/${v.redditSubs}/search?${params}`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error(`reddit ${r.status}`);
      const data = await r.json();
      return (data?.data?.children || []).map((c: { data: Record<string, unknown> }) => c.data);
    })
  );

  for (const res of results) {
    if (res.status !== "fulfilled") continue;
    anyOk = true;
    for (const d of res.value as Record<string, unknown>[]) {
      const id = String(d.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // deterministic disqualifiers straight from Reddit's own flags
      if (d.archived || d.locked || d.over_18) continue;
      if (String(d.author) === "[deleted]") continue;
      const selftext = String(d.selftext ?? "");
      if (selftext === "[removed]" || selftext === "[deleted]") continue;
      const createdUtc = Number(d.created_utc || 0);
      if (!createdUtc || createdUtc < cutoff) continue;
      posts.push({
        id,
        title: String(d.title ?? "").slice(0, 200),
        selftext: selftext.slice(0, 800),
        subreddit: String(d.subreddit ?? ""),
        permalink: String(d.permalink ?? ""),
        createdUtc,
        comments: Number(d.num_comments || 0),
      });
    }
  }

  diag.httpStatus = anyOk ? 200 : "error";
  if (!anyOk) {
    diag.httpError = "all reddit searches failed";
    return { leads: [], diag, needsCreds: false };
  }
  diag.citations = posts.length;
  diag.rawParsedCount = posts.length;

  const now = Date.now();
  const leads: Lead[] = [];
  for (const p of posts) {
    const full = `${p.title} ${p.selftext}`.trim();
    if (!v.isRelevant(full)) continue;
    const tags = tagFor(v, full);
    const intent = v.tagToIntent[tags[0]] || "signal";
    const ageDays = (now - p.createdUtc * 1000) / 86400000;
    leads.push({
      title: p.title,
      snippet: (p.selftext || p.title).slice(0, 400),
      url: `https://www.reddit.com${p.permalink}`,
      source: `r/${p.subreddit}`,
      platform: "reddit",
      intent,
      score: scorePost(p, cfg.territories, full),
      why: `Fresh r/${p.subreddit} post (${ageLabelFromDays(ageDays)} old, ${p.comments} comments) matching ${tags[0]}`,
      territory:
        cfg.territories.find((n) => full.toLowerCase().includes(n.toLowerCase())) || "Arizona (general)",
      postedAgo: ageLabelFromDays(ageDays),
      ageVerified: "exact", // straight from Reddit's created_utc — not a model claim
    });
  }
  diag.afterHousingFilterCount = leads.length;
  diag.afterLaneKeepCount = leads.length;
  leads.sort((a, b) => b.score - a.score);
  return { leads: leads.slice(0, 30), diag, needsCreds: false };
}
