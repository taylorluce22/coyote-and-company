/**
 * Server-side hunt engine — the shared brain behind /api/hunt (live, on open)
 * and /api/cron/hunt (the always-on scheduled job). Both call runHunt().
 * Perplexity live web search; key stays in the deployment env.
 */

import { isTooOld, leadFingerprint, normalizeLeadUrl, postAgeDays, type Lead } from "./hunt";
import { ageLabelFromDays, verifyAge } from "./postAge";
import { runRedditNative } from "./redditHunt";
import { verticalOf, type VerticalDef } from "./verticals";

export interface HuntConfig {
  territories: string[];
  vertical?: string; // "realtor" (default) | "solar" — selects intent language, search phrases, relevance filter
  deep?: boolean; // deep mode: fan out the vertical's literal query matrix instead of the 6 broad lanes
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

export function coerceLeads(raw: unknown, vertical?: VerticalDef, sinceDays = 45): Lead[] {
  if (!Array.isArray(raw)) return [];
  const v = vertical || verticalOf("realtor");
  const validIntents = new Set([...INTENTS, ...v.intents.map((i) => i.key)]);
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
    // deterministic backstop per vertical — an off-topic post is never a
    // lead no matter how well the model scored it; don't trust the prompt
    // instruction alone to keep these out.
    if (!v.isRelevant(`${title} ${snippet}`)) continue;
    const postedAgo = o.postedAgo ? String(o.postedAgo).slice(0, 12) : undefined;
    // recency gate: a years-old (or archived — Reddit locks after 6 months)
    // thread is unactionable no matter how on-topic it reads. The Reddit URL
    // check is deterministic; the reported-age check gets 2x slack.
    if (isTooOld({ url, postedAgo }, sinceDays)) continue;
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
      intent: validIntents.has(intent) ? intent : "signal",
      score: clampScore(o.score),
      why: String(o.why ?? o.reason ?? "").slice(0, 240),
      territory: String(o.territory ?? "").slice(0, 80),
      postedAgo,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 15);
}

