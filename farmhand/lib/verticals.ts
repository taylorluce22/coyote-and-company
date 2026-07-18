/**
 * Verticals — the LocalOS thesis made concrete. The lead engine is one
 * machine (whole-web hunt → score → train → inbox); what changes per
 * profession is WHAT counts as intent. Each vertical defines its intents,
 * its search phrasing, its relevance backstop, and its inbox tags. The
 * realtor definition preserves the original behavior exactly; solar is the
 * second vertical, same concept aimed at homeowner solar intent in Arizona.
 */

export type VerticalId = "realtor" | "solar";

export interface VerticalIntent {
  key: string;
  label: string;
  color: string;
}

export interface VerticalDef {
  id: VerticalId;
  label: string;
  profession: string; // how the hunt prompt describes the user
  intents: VerticalIntent[];
  defaultIntents: string[]; // engine training default
  defaultGuidance: string; // Teach panel default
  /** literal search phrases per territory — anchors the model's web queries */
  territoryPhrases: (name: string) => string;
  /** state-level phrases for prospects who haven't named a place/company yet */
  statePhrases: string;
  /** one paragraph: what the PRIMARY target is for this vertical */
  primaryTarget: string;
  /** what is NEVER a lead for this vertical, in hard terms */
  hardExclude: string;
  /** focus text for the dedicated statewide Reddit lane */
  statewideLaneFocus: string;
  /** deterministic relevance backstop — code, not a prompt instruction */
  isRelevant: (text: string) => boolean;
  /**
   * Deep-hunt query matrix — the concrete, literal web searches a human
   * prospector would actually run, one by one. Fanned out in batches by the
   * engine's deep mode.
   */
  queryMatrix: (territories: string[]) => string[];
  /** Native Reddit search: multireddit ("a+b+c") + literal search terms. */
  redditSubs: string;
  redditTerms: string[];
  /** Map an inbox tag to an intent key for natively-fetched posts. */
  tagToIntent: Record<string, string>;
  /** rule-based inbox tags */
  tagRules: { re: RegExp; tag: string }[];
  tagColors: Record<string, string>;
}

/* ---------------------------------- realtor ---------------------------------- */

const HOUSING_SIGNAL =
  /\b(neighborhood|neighbourhood|\bhoa\b|school district|moving to|relocat\w*|renting|rent an? (apartment|house|home|place)|buy(ing)? a (house|home)|realtor|real estate|housing market|where (should|to) (i|we) live|subdivision|down ?payment|closing costs|listing agent|open house)\b/i;
const NON_HOUSING_SERVICE =
  /\b(salon|barber|hair ?dresser|nail salon|day ?spa|restaurant|\bbars?\b|nightlife|\bdj\b|night ?club|dentist|orthodontist|doctor|physician|mechanic|auto shop|plumber|electrician|contractor|handyman|lawyer|attorney|veterinarian|\bvet\b|therapist|tattoo|gym|yoga studio|day ?care|babysitter|hair salon)\b/i;

