"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { processImageURL, uid, type Asset } from "@/lib/studio";

/* ============================================================
   Multi-source stock connectors — ALL FREE:
   Auto-connected, no key, no signup:
   · Openverse   — huge CC-licensed catalog
   · StockSnap   — CC0 stock photos (served via Openverse API)
   · Wikimedia   — Wikimedia Commons
   Optional deeper catalogs (free API keys):
   · Pexels · Pixabay · Unsplash
   Searches fan out across every connected source in parallel
   and interleave results with provider attribution.
   ============================================================ */

/* Pillar → pool of search seeds for diverse auto-matching */
const PILLAR_QUERIES: Record<string, string[]> = {
  market: ["modern suburb aerial dusk", "house keys contract closeup", "desert neighborhood sunset", "real estate documents desk", "sold sign front yard"],
  story: ["family porch golden hour", "house keys handoff", "moving boxes new home", "front door welcome", "family backyard evening"],
  tips: ["desert home roofline", "storm clouds monsoon", "rain on roof tiles", "home maintenance ladder", "gutter cleaning house"],
  spotlight: ["community lake path evening", "suburban walking trail", "neighborhood park sunset", "saguaro cactus golden hour", "desert suburb street dusk"],
};

export interface StockPhoto {
  key: string;
  provider: "PEXELS" | "PIXABAY" | "UNSPLASH" | "OPENVERSE" | "STOCKSNAP" | "WIKIMEDIA";
  thumb: string;
  full: string;
  by: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  OPENVERSE: "#41D98A",
  STOCKSNAP: "#26E0C8",
  WIKIMEDIA: "#7DD3FC",
  PEXELS: "#38BDF8",
  PIXABAY: "#B98CFF",
  UNSPLASH: "#FFC23D",
};

/* ---- per-source search adapters (all client-side, all free) ---- */

