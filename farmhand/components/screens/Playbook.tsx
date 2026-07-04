"use client";

import { useStore } from "@/lib/store";
import { MagneticButton } from "@/components/ui";
import { PLAYBOOK, SCOUT, IMG } from "@/lib/data";

export default function Playbook() {
  const { state, set, copy } = useStore();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20, alignItems: "start" }} className="fh-playgrid">
      {/* action cards */}
      <div style={{ minWidth: 0 }}>
        <div className="fh-kicker" style={{ marginBottom: 14 }}>
          We prep it · you stay human — ~90 seconds each
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PLAYBOOK.map((a, ai) => {
            const done = !!state.done[a.id];
            const copied = !!state.copied[a.id];
            return (
              <div
                key={a.id}
                style={{
                  backdropFilter: "blur(12px)",
                  background: "linear-gradient(160deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))",
                  border: `1px solid ${done ? "rgba(65,217,138,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 15,
                  padding: "17px 19px",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
                  opacity: done ? 0.72 : 1,
                  animation: `fh-rise .5s ease ${(0.05 + ai * 0.09).toFixed(2)}s both`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "var(--mono)", color: "#7DD3FC", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, padding: "3px 9px" }}>
                    {a.group}
                  </span>
                  <span style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "#8B89A0" }}>{a.members}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, fontFamily: "var(--label)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFC23D" }}>{a.why}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{a.title}</div>
                <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 220,
                      fontSize: 13.5,
                      lineHeight: 1.65,
                      color: "#D8D6E6",
                      whiteSpace: "pre-line",
                      background: "rgba(0,0,0,0.22)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 11,
                      padding: "13px 15px",
                    }}
                  >
                    {a.copyText}
                  </div>
                  <div
                    style={{
                      width: 96,
                      borderRadius: 11,
                      flexShrink: 0,
                      backgroundImage: `url(${IMG("fh-" + a.id, 200, 260)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <MagneticButton
                    onClick={() => {
                      copy(a.copyText);
                      set({ copied: { ...state.copied, [a.id]: true } });
                    }}
                    style={{
                      border: copied ? "1px solid rgba(56,189,248,0.4)" : "none",
                      borderRadius: 9,
                      padding: "9px 18px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: copied ? "rgba(56,189,248,0.16)" : "#38BDF8",
                      color: copied ? "#7DD3FC" : "#0B0B16",
                      boxShadow: copied ? "none" : "0 4px 18px rgba(56,189,248,0.4)",
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy post"}
                  </MagneticButton>
                  <a
                    href="https://facebook.com/groups"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 9,
                      padding: "9px 18px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#A6A4B8",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Open group ↗
                  </a>
                  <button
                    onClick={() => set({ done: { ...state.done, [a.id]: true } })}
                    style={{
                      borderRadius: 9,
                      padding: "9px 18px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: done ? "default" : "pointer",
                      background: done ? "rgba(65,217,138,0.16)" : "none",
                      color: done ? "#41D98A" : "#A6A4B8",
                      border: `1px solid ${done ? "rgba(65,217,138,0.4)" : "rgba(255,255,255,0.14)"}`,
                    }}
                  >
                    {done ? "Posted ✓" : "Mark posted"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* scout column */}
      <div style={{ minWidth: 0, position: "sticky", top: 20 }}>
        <div className="fh-kicker" style={{ marginBottom: 14 }}>Scout · Perplexity</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SCOUT.map((sc) => {
            const planned = !!state.planned[sc.id];
            return (
              <div key={sc.id} className="fh-glass" style={{ borderRadius: 14, padding: 15, borderLeft: `3px solid ${sc.color}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{sc.title}</div>
                <div style={{ fontSize: 11.5, color: "#8B89A0", marginTop: 6, lineHeight: 1.5 }}>{sc.note}</div>
                <button
                  onClick={() => set({ planned: { ...state.planned, [sc.id]: true } })}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    borderRadius: 8,
                    padding: "8px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: planned ? "default" : "pointer",
                    background: planned ? "rgba(65,217,138,0.14)" : "rgba(255,255,255,0.05)",
                    color: planned ? "#41D98A" : "#D8D6E6",
                    border: `1px solid ${planned ? "rgba(65,217,138,0.4)" : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  {planned ? "Added to plan ✓" : "Draft a post from this"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
