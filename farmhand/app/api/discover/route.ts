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

  if (!territory) {
    return NextResponse.json({ configured: !!key });
  }
  if (!key) {
    return NextResponse.json({ configured: false, sources: [] });
  }

  const city = searchParams.get("city") || territory;
  const profession = searchParams.get("profession") || "real estate agent";
  const segment = searchParams.get("segment") || "";

  const prompt =
    `Research active online communities where a ${profession} serving ${territory}` +
    `${city !== territory ? ` (${city}, Arizona)` : ", Arizona"}` +
    `${segment ? ` — a ${segment}-segment market —` : ""} could participate helpfully and build local trust. ` +
    `Find up to 8 across: Facebook groups, subreddits, Nextdoor neighborhoods, and local forums. ` +
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
