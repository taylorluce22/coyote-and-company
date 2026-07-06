import { NextRequest, NextResponse } from "next/server";

/**
 * Live conversation radar — Reddit.
 *
 * Reddit blocks anonymous requests from cloud/datacenter IPs (like Vercel),
 * so production needs Reddit's official OAuth app flow — free and one-time:
 *   1. reddit.com/prefs/apps → "create another app" → type: script
 *   2. Add REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars → redeploy
 * With credentials we call oauth.reddit.com (allowed from datacenters);
 * without, we try the public JSON endpoint (works locally, usually 403 on
 * cloud IPs) and tell the client which fix applies.
 *
 * GET /api/radar                → { ok, oauthConfigured }
 * GET /api/radar?q=...&subs=... → { items: RadarItem[], auth, error?, needsCreds? }
 */

const DEFAULT_SUBS = "phoenix+arizona+MovingtoPhoenix+WestValleyAZ+Scottsdale+gilbert";
const UA = "web:farmhand-localos:v1.0 (local visibility assistant)";

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

let cachedToken: { token: string; exp: number } | null = null;

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const hasCreds = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  if (!q) return NextResponse.json({ ok: true, oauthConfigured: hasCreds });

  const subs = (searchParams.get("subs") || DEFAULT_SUBS).replace(/[^a-zA-Z0-9_+]/g, "");
  const params = new URLSearchParams({ q, restrict_sr: "1", sort: "new", t: "month", limit: "12" });

  const token = await getToken();
  const url = token
    ? `https://oauth.reddit.com/r/${subs}/search?${params.toString()}`
    : `https://www.reddit.com/r/${subs}/search.json?${params.toString()}`;
  const headers: Record<string, string> = { "User-Agent": UA };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000), next: { revalidate: 300 } });
    if (!r.ok) {
      // 403 without creds = Reddit's datacenter block → tell the client the one-time fix
      return NextResponse.json({
        items: [],
        auth: token ? "oauth" : "public",
        error: `reddit ${r.status}`,
        needsCreds: !token && (r.status === 403 || r.status === 429),
      });
    }
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
    return NextResponse.json({ items, auth: token ? "oauth" : "public" });
  } catch {
    return NextResponse.json({ items: [], auth: token ? "oauth" : "public", error: "radar request failed", needsCreds: !token });
  }
}
