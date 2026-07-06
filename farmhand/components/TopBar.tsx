"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import QuickPanel from "@/components/QuickPanel";

const TITLES: Record<string, string> = {
  today: "",
  content: "Content",
  market: "Your Market",
  engage: "Engage",
  pipeline: "People",
  insights: "Insights",
  settings: "Settings",
};

export default function TopBar() {
  const { state } = useStore();
  const strategy = state.strategy as { name?: string; homeBase?: string };
  const first = (strategy.name || "there").split(" ")[0];
  const title = state.tab === "today" ? `Good morning, ${first}` : TITLES[state.tab];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div>
        <div className="fh-kicker" style={{ letterSpacing: "0.14em" }}>
          Friday, July 3
        </div>
        <h1
          className="fh-title fh-shimmer-text"
          style={{ fontSize: "clamp(26px, 4vw, 38px)", marginTop: 6 }}
        >
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <QuickPanel />
        {state.streak > 0 && (
          <div
            className="fh-glass"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "9px 15px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#FF9A62",
                boxShadow: "0 0 8px #FF9A62",
              }}
            />
            {state.streak}-day streak
          </div>
        )}
        <div
          className="fh-glass"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            borderRadius: 999,
            padding: "7px 14px 7px 8px",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #A855F7, #38BDF8)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#0B0B16",
            }}
          >
            {first[0]?.toUpperCase() || "F"}
          </span>
          {strategy.name || "You"} · {strategy.homeBase || "Arizona"}
        </div>
      </div>
    </div>
  );
}