export function buildHuntPrompt(cfg: Required<Pick<HuntConfig, "territories">> & HuntConfig): string {
  const v = verticalOf(cfg.vertical);
  const territories = cfg.territories;
  const profession = cfg.profession || v.profession;
  const city = cfg.city || "Arizona";
  const intents = cfg.intents?.length ? cfg.intents : v.defaultIntents;
  const intentEnum = [...v.intents.map((i) => i.key), "signal"].join("|");
  const sinceDays = Math.max(3, Math.min(120, cfg.sinceDays || 45));
  const good = (cfg.good || []).map((g) => String(g).slice(0, 200)).slice(0, 6);
  const bad = (cfg.bad || []).map((g) => String(g).slice(0, 200)).slice(0, 6);
  const guidance = (cfg.guidance || "").slice(0, 800);

  const trainingBlock =
    (guidance ? `\n\nWHAT THIS USER COUNTS AS A GREAT LEAD (follow this closely):\n${guidance}` : "") +
    (good.length ? `\n\nEXAMPLES THEY MARKED AS GOOD LEADS — find more like these:\n- ${good.join("\n- ")}` : "") +
    (bad.length ? `\n\nEXAMPLES THEY MARKED AS BAD / NOT LEADS — avoid these:\n- ${bad.join("\n- ")}` : "");

  const state = "Arizona";

  // literal, concrete search phrases per territory — anchors the model's actual
  // web queries instead of leaving it to interpret a bare place name
  const territoryQueries = territories.map((name) => v.territoryPhrases(name)).join("\n");

  const primaryFocus =
    `\n\nPRIMARY TARGET (weight this highest): ${v.primaryTarget}\n` +
    `Run searches using these literal phrases (and close variants — different tense, "we" vs "I", etc.), not ` +
    `just bare place names:\n${territoryQueries}\n${v.statePhrases}`;

  const hardExclude =
    `\n\nHARD EXCLUDE — these are NEVER leads, no matter how well-written or how confident you are, and must score ` +
    `under 20 or be dropped entirely: ${v.hardExclude} If you are not confident the post genuinely fits the ` +
    `primary target above, do not include it.`;

  return (
    `Search the live web right now for REAL, RECENT public posts (within the last ${sinceDays} days) written by ` +
    `individual people — not businesses, not industry professionals, not news outlets — who are showing genuine ` +
    `intent that a ${profession} serving ${territories.join(", ")} (${city} area, ${state}) could actually help ` +
    `with. Intent types to hunt for: ${intents.join(", ")}.` +
    primaryFocus +
    hardExclude +
    `\n\nEach lead must be a real person asking for help, recommendations, or opinions, or signaling genuine ` +
    `intent a ${profession} can act on. ` +
    `Return ONLY genuinely actionable threads where a helpful local professional replying would add value — ` +
    `skip spam, ragebait, pure venting, old/closed threads, self-promo by other professionals, and listing/ad pages.` +
    trainingBlock +
    `\n\nRespond with ONLY a JSON array (no prose, no markdown fences). Each element: ` +
    `{"title": "the post's title or first line", ` +
    `"snippet": "1-2 sentences quoting or summarizing what the person actually said/asked", ` +
    `"url": "the exact direct link to that specific post/thread (required, must resolve)", ` +
    `"source": "the community or site name, e.g. r/phoenix or City-Data", ` +
    `"platform": "reddit|facebook|nextdoor|quora|forum|x|news|web", ` +
    `"intent": "${intentEnum}", ` +
    `"territory": "which of [${territories.join(", ")}] it relates to (closest match), or '${state}' if the post ` +
    `is a broader ${state}-level ask that doesn't name a specific one of those areas", ` +
    `"score": 0-100 how strong AND actionable the intent is (90+=explicitly ready & asking; 40=vague signal — a ` +
    `broad state-level ask that fits the primary target scores HIGH, 70+, even without a named territory), ` +
    `"why": "one line on why it's worth a human reaching out", ` +
    `"postedAgo": "REQUIRED — how long ago the post was actually made, e.g. 3d or 2w. Verify the real post date; ` +
    `if you cannot confirm it is within the last ${sinceDays} days, EXCLUDE the post entirely"}. ` +
    `RECENCY IS A HARD REQUIREMENT: an old thread is worthless — the person has already decided, and Reddit ` +
    `archives posts after 6 months so they cannot even be replied to. Never include archived or locked threads. ` +
    `Return up to 12 candidates. Include moderate-confidence leads (score them honestly, 40-60) rather than ` +
    `omitting them — a quality threshold downstream decides what surfaces, so under-reporting loses real leads ` +
    `while honest scoring costs nothing. Only include posts whose links you can actually cite.`
  );
}

export interface LaneDiag {
  label: string;
  httpStatus: number | "error";
  httpError?: string; // truncated response body when httpStatus is not ok
  rawParsedCount: number; // how many items the model returned, before any filtering
  afterHousingFilterCount: number; // after the vertical relevance filter + coerceLeads' own dedup
  afterLaneKeepCount: number; // after the deterministic platform/domain filter
  parseFailed?: boolean; // model responded 200 but output wasn't a parseable JSON array
  rawSample?: string; // first chars of the model's actual reply — captured whenever the lane yields nothing, so an empty [] vs a refusal vs prose is visible
  citations?: number; // how many web sources Perplexity's search actually surfaced — 0 means the SEARCH found nothing; >0 with rawParsedCount 0 means the model saw sources but declined to include them
}

export interface HuntMeta {
  commit?: string; // which deployment answered — kills "is this the new code?" ambiguity
  territoriesReceived: number; // what the server actually got, not what the client thinks it sent
  keyPresent: boolean;
}

