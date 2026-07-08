/**
 * Server-side hunt engine — the shared brain behind /api/hunt (live, on open)
 * and /api/cron/hunt (the always-on scheduled job). Both call runHunt().
 * Perplexity live web search; key stays in the deployment env.
 */

import type { Lead } from "./hunt";

export interface HuntConfig {
  territories: string[];
  profession?: string;
  city?: string;
  idealClient?: string;
  intents?: string[];
  guidance?: string;
  good?: string[];
  bad?: string[];
  sinceDays?: number;
}

const PLATFORMS = new Set(["reddit", "facebook", "nextdoor", "quora", "forum", "x", "news", "web", "biggerpockets", "citydata"]);
const INTENTS = new Set(["buyer", "seller", "relocation", "renter", "investor", "referral", "signal"]);

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}

export function coerceLeads(raw: unknown): Lead[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const url = String(o.url ?? "").trim();
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

export function buildHuntPrompt(cfg: Required<Pick<HuntConfig, "territories">> & HuntConfig): string {
  const territories = cfg.territories;
  const profession = cfg.profession || "real estate agent";
  const city = cfg.city || "Arizona";
  const intents = cfg.intents?.length ? cfg.intents : ["relocation", "buyer", "seller", "investor"];
  const sinceDays = Math.max(3, Math.min(120, cfg.sinceDays || 45));
  const good = (cfg.good || []).map((g) => String(g).slice(0, 200)).slice(0, 6);
  const bad = (cfg.bad || []).map((g) => String(g).slice(0, 200)).slice(0, 6);
  const guidance = (cfg.guidance || "").slice(0, 800);

  const trainingBlock =
    (guidance ? `\n\nWHAT THIS AGENT COUNTS AS A GREAT LEAD (follow this closely):\n${guidance}` : "") +
    (good.length ? `\n\nEXAMPLES THEY MARKED AS GOOD LEADS — find more like these:\n- ${good.join("\n- ")}` : "") +
    (bad.length ? `\n\nEXAMPLES THEY MARKED AS BAD / NOT LEADS — avoid these:\n- ${bad.join("\n- ")}` : "");

  return (
    `Search the live web right now for REAL, RECENT public posts (within the last ${sinceDays} days) written by ` +
    `individual people — not businesses, not agents, not news outlets — who are showing genuine intent that a ` +
    `${profession} serving ${territories.join(", ")} (${city} area) could actually help with. ` +
    `Intent types to hunt for: ${intents.join(", ")}. ` +
    `Search broadly across the open web: Reddit, Quora, City-Data, BiggerPockets, local/community forums, X/Twitter, ` +
    `relocation and homebuying discussion boards, publicly indexed Facebook pages/posts, and local news comment ` +
    `threads. Do not favor one site — treat Reddit as only one source among many, weighted no higher than the rest. ` +
    `Each lead must be a real person asking for help, recommendations, opinions, or signaling they're about ` +
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
    `Prefer fewer, higher-confidence leads over many weak ones. Only include posts whose links you can actually cite.`
  );
}

export interface HuntResult {
  configured: boolean;
  needsCreds?: boolean;
  leads: Lead[];
  error?: string;
}

/**
 * One broad "search everywhere" prompt lets Perplexity's own ranking pick
 * winners — and Reddit wins every time because it's the most crawlable,
 * best-structured public forum content that matches this query shape. To get
 * genuine multi-platform coverage we fan out several NARROWER, domain-scoped
 * searches in parallel and merge the results — each lane can't drown the
 * others out. `domains` uses Perplexity's search_domain_filter; prefix a
 * domain with "-" to exclude it (used to force the open-web lane off Reddit).
 */
const HUNT_LANES: { label: string; domains?: string[] }[] = [
  { label: "reddit", domains: ["reddit.com"] },
  { label: "forums & investor boards", domains: ["quora.com", "city-data.com", "biggerpockets.com"] },
  { label: "X / Twitter", domains: ["x.com", "twitter.com"] },
  { label: "open web, no Reddit", domains: ["-reddit.com"] },
];

async function runLane(
  key: string,
  cfg: Required<Pick<HuntConfig, "territories">> & HuntConfig,
  lane: { label: string; domains?: string[] }
): Promise<Lead[]> {
  const prompt = buildHuntPrompt(cfg);
  const body: Record<string, unknown> = {
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
  };
  if (lane.domains?.length) body.search_domain_filter = lane.domains;

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return [];
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
    return coerceLeads(parsed);
  } catch {
    return [];
  }
}

/**
 * Run the hunt across all lanes in parallel and merge, deduped by url,
 * highest score first. Returns scored, multi-platform leads — no single
 * platform can dominate the result set.
 */
export async function runHunt(cfg: HuntConfig): Promise<HuntResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { configured: false, needsCreds: true, leads: [] };
  const territories = (cfg.territories || []).map((t) => String(t)).filter(Boolean).slice(0, 6);
  if (!territories.length) return { configured: true, leads: [] };

  const full = { ...cfg, territories };
  const settled = await Promise.allSettled(HUNT_LANES.map((lane) => runLane(key, full, lane)));
  const anyOk = settled.some((s) => s.status === "fulfilled");
  if (!anyOk) return { configured: true, leads: [], error: "hunt request failed" };

  const seen = new Set<string>();
  const merged: Lead[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const lead of s.value) {
      const key2 = lead.url.toLowerCase().replace(/[#?].*$/, "");
      if (seen.has(key2)) continue;
      seen.add(key2);
      merged.push(lead);
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return { configured: true, leads: merged.slice(0, 16) };
}
