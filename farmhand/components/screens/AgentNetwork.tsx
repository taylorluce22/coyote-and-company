"use client";

import { AGENTS, AGENT_STATUS_STYLE } from "@/lib/agentOs";

/**
 * Agent Network — the CEO/Orchestrator command layer coordinating six
 * specialist roles. Mirrors the brain vault's agent roster.
 */
export default function AgentNetwork() {
  const orchestrator = AGENTS[0];
  const specialists = AGENTS.slice(1);
  const oStatus = AGENT_STATUS_STYLE[orchestrator.status];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <span className="fh-kicker" style={{ fontSize: 10 }}>Agent Network</span>
        <span
          style={{
            marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#7dd3fc",
            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)",
            borderRadius: 999, padding: "5px 12px",
          }}
        >
          7 agents · 1 command layer
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 22 }}>
        One command brain coordinating six specialist roles. The Orchestrator is owner-paused — specialists run on
        manual passes until the content is dialed in.
      </p>

      {/* Command card */}
      <div
        className="fh-glass"
        style={{
          borderRadius: 20, padding: "24px 26px", marginBottom: 26, position: "relative",
          display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap",
          background: "radial-gradient(90% 130% at 8% 0%, rgba(168,85,247,0.16), transparent 55%), rgba(255,255,255,0.045)",
          border: "1px solid rgba(168,85,247,0.35)",
        }}
      >
        <div
          style={{
            width: 54, height: 54, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center",
            fontSize: 24, color: "#0B0B16", background: "linear-gradient(150deg,#c084fc,#7dd3fc)",
            boxShadow: "0 8px 24px rgba(168,85,247,0.4)",
          }}
        >
          {orchestrator.glyph}
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <div
            style={{
              display: "inline-block", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "#0B0B16", background: oStatus.color, padding: "3px 9px", borderRadius: 999, fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {orchestrator.statusLabel}
          </div>
          <h2 className="fh-title" style={{ fontSize: 24, margin: "0 0 3px" }}>CEO / Orchestrator</h2>
          <div className="fh-kicker" style={{ fontSize: 9.5, color: "#7dd3fc", marginBottom: 9 }}>{orchestrator.role}</div>
          <div style={{ fontSize: 12.5, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "46ch" }}>{orchestrator.desc}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "14px 28px" }}>
          {[
            ["Specialists", "6"], ["Vault reads", "27"], ["Queue", "5"], ["Model", "Claude Opus"],
          ].map(([l, n]) => (
            <div key={l}>
              <div className="fh-kicker" style={{ fontSize: 8.5 }}>{l}</div>
              <div
                style={{
                  fontSize: l === "Model" ? 14 : 22, fontWeight: 750, marginTop: 2,
                  fontFamily: l === "Model" ? "var(--mono)" : "inherit",
                  color: l === "Model" ? "#7dd3fc" : "#F4F3F8",
                }}
              >
                {n}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Specialists */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {specialists.map((a, i) => {
          const s = AGENT_STATUS_STYLE[a.status];
          return (
            <div
              key={a.id}
              className="fh-glass fh-card3d"
              style={{ borderRadius: 16, padding: 17, animation: "fh-rise 0.3s ease both", animationDelay: `${i * 0.04}s` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 16,
                    flexShrink: 0, color: a.color, background: `${a.color}1E`, border: `1px solid ${a.color}44`,
                  }}
                >
                  {a.glyph}
                </span>
                <span
                  style={{
                    marginLeft: "auto", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase",
                    padding: "3px 8px", borderRadius: 999, color: s.color, background: s.bg,
                  }}
                >
                  {a.statusLabel}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 16, color: "#F4F3F8", letterSpacing: "-0.01em" }}>{a.id}</h3>
              <div className="fh-kicker" style={{ fontSize: 8.5, marginTop: 3 }}>{a.role}</div>
              <div style={{ fontSize: 11.5, color: "#8B89A0", lineHeight: 1.5, marginTop: 8 }}>{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
