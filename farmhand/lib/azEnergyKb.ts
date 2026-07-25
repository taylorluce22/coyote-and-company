/**
 * Arizona energy knowledge base — curated from a July 2026 deep-research pass
 * over primary sources (APS tariff PDFs, ACC dockets, IRS FS-2025-05, EIA).
 * This is what makes solar replies and content sound like a 15-year Valley
 * expert instead of a generic solar page.
 *
 * APS-only: the business runs West Valley APS territories exclusively — SRP
 * and other-utility knowledge was removed (July 2026 decision, "doesn't
 * pencil"). A thread that's clearly about another utility resolves to
 * "unknown" and gets generic AZ framing, never APS numbers.
 *
 * Numbers current as of mid-July 2026. Anything pending or legally unsettled
 * is phrased with that uncertainty built in — replies must never overstate.
 * Full condensed reference: farmhand/docs/az-energy-knowledge-2026.md
 */

export type AzUtility = "aps" | "unknown";

/** Detect whether a pasted thread is talking about APS. */
export function azUtilityIn(text: string): AzUtility {
  const t = text.toLowerCase();
  const aps = /\baps\b|arizona public service/.test(t);
  const other = /\bsrp\b|salt river project|\bed3\b|\bed2\b|electrical district/.test(t);
  if (aps && !other) return "aps";
  return "unknown";
}

/**
 * Reply-ready knowledge, keyed by opportunity tag + utility. One conversational
 * sentence or two, written to be woven into a neighborly reply — precise
 * numbers, zero jargon-dumping, honest about what's pending.
 */
export const KB = {
  rates: {
    aps: "on APS the summer on-peak window (4–7pm weekdays) runs about 34¢/kWh vs ~12¢ off-peak — that 3x spread is usually where the bill damage is",
    unknown: "Arizona utilities price summer evenings brutally — on APS the on-peak window runs ~34¢/kWh vs ~12¢ off — so WHEN you use power matters more than how much",
  },
  ratePlanCheck: {
    aps: "APS has three main plans (flat, time-of-use, and a demand plan) and picking the wrong one for your usage pattern can cost real money before solar even enters the picture — the switch is free",
    unknown: "checking you're on the right rate plan is free and sometimes fixes a chunk of the bill before solar even enters the picture",
  },
  export: {
    aps: "APS pays about 6.2¢/kWh for exported solar right now, locked for 10 years from interconnection — but that rate has stepped down ~10% every September since 2017 (it started at 12.9¢), so waiting literally costs export value",
    unknown: "true net metering is gone in Arizona — APS credits exports ~6.2¢/kWh (locked 10 years) — so system sizing should be about covering your own usage, not selling power back",
  },
  tax: {
    any: "the 30% federal credit is gone for homeowner purchases — anything not fully installed by Dec 31, 2025 gets $0 federal, no matter when it was paid for. Arizona still has its own $1,000 credit plus sales-tax and property-tax exemptions, and leases/PPAs price differently because the leasing company can still claim a commercial credit",
  },
  battery: {
    aps: "on APS a battery earns its keep on the on-peak/off-peak spread (~22¢/kWh of arbitrage) plus their Storage Rewards program pays about $110 per average kW your battery delivers over the summer — a typical unit earns $300–660/season",
    unknown: "batteries in AZ now earn two ways: avoiding the evening peak rates, and utility VPP programs — APS Storage Rewards pays roughly $110 per average kW each summer for sharing capacity during grid events",
  },
  gridDemand: {
    any: "Arizona's grid demand keeps breaking records (APS hit 8,631 MW last August) and APS reports 4.5 GW of committed new load plus roughly 20 GW more of data-center requests in its queue — its own plan projects peak demand growing ~40% by 2031, which is the backdrop for every rate case",
  },
  rateCase: {
    any: "APS is asking for about 14% more (13.99% net revenue) — roughly $20 a month more for a typical home — with new rates expected in the second half of 2026, and this isn't a one-off: APS already raised rates about 8% in 2024 and is already back asking for more",
  },
  trust: {
    any: "the solar industry has a trust problem worth naming out loud: roughly 100 U.S. solar companies have gone bankrupt since 2023 (Titan, SunPower, Sunnova, Freedom Forever among them) and homeowner distrust doubled in a single year — which is exactly why every quote deserves a slow, skeptical read",
  },
  installerQuality: {
    any: "price per watt is one input, not the verdict — federal regulators (CFPB) have found dealer fees can inflate a financed loan's principal by 30% or more above the cash price, often hidden inside the payment rather than the rate. The real markers: how the roof penetrations are flashed, an active R-11/CR-11 license with a clean ROC complaint record (free to look up), a spot on APS's Qualified Technology Installer list, one accountable company from sales to service, and 10+ year workmanship coverage. The few AZ installers doing truly high-quality work usually cost a bit more — usually far less than what a dealer-fee loan quietly adds",
  },
  leaseShift: {
    any: "about 7 in 10 new solar deals in 2026 are leases/PPAs — not because leases got better, but because the homeowner purchase credit expired and leasing companies can still claim a commercial credit through 2027–28. It can genuinely fit, but read the escalator: 0.99–2.99% a year for 20–25 years",
  },
  honestPayback: {
    any: "the honest 2026 math: without the federal credit a purchased system pays back slower than the ads claim (think 10+ years, not 7), so it pencils best with a bill over ~$150, good sun, a roof with life left, and a plan to stay put — and for some homes the answer is genuinely 'not yet'",
  },
} as const;

