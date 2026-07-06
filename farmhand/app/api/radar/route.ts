import { NextRequest, NextResponse } from "next/server";

/**
 * Live conversation radar — Reddit.
 * Reddit is the one major platform with legitimately readable public data;
 * Facebook Groups and Nextdoor have no third-party read APIs (and scraping
 * them risks the agent's own account), so those stay capture-based.
 *
 * GET /api/radar?q=Buckeye&subs=phoenix+arizona+MovingtoPhoenix
 *   → { items: [{ id, title, text, subreddit, author, url, ageMins, comments }] }
 */

const DEFAULT_SUBS = "phoenix+arizona+MovingtoPhoenix+WestValleyAZ+Scottsdale+gilbert";

interface RadarItem {
  id: string;
  title: string;
  text: string;
  subreddit: string;
  author: string;
  url: string;
  ageMins: number;
  comments: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ ok: true });

  const subs = (searchParams.get("subs") || DEFAULT_SUBS).replace(/[^a-zA-Z0-9_+]/g, "");
  const url =
    `https://www.reddit.com/r/${subs}/search.json?` +
    new URLSearchParams({ q, restrict_sr: "1", sort: "new", t: "month", limit: "12" }).toString();

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "farmhand-localos/1.0 (local visibility assistant)" },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 300 }, // cache 5 min per query
    });
    if (!r.ok) return NextResponse.json({ items: [], error: `reddit ${r.status}` });
    const data = await r.json();
    const now = Date.now() / 1000;
    const items: RadarItem[] = (data?.data?.children || [])
      .map((c: { data: Record<string, unknown> }) => c.data)
      .filter((d: Record<string, unknown>) => d && !d.over_18)
      .map((d: Record<string, unknown>) => ({
        id: String(d.id),
        title: String(d.title ?? "").slice(0, 220),
        text: String(d.selftext ?? "").slice(0, 400),
        subreddit: String(d.subreddit ?? ""),
        author: String(d.author ?? ""),
        url: `https://www.reddit.com${String(d.permalink ?? "")}`,
        ageMins: Math.max(1, Math.round((now - Number(d.created_utc || now)) / 60)),
        comments: Number(d.num_comments || 0),
      }))
      .slice(0, 10);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: "radar request failed" });
  }
}
