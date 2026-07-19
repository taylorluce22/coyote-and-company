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
  processImageURL,
  slugify,
  uid,
  type Bg,
  type StudioDesign,
} from "@/lib/studio";
import { textures } from "@/lib/textures";
import { COMP_COPY, type CompCh } from "@/lib/data";
import { ideaCopy, ideaFactPair } from "@/lib/ideaCopy";
import { ideasFor, type Idea, type StrategyProfile } from "@/lib/strategy";
import { buildSlidePrompts } from "@/lib/postVisuals";
import { vaultAdd, vaultAll, vaultDelete, type VaultImage } from "@/lib/vault";

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

/* ---- pending Higgsfield batch, persisted the moment jobs start ----
   If a batch is interrupted (tab closed, connection dropped, function
   died), these records let ⟳ Recover pull the already-paid-for images. */
type PendingItem = { url: string; prompt: string; role: string; index: number; title: string };
const PENDING_KEY = "fh-hf-pending";
function readPending(): PendingItem[] | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!Array.isArray(p.items) || !p.items.length) return null;
    // Higgsfield results don't live forever — stop offering recovery after a day
    if (!(p.createdAt > Date.now() - 24 * 3600000)) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p.items as PendingItem[];
  } catch {
    return null;
  }
}
function writePending(items: PendingItem[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ createdAt: Date.now(), items }));
  } catch {}
}
function prunePending(index: number) {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    p.items = (Array.isArray(p.items) ? p.items : []).filter((it: PendingItem) => it.index !== index);
    if (p.items.length) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

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
  const strategy = state.strategy as StrategyProfile;
  // idea mode: copy generated from the idea engine + knowledge base (what
  // "Open in Studio" and "New idea" load). Null = the channel demo copy.
  const idea = state.compIdea as Idea | null;
  const ideaPack = useMemo(() => (idea ? ideaCopy(idea, strategy, ch) : null), [idea, strategy, ch]);
  const variant = ideaPack ?? COMP_COPY[ch];
  // AI-written OR hand-edited copy wins when it matches the current
  // idea+channel — switching idea or channel falls back to template copy
  const aiKey = `${idea?.id ?? "demo"}:${ch}`;
  const aiRaw = state.compAiCopy;
  const ai = aiRaw && aiRaw.key === aiKey && typeof aiRaw.long === "string" && aiRaw.long ? aiRaw : null;
  const copyText = ai
    ? state.compShort
      ? ai.short
      : ai.long
    : state.compShort
      ? variant.short
      : state.compRegen
        ? variant.alt
        : variant.long;
  const accent = ACCENTS[state.compAccent] || ACCENTS.cyan;

  // self-heal: an idea persisted before decks existed re-loads its authored
  // slide deck from the bank (ids are stable) so old ideas get coherent copy
  useEffect(() => {
    if (idea && !idea.deck) {
      // title is the identity; ids are positional and could drift
      const bank = ideasFor(strategy);
      const fresh = bank.find((b) => b.title === idea.title) || bank.find((b) => b.id === idea.id && b.theme === idea.theme);
      if (fresh?.deck) set({ compIdea: fresh });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pull the next proposal from the content generator — cycles through the
  // full idea bank (KB-driven for solar) so every click is a fresh post
  const nextIdea = () => {
    const bank = ideasFor(strategy);
    if (!bank.length) return;
    const at = idea ? bank.findIndex((b) => b.id === idea.id) : -1;
    set({ compIdea: bank[(at + 1) % bank.length], compRegen: false, compShort: false });
  };

  /* slides derived from the live copy (cover / body / CTA) */
  const ctaText = ai?.cta || (ideaPack ? ideaPack.cta : CTAS[ch]);
  const slides = useMemo(() => copyToSlides(copyText, ctaText), [copyText, ctaText]);
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
  /* ---- AI copywriter: Perplexity writes single-subject, KB-grounded copy
     so the post text is on point BEFORE any image credits get spent ---- */
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);
  async function sharpenCopy() {
    if (!idea || copyBusy) return;
    setCopyBusy(true);
    setCopyErr(null);
    try {
      const fp = ideaFactPair(idea);
      const r = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: idea.title,
          theme: idea.theme,
          angle: idea.angle,
          territory: idea.territory.name,
          city: idea.territory.city,
          utility: fp.utility,
          // ground the writer on the authored deck when the idea has one —
          // it already delivers the title's promise; KB facts otherwise
          facts: idea.deck?.length ? idea.deck : fp.facts,
          channel: ch,
        }),
        signal: AbortSignal.timeout(50000),
      });
      const j = await r.json();
      if (!j.configured) {
        setCopyErr("The AI writer needs the Perplexity key — it's the same one the lead engine uses.");
        return;
      }
      if (!j.long) {
        setCopyErr(j.error || "Writer came back empty — try again.");
        return;
      }
      set({
        compAiCopy: { key: aiKey, long: j.long, short: j.short || j.long, cta: j.cta || ctaText },
        compShort: false,
        compRegen: false,
      });
    } catch {
      setCopyErr("Writer timed out — try again.");
    } finally {
      setCopyBusy(false);
    }
  }

  /* ---- direct text editing: typing into the current slide materializes
     the whole deck into the persisted copy override (same slot AI copy
     uses), so hand edits survive reloads and win over the template ---- */
  function editSlide(text: string) {
    let newLong: string;
    let newCta = ctaText;
    if (total <= 1) {
      newLong = text;
    } else if (cur === total - 1) {
      // the closing CTA slide edits the CTA itself
      newCta = text;
      newLong = slides.slice(0, -1).map((s) => s.text).join("\n\n");
    } else {
      newLong = slides
        .slice(0, -1)
        .map((s, i) => (i === cur ? text : s.text))
        .join("\n\n");
    }
    set({
      compAiCopy: { key: aiKey, long: newLong, short: ai?.short || variant.short, cta: newCta },
      compShort: false,
      compRegen: false,
    });
  }

  /* ---- image vault: every generated image is kept permanently ---- */
  const [vault, setVault] = useState<VaultImage[]>([]);
  useEffect(() => {
    vaultAll().then(setVault);
  }, []);

  /* ---- whole-post AI visuals: one Higgsfield image per slide, shared
     seed + shared style language so the carousel reads as one piece.

     Crash-proof by design: the server only STARTS the jobs (instant), the
     browser polls for results, every started job is recorded locally before
     the first poll, and each finished image is committed to the vault the
     moment it lands. If anything dies mid-batch, the Recover button pulls
     the already-paid-for images — credits can't be stranded again. ---- */
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [pendingBatch, setPendingBatch] = useState<PendingItem[] | null>(null);
  useEffect(() => {
    setPendingBatch(readPending());
  }, []);
  // two-step trigger: first click arms with the credit cost, second confirms —
  // so credits are only spent once the copy is locked
  const [genArm, setGenArm] = useState(false);
  useEffect(() => {
    if (!genArm) return;
    const t = setTimeout(() => setGenArm(false), 10000);
    return () => clearTimeout(t);
  }, [genArm]);

  /** Poll tracked jobs; commit every finished image immediately. */
  async function pollBatch(items: PendingItem[], applyToSlides: boolean, budgetMs: number): Promise<{ ok: number; failed: number }> {
    const deadline = Date.now() + budgetMs;
    const settled = new Set<number>();
    let ok = 0;
    let failed = 0;
    while (settled.size < items.length && Date.now() < deadline) {
      const open = items.filter((it) => !settled.has(it.index));
      let results: { status?: string; images?: string[] }[] = [];
      try {
        const r = await fetch("/api/higgsfield", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ check: open.map((o) => o.url) }),
          signal: AbortSignal.timeout(30000),
        });
        const j = await r.json();
        results = Array.isArray(j.results) ? j.results : [];
      } catch {}
      for (let k = 0; k < open.length; k++) {
        const it = open[k];
        const res = results[k];
        if (!res) continue;
        if (res.status === "failed") {
          settled.add(it.index);
          failed++;
          prunePending(it.index);
          continue;
        }
        const u = res.status === "completed" ? res.images?.[0] : null;
        if (!u) continue;
        settled.add(it.index);
        const p = await processImageURL(`/api/higgsfield?img=${encodeURIComponent(u)}`, 1200, 0.85);
        if (!p) {
          failed++;
          prunePending(it.index);
          continue;
        }
        // vault FIRST — the paid-for image is safe before anything else
        await vaultAdd({ id: uid(), dataURL: p.dataURL, lum: p.lum, busy: p.busy, prompt: it.prompt, label: `${it.title.slice(0, 48)} · ${it.role}`, createdAt: Date.now() });
        set((s) => ({ stAssets: [...s.stAssets, { id: uid(), name: `${it.role} visual`, dataURL: p.dataURL, lum: p.lum, busy: p.busy, source: "higgsfield" }].slice(-40) }));
        if (applyToSlides) {
          const b: Bg = { type: "image", img: p.dataURL };
          set((s) => {
            const st = s.stStudio[ch] || studio;
            if (it.index === 0) {
              const nb = { ...st.slideBg };
              delete nb[0]; // cover lives in its own slot
              return { stStudio: { ...s.stStudio, [ch]: { ...st, coverBg: b, slideBg: nb } } };
            }
            return { stStudio: { ...s.stStudio, [ch]: { ...st, slideBg: { ...st.slideBg, [it.index]: b } } } };
          });
        }
        ok++;
        prunePending(it.index);
        setGenMsg(`✨ ${ok}/${items.length} images in — the rest are still rendering…`);
      }
      if (settled.size < items.length) await new Promise((r) => setTimeout(r, 4000));
    }
    vaultAll().then(setVault);
    return { ok, failed };
  }

  async function generateVisuals() {
    if (genBusy || !slides.length) return;
    setGenBusy(true);
    setGenMsg("✨ Starting the batch…");
    try {
      const prompts = buildSlidePrompts(slides.slice(0, 6), {
        theme: idea?.theme,
        territoryName: idea?.territory.name,
        city: idea?.territory.city,
      });
      const seed = 1 + Math.floor(Math.random() * 999_999);
      const r = await fetch("/api/higgsfield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts, seed, aspect: "3:4" }),
        signal: AbortSignal.timeout(90000),
      });
      const j = await r.json();
      if (j.needsCreds) {
        setGenMsg("Add your Higgsfield API keys first — see the image panel on the right.");
        return;
      }
      const handles: (string | null)[] = Array.isArray(j.jobs) ? j.jobs : [];
      const items: PendingItem[] = handles
        .map((u, i) => (u ? { url: u, prompt: prompts[i], role: slides[i]?.role || `slide ${i + 1}`, index: i, title: idea?.title || "Post" } : null))
        .filter((x): x is PendingItem => !!x);
      if (!items.length) {
        setGenMsg(j.error || "Couldn't start the batch — no credits were spent.");
        return;
      }
      // record the paid-for jobs BEFORE polling — from here on, a crash,
      // closed tab, or dead connection can't lose them
      writePending(items);
      setGenMsg(`✨ ${items.length} images rendering — they land on the slides as they finish…`);
      const { ok, failed } = await pollBatch(items, true, 4 * 60000);
      setPendingBatch(readPending());
      if (!ok) {
        setGenMsg("The images didn't come back in time — they're already paid for. Hit ⟳ Recover images in a minute to pull them into your vault.");
      } else {
        const missing = items.length - ok;
        setGenMsg(
          missing > 0
            ? `✓ ${ok} slides styled — ${failed ? `${failed} failed on Higgsfield's side.` : `${missing} still rendering: hit ⟳ Recover images in a minute.`}`
            : `✓ All ${ok} slides styled in one matching look.`
        );
      }
    } catch {
      setPendingBatch(readPending());
      setGenMsg("Lost the connection mid-batch — your images are safe. Hit ⟳ Recover images to pull them into your vault.");
    } finally {
      setGenBusy(false);
    }
  }

  /** Pull finished images from an interrupted batch — no new credits spent. */
  async function recoverBatch() {
    const items = readPending();
    if (!items || genBusy) return;
    setGenBusy(true);
    setGenMsg("⟳ Checking Higgsfield for your finished images…");
    try {
      const { ok } = await pollBatch(items, false, 45000);
      setPendingBatch(readPending());
      setGenMsg(
        ok
          ? `✓ Recovered ${ok} image${ok > 1 ? "s" : ""} into your AI vault — nothing wasted.`
          : "Nothing ready yet — try once more in a minute. If it stays empty, those jobs failed on Higgsfield's side."
      );
    } finally {
      setGenBusy(false);
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
  const tagList = ideaPack ? ideaPack.hashtags : HASHTAGS[ch];
  const tags = tagList.map((h) => "#" + h).join(" ");

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
            onClick={nextIdea}
            title="Pull the next post proposal from your idea engine"
            style={{ background: "rgba(65,217,138,0.12)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            ↻ New idea
          </button>
          {idea && (
            <span title={idea.title} style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 260, fontSize: 10.5, fontWeight: 700, color: idea.territory.hex, background: `${idea.territory.hex}12`, border: `1px solid ${idea.territory.hex}44`, borderRadius: 999, padding: "5px 11px" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idea.territory.name} · {idea.title}</span>
            </span>
          )}
          {idea && (
            <button
              onClick={sharpenCopy}
              disabled={copyBusy}
              title="Have the AI writer turn this idea + your knowledge base into tight, single-subject copy"
              style={{ background: "rgba(125,211,252,0.12)", color: "#7DD3FC", border: "1px solid rgba(125,211,252,0.4)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: copyBusy ? "wait" : "pointer", opacity: copyBusy ? 0.7 : 1 }}
            >
              {copyBusy ? "✍️ Writing…" : ai ? "✍️ Re-write" : "✍️ Sharpen copy"}
            </button>
          )}
          <button
            onClick={() => {
              if (genBusy) return;
              if (!genArm) {
                setGenArm(true);
                return;
              }
              setGenArm(false);
              generateVisuals();
            }}
            disabled={genBusy}
            title={`Generate one matching AI image per slide with Higgsfield (~${Math.min(total, 6)} credits)`}
            style={{
              background: genArm ? "rgba(255,154,98,0.3)" : "rgba(255,154,98,0.14)",
              color: "#FF9A62",
              border: `1px solid rgba(255,154,98,${genArm ? 0.85 : 0.4})`,
              borderRadius: 9,
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: 700,
              cursor: genBusy ? "wait" : "pointer",
              opacity: genBusy ? 0.7 : 1,
              boxShadow: genArm ? "0 0 14px rgba(255,154,98,0.35)" : "none",
            }}
          >
            {genBusy ? "✨ Directing…" : genArm ? `✓ Confirm — ~${Math.min(total, 6)} credits` : "✨ Post visuals"}
          </button>
          {ai ? (
            <button
              onClick={() => set({ compAiCopy: null, compRegen: false, compShort: false })}
              title="Discard the AI copy and go back to the template version"
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.14)", color: "#A6A4B8", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              ↺ Template
            </button>
          ) : (
            <button
              onClick={() => set({ compRegen: !state.compRegen, compShort: false })}
              style={{ background: "rgba(168,85,247,0.14)", color: "#C9A8FF", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {state.compRegen ? "Original" : "Regenerate"}
            </button>
          )}
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
        {pendingBatch && !genBusy && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(255,194,61,0.08)", border: "1px solid rgba(255,194,61,0.35)", borderRadius: 10, padding: "9px 12px", margin: "-2px 0 12px" }}>
            <span style={{ fontSize: 11.5, color: "#FFC23D", lineHeight: 1.45 }}>
              An image batch didn&apos;t finish downloading — {pendingBatch.length} paid-for image{pendingBatch.length > 1 ? "s are" : " is"} likely waiting at Higgsfield.
            </span>
            <button
              onClick={recoverBatch}
              style={{ background: "rgba(255,194,61,0.18)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.5)", borderRadius: 8, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
            >
              ⟳ Recover images
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem(PENDING_KEY);
                } catch {}
                setPendingBatch(null);
              }}
              style={{ background: "none", color: "#8B89A0", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "5px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
            >
              Dismiss
            </button>
          </div>
        )}
        {(genBusy || genMsg || genArm || copyErr) && (
          <div style={{ fontSize: 11.5, color: genMsg?.startsWith("✓") && !genArm && !copyErr ? "#41D98A" : "#FFC23D", margin: "-4px 0 12px", lineHeight: 1.45 }}>
            {genBusy
              ? genMsg || `✨ Art-directing ${Math.min(total, 6)} slide visuals in one style — this takes about a minute…`
              : genArm
                ? `This spends ~${Math.min(total, 6)} Higgsfield credits on THIS exact copy — happy with the text first? Click again to confirm.`
                : copyErr || genMsg}
          </div>
        )}

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
                  pillar={idea ? { short: idea.theme.replace(/-/g, " "), color: idea.territory.hex } : PILLAR}
                  handle={ideaPack ? `@${ideaPack.handle}` : "@jess.sells.gilbert"}
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

        {/* direct slide text editing — type straight into the post */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span className="fh-kicker" style={{ fontSize: 9.5 }}>Slide text</span>
            <span style={{ fontSize: 10, color: "#6E6C82" }}>
              editing {slide?.role || "slide"} · saves as you type
              {total > 1 && cur > 0 && cur < total - 1 ? " · blank line splits the slide · clear all text to drop it" : ""}
            </span>
          </div>
          <textarea
            value={slide?.text || ""}
            onChange={(e) => editSlide(e.target.value)}
            rows={Math.min(8, Math.max(2, ((slide?.text || "").match(/\n/g) || []).length + 2))}
            placeholder={cur === 0 ? "Your hook — the cover headline" : "This slide's text"}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.28)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.55,
              color: "#F4F3F8",
              fontFamily: "var(--body)",
              resize: "vertical",
            }}
          />
        </div>

        {/* backgrounds & images — two stacked scrollable rows under the preview */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: "12px 14px 10px", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <span className="fh-kicker" style={{ fontSize: 9.5 }}>Backgrounds</span>
            <span style={{ fontSize: 10, color: "#6E6C82" }}>
              applies to {cur === 0 ? "cover" : applyAll ? "all body slides" : slide?.role || `slide ${cur + 1}`} · scroll →
            </span>
          </div>
          {/* row 1 — backgrounds: solid/glow + cinematic textures */}
          <div className="fh-hscroll" style={{ display: "flex", gap: 8, paddingBottom: 8 }}>
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
          </div>

          {/* row 2 — your images (own row, underneath) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 9px", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
            <span className="fh-kicker" style={{ fontSize: 9.5 }}>Your images</span>
            <span style={{ fontSize: 10, color: "#6E6C82" }}>{assets.length} saved · scroll →</span>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ marginLeft: "auto", background: "rgba(65,217,138,0.12)", border: "1px dashed rgba(65,217,138,0.5)", color: "#41D98A", borderRadius: 8, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
            >
              ⬆ Upload
            </button>
          </div>
          <div className="fh-hscroll" style={{ display: "flex", gap: 8, paddingBottom: 8 }}>
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
            {assets.length === 0 && (
              <span style={{ alignSelf: "center", fontSize: 11, color: "#6E6C82", marginLeft: 4, lineHeight: 1.4 }}>
                Upload your photos or b-roll — saved here and reused on every post.
              </span>
            )}
          </div>

          {/* row 3 — AI vault: every generated image, kept forever */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 9px", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
            <span className="fh-kicker" style={{ fontSize: 9.5, color: "#FF9A62" }}>✨ AI vault</span>
            <span style={{ fontSize: 10, color: "#6E6C82" }}>
              {vault.length} saved · every generated image lands here permanently — reuse on any post
            </span>
          </div>
          <div className="fh-hscroll" style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
            {vault.map((v) => {
              const on = isActive({ type: "image", img: v.dataURL });
              return (
                <div key={v.id} style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    title={`${v.label}${v.prompt ? `\n\n${v.prompt}` : ""}`}
                    onClick={() => applyBg({ type: "image", img: v.dataURL })}
                    style={{ display: "block", width: 80, height: 80, padding: 0, borderRadius: 8, overflow: "hidden", border: `2px solid ${on ? "#FF9A62" : "rgba(255,154,98,0.25)"}`, cursor: "pointer", background: `#111 url(${v.dataURL}) center/cover`, boxShadow: on ? "0 0 12px rgba(255,154,98,0.4)" : "none" }}
                  />
                  <button
                    title="Delete from vault"
                    onClick={() => {
                      vaultDelete(v.id).then(() => vaultAll().then(setVault));
                    }}
                    style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(255,93,143,0.9)", color: "#fff", fontSize: 8.5, cursor: "pointer", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {vault.length === 0 && (
              <span style={{ alignSelf: "center", fontSize: 11, color: "#6E6C82", marginLeft: 4, lineHeight: 1.4 }}>
                Nothing yet — hit ✨ Post visuals (or generate a single image) and every result is kept here, even if the post never ships.
              </span>
            )}
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
              {tagList.map((h) => (
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
