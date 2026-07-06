"use client";

import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";
import Composer from "./Composer";
import Planner from "./Planner";
import ContentEngine from "./ContentEngine";
import { ideasFor } from "@/lib/strategy";
import type { StrategyProfile } from "@/lib/strategy";

function Ideas() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const ideas = ideasFor(strategy);

  return (
    <div>
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
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: idea.territory.hex, textTransform: "uppercase" }}>
              {idea.territory.name} · {idea.territory.segment}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#F4F3F8", marginTop: 7, lineHeight: 1.4 }}>{idea.title}</div>
            <div style={{ fontSize: 12, color: "#8B89A0", marginTop: 6, lineHeight: 1.5 }}>{idea.angle}</div>
            <button
              onClick={() => set({ contentTab: "studio" })}
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
          { id: "queue" as const, label: "Queue" },
        ]}
        active={tab}
        color="#FF5D8F"
        onPick={(id) => set({ contentTab: id })}
      />
      {tab === "ideas" ? <Ideas /> : tab === "studio" ? <Composer /> : tab === "week" ? <Planner /> : <ContentEngine />}
    </div>
  );
}
