"use client";

import { useStore } from "@/lib/store";
import { CountUp, MagneticButton } from "@/components/ui";
import { RESULTS_STATS, RESULTS_LOG } from "@/lib/data";
import { capturedAtLabel, type Opportunity } from "@/lib/engage";
import type { Contact } from "@/lib/pipeline";
import type { PlannedPost } from "@/lib/planner";

export default function Results() {
  const { state, set } = useStore();
  const demo = state.demoMode as boolean;
  const opps = (state.opportunities as Opportunity[]) || [];
  const contacts = (state.contacts as Contact[]) || [];
  const plannedPosts = (state.plannedPosts as PlannedPost[]) || [];
  const engaged = opps.filter((o) => o.status === "engaged");
  const heroValue = demo ? 9 : opps.length + state.resLogged;
  const stats = demo
    ? RESULTS_STATS
    : [
        { value: String(plannedPosts.filter((p) => p.plannedDay).length), label: "Posts planned", sub: "this week", color: "#FF5D8F" },
        { value: String(engaged.length), label: "Replies posted", sub: "logged in Engage", color: "#26E0C8" },
        { value: String(contacts.length), label: "People in pipeline", sub: "all stages", color: "#FFC23D" },
        { value: String(contacts.filter((c) => c.warmth === "warm" || c.warmth === "hot").length), label: "Warm right now", sub: "warmth bands", color: "#41D98A" },
      ];
  const log = [
    ...(state.resLogged > 0
      ? [{ channel: "NEW", note: "Logged just now — add a detail later", when: "now", col: "#41D98A" }]
      : []),
    ...(demo
      ? RESULTS_LOG
      : engaged.map((o) => ({ channel: o.sourceName.slice(0, 18), note: o.excerpt.slice(0, 90), when: capturedAtLabel(o), col: "#26E0C8" }))),
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
        <div className="fh-kicker">{demo ? "Inbound conversations · this month" : "Real conversations + leads · all time"}</div>
        <div className="fh-title" style={{ fontSize: 84, color: "#41D98A", textShadow: "0 0 40px rgba(65,217,138,0.4)", lineHeight: 1, margin: "10px 0" }}>
          <CountUp value={heroValue} />
        </div>
        <div style={{ fontSize: 14, color: "#A6A4B8" }}>
          {demo ? "Your hero number — the only one that pays the bills." : "Started from zero — every count here is something you actually did."}
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {stats.map((s) => (
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
        {log.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#77758C", padding: "10px 4px" }}>
            Empty — and honest. Post a reply in Engage or hit “Log a lead” and it shows up here.
          </div>
        )}
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
