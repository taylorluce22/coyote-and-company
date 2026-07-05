"use client";

import { useStore } from "@/lib/store";

const TITLES: Record<string, string> = {
  dashboard: "Good morning, Jess",
  engine: "Content Engine",
  composer: "Composer",
  planner: "Weekly Planner",
  directory: "Active Groups",
  assistant: "Reply Assistant",
  results: "Results",
  settings: "Settings",
};

export default function TopBar() {
  const { state } = useStore();
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
          {TITLES[state.tab]}
        </h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            J
          </span>
          Jess · Gilbert, AZ
        </div>
      </div>
    </div>
  );
}
