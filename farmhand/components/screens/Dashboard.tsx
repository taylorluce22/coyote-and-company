"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Switch, CountUp } from "@/components/ui";
import { DASH_STATS, DASH_INTEL } from "@/lib/data";
import { deriveActions, presenceScore } from "@/lib/actions";
import { pulseFor } from "@/lib/signals";
import { DAYS } from "@/lib/planner";
import type { StrategyProfile } from "@/lib/strategy";
import type { Opportunity } from "@/lib/engage";
import type { Contact } from "@/lib/pipeline";
import type { PlannedPost } from "@/lib/planner";
import { WARMTH_META } from "@/lib/pipeline";

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

function RailCard({ children, glow, style }: { children: React.ReactNode; glow: string; style?: React.CSSProperties }) {
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

/** Presence Score chip + expandable transparent breakdown. */
function Presence() {
  const { state, set } = useStore();
  const [open, setOpen] = useState(false);
  const { score, parts } = presenceScore(state);
  const weakest = [...parts].sort((a, b) => a.value - b.value)[0];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(8,8,18,0.6)",
          border: "1px solid rgba(168,85,247,0.35)",
          borderRadius: 12,
          padding: "10px 16px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 800, color: "#C9A8FF", textShadow: "0 0 18px rgba(168,85,247,0.5)" }}>
          {score}
        </span>
        <span style={{ textAlign: "left" }}>
          <span className="fh-kicker" style={{ fontSize: 8.5, display: "block" }}>Presence Score</span>
          <span style={{ fontSize: 10, color: "#8B89A0" }}>{open ? "hide breakdown" : "see breakdown"}</span>
        </span>
      </button>
      {open && (
        <div className="fh-glass" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, borderRadius: 14, padding: "15px 17px", zIndex: 10, animation: "fh-pop 0.2s ease both" }}>
          {parts.map((p) => (
            <div key={p.key} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: "#D8D6E6", fontWeight: 700 }}>{p.label}</span>
                <span style={{ marginLeft: "auto", color: "#8B89A0", fontFamily: "var(--mono)" }}>
                  {Math.round(p.value * 100)} · ×{p.weight}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }}>
                <div style={{ width: `${p.value * 100}%`, height: "100%", borderRadius: 3, background: p.key === weakest.key ? "#FFC23D" : "#A855F7" }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#FFC23D", lineHeight: 1.5, marginTop: 12 }}>
            <b>Best next move:</b> {weakest.tip}
          </div>
          <button
            onClick={() => { setOpen(false); set(weakest.key === "hygiene" ? { tab: "pipeline" } : weakest.key === "consistency" ? { tab: "content", contentTab: "week" } : { tab: "engage" }); }}
            style={{ marginTop: 10, width: "100%", background: "rgba(255,194,61,0.12)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 8, padding: "8px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            Do it now →
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const opps = (state.opportunities as Opportunity[]) || [];
  const contacts = (state.contacts as Contact[]) || [];
  const planned = (state.plannedPosts as PlannedPost[]) || [];
  const actions = deriveActions(state);
  const pulse = pulseFor(strategy.territories, 3);

  const warm = contacts.filter((c) => c.warmth === "warm" || c.warmth === "hot").length;
  const due = contacts.filter((c) => c.nextTouch === "today" || c.nextTouch === "tomorrow").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="fh-dashgrid">
        {/* COMMAND CENTER */}
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "radial-gradient(1000px 600px at 60% -10%, #1B1832, #0A0A14 60%, #06060D)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
            padding: "22px 22px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span className="fh-kicker" style={{ fontSize: 10 }}>Your Farm</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#41D98A", fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#41D98A", boxShadow: "0 0 8px #41D98A", animation: "fh-pulse 2s ease infinite" }} />
                  LIVE
                </span>
              </div>
              <div className="fh-title fh-shimmer-text" style={{ fontSize: 34, marginTop: 2 }}>
                {strategy.homeBase || "Your Market"}
              </div>
              <div style={{ fontSize: 12.5, color: "#A6A4B8", marginTop: 1 }}>
                {strategy.territories.length} territories · {actions.length} action{actions.length === 1 ? "" : "s"} waiting
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Presence />
            </div>
          </div>

          {/* NEXT ACTIONS */}
          <div>
            <div className="fh-kicker" style={{ fontSize: 9.5, marginBottom: 9 }}>Next actions</div>
            {actions.length === 0 ? (
              <div style={{ borderRadius: 13, border: "1px dashed rgba(65,217,138,0.3)", padding: "18px 16px", fontSize: 12.5, color: "#41D98A" }}>
                ✓ Queue clear — everything urgent is handled. Check the pulse below for what to talk about next.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {actions.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      borderRadius: 13,
                      padding: "12px 14px",
                      background: "rgba(8,8,18,0.5)",
                      border: `1px solid ${a.color}30`,
                      borderLeft: `3px solid ${a.color}`,
                      animation: "fh-rise 0.3s ease both",
                      animationDelay: `${i * 0.05}s`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F3F8", lineHeight: 1.35 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 2, lineHeight: 1.4 }}>{a.detail}</div>
                    </div>
                    <button
                      onClick={() => set(a.go as Record<string, unknown>)}
                      style={{ flexShrink: 0, background: `${a.color}14`, color: a.color, border: `1px solid ${a.color}4D`, borderRadius: 9, padding: "8px 15px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      {a.cta} →
                    </button>
                    <button
                      onClick={() => set((s) => ({ doneActions: { ...(s.doneActions as Record<string, boolean>), [a.id]: true } }))}
                      title="Mark done"
                      style={{ flexShrink: 0, background: "transparent", color: "#5E5C72", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, width: 32, height: 32, fontSize: 13, cursor: "pointer" }}
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TERRITORIES */}
          <div>
            <div className="fh-kicker" style={{ fontSize: 9.5, marginBottom: 9 }}>Territories</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {strategy.territories.map((t) => {
                const open = opps.filter((o) => o.territory === t.name && o.status !== "skipped").length;
                return (
                  <div
                    key={t.slug}
                    role="button"
                    tabIndex={0}
                    onClick={() => set({ tab: "market", marketSel: t.slug })}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && set({ tab: "market", marketSel: t.slug })}
                    className="fh-card3d"
                    style={{ position: "relative", borderRadius: 13, overflow: "hidden", height: 92, border: `1px solid ${t.hex}36`, cursor: "pointer", background: `linear-gradient(160deg, ${t.hex}26, #0A0A14)` }}
                  >
                    {t.img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.img} alt={t.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    )}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,6,13,0.1) 30%, rgba(6,6,13,0.92))" }} />
                    <span style={{ position: "absolute", top: 7, right: 8, fontSize: 8, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "var(--label)", color: t.hex, background: "rgba(8,8,18,0.66)", border: `1px solid ${t.hex}55`, borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>
                      {t.segment}
                    </span>
                    <div style={{ position: "absolute", left: 11, bottom: 8, right: 11 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F3F8", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{t.name}</div>
                      <div style={{ fontSize: 9.5, color: open ? "#26E0C8" : "#77758C", marginTop: 1 }}>
                        {open ? `${open} open conversation${open > 1 ? "s" : ""}` : "no live conversations"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MARKET PULSE */}
          <div>
            <div className="fh-kicker" style={{ fontSize: 9.5, marginBottom: 9 }}>Market pulse</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pulse.map((sg) => (
                <div key={sg.id} style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "10px 13px", background: "rgba(8,8,18,0.45)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: sg.color, boxShadow: `0 0 7px ${sg.color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#EDEBF6" }}>
                      <span style={{ color: sg.color, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", marginRight: 7 }}>{sg.territoryName.toUpperCase()}</span>
                      {sg.headline}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 2 }}>{sg.detail} · <i style={{ color: "#A6A4B8" }}>{sg.angle}</i></div>
                  </div>
                  <button
                    onClick={() => set({ tab: "content", contentTab: "ideas" })}
                    style={{ flexShrink: 0, background: `${sg.color}12`, color: sg.color, border: `1px solid ${sg.color}44`, borderRadius: 8, padding: "6px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    Make content →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* WEEK STRIP + PIPELINE SNAPSHOT */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => set({ tab: "content", contentTab: "week" })}
              style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "11px 14px", background: "rgba(8,8,18,0.45)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", textAlign: "left" }}
            >
              <span className="fh-kicker" style={{ fontSize: 9 }}>This week</span>
              <span style={{ display: "flex", gap: 6 }}>
                {DAYS.map((d) => {
                  const has = planned.some((p) => p.plannedDay === d.id);
                  return (
                    <span key={d.id} title={d.label} style={{ width: 11, height: 11, borderRadius: "50%", background: has ? "#41D98A" : "rgba(255,255,255,0.1)", boxShadow: has ? "0 0 7px rgba(65,217,138,0.6)" : "none" }} />
                  );
                })}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#8B89A0" }}>
                {planned.filter((p) => p.plannedDay).length}/{strategy.postingTarget} planned →
              </span>
            </button>
            <button
              onClick={() => set({ tab: "pipeline" })}
              style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 10, borderRadius: 12, padding: "11px 14px", background: "rgba(8,8,18,0.45)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", textAlign: "left" }}
            >
              <span className="fh-kicker" style={{ fontSize: 9 }}>Pipeline</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: WARMTH_META.warm.color }}>{warm} warm</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: due ? "#FF5D8F" : "#8B89A0" }}>
                {due ? `${due} follow-up${due > 1 ? "s" : ""} due` : "no follow-ups due"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#8B89A0" }}>open →</span>
            </button>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RailCard glow="rgba(168,85,247,0.3)">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>Autopilot · Claude</div>
              <Switch on={state.autopilotOn} color="#A855F7" onToggle={() => set({ autopilotOn: !state.autopilotOn })} label="Autopilot" />
            </div>
            <div className="fh-title" style={{ fontSize: 15.5, marginTop: 10 }}>Content Engine</div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 6, lineHeight: 1.5 }}>
              4 posts waiting for approval — IG, FB, Nextdoor.
            </div>
            <button
              onClick={() => set({ tab: "content", contentTab: "queue" })}
              style={{ width: "100%", marginTop: 14, background: "linear-gradient(180deg,#C084FC,#9333EA)", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 22px rgba(147,51,234,0.5)" }}
            >
              Open queue
            </button>
          </RailCard>

          <RailCard glow="rgba(255,194,61,0.26)">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#FFC23D", fontSize: 16 }}>✦</span>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>Best times · auto-publish</div>
              <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: "#FFC23D", background: "rgba(255,194,61,0.12)", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 999, padding: "2px 8px" }}>WEEK</span>
            </div>
            <div className="fh-title" style={{ fontSize: 15.5, marginTop: 10 }}>Weekly Planner</div>
            <div style={{ fontSize: 13, color: "#A6A4B8", marginTop: 6, lineHeight: 1.5 }}>
              Plan the whole week in one click, then auto-publish it.
            </div>
            <button
              onClick={() => set({ tab: "content", contentTab: "week" })}
              style={{ width: "100%", marginTop: 14, background: "rgba(255,194,61,0.12)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Open planner
            </button>
          </RailCard>

          <RailCard glow="rgba(65,217,138,0.28)">
            <div className="fh-kicker" style={{ fontSize: 9.5 }}>Inbound conversations</div>
            <div className="fh-title" style={{ fontSize: 44, color: "#41D98A", textShadow: "0 0 24px rgba(65,217,138,0.5)", marginTop: 4 }}>
              <CountUp value={44} />
            </div>
            <div style={{ fontSize: 12.5, color: "#A6A4B8" }}>this month · +4 vs June</div>
            <Sparkline />
          </RailCard>

          <RailCard glow="rgba(168,85,247,0.18)">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="fh-kicker" style={{ fontSize: 9.5 }}>This week · Perplexity</div>
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
          <div key={s.label} className="fh-glass" style={{ borderRadius: 15, padding: "16px 18px", borderTop: `1px solid ${s.color}33` }}>
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
