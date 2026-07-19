/**
 * Post visual direction — turns a slide deck into a coherent SET of
 * image-generation prompts (cover / body / CTA) following the Higgsfield
 * craft playbook (docs/higgsfield-instagram-playbook.md):
 *
 * - Aesthetic first, prompt second: pick ONE aesthetic pack per post, then
 *   write short, concrete shot prompts. Long over-stuffed prompts produce
 *   worse, more distorted output than a clean subject + a strong look.
 * - One idea per asset: one subject, one mood per slide.
 * - Variety is a system: packs rotate per post via an explicit recent-use
 *   log, so consecutive posts never share a look (the #1 faceless-account
 *   killer is sameness).
 * - Consistency anchor: every pack keeps the Arizona desert-suburb setting
 *   and a no-text guard — the brand signature survives the variety.
 * - Negative space: slides carry text overlays, so every prompt reserves
 *   clean space for legibility.
 */

import type { Slide } from "./studio";

/* ---- aesthetic packs (Soul-style presets, all photoreal + AZ-native) ---- */
export interface AestheticPack {
  id: string;
  name: string;
  style: string; // lighting + palette + grade
  lens: string; // photography language the model responds to
}

export const AESTHETIC_PACKS: AestheticPack[] = [
  {
    id: "golden",
    name: "Golden Hour Lifestyle",
    style: "warm golden-hour light, honeyed tones, soft long shadows",
    lens: "35mm, shallow depth of field",
  },
  {
    id: "editorial",
    name: "Editorial Minimal",
    style: "clean editorial magazine look, muted warm palette, generous negative space",
    lens: "50mm, deep focus",
  },
  {
    id: "bluehour",
    name: "Blue Hour Cinematic",
    style: "blue-hour dusk, warm window glow against a cool sky, cinematic teal-and-orange grade",
    lens: "24mm wide",
  },
  {
    id: "phonecam",
    name: "Phone-Cam Authentic",
    style: "smartphone-authentic candid realism, natural color, believable everyday detail",
    lens: "26mm phone-camera look",
  },
  {
    id: "highkey",
    name: "Desert High-Key",
    style: "bright airy high-key daylight, bleached desert palette, crisp clean light",
    lens: "35mm, deep focus",
  },
  {
    id: "nocturne",
    name: "Warm Nocturne",
    style: "night scene lit by warm porch and window light, deep shadows, quiet calm mood",
    lens: "50mm, shallow depth of field",
  },
];

/** Theme → the hero shot that anchors the carousel's cover. */
const THEME_COVER: Record<string, string> = {
  "bill-breakdown": "wide shot of a modern desert home, visible rooftop solar panels, dramatic sky",
  "battery-ev": "sleek home battery unit on a garage wall beside an EV charging",
  "objection-handling": "modern kitchen table with a laptop and papers, calm decision-making mood",
  "buyer-education": "solar panels on a terracotta tile roof against a deep blue Arizona sky",
  "new-homeowner": "brand-new suburban desert home exterior, builder-fresh landscaping",
  "myth-busting": "dramatic monsoon clouds building over a desert neighborhood with solar rooftops",
  authority: "aerial view of a master-planned desert community, rooftops catching light",
  "social-proof": "welcoming front porch of a desert home, warm and lived-in",
  referral: "two neighboring desert homes with solar panels, shared block wall",
};

/** Rotating supporting shots for body slides — one subject each. */
const BODY_SHOTS = [
  "close-up detail of solar panel cells catching light, shallow depth of field",
  "bright modern living room, mountain view through large windows, ceiling fan",
  "backyard pool with desert landscaping and saguaro silhouettes",
  "smart home energy display on a wall in a clean modern hallway",
  "desert neighborhood street, long shadows, quiet and still",
];

const CTA_SHOT = "inviting modern front door with a glowing porch light, desert plants framing the entry";

/* ---- anti-repetition log: last few packs used, avoided next time ---- */
const LOG_KEY = "fh-visual-log";
export function readPackLog(): string[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x) => typeof x === "string").slice(-4) : [];
  } catch {
    return [];
  }
}
export function pushPackLog(id: string) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([...readPackLog(), id].slice(-4)));
  } catch {}
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick this post's aesthetic: seeded by the idea, skipping recently used looks. */
export function pickPack(seedKey: string, avoid: string[]): AestheticPack {
  const start = hashStr(seedKey || "post") % AESTHETIC_PACKS.length;
  for (let i = 0; i < AESTHETIC_PACKS.length; i++) {
    const p = AESTHETIC_PACKS[(start + i) % AESTHETIC_PACKS.length];
    if (!avoid.includes(p.id)) return p;
  }
  return AESTHETIC_PACKS[start];
}

const GUARD = "photorealistic, no text, no lettering, no logos, no watermarks";

export function buildSlidePrompts(
  slides: Slide[],
  opts: { theme?: string; territoryName?: string; city?: string; avoidPacks?: string[] }
): { prompts: string[]; pack: AestheticPack } {
  const place = opts.city || opts.territoryName || "Phoenix";
  const pack = pickPack(`${opts.theme || ""}:${opts.territoryName || ""}`, opts.avoidPacks || []);
  // short prompts: shot + place anchor + pack look + overlay-safe guard
  const suffix = `${place} Arizona desert suburb. ${pack.style}, ${pack.lens}, negative space for text overlay, ${GUARD}`;
  const prompts = slides.map((s, i) => {
    let shot: string;
    if (i === 0) shot = THEME_COVER[opts.theme || ""] || THEME_COVER["bill-breakdown"];
    else if (s.role === "CTA" || i === slides.length - 1) shot = CTA_SHOT;
    else shot = BODY_SHOTS[(i - 1) % BODY_SHOTS.length];
    return `${shot}. ${suffix}`;
  });
  return { prompts, pack };
}

/** Single-image prompt for the quick generator panel, in a chosen look. */
export function singlePrompt(vertical: "solar" | "realtor", pack: AestheticPack): string {
  const subject =
    vertical === "solar"
      ? "modern Arizona suburban home with rooftop solar panels, saguaro and desert landscaping"
      : "welcoming Arizona suburban neighborhood street, desert landscaping";
  return `${subject}. ${pack.style}, ${pack.lens}, ${GUARD}`;
}
