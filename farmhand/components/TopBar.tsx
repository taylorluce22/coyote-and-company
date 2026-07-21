"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { NAV_DEFS } from "@/lib/data";
import QuickPanel from "@/components/QuickPanel";

const EXTRA_TITLES: Record<string, string> = { today: "Today", market: "Your Market", pipeline: "People" };

export default function TopBar() {
  const { state } = useStore();
  const strategy = state.strategy as { name?: string; homeBase?: string };
  const first = (strategy.name || "Taylor").split(" ")[0];
  const nav = NAV_DEFS.find((n) => n.id === state.tab);
  const title = nav?.label || EXTRA_TITLES[state.tab] || "Farmhand";

  const [clock, setClock] = useState("");
  useEffect(() => {
    const p = (x: number) => (x < 10 ? "0" : "") + x;
    const tick = () => { const d = new Date(); setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`); };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 22,
      }}
    >
      <div>
        <div className="fh-kicker" style={{ fontSize: 10 }}>
          Farmhand OS <span style={{ color: "#4a4756" }}>/</span> <span style={{ color: "#A6A4B8" }}>{title}</span>
        </div>
        <h1 className="fh-title fh-shimmer-text" style={{ fontSize: "clamp(22px, 3.4vw, 32px)", marginTop: 5 }}>
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <QuickPanel />
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#41D98A",
            background: "rgba(65,217,138,0.08)", border: "1px solid rgba(65,217,138,0.28)",
            borderRadius: 999, padding: "7px 13px", fontWeight: 600,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#41D98A", boxShadow: "0 0 8px #41D98A" }} />
          Agentic System Operational
        </div>
        <div
          className="fh-glass"
          style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "#A6A4B8", borderRadius: 8, padding: "8px 12px", letterSpacing: "0.06em" }}
          suppressHydrationWarning
        >
          {clock || "00:00:00"}
        </div>
        <div
          className="fh-glass"
          style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 999, padding: "7px 14px 7px 8px", fontSize: 13, fontWeight: 600 }}
        >
          <span
            style={{
              width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #A855F7, #38BDF8)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#0B0B16",
            }}
          >
            {first[0]?.toUpperCase() || "F"}
          </span>
          {strategy.name || "Taylor"} · {strategy.homeBase || "Arizona"}
        </div>
      </div>
    </div>
  );
}
