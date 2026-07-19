import { NextRequest, NextResponse } from "next/server";

/**
 * AI post copywriter — turns an idea + its knowledge-base facts into tight,
 * single-subject post copy so the Studio never ships generic template text.
 *
 * Reuses the deployment's existing PERPLEXITY_API_KEY (same key that powers
 * the lead hunts and source research) — no new keys needed.
 *
 * GET  → { configured }
 * POST { title, theme, angle, territory, city, utility, facts[], channel }
 *      → { configured, long, short, cta }
 *
 * `long` is already shaped for the Studio's slide model: first line = hook
 * (cover), each following paragraph = one body slide. The CTA is returned
 * separately because the Composer renders it as its own closing slide.
 */

const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function GET() {
  return NextResponse.json({ configured: !!process.env.PERPLEXITY_API_KEY });
}

export async function POST(req: NextRequest) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return NextResponse.json({ configured: false });

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const title = clamp(b.title, 160);
  const theme = clamp(b.theme, 40);
  const angle = clamp(b.angle, 300);
  const territory = clamp(b.territory, 80);
  const city = clamp(b.city, 80) || territory;
  const utility = clamp(b.utility, 12);
  const channel = clamp(b.channel, 4);
  const facts = (Array.isArray(b.facts) ? b.facts : []).map((f) => clamp(f, 500)).filter(Boolean).slice(0, 3);
  if (!title || !facts.length) return NextResponse.json({ configured: true, error: "missing idea or facts" });

  const utilityName = utility === "aps" ? "APS" : utility === "srp" ? "SRP" : "their utility";
  const channelName = channel === "nd" ? "Nextdoor (neighborly, first-person, talking to actual neighbors)" : channel === "fb" ? "Facebook (community tone)" : "Instagram (punchy, saveable)";

  const system =
    "You write social media post copy for a residential solar consultant in metro Phoenix, Arizona. " +
    "You are given verified facts — they are your ONLY source of claims. Never invent numbers, prices, dates, " +
    "credentials, or years of experience. Never mix subjects: one post makes ONE argument. " +
    "Write like a sharp local who knows the numbers, not like a marketer. Output ONLY valid JSON.";

  const user = `Write one ${channelName} post for homeowners in ${territory}${city && city !== territory ? ` (${city})` : ""}, Arizona, who are on ${utilityName}.

POST SUBJECT (stay on this one subject the entire post):
Title: ${title}
Theme: ${theme}${angle ? `\nAngle: ${angle}` : ""}

VERIFIED FACTS (the only claims you may use — keep their numbers exact):
${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Return JSON exactly in this shape:
{"hook": "...", "body": ["...", "...", "..."], "cta": "...", "short": "..."}

Rules:
- The body must DELIVER exactly what the hook promises. If the hook promises N questions, steps, or red flags, the body is exactly those N items, numbered. Never promise a list and then talk about something else.
- hook: max 9 words, and it must stop the scroll ON ITS OWN — lead with the number, the contradiction, or the cost of not knowing. Pick whichever structure fits this idea best: number-led, contrarian statement, curiosity gap, or direct question. No clickbait words, no emojis, no hashtags, no colons-into-nothing.
- body: 2 or 3 strings. Each is ONE point supporting the hook, max 30 words, conversational second person, plain language an 8th grader gets. Use the facts' numbers exactly. Every string must be about the same single subject as the hook.
- cta: max 16 words, low pressure. The CTA is the ONLY place ${territory} may appear — the education itself stays statewide. No "link in bio", no urgency tricks.
- short: a 1-2 sentence caption version of the whole post, max 220 characters.
- Banned everywhere: "in today's world", "game-changer", "unlock", "did you know", "look no further", "☀️", all emojis, all hashtags, any claim not in the facts.`;

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.5,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) {
      return NextResponse.json({ configured: true, error: `writer ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}` });
    }
    const data = await r.json();
    let text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    let parsed: { hook?: unknown; body?: unknown; cta?: unknown; short?: unknown } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ configured: true, error: "writer returned malformed copy — try again" });
    }
    const hook = clamp(parsed.hook, 120);
    const body = (Array.isArray(parsed.body) ? parsed.body : []).map((p) => clamp(p, 260)).filter(Boolean).slice(0, 3);
    const cta = clamp(parsed.cta, 160);
    const short = clamp(parsed.short, 260);
    if (!hook || !body.length) return NextResponse.json({ configured: true, error: "writer returned empty copy — try again" });

    return NextResponse.json({
      configured: true,
      long: [hook, ...body].join("\n\n"),
      short: short || `${hook} — ${body[0]}`,
      cta: cta || undefined,
    });
  } catch (e) {
    return NextResponse.json({ configured: true, error: e instanceof Error ? e.message.slice(0, 160) : "writer failed" });
  }
}
