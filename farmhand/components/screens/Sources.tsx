"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { StrategyProfile } from "@/lib/strategy";
import { bankFor, mergeSources, PLATFORM_META, statewide, type SourceEntry } from "@/lib/sources";
import { verticalOf } from "@/lib/verticals";

/**
 * Auto-discovered engagement sources.
 * Seeds instantly from the built-in AZ knowledge base for every territory in
 * the agent's strategy, then (when PERPLEXITY_API_KEY is configured on the
 * server) expands with live research per territory.
 */
export default function Sources() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const sources = (state.sources as SourceEntry[]) || [];
  const [live, setLive] = useState<boolean | null>(null); // null = checking
  const [researching, setResearching] = useState<string | null>(null);
  const seeded = useRef(false);

  // seed knowledge-base suggestions for any territory that has none yet
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    set((s) => {
      const cur = (s.sources as SourceEntry[]) || [];
      let next = cur;
      (s.strategy as StrategyProfile).territories.forEach((t) => {
        if (!next.some((e) => e.territorySlug === t.slug)) next = mergeSources(next, bankFor(t, strategy.vertical));
      });
      if (!next.some((e) => e.territorySlug === "arizona")) next = mergeSources(next, statewide(strategy.vertical));
      return next === cur ? {} : { sources: next };
    });
  }, [set]);

  // is live research configured on the server?
  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json())
      .then((d) => setLive(!!d.configured))
      .catch(() => setLive(false));
  }, []);

  const research = async (slug: string) => {
    const t = strategy.territories.find((x) => x.slug === slug);
    if (!t || researching) return;
    setResearching(slug);
    try {
      // profession drives what the researcher looks for — this was hardcoded
      // to "real estate agent", which fed the solar account realtor groups
      const q = new URLSearchParams({ territory: t.name, city: t.city, segment: t.segment, profession: verticalOf(strategy.vertical).profession });
      const r = await fetch(`/api/discover?${q}`);
      const d = await r.json();
      const found: SourceEntry[] = (d.sources || []).map((f: { name: string; platform: SourceEntry["platform"]; why: string; size?: string }, i: number) => ({
        id: `live-${t.slug}-${Date.now()}-${i}`,
        name: f.name,
        platform: f.platform,
        territorySlug: t.slug,
        territoryName: t.name,
        why: f.why,
        size: f.size,
        status: "suggested" as const,
        origin: "live-research" as const,
      }));
      if (found.length) set((s) => ({ sources: mergeSources((s.sources as SourceEntry[]) || [], found) }));
    } catch {}
    setResearching(null);
  };

  const setStatus = (id: string, status: SourceEntry["status"]) =>
    set((s) => ({ sources: ((s.sources as SourceEntry[]) || []).map((e) => (e.id === id ? { ...e, status } : e)) }));

  const groups = [...strategy.territories.map((t) => ({ slug: t.slug, name: t.name, hex: t.hex })), { slug: "arizona", name: "All Arizona", hex: "#A6A4B8" }];
  const added = sources.filter((s) => s.status === "added").length;

  return (
    <div>
      {/* research status banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#A6A4B8",
          background: live ? "rgba(65,217,138,0.06)" : "rgba(255,194,61,0.06)",
          border: `1px solid ${live ? "rgba(65,217,138,0.25)" : "rgba(255,194,61,0.25)"}`,
          borderRadius: 11,
          padding: "10px 14px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: live ? "#41D98A" : live === null ? "#8B89A0" : "#FFC23D", boxShadow: `0 0 7px ${live ? "#41D98A" : "#FFC23D"}` }} />
        {live === null ? (
          "Checking live research…"
        ) : live ? (
          <>Live AI research connected — Farmhand verifies real, active communities for each territory automatically.</>
        ) : (
          <>
            Suggestions below come from Farmhand&apos;s built-in Arizona knowledge base.{" "}
            <b style={{ color: "#FFC23D" }}>Enable live research</b>: add <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>PERPLEXITY_API_KEY</span> in
            Vercel → Settings → Environment Variables (get a key at perplexity.ai/settings/api), then redeploy. After
            that, every territory gets fresh AI-verified communities — no searching.
          </>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#41D98A", flexShrink: 0 }}>{added} in your rotation</span>
      </div>

      {groups.map((g) => {
        const rows = sources.filter((s) => s.territorySlug === g.slug && s.status !== "dismissed");
        const isTerr = g.slug !== "arizona";
        return (
          <div key={g.slug} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.hex, boxShadow: `0 0 8px ${g.hex}` }} />
              <span className="fh-kicker" style={{ fontSize: 10 }}>{g.name}</span>
              {isTerr && live && (
                <button
                  onClick={() => research(g.slug)}
                  disabled={!!researching}
                  style={{
                    marginLeft: "auto",
                    background: researching === g.slug ? "rgba(255,255,255,0.05)" : `${g.hex}12`,
                    color: researching === g.slug ? "#8B89A0" : g.hex,
                    border: `1px solid ${g.hex}44`,
                    borderRadius: 8,
                    padding: "5px 13px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: researching ? "default" : "pointer",
                  }}
                >
                  {researching === g.slug ? "Researching…" : "↻ Research this area"}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 10 }}>
              {rows.map((sc) => {
                const pm = PLATFORM_META[sc.platform];
                const isAdded = sc.status === "added";
                return (
                  <div key={sc.id} className="fh-glass" style={{ borderRadius: 13, padding: "13px 15px", border: `1px solid ${isAdded ? "rgba(65,217,138,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 11, color: pm.color, background: `${pm.color}16`, border: `1px solid ${pm.color}3D`, flexShrink: 0 }}>
                        {pm.icon}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#F4F3F8", lineHeight: 1.3 }}>{sc.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: pm.color }}>{pm.label.toUpperCase()}</span>
                      {sc.size && <span style={{ fontSize: 9.5, color: "#77758C", fontFamily: "var(--mono)" }}>· {sc.size}</span>}
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 8.5,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          fontFamily: "var(--label)",
                          color: sc.origin === "live-research" ? "#41D98A" : "#8B89A0",
                        }}
                      >
                        {sc.origin === "live-research" ? "✓ AI-VERIFIED" : "KNOWLEDGE BASE"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#8B89A0", marginTop: 7, lineHeight: 1.5 }}>{sc.why}</div>
                    <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
                      {isAdded ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#41D98A", padding: "6px 0" }}>✓ In your rotation</span>
                      ) : (
                        <>
                          <button onClick={() => setStatus(sc.id, "added")} style={{ background: "rgba(65,217,138,0.12)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            + Add to rotation
                          </button>
                          <button onClick={() => setStatus(sc.id, "dismissed")} style={{ background: "transparent", color: "#77758C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Not for me
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.09)", padding: "16px 14px", fontSize: 11.5, color: "#5E5C72" }}>
                  {isTerr && live ? "No sources yet — hit “Research this area.”" : "No sources yet for this area."}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 10.5, color: "#5E5C72", lineHeight: 1.6, marginTop: 4 }}>
        Add a community to your rotation, then capture threads from it in Opportunities. Farmhand suggests where to be
        — joining and posting is always you, under your own name.
      </div>
    </div>
  );
}