export interface HuntResult {
  configured: boolean;
  needsCreds?: boolean;
  leads: Lead[];
  error?: string;
  // Diagnostics — ALWAYS populated on every return path (including early
  // returns), so an absent debug/meta field can only mean one thing: the
  // response came from a deployment older than this code.
  debug?: LaneDiag[];
  meta?: HuntMeta;
}

/**
 * Compact prompt for the broad fallback pass. The full prompt stacks literal
 * phrase lists, hard excludes, and lane focus on top of a strict JSON format —
 * and a lightweight search model's safest fully-compliant answer to an
 * over-constrained request is an empty array. When every lane returns zero,
 * we re-run ONE search with this minimal prompt and no domain filter, and let
 * the deterministic code-side relevance filter do the policing the long
 * prompt was attempting.
 */
export function buildFallbackPrompt(cfg: Required<Pick<HuntConfig, "territories">> & HuntConfig): string {
  const v = verticalOf(cfg.vertical);
  const intentEnum = [...v.intents.map((i) => i.key), "signal"].join("|");
  const sinceDays = Math.max(3, Math.min(120, cfg.sinceDays || 45));
  return (
    `Find recent public posts (last ${sinceDays} days) by real individuals that a ${cfg.profession || v.profession} ` +
    `serving ${cfg.territories.join(", ")} (Arizona) would want to reply to. Target: ${v.primaryTarget} ` +
    `Search Reddit, Quora, forums, X, and the open web. ` +
    `Respond with ONLY a JSON array. Each element: {"title": string, "snippet": "1-2 sentences of what they said", ` +
    `"url": "direct link to the post", "source": "community/site name", ` +
    `"platform": "reddit|facebook|nextdoor|quora|forum|x|news|web", "intent": "${intentEnum}", ` +
    `"territory": "closest match from [${cfg.territories.join(", ")}] or 'Arizona'", ` +
    `"score": 0-100 intent strength, "why": "one line", ` +
    `"postedAgo": "REQUIRED — verified post age, e.g. 3d; exclude the post if you cannot confirm it is within ` +
    `the last ${sinceDays} days"}. ` +
    `Never include old, archived, or locked threads — they cannot be replied to and are worthless. ` +
    `Up to 12 items. Real posts with real links only.`
  );
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

type HuntLane = {
  label: string;
  focus: string;
  focusFromVertical?: boolean; // resolve focus from the vertical def at runtime
  useFallbackPrompt?: boolean; // compact prompt, no stacked constraints (recall-rescue pass)
  promptOverride?: string; // fully custom prompt (deep-hunt query batches)
  domains?: string[];
  keep: (url: string) => boolean;
};

const FALLBACK_LANE: HuntLane = {
  label: "broad fallback",
  focus: "",
  useFallbackPrompt: true,
  keep: () => true, // the vertical relevance filter in coerceLeads still applies
};

const HUNT_LANES: HuntLane[] = [
  {
    label: "reddit",
    focus: "For this search, look specifically on Reddit (reddit.com) — subreddit threads and comments.",
    domains: ["reddit.com"],
    keep: (u) => hostIsOneOf(u, ["reddit.com"]),
  },
  {
    label: "reddit statewide",
    // vertical-specific: the realtor version hunts statewide relocation asks,
    // the solar version hunts homeowner solar/bill questions — set at runtime
    focus: "",
    focusFromVertical: true,
    domains: ["reddit.com"],
    keep: (u) => hostIsOneOf(u, ["reddit.com"]),
  },
  {
    label: "forums & boards",
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
): Promise<{ leads: Lead[]; diag: LaneDiag }> {
  const v = verticalOf(cfg.vertical);
  const laneFocus = lane.focusFromVertical ? v.statewideLaneFocus : lane.focus;
  const prompt =
    lane.promptOverride ??
    (lane.useFallbackPrompt
      ? buildFallbackPrompt(cfg)
      : `${buildHuntPrompt(cfg)}\n\nSEARCH FOCUS FOR THIS PASS: ${laneFocus}`);
  const sinceDays = Math.max(3, Math.min(120, cfg.sinceDays || 45));
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
    // THE decisive lever for the stale-results failure seen live: restrict
    // Perplexity's RETRIEVAL layer to recent content, so the model never even
    // sees the archived megathreads and evergreen guides that dominate
    // ranking. Without this, every lane's sources skewed years old and the
    // model (correctly) returned [] under our recency rules.
    search_recency_filter: sinceDays <= 10 ? "week" : "month",
    // pull more sources per query — several lanes were retrieving only 1
    web_search_options: { search_context_size: lane.useFallbackPrompt || lane.promptOverride ? "high" : "medium" },
  };
  if (lane.domains?.length) body.search_domain_filter = lane.domains;

  const diag: LaneDiag = {
    label: lane.label,
    httpStatus: "error",
    rawParsedCount: 0,
    afterHousingFilterCount: 0,
    afterLaneKeepCount: 0,
  };

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    diag.httpStatus = r.status;
    if (!r.ok) {
      diag.httpError = (await r.text().catch(() => "")).slice(0, 300);
      return { leads: [], diag };
    }
    const data = await r.json();
    const fullText: string = data?.choices?.[0]?.message?.content ?? "";
    // how many sources the SEARCH surfaced, independent of what the model
    // chose to return — separates "search found nothing" from "model
    // discarded everything it saw"
    const sr = data?.search_results ?? data?.citations;
    diag.citations = Array.isArray(sr) ? sr.length : undefined;
    let text = fullText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    let parsed: unknown = [];
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        diag.parseFailed = true;
        parsed = [];
      }
    } catch {
      // a refusal, prose answer, or truncated reply all land here — capture
      // what the model ACTUALLY said so this is distinguishable from a
      // genuine "searched and found nothing" empty array
      diag.parseFailed = true;
      parsed = [];
    }
    diag.rawParsedCount = Array.isArray(parsed) ? parsed.length : 0;
    // capture the reply head whenever the lane yields nothing — a clean "[]"
    // and a hedging prose answer look identical without this
    if (diag.parseFailed || diag.rawParsedCount === 0) diag.rawSample = fullText.slice(0, 220);
    const afterHousing = coerceLeads(parsed, v, Math.max(3, Math.min(120, cfg.sinceDays || 45)));
    diag.afterHousingFilterCount = afterHousing.length;
    // when the model returned candidates but our filters killed them ALL,
    // show what got dropped — otherwise "returned 1 → relevant 0" is opaque
    if (diag.rawParsedCount > 0 && afterHousing.length === 0) {
      const first = (parsed as Record<string, unknown>[])[0] || {};
      diag.rawSample = `filtered out — first: "${String(first.title ?? "").slice(0, 80)}" postedAgo=${String(first.postedAgo ?? "?")} url=${String(first.url ?? "").slice(0, 80)}`;
    }
    // deterministic enforcement — don't trust the model or the API param alone
    const kept = afterHousing.filter((l) => lane.keep(l.url.toLowerCase()));
    diag.afterLaneKeepCount = kept.length;
    return { leads: kept, diag };
  } catch (e) {
    diag.httpError = e instanceof Error ? e.message.slice(0, 300) : "unknown error";
    return { leads: [], diag };
  }
}

