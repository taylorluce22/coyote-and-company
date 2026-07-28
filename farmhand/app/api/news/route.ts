import { NextRequest, NextResponse } from "next/server";
import { del, list, put } from "@vercel/blob";
import { fetchPublic } from "@/lib/publicFetch";
import { sourceLine, type NewsArticle, type NewsImage } from "@/lib/newsDesk";

/**
 * News Desk API — drop an article in, get sourced raw material out.
 *
 * GET  ?client=            → { articles } newest first (records are small
 *                            JSON; the newest 40 are read in parallel)
 * POST { phase:"extract", url }
 *      → SERVER fetches the page and pulls headline / outlet / author /
 *        publish date / lede / lead image / readable body, plus SUGGESTED
 *        highlights (every sentence carrying a figure — the lines that can
 *        actually be cited). Nothing is stored: this is a draft to review.
 * POST { phase:"save", client, article }
 *      → stores the record at vault/<client>/news/<ms>-<id>.json and
 *        archives the lead image alongside it so link rot can't break a
 *        scheduled post. Returns the stored record.
 * POST { phase:"delete", client, id }
 *
 * Fetching arbitrary user-supplied URLs runs through lib/publicFetch's
 * SSRF guard (resolved-IP check, port pin, per-hop redirect validation,
 * streamed byte cap).
 */

export const maxDuration = 120;

const SEG = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const seg = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return SEG.test(s) ? s : null;
};
const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const strArr = (v: unknown, cap: number, len: number) =>
  (Array.isArray(v) ? v : []).map((x) => clamp(x, len)).filter(Boolean).slice(0, cap);

/* ------------------------------------------------------------------ */
/* extraction — no parser dependency; news pages are meta-tag rich      */
/* ------------------------------------------------------------------ */

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim();

/** First matching <meta> content for any of the given property/name values. */
function meta(html: string, keys: string[]): string {
  for (const k of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
      "i"
    );
    const tag = html.match(re)?.[0];
    if (!tag) continue;
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content && content.trim()) return decode(content);
  }
  return "";
}

/** JSON-LD NewsArticle block, if present — the most reliable metadata. */
function jsonLd(html: string): Record<string, unknown> | null {
  const blocks = [...html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const items = Array.isArray(parsed) ? parsed : parsed["@graph"] && Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      for (const it of items) {
        const t = String((it as Record<string, unknown>)?.["@type"] || "");
        if (/article|newsarticle|reportage/i.test(t)) return it as Record<string, unknown>;
      }
    } catch {
      // a malformed LD block is common — keep looking
    }
  }
  return null;
}

/** Readable body text: prefer <article>, strip chrome, collapse whitespace. */
function bodyText(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|figure)[\s\S]*?<\/\1>/gi, " ");
  const article = h.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (article && article.length > 400) h = article;
  // paragraphs first — keeps sentence boundaries intact
  const paras = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
  const text = paras.length ? paras.join("\n\n") : decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text.slice(0, 9000);
}

/** Sentences carrying a figure — the lines that can actually be cited. */
function suggestHighlights(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const withNumbers = sentences
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 40 && s.length < 320)
    .filter((s) => /\d/.test(s))
    // prefer money, percentages, megawatts, rates — the DESERT GRID currency
    .sort((a, b) => {
      const score = (x: string) => (/[$%]|\bcents?\b|\bkWh\b|\bMW\b|\bGW\b|\bmillion\b|\bbillion\b|\bpercent\b/i.test(x) ? 1 : 0);
      return score(b) - score(a);
    });
  const seen = new Set<string>();
  return withNumbers.filter((s) => (seen.has(s) ? false : (seen.add(s), true))).slice(0, 12);
}

function outletFrom(html: string, finalUrl: string): string {
  const site = meta(html, ["og:site_name", "application-name", "twitter:site"]);
  if (site) return site.replace(/^@/, "");
  try {
    return new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown outlet";
  }
}

