/**
 * News Desk — manually dropped news articles that become sourced content.
 *
 * The brand system already demands this: DESERT GRID puts a source line on
 * every slide carrying a number, the Visual Style doc calls a credited
 * news-article screengrab "credibility gold" for local stories, and reel
 * recipe R5 (news react) is built on reacting to a primary source. What was
 * missing was a place to PUT the article. This is it.
 *
 * Records live SERVER-SIDE (Vercel Blob, `vault/<client>/news/<ms>-<id>.json`)
 * — the browser holds JSON, never media bytes. The lead image is archived
 * into the vault so a rotted URL can't break a post that's already scheduled,
 * and the outlet/credit fields are REQUIRED by the formatter: the binding
 * rule from the brand vault is that coverage is referenced with the outlet
 * credited on-slide and the link in the caption, never stripped.
 */

export interface NewsImage {
  /** the publisher's original image URL (the reference) */
  url: string;
  /** our archived copy in the vault — survives link rot AND is same-origin
      through /api/media, which is what lets the Studio canvas use it */
  savedUrl?: string;
  /** photo credit / agency line the page exposed (AP, Getty, Reuters…) —
      REQUIRED on any slide that uses the photo; never stripped */
  credit?: string;
  /** the figure's caption, when the page had one */
  caption?: string;
  /** true for the lead/hero image */
  lead?: boolean;
}

/** Photos an agency owns are the ones the outlet CAN'T license to you.
    Surfaced in the UI so the call is made with eyes open. */
export function riskyCredit(credit?: string): boolean {
  return /\b(ap|associated press|getty|reuters|afp|bloomberg|shutterstock|istock|adobe stock)\b/i.test(credit || "");
}

/** The line that must accompany a used photo, anywhere it lands. */
export function photoAttribution(a: Pick<NewsArticle, "outlet" | "url">, img: NewsImage): string {
  const who = img.credit ? `${img.credit} via ${a.outlet}` : a.outlet;
  return `Photo: ${who} — ${a.url}`;
}

export interface NewsArticle {
  id: string;
  url: string;
  outlet: string;
  title: string;
  author?: string;
  publishedAt?: string;
  /** the lede / meta description */
  summary: string;
  /** extracted readable body, capped — the CONTEXT the writer reads */
  body?: string;
  images: NewsImage[];
  /** the lines Taylor marked as usable — these become verified facts */
  highlights: string[];
  /** sentences containing figures, auto-suggested at extraction time */
  suggested?: string[];
  /** his own angle note: why this matters to Valley homeowners */
  note?: string;
  tags: string[];
  addedAt: number;
}

/** DESERT GRID's on-slide source line — every slide with a number needs one. */
export function sourceLine(a: Pick<NewsArticle, "outlet" | "publishedAt">): string {
  const d = a.publishedAt ? new Date(a.publishedAt) : null;
  const when = d && !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";
  return `Source: ${a.outlet}${when ? ` · ${when}` : ""}`;
}

/** The article as a briefing block — what gets pasted into any writer/prompt. */
export function articleBrief(a: NewsArticle): string {
  const lines = [
    `ARTICLE: ${a.title}`,
    `OUTLET: ${a.outlet}${a.author ? ` · ${a.author}` : ""}${a.publishedAt ? ` · ${a.publishedAt.slice(0, 10)}` : ""}`,
    `LINK: ${a.url}`,
    a.summary ? `\nSUMMARY: ${a.summary}` : "",
    a.highlights.length ? `\nKEY LINES (use these verbatim — they are the sourced claims):\n${a.highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : "",
    a.note ? `\nMY ANGLE: ${a.note}` : "",
    a.body ? `\nFULL CONTEXT:\n${a.body.slice(0, 4000)}` : "",
    `\nATTRIBUTION RULE: credit "${a.outlet}" on any slide using its headline or image, and put ${a.url} in the caption. Never strip a photo credit.`,
    `SLIDE SOURCE LINE: ${sourceLine(a)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* client helpers — thin wrappers over /api/news                       */
/* ------------------------------------------------------------------ */

export async function newsList(client: string): Promise<NewsArticle[]> {
  const r = await fetch(`/api/news?client=${encodeURIComponent(client)}`, { cache: "no-store" });
  const j = (await r.json()) as { articles?: NewsArticle[]; error?: string };
  if (!r.ok || j.error) throw new Error(j.error || "couldn't read the news desk");
  return j.articles || [];
}

/** Pull a draft from a URL — nothing is stored until save. */
export async function newsExtract(url: string): Promise<NewsArticle> {
  const r = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "extract", url }),
    signal: AbortSignal.timeout(60000),
  });
  const j = (await r.json()) as { article?: NewsArticle; error?: string };
  if (!r.ok || !j.article) throw new Error(j.error || "couldn't read that article");
  return j.article;
}

export async function newsSave(client: string, article: NewsArticle): Promise<NewsArticle> {
  const r = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "save", client, article }),
    signal: AbortSignal.timeout(90000),
  });
  const j = (await r.json()) as { article?: NewsArticle; error?: string };
  if (!r.ok || !j.article) throw new Error(j.error || "couldn't save that article");
  return j.article;
}

export async function newsDelete(client: string, id: string): Promise<void> {
  await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "delete", client, id }),
  });
}
