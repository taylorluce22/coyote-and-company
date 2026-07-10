import { NextRequest, NextResponse } from "next/server";

/**
 * Bulletproof, side-effect-free diagnostic. Paste this URL directly into any
 * browser address bar — it bypasses the entire React app, localStorage, the
 * auto-hunt interval, minScore filtering, and every caching layer that has
 * made debugging the Lead Engine in the live app ambiguous. This route talks
 * to Perplexity directly and shows the RAW result at every stage, so "zero
 * leads" can be told apart from "key missing" / "API error" / "model
 * returned something we can't parse" / "model genuinely found nothing" at a
 * glance, from a single fresh HTTP request every time.
 *
 * GET /api/hunt/selftest?territories=Scottsdale,Paradise+Valley,Surprise
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache" },
  });
}

export async function GET(req: NextRequest) {
  const startedAt = new Date().toISOString();
  const key = process.env.PERPLEXITY_API_KEY;

  if (!key) {
    return noStore({
      ok: false,
      startedAt,
      step: "env-check",
      finding: "PERPLEXITY_API_KEY is NOT set in this deployment's environment. This is the whole problem — add it in Vercel → Settings → Environment Variables (Production checked) and redeploy.",
      keyPresent: false,
    });
  }

  const { searchParams } = new URL(req.url);
  const territories = (searchParams.get("territories") || "Scottsdale, Paradise Valley, Surprise")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const prompt =
    `Search the live web right now for REAL, RECENT public posts (within the last 45 days) written by individual ` +
    `people (not businesses, not agents) who are showing genuine intent to move, buy, sell, rent, or invest in ` +
    `housing in or near ${territories.join(", ")}, Arizona, OR asking for recommendations on where to live in ` +
    `Arizona generally. Look specifically on Reddit (reddit.com). ` +
    `Respond with ONLY a JSON array (no prose, no markdown fences). Each element: ` +
    `{"title": "...", "snippet": "1-2 sentences", "url": "the exact direct link, required", "source": "e.g. r/phoenix", ` +
    `"score": 0-100}. If you genuinely find nothing matching, respond with an empty array [].`;

  let httpStatus: number | "network-error" = "network-error";
  let httpErrorBody: string | undefined;
  let rawModelText = "";
  let parseError: string | undefined;
  let parsedCount = 0;
  let parsedSample: unknown[] = [];

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
            content: "You are a precise lead-research engine. You search the live web and return ONLY real, verifiable, recent posts. Output ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    httpStatus = r.status;
    if (!r.ok) {
      httpErrorBody = (await r.text().catch(() => "")).slice(0, 1000);
    } else {
      const data = await r.json();
      rawModelText = String(data?.choices?.[0]?.message?.content ?? "");
      let text = rawModelText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start >= 0 && end > start) text = text.slice(start, end + 1);
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsedCount = parsed.length;
          parsedSample = parsed.slice(0, 5);
        } else {
          parseError = "Parsed JSON was not an array — got: " + typeof parsed;
        }
      } catch (e) {
        parseError = e instanceof Error ? e.message : "JSON.parse failed";
      }
    }
  } catch (e) {
    httpErrorBody = e instanceof Error ? e.message : "fetch threw";
  }

  return noStore({
    ok: true,
    startedAt,
    step: "perplexity-call",
    keyPresent: true,
    keyLast4: key.slice(-4),
    territoriesUsed: territories,
    perplexity: {
      httpStatus,
      httpErrorBody,
      rawModelTextLength: rawModelText.length,
      rawModelTextPreview: rawModelText.slice(0, 2000),
      parseError,
      parsedCount,
      parsedSample,
    },
    verdict:
      httpStatus !== 200
        ? `Perplexity API call failed with HTTP ${httpStatus}. Check the key is valid and has available credits/billing at perplexity.ai/settings/api.`
        : parseError
        ? `Perplexity responded but the output wasn't parseable JSON — see rawModelTextPreview above for what it actually said.`
        : parsedCount === 0
        ? `Perplexity responded successfully and explicitly returned zero results for this exact query. This means the search itself found nothing, not a bug in the app's filtering — see rawModelTextPreview to read its reasoning if any.`
        : `Perplexity found ${parsedCount} raw result(s) — the app's pipeline should be capturing these. If the app inbox is still empty, the bug is downstream (housing-relevance filter, score threshold, or the client not calling this correctly), not upstream.`,
  });
}
