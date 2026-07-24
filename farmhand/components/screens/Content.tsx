"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";
import Composer from "./Composer";
import Planner from "./Planner";
import ContentEngine from "./ContentEngine";
import ReelCoach from "./ReelCoach";
import { ideasFor } from "@/lib/strategy";
import Performance from "@/components/Performance";
import type { StrategyProfile } from "@/lib/strategy";
import { verticalOf } from "@/lib/verticals";
import { offNarrative } from "@/lib/narrative";

const UTILITY_COLOR: Record<string, string> = { APS: "#FFC23D", SRP: "#26E0C8", both: "#C9A8FF", general: "#8B89A0" };
const INTEL_TTL_MS = 12 * 60 * 60 * 1000; // refresh live intel twice a day

/**
 * Live energy intel — real, current news (APS/SRP rates, data-center demand,
 * grid infrastructure, national solar policy) pulled from national + local
 * sources and turned into homeowner-facing post angles. Solar vertical only;
 * APS customers are the primary audience, SRP second.
 */
function EnergyIntel() {
  const { state, set, copy } = useStore();
  const intel = state.energyIntel as { fetchedAt: number; items: { headline: string; summary: string; source: string; url: string; date: string; utility: string; angle: string }[] } | null;
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const fetching = useRef(false);

  const refresh = async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    try {
      const d = await fetch("/api/discover?mode=intel").then((r) => r.json());
      if (Array.isArray(d.items) && d.items.length) {
        set({ energyIntel: { fetchedAt: Date.now(), items: d.items } });
      }
    } catch {}
    setLoading(false);
    fetching.current = false;
  };

  // ON-DEMAND ONLY: no auto-fetch — a search runs only when Refresh is
  // clicked. Cached intel from the last pull still renders immediately.
  const stale = intel ? Date.now() - intel.fetchedAt > INTEL_TTL_MS : false;
  const ageH = intel ? Math.round((Date.now() - intel.fetchedAt) / 3600000) : null;

  // Editorial narrative gate applied at render too, so off-narrative angles
  // persisted before the gate existed (reassurance framing: "threat removed",
  // "saving households $X/yr") never surface again. See lib/narrative.ts.
  const items = intel ? intel.items.filter((it) => !offNarrative(it.angle)) : [];

  return (
    <div className="fh-glass" style={{ borderRadius: 14, padding: "15px 17px", marginBottom: 18, border: "1px solid rgba(255,194,61,0.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FFC23D", boxShadow: "0 0 8px #FFC23D", animation: loading ? "fh-pulse 1s ease infinite" : "fh-pulse 2.4s ease infinite" }} />
        <span className="fh-kicker" style={{ fontSize: 9.5 }}>Live intel · AZ energy</span>
        <span style={{ fontSize: 10.5, color: "#8B89A0" }}>
          {loading
            ? "Scanning national + local energy news…"
            : intel
            ? `APS & SRP rates · data centers · grid · policy — updated ${ageH === 0 ? "just now" : `${ageH}h ago`}${stale ? " · hit Refresh for today's" : ""}`
            : "Hit Refresh to pull real news → post angles (searches only on demand)"}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ marginLeft: "auto", background: "rgba(255,194,61,0.1)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer" }}
        >
          {loading ? "Scanning…" : "↻ Refresh"}
        </button>
      </div>

      {intel && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
          {items.map((it, i) => {
            const uc = UTILITY_COLOR[it.utility] || UTILITY_COLOR.general;
            return (
              <div key={`${it.url}-${i}`} style={{ padding: "11px 13px", background: "rgba(0,0,0,0.24)", borderRadius: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: "#04110E", background: uc, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase" }}>
                    {it.utility}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#EDEBF6", lineHeight: 1.4 }}>{it.headline}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#A6A4B8", marginTop: 5, lineHeight: 1.5 }}>{it.summary}</div>
                <div style={{ fontSize: 11, color: "#FFC23D", marginTop: 6, lineHeight: 1.45 }}>→ Post angle: {it.angle}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
                  <span style={{ fontSize: 9.5, color: "#5E5C72", fontFamily: "var(--mono)" }}>{it.source}{it.date ? ` · ${it.date}` : ""}</span>
                  <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#7DD3FC", textDecoration: "none", fontFamily: "var(--mono)" }}>read ↗</a>
                  <button
                    onClick={() => { copy(`${it.headline}\n\nPost angle: ${it.angle}\n\nSource: ${it.url}`); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1400); }}
                    style={{ marginLeft: "auto", background: "rgba(38,224,200,0.1)", color: "#26E0C8", border: "1px solid rgba(38,224,200,0.35)", borderRadius: 7, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    {copiedIdx === i ? "Copied ✓" : "Copy angle"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {intel && items.length === 0 && !loading && (
        <div style={{ fontSize: 11.5, color: "#77758C", marginTop: 10 }}>No fresh intel this cycle — try a refresh in a few hours.</div>
      )}

      <div style={{ fontSize: 10, color: "#5E5C72", marginTop: 10, lineHeight: 1.5 }}>
        Sourced live from national and local coverage — utility rate cases, ACC decisions, data-center buildout,
        grid capacity, and solar policy. Posting about what&apos;s actually happening is what makes a local account
        the authority.
      </div>
    </div>
  );
}

function Ideas() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const ideas = ideasFor(strategy);
  const isSolar = verticalOf(strategy.vertical).id === "solar";

  return (
    <div>
      {isSolar && <EnergyIntel />}
      <div style={{ fontSize: 13, color: "#A6A4B8", marginBottom: 16, lineHeight: 1.5 }}>
        Generated from your strategy profile — {strategy.territories.map((t) => t.name).join(" · ")} ·{" "}
        {strategy.positioning.join(" + ")} positioning. Pick one and it opens in the Studio.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {ideas.map((idea, i) => (
          <div
            key={idea.id}
            className="fh-glass fh-card3d"
            style={{ borderRadius: 14, padding: "16px 17px", borderLeft: `3px solid ${idea.territory.hex}`, animation: "fh-rise 0.3s ease both", animationDelay: `${i * 0.03}s` }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: idea.territory.hex, textTransform: "uppercase" }}>
                {idea.territory.name}
              </span>
              <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: "#7DD3FC", background: "rgba(125,211,252,0.1)", border: "1px solid rgba(125,211,252,0.35)", borderRadius: 999, padding: "2px 8px", textTransform: "uppercase" }}>
                {idea.format}
              </span>
              <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: "#C9A8FF", background: "rgba(201,168,255,0.1)", border: "1px solid rgba(201,168,255,0.35)", borderRadius: 999, padding: "2px 8px", textTransform: "uppercase" }}>
                {idea.theme}
              </span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#F4F3F8", marginTop: 7, lineHeight: 1.4 }}>{idea.title}</div>
            <div style={{ fontSize: 12, color: "#8B89A0", marginTop: 6, lineHeight: 1.5 }}>{idea.angle}</div>
            <button
              onClick={() => set({ contentTab: "studio", compIdea: idea, compRegen: false, compShort: false })}
              style={{
                marginTop: 13,
                background: `${idea.territory.hex}14`,
                color: idea.territory.hex,
                border: `1px solid ${idea.territory.hex}44`,
                borderRadius: 9,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open in Studio →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Content() {
  const { state, set } = useStore();
  const tab = state.contentTab;

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "ideas" as const, label: "Ideas" },
          { id: "studio" as const, label: "Studio" },
          { id: "week" as const, label: "Week" },
          { id: "queue" as const, label: state.demoMode ? "Queue" : "Performance" },
          { id: "reels" as const, label: "Reel Coach" },
        ]}
        active={tab}
        color="#FF5D8F"
        onPick={(id) => set({ contentTab: id })}
      />
      {tab === "ideas" ? <Ideas /> : tab === "studio" ? <Composer /> : tab === "week" ? <Planner /> : tab === "reels" ? <ReelCoach /> : state.demoMode ? <ContentEngine /> : <Performance />}
    </div>
  );
}
