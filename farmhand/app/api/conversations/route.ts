import { NextRequest, NextResponse } from "next/server";
import { getRedditToken } from "@/lib/redditHunt";

/**
 * Conversation refresh — checks engaged threads for activity SINCE the user
 * engaged. Called on demand (a refresh click) or once when the app is opened
 * — never on a polling loop, per the owner's energy/cost preference.
 *
 * v1 auto-checks Reddit threads (the dominant lead source) via the official
 * API using the same free credentials as the native hunt lane. Other
 * platforms return ok:false and the UI offers a manual "open thread" check.
 *
 * POST { items: [{ id, url, sinceMs }] }
 *   →  { results: { [id]: { ok, totalComments?, newSince?, needsCreds? } } }
 */

interface CheckItem {
  id: string;
  url: string;
  sinceMs: number;
}

const UA = "web:farmhand-localos:v2.0 (conversation tracker)";

function redditThreadId(url: string): string | null {
  const m = url.toLowerCase().match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/);
  return m ? m[1] : null;
}

function countComments(node: unknown, sinceUtc: number, acc: { total: number; newSince: number }) {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n.kind === "t1" && n.data && typeof n.data === "object") {
    const d = n.data as Record<string, unknown>;
    acc.total += 1;
    if (Number(d.created_utc || 0) > sinceUtc) acc.newSince += 1;
    const replies = d.replies;
    if (replies && typeof replies === "object") countComments(replies, sinceUtc, acc);
  }
  const data = n.data as Record<string, unknown> | undefined;
  const children = data?.children;
  if (Array.isArray(children)) children.forEach((c) => countComments(c, sinceUtc, acc));
}

export async function POST(req: NextRequest) {
  let body: { items?: CheckItem[] } = {};
  try {
    body = await req.json();
  } catch {}
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 25);
  if (!items.length) return NextResponse.json({ results: {} });

  const token = await getRedditToken();
  const results: Record<string, { ok: boolean; totalComments?: number; newSince?: number; needsCreds?: boolean }> = {};

  await Promise.all(
    items.map(async (it) => {
      const id = String(it.id || "");
      if (!id) return;
      const tid = redditThreadId(String(it.url || ""));
      if (!tid) {
        results[id] = { ok: false }; // non-reddit: manual check via "open thread"
        return;
      }
      if (!token) {
        results[id] = { ok: false, needsCreds: true };
        return;
      }
      try {
        const r = await fetch(`https://oauth.reddit.com/comments/${tid}?limit=100&depth=3&sort=new`, {
          headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) {
          results[id] = { ok: false };
          return;
        }
        const data = await r.json();
        const sinceUtc = Math.max(0, Number(it.sinceMs || 0)) / 1000;
        const acc = { total: 0, newSince: 0 };
        // data is [postListing, commentListing]
        if (Array.isArray(data) && data[1]) countComments(data[1], sinceUtc, acc);
        results[id] = { ok: true, totalComments: acc.total, newSince: acc.newSince };
      } catch {
        results[id] = { ok: false };
      }
    })
  );

  return NextResponse.json({ results });
}
