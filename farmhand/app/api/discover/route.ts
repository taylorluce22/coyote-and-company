import { NextRequest, NextResponse } from "next/server";

/**
 * Live source research via Perplexity's online model.
 * The key lives ONLY in the deployment env (PERPLEXITY_API_KEY on Vercel) —
 * never in the client. Same pattern as /api/stock.
 *
 * GET /api/discover                  → { configured: boolean }
 * GET /api/discover?territory=&city=&profession=&segment=
 *                                    → { configured, sources: [{name, platform, why, size?}] }
 */

interface Found {
  name: string;
  platform: "facebook" | "reddit" | "nextdoor" | "forum";
  why: string;
  size?: string;
}

const VALID_PLATFORMS = new Set(["facebook", "reddit", "nextdoor", "forum"]);

function coerce(raw: unknown): Found[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      name: String(r.name ?? "").slice(0, 120),
      platform: (VALID_PLATFORMS.has(String(r.platform)) ? String(r.platform) : "forum") as Found["platform"],
      why: String(r.why ?? r.reason ?? "").slice(0, 300),
      size: r.size ? String(r.size).slice(0, 40) : undefined,
    }))
    .filter((r) => r.name.length > 2)
    .slice(0, 10);
}

export async function GET(req: NextRequest) {
  const key = process.env.PERPLEXITY_API_KEY;
  const { searchParams } = new URL(req.url);
  const territory = searchParams.get("territory");
  const mode = searchParams.get("mode") || "sources";

  // intel mode is statewide — it needs no territory param
  if (!territory && mode !== "intel") {
    return NextResponse.json({ configured: !!key });
  }
  if (!key) {
    return NextResponse.json({ configured: false, sources: [], items: [] });
  }

  const city = searchParams.get("city") || territory || "Arizona";
  const profession = searchParams.get("profession") || "real estate agent";
  const segment = searchParams.get("segment") || "";

  // Live energy intel — real, current news turned into post angles for the
  // solar content engine. Arizona-focused: APS customers are the primary
  // audience, SRP second. Covers rate cases, data-center demand growth,
  // grid infrastructure, and national solar/energy policy with local impact.
  if (mode === "intel") {
    const iprompt =
      `Search for REAL, RECENT news (last 21 days) that an Arizona residential solar consultant's audience — ` +
      `primarily APS customers, secondarily SRP customers, in the Phoenix metro — would care about. Cover these ` +
      `categories: (1) APS and SRP rate cases, rate/plan changes, and Arizona Corporation Commission decisions; ` +
      `(2) data center construction and growth in Arizona/Phoenix metro and its impact on electricity demand and ` +
      `rates; (3) grid infrastructure, reliability, capacity, and summer-demand news in Arizona; (4) national ` +
      `solar/energy policy with Arizona impact (tax credits, tariffs, net metering / export-rate changes); (5) ` +
      `notable residential solar or home-battery developments relevant to homeowners. Use national AND local ` +
      `sources (AZ Central, Phoenix Business Journal, AZ Corporation Commission, utility announcements, energy ` +
      `trade press). ` +
      `Respond with ONLY a JSON array, no prose, no markdown fences. Each element: ` +
      `{"headline": "the actual news, specific", ` +
      `"summary": "2 sentences with the concrete facts and numbers", ` +
      `"source": "publication name", "url": "direct link to the article", ` +
      `"date": "how recent, e.g. 3d ago or Jul 2", ` +
      `"utility": "APS"|"SRP"|"both"|"general", ` +
      `"angle": "one line: how a local solar pro turns this into a homeowner-facing post — educational, not salesy"}. ` +
      `Up to 8 items, most consequential first. Only include real articles whose links you can cite.`;
    try {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are a precise energy-news researcher. Output ONLY valid JSON. Never invent articles or links. Use current, verifiable reporting." },
            { role: "user", content: iprompt },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) return NextResponse.json({ configured: true, items: [], error: `intel upstream ${r.status}` });
      const data = await r.json();
      let text: string = data?.choices?.[0]?.message?.content ?? "[]";
      text = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const st = text.indexOf("[");
      const en = text.lastIndexOf("]");
      if (st >= 0 && en > st) text = text.slice(st, en + 1);
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(text);
      } catch {}
      const items = (Array.isArray(parsed) ? parsed : [])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({
          headline: String(x.headline ?? "").slice(0, 200),
          summary: String(x.summary ?? "").slice(0, 400),
          source: String(x.source ?? "").slice(0, 80),
          url: String(x.url ?? "").slice(0, 600),
          date: String(x.date ?? "").slice(0, 30),
          utility: ["APS", "SRP", "both", "general"].includes(String(x.utility)) ? String(x.utility) : "general",
          angle: String(x.angle ?? "").slice(0, 300),
        }))
        .filter((x) => x.headline.length > 5 && /^https?:\/\//.test(x.url))
        .slice(0, 8);
      return NextResponse.json({ configured: true, items });
    } catch {
      return NextResponse.json({ configured: true, items: [], error: "intel request failed" });
    }
  }

  if (mode === "brief") {
    const bprompt =
      `Write a current market + community brief on ${territory}` +
      `${city !== territory ? ` (${city}, Arizona)` : ", Arizona"} for a ${profession}` +
      `${segment ? ` working the ${segment} segment` : ""}. ` +
      `Respond with ONLY a JSON object, no prose, no markdown fences: ` +
      `{"summary": "2-3 sentences: market character, who is buying/selling, what is changing right now", ` +
      `"facts": ["4 to 6 short current facts: price levels, growth or development news, community traits, notable amenities"]}`;
    try {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are a precise local-market researcher. Output ONLY valid JSON. Use current, verifiable information." },
            { role: "user", content: bprompt },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) return NextResponse.json({ configured: true, error: `research upstream ${r.status}` });
      const data = await r.json();
      let text: string = data?.choices?.[0]?.message?.content ?? "{}";
      text = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const st = text.indexOf("{");
      const en = text.lastIndexOf("}");
      if (st >= 0 && en > st) text = text.slice(st, en + 1);
      let parsed: { summary?: unknown; facts?: unknown } = {};
      try {
        parsed = JSON.parse(text);
      } catch {}
      return NextResponse.json({
        configured: true,
        brief: {
          summary: String(parsed.summary ?? "").slice(0, 600),
          facts: Array.isArray(parsed.facts) ? parsed.facts.map((f) => String(f).slice(0, 200)).slice(0, 6) : [],
        },
      });
    } catch {
      return NextResponse.json({ configured: true, error: "brief request failed" });
    }
  }

  // solar prospects live in homeowner/community spaces, not industry groups —
  // without this steer the researcher returns real-estate agent communities
  const solarFocus = /solar/i.test(profession)
    ? `PRIORITIZE: city/community resident groups, homeowner groups, new-build and master-planned community ` +
      `resident groups (e.g. "<community name> Residents/Neighbors"), HOA-adjacent groups, and Arizona ` +
      `energy/solar discussion spaces. Do NOT include real-estate agent, investor, or home-sales groups. `
    : "";
  const prompt =
    `Research active online communities where a ${profession} serving ${territory}` +
    `${city !== territory ? ` (${city}, Arizona)` : ", Arizona"}` +
    `${segment ? ` — a ${segment}-segment market —` : ""} could participate helpfully and build local trust. ` +
    `Find up to 8 across: Facebook groups, subreddits, Nextdoor neighborhoods, and local forums. ` +
    solarFocus +
    `Only include communities you can verify actually exist and are active. ` +
    `Respond with ONLY a JSON array, no prose, no markdown fences. Each element: ` +
    `{"name": "exact community name (platform in parens if Facebook)", "platform": "facebook"|"reddit"|"nextdoor"|"forum", ` +
    `"why": "one sentence: why it's relevant and how to show up helpfully without pitching", "size": "approx member count if known"}`;

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are a precise local-community researcher. Output ONLY valid JSON. Never invent communities." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) {
      return NextResponse.json({ configured: true, sources: [], error: `research upstream ${r.status}` });
    }
    const data = await r.json();
    let text: string = data?.choices?.[0]?.message?.content ?? "[]";
    // strip code fences / leading prose if the model added any
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
    return NextResponse.json({ configured: true, sources: coerce(parsed) });
  } catch {
    return NextResponse.json({ configured: true, sources: [], error: "research request failed" });
  }
}