const REALTOR: VerticalDef = {
  id: "realtor",
  label: "Real estate",
  profession: "real estate agent",
  intents: [
    { key: "relocation", label: "Relocating in", color: "#7DD3FC" },
    { key: "buyer", label: "Buyers", color: "#41D98A" },
    { key: "seller", label: "Sellers", color: "#FFC23D" },
    { key: "investor", label: "Investors", color: "#C9A8FF" },
    { key: "renter", label: "Renters", color: "#26E0C8" },
    { key: "referral", label: "Referral asks", color: "#FF9A62" },
  ],
  defaultIntents: ["relocation", "referral", "buyer"],
  defaultGuidance:
    "The highest-value lead for me is someone asking for recommendations on where to live in Arizona — " +
    "'anyone recommend a good area', 'where should I live', 'best neighborhoods/suburbs for families or " +
    "professionals', or someone moving to Arizona (from out of state or relocating within AZ) who wants advice " +
    "on where to settle. These people usually don't have an agent yet — that's what makes them valuable. " +
    "Prioritize posts like this over generic market talk, price debates, or investor chatter.",
  territoryPhrases: (name) =>
    `${name}: "moving to ${name}", "relocating to ${name}", "just moved to ${name}", "new to ${name}", ` +
    `"recommend a neighborhood near ${name}", "where should I live near ${name}"`,
  statePhrases:
    `Arizona (broad, no neighborhood named yet): "moving to Arizona", "relocating to Arizona", "moving to ` +
    `Phoenix", "where should I live in Arizona", "anyone recommend a good area in Arizona/the Valley", "thinking ` +
    `about moving to AZ"`,
  primaryTarget:
    `people asking for MOVING RECOMMENDATIONS and WHERE TO LIVE in Arizona. State-level hits do NOT need to name ` +
    `a specific neighborhood — someone new to the state usually doesn't know neighborhood names yet, and that ` +
    `"undecided, doesn't have an agent yet" moment is exactly the highest-value lead. Count these as strong ` +
    `matches even without a named territory. Secondary: posts naming the specific territories directly with ` +
    `buy/sell/rent/invest intent.`,
  hardExclude:
    `requests for a specific LOCAL BUSINESS OR SERVICE recommendation that has nothing to do with housing — a ` +
    `salon, barber, restaurant, bar, dentist, doctor, mechanic, contractor, plumber, lawyer, event/nightlife ` +
    `suggestion, "anyone know a good [X] near me", or any other everyday-life recommendation ask. The word ` +
    `"recommend" alone does NOT make something a lead — it must specifically be about a NEIGHBORHOOD, AREA, ` +
    `SUBURB, or WHERE TO LIVE (buy/rent/relocate), not about a business, product, or activity.`,
  statewideLaneFocus:
    "For this search, look specifically on Reddit (reddit.com) for STATE-LEVEL relocation questions — people " +
    "who haven't picked a suburb yet: \"moving to Arizona\", \"moving to Phoenix\", \"relocating to AZ\", \"where " +
    "should I live in Arizona / the Valley\", \"best Phoenix suburbs\". Check r/phoenix, r/arizona, " +
    "r/MovingtoPhoenix, r/SameGrassButGreener and similar. These are the highest-value leads — undecided, no " +
    "agent yet — so cast wide here.",
  isRelevant: (text) => {
    const t = text.toLowerCase();
    if (NON_HOUSING_SERVICE.test(t) && !HOUSING_SIGNAL.test(t)) return false;
    return true;
  },
  queryMatrix: (territories) => [
    ...territories.flatMap((n) => [
      `"moving to ${n}" advice`,
      `"${n}" neighborhood recommendation moving`,
    ]),
    `site:reddit.com/r/phoenix moving where to live`,
    `site:reddit.com/r/arizona relocating advice`,
    `site:reddit.com/r/MovingtoPhoenix suburbs`,
    `"moving to Arizona" "where should" live`,
    `"moving to Phoenix" neighborhoods advice`,
    `relocating to Arizona need advice forum`,
    `"first time buyer" Phoenix area advice`,
    `Phoenix suburbs families question reddit`,
  ],
  redditSubs: "phoenix+arizona+MovingtoPhoenix+SameGrassButGreener+Scottsdale+gilbert",
  redditTerms: ["moving to", "relocating", "where should I live", "neighborhood recommendation", "first time buyer", "which suburb"],
  tagToIntent: {
    relocation: "relocation",
    "market-question": "seller",
    "recommendation-ask": "referral",
    "neighborhood-chat": "relocation",
    "agent-mention": "referral",
    general: "signal",
  },
  tagRules: [
    { re: /(moving|relocat|out of state|from (chicago|california|seattle|denver|portland))/i, tag: "relocation" },
    { re: /(worth|price|market|sell|value|equity|rates?)/i, tag: "market-question" },
    { re: /(hoa|school|commute|neighborhood|community|park)/i, tag: "neighborhood-chat" },
    { re: /(agent|realtor|broker)/i, tag: "agent-mention" },
  ],
  tagColors: {
    relocation: "#7DD3FC",
    "market-question": "#FFC23D",
    "recommendation-ask": "#41D98A",
    "neighborhood-chat": "#C9A8FF",
    "agent-mention": "#FF9A62",
    general: "#8B89A0",
  },
};

