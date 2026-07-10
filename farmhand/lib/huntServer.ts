/**
 * Server-side hunt engine — the shared brain behind /api/hunt (live, on open)
 * and /api/cron/hunt (the always-on scheduled job). Both call runHunt().
 * Perplexity live web search; key stays in the deployment env.
 */

import { isLikelyHousingLead, leadFingerprint, normalizeLeadUrl, type Lead } from "./hunt";

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
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: Lead[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const url = String(o.url ?? "").trim();
    if (!/^https?:\/\/.+\..+/i.test(url)) continue;
    const urlKey = normalizeLeadUrl(url);
    if (seenUrl.has(urlKey)) continue;
    const platform = String(o.platform ?? "web").toLowerCase();
    const intent = String(o.intent ?? "signal").toLowerCase();
    const title = String(o.title ?? "").slice(0, 160);
    const snippet = String(o.snippet ?? o.summary ?? "").slice(0, 500);
    const source = String(o.source ?? o.community ?? "web").slice(0, 80);
    // deterministic backstop: "recommend a salon/bar/mechanic" is never a
    // lead, no matter how well the model scored it — don't trust the prompt
    // instruction alone to keep these out.
    if (!isLikelyHousingLead(`${title} ${snippet}`)) continue;
    const titleKey = leadFingerprint({ title, source });
    if (seenTitle.has(titleKey)) continue;
    seenUrl.add(urlKey);
    seenTitle.add(titleKey);
    out.push({
      title,
      snippet,
      url: url.slice(0, 600),
      source,
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

  const state = "Arizona";

  // literal, concrete search phrases per territory — anchors the model's actual
  // web queries instead of leaving it to interpret a bare place name, which
  // just surfaces every mention of that name (the mall, other states'
  // "Paradise Valley"s, tangential chatter) instead of moving/relocation intent
  const territoryQueries = territories
    .map(
      (name) =>
        `${name}: "moving to ${name}", "relocating to ${name}", "just moved to ${name}", "new to ${name}", ` +
        `"recommend a neighborhood near ${name}", "where should I live near ${name}"`
    )
    .join("\n");
  const stateQueries =
    `${state} (broad, no neighborhood named yet): "moving to Arizona", "relocating to Arizona", "moving to ` +
    `Phoenix", "where should I live in Arizona", "anyone recommend a good area in Arizona/the Valley", "thinking ` +
    `about moving to AZ"`;

  const primaryFocus =
    `\n\nPRIMARY TARGET (weight this highest): people asking for MOVING RECOMMENDATIONS and WHERE TO LIVE in ` +
    `${state}. Run searches using these literal phrases (and close variants — different tense, "we" vs "I", etc.), ` +
    `not just the bare place name — a bare name like "${territories[0]}" alone surfaces noise (the mall, same-name ` +
    `places in other states, unrelated chatter), not moving intent:\n${territoryQueries}\n${stateQueries}\n` +
    `State-level hits do NOT need to name a specific neighborhood — someone new to the state usually doesn't know ` +
    `neighborhood names yet, and that "undecided, doesn't have an agent yet" moment is exactly the highest-value ` +
    `lead. Count these as strong matches even without a named territory. Secondary: posts naming the specific ` +
    `territories directly with buy/sell/rent/invest intent.`;

  const hardExclude =
    `\n\nHARD EXCLUDE — these are NEVER leads, no matter how well-written or how confident you are, and must score ` +
    `under 20 or be dropped entirely: requests for a specific LOCAL BUSINESS OR SERVICE recommendation that has ` +
    `nothing to do with housing — a salon, barber, restaurant, bar, dentist, doctor, mechanic, contractor, ` +
    `plumber, lawyer, event/nightlife suggestion, "anyone know a good [X] near me", or any other everyday-life ` +
    `recommendation ask. The word "recommend" alone does NOT make something a lead — it must specifically be about ` +
    `a NEIGHBORHOOD, AREA, SUBURB, or WHERE TO LIVE (buy/rent/relocate), not about a business, product, or ` +
    `activity. If you are not confident the post is about housing or relocation specifically, do not include it.`;

  return (
    `Search the live web right now for REAL, RECENT public posts (within the last ${sinceDays} days) written by ` +
    `individual people — not businesses, not agents, not news outlets — who are showing genuine intent that a ` +
    `${profession} serving ${territories.join(", ")} (${city} area, ${state}) could actually help with. ` +
    `Intent types to hunt for: ${intents.join(", ")}.` +
    primaryFocus +
    hardExclude +
    `\n\nEach lead must be a real person asking for help, recommendations, opinions, or signaling they're about ` +
    `to move, buy, sell, rent, or invest in housing in or near ${state} — specifically about a place to live, not ` +
    `a service or business. ` +
    `Return ONLY genuinely actionable threads where a helpful local real estate professional replying would add ` +
    `value — skip spam, ragebait, pure venting, old/closed threads, agent self-promo, and listing/ad pages.` +
    trainingBlock +
    `\n\nRespond with ONLY a JSON array (no prose, no markdown fences). Each element: ` +
    `{"title": "the post's title or first line", ` +
    `"snippet": "1-2 sentences quoting or summarizing what the person actually said/asked", ` +
    `"url": "the exact direct link to that specific post/thread (required, must resolve)", ` +
    `"source": "the community or site name, e.g. r/phoenix or City-Data", ` +
    `"platform": "reddit|facebook|nextdoor|quora|forum|x|news|web", ` +
    `"intent": "buyer|seller|relocation|renter|investor|referral|signal", ` +
    `"territory": "which of [${territories.join(", ")}] it relates to (closest match), or '${state}' if the post ` +
    `is a general moving/where-to-live question that doesn't name a specific one of those areas yet", ` +
    `"score": 0-100 how strong AND actionable the intent is (90+=explicitly ready & asking; 40=vague signal — a ` +
    `general "moving to ${state}, where should I live" post scores HIGH, 70+, even without a named neighborhood), ` +
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
 * genuine multi-platform coverage we fan out several NARROWER searches in
 * parallel. Two layers of enforcement, because relying on either alone isn't
 * reliable:
 *   1. `focus` — plain-language instruction telling the model which
 *      platform(s) to search and, for non-Reddit lanes, explicitly telling it
 *      NOT to return Reddit (Reddit is covered by its own lane already).
 *   2. `keep` — a deterministic code-level filter applied AFTER the response
 *      comes back, so a lane's results are guaranteed to match its platform
 *      even if the model ignores the instruction or search_domain_filter is
 *      silently a no-op on this model tier.
 * `search_domain_filter` is still sent as a best-effort hint on top of both.
 * `keep` matches on the parsed HOSTNAME, not a raw substring — a substring
 * check on the URL would false-positive ("netflix.com" contains "x.com").
 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
function hostIsOneOf(url: string, domains: string[]): boolean {
  const host = hostOf(url);
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

const HUNT_LANES: {
  label: string;
  focus: string;
  domains?: string[];
  keep: (url: string) => boolean;
}[] = [
  {
    label: "reddit",
    focus: "For this search, look specifically on Reddit (reddit.com) — subreddit threads and comments.",
    domains: ["reddit.com"],
    keep: (u) => hostIsOneOf(u, ["reddit.com"]),
  },
  {
    label: "forums & investor boards",
    focus:
      "For this search, look specifically on Quora, City-Data forums, and BiggerPockets — NOT Reddit. Reddit is " +
      "covered by a separate search already; do not return any reddit.com links here.",
    domains: ["quora.com", "city-data.com", "biggerpockets.com"],
    keep: (u) => hostIsOneOf(u, ["quora.com", "city-data.com", "biggerpockets.com"]),
  },
  {
    label: "X / Twitter",
    focus:
      "For this search, look specifically on X (Twitter) — x.com or twitter.com posts and threads — NOT Reddit. " +
      "Reddit is covered by a separate search already; do not return any reddit.com links here.",
    domains: ["x.com", "twitter.com"],
    keep: (u) => hostIsOneOf(u, ["x.com", "twitter.com"]),
  },
  {
    label: "open web, no Reddit",
    focus:
      "For this search, look across the broader open web — local news sites, community blogs, relocation " +
      "boards, publicly indexed Facebook pages, local government/chamber-of-commerce sites — NOT Reddit. Reddit " +
      "is covered by a separate search already; do not return any reddit.com links here.",
    domains: ["-reddit.com"],
    keep: (u) => !hostIsOneOf(u, ["reddit.com"]),
  },
];

async function runLane(
  key: string,
  cfg: Required<Pick<HuntConfig, "territories">> & HuntConfig,
  lane: (typeof HUNT_LANES)[number]
): Promise<Lead[]> {
  const prompt = `${buildHuntPrompt(cfg)}\n\nSEARCH FOCUS FOR THIS PASS: ${lane.focus}`;
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
    // deterministic enforcement — don't trust the model or the API param alone
    return coerceLeads(parsed).filter((l) => lane.keep(l.url.toLowerCase()));
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

  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const merged: Lead[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const lead of s.value) {
      const urlKey = normalizeLeadUrl(lead.url);
      const titleKey = leadFingerprint(lead);
      if (seenUrl.has(urlKey) || seenTitle.has(titleKey)) continue;
      seenUrl.add(urlKey);
      seenTitle.add(titleKey);
      merged.push(lead);
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return { configured: true, leads: merged.slice(0, 16) };
}
