"use client";

import { AGENTS, AGENT_STATUS_STYLE, MEMORY_LAYER, type AgentDef } from "@/lib/agentOs";

/**
 * Agent Network — one AI chief of staff coordinating five specialists on a
 * shared memory layer. Each specialist shows its role, model, tools, and
 * the flow it runs. Mirrors Taylor's agentic-OS architecture.
 */

function Chips({ items, color }: { items: string[]; color: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((t) => (
        <span
          key={t}
          style={{
            fontSize: 9.5, fontFamily: "var(--mono)", letterSpacing: "0.02em", color,
            background: `${color}14`, border: `1px solid ${color}3A`, borderRadius: 7, padding: "3px 8px",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function SpecialistCard({ a, i }: { a: AgentDef; i: number }) {
  const s = AGENT_STATUS_STYLE[a.status];
  return (
    <div
      className="fh-glass"
      style={{
        borderRadius: 16, padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 12,
        animation: "fh-rise 0.3s ease both", animationDelay: `${i * 0.04}s`,
        borderTop: `2px solid ${a.color}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0,
            color: a.color, background: `${a.color}1E`, border: `1px solid ${a.color}44`,
          }}
        >
          {a.glyph}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16.5, color: "#F4F3F8", letterSpacing: "-0.01em" }}>{a.id}</h3>
          <div className="fh-kicker" style={{ fontSize: 8.5, marginTop: 2 }}>{a.role}</div>
        </div>
        <span style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, color: s.color, background: s.bg, flexShrink: 0 }}>
          {a.statusLabel}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "#A6A4B8", lineHeight: 1.5 }}>{a.desc}</div>

      <Chips items={a.tools} color={a.color} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
        {a.flow.map((step, n) => (
          <div key={n} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span
              style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: 6, display: "grid", placeItems: "center",
                fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: a.color,
                background: `${a.color}16`, border: `1px solid ${a.color}30`, marginTop: 1,
              }}
            >
              {n + 1}
            </span>
            <span style={{ fontSize: 11.5, color: "#C6C3D4", lineHeight: 1.4 }}>{step}</span>
          </div>
        ))}
      </div>

      {a.output && (
        <div
          style={{
            fontSize: 10.5, color: a.color, background: `${a.color}12`, border: `1px solid ${a.color}2E`,
            borderRadius: 9, padding: "7px 10px", marginTop: 2, lineHeight: 1.4,
          }}
        >
          → {a.output}
        </div>
      )}
      {a.tagline && (
        <div style={{ fontSize: 11, color: "#8B89A0", fontStyle: "italic", marginTop: "auto", paddingTop: 4 }}>
          &ldquo;{a.tagline}&rdquo;
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 9, marginTop: 2 }}>
        <span className="fh-kicker" style={{ fontSize: 8 }}>Model</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#D8D6E6" }}>{a.model}</span>
      </div>
    </div>
  );
}

export default function AgentNetwork() {
  const ceo = AGENTS[0];
  const specialists = AGENTS.slice(1);
  const cStatus = AGENT_STATUS_STYLE[ceo.status];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span className="fh-kicker" style={{ fontSize: 10 }}>Agent Network</span>
        <span
          style={{
            marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#7dd3fc",
            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 999, padding: "5px 12px",
          }}
        >
          {specialists.length} specialists · 1 chief of staff
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "74ch", marginTop: 0, marginBottom: 22 }}>
        One AI chief of staff coordinating five specialists on a shared memory layer. You manage one conversation —
        every agent reports here, reads from the same memory, and writes back to it.
      </p>

      {/* CEO command card */}
      <div
        className="fh-glass"
        style={{
          borderRadius: 20, padding: "24px 26px", marginBottom: 24, display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap",
          background: "radial-gradient(90% 130% at 8% 0%, rgba(168,85,247,0.16), transparent 55%), rgba(255,255,255,0.045)",
          border: "1px solid rgba(168,85,247,0.35)",
        }}
      >
        <div
          style={{
            width: 54, height: 54, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 24, color: "#0B0B16",
            background: "linear-gradient(150deg,#c084fc,#7dd3fc)", boxShadow: "0 8px 24px rgba(168,85,247,0.4)",
          }}
        >
          {ceo.glyph}
        </div>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ display: "inline-block", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0B0B16", background: cStatus.color, padding: "3px 9px", borderRadius: 999, fontWeight: 700, marginBottom: 10 }}>
            {ceo.statusLabel}
          </div>
          <h2 className="fh-title" style={{ fontSize: 24, margin: "0 0 3px" }}>CEO / Orchestrator</h2>
          <div className="fh-kicker" style={{ fontSize: 9.5, color: "#7dd3fc", marginBottom: 9 }}>My AI Chief of Staff</div>
          <div style={{ fontSize: 12.5, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "48ch" }}>{ceo.desc}</div>
          <div style={{ fontSize: 11.5, color: "#8B89A0", fontStyle: "italic", marginTop: 8 }}>&ldquo;{ceo.tagline}&rdquo;</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "14px 30px" }}>
          {[
            ["Specialists", String(specialists.length)], ["Routes", "111"], ["Reads", "154"], ["Model", ceo.model],
          ].map(([l, n]) => (
            <div key={l}>
              <div className="fh-kicker" style={{ fontSize: 8.5 }}>{l}</div>
              <div style={{ fontSize: l === "Model" ? 13 : 22, fontWeight: 750, marginTop: 2, fontFamily: l === "Model" ? "var(--mono)" : "inherit", color: l === "Model" ? "#7dd3fc" : "#F4F3F8" }}>{n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* specialists */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))", gap: 14, marginBottom: 24 }}>
        {specialists.map((a, i) => (
          <SpecialistCard key={a.id} a={a} i={i} />
        ))}
      </div>

      {/* shared memory layer */}
      <div
        className="fh-glass"
        style={{
          borderRadius: 18, padding: "20px 22px",
          background: "radial-gradient(80% 130% at 92% 0%, rgba(65,217,138,0.12), transparent 55%), rgba(255,255,255,0.04)",
          border: "1px solid rgba(65,217,138,0.28)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#41D98A", boxShadow: "0 0 10px #41D98A" }} />
          <h3 style={{ margin: 0, fontSize: 16, color: "#F4F3F8" }}>Shared Memory Layer</h3>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "#7BE495", background: "rgba(123,228,149,0.12)", border: "1px solid rgba(123,228,149,0.3)", borderRadius: 999, padding: "3px 10px" }}>Supabase</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "70ch", marginBottom: 14 }}>
          Every agent reads from this and writes back to it. Nothing gets re-explained. Everything compounds.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MEMORY_LAYER.map((m) => (
            <span key={m} style={{ fontSize: 11.5, color: "#C6C3D4", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "8px 12px" }}>{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