/**
 * Run the hunt across all lanes in parallel and merge, deduped by url,
 * highest score first. Returns scored, multi-platform leads — no single
 * platform can dominate the result set.
 */
export async function runHunt(cfg: HuntConfig): Promise<HuntResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  const territories = (cfg.territories || []).map((t) => String(t)).filter(Boolean).slice(0, 6);
  // meta rides on EVERY return path — commit answers "which deployment served
  // this", territoriesReceived answers "did the config actually arrive". An
  // absent meta in a response can then only mean a pre-this-code deployment.
  const meta: HuntMeta = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    territoriesReceived: territories.length,
    keyPresent: !!key,
  };
  if (!key) return { configured: false, needsCreds: true, leads: [], debug: [], meta };
  if (!territories.length) {
    // this was a SILENT empty return before — the one path that produced
    // "green status, zero leads, no diagnostics" with no way to tell why
    return { configured: true, leads: [], error: "no territories configured — the hunt has nothing to search for", debug: [], meta };
  }

  const full = { ...cfg, territories };
  const v = verticalOf(cfg.vertical);
  const sinceDaysWindow = Math.max(3, Math.min(120, cfg.sinceDays || 45));

  // Deep mode: instead of 6 broad lanes, fan out the vertical's literal query
  // matrix — the concrete searches a human prospector would run one by one —
  // in batches of 5 per call. Each batch executes its searches and extracts
  // every matching recent post; the shared filters downstream still apply.
  let lanes: HuntLane[];
  if (cfg.deep) {
    const intentEnum = [...v.intents.map((i) => i.key), "signal"].join("|");
    const deepPrompt = (qs: string[], extra: string) =>
      `You are prospecting for a ${cfg.profession || v.profession} serving ${territories.join(", ")} (Arizona). ` +
      `Execute EACH of these web searches and comb the results:\n` +
      qs.map((q, j) => `${j + 1}. ${q}`).join("\n") +
      `\n\nFrom everything found, extract EVERY distinct RECENT post (last ${sinceDaysWindow} days) written by a ` +
      `real individual matching this target: ${v.primaryTarget}\n${extra}` +
      `Respond with ONLY a JSON array. Each element: {"title": string, "snippet": "1-2 sentences of what they ` +
      `said", "url": "direct link to the post", "source": "community/site name", ` +
      `"platform": "reddit|facebook|nextdoor|quora|forum|x|news|web", "intent": "${intentEnum}", ` +
      `"territory": "closest match from [${territories.join(", ")}] or 'Arizona'", ` +
      `"score": 0-100 intent strength, "why": "one line", ` +
      `"postedAgo": "REQUIRED verified post age, e.g. 3d; exclude if unconfirmable or older than ${sinceDaysWindow} days"}. ` +
      `Never include archived or locked threads. Up to 12 items per batch. Real posts with real links only.`;

    // Partition: Reddit-targeted queries get their own batches; everything
    // else runs in Reddit-FORBIDDEN batches — instructed AND code-enforced —
    // so Quora/City-Data/forums/X/Nextdoor coverage can't be crowded out by
    // Reddit results satisfying a mixed batch.
    const queries = v.queryMatrix(territories);
    const redditQ = queries.filter((q) => /reddit/i.test(q));
    const webQ = queries.filter((q) => !/reddit/i.test(q));
    const chunk = (arr: string[], n: number) => {
      const out: string[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };
    const redditBatches = chunk(redditQ, 5);
    const webBatches = chunk(webQ, 5);
    lanes = [
      ...redditBatches.map((qs, i) => ({
        label: `deep reddit ${i + 1}/${redditBatches.length}`,
        focus: "",
        keep: () => true,
        promptOverride: deepPrompt(qs, ""),
      })),
      ...webBatches.map((qs, i) => ({
        label: `deep web ${i + 1}/${webBatches.length}`,
        focus: "",
        // code-enforced: this batch may not return reddit links at all
        keep: (u: string) => !hostIsOneOf(u, ["reddit.com"]),
        promptOverride: deepPrompt(
          qs,
          `Do NOT return any reddit.com links in this pass — Reddit is covered by a separate search. Focus on ` +
            `Quora, City-Data, DIY/enthusiast forums, X, publicly indexed Nextdoor and Facebook posts, and other ` +
            `community sites.\n`
        ),
      })),
    ];
  } else {
    lanes = HUNT_LANES;
  }

  // deep mode also fires the native Reddit lane in parallel — the
  // deterministic, exact-timestamp source Perplexity's index can't match
  const nativePromise = cfg.deep ? runRedditNative(full, sinceDaysWindow) : null;
  const settled = await Promise.allSettled(lanes.map((lane) => runLane(key, full, lane)));
  const debug: LaneDiag[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value.diag
      : {
          label: lanes[i].label,
          httpStatus: "error",
          httpError: s.reason instanceof Error ? s.reason.message.slice(0, 300) : "lane rejected",
          rawParsedCount: 0,
          afterHousingFilterCount: 0,
          afterLaneKeepCount: 0,
        }
  );
  // "fulfilled" alone is meaningless here — runLane catches everything
  // internally and always resolves, so a 401 on all four lanes still looked
  // like success. Genuine success = at least one lane actually got HTTP 200.
  const anyOk = settled.some((s) => s.status === "fulfilled" && s.value.diag.httpStatus === 200);
  if (!anyOk) {
    const firstErr = debug.find((d) => d.httpError)?.httpError || `all lanes failed (statuses: ${debug.map((d) => d.httpStatus).join(", ")})`;
    return { configured: true, leads: [], error: `hunt failed: ${firstErr.slice(0, 200)}`, debug, meta };
  }

  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const merged: Lead[] = [];
  const mergeIn = (leads: Lead[]) => {
    for (const lead of leads) {
      const urlKey = normalizeLeadUrl(lead.url);
      const titleKey = leadFingerprint(lead);
      if (seenUrl.has(urlKey) || seenTitle.has(titleKey)) continue;
      seenUrl.add(urlKey);
      seenTitle.add(titleKey);
      merged.push(lead);
    }
  };
  for (const s of settled) {
    if (s.status === "fulfilled") mergeIn(s.value.leads);
  }

  // native Reddit results merge FIRST-CLASS (they're the most trustworthy:
  // real posts, exact ages) — but after the dedup sets are warm so the same
  // thread found by both paths lands once
  if (nativePromise) {
    try {
      const native = await nativePromise;
      debug.push(native.diag);
      mergeIn(native.leads);
    } catch {}
  }

  // Recall rescue: if every constrained lane came back empty, re-run ONE broad
  // pass with the compact prompt and no domain filter. The code-side relevance
  // filter still applies, so this can't reintroduce off-topic leads — it only
  // recovers real ones the over-constrained lanes scared the model out of.
  if (merged.length === 0) {
    const fb = await runLane(key, full, FALLBACK_LANE);
    debug.push(fb.diag);
    mergeIn(fb.leads);
  }

  // Age VERIFICATION — establish each post's real age instead of trusting the
  // model's claim: exact for X (snowflake IDs), page publish-date fetch for
  // open web, sequential-ID era estimate for Reddit (rejects archived-era
  // threads). Runs in parallel; a verified-stale lead is dropped here even if
  // it survived every upstream filter.
  const now = Date.now();
  const sinceDaysClamped = Math.max(3, Math.min(120, cfg.sinceDays || 45));
  const checked = await Promise.all(
    merged.map(async (lead) => {
      // natively-fetched leads carry Reddit's own created_utc — already exact
      if (lead.ageVerified === "exact") return { lead, keep: true };
      const check = await verifyAge(lead.url, postAgeDays(lead.postedAgo), sinceDaysClamped, now);
      if (check.ageDays != null && (check.source === "exact" || check.source === "page" || check.source === "estimated")) {
        lead.postedAgo = ageLabelFromDays(check.ageDays);
      }
      lead.ageVerified = check.source;
      return { lead, keep: check.keep };
    })
  );
  const verified = checked.filter((c) => c.keep).map((c) => c.lead);
  debug.push({
    label: "age verification",
    httpStatus: 200,
    rawParsedCount: merged.length,
    afterHousingFilterCount: verified.length,
    afterLaneKeepCount: verified.length,
  });

  verified.sort((a, b) => b.score - a.score);
  return { configured: true, leads: verified.slice(0, 40), debug, meta };
}
