"use client";

import { useStore } from "@/lib/store";
import { GRAPH_NODES, GRAPH_LINKS } from "@/lib/agentOs";
import type { TabId } from "@/lib/data";

const PIPELINE = [
  "Data centers heat", "Hottest year", "Battery VPP", "APS bill climbs", "Bill isn't going down",
];
const NEEDS = [
  ["Approve the 5 briefs", "queue"], ["Pexels API key", "vercel"], ["Gemini key + Blob (Reel Coach)", "vercel"],
  ["Photo dump → refs", "brand"], ["Grid-level competitor audit", "feed"],
];

function Stat({ label, value, accent, note }: { label: string; value: string; accent: string; note: string }) {
  return (
    <div className="fh-glass" style={{ borderRadius: 15, padding: "16px 18px" }}>
      <div className="fh-kicker" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 750, margin: "6px 0 2px", color: accent }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#8B89A0", lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

export default function CommandCenter() {
  const { set } = useStore();
  const go = (tab: TabId) => set({ tab });

  return (
    <div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 20 }}>
        The one-screen state of the operation — agents, the content pipeline, and the knowledge base that grounds every post.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
        <Stat label="System" value="Operational" accent="#41D98A" note="Manual-run mode · autonomous scheduler paused." />
        <div onClick={() => go("agents")} style={{ cursor: "pointer" }}><Stat label="Agents" value="7" accent="#F4F3F8" note="1 command layer + 6 specialists." /></div>
        <div onClick={() => go("vault")} style={{ cursor: "pointer" }}><Stat label="Knowledge base" value="6 docs" accent="#7BE495" note={`${GRAPH_NODES.length} nodes / ${GRAPH_LINKS.length} links in the vault graph.`} /></div>
        <div onClick={() => go("content")} style={{ cursor: "pointer" }}><Stat label="Content queue" value="5" accent="#FF5D8F" note="Fact-checked, awaiting approval · 1 held · 3 rejected." /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        <div className="fh-glass" style={{ borderRadius: 15, padding: "16px 18px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14, color: "#F4F3F8" }}>Content pipeline</h3>
          {PIPELINE.map((p) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF9EC4", flex: "none" }} />
              {p}
              <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#8B89A0" }}>fact-checked</span>
            </div>
          ))}
        </div>
        <div className="fh-glass" style={{ borderRadius: 15, padding: "16px 18px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14, color: "#F4F3F8" }}>Needs Taylor</h3>
          {NEEDS.map(([t, m]) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFC23D", flex: "none" }} />
              {t}
              <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#8B89A0" }}>{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
