/* ============================================================
   studio.ts — Post Studio engine (ported from the Coyote
   Content Engine): slide model, auto type-sizing, punchline
   highlighting, legibility-aware image intelligence, and
   content-aware background matching.
   ============================================================ */

export interface Slide {
  role: string;
  text: string;
  sticker?: string | null;
}

export interface StudioDesign {
  ratio: string; // portrait | square | story
  layout: "editorial" | "center" | "bottom";
  accent: boolean; // accent line
  handle: boolean; // brand handle footer
  pillarTag: boolean;
  headFont: "impact" | "heavy" | "editorial";
  upper: boolean;
  emphasis: "off" | "text" | "box";
  dim: number; // 20..92
}

export type Bg =
  | { type: "texture"; tex: string }
  | { type: "image"; img: string }
  | { type: "gradient" }
  | { type: "black" }
  | { type: "glow" };

export interface Asset {
  id: string;
  name: string;
  dataURL: string;
  lum?: number;
  busy?: number;
  source?: string;
}

export const STUDIO_RATIOS = [
  { id: "portrait", label: "4:5 Post", w: 1080, h: 1350 },
  { id: "square", label: "1:1 Square", w: 1080, h: 1080 },
  { id: "story", label: "9:16 Story", w: 1080, h: 1920 },
];

export const DEFAULT_DESIGN: StudioDesign = {
  ratio: "portrait",
  layout: "editorial",
  accent: false,
  handle: true,
  pillarTag: true,
  headFont: "impact",
  upper: true,
  emphasis: "text",
  dim: 55,
};

export const HEAD_FONTS: Record<
  string,
  { family: string; weight: number; leading: number; track: string }