/**
 * Fact-driven solar content ideas — each carries a real, citable number from
 * the KB so posts read like local expertise, not recycled national content.
 * Merged into the solar idea bank in strategy.ts. {n} = territory name.
 *
 * `deck` = the post's actual slides, written to DELIVER what the title
 * promises (a title that promises 3 questions gets exactly 3 questions).
 * Each line is one short, self-contained point — never a wall of text.
 */
export interface KbContentSeed {
  title: string;
  angle: string;
  format: "carousel" | "reel" | "story" | "text";
  theme: string;
  deck?: string[];
  /* content-engine metadata (July 2026 overhaul) — see lib/dgCompile.ts */
  pillar?: "P1" | "P2" | "P3" | "P4" | "P5";
  objective?: "reach" | "save" | "share" | "dm" | "comment";
  shape?: "hero-number" | "trend" | "myth-bust" | "listicle" | "news-react" | "timeline";
  takeaway?: string;
  hook?: { headline: string; kicker: string; hotWord?: string };
  source?: string;
  perishable?: boolean;
}

export const SOLAR_KB_CONTENT: KbContentSeed[] = [
  {
    title: "Why your July APS bill spikes: the 4–7pm window nobody explains",
    angle: "APS on-peak runs ~34¢/kWh vs ~12¢ off — decode it with a real bill and the free fixes first",
    format: "carousel",
    theme: "bill-breakdown",
    hook: { headline: "34¢ vs 12¢. Three hours do the damage.", kicker: "The APS window that builds your July bill — and the free fixes first.", hotWord: "34¢" },
    takeaway: "The window is the bill. Own the window.",
    source: "APS TOU-E schedule",
    objective: "save",
    deck: [
      "APS charges about 34¢/kWh from 4–7pm on summer weekdays. Off-peak runs closer to 12¢ — a 3x spread.",
      "Most of the July damage is that window: AC, oven and pool pump all stacked into the most expensive hours.",
      "Free fixes first: pre-cool before 4, pool pump overnight, laundry after 7. Then we talk hardware.",
    ],
  },
  {
    title: "APS pays 6.2¢ for your solar — and it drops again in September",
    angle: "the export rate has stepped down ~10% every year since 2017 (from 12.9¢); waiting has a literal price",
    format: "text",
    theme: "authority",
    hook: { headline: "September 1: your export rate drops again.", kicker: "It's fallen ~10% a year since 2017. The lock happens at interconnection.", hotWord: "September 1" },
    takeaway: "Waiting has a price. It prints every September.",
    source: "APS Rate Rider RCP schedules",
    shape: "trend",
    objective: "share",
    deck: [
      "APS credits exported solar at about 6.2¢/kWh, locked for 10 years from your interconnection date.",
      "That rate started at 12.9¢ in 2017 and has stepped down roughly 10% every September since.",
      "The lock happens at interconnection — not at signing. Timeline matters more than any discount.",
    ],
  },
  {
    title: "The 30% federal solar credit is gone. Here's the honest 2026 math",
    angle: "objection-handling with real numbers: AZ's $1,000 credit + tax exemptions remain, leases price differently — and sometimes the answer is 'not yet'",
    format: "carousel",
    theme: "objection-handling",
    hook: { headline: "Still being pitched the 30% credit? It's dead.", kicker: "What's actually still true in 2026 — and when the honest answer is 'not yet'.", hotWord: "30%" },
    takeaway: "Run 2026 math, not 2024's.",
    source: "IRS FS-2025-05 · AZ DOR",
    shape: "myth-bust",
    objective: "share",
    deck: [
      "Anything not fully installed by Dec 31, 2025 gets $0 federal — no matter when it was paid for.",
      "Arizona still stacks its own $1,000 credit plus sales-tax and property-tax exemptions.",
      "Real payback now runs 10+ years, not the 7 in the ads. For some homes the honest answer is 'not yet'.",
    ],
  },
  {
    title: "Your battery can earn ~$660 a summer from APS now",
    angle: "Storage Rewards pays $110/avg kW per season — the VPP era is here",
    format: "text",
    theme: "battery-ev",
    hook: { headline: "APS will pay to use your battery.", kicker: "About $660 a summer. Stop and ask why they want it.", hotWord: "pay" },
    takeaway: "Get on the paid side of the evening peak.",
    source: "APS Storage Rewards program",
    objective: "save",
    deck: [
      "APS Storage Rewards pays about $110 per average kW your battery delivers over the summer.",
      "A typical home battery earns $300–660 a season just for sharing capacity during grid events.",
      "That stacks on the ~22¢ on-peak/off-peak spread the same battery is already arbitraging every evening.",
    ],
  },
  {
    title: "20 gigawatts of data centers want onto Arizona's grid",
    angle: "APS's own filings — what it means (and honestly doesn't mean) for {n} bills over the next decade; present the cost question as genuinely unresolved",
    format: "carousel",
    theme: "authority",
    deck: [
      "APS reports 4.5 GW of committed new load beyond its 8.6 GW record peak — plus roughly 20 GW more of data-center requests waiting in its queue.",
      "The rate case even proposes a special data-center class paying +47%, so 'growth pays for growth.' Whether that holds is the fight.",
      "Honest answer: experts genuinely disagree on whether data centers raise or lower home bills. What's certain is the grid is being rebuilt around them.",
    ],
  },
  {
    title: "113 days over 100° and zero major outages — so why get a battery?",
    angle: "honest take: AZ's grid is reliable; backup is about the ONE bad afternoon at 115°, not frequent blackouts",
    format: "text",
    theme: "myth-busting",
    deck: [
      "Honest take: Arizona's grid is genuinely reliable. Backup is not about frequent blackouts.",
      "It's about the ONE bad afternoon at 115° — and what your evening kWh costs every normal day.",
      "Batteries here earn daily: peak-rate avoidance, demand shaving, and VPP programs paying ~$110/kW a year.",
    ],
  },
  {
    title: "Buying or selling a {n} home with solar? The APS terms follow the house.",
    angle: "APS legacy net metering and export-rate locks transfer to the next owner — a real, underpriced selling point",
    format: "carousel",
    theme: "new-homeowner",
    deck: [
      "On APS, legacy net metering and export-rate locks follow the house to the next owner.",
      "A 2018 install still earning its locked export rate is genuinely worth more than the same panels hooked up today.",
      "Buyers: ask for the interconnection date and rate rider BEFORE you price that 'free solar' into your offer.",
    ],
  },
  {
    title: "APS wants ~14% more — and it won't be the last",
    angle: "new rates expected 2H 2026; frame the repeated increases (~8% in 2024, ~14% now) as a one-way climb no plan escapes — the hedge is owning your production",
    format: "text",
    theme: "authority",
    deck: [
      "APS wants about 14% more — roughly $20 a month for a typical home — with new rates expected in the second half of 2026.",
      "This isn't a one-off: APS already raised rates about 8% in 2024, and it's back for more. The asks keep coming.",
      "No rate plan opts you out of the climb — every plan rides the same rising baseline. The real hedge is producing more of your own power.",
    ],
  },
  {
    title: "Your Arizona power bill isn't going back down",
    angle: "the rising-cost throughline — bills up ~33% in a decade, faster lately; no rate plan opts you out; the hedge is owning your production",
    format: "carousel",
    theme: "authority",
    deck: [
      "Arizona's average power bill climbed about 33% in the last decade — roughly $120 a month in 2014 to $160 in 2024 (EIA).",
      "And it's speeding up: on the last five years' pace, a typical bill doubles in about 15 years. APS already did ~8% in 2024 and wants ~14% more for 2026.",
      "No rate plan opts you out of that climb — every plan rides the same rising baseline. The only real way off the escalator is producing your own power.",
    ],
  },
  {
    title: "100 solar companies have gone bankrupt since 2023. Vet yours.",
    angle: "the trust crisis is the credibility opening — calm, documented, homeowner-protective",
    format: "carousel",
    theme: "buyer-education",
    hook: { headline: "100 solar companies went bankrupt since 2023.", kicker: "SunPower, Titan, Sunnova among them. Who services your roof in year 12?", hotWord: "100" },
    takeaway: "Vet the company harder than the panel.",
    source: "AZ solar market · 2023–26",
    objective: "share",
    deck: [
      "Titan, SunPower, Sunnova, Freedom Forever — some of the biggest names in solar have all filed for bankruptcy since 2023. Warranties don't service themselves.",
      "Arizona's AG has real enforcement wins too: $600k restitution from Sunrun/Vivint, $13.8M against Vision Solar for faking utility affiliation.",
      "Before you compare prices, ask: who services this system in year 12 if the installer disappears? Good companies have a real answer. Insist on it.",
    ],
  },
  {
    title: "Why every solar quote is suddenly a lease",
    angle: "the tax-code truth behind the TPO wave — honest explanation beats conspiracy, and it defuses 'why is everyone pushing leases'",
    format: "carousel",
    theme: "objection-handling",
    deck: [
      "The homeowner purchase credit died Dec 31, 2025. Leasing companies can still claim a commercial credit through 2027–28.",
      "That's why about 7 in 10 new solar deals in 2026 are leases or PPAs. It's a tax-code shift — not automatically a trick.",
      "But read the escalator: 0.99–2.99% a year, for 20–25 years. Price the 25-year total, never the first month.",
    ],
  },
  {
    title: "The 60-second background check for any solar installer",
    angle: "the free, verifiable vetting path — ROC lookup + utility lists; homeowner-protective, zero pitch",
    format: "carousel",
    theme: "buyer-education",
    deck: [
      "Arizona solar requires an R-11 or CR-11 license. The ROC website shows status, discipline, and complaints — free.",
      "Years licensed + a clean complaint record is the signal. Repeated roof-leak complaints are the red flag.",
      "Then check APS's Qualified Technology Installer list — it requires good standing and real training to stay on.",
    ],
  },
  {
    title: "What happens to your warranty if your installer disappears",
    angle: "post-bankruptcy reality — Arizona minimums, what survives, what dies with the company",
    format: "carousel",
    theme: "objection-handling",
    deck: [
      "Arizona's legal minimum: 2 years on the solar device and its install, 1 year on the rest. Quality installers go 10+ on workmanship.",
      "Panel and inverter warranties usually survive an installer bankruptcy. Workmanship and roof warranties usually die with the company.",
      "Ask: is there manufacturer-backed or escrowed coverage if you're gone in year 8? Real companies have a real answer.",
    ],
  },
  {
    title: "Tile roofs and solar: how the good crews do it",
    angle: "the Phoenix-specific craft education nobody posts — flashing as a tested system, not goop on a hole",
    format: "carousel",
    theme: "buyer-education",
    deck: [
      "Good crews remove tiles, mount standoffs into structure, and three-course the underlayment: cement, fabric, cement.",
      "Then the tiles get cut to fit around the standoff — never drilled through and smeared with sealant.",
      "That's a sealed system versus a leak on a timer. Ask exactly how YOUR roof gets flashed.",
    ],
  },
  {
    title: "Advisor or salesperson? The 6-question test",
    angle: "homeowner-protective litmus test — the flagship consultant-not-salesperson content anchor",
    format: "carousel",
    theme: "buyer-education",
    deck: [
      "1. Is their pay tied to system size? 2. Will they show you competing bids? 3. Will they walk you through the actual contract language?",
      "4. Do they model YOUR usage — not a national average? 5. Is their contact info transparent? 6. Will they ever say 'solar isn't worth it for your home'?",
      "Six yeses means you found an advisor. Anything less — keep your signature in your pocket.",
    ],
  },
  {
    title: "The federal regulator's warning about 'cheap' solar financing",
    angle: "CFPB-sourced: dealer fees can inflate financed principal 30%+ above cash price — the low-monthly-payment trap explained plainly",
    format: "reel",
    theme: "buyer-education",
    deck: [
      "The CFPB has flagged this directly: some solar loans hide a dealer fee that can add 30% or more to the loan principal.",
      "It's rolled into the payment, not the rate — so the APR you're shown doesn't reveal it.",
      "Ask for the cash price first. Then ask what the financed price adds on top.",
    ],
  },

  /* ---- July 2026 ingest: the brain Idea Bank clusters that never made it
     into the app (data centers & grid, rate design, battery/VPP, bill
     literacy, rate-case news lane). Numbers trace to
     az-rising-costs-heat-datacenters-2026.md / az-rates-supply-demand-2026.md.
     The vacated Grid Access Charge is deliberately absent. ---- */
  {
    title: "Your bill doubles in about 15 years",
    angle: "the doubling clock — on the last five years' pace a typical AZ bill doubles in ~15 years; even the slow decade pace doubles it in ~24",
    format: "carousel",
    theme: "authority",
    pillar: "P1",
    objective: "save",
    shape: "hero-number",
    hook: { headline: "A typical AZ bill doubles in ~15 years.", kicker: "That's the recent pace. The slow pace still doubles it — just later.", hotWord: "~15 years" },
    takeaway: "The trajectory is the argument, not this month's bill.",
    source: "EIA · 2026 [projection]",
    deck: [
      "On the last five years' pace, a typical Arizona bill doubles in about 15 years. On the slower decade pace, about 24.",
      "Both horizons point one direction — and APS already took ~8% in 2024 and is asking ~14% more for 2026.",
      "There's no plan-shuffle that beats a doubling baseline. Producing your own power is the only structural answer.",
    ],
  },
  {
    title: "No rate plan opts you out",
    angle: "the thesis post — every APS plan rides the same rising baseline; switching shapes the increase, it doesn't refuse it",
    format: "carousel",
    theme: "authority",
    pillar: "P1",
    objective: "share",
    shape: "myth-bust",
    hook: { headline: "There is no rate plan that opts you out.", kicker: "Every plan rides the same rising baseline. Here's what switching actually does.", hotWord: "no rate plan" },
    takeaway: "Plan literacy explains the peak. Ownership is the hedge.",
    source: "APS tariff filings · 2026",
    deck: [
      "Switching plans reshapes WHERE the increase hits you — it never refuses the increase itself.",
      "The baseline all plans ride climbed ~33% in a decade, and the asks keep coming.",
      "Use plan literacy to understand the 4–7pm peak. Use ownership to actually exit the escalator.",
    ],
  },
  {
    title: "Phoenix has a hungry new neighbor",
    angle: "metro Phoenix is #2 in North America for proposed data centers; a single one can use the power of ~64,000 homes, 24/7",
    format: "carousel",
    theme: "authority",
    pillar: "P3",
    objective: "reach",
    shape: "hero-number",
    hook: { headline: "One building. 64,000 homes' worth of power.", kicker: "Phoenix is #2 in North America for new data centers. Same grid as your house.", hotWord: "64,000" },
    takeaway: "You share a grid with the boom. Plan like it.",
    source: "APS filings · 2026",
    deck: [
      "Metro Phoenix ranks second in North America for proposed data-center development.",
      "A single data center can use as much electricity as about 64,000 homes — running 24/7.",
      "Whether that raises or lowers home bills is genuinely disputed. That it reshapes your grid is not.",
    ],
  },
  {
    title: "Their waste heat is on your street",
    angle: "ASU 2026: data-center waste heat can raise downwind neighborhood temps up to 4°F — hotter evenings, harder-working AC, pricier hours",
    format: "text",
    theme: "authority",
    pillar: "P3",
    objective: "share",
    shape: "hero-number",
    hook: { headline: "Data-center exhaust can warm your street 4°.", kicker: "An ASU study measured it downwind. Your AC pays the difference at peak rates.", hotWord: "4°" },
    takeaway: "Their exhaust lands on your evening bill.",
    source: "ASU News · May 2026",
    deck: [
      "A 2026 ASU study found data-center waste heat can raise downwind neighborhood air temps by up to 4°F.",
      "Hotter evening air means your AC works hardest exactly when power costs the most.",
      "It's one more way the boom and your bill share a thermostat — worth watching, worth asking about.",
    ],
  },
  {
    title: "Who pays for the data-center boom?",
    angle: "the rate case proposes a +47% data-center class — 'growth pays for growth' — while the state's ratepayer office says it can't confirm residential bills are protected. Present as a live dispute, never settled",
    format: "carousel",
    theme: "authority",
    pillar: "P3",
    objective: "share",
    shape: "news-react",
    perishable: true,
    hook: { headline: "“Growth pays for growth.” Does it?", kicker: "The +47% data-center class is the promise. The state's own watchdog isn't sure.", hotWord: "+47%" },
    takeaway: "The promise is on record. So is the doubt.",
    source: "ACC / RUCO · Jul 2026",
    deck: [
      "APS proposes a special data-center class paying about +47% — the 'growth pays for growth' promise.",
      "RUCO, the state's ratepayer office, says it still can't confirm large-load costs stay off residential bills.",
      "Nobody knows how this lands. What's settled is the direction of every other line on the bill.",
    ],
  },
  {
    title: "If the grid were stable, why rent your battery?",
    angle: "VPP pay as evidence of evening strain — never call the grid unstable (reserves are fine); the point is what utilities now pay for evening capacity",
    format: "carousel",
    theme: "battery-ev",
    pillar: "P3",
    objective: "share",
    shape: "myth-bust",
    hook: { headline: "Why is APS renting home batteries?", kicker: "About $110 per kW, every summer. Utilities don't rent what they don't need.", hotWord: "renting" },
    takeaway: "VPP pay is the tell. Evening capacity is money.",
    source: "APS Storage Rewards · 2026",
    deck: [
      "APS Storage Rewards pays roughly $110 per average kW your battery shares on summer evenings.",
      "That's not charity — evening flexibility is now worth real money to the utility.",
      "A battery puts you on the paid side of that equation instead of the billed side.",
    ],
  },
  {
    title: "How a battery beats the 4–7pm window",
    angle: "the mechanism post: charge on cheap midday sun, discharge through the expensive evening — the ~22¢ spread does the math",
    format: "carousel",
    theme: "battery-ev",
    pillar: "P2",
    objective: "save",
    shape: "listicle",
    hook: { headline: "Charge at noon. Spend it at 5pm.", kicker: "The ~22¢ spread between APS on-peak and off-peak is the whole mechanism.", hotWord: "22¢" },
    takeaway: "Bank the cheap hours. Skip the expensive ones.",
    source: "APS TOU-E schedule",
    deck: [
      "1. Midday: panels overproduce and power is cheap — the battery banks it instead of exporting at ~6.2¢.",
      "2. 4–7pm: the house runs off the battery while grid power costs ~34¢/kWh.",
      "3. The ~22¢ spread, captured every single evening, is what pays for the hardware.",
    ],
  },
  {
    title: "What to run off-peak (and what not to bother with)",
    angle: "the appliance-timing cheat sheet — pre-cool, pool pump, laundry; and the loads that don't matter enough to schedule",
    format: "carousel",
    theme: "bill-breakdown",
    pillar: "P2",
    objective: "save",
    shape: "listicle",
    hook: { headline: "Three loads build your summer bill.", kicker: "Move them out of the 4–7pm window and the bill follows. Here's the cheat sheet.", hotWord: "Three" },
    takeaway: "Timing is free. Start there, then talk hardware.",
    source: "APS TOU-E · DOE usage data",
    deck: [
      "1. Cooling — pre-cool to 72° before 4pm, coast through the window at 78–80°.",
      "2. Pool pump — overnight, every night. It never needed to run at 5pm.",
      "3. Laundry, dishwasher, EV charging — after 7. The fridge and the lights? Not worth scheduling.",
    ],
  },
  {
    title: "What actually makes up your summer bill",
    angle: "cooling is about half of an AZ summer bill — and most of it lands inside the priciest three hours; the overlap is the whole game",
    format: "carousel",
    theme: "bill-breakdown",
    pillar: "P2",
    objective: "save",
    shape: "hero-number",
    hook: { headline: "Half your summer bill is one appliance.", kicker: "And it runs hardest inside the three most expensive hours. That overlap is the game.", hotWord: "Half" },
    takeaway: "Half the bill is cooling. Timing is the lever.",
    source: "DOE / EIA residential energy use",
    deck: [
      "Cooling is roughly half of a typical Arizona summer bill — no other load is close.",
      "It peaks in the late afternoon, exactly when APS pricing peaks. The overlap is the bill.",
      "Solar + a battery attack the overlap directly: produce through the heat, discharge through the peak.",
    ],
  },
  {
    title: "The APS rate case, on a calendar",
    angle: "the timeline post — hearing closed in July, judge's recommendation ~November, ACC vote due Dec 31, new rates early 2027. 'You are here'",
    format: "carousel",
    theme: "authority",
    pillar: "P1",
    objective: "reach",
    shape: "timeline",
    perishable: true,
    hook: { headline: "New rates are coming. Here's the calendar.", kicker: "31 hearing days, 50+ witnesses. The vote is due Dec 31 — rates land early 2027.", hotWord: "Dec 31" },
    takeaway: "The vote is Dec 31. The bill lands in 2027.",
    source: "ACC docket · Jul 2026",
    deck: [
      "The hearing ran May 18 to July 7 — 31 days, ~36 intervenors, 50+ witnesses. It's closed.",
      "The judge's recommended order is expected around November; the Commission must vote by December 31.",
      "Approved rates hit bills in early 2027 — on top of 2024's ~8%. The window to get ahead of it is now.",
    ],
  },
  {
    title: "Grid transformers take 3–4 years now",
    angle: "lead times blown out by data-center demand, per the ACC's July grid workshop — the buildout is booked solid and buildouts get paid for",
    format: "text",
    theme: "authority",
    pillar: "P3",
    objective: "share",
    shape: "hero-number",
    perishable: true,
    hook: { headline: "The wait for a grid transformer: 3–4 years.", kicker: "Data-center demand blew out the queue. Buildouts get paid for — guess by whom.", hotWord: "3–4 years" },
    takeaway: "The buildout is booked solid. Buildouts get billed.",
    source: "KJZZ · Jul 2026",
    deck: [
      "Grid-equipment lead times have blown out to 3–4 years, per Arizona's own grid workshop this month.",
      "The driver is data-center demand — everyone is expanding at once, on the same suppliers.",
      "Grid buildouts don't fund themselves. Watch where those costs get proposed next.",
    ],
  },
  {
    title: "Arizona repealed its efficiency mandate",
    angle: "ACC voted 4-0 in July to repeal the Electric Energy Efficiency Standards — the mandate is gone, existing rebates continue for now. Say 'mandate repealed', never 'rebates ended'",
    format: "carousel",
    theme: "authority",
    pillar: "P1",
    objective: "reach",
    shape: "news-react",
    perishable: true,
    hook: { headline: "Arizona just repealed its efficiency mandate.", kicker: "4-0 vote, July 8. The bill-cutting programs are no longer required to exist.", hotWord: "repealed" },
    takeaway: "The mandate is gone. The trajectory isn't.",
    source: "ACC · Jul 2026",
    deck: [
      "The Corporation Commission voted 4-0 on July 8 to repeal Arizona's energy-efficiency standards.",
      "Existing rebate programs continue for now, case by case — but the requirement behind them is gone.",
      "The takeaway isn't panic; it's direction. The tools that trimmed bills are getting optional. Yours don't have to be.",
    ],
  },
];
