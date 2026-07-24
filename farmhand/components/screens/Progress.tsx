"use client";

import { useEffect, useState } from "react";
import { LAUNCH_PLAN, loadChecks, saveChecks, type LaunchItem, type LaunchPhase } from "@/lib/launchPlan";

/**
 * Launch Progress — the build's road to launch as a living checklist, distilled
 * from the agent briefs. Phase 1 items are locked-done (shipped in PR #135);
 * everything else is checked off as the Taylor Solar test period → efficiency
 * build → launch gates get cleared. Checks persist globally (build progress,
 * not client data).
 */

function itemDone(it: LaunchItem, checks: Record<string, boolean>): boolean {
  return !!it.shipped || !!checks[it.id];
}

function phaseStats(p: LaunchPhase, checks: Record<string, boolean>) {
  const done = p.items.filter((it) => itemDone(it, checks)).length;
  return { done, total: p.items.length, pct: p.items.length ? done / p.items.length : 0 };
}

export default function Progress() {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChecks(loadChecks());
    setReady(true);
  }, []);

  const toggle = (it: LaunchItem) => {
    if (it.shipped) return; // shipped items are locked
    setChecks((c) => {
      const next = { ...c, [it.id]: !c[it.id] };
      saveChecks(next);
      return next;
    });
  };

  const allItems = LAUNCH_PLAN.flatMap((p) => p.items);
  const doneCount = allItems.filter((it) => itemDone(it, checks)).length;
  const overallPct = Math.round((doneCount / allItems.length) * 100);

  // current phase = first phase with an unfinished item; next action = its first open item
  const currentPhase = LAUNCH_PLAN.find((p) => p.items.some((it) => !itemDone(it, checks)));
  const nextItem = currentPhase?.items.find((it) => !itemDone(it, checks));

  // completion ring geometry
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div style={{ maxWidth: 880 }}>
      {/* header: ring + status */}
      <div className="fh-glass" style={{ borderRadius: 18, padding: "22px 26px", marginBottom: 22, display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", border: "1px solid rgba(65,217,138,0.22)" }}>
        <div style={{ position: "relative", width: 124, height: 124, flexShrink: 0 }}>
          <svg width="124" height="124" viewBox="0 0 124 124" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="62" cy="62" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
            <circle
              cx="62" cy="62" r={R} fill="none"
              stroke="url(#fh-launch-grad)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={ready ? C * (1 - overallPct / 100) : C}
              style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
            <defs>
              <linearGradient id="fh-launch-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#41D98A" />
                <stop offset="55%" stopColor="#FFC23D" />
                <stop offset="100%" stopColor="#E8622C" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ textAlign: "center", lineHeight: 1 }}>
              <div style={{ fontSize: 27, fontWeight: 800, color: "#F4F3F8", fontFamily: "var(--mono)" }}>{overallPct}%</div>
              <div className="fh-kicker" style={{ fontSize: 7.5, marginTop: 4 }}>to launch</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="fh-kicker" style={{ fontSize: 10 }}>Road to launch · {doneCount}/{allItems.length} cleared</div>
          <h2 className="fh-title" style={{ fontSize: 22, margin: "7px 0 4px" }}>
            {currentPhase ? currentPhase.title : "Ready to launch 🎉"}
          </h2>
          <div style={{ fontSize: 12.5, color: "#8B89A0", lineHeight: 1.5, maxWidth: "58ch" }}>
            {currentPhase ? currentPhase.goal : "Every gate is cleared. Onboard the first paying client."}
          </div>
          {nextItem && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginTop: 12, background: "rgba(255,194,61,0.09)", border: "1px solid rgba(255,194,61,0.35)", borderRadius: 999, padding: "7px 15px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FFC23D", boxShadow: "0 0 8px #FFC23D", animation: "fh-pulse 2s ease infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFC23D" }}>Next up: {nextItem.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* phase timeline */}
      <div style={{ position: "relative", paddingLeft: 30 }}>
        <div style={{ position: "absolute", left: 10, top: 8, bottom: 8, width: 2, background: "linear-gradient(180deg, #41D98A, #FFC23D 40%, #E8622C 70%, #7DD3FC)", opacity: 0.35, borderRadius: 2 }} />

        {LAUNCH_PLAN.map((p, pi) => {
          const s = phaseStats(p, checks);
          const complete = s.done === s.total;
          const isCurrent = currentPhase?.id === p.id;
          return (
            <div key={p.id} style={{ position: "relative", marginBottom: 18 }}>
              {/* timeline node */}
              <div
                style={{
                  position: "absolute", left: -27, top: 22, width: 18, height: 18, borderRadius: "50%",
                  background: complete ? p.color : "rgba(10,10,22,0.9)",
                  border: `2px solid ${p.color}`,
                  boxShadow: isCurrent ? `0 0 14px ${p.color}AA` : complete ? `0 0 8px ${p.color}66` : "none",
                  display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, color: "#04110E",
                }}
              >
                {complete ? "✓" : ""}
              </div>

              <div
                className="fh-glass"
                style={{
                  borderRadius: 16, padding: "18px 20px",
                  border: `1px solid ${isCurrent ? p.color + "55" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: isCurrent ? `0 14px 40px rgba(0,0,0,0.4), 0 0 30px ${p.color}14` : undefined,
                  animation: "fh-rise 0.35s ease both", animationDelay: `${pi * 0.06}s`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="fh-kicker" style={{ fontSize: 9, color: p.color }}>{p.kicker}</span>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#F4F3F8" }}>{p.title}</span>
                  {isCurrent && (
                    <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: "0.09em", color: "#04110E", background: p.color, borderRadius: 999, padding: "3px 10px", textTransform: "uppercase" }}>
                      You are here
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontFamily: "var(--mono)", color: complete ? p.color : "#8B89A0", fontWeight: 700 }}>
                    {s.done}/{s.total}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "#8B89A0", margin: "6px 0 12px", lineHeight: 1.5 }}>{p.goal}</div>

                {/* phase progress bar */}
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 13 }}>
                  <div style={{ width: ready ? `${Math.round(s.pct * 100)}%` : 0, height: "100%", background: `linear-gradient(90deg, ${p.color}, ${p.color}AA)`, boxShadow: `0 0 10px ${p.color}66`, transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)", transitionDelay: `${pi * 0.08}s` }} />
                </div>

                {/* items */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {p.items.map((it) => {
                    const done = itemDone(it, checks);
                    return (
                      <button
                        key={it.id}
                        onClick={() => toggle(it)}
                        title={it.shipped ? "Shipped in PR #135 — locked" : done ? "Click to un-check" : "Click to check off"}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 11, width: "100%", textAlign: "left",
                          padding: "9px 11px", borderRadius: 10, border: "1px solid",
                          borderColor: done ? `${p.color}30` : "rgba(255,255,255,0.07)",
                          background: done ? `${p.color}0C` : "rgba(255,255,255,0.025)",
                          cursor: it.shipped ? "default" : "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: 19, height: 19, borderRadius: 6, flexShrink: 0, marginTop: 1,
                            display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900,
                            color: "#04110E",
                            background: done ? p.color : "transparent",
                            border: `1.5px solid ${done ? p.color : "rgba(255,255,255,0.25)"}`,
                            boxShadow: done ? `0 0 8px ${p.color}55` : "none",
                          }}
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span style={{ lineHeight: 1.35, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: done ? "#D8D6E6" : "#C8C6D8", textDecoration: done && !it.shipped ? "none" : "none" }}>
                            {it.label}
                            {it.shipped && (
                              <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: "0.07em", color: p.color, background: `${p.color}18`, border: `1px solid ${p.color}40`, borderRadius: 999, padding: "2px 7px", marginLeft: 8, textTransform: "uppercase", verticalAlign: "1px" }}>
                                Shipped
                              </span>
                            )}
                          </span>
                          {it.note && <span style={{ display: "block", fontSize: 10.5, color: "#77758C", marginTop: 2, lineHeight: 1.45 }}>{it.note}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* launch node */}
        <div style={{ position: "relative", paddingBottom: 6 }}>
          <div
            style={{
              position: "absolute", left: -27, top: 4, width: 18, height: 18, borderRadius: "50%",
              background: overallPct === 100 ? "#A855F7" : "rgba(10,10,22,0.9)", border: "2px solid #A855F7",
              boxShadow: overallPct === 100 ? "0 0 16px #A855F7AA" : "none",
            }}
          />
          <div style={{ fontSize: 13.5, fontWeight: 800, color: overallPct === 100 ? "#C084FC" : "#5E5C72", letterSpacing: "0.04em", paddingTop: 3 }}>
            🚀 LAUNCH — open the doors to paying clients
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 18, lineHeight: 1.5, maxWidth: "70ch" }}>
        Distilled from the agent briefs — the Dev audit (docs/dev-brief-first-revenue-slice.md), the strategy brief,
        and the first-client playbook (docs/first-client-playbook.md). Phase 1 is locked (merged in PR #135); check
        the rest off as they clear. Progress is saved in this browser.
      </div>
    </div>
  );
}
