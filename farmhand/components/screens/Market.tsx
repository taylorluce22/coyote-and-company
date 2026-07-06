"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchNeighborhoodFeed, feedTime, KIND_META, type FeedItem } from "@/lib/feeds";
import type { StrategyProfile, Territory } from "@/lib/strategy";
import type { Opportunity } from "@/lib/engage";

/** Map strategy slugs onto the demo feed keys where they exist. */
const FEED_ALIAS: Record<string, string> = {
  "gilbert-val-vista": "val-vista-lakes",
  "gilbert-agritopia": "agritopia",
  "gilbert-heritage": "heritage-district",
  "paradise-valley": "paradise-valley",
};

function TerritoryDetail({ t, onBack }: { t: Territory; onBack: () => void }) {
  const { state, set } = useStore();
  const demo = state.demoMode as boolean;
  const opps = (state.opportunities as Opportunity[]) || [];
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let dead = false;
    setItems(null);
    if (!demo) {
      // clean mode: this page shows only what actually happened here
      const real: FeedItem[] = opps
        .filter((o) => o.territory === t.name)
        .map((o, i) => ({
          id: o.id,
          kind: "group" as const,
          title: o.excerpt.slice(0, 90),
          detail: `via ${o.sourceName} · ${o.status === "engaged" ? "you replied" : o.status}`,
          minsAgo: 15 + i * 45,
          source: o.sourceName,
        }));
      setItems(real);
      return;
    }
    fetchNeighborhoodFeed(FEED_ALIAS[t.slug] ?? t.slug).then((rows) => !dead && setItems(rows));
    return () => {
      dead = true;
    };
  }, [t.slug, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ animation: "fh-rise 0.3s ease both" }}>
      <div style={{ position: "relative", height: 190, borderRadius: 16, overflow: "hidden", border: `1px solid ${t.hex}3D`, marginBottom: 16 }}>
        {t.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.img} alt={t.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        )}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(6,6,13,0.15) 30%, rgba(6,6,13,0.9)), linear-gradient(90deg, ${t.hex}14, transparent)` }} />
        <button onClick={onBack} style={{ position: "absolute", top: 12, left: 12, background: "rgba(8,8,18,0.66)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, color: "#D8D6E6", fontSize: 11, fontWeight: 700, fontFamily: "var(--label)", letterSpacing: "0.05em", padding: "7px 12px", cursor: "pointer", backdropFilter: "blur(12px)" }}>
          ← WATCHLIST
        </button>
        <div style={{ position: "absolute", left: 18, bottom: 14 }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.09em", fontFamily: "var(--label)", color: t.hex, textTransform: "uppercase" }}>
            {t.segment} · {t.status === "own" ? "your turf" : t.status}
          </span>
          <div className="fh-title" style={{ fontSize: 28, marginTop: 3 }}>{t.name}</div>
        </div>
      </div>

      <div className="fh-glass" style={{ borderRadius: 14, padding: "15px 17px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.hex, boxShadow: `0 0 7px ${t.hex}`, animation: "fh-pulse 2s ease infinite" }} />
          <span className="fh-kicker" style={{ fontSize: 9.5 }}>Your activity in {t.name}</span>
        </div>
        {items === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 42, borderRadius: 10, background: "rgba(255,255,255,0.045)", animation: "fh-pulse 1.4s ease infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "18px 6px", fontSize: 12.5, color: "#8B89A0", lineHeight: 1.6 }}>
            Nothing captured here yet. Post about {t.name} in the Studio, or capture a conversation in Engage — it all
            lands on this page.
          </div>
        ) : (
          items.map((it, i) => {
            const meta = KIND_META[it.kind];
            const tm = feedTime(it.minsAgo);
            return (
              <div key={it.id} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "10px 2px", borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.055)" : "none" }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, color: meta.color, background: `${meta.color}16`, border: `1px solid ${meta.color}3D` }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 650, color: "#EDEBF6" }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 2 }}>{it.detail}</div>
                </div>
                <div style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: meta.color, fontFamily: "var(--mono)" }}>{tm.rel}</div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
        <button onClick={() => set({ tab: "content", contentTab: "studio" })} style={{ flex: 1, background: `linear-gradient(180deg, ${t.hex}, ${t.hex}B8)`, color: "#0A0A14", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: `0 8px 22px ${t.hex}55` }}>
          Draft a post for {t.name} →
        </button>
        <button onClick={() => set({ tab: "engage" })} style={{ flex: 1, background: `${t.hex}12`, color: t.hex, border: `1px solid ${t.hex}44`, borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          Find conversations
        </button>
      </div>
    </div>
  );
}

export default function Market() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const sel = state.marketSel as string | null;
  const setSel = (slug: string | null) => set({ marketSel: slug });
  const selT = strategy.territories.find((t) => t.slug === sel);

  if (selT) return <TerritoryDetail t={selT} onBack={() => setSel(null)} />;

  return (
    <div>
      <div style={{ fontSize: 13, color: "#A6A4B8", marginBottom: 16 }}>
        Your watchlist — the areas you told us you're farming. Click into one for its activity and angles.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 13 }}>
        {strategy.territories.map((t) => (
          <div
            key={t.slug}
            className="fh-card3d"
            role="button"
            tabIndex={0}
            onClick={() => setSel(t.slug)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(t.slug)}
            style={{ borderRadius: 15, overflow: "hidden", border: `1px solid ${t.hex}36`, background: "rgba(255,255,255,0.03)", cursor: "pointer", boxShadow: `0 16px 38px rgba(0,0,0,0.45), 0 6px 22px ${t.hex}1A` }}
          >
            <div style={{ position: "relative", height: 118, background: `linear-gradient(160deg, ${t.hex}30, #0A0A14)` }}>
              {t.img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.img} alt={t.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,6,13,0.05) 40%, rgba(6,6,13,0.9))" }} />
              <span style={{ position: "absolute", top: 9, right: 9, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "var(--label)", color: t.hex, background: "rgba(8,8,18,0.66)", border: `1px solid ${t.hex}55`, borderRadius: 999, padding: "3px 8px", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>
                {t.segment}
              </span>
              <div style={{ position: "absolute", left: 13, bottom: 10, fontSize: 15, fontWeight: 700, color: "#F4F3F8", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
                {t.name}
              </div>
            </div>
            <div style={{ padding: "10px 14px 13px", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8B89A0", textTransform: "capitalize" }}>
                {t.status === "own" ? "● your turf" : t.status === "building" ? "◐ building presence" : "○ exploring"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: t.hex }}>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