function extract(html: string, finalUrl: string): NewsArticle {
  const ld = jsonLd(html);
  const ldStr = (k: string): string => {
    const v = ld?.[k];
    if (typeof v === "string") return decode(v);
    if (v && typeof v === "object") {
      const name = (v as Record<string, unknown>).name;
      if (typeof name === "string") return decode(name);
    }
    if (Array.isArray(v) && v.length) {
      const first = v[0];
      if (typeof first === "string") return decode(first);
      if (first && typeof first === "object" && typeof (first as Record<string, unknown>).name === "string") {
        return decode((first as Record<string, unknown>).name as string);
      }
    }
    return "";
  };

  const title =
    ldStr("headline") ||
    meta(html, ["og:title", "twitter:title"]) ||
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const summary = meta(html, ["og:description", "description", "twitter:description"]) || ldStr("description");
  const published = ldStr("datePublished") || meta(html, ["article:published_time", "publishedDate", "datePublished", "date"]);
  const author = ldStr("author") || meta(html, ["author", "article:author"]);
  const leadImage = meta(html, ["og:image", "twitter:image", "og:image:url"]);
  const credit = meta(html, ["og:image:alt", "image:credit"]);
  const body = bodyText(html);

  const images: NewsImage[] = leadImage && /^https?:\/\//i.test(leadImage) ? [{ url: leadImage, credit: credit || undefined }] : [];

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    url: finalUrl,
    outlet: outletFrom(html, finalUrl),
    title: title || "(untitled)",
    author: author || undefined,
    publishedAt: published || undefined,
    summary: summary || "",
    body,
    images,
    highlights: [],
    suggested: suggestHighlights(body),
    tags: [],
    addedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* storage                                                             */
/* ------------------------------------------------------------------ */

const keyFor = (client: string, a: NewsArticle) => `vault/${client}/news/${a.addedAt}-${a.id}.json`;

function sanitize(raw: unknown): NewsArticle | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  const url = clamp(r.url, 1000);
  const title = clamp(r.title, 300);
  if (!url || !title) return null;
  const addedNum = Number(r.addedAt);
  return {
    id: seg(r.id) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    outlet: clamp(r.outlet, 120) || "unknown outlet",
    title,
    author: clamp(r.author, 120) || undefined,
    publishedAt: clamp(r.publishedAt, 40) || undefined,
    summary: clamp(r.summary, 1200),
    body: clamp(r.body, 9000) || undefined,
    images: (Array.isArray(r.images) ? r.images : [])
      .map((i): NewsImage | null => {
        const im = i && typeof i === "object" ? (i as Record<string, unknown>) : {};
        const u = clamp(im.url, 1000);
        return u ? { url: u, savedUrl: clamp(im.savedUrl, 1000) || undefined, credit: clamp(im.credit, 200) || undefined } : null;
      })
      .filter((x): x is NewsImage => !!x)
      .slice(0, 6),
    highlights: strArr(r.highlights, 20, 500),
    suggested: strArr(r.suggested, 20, 500),
    note: clamp(r.note, 800) || undefined,
    tags: strArr(r.tags, 10, 40),
    addedAt: Number.isFinite(addedNum) && addedNum > 0 ? addedNum : Date.now(),
  };
}

export async function GET(req: NextRequest) {
  const client = seg(req.nextUrl.searchParams.get("client"));
  if (!client) return NextResponse.json({ error: "bad client id" }, { status: 400 });
  try {
    const { blobs } = await list({ prefix: `vault/${client}/news/`, limit: 200 });
    const records = blobs
      .filter((b) => b.pathname.endsWith(".json"))
      .map((b) => ({ url: b.url, ms: Number(b.pathname.split("/").pop()?.split("-")[0] || 0) }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 40);
    const articles = (
      await Promise.all(
        records.map(async (r) => {
          try {
            const res = await fetch(r.url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
            if (!res.ok) return null;
            return sanitize(await res.json());
          } catch {
            return null;
          }
        })
      )
    ).filter((a): a is NewsArticle => !!a);
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ error: "couldn't read the news desk" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}
  const phase = clamp(b.phase, 20);

  /* ---- extract a draft from a URL (nothing stored) ---- */
  if (phase === "extract") {
    const got = await fetchPublic(clamp(b.url, 1000), { maxBytes: 4 * 1024 * 1024, timeoutMs: 30000 });
    if ("error" in got) return NextResponse.json({ error: got.error }, { status: 400 });
    if (got.contentType && !/html|xml|text/i.test(got.contentType)) {
      return NextResponse.json({ error: "that link isn't an article page" }, { status: 400 });
    }
    const html = new TextDecoder("utf-8").decode(got.bytes);
    const article = extract(html, got.finalUrl);
    if (!article.body && !article.summary) {
      return NextResponse.json({ error: "couldn't read any text there — paste the article text instead" }, { status: 422 });
    }
    return NextResponse.json({ article });
  }

  /* ---- save (archives the lead image so link rot can't break a post) ---- */
  if (phase === "save") {
    const client = seg(b.client);
    const article = sanitize(b.article);
    if (!client || !article) return NextResponse.json({ error: "bad client or article" }, { status: 400 });
    try {
      const lead = article.images[0];
      if (lead && !lead.savedUrl) {
        const img = await fetchPublic(lead.url, { maxBytes: 12 * 1024 * 1024, timeoutMs: 30000, accept: "image/*" });
        if (!("error" in img) && img.contentType.startsWith("image/")) {
          const ext = img.contentType.includes("png") ? "png" : img.contentType.includes("webp") ? "webp" : "jpg";
          const saved = await put(`vault/${client}/news/${article.addedAt}-${article.id}-lead.${ext}`, img.bytes as unknown as ArrayBuffer, {
            access: "public",
            contentType: img.contentType,
            addRandomSuffix: false,
            allowOverwrite: true,
          });
          article.images[0] = { ...lead, savedUrl: saved.url };
        }
      }
      await put(keyFor(client, article), JSON.stringify(article), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      });
      return NextResponse.json({ article, sourceLine: sourceLine(article) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "couldn't save" }, { status: 500 });
    }
  }

  /* ---- delete the record + its archived image ---- */
  if (phase === "delete") {
    const client = seg(b.client);
    const id = seg(b.id);
    if (!client || !id) return NextResponse.json({ error: "bad client or id" }, { status: 400 });
    try {
      const { blobs } = await list({ prefix: `vault/${client}/news/`, limit: 200 });
      const doomed = blobs.filter((x) => x.pathname.includes(`-${id}.`) || x.pathname.includes(`-${id}-lead.`));
      if (doomed.length) await del(doomed.map((x) => x.url));
      return NextResponse.json({ ok: true, deleted: doomed.length });
    } catch {
      return NextResponse.json({ error: "couldn't delete" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "unknown phase" }, { status: 400 });
}
