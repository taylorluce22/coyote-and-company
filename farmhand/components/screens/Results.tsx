"use client";

import { useStore } from "@/lib/store";
import { CountUp, MagneticButton } from "@/components/ui";
import { RESULTS_STATS, RESULTS_LOG } from "@/lib/data";

export default function Results() {
  const { state, set } = useStore();
  const log = [
    ...(state.resLogged > 0
      ? [{ channel: "NEW", note: "Logged just now — add a detail later", when: "now", col: "#41D98A" }]
      : []),
    ...RESULTS_LOG,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* hero number */}
      <div
        className="fh-glass"
        style={{
          borderRadius: 20,
          padding: "40px 32px",
          textAlign: "center",
          background: "radial-gradient(600px 300px at 50% -20%, rgba(65,217,138,0.14), rgba(255,255,255,0.03))",
        }}
      >
        <div className="fh-kicker">Inbound conversations · this month</div>
        <div className="fh-title" style={{ fontSize: 84, color: "#41D98A", textShadow: "0 0 40px rgba(65,217,138,0.4)", lineHeight: 1, margin: "10px 0" }}>
          <CountUp value={9} />
        </div>
        <div style={{ fontSize: 14, color: "#A6A4B8" }}>Your hero number — the only one that pays the bills.</div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {RESULTS_STATS.map((s) => (
          <div key={s.label} className="fh-glass" style={{ borderRadius: 15, padding: "18px 20px" }}>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: "#6E6C82", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* lead log */}
      <div className="fh-glass" style={{ borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="fh-kicker">Lead log · quick add</div>
          <MagneticButton
            onClick={() => set({ resLogged: state.resLogged + 1 })}
            style={{
              marginLeft: "auto",
              background: "#41D98A",
              color: "#0B0B16",
              border: "none",
              borderRadius: 9,
              padding: "8px 16px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(65,217,138,0.4)",
            }}
          >
            + Log a lead
          </MagneticButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {log.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: i < log.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "var(--mono)", color: l.col, background: `${l.col}1A`, border: `1px solid ${l.col}44`, borderRadius: 5, padding: "3px 8px", whiteSpace: "nowrap" }}>{l.channel}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: "#D8D6E6" }}>{l.note}</span>
              <span style={{ fontSize: 11.5, color: "#6E6C82", fontFamily: "var(--mono)" }}>{l.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
