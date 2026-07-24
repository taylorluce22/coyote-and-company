"use client";

import { useRef, useState } from "react";
import { cleanSlate, restoreDemo, useStore } from "@/lib/store";
import type { ClientMeta, ClientBundle, ClientId } from "@/lib/clients";
import { Switch } from "@/components/ui";
import { SET_VOICE, SET_IMG_PREFS, SET_CONNECTIONS } from "@/lib/data";
import { DEFAULT_STRATEGY, SOLAR_TERRITORIES, type StrategyProfile, type Territory } from "@/lib/strategy";
import { AZ_TERRITORY_CATALOG, TERRITORY_HEXES, UTILITY_COLOR, UTILITY_LABEL, type AzTerritoryDef, type TerritoryUtility } from "@/lib/azTerritories";
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

/**
 * Operator multi-client mode (E1) — the founder services many client accounts
 * from one browser. Add / switch / rename / remove clients, and export/import a
 * client bundle (the backup, since data still lives in this browser).
 */
function ClientsCard({ clients, active, onSwitch, onAdd, onRename, onRemove, onExport, onImport }: {
  clients: ClientMeta[];
  active: ClientId;
  onSwitch: (id: ClientId) => void;
  onAdd: (label: string, opts?: { emoji?: string; vertical?: "realtor" | "solar" }) => ClientId;
  onRename: (id: ClientId, label: string, emoji?: string) => void;
  onRemove: (id: ClientId) => void;
  onExport: (id: ClientId) => Promise<void>;
  onImport: (bundle: ClientBundle) => Promise<ClientId | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVertical, setNewVertical] = useState<"solar" | "realtor">("solar");
  const [editId, setEditId] = useState<ClientId | null>(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isSeed = (id: ClientId) => id === "default" || id === "solar";

  const submitAdd = () => {
    const name = newName.trim();
    if (!name) return;
    onAdd(name, { vertical: newVertical });
    setNewName(""); setAdding(false);
    setMsg(`Created “${name}” — onboarding is ready for this client.`);
  };

  const onFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const bundle = JSON.parse(await f.text()) as ClientBundle;
      const id = await onImport(bundle);
      setMsg(id ? "✓ Client bundle restored as a new client." : "That file isn’t a Farmhand client bundle.");
    } catch { setMsg("Couldn’t read that file."); }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card title="Clients">
      <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 12 }}>
        Every client you service is an isolated account — its own profile, content, image vault, inbox, and pipeline.
        Nothing is shared between them. Back up a client to a file anytime, and restore it on any device.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {clients.map((w) => {
          const on = w.id === active;
          const editing = editId === w.id;
          return (
            <div key={w.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "11px 12px", borderRadius: 11, background: on ? (w.vertical === "solar" ? "linear-gradient(180deg,#FFC23D,#D97706)" : "linear-gradient(180deg,#2DD4BF,#0D9488)") : "rgba(255,255,255,0.05)", border: on ? "none" : "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17 }}>{w.emoji}</span>
                {editing ? (
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onRename(w.id, editName); setEditId(null); } }}
                    style={{ flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "6px 9px", color: on ? "#04110E" : "#F4F3F8", fontSize: 13, fontWeight: 700 }} />
                ) : (
                  <button onClick={() => !on && onSwitch(w.id)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: on ? "default" : "pointer", fontSize: 13.5, fontWeight: 800, color: on ? "#04110E" : "#A6A4B8" }}>
                    {w.label}
                  </button>
                )}
                {on && !editing && <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "#04110E" }}>ACTIVE</span>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {editing ? (
                  <>
                    <MiniBtn on={on} label="Save" onClick={() => { onRename(w.id, editName); setEditId(null); }} />
                    <MiniBtn on={on} label="Cancel" onClick={() => setEditId(null)} />
                  </>
                ) : (
                  <>
                    {!on && <MiniBtn on={on} label="Open" onClick={() => onSwitch(w.id)} />}
                    <MiniBtn on={on} label="Rename" onClick={() => { setEditId(w.id); setEditName(w.label); }} />
                    <MiniBtn on={on} label="Back up" onClick={() => onExport(w.id)} />
                    {!isSeed(w.id) && <MiniBtn on={on} danger label="Remove" onClick={() => { if (confirm(`Remove “${w.label}” and all its data? Back it up first if you want to keep it.`)) onRemove(w.id); }} />}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, padding: "12px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Client name (e.g. Jordan · Mesa Solar)"
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }}
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "9px 11px", color: "#F4F3F8", fontSize: 13 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {(["solar", "realtor"] as const).map((v) => (
              <button key={v} onClick={() => setNewVertical(v)} style={{ flex: 1, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "8px 0", borderRadius: 8, background: newVertical === v ? "#E8622C" : "rgba(255,255,255,0.05)", color: newVertical === v ? "#0B0A12" : "#A6A4B8", border: "none" }}>
                {v === "solar" ? "☀️ Solar" : "🏠 Realtor"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitAdd} disabled={!newName.trim()} style={{ flex: 1, cursor: newName.trim() ? "pointer" : "default", fontSize: 12.5, fontWeight: 700, padding: "9px 0", borderRadius: 8, background: newName.trim() ? "#41D98A" : "#3A3A46", color: "#04110E", border: "none" }}>Create client</button>
            <button onClick={() => { setAdding(false); setNewName(""); }} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#A6A4B8", border: "1px solid rgba(255,255,255,0.12)" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => setAdding(true)} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, padding: "10px 16px", borderRadius: 9, background: "#E8622C", color: "#0B0A12", border: "none" }}>+ Add client</button>
          <button onClick={() => fileRef.current?.click()} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 650, padding: "10px 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", color: "#F4F3F8", border: "1px solid rgba(255,255,255,0.14)" }}>Restore from file ↑</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files)} style={{ display: "none" }} />
        </div>
      )}
      {msg && <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 10, lineHeight: 1.5 }}>{msg}</div>}
    </Card>
  );
}

