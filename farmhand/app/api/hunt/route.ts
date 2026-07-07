import { NextRequest, NextResponse } from "next/server";

/**
 * Web-wide lead hunt — searches the ENTIRE live web (not one platform) for
 * real people showing buying / selling / relocation / investing intent in the
 * agent's territories, then returns them scored and ready for the inbox.
 *
 * Engine = Perplexity's online model (live web search + citations). The key
 * lives ONLY in the deployment env (PERPLEXITY_API_KEY on Vercel) — never the
 * client. Same proxy pattern as /api/discover and /api/stock.
 *
 * The engine is TRAINABLE: the client passes `guidance` (what a great lead
 * looks like, in the agent's words) plus `good` / `bad` exemplars from the
 * agent's thumbs up/down. Those steer both what we search for and how we score.
 *
 * GET  /api/hunt                     → { configured: boolean }
 * POST /api/hunt  { territories, profession, city, idealClient, intents,
 *                   guidance, good[], bad[], sinceDays }
 *                                    → { configured, leads: Lead[] }
 */

interface Lead {
  title: string;
  snippet: string;
  url: string;
  source: string; // human site/community name, e.g. "r/phoenix", "City-Data forum", "Facebook"
  platform: string; // reddit | facebook | nextdoor | quora | forum | x | news | web
  intent: string; // buyer | seller | relocation | renter | investor | referral | signal
  score: number; // 0-100 — strength + actionability of the intent
  why: string; // one line: why this is a lead worth a human touch
  territory: string;
  postedAgo?: string; // "3d", "2w" if the model can tell
}

const PLATFORMS = new Set(["reddit", "facebook", "nextdoor", "quora", "forum", "x", "news", "web", "biggerpockets", "citydata"]);
const INTENTS = new Set(["buyer", "seller", "relocation", "renter", "investor", "referral", "signal"]);

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}

function coerce(raw: unknown): Lead[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const url = String(o.url ?? "").trim();
    // must be a real, reachable-looking link — no lead without a source to open
    if (!/^https?:\/\/.+\..+/i.test(url)) continue;
    const key = url.toLowerCase().replace(/[#?].*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const platform = String(o.platform ?? "web").toLowerCase();
    const intent = String(o.intent ?? "signal").toLowerCase();
    out.push({
      title: String(o.title ?? "").slice(0, 160),
      snippet: String(o.snippet ?? o.summary ?? "").slice(0, 500),
      url: url.slice(0, 600),
      source: String(o.source ?? o.community ?? "web").slice(0, 80),
      platform: PLATFORMS.has(platform) ? platform : "web",
      intent: INTENTS.has(intent) ? intent : "signal",
      score: clampScore(o.score),
      why: String(o.why ?? o.reason ?? "").slice(0, 240),
      territory: String(o.territory ?? "").slice(0, 80),
      postedAgo: o.postedAgo ? String(o.postedAgo).slice(0, 12) : undefined,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

export async function GET() {
  return NextResponse.json({ configured: !!process.env.PERPLEXITY_API_KEY });
}

export async function POST(req: NextRequest) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return NextResponse.json({ configured: false, leads: [], needsCreds: true });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {}

  const territories = Array.isArray(body.territories)
    ? (body.territories as unknown[]).map((t) => String(t)).filter(Boolean).slice(0, 6)
    : [];
  if (!territories.length) return NextResponse.json({ configured: true, leads: [] });

  const profession = String(body.profession || "real estate agent").slice(0, 80);
  const city = String(body.city || "Arizona").slice(0, 80);
  const idealClient = String(body.idealClient || "both").slice(0, 40);
  const intents = Array.isArray(body.intents) && body.intents.length
    ? (body.intents as unknown[]).map((i) => String(i)).slice(0, 6)
    : ["relocation", "buyer", "seller", "investor"];
  const sinceDays = Math.max(3, Math.min(120, Number(body.sinceDays) || 45));
  const guidance = String(body.guidance || "").slice(0, 800);
  const good = Array.isArray(body.good) ? (body.good as unknown[]).map((g) => String(g).slice(0, 200)).slice(0, 6) : [];
  const bad = Array.isArray(body.bad) ? (body.bad as unknown[]).map((g) => String(g).slice(0, 200)).slice(0, 6) : [];

  const trainingBlock =
    (guidance ? `\n\nWHAT THIS AGENT COUNTS AS A GREAT LEAD (follow this closely):\n${guidance}` : "") +
    (good.length ? `\n\nEXAMPLES THEY MARKED AS GOOD LEADS — find more like these:\n- ${good.join("\n- ")}` : "") +
    (bad.length ? `\n\nEXAMPLES THEY MARKED AS BAD / NOT LEADS — avoid these:\n- ${bad.join("\n- ")}` : "");

  const prompt =
    `Search the live web right now for REAL, RECENT public posts (within the last ${sinceDays} days) written by ` +
    `individual people — not businesses, not agents, not news outlets — who are showing genuine intent that a ` +
    `${profession} serving ${territories.join(", ")} (${city} area) could actually help with. ` +
    `Intent types to hunt for: ${intents.join(", ")}. ` +
    `Search EVERYWHERE, not one site: Reddit, Quora, City-Data, BiggerPockets, local/community forums, public ` +
    `Facebook posts and groups, Nextdoor, X/Twitter, relocation and homebuying discussion boards, local news comment ` +
    `threads. Each lead must be a real person asking for help, recommendations, opinions, or signaling they're about ` +
    `to move, buy, sell, rent, or invest in or near these areas. ` +
    `Return ONLY genuinely actionable threads where a helpful local professional replying would add value — skip ` +
    `spam, ragebait, pure venting, old/closed threads, agent self-promo, and listing/ad pages.` +
    trainingBlock +
    `\n\nRespond with ONLY a JSON array (no prose, no markdown fences). Each element: ` +
    `{"title": "the post's title or first line", ` +
    `"snippet": "1-2 sentences quoting or summarizing what the person actually said/asked", ` +
    `"url": "the exact direct link to that specific post/thread (required, must resolve)", ` +
    `"source": "the community or site name, e.g. r/phoenix or City-Data", ` +
    `"platform": "reddit|facebook|nextdoor|quora|forum|x|news|web", ` +
    `"intent": "buyer|seller|relocation|renter|investor|referral|signal", ` +
    `"territory": "which of [${territories.join(", ")}] it relates to (closest match)", ` +
    `"score": 0-100 how strong AND actionable the intent is (90+=explicitly ready & asking; 40=vague signal), ` +
    `"why": "one line on why it's worth a human reaching out", ` +
    `"postedAgo": "how long ago, e.g. 3d or 2w"}. ` +
    `Prefer fewer, higher-confidence leads over many weak ones. Only include posts whose links you can actually cite.`;

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a precise lead-research engine for local sales professionals. You search the live web and " +
              "return ONLY real, verifiable, recent posts by real individuals with genuine intent. Output ONLY valid " +
              "JSON. Never invent posts or links. Never return listing pages, ads, or news articles as leads. " +
              "Never characterize neighborhoods by the people who live there.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return NextResponse.json({ configured: true, leads: [], error: `hunt upstream ${r.status}` });
    const data = await r.json();
    let text: string = data?.choices?.[0]?.message?.content ?? "[]";
    text = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    let parsed: unknown = [];
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = [];
    }
    return NextResponse.json({ configured: true, leads: coerce(parsed) });
  } catch {
    return NextResponse.json({ configured: true, leads: [], error: "hunt request failed" });
  }
}