> = {
  impact: { family: "var(--font-anton), 'Anton', sans-serif", weight: 400, leading: 1.16, track: "0.005em" },
  heavy: { family: "var(--font-archivo-black), 'Archivo Black', sans-serif", weight: 400, leading: 1.16, track: "-0.01em" },
  editorial: { family: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", weight: 600, leading: 1.18, track: "-0.025em" },
};

/* Auto type-sizing by text length + role + multi-line scaling (studio parity) */
export function sizeFor(text: string, role: string, head: string): number {
  const t = text || "";
  const n = t.length;
  const big = role === "Cover" || role === "Hook";
  const impact = head === "impact" || head === "heavy";
  let s;
  if (n < 42) s = big ? 126 : 110;
  else if (n < 80) s = big ? 110 : 94;
  else if (n < 140) s = 82;
  else if (n < 220) s = 70;
  else if (n < 320) s = 56;
  else s = 46;
  s = Math.round(s * (impact ? 1.12 : 1));
  const lines = (t.match(/\n/g) || []).length + 1;
  if (lines >= 2) s = Math.round(s * Math.max(0.6, 1 - (lines - 1) * 0.13));
  return s;
}

/* Punchline split: highlight the last sentence (else last 1-2 words).
   Returns either a plain string (multi-line/bullets) or [head, tail]. */
export function splitHook(text: string): string | [string, string] {
  const t = String(text || "").trim();
  if (!t) return t;
  if (/\n/.test(t) || /^\s*[•\-*]/.test(t)) {
    return t
      .split(/\n+/)
      .map((l) => l.replace(/^\s*[-*]\s+/, "• ").trim())
      .filter(Boolean)
      .join("\n");
  }
  let head: string, tail: string;
  const parts = t.split(/(?<=[.!?])\s+/);
  if (parts.length > 1) {
    tail = parts.pop()!;
    head = parts.join(" ") + " ";
  } else {
    const words = t.split(/\s+/);
    if (words.length <= 2) {
      head = "";
      tail = t;
    } else {
      const k = Math.min(2, words.length - 1);
      head = words.slice(0, words.length - k).join(" ") + " ";
      tail = words.slice(words.length - k).join(" ");
    }
  }
  return [head, tail];
}

/* ---- Farmhand slide model: derive post slides from channel copy ----
   Cover = the hook (first line); each paragraph = one body slide
   (bullet lists are kept as bullets); final slide = CTA. */
export function copyToSlides(copyText: string, cta: string): Slide[] {
  const paras = String(copyText || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return [{ role: "Hook", text: copyText || "" }];
  const hook = paras[0].split(/\n/)[0].trim();
  const rest = [paras[0].split(/\n/).slice(1).join("\n").trim(), ...paras.slice(1)].filter(Boolean);
  const slides: Slide[] = [{ role: "Cover", text: hook }];
  rest.forEach((p, i) =>
    slides.push({
      role: "Slide " + (i + 2),
      text: p
        .split(/\n/)
        .map((l) => l.replace(/^\s*(\d+)\.\s+/, "• ").replace(/^\s*[-*]\s+/, "• ").trim())
        .join("\n"),
    })
  );
  slides.push({ role: "CTA", text: cta });
  return slides;
}

/* ---- image intelligence (studio parity) ---- */
export function processImageFile(
  file: File,
  max = 1200,
  q = 0.8
): Promise<{ dataURL: string; lum: number; busy: number }> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const { lum, busy } = analyze(c);
      res({ dataURL: c.toDataURL("image/jpeg", q), lum, busy });
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function processImageURL(
  url: string,
  max = 1200,
  q = 0.82
): Promise<{ dataURL: string; lum: number; busy: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const { lum, busy } = analyze(c);
        resolve({ dataURL: c.toDataURL("image/jpeg", q), lum, busy });
      } catch {
        resolve({ dataURL: url, lum: 0.5, busy: 0.4 });
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function analyze(c: HTMLCanvasElement): { lum: number; busy: number } {
  let lum = 0.5,
    busy = 0.4;
  try {
    const sw = Math.min(72, c.width),
      sh = Math.max(1, Math.round((sw * c.height) / c.width));
    const oc = document.createElement("canvas");
    oc.width = sw;
    oc.height = sh;
    const octx = oc.getContext("2d")!;
    octx.drawImage(c, 0, 0, sw, sh);
    const d = octx.getImageData(0, 0, sw, sh).data;
    let sum = 0,
      sum2 = 0,
      n = 0;
    for (let p = 0; p < d.length; p += 4) {
      const L = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
      sum += L;
      sum2 += L * L;
      n++;
    }
    const mean = n ? sum / n : 0.5;
    const variance = n ? Math.max(0, sum2 / n - mean * mean) : 0.04;
    lum = mean;
    busy = Math.min(1, Math.sqrt(variance) * 2.4);
  } catch {}
  return { lum, busy };
}

const score = (a: Asset) =>
  (a.lum == null ? 0.5 : a.lum) * 0.62 + (a.busy == null ? 0.4 : a.busy) * 0.38;

/* darkest + cleanest first, tonally clustered — for cohesive carousel fills */
export function coordinatedPool(list: Asset[]): string[] {
  if (!list || !list.length) return [];
  const ranked = list.slice().sort((a, b) => score(a) - score(b));
  const base = ranked[0].lum == null ? 0.4 : ranked[0].lum!;
  const cluster = ranked.filter(
    (a) => Math.abs((a.lum == null ? 0.4 : a.lum!) - base) < 0.2
  );
  return (cluster.length >= 2 ? cluster : ranked).map((a) => a.dataURL);
}

/* ---- content-aware texture matching (Farmhand pillars) ---- */
const PILLAR_SCENES: Record<string, { cover: string; body: string }> = {
  market: { cover: "slateamber", body: "graphite" },
  story: { cover: "ember", body: "warmash" },
  tips: { cover: "tealsmoke", body: "slate" },
  spotlight: { cover: "duskviolet", body: "stone" },
};

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  s = String(s || "x");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const KW_SCENES: { id: string; kw: string[] }[] = [
  { id: "bronze", kw: ["sold", "price", "value", "worth", "market", "median", "equity"] },
  { id: "storm", kw: ["monsoon", "storm", "roof", "rain", "insurance", "claims"] },
  { id: "mocha", kw: ["family", "keys", "home", "story", "welcome", "closing"] },
  { id: "tealsmoke", kw: ["neighborhood", "spotlight", "lake", "walk", "community"] },
  { id: "sandshadow", kw: ["checklist", "tips", "steps", "check", "guide"] },
  { id: "duskviolet", kw: ["evening", "night", "dusk", "sunset"] },
];

export function pickTextures(pillar: string, text: string, seedKey: string) {
  const t = String(text || "").toLowerCase();
  let best: string | null = null;
  let bestKw = 0;
  KW_SCENES.forEach((s) => {
    let kw = 0;
    for (const k of s.kw) if (t.indexOf(k) !== -1) kw++;
    if (kw > bestKw) {
      bestKw = kw;
      best = s.id;
    }
  });
  const base = PILLAR_SCENES[pillar] || { cover: "noir", body: "graphite" };
  const cover = best || base.cover;
  let body = base.body;
  if (body === cover) body = hashStr(seedKey) % 2 ? "pewter" : "espresso";
  return { cover, body };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

export function slugify(s: string): string {
  return (
    String(s || "post")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "post"
  );
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
