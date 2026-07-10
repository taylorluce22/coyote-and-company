"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchNeighborhoodFeed, feedTime, KIND_META, type FeedItem } from "@/lib/feeds";
import type { StrategyProfile, Territory } from "@/lib/strategy";
import { tagOpportunity, type Opportunity } from "@/lib/engage";
import { signalsFor } from "@/lib/signals";
import { bankFor, mergeSources, PLATFORM_META, type SourceEntry } from "@/lib/sources";

/** Map strategy slugs onto the demo feed keys where they exist. */
const FEED_ALIAS: Record<string, string> = {
  "gilbert-val-vista": "val-vista-lakes",
  "gilbert-agritopia": "agritopia",
  "gilbert-heritage": "heritage-district",
  "paradise-valley": "paradise-valley",
};

interface RadarItem {
  id: string;
  title: string;
  text: string;
  subreddit: string;
  author: string;
  url: string;
  ageMins: number;
  comments: number;
}

function SectionHead({ color, label, right }: { color: string; label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 7px ${color}` }} />
      <span className="fh-kicker" style={{ fontSize: 9.5 }}>{label}</span>
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
    </div>
  );
}

/**
 * The territory hub. Opening an area automatically assembles:
 * live area brief (when research is connected) → market signals with
 * content angles → the communities to engage in → live conversations →
 * your real activity here.
 */
function TerritoryDetail({ t, onBack }: { t: Territory; onBack: () => void }) {
  const { state, set } = useStore();
  const demo = state.demoMode as boolean;
  const strategy = state.strategy as StrategyProfile;
  const opps = (state.opportunities as Opportunity[]) || [];
  const allSources = (state.sources as SourceEntry[]) || [];
  const briefs = (state.briefs as Record<string, { summary: string; facts: string[] }>) || {};
  const brief = briefs[t.slug];

  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [radar, setRadar] = useState<RadarItem[] | null>(null);
  const [radarNeedsCreds, setRadarNeedsCreds] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [captured, setCaptured] = useState<Record<string, boolean>>({});
  const booted = useRef(false);

  const signals = signalsFor(t);
  const tSources = allSources.filter((s) => s.territorySlug === t.slug && s.status !== "dismissed").slice(0, 6);

  // one boot per territory: seed sources, check live research, scan radar, fetch brief
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    // seed knowledge-base sources for this territory if none yet
    set((s) => {
      const cur = (s.sources as SourceEntry[]) || [];
      return cur.some((e) => e.territorySlug === t.slug) ? {} : { sources: mergeSources(cur, bankFor(t)) };
    });

    // live radar — real Reddit threads showing actual moving/relocation intent,
    // not just any mention of the name (bare "Paradise Valley" pulls in noise —
    // the mall, other states' Paradise Valleys, anything tangential)
    const relocationQuery = `"moving to ${t.name}" OR "relocating to ${t.name}" OR "new to ${t.name}" OR "just moved to ${t.name}"`;
    fetch(`/api/radar?q=${encodeURIComponent(relocationQuery)}`)
      .then((r) => r.json())
      .then((d) => {
        setRadar((d.items || []).slice(0, 5));
        setRadarNeedsCreds(!!d.needsCreds);
      })
      .catch(() => setRadar([]));

    // live research configured? then auto-fetch the area brief (cached forever after)
    fetch("/api/discover")
      .then((r) => r.json())
      .then((d) => {
        setLive(!!d.configured);
        if (d.configured && !briefs[t.slug]) {
          setBriefLoading(true);
          const q = new URLSearchParams({ territory: t.name, city: t.city, segment: t.segment, mode: "brief" });
          fetch(`/api/discover?${q}`)
            .then((r) => r.json())
            .then((b) => {
              if (b.brief?.summary)
                set((s) => ({ briefs: { ...((s.briefs as Record<string, unknown>) || {}), [t.slug]: b.brief } }));
            })
            .finally(() => setBriefLoading(false));
        }
      })
      .catch(() => setLive(false));
  }, [t.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // activity feed (demo feed in demo mode; real captures in clean mode)
  useEffect(() => {
    let dead = false;
    setItems(null);
    if (!demo) {
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

  const captureRadar = (it: RadarItem) => {
    const full = `${it.title} ${it.text}`.trim();
    const opp: Opportunity = {
      id: `opp-${Date.now()}-${it.id}`,
      sourceName: `r/${it.subreddit}`,
      territory: t.name,
      excerpt: full.slice(0, 400),
      url: it.url,
      tags: tagOpportunity(full),
      status: "new",
      capturedAt: "just now",
      capturedAtMs: Date.now(),
      firstTouch: !opps.some((o) => o.sourceName === `r/${it.subreddit}`),
    };
    set((s) => ({ opportunities: [opp, ...(s.opportunities as Opportunity[])] }));
    setCaptured((c) => ({ ...c, [it.id]: true }));
  };

  const addSource = (id: string) =>
    set((s) => ({ sources: ((s.sources as SourceEntry[]) || []).map((e) => (e.id === id ? { ...e, status: "added" as const } : e)) }));

  const card: React.CSSProperties = { borderRadius: 14, padding: "15px 17px", background: "rgba(8,8,18,0.5)", border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <div style={{ animation: "fh-rise 0.3s ease both", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* banner */}
      <div style={{ position: "relative", height: 175, borderRadius: 16, overflow: "hidden", border: `1px solid ${t.hex}3D` }}>
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
        <div style={{ position: "absolute", right: 14, bottom: 14, display: "flex", gap: 8 }}>
          <button onClick={() => set({ tab: "content", contentTab: "studio" })} style={{ background: `linear-gradient(180deg, ${t.hex}, ${t.hex}B8)`, color: "#0A0A14", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", boxShadow: `0 8px 22px ${t.hex}55` }}>
            Draft a post →
          </button>
        </div>
      </div>

      {/* AREA BRIEF */}
      <div style={{ ...card, border: `1px solid ${brief ? "rgba(65,217,138,0.25)" : "rgba(255,255,255,0.08)"}` }}>
        <SectionHead
          color={brief ? "#41D98A" : "#8B89A0"}
          label="Area brief"
          right={brief && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: "#41D98A" }}>✓ AI-RESEARCHED</span>}
        />
        {brief ? (
          <>
            <div style={{ fontSize: 13, color: "#D8D6E6", lineHeight: 1.6 }}>{brief.summary}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8, marginTop: 11 }}>
              {brief.facts.map((f, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "#A6A4B8", lineHeight: 1.45, padding: "8px 11px", background: "rgba(0,0,0,0.25)", borderRadius: 9, borderLeft: `2px solid ${t.hex}66` }}>
                  {f}
                </div>
              ))}
            </div>
          </>
        ) : briefLoading ? (
          <div style={{ fontSize: 12, color: "#8B89A0" }}>Researching {t.name} live…</div>
        ) : live ? (
          <div style={{ fontSize: 12, color: "#8B89A0" }}>Brief loads automatically on next open.</div>
        ) : (
          <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.55 }}>
            {t.segment === "luxury"
              ? `${t.name} is a prestige market: discreet sellers, relocation and move-up buyers, long relationships over quick wins.`
              : t.segment === "growth"
              ? `${t.name} is a growth market: new builds, out-of-state families, school-calendar timing — speed and guidance win here.`
              : `${t.name} is a value market: first-time buyers and right-sizers — trust and education content works hardest.`}{" "}
            <span style={{ color: "#FFC23D" }}>Connect live research (Settings → the PERPLEXITY_API_KEY note in Engage → Sources) for a current, AI-researched brief.</span>
          </div>
        )}
      </div>

      {/* MARKET SIGNALS */}
      <div style={card}>
        <SectionHead color={t.hex} label={`What's moving in ${t.name}`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {signals.map((sg) => (
            <div key={sg.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 11px", background: "rgba(0,0,0,0.24)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#EDEBF6" }}>{sg.headline}</div>
                <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 2 }}>
                  {sg.detail} · <i style={{ color: "#A6A4B8" }}>{sg.angle}</i>
                </div>
              </div>
              <button onClick={() => set({ tab: "content", contentTab: "ideas" })} style={{ flexShrink: 0, background: `${t.hex}12`, color: t.hex, border: `1px solid ${t.hex}44`, borderRadius: 8, padding: "6px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
                Make content →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* START ENGAGING HERE */}
      <div style={{ ...card, border: "1px solid rgba(38,224,200,0.22)" }}>
        <SectionHead
          color="#26E0C8"
          label={`Start engaging in ${t.name}`}
          right={
            <button onClick={() => set({ tab: "engage", engageTab: "sources" })} style={{ background: "transparent", border: "none", color: "#26E0C8", fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              all sources →
            </button>
          }
        />

        {/* communities */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
          {tSources.map((sc) => {
            const pm = PLATFORM_META[sc.platform];
            return (
              <div key={sc.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "rgba(0,0,0,0.24)", borderRadius: 10, border: `1px solid ${sc.status === "added" ? "rgba(65,217,138,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 11, color: pm.color, background: `${pm.color}16`, border: `1px solid ${pm.color}3D` }}>{pm.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#EDEBF6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sc.name}</div>
                  <div style={{ fontSize: 9, color: pm.color, fontWeight: 700, letterSpacing: "0.05em" }}>{pm.label.toUpperCase()}</div>
                </div>
                {sc.status === "added" ? (
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#41D98A" }}>✓</span>
                ) : (
                  <button onClick={() => addSource(sc.id)} style={{ flexShrink: 0, background: "rgba(65,217,138,0.12)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 7, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    + Add
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* live conversations */}
        <div style={{ marginTop: 13 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: "#FF9A62", marginBottom: 8 }}>
            LIVE CONVERSATIONS · REDDIT
          </div>
          {radar === null ? (
            <div style={{ fontSize: 11.5, color: "#77758C" }}>Scanning for {t.name} threads…</div>
          ) : radar.length === 0 ? (
            <div style={{ fontSize: 11.5, color: radarNeedsCreds ? "#FFC23D" : "#77758C", lineHeight: 1.55 }}>
              {radarNeedsCreds
                ? "Reddit needs a free one-time connection to work from the cloud — open Engage → Live Radar for the 2-minute setup (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET)."
                : `No fresh Reddit threads mention ${t.name} right now — check the communities above instead, or rescan from Engage.`}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {radar.map((it) => (
                <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", background: "rgba(0,0,0,0.24)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 650, color: "#EDEBF6", lineHeight: 1.4 }}>{it.title}</div>
                    <div style={{ fontSize: 9.5, color: "#77758C", marginTop: 2, fontFamily: "var(--mono)" }}>
                      r/{it.subreddit} · {it.ageMins < 60 ? `${it.ageMins}m` : it.ageMins < 1440 ? `${Math.round(it.ageMins / 60)}h` : `${Math.round(it.ageMins / 1440)}d`} ago · {it.comments} comments ·{" "}
                      <a href={it.url} target="_blank" rel="noreferrer" style={{ color: "#7DD3FC", textDecoration: "none" }}>open ↗</a>
                    </div>
                  </div>
                  <button
                    onClick={() => captureRadar(it)}
                    disabled={!!captured[it.id]}
                    style={{ flexShrink: 0, background: captured[it.id] ? "transparent" : "rgba(38,224,200,0.12)", color: captured[it.id] ? "#41D98A" : "#26E0C8", border: captured[it.id] ? "none" : "1px solid rgba(38,224,200,0.4)", borderRadius: 7, padding: "5px 11px", fontSize: 10.5, fontWeight: 700, cursor: captured[it.id] ? "default" : "pointer" }}
                  >
                    {captured[it.id] ? "✓ In inbox" : "→ Inbox"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* YOUR ACTIVITY */}
      <div style={card}>
        <SectionHead color={t.hex} label={`Your activity in ${t.name}`} />
        {items === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ height: 40, borderRadius: 10, background: "rgba(255,255,255,0.045)", animation: "fh-pulse 1.4s ease infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.6 }}>
            Nothing yet — capture one of the live conversations above and reply, and it lands here.
          </div>
        ) : (
          items.map((it, i) => {
            const meta = KIND_META[it.kind];
            const tm = feedTime(it.minsAgo);
            return (
              <div key={it.id} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "9px 2px", borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.055)" : "none" }}>
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

      {/* footer actions */}
      <div style={{ display: "flex", gap: 9 }}>
        <button onClick={() => set({ tab: "content", contentTab: "ideas" })} style={{ flex: 1, background: `${t.hex}12`, color: t.hex, border: `1px solid ${t.hex}44`, borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          Post ideas for {t.name}
        </button>
        <button onClick={() => set({ tab: "engage", engageTab: "opportunities" })} style={{ flex: 1, background: "rgba(38,224,200,0.1)", color: "#26E0C8", border: "1px solid rgba(38,224,200,0.35)", borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          Open opportunity inbox
        </button>
        <button onClick={() => set({ tab: "content", contentTab: "week" })} style={{ flex: 1, background: "rgba(255,194,61,0.1)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.35)", borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          Plan this week
        </button>
      </div>
    </div>
  );
}

const ADD_PALETTE = ["#38BDF8", "#41D98A", "#C9A8FF", "#FFC23D", "#FF9A62", "#26E0C8", "#FF5D8F", "#7DD3FC"];

export default function Market() {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const opps = (state.opportunities as Opportunity[]) || [];
  const sel = state.marketSel as string | null;
  const setSel = (slug: string | null) => set({ marketSel: slug });
  const selT = strategy.territories.find((t) => t.slug === sel);
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState({ name: "", kind: "neighborhood" as NonNullable<Territory["kind"]>, segment: "growth" as Territory["segment"] });

  const addArea = () => {
    if (!na.name.trim()) return;
    const slug = na.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug || strategy.territories.some((t) => t.slug === slug)) return;
    const t: Territory = {
      slug,
      name: na.name.trim(),
      city: na.name.trim(),
      segment: na.segment,
      status: "exploring",
      hex: ADD_PALETTE[strategy.territories.length % ADD_PALETTE.length],
      kind: na.kind,
    };
    set((s) => ({ strategy: { ...(s.strategy as StrategyProfile), territories: [...(s.strategy as StrategyProfile).territories, t] } }));
    setNa({ name: "", kind: "neighborhood", segment: "growth" });
    setAdding(false);
  };

  if (selT) return <TerritoryDetail key={selT.slug} t={selT} onBack={() => setSel(null)} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#A6A4B8" }}>
          Your watchlist. Open an area and Farmhand assembles the brief, the market signals, and exactly where to start
          engaging — automatically.
        </div>
        <button onClick={() => setAdding(!adding)} style={{ marginLeft: "auto", flexShrink: 0, background: "rgba(56,189,248,0.12)", color: "#7DD3FC", border: "1px solid rgba(56,189,248,0.4)", borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {adding ? "Cancel" : "+ Add area"}
        </button>
      </div>
      {adding && (
        <div className="fh-glass" style={{ borderRadius: 13, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
          <input value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} placeholder="Area name · e.g. Verrado, 85396, Kyrene school zone" style={{ flex: "2 1 240px", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none" }} />
          <select value={na.kind} onChange={(e) => setNa({ ...na, kind: e.target.value as NonNullable<Territory["kind"]> })} style={{ fontSize: 12, color: "#F4F3F8", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 10px", outline: "none" }}>
            <option value="neighborhood">Neighborhood</option>
            <option value="zip">ZIP code</option>
            <option value="subdivision">Subdivision</option>
            <option value="school-zone">School zone</option>
          </select>
          <select value={na.segment} onChange={(e) => setNa({ ...na, segment: e.target.value as Territory["segment"] })} style={{ fontSize: 12, color: "#F4F3F8", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 10px", outline: "none" }}>
            <option value="luxury">Luxury</option>
            <option value="growth">Growth</option>
            <option value="entry">Entry</option>
            <option value="custom">Custom</option>
          </select>
          <button onClick={addArea} style={{ background: "linear-gradient(180deg,#38BDF8,#0284C7)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            Add to watchlist
          </button>
          <div style={{ width: "100%", fontSize: 10.5, color: "#5E5C72" }}>
            New areas flow everywhere automatically: ideas, radar keywords, community suggestions, coverage scoring.
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 13 }}>
        {strategy.territories.map((t) => {
          const open = opps.filter((o) => o.territory === t.name && o.status !== "skipped").length;
          return (
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
              <div style={{ padding: "10px 14px 13px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: open ? "#26E0C8" : "#8B89A0" }}>
                  {open ? `● ${open} open conversation${open > 1 ? "s" : ""}` : t.status === "own" ? "● your turf" : t.status === "building" ? "◐ building presence" : "○ exploring"}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: t.hex }}>→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
