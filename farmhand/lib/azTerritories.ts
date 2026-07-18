/**
 * AZ solar territory catalog — metro Phoenix new-construction hot spots mapped
 * by electric utility, from the July 2026 territory deep-research (utility
 * boundary maps, builder sites, Zillow/Redfin, ACS census tracts). These are
 * the actual development/master-plan names a consultant works: they double as
 * literal search keywords for hunts and as content labels.
 *
 * Utility matters commercially: APS pitches export-rate lock + TOU, SRP
 * pitches demand-management + batteries, ED3/ED2 have their own tariffs and
 * must never be quoted APS/SRP numbers.
 */

export type TerritoryUtility = "aps" | "srp" | "ed3" | "ed2" | "verify";

export interface AzTerritoryDef {
  slug: string;
  name: string; // exact development/community name — used as a search keyword
  city: string;
  utility: TerritoryUtility;
  label: string; // one-line card subtitle: profile + why it works
  tier: 1 | 2 | 3; // 1 = ranked top target, 2 = strong, 3 = situational/referral
}

export const UTILITY_LABEL: Record<TerritoryUtility, string> = {
  aps: "APS",
  srp: "SRP",
  ed3: "ED3",
  ed2: "ED2",
  verify: "VERIFY UTILITY",
};

export const UTILITY_COLOR: Record<TerritoryUtility, string> = {
  aps: "#FF9A62",
  srp: "#26E0C8",
  ed3: "#C9A8FF",
  ed2: "#C9A8FF",
  verify: "#FFC23D",
};

export const AZ_TERRITORY_CATALOG: AzTerritoryDef[] = [
  // ---- APS · West Valley + North Phoenix ----
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

  // ---- SRP · East Valley ----
  { slug: "hawes-crossing", name: "Hawes Crossing", city: "Mesa", utility: "srp", tier: 1, label: "The best fresh-roof SRP territory — major 2025 launch, 4 builders, near-zero saturation" },
  { slug: "barney-farms", name: "Barney Farms", city: "Queen Creek", utility: "srp", tier: 1, label: "Fulton lake community, ~$140k incomes, large homes + pools, low saturation" },
  { slug: "harvest-qc", name: "Harvest", city: "Queen Creek", utility: "srp", tier: 1, label: "Affluent amenity-rich families, ~$135k incomes, high discretionary usage" },
  { slug: "madera-qc", name: "Madera", city: "Queen Creek", utility: "srp", tier: 1, label: "Premium new construction, strong financing capacity for battery systems" },
  { slug: "bella-vista-farms", name: "Bella Vista Farms", city: "San Tan Valley", utility: "srp", tier: 1, label: "One of the largest unsaturated family territories in Pinal County" },
  { slug: "wales-ranch", name: "Wales Ranch", city: "Queen Creek", utility: "srp", tier: 1, label: "High-income 2024+ construction — capture before competitors do" },
  { slug: "waterston", name: "Waterston", city: "Gilbert", utility: "srp", tier: 1, label: "Tri Pointe's multi-collection plan — entry to premium bands, steady fresh roofs" },
  { slug: "eastmark", name: "Eastmark", city: "Mesa", utility: "srp", tier: 2, label: "Mature high-income community — referrals outperform cold starts here" },
  { slug: "cadence-gateway", name: "Cadence at Gateway", city: "Mesa", utility: "srp", tier: 2, label: "Dense newer roofs, referral-ready homeowner base" },
  { slug: "morrison-ranch", name: "Morrison Ranch", city: "Gilbert", utility: "srp", tier: 2, label: "Premium established homes, high bills, strong referrals" },
  { slug: "soleo", name: "Soleo", city: "San Tan Valley", utility: "srp", tier: 2, label: "1,400+ homes under way — concentrated early-adopter opportunity" },
  { slug: "encanterra", name: "Encanterra", city: "San Tan Valley", utility: "srp", tier: 2, label: "Active-adult resort — battery, comfort and referral fit" },
  { slug: "viviendo", name: "Viviendo", city: "Chandler", utility: "srp", tier: 3, label: "Luxury boutique ($713k–$1.4M) — whole-home backup sells here" },
  { slug: "vistara", name: "Vistara", city: "Chandler", utility: "srp", tier: 3, label: "Small luxury territory, high ticket sizes and referral value" },
  { slug: "san-tan-heights", name: "San Tan Heights", city: "San Tan Valley", utility: "srp", tier: 3, label: "Active family territory with affordable entry points" },
  { slug: "laveen", name: "Laveen", city: "Phoenix", utility: "srp", tier: 3, label: "South Phoenix growth corridor — Estrella Vista, Tres Rios, affordable new roofs" },

  // ---- Other utilities — different tariffs, never quote APS/SRP numbers ----
  { slug: "rancho-el-dorado", name: "Rancho El Dorado", city: "Maricopa", utility: "ed3", tier: 3, label: "Big roofs + high usage, but ED3's own export rules — sell self-consumption + storage" },
  { slug: "tortosa", name: "Tortosa", city: "Maricopa", utility: "ed3", tier: 3, label: "Young-family roofs where batteries matter more than export promises" },
  { slug: "anthem-merrill-ranch", name: "Anthem at Merrill Ranch", city: "Florence", utility: "ed2", tier: 3, label: "Large affordable roofs — verify ED2 export economics before quoting" },
];

/**
 * Best-effort utility inference for territories that predate the catalog
 * (e.g., the plain Phoenix/Scottsdale/Mesa defaults). City-level heuristic
 * from the verified boundary map; split cities return the dominant side.
 */
export function utilityForTerritory(t: { slug?: string; name?: string; city?: string; utility?: string }): TerritoryUtility {
  if (t.utility && ["aps", "srp", "ed3", "ed2", "verify"].includes(t.utility)) return t.utility as TerritoryUtility;
  const cat = AZ_TERRITORY_CATALOG.find((c) => c.slug === t.slug || c.name.toLowerCase() === (t.name || "").toLowerCase());
  if (cat) return cat.utility;
  const c = `${t.city || ""} ${t.name || ""}`.toLowerCase();
  if (/(mesa|gilbert|chandler|tempe|queen creek|san tan|ahwatukee|apache junction)/.test(c)) return "srp";
  if (/maricopa/.test(c) && !/maricopa county/.test(c)) return "ed3";
  if (/(florence|coolidge|eloy)/.test(c)) return "ed2";
  if (/(peoria|surprise|buckeye|goodyear|litchfield|el mirage|waddell|tolleson|wickenburg|sun city|youngtown|paradise valley|avondale)/.test(c)) return "aps";
  if (/(phoenix|scottsdale|glendale)/.test(c)) return "aps"; // split cities — dominant side; verify by address
  return "verify";
}

/** Palette for newly selected territories, cycled by index. */
export const TERRITORY_HEXES = ["#FF9A62", "#26E0C8", "#C9A8FF", "#7DD3FC", "#41D98A", "#FFC23D", "#FF5D8F", "#38BDF8"];
