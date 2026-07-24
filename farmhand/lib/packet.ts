/**
 * The Monday packet (E2-3) — the client-facing weekly deliverable that makes the
 * done-with-you service sellable. One click turns the active client's week into a
 * branded, self-contained HTML document (print-to-PDF friendly): the week's
 * posts, the live opportunities worth joining, and the single best next move.
 *
 * It is CLIENT-FACING: no Farmhand internals, no agent/OS jargon — it reads like
 * a premium report prepared for the client. Everything is inlined so the file
 * opens or prints anywhere with no dependencies.
 */

import type { PlannedPost } from "./planner";
import type { Opportunity } from "./engage";
import type { StrategyProfile } from "./strategy";
import type { VaultImage } from "./vault";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const PILLAR_LABEL: Record<string, string> = { market: "Market", story: "Story", tips: "Education", spotlight: "Spotlight" };

const esc = (s: string) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Warmth heuristic for ordering the opportunity list (hottest first). */
function warmth(o: Opportunity): number {
  let s = 0;
  if (o.status === "engaged") s += 3;
  if (o.status === "watching") s += 2;
  if (o.isLead) s += 4;
  s += Math.min(3, (o.tags || []).length);
  if (o.postedAgo && /h|hour|1d|2d|3d/.test(o.postedAgo)) s += 2; // fresh
  return s;
}

/** The single best next move — the one thing to do today. */
function nextMove(posts: PlannedPost[], opps: Opportunity[]): string {
  const today = DAY_ORDER[(new Date().getDay() + 6) % 7]; // Mon=0
  const todayPost = posts.find((p) => p.plannedDay === today && p.status !== "posted");
  const hot = [...opps].filter((o) => o.status === "new").sort((a, b) => warmth(b) - warmth(a))[0];
  if (hot) return `Reply to the conversation in ${esc(hot.territory)} — “${esc((hot.excerpt || "").slice(0, 90))}…” It's fresh and worth a genuine, no-pitch first comment today.`;
  if (todayPost) return `Publish today's ${esc(PILLAR_LABEL[todayPost.pillar] || "")} post — “${esc(todayPost.topic)}”. Two minutes to post; it keeps your cadence unbroken.`;
  const ready = posts.find((p) => p.status === "ready");
  if (ready) return `Post “${esc(ready.topic)}” — it's approved and ready to go.`;
  return "Reply to one homeowner conversation in your territory today — presence compounds.";
}

export interface PacketInput {
  clientLabel: string;
  strategy: StrategyProfile;
  posts: PlannedPost[];
  opportunities: Opportunity[];
  images: VaultImage[];
  weekOf: number; // epoch ms (passed in — no Date.now at call sites that must stay pure)
}

