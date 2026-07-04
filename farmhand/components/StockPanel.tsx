"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { processImageURL, uid, type Asset } from "@/lib/studio";

/* Pillar → pool of search seeds for diverse auto-matching
   (Farmhand realtor pillars, same mechanism as the Coyote engine) */
const PILLAR_QUERIES: Record<string, string[]> = {
  market: ["modern suburb aerial dusk", "house keys contract closeup", "desert neighborhood sunset", "real estate documents desk", "sold sign front yard"],
  story: ["family porch golden hour", "house keys handoff", "moving boxes new home", "front door welcome", "family backyard evening"],
  tips: ["desert home roofline", "storm clouds monsoon", "rain on roof tiles", "home maintenance ladder", "gutter cleaning house"],
  spotlight: ["community lake path evening", "suburban walking trail", "neighborhood park sunset", "saguaro cactus golden hour", "desert suburb street dusk"],
};

interface StockPhoto {
  id: number;
  thumb: string;
  full: string;
  link: string;
  by: string;
}

async function pexelsSearch(key: string, query: string, perPage = 12, page = 1): Promise<StockPhoto[]> {
  const url =
    "https://api.pexels.com/v1/search?query=" +
    encodeURIComponent(query) +
    "&per_page=" +
    perPage +
    "&page=" +
    page +
    "&orientation=portrait";
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok)
    throw new Error(
      res.status === 401 ? "That API key was rejected — double-check it." : "Pexels error " + res.status
    );
  const data = await res.json();
  interface PexelsPhoto {
    id: number;
    url: string;
    photographer: string;
    src: { tiny?: string; medium?: string; portrait?: string; large2x?: string; large?: string };
  }
  return ((data.photos || []) as PexelsPhoto[]).map((p) => ({
    id: p.id,
    thumb: p.src.tiny || p.src.medium || "",
    full: p.src.portrait || p.src.large2x || p.src.large || "",
    link: p.url,
    by: p.photographer,
  }));
}

export default function StockPanel({ pillar }: { pillar: string }) {
  const { state, set } = useStore();
  const key = state.pexelsKey;
  const [draftKey, setDraftKey] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [err, setErr] = useState("");

  const addAsset = (a: Omit<Asset, "id">) =>
    set((s) => ({ stAssets: [...s.stAssets, { ...a, id: uid() }].slice(-40) }));

  async function run(query?: string) {
    const term = (query != null ? query : q).trim();
    if (!term || !key) return;
    setLoading(true);
    setErr("");
    try {
      setResults(await pexelsSearch(key, term, 12));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    }
    setLoading(false);
  }

  async function addToLibrary(r: StockPhoto) {
    setAdding(r.id);
    const p = await processImageURL(r.full, 1200, 0.82);
    if (p) addAsset({ name: "pexels-" + r.id, dataURL: p.dataURL, lum: p.lum, busy: p.busy, source: "pexels" });
    setAdding(null);
  }

  /* Auto-match: search pillar-keyed seeds, pull the darkest/cleanest results */
  async function autoMatch() {
    if (!key) return;
    setMatching(true);
    setErr("");
    const seeds = (PILLAR_QUERIES[pillar] || PILLAR_QUERIES.tips).slice();
    const pick = seeds[Math.floor(Math.random() * seeds.length)];
    try {
      const photos = await pexelsSearch(key, pick, 15, 1 + Math.floor(Math.random() * 2));
      const scored: { r: StockPhoto; p: { dataURL: string; lum: number; busy: number } }[] = [];
      for (const r of photos.slice(0, 8)) {
        const p = await processImageURL(r.full, 1200, 0.82);
        if (p) scored.push({ r, p });
      }
      scored.sort((a, b) => a.p.lum * 0.62 + a.p.busy * 0.38 - (b.p.lum * 0.62 + b.p.busy * 0.38));
      scored.slice(0, 3).forEach(({ r, p }) =>
        addAsset({ name: "pexels-" + r.id, dataURL: p.dataURL, lum: p.lum, busy: p.busy, source: "pexels" })
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Auto-match failed");
    }
    setMatching(false);
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontFamily: "var(--body)",
    fontSize: 12.5,
    color: "#F4F3F8",
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "8px 11px",
    outline: "none",
  };

  return (
    <div className="fh-glass" style={{ borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span className="fh-kicker" style={{ fontSize: 10 }}>
          Stock · Pexels
        </span>
        {key && (
          <button
            onClick={() => set({ pexelsKey: "" })}
            style={{ marginLeft: "auto", fontSize: 10, color: "#6E6C82", background: "none", border: "none", cursor: "pointer" }}
          >
            change key
          </button>
        )}
      </div>

      {!key ? (
        <div>
          <div style={{ fontSize: 11.5, color: "#8B89A0", lineHeight: 1.5, marginBottom: 10 }}>
            Search free stock photos right here — grab a free API key at{" "}
            <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" style={{ color: "#7DD3FC" }}>
              pexels.com/api
            </a>{" "}
            and paste it once.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="Pexels API key"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
            />
            <button
              onClick={() => draftKey.trim() && set({ pexelsKey: draftKey.trim() })}
              style={{
                background: "rgba(65,217,138,0.14)",
                color: "#41D98A",
                border: "1px solid rgba(65,217,138,0.4)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              style={inputStyle}
              placeholder="Search photos…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
            <button
              onClick={() => run()}
              disabled={loading}
              style={{
                background: "rgba(56,189,248,0.14)",
                color: "#7DD3FC",
                border: "1px solid rgba(56,189,248,0.4)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loading ? "…" : "Search"}
            </button>
          </div>
          <button
            onClick={autoMatch}
            disabled={matching}
            style={{
              width: "100%",
              marginBottom: 10,
              background: "rgba(255,194,61,0.1)",
              color: "#FFC23D",
              border: "1px dashed rgba(255,194,61,0.4)",
              borderRadius: 8,
              padding: "8px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {matching ? "Matching…" : "✨ Auto-match photos to this post"}
          </button>
          {err && <div style={{ fontSize: 11, color: "#FF5D8F", marginBottom: 8 }}>{err}</div>}
          {results.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addToLibrary(r)}
                  title={`Photo by ${r.by} on Pexels — click to add to your library`}
                  style={{
                    position: "relative",
                    padding: 0,
                    borderRadius: 8,
                    overflow: "hidden",
                    aspectRatio: "1",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: `#16162A url(${r.thumb}) center/cover`,
                    cursor: "pointer",
                    opacity: adding === r.id ? 0.5 : 1,
                  }}
                >
                  {adding === r.id && (
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.5)" }}>
                      adding…
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#6E6C82", marginTop: 8, lineHeight: 1.4 }}>
            Photos from Pexels (free license). Click any result to analyze + add it to your library below.
          </div>
        </div>
      )}
    </div>
  );
}
