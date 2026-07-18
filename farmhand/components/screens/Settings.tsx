"use client";

import { cleanSlate, restoreDemo, useStore, WORKSPACES } from "@/lib/store";
import { Switch } from "@/components/ui";
import { SET_VOICE, SET_IMG_PREFS, SET_CONNECTIONS } from "@/lib/data";
import type { StrategyProfile } from "@/lib/strategy";
import type { LeadTraining } from "@/lib/hunt";
import { VERTICALS, verticalOf, type VerticalId } from "@/lib/verticals";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fh-glass" style={{ borderRadius: 16, padding: 20 }}>
      <div className="fh-kicker" style={{ marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, on, color, onToggle }: { label: string; on: boolean; color: string; onToggle: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ flex: 1, fontSize: 13.5, color: "#D8D6E6" }}>{label}</span>
      <Switch on={on} color={color} onToggle={onToggle} label={label} />
    </div>
  );
}

export default function Settings() {
  const { state, set, workspace, switchWorkspace } = useStore();
  const get = (k: string, def: boolean) => (state[k] != null ? (state[k] as boolean) : def);
  const strategy = state.strategy as StrategyProfile;
  const activeVertical = verticalOf(strategy.vertical).id;

  const switchVertical = (id: VerticalId) => {
    if (id === activeVertical) return;
    const v = VERTICALS[id];
    set((s) => ({
      strategy: { ...(s.strategy as StrategyProfile), vertical: id },
      // the engine's training is vertical-specific — carrying realtor guidance
      // and thumbs history into solar (or back) would steer the hunt wrong,
      // so switching resets it to the new vertical's defaults
      leadTraining: {
        ...(s.leadTraining as LeadTraining),
        guidance: v.defaultGuidance,
        intents: v.defaultIntents,
        good: [],
        bad: [],
        minScore: id === "solar" ? 35 : 55,
      },
    }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
      <Card title="Accounts">
        <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 12 }}>
          Switch between the realtor test user and your real solar business. Each account keeps its own profile,
          engine training, inbox, and pipeline — nothing is shared between them.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {WORKSPACES.map((w) => {
            const on = w.id === workspace;
            return (
              <button
                key={w.id}
                onClick={() => switchWorkspace(w.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: on ? "default" : "pointer", background: on ? (w.id === "solar" ? "linear-gradient(180deg,#FFC23D,#D97706)" : "linear-gradient(180deg,#2DD4BF,#0D9488)") : "rgba(255,255,255,0.05)", color: on ? "#04110E" : "#A6A4B8", border: on ? "none" : "1px solid rgba(255,255,255,0.12)", textAlign: "left" }}
              >
                <span style={{ fontSize: 17 }}>{w.emoji}</span>
                <span style={{ flex: 1 }}>{w.label}</span>
                {on && <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }}>ACTIVE</span>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 10, lineHeight: 1.5 }}>
          The solar account starts clean — no demo data, solar engine training, Instagram-first. Every number in it
          is earned.
        </div>
      </Card>

      <Card title="Lead engine vertical">
        <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 12 }}>
          Which business the lead engine hunts for. Switching changes the intents, search phrasing, and relevance
          rules — and resets the engine&apos;s Teach training to the new vertical&apos;s defaults (your inbox is kept).
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(Object.keys(VERTICALS) as VerticalId[]).map((id) => {
            const v = VERTICALS[id];
            const on = id === activeVertical;
            return (
              <button
                key={id}
                onClick={() => switchVertical(id)}
                style={{ flex: 1, padding: "12px 10px", borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: on ? "default" : "pointer", background: on ? (id === "solar" ? "linear-gradient(180deg,#FFC23D,#D97706)" : "linear-gradient(180deg,#2DD4BF,#0D9488)") : "rgba(255,255,255,0.05)", color: on ? "#04110E" : "#A6A4B8", border: on ? "none" : "1px solid rgba(255,255,255,0.12)" }}
              >
                {id === "solar" ? "☀️ " : "🏠 "}{v.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 10, lineHeight: 1.5 }}>
          Active: hunting for <b style={{ color: "#A6A4B8" }}>{verticalOf(strategy.vertical).label.toLowerCase()}</b> leads
          in {strategy.territories.map((t) => t.name).slice(0, 3).join(", ")}.
        </div>
      </Card>

      <Card title="Voice profile">
        {SET_VOICE.map((v) => {
          const key = "voice_" + v.key;
          const on = get(key, v.def);
          return <Row key={v.key} label={v.label} on={on} color="#FF9A62" onToggle={() => set({ [key]: !on })} />;
        })}
      </Card>

      <Card title="Brokerage & legal">
        {[
          { label: "BROKERAGE", value: "Desert Sky Realty" },
          { label: "LICENSE #", value: "AZ-SA-6841029" },
        ].map((c) => (
          <div key={c.label} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="fh-kicker" style={{ fontSize: 9.5 }}>{c.label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{c.value}</div>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0 2px" }}>
          <span style={{ flex: 1, fontSize: 13.5, color: "#D8D6E6" }}>Fair-housing footer</span>
          <Switch on={get("fairHousing", true)} color="#41D98A" onToggle={() => set({ fairHousing: !get("fairHousing", true) })} label="Fair-housing footer" />
        </div>
      </Card>

      <Card title="Image preferences">
        {SET_IMG_PREFS.map((p) => {
          const key = "img_" + p.key;
          const on = get(key, p.def);
          return <Row key={p.key} label={p.label} on={on} color="#8B89A0" onToggle={() => set({ [key]: !on })} />;
        })}
      </Card>

      <Card title="Strategy">
        <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 6 }}>
          Your dashboard, content themes, engagement pace and territory watchlist are all built from your strategy
          intake. Re-run it anytime — answers update everything.
        </div>
        <div style={{ fontSize: 11.5, color: "#D8D6E6", marginBottom: 12 }}>
          {(state.strategy as { territories?: { name: string }[] })?.territories?.map((t) => t.name).join(" · ") || "No territories set"}
        </div>
        <button
          onClick={() => set({ onboarded: false })}
          style={{
            background: "rgba(168,85,247,0.12)",
            color: "#C9A8FF",
            border: "1px solid rgba(168,85,247,0.4)",
            borderRadius: 9,
            padding: "9px 18px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Re-run strategy session →
        </button>
      </Card>

      <Card title="Data">
        <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 6 }}>
          {state.demoMode
            ? "You're looking at example data (streak, pipeline people, stats). Clear it and the app runs on real activity only — proof it works as intended."
            : "Clean mode is on — every number in the app comes from something you actually did."}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: state.demoMode ? "#FFC23D" : "#41D98A", marginBottom: 12 }}>
          {state.demoMode ? "● EXAMPLE DATA VISIBLE" : "● 100% REAL DATA"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {state.demoMode ? (
            <button
              onClick={() => { if (window.confirm("Clear all example data? Streak, demo pipeline, planned posts and demo stats reset to zero. Your strategy profile, image library and captured conversations are kept.")) set(cleanSlate()); }}
              style={{ background: "rgba(255,93,143,0.12)", color: "#FF5D8F", border: "1px solid rgba(255,93,143,0.4)", borderRadius: 9, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Clear example data — start clean
            </button>
          ) : (
            <button
              onClick={() => set(restoreDemo())}
              style={{ background: "rgba(255,255,255,0.05)", color: "#A6A4B8", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Restore example data (for demos)
            </button>
          )}
        </div>
      </Card>

      <Card title="Connections">
        {SET_CONNECTIONS.map((c) => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ flex: 1, fontSize: 13.5, color: "#D8D6E6" }}>{c.name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: c.color }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, boxShadow: `0 0 7px ${c.color}` }} />
              {c.status}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