export function buildPacketHTML(input: PacketInput): string {
  const { clientLabel, strategy, posts, opportunities, images } = input;
  const name = strategy?.name || clientLabel || "Your";
  const weekOf = new Date(input.weekOf);
  const weekLabel = weekOf.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const scheduled = [...posts].sort((a, b) => DAY_ORDER.indexOf(a.plannedDay || "zzz") - DAY_ORDER.indexOf(b.plannedDay || "zzz"));
  const leads = [...opportunities].sort((a, b) => warmth(b) - warmth(a)).slice(0, 12);
  const gallery = images.slice(0, 8);
  const move = nextMove(posts, opportunities);

  const postCards = scheduled.length
    ? scheduled.map((p) => `
      <div class="card">
        <div class="tagrow">
          <span class="pill">${esc(p.plannedDay ? DAY_LABEL[p.plannedDay] : "Unscheduled")}</span>
          <span class="pill ghost">${esc(PILLAR_LABEL[p.pillar] || p.pillar)}</span>
          <span class="pill ghost">${esc(p.type)}</span>
        </div>
        <h3>${esc(p.topic)}</h3>
        <p class="caption">${esc(p.caption)}</p>
        ${(p.hashtags || []).length ? `<p class="tags">${(p.hashtags || []).slice(0, 12).map((h) => `#${esc(h.replace(/^#/, ""))}`).join(" ")}</p>` : ""}
      </div>`).join("")
    : `<p class="empty">This week's posts will appear here once they're drafted.</p>`;

  const leadRows = leads.length
    ? leads.map((o) => `
      <div class="lead">
        <div class="lead-head">
          <span class="dot ${o.isLead ? "hot" : o.status === "engaged" || o.status === "watching" ? "warm" : ""}"></span>
          <strong>${esc(o.territory || "Local")}</strong>
          <span class="src">${esc(o.sourceName || "")}${o.postedAgo ? " · " + esc(o.postedAgo) : ""}</span>
        </div>
        <p>${esc((o.excerpt || "").slice(0, 220))}</p>
        ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">Open the conversation →</a>` : ""}
      </div>`).join("")
    : `<p class="empty">No qualified opportunities cleared the bar this week — we don't pad the list with weak leads.</p>`;

  const galleryHTML = gallery.length
    ? `<section><h2>This week's visuals</h2><div class="grid">${gallery.map((g) => `<img src="${g.dataURL}" alt="${esc(g.label || "")}" />`).join("")}</div></section>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(name)} — Weekly Packet · ${esc(weekLabel)}</title>
<style>
  :root { --ink:#14161A; --paper:#F4F0E6; --hot:#E8622C; --cool:#0F5A63; --mut:#6b6a63; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 40px 28px 64px; }
  header { border-bottom: 3px solid var(--ink); padding-bottom: 18px; margin-bottom: 30px; }
  .kick { text-transform: uppercase; letter-spacing: .16em; font-size: 11px; font-weight: 800; color: var(--hot); }
  h1 { font-size: 30px; margin: 6px 0 2px; letter-spacing: -0.01em; }
  .sub { color: var(--mut); font-size: 13.5px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--cool); margin: 36px 0 14px; border-bottom: 1px solid rgba(0,0,0,.12); padding-bottom: 7px; }
  .move { background: var(--ink); color: var(--paper); border-radius: 14px; padding: 20px 22px; margin: 4px 0 8px; }
  .move .kick { color: #F2A63C; }
  .move p { margin: 8px 0 0; font-size: 16.5px; font-weight: 600; line-height: 1.45; }
  .card { background:#fff; border:1px solid rgba(0,0,0,.09); border-radius: 12px; padding: 16px 18px; margin-bottom: 12px; }
  .card h3 { margin: 8px 0 6px; font-size: 17px; }
  .caption { margin: 0; white-space: pre-wrap; }
  .tags { color: var(--cool); font-size: 12.5px; margin: 10px 0 0; font-weight: 600; }
  .tagrow { display:flex; gap:6px; flex-wrap:wrap; }
  .pill { background: var(--hot); color:#fff; font-size: 10.5px; font-weight: 800; letter-spacing:.05em; text-transform:uppercase; padding: 3px 9px; border-radius: 999px; }
  .pill.ghost { background: rgba(0,0,0,.06); color: var(--mut); }
  .lead { border-left: 3px solid rgba(0,0,0,.12); padding: 4px 0 4px 14px; margin-bottom: 16px; }
  .lead-head { display:flex; align-items:center; gap:8px; font-size:14px; }
  .lead-head .src { color: var(--mut); font-size: 12px; font-weight: 500; }
  .lead p { margin: 5px 0 6px; }
  .lead a { color: var(--hot); font-weight: 700; text-decoration: none; font-size: 13px; }
  .dot { width:9px; height:9px; border-radius:50%; background:#b9b2a2; flex:none; }
  .dot.warm { background:#F2A63C; } .dot.hot { background: var(--hot); }
  .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .grid img { width:100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; }
  .empty { color: var(--mut); font-style: italic; }
  footer { margin-top: 44px; padding-top: 16px; border-top:1px solid rgba(0,0,0,.12); color: var(--mut); font-size: 12px; }
  @media print { body { background:#fff; } .card,.grid img { break-inside: avoid; } .wrap { padding: 0; } }
</style></head>
<body><div class="wrap">
  <header>
    <div class="kick">Weekly Content & Opportunity Packet</div>
    <h1>${esc(name)}</h1>
    <div class="sub">Week of ${esc(weekLabel)} · ${esc((strategy?.territories || []).map((t) => t.name).slice(0, 4).join(" · ") || "your territory")}</div>
  </header>

  <div class="move">
    <div class="kick">Your one next move</div>
    <p>${move}</p>
  </div>

  <section><h2>This week's posts</h2>${postCards}</section>
  ${galleryHTML}
  <section><h2>Conversations worth joining</h2>${leadRows}</section>

  <footer>Approve what you like, post it, and reply in your own voice. Anything you want changed, just say the word.</footer>
</div></body></html>`;
}
