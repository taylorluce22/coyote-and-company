"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ORIGINS, STAGES, WARMTH_META, type Contact, type StageKey } from "@/lib/pipeline";

export default function Pipeline() {
  const { state, set } = useStore();
  const contacts = state.contacts as Contact[];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const move = (id: string, dir: 1 | -1) =>
    set((s) => ({
      contacts: (s.contacts as Contact[]).map((c) => {
        if (c.id !== id) return c;
        const idx = STAGES.findIndex((st) => st.key === c.stage);
        const next = Math.max(0, Math.min(STAGES.length - 1, idx + dir));
        return { ...c, stage: STAGES[next].key as StageKey };
      }),
    }));

  const add = () => {
    if (!name.trim()) return;
    const c: Contact = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      origin: "manual",
      stage: "discovered",
      warmth: "cold",
      note: note.trim() || "Added manually",
      lastTouch: "just now",
    };
    set((s) => ({ contacts: [c, ...(s.contacts as Contact[])] }));
    setName("");
    setNote("");
    setAdding(false);
  };

  const visibleStages = STAGES.filter((st) => st.key !== "closed" || contacts.some((c) => c.stage === "closed"));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#A6A4B8" }}>
          Every person, where they came from, and what happens next. Warmth = recency × who reached out × depth — the
          rules are visible, not a black box.
        </div>
        <button onClick={() => setAdding(!adding)} style={{ marginLeft: "auto", background: "rgba(255,194,61,0.12)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          {adding ? "Cancel" : "+ Add person"}
        </button>
      </div>

      {adding && (
        <div className="fh-glass" style={{ borderRadius: 13, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 9, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or @handle" style={{ flex: "1 1 180px", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context — where you met, what they need" style={{ flex: "2 1 260px", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }} />
          <button onClick={add} style={{ background: "linear-gradient(180deg,#FBBF24,#D97706)", color: "#1A1200", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            Add
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${visibleStages.length}, minmax(190px, 1fr))`, gap: 11, overflowX: "auto", paddingBottom: 6 }}>
        {visibleStages.map((st) => {
          const cards = contacts.filter((c) => c.stage === st.key);
          return (
            <div key={st.key} style={{ minWidth: 190 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
                <span className="fh-kicker" style={{ fontSize: 9 }}>{st.label}</span>
                <span style={{ fontSize: 10, color: "#5E5C72", fontFamily: "var(--mono)" }}>{cards.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 60 }}>
                {cards.map((c) => {
                  const w = WARMTH_META[c.warmth];
                  return (
                    <div key={c.id} className="fh-glass" style={{ borderRadius: 12, padding: "11px 13px", borderTop: `2px solid ${w.color}55` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#F4F3F8" }}>{c.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: w.color }}>{w.label}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 4, lineHeight: 1.45 }}>{c.note}</div>
                      <div style={{ fontSize: 9.5, color: "#5E5C72", marginTop: 6, fontFamily: "var(--mono)" }}>
                        via {c.origin}{c.territory ? ` · ${c.territory}` : ""} · {c.lastTouch}
                        {c.nextTouch && <span style={{ color: "#FFC23D" }}> · next: {c.nextTouch}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                        <button onClick={() => move(c.id, -1)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#8B89A0", borderRadius: 6, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>←</button>
                        <button onClick={() => move(c.id, 1)} style={{ background: `${st.color}14`, border: `1px solid ${st.color}44`, color: st.color, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>advance →</button>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <div style={{ borderRadius: 11, border: "1px dashed rgba(255,255,255,0.08)", padding: "14px 10px", fontSize: 10.5, color: "#4A4860", textAlign: "center" }}>
                    empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, fontSize: 10.5, color: "#5E5C72", lineHeight: 1.6 }}>
        Origins tracked: {ORIGINS.join(" · ")}. Engagements you log in Engage can be promoted to contacts here — the
        pipeline fills itself from participation, not purchased lists.
      </div>
    </div>
  );
}
