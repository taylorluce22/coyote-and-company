/* ============================================================
   Consultant Photo Library — the CMO's Higgsfield-prompt skill, in code.
   Mirrors brain/Brand/Consultant Photo Library.md: shot recipes + the
   composePrompt() recipe that assembles a spec-perfect Soul prompt from a
   shot intent, so the system generates the library — Taylor writes nothing.
   ============================================================ */

/** The negative clause appended to every consultant prompt (kills AI tells). */
export const CONSULTANT_NEGATIVE =
  "avoid: text, logos, watermarks, no logo or text on clothing, deformed hands, extra fingers, crossed-arm errors, oversized forearm, giant arm, muscular arms, foreshortened limbs, huge hands, distorted anatomy, exaggerated muscles, bulky physique, distorted arms, unnatural body proportions, plastic skin, over-smoothed face, awkward open mouth, mid-word grimace, harsh on-camera flash, blown-out flash, unflattering light, red eyes, over-saturation, fake bokeh, warped panels, bent rooflines, cardigan, blazer, sport coat, sweater, suit jacket, necktie, black t-shirt, formal or fashion wardrobe, hand on hip, crossed legs, editorial fashion pose, moody magazine lighting, receding hairline, balding, thinning hair, altered hairline, hands on solar panels, touching solar panels, posing in front of solar panels, standing against a solar panel, patterned shirt, graphic print, loud print, tie-dye, floral shirt, busy pattern, printed golf shirt, solar panel graphic on shirt, logo on shirt, duplicated person, two identical people, twin, clone";

/** The look every shot leads with: an iPhone snapshot, caught candid. The two
    biggest "reads real" levers — phone-camera look + unposed moment. */
export const IPHONE =
  "shot on an iPhone, looks like a photo straight from a personal camera roll, natural everyday phone snapshot, true-to-life color, slight natural imperfection, varied framing (sometimes wider, not always close up),";
/** Locks the setting to the Arizona desert Southwest — "Arizona" alone drifts
    to generic/European suburbs. Appended to every scene. */
export const ARIZONA =
  "set in a Phoenix Arizona desert suburb: tan stucco homes with tile roofs, xeriscape desert landscaping with gravel, cactus, agave and palo verde trees, dry desert ground, distant brown desert mountains, bright dry Southwest sunlight, no green grass lawns, unmistakably Arizona";

export const CANDID =
  "candid and unposed, caught mid-moment, subject not looking at the camera, natural spontaneous expression, authentic everyday moment, not a posed portrait, not a fashion shoot, relaxed natural body pose, average lean build, arms relaxed at natural angles (never reaching toward the camera), a lean man with a natural full hairline, one clear main subject, wearing a plain clean single-color athletic polo (sleek minimal Lululemon-style, one muted solid color like navy, grey, black, or olive) with casual chinos, off-center environmental composition, caught in the middle of an activity, face at a natural angle or in profile, not centered, not a straight-on portrait";

/** Preset → the aesthetic phrase baked into the prompt (no style_id needed).
    All lean candid/everyday, not editorial-glossy. */
