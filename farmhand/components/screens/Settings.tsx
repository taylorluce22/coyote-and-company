"use client";

import { useStore } from "@/lib/store";
import { Switch } from "@/components/ui";
import { SET_VOICE, SET_IMG_PREFS, SET_CONNECTIONS } from "@/lib/data";

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
  const { state, set } = useStore();
  const get = (k: string, def: boolean) => (state[k] != null ? (state[k] as boolean) : def);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
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

      <Card title="Designer scene (Spline)">
        <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55, marginBottom: 10 }}>
          Design a 3D hero scene visually at <b style={{ color: "#C9A8FF" }}>spline.design</b> (free), then Export → Code
          Export → React and paste the scene URL here. The dashboard&apos;s DESIGNER view renders it live.
        </div>
        <input
          value={(state.splineUrl as string) || ""}
          onChange={(e) => set({ splineUrl: e.target.value.trim() })}
          placeholder="https://prod.spline.design/…/scene.splinecode"
          style={{
            width: "100%",
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "#F4F3F8",
            background: "rgba(0,0,0,0.28)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 9,
            padding: "10px 12px",
            outline: "none",
          }}
        />
        <div style={{ fontSize: 10.5, color: state.splineUrl ? "#41D98A" : "#6E6C82", marginTop: 8 }}>
          {state.splineUrl ? "● Scene connected — switch the dashboard to DESIGNER view" : "No scene connected yet"}
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
