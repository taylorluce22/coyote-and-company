"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useStore, defaultChannelStudio, type ChannelStudio } from "@/lib/store";
import PostSlide from "@/components/PostSlide";
import StockPanel from "@/components/StockPanel";
import {
  STUDIO_RATIOS,
  copyToSlides,
  coordinatedPool,
  downloadDataUrl,
  pickTextures,
  processImageFile,
  slugify,
  uid,
  type Bg,
  type StudioDesign,
} from "@/lib/studio";
import { textures } from "@/lib/textures";
import { COMP_COPY, type CompCh } from "@/lib/data";

/* ---- content model (Farmhand): per-channel variants of the post ---- */
const CHANNELS: [CompCh, string][] = [
  ["ig", "Instagram"],
  ["fb", "Facebook"],
  ["nd", "Nextdoor"],
];
const CTAS: Record<CompCh, string> = {
  ig: "Save the checklist. Roof first, storms later.",
  fb: "Share this with a neighbor before the storms hit.",
  nd: "Happy to share my full checklist — just ask below.",
};
const HASHTAGS: Record<CompCh, string[]> = {
  ig: ["gilbertaz", "gilbertrealtor", "eastvalley", "monsoonseason", "azrealestate", "homeownertips", "arizonaliving", "85234", "valvistalakes", "roofcheck"],
  fb: ["GilbertAZ", "EastValley", "MonsoonSeason", "HomeownerTips", "ArizonaLiving"],
  nd: ["gilbert", "monsoonprep", "homeownertips", "eastvalley"],
};
const PILLAR = { short: "Tips", color: "#37D98A" };
const ACCENTS: Record<string, string> = {
  cyan: "#38BDF8",
  violet: "#B98CFF",
  green: "#37D98A",
  amber: "#FFC23D",
  rose: "#FF5D8F",
};
const STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "ready", label: "Ready" },
  { id: "scheduled", label: "Scheduled" },
  { id: "posted", label: "Posted" },
];