/* ----------------------------------- solar ----------------------------------- */

const SOLAR_SIGNAL =
  /\b(solar|photovoltaic|\bpv\b|panels?|inverter|net ?metering|kwh|kilowatt|\baps\b|\bsrp\b|tep\b|electric bill|power bill|utility bill|rate plan|on-?peak|powerwall|battery backup|enphase|micro ?inverters?|sunrun|tesla (solar|energy)|energy independence|ev charg\w*)\b/i;
const SOLAR_NOISE =
  /\b(job|hiring|career|recruit\w*|commission structure|door.?to.?door|d2d|sales (rep|position|team)|mlm|setter position|closer position)\b/i;

const SOLAR: VerticalDef = {
  id: "solar",
  label: "Solar",
  profession: "residential solar consultant",
  intents: [
    { key: "considering", label: "Considering solar", color: "#FFC23D" },
    { key: "quote-shopping", label: "Comparing quotes", color: "#41D98A" },
    { key: "bill-pain", label: "High-bill pain", color: "#FF5D8F" },
    { key: "new-homeowner", label: "New homeowners", color: "#7DD3FC" },
    { key: "battery-ev", label: "Battery / EV", color: "#C9A8FF" },
    { key: "referral", label: "Installer asks", color: "#FF9A62" },
  ],
  defaultIntents: ["considering", "quote-shopping", "bill-pain", "referral"],
  defaultGuidance:
    "The highest-value lead for me is an Arizona homeowner actively considering solar or already shopping — " +
    "'thinking about going solar', 'got a quote from X, is it fair', 'my APS/SRP bill is out of control', " +
    "'anyone recommend a good solar company near me'. APS customers are my PRIMARY target; SRP customers are " +
    "second. New homeowners planning solar and EV owners weighing a battery are strong too. Skip renters, " +
    "anti-solar rants, DIY-only off-grid hobbyists, commercial/utility scale, and anyone recruiting for solar " +
    "sales jobs.",
  territoryPhrases: (name) =>
    `${name}: "going solar in ${name}", "solar quote ${name}", "solar company near ${name}", "solar installer ` +
    `${name}", "APS bill ${name}", "SRP bill ${name}"`,
  statePhrases:
    `Arizona (broad): "going solar in Arizona", "is solar worth it in Arizona/Phoenix", "best solar company in ` +
    `Arizona", "solar quote Phoenix", "APS solar rates", "SRP solar plan", "APS bill too high", "SRP on-peak ` +
    `rates", "Tesla Powerwall Arizona", "EV charging home solar"`,
  primaryTarget:
    `Arizona HOMEOWNERS showing real intent around rooftop solar: considering going solar, comparing installer ` +
    `quotes (price per watt, financing, lease vs own), complaining about high APS/SRP/TEP electric bills and ` +
    `open to alternatives, asking for installer recommendations, new homeowners planning solar, or EV/battery ` +
    `owners weighing an upgrade. A post only needs genuine homeowner intent — it does NOT need to name a ` +
    `specific city; state-level "is solar worth it in Arizona" questions are strong leads.`,
  hardExclude:
    `solar-industry JOB posts and recruiting (setters, closers, D2D sales positions), MLM-style pitches, ` +
    `commercial/utility-scale project chatter, pure DIY off-grid hobbyists who explicitly refuse installers, ` +
    `renters who can't install, anti-solar rants with no genuine question, and generic electrician/roofing ` +
    `service asks with no solar interest. "Solar" appearing in a post does not make it a lead — it must be a ` +
    `HOMEOWNER with real interest in getting or evaluating solar.`,
  statewideLaneFocus:
    "For this search, look specifically on Reddit (reddit.com) for Arizona homeowner solar questions: \"is solar " +
    "worth it in Arizona\", \"going solar in Phoenix\", \"APS/SRP bill\", \"solar quote\", installer " +
    "recommendations. Check r/phoenix, r/arizona, r/solar, r/SolarDIY (only non-DIY-committed posters), " +
    "r/TeslaSolar, r/electricvehicles and similar. Homeowners comparing quotes or venting about utility bills " +
    "are the highest-value leads — cast wide here.",
  isRelevant: (text) => {
    const t = text.toLowerCase();
    if (!SOLAR_SIGNAL.test(t)) return false;
    if (SOLAR_NOISE.test(t)) return false;
    return true;
  },
  queryMatrix: (territories) => [
    ...territories.slice(0, 3).flatMap((n) => [
      `solar quote "${n}"`,
      `solar installer recommendation "${n}"`,
    ]),
    `site:reddit.com/r/solar Arizona quote`,
    `site:reddit.com/r/solar Phoenix worth it`,
    `site:reddit.com/r/phoenix solar`,
    `site:reddit.com/r/arizona solar panels`,
    `site:reddit.com/r/TeslaSolar Arizona`,
    `"got a quote" solar Arizona`,
    `"is solar worth it" Phoenix`,
    `"APS bill" solar reddit`,
    `"SRP" solar plan question`,
    `"going solar" Arizona advice`,
    `new build solar Phoenix builder offer`,
    `Powerwall Arizona worth it question`,
    `EV charging home solar Phoenix`,
  ],
  redditSubs: "solar+phoenix+arizona+TeslaSolar+SolarDIY+electricvehicles",
  redditTerms: ["quote", "worth it in Arizona", "APS", "SRP", "installer recommendation", "going solar", "powerwall"],
  tagToIntent: {
    "quote-shopping": "quote-shopping",
    "bill-pain": "bill-pain",
    considering: "considering",
    "battery-ev": "battery-ev",
    "new-homeowner": "new-homeowner",
    "recommendation-ask": "referral",
    general: "signal",
  },
  tagRules: [
    { re: /(quote|bid|proposal|per watt|\$\/?w\b|financ|lease|ppa\b)/i, tag: "quote-shopping" },
    { re: /(\baps\b|\bsrp\b|\btep\b|electric bill|power bill|rate plan|on-?peak|bill (is|was|s) (insane|crazy|huge|high))/i, tag: "bill-pain" },
    { re: /(worth it|considering|thinking about|should (i|we) (go|get))/i, tag: "considering" },
    { re: /(battery|powerwall|backup|ev\b|tesla|charger)/i, tag: "battery-ev" },
    { re: /(new (house|home|build)|just (bought|closed)|moving in)/i, tag: "new-homeowner" },
  ],
  tagColors: {
    "quote-shopping": "#41D98A",
    "bill-pain": "#FF5D8F",
    considering: "#FFC23D",
    "battery-ev": "#C9A8FF",
    "new-homeowner": "#7DD3FC",
    "recommendation-ask": "#26E0C8",
    general: "#8B89A0",
  },
};

/* --------------------------------- registry ---------------------------------- */

export const VERTICALS: Record<VerticalId, VerticalDef> = { realtor: REALTOR, solar: SOLAR };

export function verticalOf(id: string | undefined | null): VerticalDef {
  return VERTICALS[(id as VerticalId) || "realtor"] || REALTOR;
}

/** Intent color lookup with a safe fallback, for inbox cards. */
export function intentColor(v: VerticalDef, intent: string | undefined): string {
  return v.intents.find((i) => i.key === intent)?.color || "#8B89A0";
}

/** Rule-based inbox tagging, per vertical. */
export function tagFor(v: VerticalDef, text: string): string[] {
  const tags: string[] = [];
  v.tagRules.forEach((r) => {
    if (r.re.test(text) && !tags.includes(r.tag)) tags.push(r.tag);
  });
  // the shared "asking for a recommendation" shape, gated on vertical relevance
  if (/(recommend|looking for|anyone know|suggestions?)/i.test(text) && v.isRelevant(text) && !tags.includes("recommendation-ask")) {
    tags.push("recommendation-ask");
  }
  return tags.length ? tags : ["general"];
}