const PRESET_LOOK: Record<string, string> = {
  Realistic: "natural photoreal snapshot, believable skin texture",
  iPhone: "candid phone-camera snapshot, spontaneous slight tilt, natural imperfections",
  DigitalCamera: "everyday digital-camera photo, natural imperfections, unpolished realism",
  WarmAmbient: "soft soft daylight from a window, no flash, cozy everyday realism",
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

/** Shot recipes — design-review moments + camera-roll candid activity. No
    posing with / hands on panels; the crew is on the roof, Taylor spectates. */
export const CONSULTANT_SHOTS: ConsultantShot[] = [
  // — the design-review moment (core: showing a customer their new design) —
  { id: "review-table", label: "Showing the design · table", job: "the sale moment", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant sitting at a kitchen table beside a homeowner, showing them their new solar system design on a tablet, both looking down at the screen, calm and focused, soft daylight from a window no flash, off-center camera-roll candid" },
  { id: "review-driveway", label: "Showing the design · driveway", job: "the sale moment", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing next to a homeowner in a driveway, showing them their new solar design on a tablet held between them, both looking down at the screen, warm afternoon light, off-center environmental" },
  { id: "review-couch", label: "Reviewing on a laptop", job: "the sale moment", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant sitting beside a customer on a couch, reviewing a solar design layout on a laptop screen together, both looking at the screen, warm living-room daylight, candid" },
  { id: "review-island", label: "Design on the island", job: "the sale moment", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant at a kitchen island with a homeowner across from him, a laptop showing a solar design turned toward the homeowner, calm relaxed conversation, soft daylight from a window, off-center" },
  // — spectating the install crew (Taylor on the ground, crew on the roof) —
  { id: "spectate", label: "Watching the install", job: "field / proof", preset: "DigitalCamera", aspect: "3:4", scene: "a wide shot of a solar consultant standing on the ground in a driveway watching an install crew work on a residential roof installing solar panels, hands relaxed, looking up at the crew, natural daylight, off-center, camera-roll candid, the consultant is small in a wider frame" },
  { id: "photograph", label: "Photographing the new system", job: "field / proof", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing in a backyard holding his phone up at chest height taking a photo of sleek new all-black triple-black solar panels on the back of a modern Arizona house, seen from behind or the side with his arm relaxed, natural daylight, off-center camera-roll candid" },
  { id: "powerwall3", label: "Next to a Powerwall 3", job: "field / product", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing beside a wall-mounted Tesla Powerwall 3 installed in a clean modern garage, looking at the unit, relaxed natural stance, soft natural garage light, off-center" },
  // — solo, camera-roll candid activity —
  { id: "laptop", label: "Working on a MacBook", job: "at-work candid", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant sitting at a kitchen table working on a solar design on an open MacBook laptop, looking at the screen in profile, off to one side of the frame, soft daylight from a window" },
  { id: "driveway", label: "Walking, tablet", job: "candid", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant walking up a driveway glancing down at a tablet held low at his side, three-quarter angle, off-center, dusk light" },
  { id: "walk", label: "Walking, phone", job: "reel still", preset: "DigitalCamera", aspect: "9:16", scene: "a solar consultant walking along a neighborhood sidewalk glancing down at his phone, seen from a slight angle, warm evening light, desert homes behind" },
  { id: "phone-profile", label: "On the phone, profile", job: "candid", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing outdoors looking down at his phone in profile, off to one side of the frame, warm afternoon light, a desert home in the background" },
  { id: "tailgate", label: "Truck tailgate, tablet", job: "working pro", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant sitting on the open tailgate of a work truck looking down at a tablet on his lap, seen from the side, off-center, late-afternoon light" },
  { id: "office", label: "Home office, laptop", job: "at-work candid", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant sitting at a desk in a home office looking at a laptop screen in profile, jotting a note, soft daylight, environmental" },
  { id: "training", label: "Presenting at a training", job: "authority", preset: "DigitalCamera", aspect: "3:4", scene: "a solar consultant standing to one side at the front of a room presenting to a small group of people seated with their backs to the camera, gesturing naturally toward a screen, mid-presentation, wide environmental shot, not centered" },
];

/**
 * The SKILL: compose a full Higgsfield Soul prompt from a shot recipe.
 * preset look (as text) + scene + a compact realism scaffold + negative clause.
 * Deliberately compact — no "8k/hyperreal" tokens (those are the AI tell).
 */
export function composePrompt(shot: ConsultantShot): string {
  // Positive-only: Higgsfield's Soul prompt field is NOT a negative prompt —
  // naming unwanted things ("no logo", "no pattern") can summon them. Keep the
  // constraints phrased positively in IPHONE/CANDID/scene. CONSULTANT_NEGATIVE
  // is exported for a real negative-prompt field only (if one is available).
  return `${IPHONE} ${CANDID}, ${shot.scene}, ${ARIZONA}.`;
}
