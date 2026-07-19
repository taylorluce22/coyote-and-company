/**
 * Post visual direction — turns a slide deck into a coherent SET of
 * image-generation prompts (cover / body / CTA), all sharing one style
 * language so a carousel reads as one designed piece instead of unrelated
 * stock. Pair with a shared `seed` at the API layer for extra congruence.
 */

import type { Slide } from "./studio";

/** Theme → the hero shot that anchors the carousel's cover. */
const THEME_COVER: Record<string, string> = {
  "bill-breakdown": "wide shot of a modern desert home at golden hour, visible rooftop solar panels, dramatic warm light",
  "battery-ev": "sleek home battery unit on a garage wall beside an EV charging, warm evening light through the door",
  "objection-handling": "modern kitchen table with a laptop and papers, morning light, calm decision-making mood",
  "buyer-education": "close-up of solar panels on a terracotta tile roof against a deep blue Arizona sky",
  "new-homeowner": "brand-new suburban desert home exterior, builder-fresh landscaping, morning light",
  "myth-busting": "dramatic monsoon clouds building over a desert neighborhood with solar rooftops",
  authority: "aerial view of a master-planned desert community at dusk, rooftops catching last light",
  "social-proof": "welcoming front porch of a desert home at dusk, warm string lights",
  referral: "two neighboring desert homes with solar panels, shared block wall, friendly afternoon light",
};

/** Rotating supporting shots for body slides. */
const BODY_SHOTS = [
  "close-up detail of solar panel cells catching sunlight, shallow depth of field",
  "bright modern living room with mountain view through large windows, ceiling fan",
  "backyard pool at dusk with desert landscaping and saguaro silhouettes",
  "smart home energy display on a wall in a clean modern hallway",
  "desert neighborhood street at sunset, long shadows, warm tones",
];

const CTA_SHOT = "inviting modern front door at dusk with warm porch light glowing, desert plants framing the entry";

export function buildSlidePrompts(
  slides: Slide[],
  opts: { theme?: string; territoryName?: string; city?: string }
): string[] {
  const place = opts.city || opts.territoryName || "Phoenix";
  // one shared style sentence = the visual glue across every slide
  const style =
    `Photorealistic editorial photography, warm golden-hour palette, ${place} Arizona suburban setting, ` +
    `cohesive magazine series, consistent color grading, no text, no lettering, no logos, no watermarks`;
  return slides.map((s, i) => {
    let shot: string;
    if (i === 0) shot = THEME_COVER[opts.theme || ""] || THEME_COVER["bill-breakdown"];
    else if (s.role === "CTA" || i === slides.length - 1) shot = CTA_SHOT;
    else shot = BODY_SHOTS[(i - 1) % BODY_SHOTS.length];
    return `${shot}. ${style}`;
  });
}
