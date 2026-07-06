"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import { Switch, CountUp } from "@/components/ui";
import {
  TICKER_POOL,
  FARM_CHIPS,
  FARM_CLUSTERS,
  DASH_STATS,
  DASH_INTEL,
} from "@/lib/data";
import {
  fetchNeighborhoodFeed,
  feedTime,
  FEED_SOURCES,
  KIND_META,
  type FeedItem,
} from "@/lib/feeds";

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

function LiveActivity() {
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
        borderRadius: 14,
        padding: "14px 16px",
        background: "rgba(8,8,18,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
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
            style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11.5 }}
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

/** deterministic 7-day mini activity bars per neighborhood */
function MiniBars({ seedName, color, live }: { seedName: string; color: string; live: boolean }) {
  const bars = Array.from({ length: 7 }, (_, i) => {
    const seed = seedName.charCodeAt(i % seedName.length) + i * 17;
    return live ? 24 + (seed % 62) : 8 + (seed % 18);
  });
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 30, marginTop: 12 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${color}, ${color}44)`,
            transformOrigin: "bottom",
            animation: "fh-grow 0.6s cubic-bezier(0.22,1,0.36,1) both",
            animationDelay: `${(0.15 + i * 0.05).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

function StatusBadge({ live }: { live: boolean }) {
  return (
    <span
      style={{
        fontSize: 8.5,
        fontWeight: 800,
        letterSpacing: "0.08em",
        fontFamily: "var(--label)",
        color: live ? "#41D98A" : "#FFC23D",
        background: live ? "rgba(65,217,138,0.14)" : "rgba(255,194,61,0.14)",
        border: `1px solid ${live ? "rgba(65,217,138,0.4)" : "rgba(255,194,61,0.4)"}`,
        borderRadius: 999,
        padding: "3px 8px",
        backdropFilter: "blur(8px)",
      }}
    >
      {live ? "ACTIVE" : "QUIET"}
    </span>
  );
}

function NeighborhoodCard({
  cluster,
  onOpen,
}: {
  cluster: (typeof FARM_CLUSTERS)[number];
  onOpen: () => void;
}) {
  return (
    <div
      className="fh-card3d"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      style={{
        borderRadius: 15,
        overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${cluster.hex}36`,
        boxShadow: `0 16px 38px rgba(0,0,0,0.45), 0 6px 22px ${cluster.hex}1A, inset 0 1px 0 rgba(255,255,255,0.08)`,
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
      }}
    >
      {/* image header */}
      <div style={{ position: "relative", height: 108, background: `linear-gradient(160deg, ${cluster.hex}30, #0A0A14)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cluster.img}
          alt={cluster.name}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,6,13,0.05) 40%, rgba(6,6,13,0.88))" }} />
        <div style={{ position: "absolute", top: 9, right: 9 }}>
          <StatusBadge live={cluster.live} />
        </div>
        <div style={{ position: "absolute", left: 13, bottom: 9, display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: cluster.hex,
              boxShadow: `0 0 9px ${cluster.hex}`,
              animation: cluster.live ? "fh-pulse 2.4s ease infinite" : "none",
            }}
          />
          <span style={{ fontSize: 14.5, fontWeight: 700, color: "#F4F3F8", letterSpacing: "-0.01em", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
            {cluster.name}
          </span>
        </div>
      </div>

      {/* body */}
      <div style={{ padding: "11px 14px 13px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 11.5, color: "#A6A4B8", fontFamily: "var(--mono)" }}>{cluster.stat}</div>
        <MiniBars seedName={cluster.name} color={cluster.hex} live={cluster.live} />
        <div style={{ display: "flex", alignItems: "center", marginTop: 11 }}>
          <span style={{ fontSize: 10.5, color: "#77758C" }}>Open activity</span>
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: cluster.hex }}>→</span>
        </div>
      </div>
    </div>
  );
}

function NeighborhoodDetail({
  cluster,
  onBack,
}: {
  cluster: (typeof FARM_CLUSTERS)[number];
  onBack: () => void;
}) {
  const { set } = useStore();
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let dead = false;
    setItems(null);
    fetchNeighborhoodFeed(cluster.slug).then((rows) => {
      if (!dead) setItems(rows);
    });
    return () => {
      dead = true;
    };
  }, [cluster.slug]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fh-rise 0.3s ease both" }}>
      {/* banner */}
      <div style={{ position: "relative", height: 168, borderRadius: 15, overflow: "hidden", border: `1px solid ${cluster.hex}3D` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cluster.img}
          alt={cluster.name}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,6,13,0.16) 30%, rgba(6,6,13,0.9))" }} />
        <button
          onClick={onBack}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(8,8,18,0.66)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 8,
            color: "#D8D6E6",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            fontFamily: "var(--label)",
            padding: "7px 12px",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
          }}
        >
          ← ALL NEIGHBORHOODS
        </button>
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <StatusBadge live={cluster.live} />
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 13 }}>
          <div className="fh-title" style={{ fontSize: 26, textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
            {cluster.name}
          </div>
          <div style={{ fontSize: 12, color: "#C9C7D6", fontFamily: "var(--mono)", marginTop: 2 }}>{cluster.stat}</div>
        </div>
      </div>

      {/* sources — flips live per-source once accounts are connected */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        {FEED_SOURCES.map((s) => (
          <span
            key={s.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10.5,
              fontWeight: 700,
              color: s.connected ? s.color : "#77758C",
              background: "rgba(8,8,18,0.55)",
              border: `1px solid ${s.connected ? s.color + "55" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 999,
              padding: "5px 11px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: s.connected ? s.color : "#4A4860",
                boxShadow: s.connected ? `0 0 6px ${s.color}` : "none",
              }}
            />
            {s.label}
            {!s.connected && <span style={{ fontWeight: 600, color: "#5E5C72" }}>· not connected</span>}
          </span>
        ))}
        <button
          onClick={() => set({ tab: "settings" })}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: cluster.hex,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            padding: "5px 2px",
          }}
        >
          Connect accounts →
        </button>
      </div>

      {/* feed */}
      <div
        style={{
          borderRadius: 14,
          padding: "14px 16px",
          background: "rgba(8,8,18,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: cluster.hex,
              boxShadow: `0 0 7px ${cluster.hex}`,
              animation: "fh-pulse 2s ease infinite",
            }}
          />
          <span className="fh-kicker" style={{ fontSize: 9.5 }}>
            Your activity here
          </span>
          <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", fontFamily: "var(--label)", color: "#FFC23D" }}>
            DEMO FEED — GOES LIVE WHEN ACCOUNTS CONNECT
          </span>
        </div>

        {items === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 44, borderRadius: 10, background: "rgba(255,255,255,0.045)", animation: "fh-pulse 1.4s ease infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((it, i) => {
              const meta = KIND_META[it.kind];
              const t = feedTime(it.minsAgo);
              return (
                <div
                  key={it.id}
                  style={{
                    display: "flex",
                    gap: 11,
                    alignItems: "flex-start",
                    padding: "11px 2px",
                    borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.055)" : "none",
                    animation: "fh-rise 0.3s ease both",
                    animationDelay: `${i * 0.05}s`,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      color: meta.color,
                      background: `${meta.color}16`,
                      border: `1px solid ${meta.color}3D`,
                    }}
                  >
                    {meta.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: "#EDEBF6", lineHeight: 1.35 }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 2, lineHeight: 1.4 }}>{it.detail}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, fontFamily: "var(--mono)" }}>{t.rel}</div>
                    <div style={{ fontSize: 9.5, color: "#5E5C72", fontFamily: "var(--mono)", marginTop: 1 }}>
                      {t.clock} · {it.source}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: 9 }}>
        <button
          onClick={() => set({ tab: "content", contentTab: "studio" })}
          style={{
            flex: 1,
            background: `linear-gradient(180deg, ${cluster.hex}, ${cluster.hex}B8)`,
            color: "#0A0A14",
            border: "none",
            borderRadius: 10,
            padding: "10px 0",
            fontSize: 12.5,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: `0 8px 22px ${cluster.hex}55`,
          }}
        >
          Draft a post for {cluster.name} →
        </button>
        <button
          onClick={() => set({ tab: "content", contentTab: "week" })}
          style={{
            flex: 1,
            background: `${cluster.hex}12`,
            color: cluster.hex,
            border: `1px solid ${cluster.hex}44`,
            borderRadius: 10,
            padding: "10px 0",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Plan this week
        </button>
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
  const [selected, setSelected] = useState<string | null>(null);
  const selCluster = FARM_CLUSTERS.find((c) => c.slug === selected) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="fh-dashgrid">
        {/* YOUR FARM — one panel, 2D neighborhood cards */}
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "radial-gradient(1000px 600px at 60% -10%, #1B1832, #0A0A14 60%, #06060D)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
            padding: "22px 22px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span className="fh-kicker" style={{ fontSize: 10 }}>
                  Your Farm
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#41D98A", fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#41D98A", boxShadow: "0 0 8px #41D98A", animation: "fh-pulse 2s ease infinite" }} />
                  LIVE
                </span>
              </div>
              <div className="fh-title fh-shimmer-text" style={{ fontSize: 38, marginTop: 2 }}>
                Gilbert, AZ
              </div>
              <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 1 }}>
                6 neighborhoods · 8 groups · one presence
              </div>
            </div>

            {/* farm health */}
            <div
              style={{
                marginLeft: "auto",
                borderRadius: 12,
                padding: "10px 14px",
                background: "rgba(8,8,18,0.55)",
                border: "1px solid rgba(255,194,61,0.28)",
                maxWidth: 250,
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
          </div>

          {/* neighborhood cards ⇄ drill-in activity feed */}
          {selCluster ? (
            <NeighborhoodDetail cluster={selCluster} onBack={() => setSelected(null)} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(225px, 1fr))", gap: 12 }}>
              {FARM_CLUSTERS.map((cl) => (
                <NeighborhoodCard key={cl.slug} cluster={cl} onOpen={() => setSelected(cl.slug)} />
              ))}
            </div>
          )}

          {!selCluster && <LiveActivity />}

          {/* group chips */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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
              onClick={() => set({ tab: "content", contentTab: "queue" })}
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

          <RailCard glow="rgba(255,194,61,0.26)">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#FFC23D", fontSize: 16 }}>✦</span>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>
                Best times · auto-publish
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "#FFC23D",
                  background: "rgba(255,194,61,0.12)",
                  border: "1px solid rgba(255,194,61,0.4)",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                WEEK
              </span>
            </div>
            <div className="fh-title" style={{ fontSize: 15.5, marginTop: 10 }}>
              Weekly Planner
            </div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 6, lineHeight: 1.5 }}>
              Plan the whole week in one click, then auto-publish it.
            </div>
            <button
              onClick={() => set({ tab: "content", contentTab: "week" })}
              style={{
                width: "100%",
                marginTop: 14,
                background: "rgba(255,194,61,0.12)",
                color: "#FFC23D",
                border: "1px solid rgba(255,194,61,0.4)",
                borderRadius: 10,
                padding: "10px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open planner
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
              YOU
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
