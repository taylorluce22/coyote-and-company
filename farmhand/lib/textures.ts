/* ============================================================
   textures.ts — procedural cinematic backgrounds
   Faithful port of the Coyote engine's texture generator:
   dark/amber film-grade looks rendered to data URLs in-browser.
   ============================================================ */

const W = 1080;
const H = 1350;
const AMBER = "224,123,57";

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

export interface Texture {
  id: string;
  name: string;
  group: string;
  light: boolean;
  src: string;
}

function mulberry32(a: number): Rng {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const base = (ctx: Ctx, w: number, h: number, c?: string) => {
  ctx.fillStyle = c || "#0A0A0A";
  ctx.fillRect(0, 0, w, h);
};
const vignette = (ctx: Ctx, w: number, h: number, a?: number) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0," + (a || 0.55) + ")");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

let GRAIN: HTMLCanvasElement | null = null;
function grain(ctx: Ctx, w: number, h: number, alpha?: number) {
  if (!GRAIN) {
    const sw = 360,
      sh = 450,
      oc = document.createElement("canvas");
    oc.width = sw;
    oc.height = sh;
    const octx = oc.getContext("2d")!;
    const img = octx.createImageData(sw, sh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = v;
      d[i + 1] = v * 0.93;
      d[i + 2] = v * 0.82;
      d[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    GRAIN = oc;
  }
  ctx.globalAlpha = alpha == null ? 0.05 : alpha;
  ctx.drawImage(GRAIN, 0, 0, w, h);
  ctx.globalAlpha = 1;
}

interface FadedOpts {
  c1: string;
  c2: string;
  c3?: string;
  mid?: number;
  diag?: boolean;
  glow?: string;
  gx?: number;
  gy?: number;
  gr?: number;
  gstr?: number;
  sheen?: string;
  grain?: number;
  vig?: number;
}

function faded(o: FadedOpts) {
  return function (ctx: Ctx, w: number, h: number) {
    const g = ctx.createLinearGradient(0, 0, o.diag ? w : 0, h);
    g.addColorStop(0, o.c1);
    g.addColorStop(o.mid || 0.6, o.c2);
    g.addColorStop(1, o.c3 || o.c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (o.glow) {
      const r = ctx.createRadialGradient(w * o.gx!, h * o.gy!, 0, w * o.gx!, h * o.gy!, w * (o.gr || 0.85));
      r.addColorStop(0, "rgba(" + o.glow + "," + o.gstr + ")");
      r.addColorStop(0.6, "rgba(" + o.glow + "," + (o.gstr! * 0.32).toFixed(3) + ")");
      r.addColorStop(1, "rgba(" + o.glow + ",0)");
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, w, h);
    }
    if (o.sheen) {
      ctx.save();
      ctx.translate(w * 0.6, h * 0.42);
      ctx.rotate(-0.5);
      const s = ctx.createLinearGradient(-w, 0, w, 0);
      s.addColorStop(0, "rgba(" + o.sheen + ",0)");
      s.addColorStop(0.5, "rgba(" + o.sheen + ",0.09)");
      s.addColorStop(1, "rgba(" + o.sheen + ",0)");
      ctx.fillStyle = s;
      ctx.fillRect(-w, -h, w * 2, h * 2);
      ctx.restore();
    }
    grain(ctx, w, h, o.grain == null ? 0.05 : o.grain);
    vignette(ctx, w, h, o.vig == null ? 0.5 : o.vig);
  };
}

const AMB = AMBER;
const FADED: (FadedOpts & { id: string; name: string })[] = [
  { id: "graphite", name: "Graphite", c1: "#2b2b2e", c2: "#161617", glow: "232,228,222", gx: 0.3, gy: 0.22, gstr: 0.07, vig: 0.5 },
  { id: "slate", name: "Slate", c1: "#2a3038", c2: "#14181e", glow: "150,175,205", gx: 0.28, gy: 0.2, gstr: 0.08, vig: 0.52 },
  { id: "warmash", name: "Warm Ash", c1: "#2c2722", c2: "#161310", glow: "235,215,190", gx: 0.32, gy: 0.24, gstr: 0.08, vig: 0.5 },
  { id: "umber", name: "Umber", c1: "#32271a", c2: "#18110b", glow: AMB, gx: 0.3, gy: 0.78, gstr: 0.18, vig: 0.5 },
  { id: "espresso", name: "Espresso", c1: "#2a201a", c2: "#15100c", glow: "210,170,120", gx: 0.5, gy: 0.16, gstr: 0.08, vig: 0.55 },
  { id: "plumsmoke", name: "Plum Smoke", c1: "#2a2030", c2: "#15101a", glow: "160,120,185", gx: 0.7, gy: 0.25, gstr: 0.1, vig: 0.5 },
  { id: "storm", name: "Storm", c1: "#232a32", c2: "#11151a", glow: "130,160,195", gx: 0.5, gy: 0.18, gstr: 0.09, vig: 0.54 },
  { id: "olive", name: "Olive Dusk", c1: "#272a20", c2: "#131510", glow: "190,200,150", gx: 0.3, gy: 0.2, gstr: 0.07, vig: 0.52 },
  { id: "clay", name: "Clay", c1: "#34261e", c2: "#1a1109", glow: AMB, gx: 0.7, gy: 0.3, gstr: 0.14, vig: 0.5, diag: true },
  { id: "pewter", name: "Pewter", c1: "#2e3034", c2: "#18191c", glow: "210,215,222", gx: 0.32, gy: 0.22, gstr: 0.07, vig: 0.5 },
  { id: "mocha", name: "Mocha", c1: "#2e241d", c2: "#160f0a", glow: "200,160,120", gx: 0.3, gy: 0.78, gstr: 0.1, vig: 0.52 },
  { id: "slateamber", name: "Slate Amber", c1: "#232830", c2: "#14130f", glow: AMB, gx: 0.78, gy: 0.82, gstr: 0.15, vig: 0.5, diag: true },
  { id: "fog", name: "Fog", c1: "#33363a", c2: "#1e2023", glow: "225,228,232", gx: 0.5, gy: 0.3, gstr: 0.08, vig: 0.4, grain: 0.06 },
  { id: "iron", name: "Iron", c1: "#222a33", c2: "#101418", glow: "150,180,210", gx: 0.28, gy: 0.2, gstr: 0.08, vig: 0.52, sheen: "180,205,225" },
  { id: "sandshadow", name: "Sand Shadow", c1: "#312a20", c2: "#181308", glow: "235,205,150", gx: 0.5, gy: 0.16, gstr: 0.09, vig: 0.54 },
  { id: "tealsmoke", name: "Teal Smoke", c1: "#1e2c2c", c2: "#101818", glow: "100,170,170", gx: 0.7, gy: 0.24, gstr: 0.1, vig: 0.5 },
  { id: "roseash", name: "Rose Ash", c1: "#302329", c2: "#181014", glow: "200,140,160", gx: 0.3, gy: 0.22, gstr: 0.1, vig: 0.5 },
  { id: "bronze", name: "Bronze", c1: "#322619", c2: "#1a1108", glow: AMB, gx: 0.32, gy: 0.24, gstr: 0.16, vig: 0.5, sheen: "240,200,140" },
  { id: "stone", name: "Stone", c1: "#2b2a27", c2: "#161514", glow: "220,216,208", gx: 0.5, gy: 0.2, gstr: 0.06, vig: 0.5 },
  { id: "duskviolet", name: "Dusk Violet", c1: "#262430", c2: "#13121a", glow: "150,140,190", gx: 0.5, gy: 0.82, gstr: 0.12, vig: 0.52 },
];

interface Def {
  id: string;
  name: string;
  group: string;
  light?: boolean;
  fn: (ctx: Ctx, w: number, h: number, rng: Rng) => void;
}

const DEFS: Def[] = [
  ...FADED.map((f) => ({ id: f.id, name: f.name, group: "Faded", fn: faded(f) })),
  {
    id: "paper", name: "Paper", group: "Paper", light: true,
    fn(ctx, w, h, rng) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#efe7d6"); g.addColorStop(0.5, "#e8dec9"); g.addColorStop(1, "#ddd0b8");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const x = rng() * w, y = rng() * h, a = rng() * 0.05; ctx.fillStyle = "rgba(120,100,70," + a + ")"; ctx.fillRect(x, y, 1.5, 1.5); }
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
      v.addColorStop(0, "rgba(120,95,55,0)"); v.addColorStop(1, "rgba(90,70,40,0.18)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "bone", name: "Bone", group: "Paper", light: true,
    fn(ctx, w, h, rng) {
      ctx.fillStyle = "#f1efe9"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { const x = rng() * w, y = rng() * h; ctx.fillStyle = "rgba(60,55,45," + rng() * 0.04 + ")"; ctx.fillRect(x, y, 1.5, 1.5); }
      const v = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.3, w / 2, h / 2, h * 0.8);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(40,38,32,0.12)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "nightcity", name: "Night City", group: "Photographic",
    fn(ctx, w, h, rng) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0b1322"); g.addColorStop(0.5, "#0a0e18"); g.addColorStop(1, "#050507");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const horizon = ctx.createRadialGradient(w * 0.5, h * 0.66, 0, w * 0.5, h * 0.66, w * 0.7);
      horizon.addColorStop(0, "rgba(" + AMBER + ",0.16)"); horizon.addColorStop(1, "rgba(" + AMBER + ",0)");
      ctx.fillStyle = horizon; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const x = rng() * w, y = h * 0.45 + rng() * h * 0.5, r = 1 + rng() * 4;
        const warm = rng() > 0.45;
        ctx.fillStyle = warm ? "rgba(255," + ((170 + rng() * 60) | 0) + ",90," + (0.25 + rng() * 0.5) + ")" : "rgba(120,180,255," + (0.15 + rng() * 0.4) + ")";
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      vignette(ctx, w, h, 0.6);
    },
  },
  {
    id: "sunset", name: "Sunset", group: "Photographic",
    fn(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#241a2e"); g.addColorStop(0.42, "#5d361f"); g.addColorStop(0.58, "#b35c22"); g.addColorStop(0.64, "#d6781f"); g.addColorStop(0.8, "#2c1a12"); g.addColorStop(1, "#0b0908");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const sun = ctx.createRadialGradient(w * 0.5, h * 0.6, 0, w * 0.5, h * 0.6, w * 0.5);
      sun.addColorStop(0, "rgba(255,210,150,0.5)"); sun.addColorStop(0.4, "rgba(" + AMBER + ",0.18)"); sun.addColorStop(1, "rgba(" + AMBER + ",0)");
      ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
      vignette(ctx, w, h, 0.5);
    },
  },
  {
    id: "dusk", name: "Dusk Drive", group: "Photographic",
    fn(ctx, w, h, rng) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#241334"); g.addColorStop(0.5, "#130d20"); g.addColorStop(1, "#080810");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ["255,120,60", "210,90,200", "120,140,255"].forEach((c, k) => {
        const x = (0.25 + k * 0.27) * w;
        const lg = ctx.createLinearGradient(0, 0, 0, h);
        lg.addColorStop(0, "rgba(" + c + ",0)"); lg.addColorStop(0.55, "rgba(" + c + ",0.18)"); lg.addColorStop(1, "rgba(" + c + ",0)");
        ctx.fillStyle = lg; ctx.fillRect(x, 0, 5 + rng() * 7, h);
      });
      for (let i = 0; i < 30; i++) { const x = rng() * w, y = h * 0.5 + rng() * h * 0.45, r = 1 + rng() * 3; ctx.fillStyle = "rgba(255,170,120," + (0.2 + rng() * 0.4) + ")"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      vignette(ctx, w, h, 0.55);
    },
  },
  {
    id: "noir", name: "Noir", group: "Cinematic",
    fn(ctx, w, h) {
      base(ctx, w, h, "#13110e");
      const wash = ctx.createLinearGradient(0, 0, w, h);
      wash.addColorStop(0, "rgba(40,32,24,0.55)"); wash.addColorStop(1, "rgba(10,9,8,0.2)");
      ctx.fillStyle = wash; ctx.fillRect(0, 0, w, h);
      const lite = ctx.createRadialGradient(w * 0.28, h * 0.2, 0, w * 0.28, h * 0.2, w * 0.85);
      lite.addColorStop(0, "rgba(232,214,190,0.16)"); lite.addColorStop(0.45, "rgba(" + AMBER + ",0.08)"); lite.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lite; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.05);
      vignette(ctx, w, h, 0.62);
    },
  },
  {
    id: "ember", name: "Ember", group: "Cinematic",
    fn(ctx, w, h) {
      base(ctx, w, h, "#120d09");
      const g = ctx.createRadialGradient(w * 0.28, h * 1.02, 0, w * 0.28, h * 1.02, w * 1.05);
      g.addColorStop(0, "rgba(" + AMBER + ",0.5)"); g.addColorStop(0.4, "rgba(" + AMBER + ",0.16)"); g.addColorStop(1, "rgba(" + AMBER + ",0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const cool = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, w * 0.7);
      cool.addColorStop(0, "rgba(90,70,120,0.12)"); cool.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cool; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.045);
      vignette(ctx, w, h, 0.5);
    },
  },
  {
    id: "spotlight", name: "Spotlight", group: "Cinematic",
    fn(ctx, w, h) {
      base(ctx, w, h, "#121009");
      const g = ctx.createRadialGradient(w * 0.5, h * 0.1, 0, w * 0.5, h * 0.1, h * 0.78);
      g.addColorStop(0, "rgba(255,244,224,0.22)"); g.addColorStop(0.45, "rgba(" + AMBER + ",0.1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.05);
      vignette(ctx, w, h, 0.66);
    },
  },
  {
    id: "duotone", name: "Charcoal", group: "Cinematic",
    fn(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#241a11"); g.addColorStop(0.5, "#15110c"); g.addColorStop(1, "#0c0b09");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const r = ctx.createRadialGradient(w * 0.8, h * 0.18, 0, w * 0.8, h * 0.18, w * 0.8);
      r.addColorStop(0, "rgba(" + AMBER + ",0.18)"); r.addColorStop(1, "rgba(" + AMBER + ",0)");
      ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.05);
      vignette(ctx, w, h, 0.5);
    },
  },
  {
    id: "mesh", name: "Mesh", group: "Cinematic",
    fn(ctx, w, h, rng) {
      base(ctx, w, h, "#0A0A0A");
      const blobs: [string, number][] = [["255,248,240", 0.05], [AMBER, 0.16], [AMBER, 0.1], ["120,90,200", 0.06], [AMBER, 0.08]];
      blobs.forEach((b) => {
        const x = rng() * w, y = rng() * h, rad = (0.35 + rng() * 0.4) * w;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(" + b[0] + "," + b[1] + ")"); g.addColorStop(1, "rgba(" + b[0] + ",0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
      vignette(ctx, w, h, 0.4);
    },
  },
  {
    id: "grainf", name: "Film grain", group: "Texture",
    fn(ctx, w, h) {
      base(ctx, w, h, "#0d0c0b");
      const sw = 540, sh = 675, oc = document.createElement("canvas");
      oc.width = sw; oc.height = sh;
      const octx = oc.getContext("2d")!;
      const img = octx.createImageData(sw, sh);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = 18 + Math.random() * 36; d[i] = v; d[i + 1] = v * 0.92; d[i + 2] = v * 0.82; d[i + 3] = 255; }
      octx.putImageData(img, 0, 0);
      ctx.globalAlpha = 0.55; ctx.drawImage(oc, 0, 0, w, h); ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(0,0,0,0.2)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "carbon", name: "Carbon", group: "Texture",
    fn(ctx, w, h) {
      base(ctx, w, h, "#0b0b0b");
      ctx.strokeStyle = "rgba(255,255,255,0.022)"; ctx.lineWidth = 2;
      for (let x = -h; x < w; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
      ctx.strokeStyle = "rgba(" + AMBER + ",0.03)";
      for (let x = -h; x < w; x += 7) { ctx.beginPath(); ctx.moveTo(x + 3.5, 0); ctx.lineTo(x + 3.5 - h, h); ctx.stroke(); }
      vignette(ctx, w, h, 0.5);
    },
  },
  {
    id: "leak", name: "Light leak", group: "Light",
    fn(ctx, w, h) {
      base(ctx, w, h, "#0A0A0A");
      ctx.save(); ctx.translate(w * 0.62, h * 0.5); ctx.rotate(-0.5);
      const g = ctx.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, "rgba(" + AMBER + ",0)"); g.addColorStop(0.5, "rgba(" + AMBER + ",0.30)"); g.addColorStop(0.62, "rgba(255,240,220,0.16)"); g.addColorStop(0.75, "rgba(" + AMBER + ",0)");
      ctx.fillStyle = g; ctx.fillRect(-w, -h, w * 2, h * 2); ctx.restore();
      vignette(ctx, w, h, 0.45);
    },
  },
  {
    id: "streaks", name: "Streaks", group: "Light",
    fn(ctx, w, h, rng) {
      base(ctx, w, h, "#090909");
      for (let i = 0; i < 7; i++) {
        const x = rng() * w, lw = 2 + rng() * 6, a = 0.05 + rng() * 0.14;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "rgba(" + AMBER + ",0)"); g.addColorStop(0.5, "rgba(" + AMBER + "," + a + ")"); g.addColorStop(1, "rgba(" + AMBER + ",0)");
        ctx.fillStyle = g; ctx.fillRect(x, 0, lw, h);
      }
      vignette(ctx, w, h, 0.5);
    },
  },
  {
    id: "bokeh", name: "Bokeh", group: "Light",
    fn(ctx, w, h, rng) {
      base(ctx, w, h, "#0A0A0A");
      for (let i = 0; i < 22; i++) {
        const x = rng() * w, y = rng() * h, r = 18 + rng() * 90, a = 0.04 + rng() * 0.12;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(" + AMBER + "," + a + ")"); g.addColorStop(0.7, "rgba(" + AMBER + "," + a * 0.4 + ")"); g.addColorStop(1, "rgba(" + AMBER + ",0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      vignette(ctx, w, h, 0.5);
    },
  },
  {
    id: "topo", name: "Topographic", group: "Pattern",
    fn(ctx, w, h) {
      base(ctx, w, h, "#0b0a09");
      ctx.lineWidth = 1.6;
      const cx = w * 0.5, cy = h * 0.55;
      for (let r = 60; r < w * 1.1; r += 46) {
        ctx.strokeStyle = "rgba(" + AMBER + "," + (0.1 - r / (w * 18)) + ")";
        ctx.beginPath();
        for (let a = 0; a <= 6.3; a += 0.12) {
          const wob = Math.sin(a * 3 + r * 0.02) * 18 + Math.cos(a * 5 + r) * 10;
          const x = cx + Math.cos(a) * (r + wob), y = cy + Math.sin(a) * (r + wob) * 0.9;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
      }
      vignette(ctx, w, h, 0.55);
    },
  },
  {
    id: "grid", name: "Perspective", group: "Pattern",
    fn(ctx, w, h) {
      base(ctx, w, h, "#0A0A0A");
      const hy = h * 0.46, vx = w * 0.5;
      ctx.strokeStyle = "rgba(" + AMBER + ",0.13)"; ctx.lineWidth = 1.4;
      for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(vx, hy); ctx.lineTo(vx + i * w * 0.16, h); ctx.stroke(); }
      for (let i = 1; i <= 14; i++) { const y = hy + Math.pow(i / 14, 2.2) * (h - hy); ctx.globalAlpha = 1 - i / 18; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, hy, 0, h);
      g.addColorStop(0, "rgba(10,10,10,0.85)"); g.addColorStop(1, "rgba(10,10,10,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy);
      vignette(ctx, w, h, 0.5);
    },
  },
];

function make(def: Def, seedNum: number): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  def.fn(ctx, W, H, mulberry32(seedNum));
  return c.toDataURL("image/jpeg", 0.84);
}

let CACHE: Texture[] | null = null;

export const textures = {
  DEFAULT: "noir",
  all(): Texture[] {
    if (typeof document === "undefined") return [];
    if (CACHE) return CACHE;
    CACHE = DEFS.map((d, i) => ({
      id: d.id,
      name: d.name,
      group: d.group,
      light: !!d.light,
      src: make(d, i + 3),
    }));
    return CACHE;
  },
  src(id: string): string | null {
    const t = this.all().find((x) => x.id === id);
    return t ? t.src : null;
  },
  isLight(id: string): boolean {
    const t = this.all().find((x) => x.id === id);
    return t ? t.light : false;
  },
};