/* ---- small UI atoms (studio parity) ---- */
function Seg({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 3,
        flexWrap: "wrap",
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "6px 11px",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            background: value === o.id ? "rgba(255,93,143,0.18)" : "transparent",
            color: value === o.id ? "#FF5D8F" : "#8B89A0",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 2px" }}>
      <span style={{ fontSize: 13, color: "#A6A4B8", whiteSpace: "nowrap" }}>{label}</span>
      <button
        role="switch"
        aria-checked={on}
        onClick={onClick}
        style={{
          position: "relative",
          width: 36,
          height: 20,
          borderRadius: 99,
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background .25s ease",
          background: on ? "#FF5D8F" : "rgba(255,255,255,0.14)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#F4F3F8",
            transition: "left .25s ease",
            left: on ? 18 : 2,
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        />
      </button>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
      style={{
        border: `1px solid ${ok ? "rgba(65,217,138,0.4)" : "rgba(255,255,255,0.14)"}`,
        background: ok ? "rgba(65,217,138,0.14)" : "none",
        color: ok ? "#41D98A" : "#A6A4B8",
        borderRadius: 7,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {ok ? "Copied ✓" : "Copy"}
    </button>
  );
}

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--label)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#8D89C0",
  marginBottom: 7,
};

export default function Composer() {
  const { state, set } = useStore();
  const ch = state.compChannel;
  const variant = COMP_COPY[ch];
  const copyText = state.compShort ? variant.short : state.compRegen ? variant.alt : variant.long;
  const accent = ACCENTS[state.compAccent] || ACCENTS.cyan;

  /* slides derived from the live copy (cover / body / CTA) */
  const slides = useMemo(() => copyToSlides(copyText, CTAS[ch]), [copyText, ch]);
  const total = slides.length;
  const [idx, setIdx] = useState(0);
  const cur = Math.min(idx, total - 1);
  const slide = slides[cur];

  /* per-channel persisted studio look (design + per-slide backgrounds) */
  const studio: ChannelStudio = useMemo(() => {
    if (state.stStudio[ch]) return state.stStudio[ch];
    const picks = pickTextures("tips", copyText, ch);
    const d = defaultChannelStudio();
    d.design = { ...d.design, ratio: state.compRatio || "portrait" };
    d.coverBg = { type: "texture", tex: picks.cover };
    d.design = d.design; // bg stored separately below
    return { ...d, slideBg: {}, coverBg: { type: "texture", tex: picks.cover } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stStudio, ch]);

  const design = studio.design;
  const slideBg = studio.slideBg;
  const bodyTex = useMemo(() => pickTextures("tips", copyText, ch).body, [copyText, ch]);
  const defaultBg: Bg = useMemo(() => ({ type: "texture", tex: bodyTex }), [bodyTex]);

  const saveStudio = useCallback(
    (patch: Partial<ChannelStudio>) => {
      set((s) => ({
        stStudio: { ...s.stStudio, [ch]: { ...(s.stStudio[ch] || studio), ...patch } },
      }));
    },
    [set, ch, studio]
  );
  const setD = (k: keyof StudioDesign, v: unknown) =>
    saveStudio({ design: { ...design, [k]: v } as StudioDesign });

  const bgFor = (i: number): Bg =>
    slideBg[i] || (i === 0 && studio.coverBg ? studio.coverBg : (design as StudioDesign & { bg?: Bg }).bg || defaultBg);
  const activeBg = bgFor(cur);

  const [applyAll, setApplyAll] = useState(false);
  /* apply a background pick — exact Post Studio behavior:
     cover edits only the cover; applyAll batches body slides; else just this slide */
  function applyBg(b: Bg) {
    if (total <= 1) {
      saveStudio({ design: { ...design, bg: b } as StudioDesign, coverBg: null, slideBg: {} });
      return;
    }
    if (cur === 0) {
      const nb = { ...slideBg };
      delete nb[0];
      saveStudio({ coverBg: b, slideBg: nb });
    } else if (applyAll) {
      const nb: Record<number, Bg> = {};
      if (slideBg[0]) nb[0] = slideBg[0];
      saveStudio({ design: { ...design, bg: b } as StudioDesign, slideBg: nb });
    } else {
      saveStudio({ slideBg: { ...slideBg, [cur]: b } });
    }
  }

  const targetBg: Bg =
    total <= 1
      ? (design as StudioDesign & { bg?: Bg }).bg || defaultBg
      : cur === 0
        ? studio.coverBg || defaultBg
        : slideBg[cur] || (design as StudioDesign & { bg?: Bg }).bg || defaultBg;
  const isActive = (b: Bg) =>
    targetBg.type === b.type &&
    (targetBg as { tex?: string }).tex === (b as { tex?: string }).tex &&
    (targetBg as { img?: string }).img === (b as { img?: string }).img;

  /* ---- image library (analyzed, persisted, auto-fill) ---- */
  const assets = state.stAssets;
  const fileRef = useRef<HTMLInputElement>(null);
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const f of files) {
      try {
        const r = await processImageFile(f, 1200, 0.8);
        set((s) => ({
          stAssets: [...s.stAssets, { id: uid(), name: f.name.replace(/\.[^.]+$/, ""), dataURL: r.dataURL, lum: r.lum, busy: r.busy }].slice(-40),
        }));
      } catch {}
    }
  }
  function assignImages(mode: "cover" | "all") {
    const pool = coordinatedPool(assets);
    if (!pool.length) return;
    if (mode === "cover") {
      saveStudio({ slideBg: { ...slideBg, 0: { type: "image", img: pool[0] } } });
    } else {
      const nb: Record<number, Bg> = {};
      for (let i = 0; i < total; i++) nb[i] = { type: "image", img: pool[i % pool.length] };
      saveStudio({ slideBg: nb });
    }
  }

  /* ---- stage scaling (full-res slide scaled to fit) ---- */
  const ratio = STUDIO_RATIOS.find((r) => r.id === design.ratio) || STUDIO_RATIOS[0];
  const stageRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    function fit() {
      const stage = stageRef.current;
      if (!stage) return;
      setScale(Math.min((stage.clientWidth - 24) / ratio.w, 620 / ratio.h));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [ratio.w, ratio.h, total]);

  /* ---- capture & export (html2canvas, studio parity) ---- */
  const [busy, setBusy] = useState(false);
  const capture = useCallback(async (): Promise<string | null> => {
    if (!slideRef.current) return null;
    try {
      await document.fonts.ready;
    } catch {}
    const imgs = Array.from(slideRef.current.querySelectorAll("img"));
    await Promise.all(
      imgs.map((im) =>
        im.complete && im.naturalWidth
          ? Promise.resolve()
          : im.decode
            ? im.decode().catch(() => {})
            : new Promise<void>((r) => {
                im.onload = im.onerror = () => r();
              })
      )
    );
    const canvas = await html2canvas(slideRef.current, {
      scale: 2,
      backgroundColor: "#0A0A0A",
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: ratio.w,
      height: ratio.h,
      windowWidth: ratio.w,
      windowHeight: ratio.h,
    });
    return canvas.toDataURL("image/png");
  }, [ratio.w, ratio.h]);

  async function downloadCurrent() {
    setBusy(true);
    try {
      const url = await capture();
      if (url) downloadDataUrl(url, `${slugify("monsoon-roof-check-" + ch)}-${String(cur + 1).padStart(2, "0")}.png`);
    } catch {}
    setBusy(false);
  }
  const raf = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function downloadAll() {
    if (total <= 1) return downloadCurrent();
    setBusy(true);
    try {
      for (let i = 0; i < total; i++) {
        setIdx(i);
        await raf();
        await sleep(170);
        const url = await capture();
        if (url) downloadDataUrl(url, `${slugify("monsoon-roof-check-" + ch)}-${String(i + 1).padStart(2, "0")}.png`);
        await sleep(380);
      }
    } catch {}
    setBusy(false);
  }

  const status = state.compStatus[ch] || "draft";
  const setStatus = (v: string) => set((s) => ({ compStatus: { ...s.compStatus, [ch]: v } }));

  const texList = typeof window !== "undefined" ? textures.all() : [];
  const tags = HASHTAGS[ch].map((h) => "#" + h).join(" ");

  return (
    <div
      className="fh-enggrid"
      style={{ gridTemplateColumns: "minmax(0,1fr) 330px" }}
    >
      {/* ============ MAIN: stage ============ */}
      <div style={{ minWidth: 0 }}>
        {/* top bar: channel select + variants + export + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <Seg
            value={ch}
            onChange={(v) => {
              set({ compChannel: v as CompCh });
              setIdx(0);
            }}
            options={CHANNELS.map(([id, label]) => ({ id, label }))}
          />
          <button
            onClick={() => set({ compRegen: !state.compRegen, compShort: false })}
            style={{ background: "rgba(168,85,247,0.14)", color: "#C9A8FF", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {state.compRegen ? "Original" : "Regenerate"}
          </button>
          <button
            onClick={() => set({ compShort: !state.compShort })}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.14)", color: "#A6A4B8", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {state.compShort ? "Full length" : "Shorter"}
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={downloadCurrent}
              disabled={busy}
              style={{ background: "rgba(255,194,61,0.14)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {busy ? "…" : "↓ Slide"}
            </button>
            <button
              onClick={downloadAll}
              disabled={busy}
              style={{ background: "rgba(255,194,61,0.14)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {busy ? "Exporting…" : total > 1 ? `↓ Download all (${total})` : "↓ Download PNG"}
            </button>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              title="Post status"
              style={{ background: "rgba(0,0,0,0.28)", color: "#F4F3F8", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)" }}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              disabled={status !== "draft"}
              onClick={() => setStatus("ready")}
              style={{
                background: status === "draft" ? "linear-gradient(180deg,#7DD3FC,#38BDF8)" : "rgba(65,217,138,0.16)",
                color: status === "draft" ? "#04121f" : "#41D98A",
                border: status === "draft" ? "none" : "1px solid rgba(65,217,138,0.4)",
                borderRadius: 9,
                padding: "7px 15px",
                fontSize: 12,
                fontWeight: 800,
                cursor: status === "draft" ? "pointer" : "default",
                boxShadow: status === "draft" ? "0 6px 20px rgba(56,189,248,0.45)" : "none",
              }}
            >
              {status === "draft" ? "✓ Finalize" : "Finalized ✓"}
            </button>
          </div>
        </div>

        {/* stage */}
        <div
          ref={stageRef}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(600px 400px at 50% 30%, rgba(255,255,255,0.03), transparent), rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 18,
            padding: 22,
            minHeight: 420,
          }}
        >
          <div
            style={{
              width: ratio.w * scale,
              height: ratio.h * scale,
              position: "relative",
              boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
              outline: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {slide && (
                <PostSlide
                  ref={slideRef}
                  slide={slide}
                  index={cur}
                  total={total}
                  design={design}
                  bg={activeBg}
                  accent={accent}
                  pillar={PILLAR}
                  handle="@jess.sells.gilbert"
                />
              )}
            </div>
          </div>
        </div>

        {/* slide nav */}
        {total > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14 }}>
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={cur === 0}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#A6A4B8", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}
            >
              ‹
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  title={s.role}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer",
                    background: i === cur ? "#FFC23D" : "rgba(255,255,255,0.12)",
                    boxShadow: i === cur ? "0 0 8px #FFC23D" : "none",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
              disabled={cur === total - 1}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#A6A4B8", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}
            >
              ›
            </button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10, gap: 8, color: "#6E6C82", fontSize: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", color: "#8D89C0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, padding: "2px 8px" }}>
            {slide ? slide.role : ""}
          </span>
          <span>
            {ratio.label} · {ratio.w}×{ratio.h}
          </span>
        </div>

        {/* backgrounds & images — one scrollable strip under the preview */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: "12px 14px 8px", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <span className="fh-kicker" style={{ fontSize: 9.5 }}>Backgrounds &amp; images</span>
            <span style={{ fontSize: 10, color: "#6E6C82" }}>
              applies to {cur === 0 ? "cover" : applyAll ? "all body slides" : slide?.role || `slide ${cur + 1}`} · scroll →
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ marginLeft: "auto", background: "rgba(65,217,138,0.12)", border: "1px dashed rgba(65,217,138,0.5)", color: "#41D98A", borderRadius: 8, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
            >
              ⬆ Upload
            </button>
          </div>
          <div className="fh-hscroll" style={{ display: "flex", gap: 8, paddingBottom: 8 }}>
            {/* solid & glow quick tiles */}
            {([
              ["gradient", "Cinematic", "linear-gradient(160deg,#1B1832,#0A0A14)"],
              ["black", "Black", "#000"],
              ["glow", "Glow", "radial-gradient(60% 60% at 50% 40%, rgba(255,93,143,0.5), #0A0A14)"],
            ] as const).map(([id, label, bg]) => {
              const on = activeBg.type === id;
              return (
                <button
                  key={id}
                  onClick={() => applyBg({ type: id } as Bg)}
                  style={{ flexShrink: 0, width: 64, height: 80, borderRadius: 8, border: `2px solid ${on ? "#FF5D8F" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", background: bg, position: "relative", overflow: "hidden", boxShadow: on ? "0 0 12px rgba(255,93,143,0.4)" : "none" }}
                >
                  <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 7.5, fontWeight: 700, color: "#D8D6E6", background: "rgba(0,0,0,0.55)", padding: "2px 0" }}>{label}</span>
                </button>
              );
            })}
            <span style={{ flexShrink: 0, width: 1, background: "rgba(255,255,255,0.1)", margin: "6px 2px" }} />
            {/* cinematic textures */}
            {texList.map((t) => {
              const on = isActive({ type: "texture", tex: t.id });
              return (
                <button
                  key={t.id}
                  title={t.name}
                  onClick={() => applyBg({ type: "texture", tex: t.id })}
                  style={{ flexShrink: 0, width: 64, height: 80, borderRadius: 8, overflow: "hidden", position: "relative", border: `2px solid ${on ? "#FF5D8F" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", background: `#111 url(${t.src}) center/cover`, boxShadow: on ? "0 0 12px rgba(255,93,143,0.4)" : "none", padding: 0 }}
                >
                  <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 7.5, fontWeight: 700, color: "#D8D6E6", background: "rgba(0,0,0,0.55)", padding: "2px 0" }}>{t.name}</span>
                </button>
              );
            })}
            {assets.length > 0 && <span style={{ flexShrink: 0, width: 1, background: "rgba(255,255,255,0.1)", margin: "6px 2px" }} />}
            {/* your images */}
            {assets.map((a) => {
              const on = isActive({ type: "image", img: a.dataURL });
              return (
                <div key={a.id} style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    title={a.name}
                    onClick={() => applyBg({ type: "image", img: a.dataURL })}
                    style={{ display: "block", width: 80, height: 80, padding: 0, borderRadius: 8, overflow: "hidden", border: `2px solid ${on ? "#FF5D8F" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", background: `#111 url(${a.dataURL}) center/cover`, boxShadow: on ? "0 0 12px rgba(255,93,143,0.4)" : "none" }}
                  />
                  <button
                    title="Remove"
                    onClick={() => set((s) => ({ stAssets: s.stAssets.filter((x) => x.id !== a.id) }))}
                    style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(255,93,143,0.9)", color: "#fff", fontSize: 8.5, cursor: "pointer", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {/* upload tile */}
            <button
              onClick={() => fileRef.current?.click()}
              style={{ flexShrink: 0, width: 80, height: 80, borderRadius: 8, border: "1.5px dashed rgba(65,217,138,0.45)", background: "rgba(65,217,138,0.05)", color: "#41D98A", fontSize: 20, cursor: "pointer" }}
            >
              +
            </button>
          </div>
        </div>

        {/* caption & hashtags */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: 16, marginTop: 18 }}>
          <div className="fh-kicker" style={{ fontSize: 10, marginBottom: 12 }}>
            Caption &amp; hashtags · {variant.meta}
          </div>
          <div style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--mono)", color: "#8B89A0" }}>CAPTION</span>
              <CopyBtn text={copyText} />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#D8D6E6", whiteSpace: "pre-line" }}>{copyText}</div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--mono)", color: "#8B89A0" }}>HASHTAGS</span>
              <CopyBtn text={tags} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {HASHTAGS[ch].map((h) => (
                <span key={h} style={{ fontSize: 11.5, fontFamily: "var(--mono)", color: "#7DD3FC", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.22)", borderRadius: 999, padding: "3px 9px" }}>
                  #{h}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#6E6C82", marginTop: 10, lineHeight: 1.4 }}>
            The image carries the hook — paste the caption &amp; hashtags in when you post.
          </div>
        </div>
      </div>

      {/* ============ SIDE: controls ============ */}
      <div className="fh-engpv" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StockPanel pillar="tips" />

        {/* Background */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: 14 }}>
          <div className="fh-kicker" style={{ fontSize: 10, marginBottom: 12 }}>
            Background
          </div>
          {total > 1 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: cur === 0 ? 0 : 8 }}>
                <span style={{ fontSize: 11.5, color: "#6E6C82" }}>Editing</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#FFC23D", background: "rgba(255,194,61,0.1)", border: "1px solid rgba(255,194,61,0.3)", borderRadius: 999, padding: "3px 10px" }}>
                  {cur === 0 ? "Cover" : slide?.role || "Slide " + (cur + 1)}
                </span>
              </div>
              {cur !== 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 11.5, color: "#A6A4B8" }}>
                  <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} style={{ accentColor: "#FFC23D" }} />
                  Apply to all body slides at once
                </label>
              )}
              <div style={{ fontSize: 10.5, color: "#6E6C82", marginTop: 7, lineHeight: 1.4 }}>
                {cur === 0
                  ? "Use the slide dots under the preview to edit other slides."
                  : applyAll
                    ? "A pick changes every body slide."
                    : "A pick changes only this slide."}
              </div>
            </div>
          )}

          <label style={FIELD_LABEL}>Solid &amp; glow</label>
          <Seg
            value={activeBg.type === "texture" || activeBg.type === "image" ? "" : activeBg.type}
            onChange={(v) => applyBg({ type: v } as Bg)}
            options={[
              { id: "gradient", label: "Cinematic" },
              { id: "black", label: "Pure black" },
              { id: "glow", label: "Accent glow" },
            ]}
          />
          <div style={{ fontSize: 10.5, color: "#6E6C82", marginTop: 10, lineHeight: 1.45 }}>
            Textures &amp; your image library live in the strip under the preview — scroll it sideways.
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onUpload} />
          {assets.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => assignImages("cover")}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#D8D6E6", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  Auto-fill intro
                </button>
                {total > 1 && (
                  <button
                    onClick={() => assignImages("all")}
                    style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#D8D6E6", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    Auto-fill all
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "#6E6C82", marginTop: 8, lineHeight: 1.4 }}>
                {assets.length} of 40 saved · auto-fill picks your darkest, cleanest shots so text stays readable.
              </div>
            </>
          )}
        </div>

        {/* Layout & format */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: 14 }}>
          <div className="fh-kicker" style={{ fontSize: 10, marginBottom: 12 }}>
            Layout
          </div>
          <label style={FIELD_LABEL}>Format</label>
          <Seg value={design.ratio} onChange={(v) => setD("ratio", v)} options={STUDIO_RATIOS.map((r) => ({ id: r.id, label: r.label }))} />
          <div style={{ height: 14 }} />
          <label style={FIELD_LABEL}>Text position</label>
          <Seg
            value={design.layout}
            onChange={(v) => setD("layout", v)}
            options={[
              { id: "editorial", label: "Editorial" },
              { id: "center", label: "Centered" },
              { id: "bottom", label: "Bottom" },
            ]}
          />
          <div style={{ height: 14 }} />
          <label style={FIELD_LABEL}>Headline font</label>
          <Seg
            value={design.headFont}
            onChange={(v) => setD("headFont", v)}
            options={[
              { id: "impact", label: "Impact" },
              { id: "heavy", label: "Heavy" },
              { id: "editorial", label: "Editorial" },
            ]}
          />
          <div style={{ height: 14 }} />
          <label style={FIELD_LABEL}>Punchline highlight</label>
          <Seg
            value={design.emphasis}
            onChange={(v) => setD("emphasis", v)}
            options={[
              { id: "off", label: "Off" },
              { id: "text", label: "Accent text" },
              { id: "box", label: "Accent box" },
            ]}
          />
          <div style={{ height: 14 }} />
          <label style={FIELD_LABEL}>Signature accent</label>
          <div style={{ display: "flex", gap: 7 }}>
            {Object.keys(ACCENTS).map((k) => {
              const on = state.compAccent === k;
              return (
                <button
                  key={k}
                  aria-label={k}
                  onClick={() => set({ compAccent: k })}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    border: `2px solid ${on ? "#F4F3F8" : "transparent"}`,
                    background: ACCENTS[k],
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: on ? `0 0 10px ${ACCENTS[k]}99` : "none",
                  }}
                />
              );
            })}
          </div>
          <div style={{ height: 6, borderBottom: "1px solid rgba(255,255,255,0.07)", margin: "10px 0 8px" }} />
          <Toggle label="Uppercase headline" on={design.upper} onClick={() => setD("upper", !design.upper)} />
          <Toggle label="Accent line" on={design.accent} onClick={() => setD("accent", !design.accent)} />
          <Toggle label="Brand handle" on={design.handle} onClick={() => setD("handle", !design.handle)} />
          <Toggle label="Pillar tag" on={design.pillarTag} onClick={() => setD("pillarTag", !design.pillarTag)} />
          <div style={{ height: 6, borderBottom: "1px solid rgba(255,255,255,0.07)", margin: "8px 0 10px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...FIELD_LABEL, margin: 0 }}>Background dimness</label>
            <span style={{ fontSize: 11, color: "#6E6C82", fontVariantNumeric: "tabular-nums" }}>{design.dim}</span>
          </div>
          <input
            type="range"
            min={20}
            max={92}
            value={design.dim}
            onChange={(e) => setD("dim", +e.target.value)}
            style={{ width: "100%", accentColor: "#FF5D8F" }}
          />
          <div style={{ fontSize: 10.5, color: "#6E6C82", marginTop: 6, lineHeight: 1.4 }}>
            Darken the photo/scene behind your text — push it up for bright images, down to let the image breathe.
          </div>
        </div>
      </div>
    </div>
  );
}