function MiniBtn({ label, onClick, on, danger }: { label: string; onClick: () => void; on: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{ cursor: "pointer", fontSize: 11, fontWeight: 650, padding: "5px 10px", borderRadius: 7, background: on ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.06)", color: danger ? "#FF7A7A" : on ? "#04110E" : "#C8C6D8", border: on ? "none" : "1px solid rgba(255,255,255,0.12)" }}>
      {label}
    </button>
  );
}

const MAX_TERRITORIES = 6;

/**
 * Solar territory picker — the July 2026 metro-Phoenix new-construction
 * research as selectable cards, grouped by utility. Selections become the
 * live strategy.territories: territory names double as hunt search keywords
 * and content labels, and the utility tag picks which rate math the pulse,
 * content, and replies use.
 */
function SolarTerritoryPicker() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const selected = new Set(strategy.territories.map((t) => t.slug));

  const toggle = (def: AzTerritoryDef) => {
    set((s) => {
      const st = s.strategy as StrategyProfile;
      const has = st.territories.some((t) => t.slug === def.slug);
      let territories: Territory[];
      if (has) {
        territories = st.territories.filter((t) => t.slug !== def.slug);
      } else {
        if (st.territories.length >= MAX_TERRITORIES) return s;
        territories = [
          ...st.territories,
          { slug: def.slug, name: def.name, city: def.city, segment: "growth", status: "building", hex: TERRITORY_HEXES[st.territories.length % TERRITORY_HEXES.length], utility: def.utility },
        ];
      }
      if (!territories.length) return s; // never allow an empty list — the engine needs somewhere to hunt
      return { ...s, strategy: { ...st, territories } };
    });
  };

  const removeCustom = (slug: string) =>
    set((s) => {
      const st = s.strategy as StrategyProfile;
      if (st.territories.length <= 1) return s;
      return { ...s, strategy: { ...st, territories: st.territories.filter((t) => t.slug !== slug) } };
    });

  const groups: { key: TerritoryUtility[]; title: string; note: string }[] = [
    { key: ["aps"], title: "West Valley + North Phoenix · APS", note: "Pick a city for the whole corridor, or a specific development to go deep. Pitch: export-rate lock (6.2¢, drops each Sept), 4–7pm TOU math, Storage Rewards" },
    { key: ["srp"], title: "East Valley · SRP", note: "Pick a city for the whole corridor, or a specific development to go deep. Pitch: demand management, batteries, self-consumption — exports pay only 3.45¢" },
    { key: ["ed3", "ed2", "verify"], title: "Outskirts · other utilities — verify rates first", note: "ED3/ED2 have their own tariffs — never quote APS or SRP numbers here" },
  ];

  const catalogSlugs = new Set(AZ_TERRITORY_CATALOG.map((c) => c.slug));
  const customPicks = strategy.territories.filter((t) => !catalogSlugs.has(t.slug));

  return (
    <Card title="Solar territories · pick where you build presence">
      <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 6 }}>
        Metro Phoenix new-construction hot spots from the territory research, grouped by electric utility. Pick up to{" "}
        {MAX_TERRITORIES} — each becomes a live territory: hunts search its name, content gets written for it, and
        replies use the right utility&apos;s rate math.
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: strategy.territories.length >= MAX_TERRITORIES ? "#FFC23D" : "#41D98A", marginBottom: 10 }}>
        {strategy.territories.length}/{MAX_TERRITORIES} selected
      </div>
      {customPicks.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {customPicks.map((t) => (
            <span key={t.slug} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#D8D6E6", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "4px 10px" }}>
              {t.name}
              <button onClick={() => removeCustom(t.slug)} title="Remove" style={{ background: "none", border: "none", color: "#77758C", cursor: "pointer", fontSize: 12, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
      {groups.map((g) => {
        // cities first (whole-corridor picks), then developments within them
        const items = AZ_TERRITORY_CATALOG.filter((c) => g.key.includes(c.utility)).sort(
          (a, b) => Number(b.kind === "city") - Number(a.kind === "city")
        );
        return (
          <div key={g.title} style={{ marginBottom: 14 }}>
            <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 3 }}>{g.title}</div>
            <div style={{ fontSize: 10, color: "#5E5C72", marginBottom: 8, lineHeight: 1.45 }}>{g.note}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((def) => {
                const on = selected.has(def.slug);
                const full = !on && strategy.territories.length >= MAX_TERRITORIES;
                const uc = UTILITY_COLOR[def.utility];
                return (
                  <button
                    key={def.slug}
                    onClick={() => toggle(def)}
                    disabled={full}
                    style={{ display: "flex", alignItems: "flex-start", gap: 9, textAlign: "left", padding: "9px 11px", borderRadius: 10, cursor: full ? "default" : "pointer", opacity: full ? 0.45 : 1, background: on ? "rgba(65,217,138,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${on ? "rgba(65,217,138,0.45)" : "rgba(255,255,255,0.09)"}` }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1, fontSize: 12, color: on ? "#41D98A" : "#3F3D52" }}>{on ? "✓" : "○"}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#EDEBF6" }}>{def.name}</span>
                        {def.kind !== "city" && <span style={{ fontSize: 10, color: "#77758C" }}>{def.city}</span>}
                        <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.07em", color: "#04110E", background: uc, borderRadius: 999, padding: "1.5px 7px" }}>{UTILITY_LABEL[def.utility]}</span>
                        {def.kind === "city" && <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.07em", color: "#7DD3FC", border: "1px solid rgba(125,211,252,0.4)", borderRadius: 999, padding: "1px 7px" }}>CITY</span>}
                        {def.tier === 1 && <span style={{ fontSize: 8.5, fontWeight: 900, color: "#FFC23D" }}>★ TOP TARGET</span>}
                      </span>
                      <span style={{ display: "block", fontSize: 10.5, color: "#8B89A0", lineHeight: 1.45, marginTop: 2 }}>{def.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 10, color: "#5E5C72", lineHeight: 1.5 }}>
        Utility boundaries can split streets (Goodyear, Glendale, Avondale, San Tan Valley) — always verify the exact
        address before quoting a rate plan.
      </div>
    </Card>
  );
}

export default function Settings() {
  const { state, set, workspace, switchWorkspace, clients, addClient, renameClient, removeClient, exportClient, importClient } = useStore();
  const get = (k: string, def: boolean) => (state[k] != null ? (state[k] as boolean) : def);
  const strategy = state.strategy as StrategyProfile;
  const activeVertical = verticalOf(strategy.vertical).id;

  const switchVertical = (id: VerticalId) => {
    if (id === activeVertical) return;
    const v = VERTICALS[id];
    set((s) => {
      const prev = s.strategy as StrategyProfile;
      // territories are vertical-specific too: realtor farms micro-neighborhoods
      // (Val Vista Lakes), solar hunts whole utility cities (Phoenix/Mesa).
      // Swap only when the current set is a stock default — never a chosen one.
      const demoSlugs = new Set(DEFAULT_STRATEGY.territories.map((t) => t.slug));
      const solarSlugs = new Set(SOLAR_TERRITORIES.map((t) => t.slug));
      let territories = prev.territories;
      if (id === "solar" && territories.every((t) => demoSlugs.has(t.slug))) territories = SOLAR_TERRITORIES;
      if (id === "realtor" && territories.every((t) => solarSlugs.has(t.slug))) territories = DEFAULT_STRATEGY.territories;
      return {
        strategy: { ...prev, vertical: id, territories },
        // the engine's training is vertical-specific — carrying realtor guidance
        // and thumbs history into solar (or back) would steer the hunt wrong,
        // so switching resets it to the new vertical's defaults
        leadTraining: {
          ...(s.leadTraining as LeadTraining),
          guidance: v.defaultGuidance,
          intents: v.defaultIntents,
          good: [],
          bad: [],
          avoid: [],
          minScore: id === "solar" ? 35 : 55,
        },
      };
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
      <ClientsCard
        clients={clients}
        active={workspace}
        onSwitch={switchWorkspace}
        onAdd={addClient}
        onRename={renameClient}
        onRemove={removeClient}
        onExport={exportClient}
        onImport={importClient}
      />

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

      {activeVertical === "solar" && <SolarTerritoryPicker />}

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