async function searchOpenverse(
  q: string,
  n: number,
  source?: string
): Promise<StockPhoto[]> {
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&license_type=commercial&orientation=tall` +
    (source ? `&source=${source}` : "");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Openverse error " + res.status);
  const data = await res.json();
  interface OvResult { id: string; thumbnail?: string; url: string; creator?: string }
  const provider = source === "stocksnap" ? ("STOCKSNAP" as const) : ("OPENVERSE" as const);
  return ((data.results || []) as OvResult[])
    .filter((r) => r.thumbnail || r.url)
    .map((r) => ({
      key: (source === "stocksnap" ? "ss-" : "ov-") + r.id,
      provider,
      thumb: r.thumbnail || r.url,
      full: r.thumbnail || r.url, // thumbnail endpoint is CORS-proxied by Openverse
      by: r.creator || (source === "stocksnap" ? "StockSnap" : "Openverse"),
    }));
}

async function searchWikimedia(q: string, n: number): Promise<StockPhoto[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:bitmap ${encodeURIComponent(q)}` +
    `&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|user&iiurlwidth=900&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Wikimedia error " + res.status);
  const data = await res.json();
  interface WmPage { pageid: number; imageinfo?: { thumburl?: string; url?: string; user?: string }[] }
  const pages = Object.values((data.query && data.query.pages) || {}) as WmPage[];
  return pages
    .filter((p) => p.imageinfo && p.imageinfo[0] && (p.imageinfo[0].thumburl || p.imageinfo[0].url))
    .map((p) => ({
      key: "wm-" + p.pageid,
      provider: "WIKIMEDIA" as const,
      thumb: p.imageinfo![0].thumburl || p.imageinfo![0].url!,
      full: p.imageinfo![0].thumburl || p.imageinfo![0].url!,
      by: p.imageinfo![0].user || "Wikimedia Commons",
    }));
}

async function searchPexels(key: string, q: string, n: number): Promise<StockPhoto[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(res.status === 401 ? "Pexels key rejected" : "Pexels error " + res.status);
  const data = await res.json();
  interface PxPhoto { id: number; photographer: string; src: { tiny?: string; medium?: string; portrait?: string; large2x?: string; large?: string } }
  return ((data.photos || []) as PxPhoto[]).map((p) => ({
    key: "px-" + p.id,
    provider: "PEXELS" as const,
    thumb: p.src.tiny || p.src.medium || "",
    full: p.src.portrait || p.src.large2x || p.src.large || "",
    by: p.photographer,
  }));
}

async function searchPixabay(key: string, q: string, n: number): Promise<StockPhoto[]> {
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=${n}&orientation=vertical&image_type=photo&safesearch=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 400 ? "Pixabay key rejected" : "Pixabay error " + res.status);
  const data = await res.json();
  interface PbHit { id: number; previewURL: string; webformatURL: string; largeImageURL?: string; user: string }
  return ((data.hits || []) as PbHit[]).map((h) => ({
    key: "pb-" + h.id,
    provider: "PIXABAY" as const,
    thumb: h.previewURL || h.webformatURL,
    full: h.largeImageURL || h.webformatURL,
    by: h.user,
  }));
}

async function searchUnsplash(key: string, q: string, n: number): Promise<StockPhoto[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait&client_id=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 401 ? "Unsplash key rejected" : "Unsplash error " + res.status);
  const data = await res.json();
  interface UsPhoto { id: string; urls: { thumb: string; small: string; regular: string }; user: { name: string } }
  return ((data.results || []) as UsPhoto[]).map((p) => ({
    key: "us-" + p.id,
    provider: "UNSPLASH" as const,
    thumb: p.urls.thumb || p.urls.small,
    full: p.urls.regular,
    by: p.user.name,
  }));
}

/* interleave results source-by-source so no provider dominates */
function interleave(lists: StockPhoto[][]): StockPhoto[] {
  const out: StockPhoto[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++)
    for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

export default function StockPanel({ pillar }: { pillar: string }) {
  const { state, set } = useStore();
  const pexelsKey = state.pexelsKey;
  const pixabayKey = (state.pixabayKey as string) || "";
  const unsplashKey = (state.unsplashKey as string) || "";

  const [q, setQ] = useState("");
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [err, setErr] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [drafts, setDrafts] = useState({ pexels: "", pixabay: "", unsplash: "" });

  const sources: { id: string; label: string; on: boolean }[] = [
    { id: "openverse", label: "Openverse", on: true },
    { id: "stocksnap", label: "StockSnap", on: true },
    { id: "wikimedia", label: "Wikimedia", on: true },
    { id: "pexels", label: "Pexels", on: !!pexelsKey },
    { id: "pixabay", label: "Pixabay", on: !!pixabayKey },
    { id: "unsplash", label: "Unsplash", on: !!unsplashKey },
  ];
  const connectedCount = sources.filter((s) => s.on).length;

  const addAsset = (a: Omit<Asset, "id">) =>
    set((s) => ({ stAssets: [...s.stAssets, { ...a, id: uid() }].slice(-40) }));

  /* fan-out search across every connected source (3 keyless + any keyed) */
  async function fanOut(term: string, per: number): Promise<StockPhoto[]> {
    const jobs: Promise<StockPhoto[]>[] = [
      searchOpenverse(term, per).catch(() => []),
      searchOpenverse(term, per, "stocksnap").catch(() => []),
      searchWikimedia(term, per).catch(() => []),
    ];
    if (pexelsKey) jobs.push(searchPexels(pexelsKey, term, per).catch(() => []));
    if (pixabayKey) jobs.push(searchPixabay(pixabayKey, term, per).catch(() => []));
    if (unsplashKey) jobs.push(searchUnsplash(unsplashKey, term, per).catch(() => []));
    const lists = await Promise.all(jobs);
    return interleave(lists);
  }

  async function run(query?: string) {
    const term = (query != null ? query : q).trim();
    if (!term) return;
    setLoading(true);
    setErr("");
    try {
      const all = await fanOut(term, 8);
      setResults(all.slice(0, 18));
      if (!all.length) setErr("No results — try different words.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    }
    setLoading(false);
  }

  async function addToLibrary(r: StockPhoto) {
    setAdding(r.key);
    const p = await processImageURL(r.full, 1200, 0.82);
    if (p)
      addAsset({
        name: r.provider.toLowerCase() + "-" + r.key,
        dataURL: p.dataURL,
        lum: p.lum,
        busy: p.busy,
        source: r.provider.toLowerCase(),
      });
    setAdding(null);
  }

  /* Auto-match: pillar-keyed seeds across ALL connected sources,
     keep the darkest/cleanest (most text-legible) picks */
  async function autoMatch() {
    setMatching(true);
    setErr("");
    const seeds = (PILLAR_QUERIES[pillar] || PILLAR_QUERIES.tips).slice();
    const pick = seeds[Math.floor(Math.random() * seeds.length)];
    try {
      const photos = await fanOut(pick, 6);
      const scored: { r: StockPhoto; p: { dataURL: string; lum: number; busy: number } }[] = [];
      for (const r of photos.slice(0, 9)) {
        const p = await processImageURL(r.full, 1200, 0.82);
        if (p) scored.push({ r, p });
      }
      scored.sort(
        (a, b) => a.p.lum * 0.62 + a.p.busy * 0.38 - (b.p.lum * 0.62 + b.p.busy * 0.38)
      );
      scored
        .slice(0, 3)
        .forEach(({ r, p }) =>
          addAsset({ name: r.provider.toLowerCase() + "-" + r.key, dataURL: p.dataURL, lum: p.lum, busy: p.busy, source: r.provider.toLowerCase() })
        );
      if (!scored.length) setErr("No matches found — try a manual search.");
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

  const keyRow = (
    id: "pexels" | "pixabay" | "unsplash",
    label: string,
    saved: string,
    savePatch: (v: string) => Record<string, unknown>,
    helpUrl: string
  ) => (
    <div key={id} style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: PROVIDER_COLORS[id.toUpperCase()], fontFamily: "var(--mono)" }}>{label}</span>
        {saved ? (
          <>
            <span style={{ fontSize: 10, color: "#41D98A" }}>● connected</span>
            <button
              onClick={() => set(savePatch(""))}
              style={{ marginLeft: "auto", fontSize: 9.5, color: "#6E6C82", background: "none", border: "none", cursor: "pointer" }}
            >
              disconnect
            </button>
          </>
        ) : (
          <a href={helpUrl} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 9.5, color: "#7DD3FC" }}>
            get free key ↗
          </a>
        )}
      </div>
      {!saved && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            style={{ ...inputStyle, fontSize: 11.5, padding: "6px 9px" }}
            placeholder={label + " API key"}
            value={drafts[id]}
            onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
          />
          <button
            onClick={() => drafts[id].trim() && set(savePatch(drafts[id].trim()))}
            style={{ background: "rgba(65,217,138,0.14)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 7, padding: "6px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fh-glass" style={{ borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span className="fh-kicker" style={{ fontSize: 10 }}>
          Stock · {connectedCount} source{connectedCount > 1 ? "s" : ""} connected
        </span>
        <button
          onClick={() => setShowKeys(!showKeys)}
          style={{ marginLeft: "auto", fontSize: 10, color: "#8B89A0", background: "none", border: "none", cursor: "pointer" }}
        >
          {showKeys ? "hide sources" : "manage sources"}
        </button>
      </div>

      {/* source chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {sources.map((s) => (
          <span
            key={s.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 9.5,
              fontWeight: 700,
              fontFamily: "var(--mono)",
              color: s.on ? PROVIDER_COLORS[s.id.toUpperCase()] : "#6E6C82",
              background: s.on ? `${PROVIDER_COLORS[s.id.toUpperCase()]}14` : "rgba(255,255,255,0.03)",
              border: `1px solid ${s.on ? PROVIDER_COLORS[s.id.toUpperCase()] + "44" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 999,
              padding: "3px 9px",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.on ? PROVIDER_COLORS[s.id.toUpperCase()] : "#4A4860" }} />
            {s.label}
          </span>
        ))}
      </div>

      {showKeys && (
        <div style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 11, marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, color: "#8B89A0", lineHeight: 1.5, marginBottom: 10 }}>
            <b style={{ color: "#41D98A" }}>Openverse, StockSnap &amp; Wikimedia are built in — free, no keys, always on.</b> Optionally connect the catalogs below with free API keys for even deeper results; searches pull from every connected source at once.
          </div>
          {keyRow("pexels", "PEXELS", pexelsKey, (v) => ({ pexelsKey: v }), "https://www.pexels.com/api/")}
          {keyRow("pixabay", "PIXABAY", pixabayKey, (v) => ({ pixabayKey: v }), "https://pixabay.com/api/docs/")}
          {keyRow("unsplash", "UNSPLASH", unsplashKey, (v) => ({ unsplashKey: v }), "https://unsplash.com/developers")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          style={inputStyle}
          placeholder="Search free photos…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button
          onClick={() => run()}
          disabled={loading}
          style={{ background: "rgba(56,189,248,0.14)", color: "#7DD3FC", border: "1px solid rgba(56,189,248,0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      <button
        onClick={autoMatch}
        disabled={matching}
        style={{ width: "100%", marginBottom: 10, background: "rgba(255,194,61,0.1)", color: "#FFC23D", border: "1px dashed rgba(255,194,61,0.4)", borderRadius: 8, padding: "8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
      >
        {matching ? "Matching across sources…" : "✨ Auto-match photos to this post"}
      </button>
      {err && <div style={{ fontSize: 11, color: "#FF5D8F", marginBottom: 8 }}>{err}</div>}

      {results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, maxHeight: 240, overflowY: "auto", paddingRight: 2 }}>
          {results.map((r) => (
            <button
              key={r.key}
              onClick={() => addToLibrary(r)}
              title={`${r.by} · ${r.provider} — click to add to your library`}
              style={{
                position: "relative",
                padding: 0,
                borderRadius: 8,
                overflow: "hidden",
                aspectRatio: "1",
                border: "1px solid rgba(255,255,255,0.1)",
                background: `#16162A url(${r.thumb}) center/cover`,
                cursor: "pointer",
                opacity: adding === r.key ? 0.5 : 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  bottom: 3,
                  left: 3,
                  fontSize: 6.5,
                  fontWeight: 700,
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.04em",
                  color: "#0B0B16",
                  background: PROVIDER_COLORS[r.provider],
                  borderRadius: 3,
                  padding: "1px 4px",
                }}
              >
                {r.provider}
              </span>
              {adding === r.key && (
                <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.5)" }}>
                  adding…
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: "#6E6C82", marginTop: 8, lineHeight: 1.4 }}>
        All sources are free-license. Click any result to analyze + add it to your library — provider attribution is kept on every image.
      </div>
    </div>
  );
}
