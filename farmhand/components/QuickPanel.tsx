"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Contact } from "@/lib/pipeline";
import type { Opportunity } from "@/lib/engage";
import type { StrategyProfile } from "@/lib/strategy";
import { ideasFor } from "@/lib/strategy";

/**
 * ⌘K-style quick layer: search across people, territories, conversations,
 * notes and ideas — plus quick-add person / log conversation / new post.
 */
export default function QuickPanel() {
  const { state, set } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else setQ("");
  }, [open]);

  const strategy = state.strategy as StrategyProfile;
  const contacts = (state.contacts as Contact[]) || [];
  const opps = (state.opportunities as Opportunity[]) || [];
  const needle = q.trim().toLowerCase();

  type Hit = { kind: string; color: string; label: string; sub: string; go: () => void };
  const hits: Hit[] = [];
  if (needle.length >= 2) {
    contacts
      .filter((c) => c.name.toLowerCase().includes(needle) || c.note.toLowerCase().includes(needle) || c.notes.some((n) => n.t.toLowerCase().includes(needle)))
      .slice(0, 5)
      .forEach((c) => hits.push({ kind: "person", color: "#FFC23D", label: c.name, sub: c.note.slice(0, 60), go: () => set({ tab: "pipeline" }) }));
    strategy.territories
      .filter((t) => t.name.toLowerCase().includes(needle))
      .slice(0, 3)
      .forEach((t) => hits.push({ kind: "territory", color: t.hex, label: t.name, sub: `${t.segment} · open hub`, go: () => set({ tab: "market", marketSel: t.slug }) }));
    opps
      .filter((o) => o.excerpt.toLowerCase().includes(needle) || o.sourceName.toLowerCase().includes(needle))
      .slice(0, 4)
      .forEach((o) => hits.push({ kind: "conversation", color: "#26E0C8", label: o.sourceName, sub: o.excerpt.slice(0, 60), go: () => set({ tab: "engage", engageTab: "opportunities" }) }));
    ideasFor(strategy)
      .filter((i) => i.title.toLowerCase().includes(needle))
      .slice(0, 3)
      .forEach((i) => hits.push({ kind: "idea", color: "#FF5D8F", label: i.title, sub: `${i.format} · ${i.theme}`, go: () => set({ tab: "content", contentTab: "ideas" }) }));
  }

  const quickAdd = (kind: "person" | "conversation" | "post") => {
    setOpen(false);
    if (kind === "person") set({ tab: "pipeline" });
    if (kind === "conversation") set({ tab: "engage", engageTab: "opportunities" });
    if (kind === "post") set({ tab: "content", contentTab: "studio" });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Search & quick actions (⌘K)"
        className="fh-glass"
        style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "9px 15px", fontSize: 12.5, color: "#8B89A0", cursor: "pointer", border: "none" }}
      >
        ⌕ Search <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: "#5E5C72", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "1px 5px" }}>⌘K</span>
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(4,3,10,0.6)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", paddingTop: "12vh" }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="fh-glass" style={{ width: 560, maxWidth: "92vw", height: "fit-content", maxHeight: "68vh", overflowY: "auto", borderRadius: 16, padding: 14, animation: "fh-pop 0.18s ease both" }}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people, territories, conversations, notes, ideas…"
              style={{ width: "100%", fontSize: 14.5, color: "#F4F3F8", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 11, padding: "13px 15px", outline: "none" }}
            />

            {/* quick actions */}
            <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
              {([["person", "+ Add person", "#FFC23D"], ["conversation", "+ Log conversation", "#26E0C8"], ["post", "+ New post", "#FF5D8F"]] as const).map(([k, l, c]) => (
                <button key={k} onClick={() => quickAdd(k)} style={{ background: `${c}12`, color: c, border: `1px solid ${c}44`, borderRadius: 8, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* results */}
            {needle.length >= 2 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {hits.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#77758C", padding: "10px 4px" }}>Nothing matches &ldquo;{q}&rdquo; yet.</div>
                ) : (
                  hits.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => { h.go(); setOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 13px", cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: h.color, textTransform: "uppercase", flexShrink: 0, width: 82 }}>{h.kind}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#F4F3F8" }}>{h.label}</span>
                        <span style={{ display: "block", fontSize: 10.5, color: "#8B89A0" }}>{h.sub}</span>
                      </span>
                      <span style={{ color: h.color, fontWeight: 700 }}>→</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
