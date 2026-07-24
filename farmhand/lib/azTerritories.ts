/**
 * AZ solar territory catalog — the West Valley + North Phoenix APS
 * new-construction hot spots from the July 2026 territory deep-research
 * (utility boundary maps, builder sites, Zillow/Redfin, ACS census tracts).
 * These are the actual development/master-plan names a consultant works: they
 * double as literal search keywords for hunts and as content labels.
 *
 * The business runs APS-only — SRP (East Valley) and ED3/ED2 (outskirts)
 * economics don't pencil, so those territories were removed from the catalog
 * entirely (July 2026 decision). "verify" remains only as a guard for split
 * streets and custom picks: anything not confirmed APS gets flagged, not
 * quoted.
 */

export type TerritoryUtility = "aps" | "verify";

export interface AzTerritoryDef {
  slug: string;
  name: string; // exact development/community name — used as a search keyword
  city: string;
  utility: TerritoryUtility;
  label: string; // one-line card subtitle: profile + why it works
  tier: 1 | 2 | 3; // 1 = ranked top target, 2 = strong, 3 = situational/referral
  kind?: "city" | "development"; // city = whole-corridor pick; default development
}

export const UTILITY_LABEL: Record<TerritoryUtility, string> = {
  aps: "APS",
  verify: "VERIFY UTILITY",
};

export const UTILITY_COLOR: Record<TerritoryUtility, string> = {
  aps: "#FF9A62",
  verify: "#FFC23D",
};

export const AZ_TERRITORY_CATALOG: AzTerritoryDef[] = [
  // ---- WEST VALLEY cities (APS) — whole-corridor picks; the research's
  // growth engines, NOT the saturated central cities ----
  { slug: "buckeye-city", name: "Buckeye", city: "Buckeye", utility: "aps", tier: 1, kind: "city", label: "One of America's fastest-growing cities — Verrado, Tartesso, Sundance, Tyler Ranch, Copper Falls + Teravalis coming" },
  { slug: "goodyear-city", name: "Goodyear", city: "Goodyear", utility: "aps", tier: 1, kind: "city", label: "Estrella + Canyon Trails + Sedella corridors; pools and big cooling loads (east of the Agua Fria isn't APS — skip those streets)" },
  { slug: "surprise-city", name: "Surprise", city: "Surprise", utility: "aps", tier: 1, kind: "city", label: "Marley Park, Asante, Sterling Grove, North Copper Canyon — huge fresh-roof volume" },
  { slug: "peoria-city", name: "Peoria", city: "Peoria", utility: "aps", tier: 1, kind: "city", label: "Vistancia corridor + 67th/Happy Valley (Aloravita, Mystic) — affluent new construction" },
  { slug: "avondale-city", name: "Avondale", city: "Avondale", utility: "aps", tier: 2, kind: "city", label: "Alamar + Del Rio Ranch; dense affordable new-family roofs (east of the Agua Fria isn't APS — skip those streets)" },
  { slug: "glendale-city", name: "Glendale", city: "Glendale", utility: "aps", tier: 2, kind: "city", label: "Stonehaven + Arrowhead infill — split city: work the APS north side only, verify every address" },

  // ---- APS · West Valley + North Phoenix developments ----
  { slug: "teravalis", name: "Teravalis", city: "Buckeye", utility: "aps", tier: 1, label: "Massive greenfield — Floreo village launched 2025, up to 100k homes planned, almost zero legacy solar" },
  { slug: "estrella", name: "Estrella", city: "Goodyear", utility: "aps", tier: 1, label: "High-usage family master plan, pools + fresh Montecito/Lucero releases, ~$105k incomes" },
  { slug: "aloravita", name: "Aloravita", city: "Peoria", utility: "aps", tier: 1, label: "Affluent new construction at 67th & Happy Valley, large roofs, ~$115k incomes, low saturation" },
  { slug: "mystic", name: "Mystic", city: "Peoria", utility: "aps", tier: 1, label: "Fast-growing premium corridor, 5 active builders, blank rooftops, ~$125k incomes" },
  { slug: "northpointe-vistancia", name: "Northpointe at Vistancia", city: "Peoria", utility: "aps", tier: 1, label: "Premium Vistancia phase still building — pools, batteries, ~$125k incomes" },
  { slug: "verrado", name: "Verrado", city: "Buckeye", utility: "aps", tier: 1, label: "Affluent move-up families, ~$115k incomes — mature enough for referrals, still building" },
  { slug: "sterling-grove", name: "Sterling Grove", city: "Surprise", utility: "aps", tier: 1, label: "Toll Brothers golf + luxury, pools and big cooling loads, premium battery economics" },
  { slug: "north-copper-canyon", name: "North Copper Canyon", city: "Surprise", utility: "aps", tier: 1, label: "Major greenfield family opportunity near Loop 303, low saturation" },
  { slug: "tartesso", name: "Tartesso", city: "Buckeye", utility: "aps", tier: 1, label: "Young families ~$88k income, big unshaded roofs, long commutes = high usage" },
  { slug: "asante", name: "Asante", city: "Surprise", utility: "aps", tier: 2, label: "Broad family market with fresh inventory — Next Gen + 55+ segments in one place" },
  { slug: "canyon-trails", name: "Canyon Trails", city: "Goodyear", utility: "aps", tier: 2, label: "Established family rooftops, affordable retrofit economics, referral base" },
  { slug: "marley-park", name: "Marley Park", city: "Surprise", utility: "aps", tier: 2, label: "Dense walkable family neighborhood — efficient canvassing + referrals" },
  { slug: "copper-falls", name: "Copper Falls", city: "Buckeye", utility: "aps", tier: 2, label: "Brand-new affordable roofs (2023+), almost no legacy solar" },
  { slug: "tyler-ranch", name: "Tyler Ranch", city: "Buckeye", utility: "aps", tier: 2, label: "Mattamy first-wave homeowners (2025+) making their first energy decision" },
  { slug: "norterra", name: "Norterra", city: "Phoenix", utility: "aps", tier: 2, label: "TSMC-adjacent professionals — EVs, high cooling load, ~$125k incomes" },
  { slug: "sundance-buckeye", name: "Sundance", city: "Buckeye", utility: "aps", tier: 2, label: "Affordable greenfield roofs, low solar saturation" },
  { slug: "alamar", name: "Alamar", city: "Avondale", utility: "aps", tier: 2, label: "Dense new-family territory (2020+), easy neighborhood canvassing" },
  { slug: "rancho-mercado", name: "Rancho Mercado", city: "Surprise", utility: "aps", tier: 3, label: "Affordable new construction with a clear bill-savings story" },
  { slug: "pebblecreek", name: "PebbleCreek", city: "Goodyear", utility: "aps", tier: 3, label: "Affluent 55+ (median age ~70) — backup power + referrals, solar already familiar" },
  { slug: "trilogy-vistancia", name: "Trilogy at Vistancia", city: "Peoria", utility: "aps", tier: 3, label: "Affluent active-adult — comfort, backup and pool priorities" },
  { slug: "cantamia", name: "CantaMia", city: "Goodyear", utility: "aps", tier: 3, label: "Estrella's 55+ village — battery/backup pitch over export math" },
  { slug: "blackstone-vistancia", name: "Blackstone at Vistancia", city: "Peoria", utility: "aps", tier: 3, label: "Luxury/custom, ~$160k incomes — big tickets and referral households" },
];

