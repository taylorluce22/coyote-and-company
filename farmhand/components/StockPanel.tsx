"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { processImageURL, uid, type Asset } from "@/lib/studio";
import { vaultAdd } from "@/lib/vault";
import { AESTHETIC_PACKS, singlePrompt } from "@/lib/postVisuals";

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


/* ============================================================
   Higgsfield AI generation — custom on-brand visuals instead of
   hoping stock has the shot. Server route holds the keys and
   polls the async Soul job; results land in the same asset
   library as stock photos (proxied so canvas processing works).
   ============================================================ */
const HF_SEEDS: Record<string, string> = {
  solar:
    "Golden hour photo of a modern Arizona suburban home with rooftop solar panels, saguaro and desert landscaping, warm editorial photography, no text",
  realtor:
    "Golden hour photo of a welcoming Arizona suburban neighborhood street, desert landscaping, warm editorial photography, no text",
};

function HiggsfieldGen({ addAsset }: { addAsset: (a: Omit<Asset, "id">) => void }) {
  const { state } = useStore();
  const vertical = ((state.strategy as { vertical?: string })?.vertical) === "solar" ? "solar" : "realtor";
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState(HF_SEEDS[vertical]);
  const [busy, setBusy] = useState(false);
  const [gErr, setGErr] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/higgsfield")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setConfigured(!!j?.configured))
      .catch(() => setConfigured(false));
  }, []);

  const generate = async () => {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setGErr("");
    setImages([]);
    try {
      const r = await fetch("/api/higgsfield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(120000),
      });
      const d = await r.json();
      if (d.error) setGErr(String(d.error));
      setImages(Array.isArray(d.images) ? d.images : []);
    } catch {
      setGErr("generation request failed — try again");
    }
    setBusy(false);
  };

  const save = async (url: string) => {
    setSaving(url);
    // proxy through our API so the canvas pipeline isn't CORS-tainted
    const p = await processImageURL(`/api/higgsfield?img=${encodeURIComponent(url)}`, 1200, 0.85);
    if (p) {
      addAsset({ name: "higgsfield-" + Date.now(), dataURL: p.dataURL, lum: p.lum, busy: p.busy, source: "higgsfield" });
      // permanent vault copy — generated images cost credits, never lose them
      vaultAdd({ id: uid(), dataURL: p.dataURL, lum: p.lum, busy: p.busy, prompt, label: "Single image", createdAt: Date.now() });
    }
    setSaving(null);
  };

  return (
    <div style={{ marginBottom: 12, background: "rgba(201,168,255,0.05)", border: "1px solid rgba(201,168,255,0.25)", borderRadius: 11, padding: "11px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", fontFamily: "var(--label)", color: "#C9A8FF" }}>✨ AI GENERATE · HIGGSFIELD</span>
        {configured === false && <span style={{ fontSize: 9.5, color: "#FFC23D", fontWeight: 700 }}>needs keys</span>}
      </div>
      {configured === false ? (
        <div style={{ fontSize: 10.5, color: "#8B89A0", lineHeight: 1.55 }}>
          Create an API key at <b style={{ color: "#C9A8FF" }}>cloud.higgsfield.ai/api-keys</b>, then add{" "}
          <span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>HIGGSFIELD_API_KEY</span> and{" "}
          <span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>HIGGSFIELD_API_SECRET</span> in Vercel → Settings →
          Environment Variables → redeploy. After that, custom on-brand images generate right here.
        </div>
      ) : (
        <>
          {/* aesthetic packs — preset first, short prompt second (craft playbook) */}
          <div className="fh-hscroll" style={{ display: "flex", gap: 5, marginBottom: 7, paddingBottom: 2 }}>
            {AESTHETIC_PACKS.map((p) => (
              <button
                key={p.id}
                title={p.style}
                onClick={() => setPrompt(singlePrompt(vertical, p))}
                style={{ flexShrink: 0, background: "rgba(201,168,255,0.08)", border: "1px solid rgba(201,168,255,0.25)", color: "#C9A8FF", borderRadius: 999, padding: "3px 9px", fontSize: 9.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            style={{ width: "100%", resize: "vertical", fontFamily: "var(--body)", fontSize: 11.5, lineHeight: 1.5, color: "#F4F3F8", background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", outline: "none" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
            <button
              onClick={generate}
              disabled={busy || configured === null}
              style={{ background: busy ? "rgba(255,255,255,0.06)" : "rgba(201,168,255,0.16)", color: busy ? "#8B89A0" : "#C9A8FF", border: "1px solid rgba(201,168,255,0.4)", borderRadius: 8, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, cursor: busy ? "default" : "pointer" }}
            >
              {busy ? "Generating… ~30–60s" : "✨ Generate image"}
            </button>
            <button
              onClick={() => setPrompt(HF_SEEDS[vertical])}
              style={{ background: "none", border: "none", color: "#77758C", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}
            >
              reset prompt
            </button>
          </div>
          {gErr && <div style={{ fontSize: 10.5, color: "#FF5D8F", marginTop: 7 }}>{gErr}</div>}
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
              {images.map((u) => (
                <button key={u} onClick={() => save(u)} disabled={!!saving} title="Add to your image library" style={{ position: "relative", width: 92, height: 92, borderRadius: 9, overflow: "hidden", border: "1px solid rgba(201,168,255,0.35)", padding: 0, cursor: "pointer", background: "#0B0B16" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/higgsfield?img=${encodeURIComponent(u)}`} alt="generated" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: saving === u ? 0.4 : 1 }} />
                  {saving === u && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9.5, color: "#C9A8FF", fontWeight: 700 }}>adding…</span>}
                </button>
              ))}
            </div>
          )}
          {images.length > 0 && <div style={{ fontSize: 9.5, color: "#77758C", marginTop: 6 }}>Tap an image to add it to your library — it then works like any photo below.</div>}
        </>
      )}
    </div>
  );
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

  /* app-side keys (Vercel env vars) — connected once for every device, forever */
  const [server, setServer] = useState({ pexels: false, pixabay: false, unsplash: false });
  useEffect(() => {
    fetch("/api/stock")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setServer(j))
      .catch(() => {});
  }, []);

  const pexelsOn = server.pexels || !!pexelsKey;
  const pixabayOn = server.pixabay || !!pixabayKey;
  const unsplashOn = server.unsplash || !!unsplashKey;

  const sources: { id: string; label: string; on: boolean }[] = [
    { id: "openverse", label: "Openverse", on: true },
    { id: "stocksnap", label: "StockSnap", on: true },
    { id: "wikimedia", label: "Wikimedia", on: true },
    { id: "pexels", label: "Pexels", on: pexelsOn },
    { id: "pixabay", label: "Pixabay", on: pixabayOn },
    { id: "unsplash", label: "Unsplash", on: unsplashOn },
  ];
  const connectedCount = sources.filter((s) => s.on).length;

  const addAsset = (a: Omit<Asset, "id">) =>
    set((s) => ({ stAssets: [...s.stAssets, { ...a, id: uid() }].slice(-40) }));

  /* fan-out search across every connected source (3 keyless + any keyed).
     App-side keys are proxied through /api/stock so they never need
     reconnecting; browser-pasted keys act as a fallback. */
  async function fanOut(term: string, per: number): Promise<StockPhoto[]> {
    const jobs: Promise<StockPhoto[][]>[] = [
      searchOpenverse(term, per).then((l) => [l]).catch(() => [[]]),
      searchOpenverse(term, per, "stocksnap").then((l) => [l]).catch(() => [[]]),
      searchWikimedia(term, per).then((l) => [l]).catch(() => [[]]),
    ];
    if (server.pexels || server.pixabay || server.unsplash) {
      jobs.push(
        fetch(`/api/stock?q=${encodeURIComponent(term)}&n=${per}`)
          .then((r) => (r.ok ? r.json() : { lists: [] }))
          .then((j) => (j.lists || []) as StockPhoto[][])
          .catch(() => [[]])
      );
    }
    if (!server.pexels && pexelsKey) jobs.push(searchPexels(pexelsKey, term, per).then((l) => [l]).catch(() => [[]]));
    if (!server.pixabay && pixabayKey) jobs.push(searchPixabay(pixabayKey, term, per).then((l) => [l]).catch(() => [[]]));
    if (!server.unsplash && unsplashKey) jobs.push(searchUnsplash(unsplashKey, term, per).then((l) => [l]).catch(() => [[]]));
    const nested = await Promise.all(jobs);
    return interleave(nested.flat());
  }

  async function run(query?: string) {
    const term = (query != null ? query : q).trim();
    if (!term) return;
    setLoading(true);
    setErr("");
    try {
      const all = await fanOut(term, 8);
      setResults(all.slice(0, 20));
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

  /* Auto-match: pillar-keyed seeds across ALL connected sources.
     Pulls 20 different candidate options (two seed queries per source
     for variety), deduped and interleaved — tap any option to add it. */
  async function autoMatch() {
    setMatching(true);
    setErr("");
    const seeds = (PILLAR_QUERIES[pillar] || PILLAR_QUERIES.tips).slice();
    // two distinct seeds → broader variety across the same post subject
    const i1 = Math.floor(Math.random() * seeds.length);
    let i2 = Math.floor(Math.random() * seeds.length);
    if (i2 === i1) i2 = (i2 + 1) % seeds.length;
    try {
      const [batch1, batch2] = await Promise.all([fanOut(seeds[i1], 5), fanOut(seeds[i2], 5)]);
      const seen = new Set<string>();
      const options: StockPhoto[] = [];
      for (const r of interleave([batch1, batch2])) {
        if (seen.has(r.key)) continue;
        seen.add(r.key);
        options.push(r);
        if (options.length >= 20) break;
      }
      setResults(options);
      if (!options.length) setErr("No matches found — try a manual search.");
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
  ) => {
    if (server[id])
      return (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: PROVIDER_COLORS[id.toUpperCase()], fontFamily: "var(--mono)" }}>{label}</span>
          <span style={{ fontSize: 10, color: "#41D98A" }}>● connected in the app — permanent, all devices</span>
        </div>
      );
    return (
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
  };

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

      <HiggsfieldGen addAsset={addAsset} />

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
