"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import { Switch, CountUp } from "@/components/ui";
import FarmScene from "@/components/FarmScene";
import {
  TICKER_POOL,
  FARM_CHIPS,
  FARM_CLUSTERS,
  DASH_STATS,
  DASH_INTEL,
} from "@/lib/data";

function Sparkline() {
  return (
    <svg viewBox="0 0 120 40" style={{ width: "100%", height: 40, marginTop: 8 }}>
      <polyline
        points="0,32 15,26 30,28 45,18 60,22 75,12 90,16 105,6 120,10"
        fill="none"
        stroke="#41D98A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="300"
        style={{ animation: "fh-draw 1.6s ease both" }}
      />
    </svg>
  );
}

function Ticker() {
  const [off, setOff] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setOff((o) => o + 1);
      requestAnimationFrame(() => {
        if (rowRef.current)
          gsap.from(rowRef.current, { y: -12, opacity: 0, duration: 0.5, ease: "back.out(1.8)" });
      });
    }, 3600);
    return () => clearInterval(t);
  }, []);
  const rows = Array.from({ length: 4 }, (_, i) => TICKER_POOL[(off + i) % TICKER_POOL.length]);
  return (
    <div
      style={{
        position: "absolute",
        top: 62,
        right: 18,
        width: 244,
        borderRadius: 14,
        padding: "12px 13px",
        zIndex: 3,
        background: "rgba(8,8,18,0.62)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#41D98A",
            boxShadow: "0 0 7px #41D98A",
            animation: "fh-pulse 2s ease infinite",
          }}
        />
        <span className="fh-kicker" style={{ fontSize: 9.5 }}>
          Live Activity
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((r, i) => (
          <div
            key={`${off}-${i}`}
            ref={i === 0 ? rowRef : undefined}
            style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11 }}
          >
            <span style={{ color: r.color, flexShrink: 0, fontSize: 10 }}>{r.icon}</span>
            <span style={{ color: "#C9C7D6", lineHeight: 1.35, flex: 1 }}>{r.text}</span>
            <span style={{ color: "#5E5C72", fontFamily: "var(--mono)", fontSize: 9.5 }}>{r.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* isometric self-contained map (Live Map view) */
function IsoMap() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div className="fh-hero" style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "54%",
            width: 0,
            height: 0,
            transform: "translate(-50%,-50%) scale(0.92)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 520,
              height: 480,
              transform: "translate(-50%,-50%) rotateX(57deg) rotateZ(-42deg)",
              transformStyle: "preserve-3d",
            }}
          >
            {FARM_CLUSTERS.map((b, i) => (
              <div
                key={b.name}
                style={{
                  position: "absolute",
                  left: [42, 272, 262, 84, 300][i],
                  top: [66, 38, 186, 242, 322][i],
                  width: [182, 152, 128, 164, 172][i],
                  height: [126, 108, 92, 118, 128][i],
                  background: `linear-gradient(135deg, ${b.hex}2E, ${b.hex}0F)`,
                  border: `1px solid ${b.hex}66`,
                  borderRadius: 12,
                  transform: "translateZ(30px)",
                  transformStyle: "preserve-3d",
                  boxShadow: `18px 18px 0 rgba(2,6,23,0.55), 0 0 34px ${b.hex}26`,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: b.live ? b.hex : "#FFC23D",
                    boxShadow: `0 0 10px ${b.hex}`,
                    animation: b.live ? "fh-marker 2.6s ease infinite" : undefined,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 8,
                    bottom: 8,
                    transform: "rotateZ(42deg) rotateX(-57deg) scale(1.2)",
                    transformOrigin: "left bottom",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    whiteSpace: "nowrap",
                    color: "#F4F3F8",
                    background: "rgba(5,5,12,0.78)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 9,
                    padding: "6px 10px",
                    lineHeight: 1.25,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {b.name}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: "var(--mono)",
                      color: b.hex,
                    }}
                  >
                    {b.stat}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RailCard({
  children,
  glow,
  style,
}: {
  children: React.ReactNode;
  glow: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="fh-card3d"
      style={{
        borderRadius: 16,
        padding: 18,
        background: "linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: `0 22px 50px rgba(0,0,0,0.55), 0 10px 34px ${glow}, inset 0 1px 0 rgba(255,255,255,0.16)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { state, set } = useStore();
  const is3D = state.heroView === "3d";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="fh-dashgrid">
        {/* HERO */}
        <div
          className="fh-hero"
          style={{
            position: "relative",
            minHeight: 560,
            borderRadius: 22,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "radial-gradient(1000px 600px at 60% -10%, #1B1832, #0A0A14 60%, #06060D)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
          }}
        >
          {is3D ? <FarmScene /> : <IsoMap />}

          {/* header (decorative — never blocks scene interaction) */}
          <div style={{ position: "absolute", top: 20, left: 22, zIndex: 3, pointerEvents: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="fh-kicker" style={{ fontSize: 10 }}>
                Your Farm
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#41D98A", fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#41D98A", boxShadow: "0 0 8px #41D98A", animation: "fh-pulse 2s ease infinite" }} />
                LIVE
              </span>
            </div>
            <div
              className="fh-title fh-shimmer-text"
              style={{ fontSize: 42, marginTop: 4 }}
            >
              Gilbert, AZ
            </div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 2 }}>
              5 neighborhoods · 8 groups · one presence
            </div>
          </div>

          {/* toggle — anchored above the ticker in one clean control column */}
          <div
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              zIndex: 3,
              display: "flex",
              gap: 2,
              background: "rgba(8,8,18,0.62)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 9,
              padding: 3,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <button
              onClick={() => set({ heroView: "3d" })}
              style={{
                border: "none",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                fontFamily: "var(--label)",
                cursor: "pointer",
                background: is3D ? "rgba(168,85,247,0.22)" : "transparent",
                color: is3D ? "#C9A8FF" : "#8B89A0",
              }}
            >
              3D FARM
            </button>
            <button
              onClick={() => set({ heroView: "map" })}
              style={{
                border: "none",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                fontFamily: "var(--label)",
                cursor: "pointer",
                background: !is3D ? "rgba(56,189,248,0.22)" : "transparent",
                color: !is3D ? "#7DD3FC" : "#8B89A0",
              }}
            >
              LIVE MAP
            </button>
          </div>

          <Ticker />

          {/* farm health HUD */}
          <div
            style={{
              position: "absolute",
              bottom: 62,
              left: 20,
              zIndex: 3,
              borderRadius: 12,
              padding: "11px 14px",
              background: "rgba(8,8,18,0.62)",
              border: "1px solid rgba(255,194,61,0.28)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              boxShadow: "0 14px 34px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)",
              maxWidth: 250,
              animation: "fh-float2 11s ease-in-out infinite",
              pointerEvents: "none",
            }}
          >
            <div className="fh-kicker" style={{ fontSize: 9, color: "#FFC23D" }}>
              Farm Health
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 3 }}>6/8 groups active</div>
            <div style={{ fontSize: 11, color: "#E8B563", marginTop: 2 }}>
              Power Ranch quiet 3 weeks — action queued
            </div>
          </div>

          {/* group chips */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
              padding: "34px 18px 13px",
              background: "linear-gradient(transparent, rgba(6,6,13,0.92))",
              pointerEvents: "none",
            }}
          >
            {FARM_CHIPS.map((c) => (
              <span
                key={c.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#C9C7D6",
                  background: "rgba(8,8,18,0.55)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "5px 11px",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
                {c.name}
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "#77758C" }}>{c.note}</span>
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RailCard glow="rgba(168,85,247,0.3)" style={{ ["--_glow" as string]: "rgba(168,85,247,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>
                Autopilot · Claude
              </div>
              <Switch on={state.autopilotOn} color="#A855F7" onToggle={() => set({ autopilotOn: !state.autopilotOn })} label="Autopilot" />
            </div>
            <div className="fh-title" style={{ fontSize: 15.5, marginTop: 10 }}>
              Content Engine
            </div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 6, lineHeight: 1.5 }}>
              4 posts waiting for approval — IG, FB, Nextdoor.
            </div>
            <button
              onClick={() => set({ tab: "engine" })}
              style={{
                width: "100%",
                marginTop: 14,
                background: "linear-gradient(180deg,#C084FC,#9333EA)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 22px rgba(147,51,234,0.5)",
              }}
            >
              Open engine
            </button>
          </RailCard>

          <RailCard glow="rgba(56,189,248,0.28)">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#38BDF8", fontSize: 16 }}>✦</span>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>
                You, prepped · 90 sec
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "#7DD3FC",
                  background: "rgba(56,189,248,0.14)",
                  border: "1px solid rgba(56,189,248,0.4)",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                HUMAN
              </span>
            </div>
            <div className="fh-title" style={{ fontSize: 15.5, marginTop: 10 }}>
              Local Playbook
            </div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 6, lineHeight: 1.5 }}>
              Groups ban robots. That&apos;s why this works.
            </div>
            <button
              onClick={() => set({ tab: "playbook" })}
              style={{
                width: "100%",
                marginTop: 14,
                background: "rgba(56,189,248,0.14)",
                color: "#7DD3FC",
                border: "1px solid rgba(56,189,248,0.4)",
                borderRadius: 10,
                padding: "10px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open playbook
            </button>
          </RailCard>

          <RailCard glow="rgba(65,217,138,0.28)">
            <div className="fh-kicker" style={{ fontSize: 9.5 }}>
              Inbound conversations
            </div>
            <div
              className="fh-title"
              style={{ fontSize: 44, color: "#41D98A", textShadow: "0 0 24px rgba(65,217,138,0.5)", marginTop: 4 }}
            >
              <CountUp value={44} />
            </div>
            <div style={{ fontSize: 12.5, color: "#A6A4B8" }}>this month · +4 vs June</div>
            <Sparkline />
          </RailCard>

          <RailCard glow="rgba(168,85,247,0.18)">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>
                This week · Perplexity
              </div>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "#41D98A", fontWeight: 700 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#41D98A", boxShadow: "0 0 6px #41D98A" }} />
                LIVE
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DASH_INTEL.map((it) => (
                <div key={it.title} style={{ borderLeft: `2px solid ${it.color}`, paddingLeft: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)", color: it.color }}>{it.tag}</span>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 2, lineHeight: 1.4 }}>{it.angle}</div>
                </div>
              ))}
            </div>
          </RailCard>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {DASH_STATS.map((s) => (
          <div
            key={s.label}
            className="fh-glass"
            style={{ borderRadius: 15, padding: "16px 18px", borderTop: `1px solid ${s.color}33` }}
          >
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: "#6E6C82", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* presence activity chart */}
      <div className="fh-glass" style={{ borderRadius: 16, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="fh-kicker">Presence Activity · Last 30 days</div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#A6A4B8" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: "#A855F7" }} />
              AUTOPILOT
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: "#38BDF8" }} />
              PLAYBOOK
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
          {Array.from({ length: 30 }, (_, i) => {
            const h = 22 + ((i * 47) % 71);
            const col = (i * 31) % 5 < 2 ? "#38BDF8" : "#A855F7";
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: `${h}%`,
                  borderRadius: "4px 4px 2px 2px",
                  background: `linear-gradient(180deg, ${col}, ${col}55)`,
                  transformOrigin: "bottom",
                  animation: `fh-grow 0.7s cubic-bezier(0.22,1,0.36,1) both`,
                  animationDelay: `${(0.3 + i * 0.03).toFixed(2)}s`,
                  boxShadow: `0 0 10px ${col}2E`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