/**
 * Best-effort utility inference for territories that predate the catalog
 * (custom picks, older saved profiles). City-level heuristic from the
 * verified boundary map; split cities return the dominant side. Anything in
 * SRP/ED3/ED2 country resolves to "verify" — those areas are out of market
 * and must never get APS rate math.
 */
export function utilityForTerritory(t: { slug?: string; name?: string; city?: string; utility?: string }): TerritoryUtility {
  if (t.utility === "aps" || t.utility === "verify") return t.utility;
  const cat = AZ_TERRITORY_CATALOG.find((c) => c.slug === t.slug || c.name.toLowerCase() === (t.name || "").toLowerCase());
  if (cat) return cat.utility;
  const c = `${t.city || ""} ${t.name || ""}`.toLowerCase();
  if (/(peoria|surprise|buckeye|goodyear|litchfield|el mirage|waddell|tolleson|wickenburg|sun city|youngtown|paradise valley|avondale)/.test(c)) return "aps";
  if (/(phoenix|scottsdale|glendale)/.test(c)) return "aps"; // split cities — dominant side; verify by address
  return "verify";
}

/**
 * Out-of-market check for saved/custom territories: explicit SRP/ED3/ED2 tags
 * or East Valley / outskirts geography. Used by the store migration to strip
 * these from persisted profiles — the business doesn't serve them.
 */
export function isOutOfMarket(t: { slug?: string; name?: string; city?: string; utility?: string }): boolean {
  if (t.utility === "srp" || t.utility === "ed3" || t.utility === "ed2") return true;
  const c = `${t.city || ""} ${t.name || ""}`.toLowerCase();
  if (/(mesa|gilbert|chandler|tempe|queen creek|san tan|ahwatukee|apache junction|florence|coolidge|eloy|laveen)/.test(c)) return true;
  if (/maricopa/.test(c) && !/maricopa county/.test(c)) return true;
  return false;
}

/** Palette for newly selected territories, cycled by index. */
export const TERRITORY_HEXES = ["#FF9A62", "#26E0C8", "#C9A8FF", "#7DD3FC", "#41D98A", "#FFC23D", "#FF5D8F", "#38BDF8"];
