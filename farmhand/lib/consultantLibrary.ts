/* ============================================================
   Consultant Photo Library — the CMO's Higgsfield-prompt skill, in code.
   Mirrors brain/Brand/Consultant Photo Library.md: shot recipes + the
   composePrompt() recipe that assembles a spec-perfect Soul prompt from a
   shot intent, so the system generates the library — Taylor writes nothing.
   ============================================================ */

/** The negative clause appended to every consultant prompt (kills AI tells). */
export const CONSULTANT_NEGATIVE =
  "avoid: text, logos, watermarks, no logo or text on clothing, deformed hands, extra fingers, crossed-arm errors, exaggerated muscles, bulky physique, distorted arms, unnatural body proportions, plastic skin, over-smoothed face, over-saturation, fake bokeh, warped panels, bent rooflines";

/** The look every shot leads with: an iPhone snapshot, caught candid. The two
    biggest "reads real" levers — phone-camera look + unposed moment. */
export const IPHONE =
  "shot on an iPhone, natural iPhone photo look, everyday phone snapshot, true-to-life color, slight natural imperfection,";
export const CANDID =
  "candid and unposed, caught mid-moment, subject not looking at the camera, natural spontaneous expression, authentic everyday moment, not a posed portrait, not a fashion shoot";

/** Preset → the aesthetic phrase baked into the prompt (no style_id needed).
    All lean candid/everyday, not editorial-glossy. */
const PRESET_LOOK: Record<string, string> = {
  Realistic: "natural photoreal snapshot, believable skin texture",
  iPhone: "candid phone-camera snapshot, spontaneous slight tilt, natural imperfections",
  DigitalCamera: "everyday digital-camera photo, natural imperfections, unpolished realism",
  WarmAmbient: "soft warm window light, cozy everyday realism",
  Movie: "subtle natural cinematic light, believable, not a glossy film still",
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
  { id: "bio", label: "Bio headshot", job: "profile / pinned", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant in a plain solid-color polo standing in the driveway of a modern stucco Arizona home with rooftop solar, glancing off to the side with a relaxed natural smile, one hand in his pocket, golden-hour side light" },
  { id: "roof", label: "Rooftop authority", job: "field authority", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant in a plain polo and safety gear crouched beside solar panels on an Arizona tile roof, focused on the tablet in his hands checking the array, looking down at his work not the camera, early golden-hour light, desert suburb behind" },
  { id: "consult", label: "Kitchen-table consult", job: "the human moment", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant in a plain polo sitting at a kitchen island turned toward a homeowner, mid-conversation gesturing at a tablet, looking at the homeowner not the camera, warm window light, relaxed natural moment, modern Southwest kitchen" },
  { id: "driveway", label: "Driveway, tablet", job: "approachable", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant in a plain polo walking up the driveway of a solar-equipped Arizona home glancing down at a tablet, not looking at the camera, sunset light on the facade" },
  { id: "walk", label: "Walk-and-talk", job: "reel still / personality", preset: "DigitalCamera", aspect: "9:16", scene: "a solar consultant walking through a desert suburban neighborhood mid-stride, talking and gesturing while looking ahead, natural daylight, palo verde and stucco homes behind" },
  { id: "meter", label: "At the meter", job: "teaching", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant crouched at a home electric meter on a stucco wall, pointing and explaining to a homeowner beside him, looking at the meter not the camera, bright open shade" },
  { id: "battery", label: "Battery wall", job: "product knowledge", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant beside a wall-mounted home battery in a clean Arizona garage, mid-gesture explaining to someone off-frame while looking at the unit, soft practical light and open garage-door spill, realistic hardware" },
  { id: "bill", label: "Holding a bill", job: "bill literacy", preset: "WarmAmbient", aspect: "3:4", scene: "a solar consultant in a plain polo at a table looking down at a paper electric bill he is holding, mid-explanation, warm window light, focused on the bill not the camera, natural framing, realistic paper and hands, no readable text" },
  { id: "truck", label: "Truck / tailgate", job: "working pro", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant leaning on the open tailgate of a work truck loaded with solar panels and gear, looking off toward the house, relaxed, late-afternoon desert light, dusty authentic work vibe" },
  { id: "onsite", label: "On-site w/ homeowner", job: "trust", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing with a homeowner in front of a solar-equipped Arizona home, both looking up at the roof mid-conversation, golden hour, unposed" },
  { id: "portrait", label: "Candid portrait", job: "human connection", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant in a plain polo laughing naturally mid-conversation while looking slightly off to the side, outdoors in soft evening light, genuine relatable moment" },
  { id: "wide", label: "Wide, at his home", job: "environmental", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing in the yard looking up at the rooftop solar array on a modern desert home, one hand shading his eyes, golden hour, wide environmental shot, not looking at the camera" },
];

/**
 * The SKILL: compose a full Higgsfield Soul prompt from a shot recipe.
 * preset look (as text) + scene + a compact realism scaffold + negative clause.
 * Deliberately compact — no "8k/hyperreal" tokens (those are the AI tell).
 */
export function composePrompt(shot: ConsultantShot): string {
  return `${IPHONE} ${CANDID}, ${shot.scene}. ${CONSULTANT_NEGATIVE}`;
}
