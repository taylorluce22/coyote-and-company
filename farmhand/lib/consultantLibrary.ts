/* ============================================================
   Consultant Photo Library — the CMO's Higgsfield-prompt skill, in code.
   Mirrors brain/Brand/Consultant Photo Library.md: shot recipes + the
   composePrompt() recipe that assembles a spec-perfect Soul prompt from a
   shot intent, so the system generates the library — Taylor writes nothing.
   ============================================================ */

/** The negative clause appended to every consultant prompt (kills AI tells). */
export const CONSULTANT_NEGATIVE =
  "avoid: text, logos, watermarks, deformed hands, extra fingers, plastic skin, over-smoothed face, over-saturation, fake bokeh, warped panels, bent rooflines";

/** Preset → the aesthetic phrase baked into the prompt (no style_id needed). */
const PRESET_LOOK: Record<string, string> = {
  Realistic: "photoreal editorial photograph, natural skin texture, believable",
  iPhone: "candid iPhone-style photo, spontaneous slight tilt, natural imperfections, believable",
  DigitalCamera: "everyday digital-camera photo, natural imperfections, unpolished realism",
  WarmAmbient: "warm ambient lifestyle photo, soft window light, cozy realism",
  Movie: "subtle cinematic photo, controlled contrast, filmic realism",
};

export interface ConsultantShot {
  id: string;
  label: string;
  job: string; // what the shot is for
  preset: keyof typeof PRESET_LOOK;
  scene: string; // the scene tokens
  aspect: "3:4" | "9:16" | "1:1";
}

/** The 12 seed shots — one coherent consultant persona. */
export const CONSULTANT_SHOTS: ConsultantShot[] = [
  { id: "bio", label: "Bio headshot", job: "profile / pinned", preset: "Realistic", aspect: "3:4", scene: "a confident solar consultant in a clean solid polo standing outside a modern stucco Arizona home with rooftop solar, relaxed genuine half-smile, arms lightly crossed, golden-hour side light, shallow depth of field" },
  { id: "roof", label: "Rooftop authority", job: "field authority", preset: "Realistic", aspect: "3:4", scene: "a solar consultant in a polo and safety gear kneeling beside clean solar panels on an Arizona tile roof, holding a tablet, checking the array, early golden-hour light, desert suburb behind, realistic tools and posture" },
  { id: "consult", label: "Kitchen-table consult", job: "the human moment", preset: "WarmAmbient", aspect: "3:4", scene: "a solar consultant sitting at a kitchen island with a homeowner seen from behind, pointing at a tablet showing an energy chart, warm afternoon window light, relaxed trustworthy body language, modern Southwest kitchen" },
  { id: "driveway", label: "Driveway, tablet", job: "approachable", preset: "iPhone", aspect: "3:4", scene: "a solar consultant standing in the driveway of a solar-equipped Arizona home, glancing at a tablet, casual polished wardrobe, sunset light on the facade" },
  { id: "walk", label: "Walk-and-talk", job: "reel still / personality", preset: "DigitalCamera", aspect: "9:16", scene: "a solar consultant walking through a desert suburban neighborhood mid-stride, gesturing while talking to camera, natural daylight, palo verde and stucco homes behind" },
  { id: "meter", label: "At the meter", job: "teaching", preset: "Realistic", aspect: "3:4", scene: "a solar consultant pointing at a home electric meter on a stucco wall, mid-explanation, homeowner partly in frame, bright open shade, authentic teaching moment" },
  { id: "battery", label: "Battery wall", job: "product knowledge", preset: "Movie", aspect: "3:4", scene: "a solar consultant standing beside a wall-mounted home battery in a clean Arizona garage, calm confident expression, gesturing toward the unit, soft practical light and open garage-door spill, realistic hardware" },
  { id: "bill", label: "Holding a bill", job: "bill literacy", preset: "WarmAmbient", aspect: "3:4", scene: "a solar consultant at a table holding a paper electric bill, explaining a line on it, warm window light, focused approachable expression, close natural framing, realistic paper and hands, no readable text" },
  { id: "truck", label: "Truck / tailgate", job: "working pro", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant leaning on the tailgate of a work truck with solar panels and gear, casual confident, late-afternoon desert light, dusty authentic work vibe" },
  { id: "onsite", label: "On-site w/ homeowner", job: "trust", preset: "Realistic", aspect: "3:4", scene: "a solar consultant standing with a homeowner in front of a solar-equipped Arizona home, both looking up at the roof, natural conversation, golden hour, no staged poses" },
  { id: "portrait", label: "Warm candid portrait", job: "human connection", preset: "iPhone", aspect: "3:4", scene: "a candid warm portrait of a solar consultant laughing naturally, outdoors in soft evening light, casual polo, genuine relatable expression, believable skin and eyes" },
  { id: "wide", label: "Wide, in front of home", job: "environmental", preset: "Movie", aspect: "3:4", scene: "a solar consultant standing confidently in front of a modern desert home with a clean rooftop solar array, wide environmental portrait, golden hour, understated premium mood, realistic architecture and panels" },
];

/**
 * The SKILL: compose a full Higgsfield Soul prompt from a shot recipe.
 * preset look (as text) + scene + a compact realism scaffold + negative clause.
 * Deliberately compact — no "8k/hyperreal" tokens (those are the AI tell).
 */
export function composePrompt(shot: ConsultantShot): string {
  return `${PRESET_LOOK[shot.preset]}, ${shot.scene}. ${CONSULTANT_NEGATIVE}`;
}
