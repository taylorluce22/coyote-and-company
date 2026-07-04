"use client";

import { CHANNELS } from "@/lib/data";

export default function Directory() {
  return (
    <div>
      <div className="fh-kicker" style={{ marginBottom: 14 }}>
        Your channel directory · rules, cadence &amp; health
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {CHANNELS.map((c, i) => (
          <div
            key={c.name}
            className="fh-card3d"
            style={{
              minWidth: 0,
              background: "linear-gradient(160deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "16px 18px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
              animation: `fh-fadein .5s ease ${(i * 0.06).toFixed(2)}s both`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "var(--mono)", color: c.plat, background: `${c.plat}1A`, border: `1px solid ${c.plat}44`, borderRadius: 6, padding: "3px 8px" }}>{c.platform}</span>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 600, color: c.healthColor }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.healthColor, boxShadow: `0 0 7px ${c.healthColor}` }} />
                {c.health}
              </span>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 11.5, fontFamily: "var(--mono)", color: "#8B89A0", marginTop: 2 }}>{c.members} members · {c.cadence}</div>
            <div style={{ fontSize: 12.5, color: "#A6A4B8", lineHeight: 1.55, marginTop: 10 }}>{c.rules}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: "var(--mono)", color: c.promoOn ? "#FFC23D" : "#6E6C82", background: c.promoOn ? "rgba(255,194,61,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${c.promoOn ? "rgba(255,194,61,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 999, padding: "3px 10px" }}>{c.promo}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#6E6C82" }}>last posted {c.last}</span>
            </div>
            {c.health === "quiet" && (
              <div style={{ marginTop: 12, fontSize: 11.5, color: "#FF5D8F", background: "rgba(255,93,143,0.08)", border: "1px solid rgba(255,93,143,0.25)", borderRadius: 9, padding: "8px 11px" }}>
                You haven&apos;t shown up here in {c.last} — action queued.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
