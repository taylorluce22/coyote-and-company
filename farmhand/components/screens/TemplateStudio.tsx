"use client";

import { useState } from "react";
import { DG, ARCHETYPES, SAMPLE_POSTS, PILLARS, WORDMARK, HANDLE, type Slide, type Bg, type DGPost } from "@/lib/desertGrid";

/**
 * DESERT GRID Studio — renders the content-engine post objects to the spec's
 * archetypes (farmhand/docs/content-engine-spec-2026.md). Data-driven: the
 * same object shape the engine will emit. This is the in-app version of the
 * template system, in the real brand tokens.
 */

const DISPLAY = `"Inter Tight", "Inter", var(--font-space-grotesk), system-ui, sans-serif`;
const BODY = `"Inter", var(--font-geist), system-ui, sans-serif`;

function bgColor(bg: Bg) {
  if (bg === "night") return DG.night;
  if (bg === "photo") return `linear-gradient(158deg, #2a2118, ${DG.night} 62%, #0c0a07)`;
  return DG.paper;
}
function fg(bg: Bg) {
  return bg === "paper" ? DG.ink : DG.paper;
}

/* footer furniture — wordmark + slide index, source line above (spec §1.5) */
function Furniture({ bg, idx, total, source }: { bg: Bg; idx: number; total: number; source?: string }) {
  const c = fg(bg);
  return (
    <div style={{ marginTop: "auto" }}>
      {source && <div style={{ fontSize: 9, color: c, opacity: 0.5, paddingBottom: 8, letterSpacing: "0.02em" }}>Source: {source}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${c}`, paddingTop: 8, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, color: c, opacity: 0.62 }}>
        <span style={{ letterSpacing: "0.14em" }}>{WORDMARK}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{String(idx).padStart(2, "0")} / {String(total).padStart(2, "0")} {idx < total ? "→" : ""}</span>
      </div>
    </div>
  );
}

function Eyebrow({ text, bg }: { text: string; bg: Bg }) {
  return (
    <>
      <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, color: DG.hot }}>{text}</div>
      <div style={{ height: 1, background: fg(bg), opacity: 0.2, marginTop: 9 }} />
    </>
  );
}

function LineChart({ points, startLabel, endLabel, note }: { points: [number, number][]; startLabel: string; endLabel: string; note?: string }) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys) * 0.9, maxY = Math.max(...ys) * 1.05;
  const px = (x: number) => 34 + ((x - minX) / (maxX - minX || 1)) * 190;
  const py = (y: number) => 92 - ((y - minY) / (maxY - minY || 1)) * 64;
  const poly = points.map((p) => `${px(p[0])},${py(p[1])}`).join(" ");
  return (
    <svg viewBox="0 0 250 120" style={{ width: "100%", marginTop: 8 }}>
      <line x1="24" y1="16" x2="24" y2="96" stroke={DG.ink} strokeOpacity="0.25" />
      <line x1="24" y1="96" x2="238" y2="96" stroke={DG.ink} strokeOpacity="0.25" />
      <line x1="24" y1="42" x2="238" y2="42" stroke={DG.ink} strokeOpacity="0.1" />
      <line x1="24" y1="69" x2="238" y2="69" stroke={DG.ink} strokeOpacity="0.1" />
      <polyline points={poly} fill="none" stroke={DG.hot} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(points[0][0])} cy={py(points[0][1])} r="3.4" fill={DG.hot} />
      <circle cx={px(points[points.length - 1][0])} cy={py(points[points.length - 1][1])} r="3.8" fill={DG.hot} />
      <text x="28" y="12" fontSize="8" fontWeight="700" fill={DG.ink} fontFamily="system-ui">{startLabel}</text>
      <text x="196" y={py(points[points.length - 1][1]) + 13} fontSize="8.5" fontWeight="700" fill={DG.hot} fontFamily="system-ui">{endLabel}</text>
      {note && <text x="120" y="112" fontSize="7.5" fill={DG.ink} fillOpacity="0.55" fontFamily="system-ui">{note}</text>}
    </svg>
  );
}

function SlideView({ s, idx, total }: { s: Slide; idx: number; total: number }) {
  const c = fg(s.bg);
  const base: React.CSSProperties = {
    aspectRatio: "4 / 5", background: bgColor(s.bg), color: c, display: "flex", flexDirection: "column",
    padding: "26px 24px", fontFamily: BODY, position: "relative", overflow: "hidden",
    boxShadow: "0 14px 34px rgba(0,0,0,0.34)", border: "1px solid rgba(0,0,0,0.1)", flex: "0 0 auto", width: 336, scrollSnapAlign: "center",
  };

  let body: React.ReactNode = null;
  let source: string | undefined;

  switch (s.a) {
    case "A06":
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} />
          <div style={{ marginTop: "auto", fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, lineHeight: 1.04, letterSpacing: "-0.03em" }}>
            {s.hotWord ? s.headline.split(s.hotWord).flatMap((part, i) => i === 0 ? [part] : [<span key={i} style={{ color: DG.hot }}>{s.hotWord}</span>, part]) : s.headline}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.66, marginTop: 14, maxWidth: "26ch" }}>{s.kicker}</div>
        </>
      );
      break;
    case "A01":
      source = s.source;
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.86, fontSize: 104, fontVariantNumeric: "tabular-nums" }}>
              {s.num}{s.unit && <span style={{ fontSize: 28, fontWeight: 700, opacity: 0.6, marginLeft: 4 }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, marginTop: 14, maxWidth: "22ch" }}>{s.sub}</div>
            {s.ctx && <div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: 1.35, marginTop: 10, maxWidth: "26ch" }}>{s.ctx}</div>}
          </div>
        </>
      );
      break;
    case "A03":
      source = s.source;
      body = (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17.5, lineHeight: 1.08, letterSpacing: "-0.02em" }}>{s.title}</div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 5 }}>{s.standfirst}</div>
          <LineChart points={s.points} startLabel={s.startLabel} endLabel={s.endLabel} note={s.note} />
        </div>
      );
      break;
    case "A02":
      source = s.source;
      body = (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17.5, lineHeight: 1.08, letterSpacing: "-0.02em" }}>{s.title}</div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 5 }}>{s.standfirst}</div>
          <div style={{ marginTop: 14 }}>
            {s.rows.map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                <span style={{ fontSize: 11, fontWeight: 600, width: 60, flex: "0 0 60px" }}>{r.label}</span>
                <span style={{ flex: 1, height: 16 }}><span style={{ display: "block", height: 16, width: `${r.pct}%`, background: r.hot ? DG.hot : DG.neutral }} /></span>
                <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", fontWeight: 700, width: 38, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
          {s.ctx && <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 14, maxWidth: "26ch" }}>{s.ctx}</div>}
        </div>
      );
      break;
    case "A08":
      source = s.source;
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: DG.hot }}>{s.label}</div>
            {s.bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 9, fontSize: 13, lineHeight: 1.3 }}>
                <span style={{ width: 8, height: 8, background: DG.hot, flex: "0 0 8px", marginTop: 5 }} />
                <span><b style={{ fontWeight: 700 }}>{b.lead}</b> — {b.body}</span>
              </div>
            ))}
          </div>
        </>
      );
      break;
    case "A10":
      source = s.source;
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, margin: "12px -24px 0" }}>
            <div style={{ background: DG.night, color: DG.paper, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, opacity: 0.7 }}>What you've heard</span>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, marginTop: 8 }}>{s.myth}</span>
            </div>
            <div style={{ background: DG.paper, color: DG.ink, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: DG.hot }}>What the filing says</span>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, marginTop: 8 }}>{s.fact}</span>
            </div>
          </div>
          <div style={{ background: DG.hot, color: DG.paper, fontSize: 11.5, fontWeight: 700, lineHeight: 1.25, padding: "11px 24px", margin: "0 -24px" }}>{s.verdict}</div>
        </>
      );
      break;
    case "A09":
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} />
          <div style={{ marginTop: "auto", fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{s.caption}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 10 }}>{s.micro}</div>
          <div style={{ position: "absolute", top: 12, right: 14, fontSize: 7.5, letterSpacing: "0.16em", color: "rgba(255,255,255,0.32)", fontWeight: 700 }}>HIGGSFIELD PHOTO</div>
        </>
      );
      break;
    case "A16":
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12 }}>{s.headline}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {s.recap.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}>
                  <span style={{ width: 8, height: 8, background: DG.hot, flex: "0 0 8px", marginTop: 4 }} />{r}
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: c, opacity: 0.15, margin: "2px 0 12px" }} />
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>{s.cta1}</div>
            <div style={{ fontSize: 11.5, opacity: 0.62, marginTop: 5 }}>{s.cta2}</div>
          </div>
        </>
      );
      break;
    case "A14":
      source = s.source;
      body = <div style={{ fontSize: 12 }}>{s.title}</div>;
      break;
  }

  return <div style={base}>{body}<Furniture bg={s.bg} idx={idx} total={total} source={source} /></div>;
}

export default function TemplateStudio() {
  const [postId, setPostId] = useState(SAMPLE_POSTS[0].id);
  const post = SAMPLE_POSTS.find((p) => p.id === postId) as DGPost;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 18 }}>
        The DESERT GRID template system, live in the app. Each post is a data object (the engine&apos;s output shape)
        rendered through the archetypes — one idea per frame, the number set as a hero, a source line on every data slide.
        Placeholder type/photos until the brand + Higgsfield layer land; the structure is the real thing.
      </p>

      {/* token legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {([["Paper", DG.paper], ["Ink", DG.ink], ["Accent Hot", DG.hot], ["Data Cool", DG.cool], ["Neutral", DG.neutral], ["Night", DG.night]] as [string, string][]).map(([n, hex]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: "#8B89A0" }}>
            <span style={{ width: 18, height: 18, borderRadius: 3, background: hex, border: "1px solid rgba(255,255,255,0.14)" }} />{n}
          </div>
        ))}
      </div>

      {/* post picker */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {SAMPLE_POSTS.map((p) => {
          const on = p.id === postId;
          return (
            <button key={p.id} onClick={() => setPostId(p.id)} style={{ cursor: "pointer", border: on ? "1px solid #E8622C" : "1px solid rgba(255,255,255,0.12)", background: on ? "rgba(232,98,44,0.14)" : "rgba(255,255,255,0.04)", color: on ? "#F4F0E6" : "#A6A4B8", borderRadius: 10, padding: "8px 13px", fontSize: 12, fontWeight: 600 }}>
              <span style={{ color: "#E8622C", fontWeight: 700, marginRight: 6 }}>{PILLARS[p.pillar].label}</span>{p.title}
            </button>
          );
        })}
      </div>

      {/* the carousel */}
      <div style={{ display: "flex", gap: 18, overflowX: "auto", padding: "4px 2px 20px", scrollSnapType: "x mandatory" }}>
        {post.slides.map((s, i) => (
          <SlideView key={i} s={s} idx={i + 1} total={post.slides.length} />
        ))}
      </div>

      {/* archetype library reference */}
      <div style={{ marginTop: 20 }}>
        <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 10 }}>The 16-archetype library</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {ARCHETYPES.map((a) => (
            <div key={a.id} className="fh-glass" style={{ borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#F4F3F8" }}><span style={{ color: "#E8622C" }}>{a.id}</span> · {a.name}</div>
              <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 2 }}>{a.shape}</div>
            </div>
          ))}
          <div className="fh-glass" style={{ borderRadius: 10, padding: "10px 12px", opacity: 0.6 }}>
            <div style={{ fontSize: 10.5, color: "#8B89A0" }}>+7 more (map, small-multiples, timeline, teardown, scorecard, quote, isometric)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
