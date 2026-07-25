"use client";

import { forwardRef } from "react";
import { DG, type Bg, type Slide } from "@/lib/desertGrid";

/**
 * DESERT GRID slide renderer — the one shared implementation of the
 * archetype system (spec: farmhand/docs/content-engine-spec-2026.md).
 * Scalable: every dimension multiplies by k = width/336, so the same
 * component renders the 336px Template Studio preview AND the full-res
 * 1080×1350 export node the Composer captures with html2canvas.
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

function Furniture({ bg, idx, total, source, wordmark, k }: { bg: Bg; idx: number; total: number; source?: string; wordmark: string; k: number }) {
  const c = fg(bg);
  return (
    <div style={{ marginTop: "auto" }}>
      {source && <div style={{ fontSize: 9 * k, color: c, opacity: 0.5, paddingBottom: 8 * k, letterSpacing: "0.02em" }}>Source: {source}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${c}`, paddingTop: 8 * k, fontSize: 9 * k, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, color: c, opacity: 0.62 }}>
        <span style={{ letterSpacing: "0.14em" }}>{wordmark}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{String(idx).padStart(2, "0")} / {String(total).padStart(2, "0")} {idx < total ? "→" : ""}</span>
      </div>
    </div>
  );
}

function Eyebrow({ text, bg, k }: { text: string; bg: Bg; k: number }) {
  return (
    <>
      <div style={{ fontSize: 10 * k, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, color: DG.hot }}>{text}</div>
      <div style={{ height: Math.max(1, k), background: fg(bg), opacity: 0.2, marginTop: 9 * k }} />
    </>
  );
}

function LineChart({ points, startLabel, endLabel, note, k }: { points: [number, number][]; startLabel: string; endLabel: string; note?: string; k: number }) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys) * 0.9, maxY = Math.max(...ys) * 1.05;
  const px = (x: number) => 34 + ((x - minX) / (maxX - minX || 1)) * 190;
  const py = (y: number) => 92 - ((y - minY) / (maxY - minY || 1)) * 64;
  const poly = points.map((p) => `${px(p[0])},${py(p[1])}`).join(" ");
  return (
    <svg viewBox="0 0 250 120" style={{ width: "100%", marginTop: 8 * k }}>
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

export interface DGSlideProps {
  s: Slide;
  idx: number; // 1-based
  total: number;
  width?: number; // px — 336 preview, 1080 export
  height?: number; // px — defaults to 4:5 of width
  wordmark?: string; // footer brand mark / handle
  photo?: string; // dataURL/photo bg for A09 slides
}

export const DGSlideView = forwardRef<HTMLDivElement, DGSlideProps>(function DGSlideView(
  { s, idx, total, width = 336, height, wordmark = "◆ Desert Grid", photo },
  ref
) {
  const k = width / 336;
  const h = height ?? width * 1.25;
  const c = fg(s.bg);
  const base: React.CSSProperties = {
    width,
    height: h,
    background: s.a === "A09" && photo ? `#111 url(${photo}) center/cover` : bgColor(s.bg),
    color: c,
    display: "flex",
    flexDirection: "column",
    padding: `${26 * k}px ${24 * k}px`,
    fontFamily: BODY,
    position: "relative",
    overflow: "hidden",
    flex: "0 0 auto",
  };

  let body: React.ReactNode = null;
  let source: string | undefined;

  switch (s.a) {
    case "A06":
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} k={k} />
          <div style={{ marginTop: "auto", fontFamily: DISPLAY, fontWeight: 800, fontSize: 34 * k, lineHeight: 1.04, letterSpacing: "-0.03em" }}>
            {s.hotWord ? s.headline.split(s.hotWord).flatMap((part, i) => i === 0 ? [part] : [<span key={i} style={{ color: DG.hot }}>{s.hotWord}</span>, part]) : s.headline}
          </div>
          <div style={{ fontSize: 12.5 * k, opacity: 0.66, marginTop: 14 * k, maxWidth: "26ch" }}>{s.kicker}</div>
        </>
      );
      break;
    case "A01":
      source = s.source;
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} k={k} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.86, fontSize: 104 * k, fontVariantNumeric: "tabular-nums" }}>
              {s.num}{s.unit && <span style={{ fontSize: 28 * k, fontWeight: 700, opacity: 0.6, marginLeft: 4 * k }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: 14.5 * k, fontWeight: 600, lineHeight: 1.25, marginTop: 14 * k, maxWidth: "22ch" }}>{s.sub}</div>
            {s.ctx && <div style={{ fontSize: 11.5 * k, opacity: 0.7, lineHeight: 1.35, marginTop: 10 * k, maxWidth: "26ch" }}>{s.ctx}</div>}
          </div>
        </>
      );
      break;
    case "A03":
      source = s.source;
      body = (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17.5 * k, lineHeight: 1.08, letterSpacing: "-0.02em" }}>{s.title}</div>
          <div style={{ fontSize: 11 * k, opacity: 0.65, marginTop: 5 * k }}>{s.standfirst}</div>
          <LineChart points={s.points} startLabel={s.startLabel} endLabel={s.endLabel} note={s.note} k={k} />
        </div>
      );
      break;
    case "A02":
      source = s.source;
      body = (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17.5 * k, lineHeight: 1.08, letterSpacing: "-0.02em" }}>{s.title}</div>
          <div style={{ fontSize: 11 * k, opacity: 0.65, marginTop: 5 * k }}>{s.standfirst}</div>
          <div style={{ marginTop: 14 * k }}>
            {s.rows.map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 * k, marginTop: 9 * k }}>
                <span style={{ fontSize: 11 * k, fontWeight: 600, width: 60 * k, flex: `0 0 ${60 * k}px` }}>{r.label}</span>
                <span style={{ flex: 1, height: 16 * k }}><span style={{ display: "block", height: 16 * k, width: `${r.pct}%`, background: r.hot ? DG.hot : DG.neutral }} /></span>
                <span style={{ fontSize: 11 * k, fontVariantNumeric: "tabular-nums", fontWeight: 700, width: 42 * k, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
          {s.ctx && <div style={{ fontSize: 11.5 * k, opacity: 0.7, marginTop: 14 * k, maxWidth: "26ch" }}>{s.ctx}</div>}
        </div>
      );
      break;
    case "A08":
      source = s.source;
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} k={k} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 * k }}>
            <div style={{ fontSize: 10 * k, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: DG.hot }}>{s.label}</div>
            {s.bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 9 * k, fontSize: 13 * k, lineHeight: 1.3 }}>
                <span style={{ width: 8 * k, height: 8 * k, background: DG.hot, flex: `0 0 ${8 * k}px`, marginTop: 5 * k }} />
                {b.lead ? <span><b style={{ fontWeight: 700 }}>{b.lead}</b> — {b.body}</span> : <span>{b.body}</span>}
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
          <Eyebrow text={s.eyebrow} bg={s.bg} k={k} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, margin: `${12 * k}px ${-24 * k}px 0` }}>
            <div style={{ background: DG.night, color: DG.paper, padding: `${14 * k}px ${16 * k}px`, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 8 * k, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, opacity: 0.7 }}>What you&apos;ve heard</span>
              <span style={{ fontSize: 13 * k, fontWeight: 600, lineHeight: 1.25, marginTop: 8 * k }}>{s.myth}</span>
            </div>
            <div style={{ background: DG.paper, color: DG.ink, padding: `${14 * k}px ${16 * k}px`, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 8 * k, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: DG.hot }}>What&apos;s actually true</span>
              <span style={{ fontSize: 13 * k, fontWeight: 600, lineHeight: 1.25, marginTop: 8 * k }}>{s.fact}</span>
            </div>
          </div>
          <div style={{ background: DG.hot, color: DG.paper, fontSize: 11.5 * k, fontWeight: 700, lineHeight: 1.25, padding: `${11 * k}px ${24 * k}px`, margin: `0 ${-24 * k}px` }}>{s.verdict}</div>
        </>
      );
      break;
    case "A09":
      body = (
        <>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 46%, rgba(16,24,32,0.55) 68%, rgba(16,24,32,0.92) 100%)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
            <Eyebrow text={s.eyebrow} bg={s.bg} k={k} />
            <div style={{ marginTop: "auto", fontFamily: DISPLAY, fontWeight: 800, fontSize: 27 * k, lineHeight: 1.08, letterSpacing: "-0.025em", textAlign: "left" }}>
              {s.hotWord ? s.caption.split(s.hotWord).flatMap((part, i) => i === 0 ? [part] : [<span key={i} style={{ color: DG.hot }}>{s.hotWord}</span>, part]) : s.caption}
            </div>
            <div style={{ fontSize: 11 * k, opacity: 0.72, marginTop: 10 * k }}>{s.micro}</div>
          </div>
        </>
      );
      break;
    case "A16":
      body = (
        <>
          <Eyebrow text={s.eyebrow} bg={s.bg} k={k} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20 * k, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12 * k }}>{s.headline}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 * k, marginBottom: 12 * k }}>
              {s.recap.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 9 * k, fontSize: 12 * k, fontWeight: 600, lineHeight: 1.25 }}>
                  <span style={{ width: 8 * k, height: 8 * k, background: DG.hot, flex: `0 0 ${8 * k}px`, marginTop: 4 * k }} />{r}
                </div>
              ))}
            </div>
            <div style={{ height: Math.max(1, k), background: c, opacity: 0.15, margin: `${2 * k}px 0 ${12 * k}px` }} />
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16 * k, letterSpacing: "-0.01em" }}>{s.cta1}</div>
            <div style={{ fontSize: 11.5 * k, opacity: 0.62, marginTop: 5 * k }}>{s.cta2}</div>
          </div>
        </>
      );
      break;
    case "A14":
      source = s.source;
      body = <div style={{ fontSize: 12 * k }}>{s.title}</div>;
      break;
  }

  return (
    <div ref={ref} style={base}>
      {body}
      <Furniture bg={s.bg} idx={idx} total={total} source={source} wordmark={wordmark} k={k} />
    </div>
  );
});
