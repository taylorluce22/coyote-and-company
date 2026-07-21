/**
 * Arizona energy knowledge base — curated from a July 2026 deep-research pass
 * over primary sources (APS/SRP tariff PDFs, ACC dockets, IRS FS-2025-05,
 * SRP ratebook, EIA). This is what makes solar replies and content sound like
 * a 15-year Valley expert instead of a generic solar page.
 *
 * Numbers current as of mid-July 2026. Anything pending or legally unsettled
 * is phrased with that uncertainty built in — replies must never overstate.
 * Full condensed reference: farmhand/docs/az-energy-knowledge-2026.md
 */

export type AzUtility = "aps" | "srp" | "unknown";

/** Detect which utility a pasted thread is talking about. */
export function azUtilityIn(text: string): AzUtility {
  const t = text.toLowerCase();
  const aps = /\baps\b|arizona public service/.test(t);
  const srp = /\bsrp\b|salt river project/.test(t);
  if (aps && !srp) return "aps";
  if (srp && !aps) return "srp";
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
    srp: "on SRP's newer plans the July/August 6–9pm on-peak rate hits about 40¢/kWh — and the legacy solar plans charge for your single highest evening grid spike instead (demand charges)",
    unknown: "both APS and SRP price summer evenings brutally — APS ~34¢/kWh on-peak, SRP up to ~40¢ in July/August — so WHEN you use power matters more than how much",
  },
  ratePlanCheck: {
    aps: "APS has three main plans (flat, time-of-use, and a demand plan) and picking the wrong one for your usage pattern can cost real money before solar even enters the picture — the switch is free",
    srp: "SRP restructured everything in late 2025 (new $20–40 tiered monthly charge, new time-of-day plans, old plans sunsetting by 2029), so it's worth confirming you're on the right plan — that check is free",
    unknown: "checking you're on the right rate plan is free and sometimes fixes a chunk of the bill before solar even enters the picture",
  },
  export: {
    aps: "APS pays about 6.2¢/kWh for exported solar right now, locked for 10 years from interconnection — but that rate has stepped down ~10% every September since 2017 (it started at 12.9¢), so waiting literally costs export value",
    srp: "SRP pays a flat ~3.45¢/kWh for exports — roughly half what APS pays — which is why SRP solar math lives or dies on self-consumption and batteries, not exports",
    unknown: "neither utility does true net metering anymore — APS credits exports ~6.2¢/kWh (locked 10 years), SRP ~3.45¢ — so system sizing should be about covering your own usage, not selling power back",
  },
  tax: {
    any: "the 30% federal credit is gone for homeowner purchases — anything not fully installed by Dec 31, 2025 gets $0 federal, no matter when it was paid for. Arizona still has its own $1,000 credit plus sales-tax and property-tax exemptions, and leases/PPAs price differently because the leasing company can still claim a commercial credit",
  },
  battery: {
    aps: "on APS a battery earns its keep on the on-peak/off-peak spread (~22¢/kWh of arbitrage) plus their Storage Rewards program pays about $110 per average kW your battery delivers over the summer — a typical unit earns $300–660/season",
    srp: "on SRP's demand-charge solar plans a battery that shaves your evening grid spike from 8kW to 2kW saves roughly $40–112/month depending on season (~$800+/year), and their Battery Partner program pays $55/kW twice a year on top",
    unknown: "batteries in AZ now earn three ways: avoiding the evening peak rates, shaving demand charges (on SRP plans), and utility VPP programs that pay roughly $110 per kW per year for sharing capacity during grid events",
  },
  gridDemand: {
    any: "Arizona's grid demand keeps breaking records (APS hit 8,631 MW last August) and APS reports 4.5 GW of committed new load plus roughly 20 GW more of data-center requests in its queue — its own plan projects peak demand growing ~40% by 2031, which is the backdrop for every rate case",
  },
  rateCase: {
    any: "APS is asking for about 14.75% more revenue (~16.4% for residential), with a decision due by Dec 31, 2026 and new rates in early 2027 — and this isn't a one-off: APS won a rate increase in 2022 and is already back asking for more",
  },
  azContext: {
    any: "Arizona is cheap by the kWh but expensive by the month — the average rate here is ~10% below the national average and rose slower over the last decade (+23% vs +30%), but bills run higher ($160 vs $142/month) because desert homes use about 25% more electricity, mostly AC",
  },
  trust: {
    any: "the solar industry has a trust problem worth naming out loud: roughly 100 U.S. solar companies have gone bankrupt since 2023 (Titan, SunPower, Sunnova, Freedom Forever among them) and homeowner distrust doubled in a single year — which is exactly why every quote deserves a slow, skeptical read",
  },
  installerQuality: {
    any: "price per watt is one input, not the verdict — federal regulators (CFPB) have found dealer fees can inflate a financed loan's principal by 30% or more above the cash price, often hidden inside the payment rather than the rate. The real markers: how the roof penetrations are flashed, an active R-11/CR-11 license with a clean ROC complaint record (free to look up), a spot on APS's Qualified Technology Installer or SRP's Preferred Solar Installer list, one accountable company from sales to service, and 10+ year workmanship coverage. The few AZ installers doing truly high-quality work usually cost a bit more — usually far less than what a dealer-fee loan quietly adds",
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
export const SOLAR_KB_CONTENT: { title: string; angle: string; format: "carousel" | "reel" | "story" | "text"; theme: string; deck?: string[] }[] = [
  {
    title: "Why your July SRP bill spikes: the 40¢/kWh window nobody explains",
    angle: "SRP's 6–9pm summer-peak rate is ~40¢ — decode it with a real bill and the free fixes first",
    format: "carousel",
    theme: "bill-breakdown",
    deck: [
      "SRP's newer plans charge about 40¢/kWh from 6–9pm in July and August. Every other hour costs a fraction of that.",
      "On the legacy solar plans it's different: they bill your single highest evening spike — one bad hour sets the month.",
      "Free fixes first: pre-cool before 6, pool pump overnight, laundry after 9. Then we talk hardware.",
    ],
  },
  {
    title: "APS pays 6.2¢ for your solar — and it drops again in September",
    angle: "the export rate has stepped down ~10% every year since 2017 (from 12.9¢); waiting has a literal price",
    format: "text",
    theme: "authority",
    deck: [
      "APS credits exported solar at about 6.2¢/kWh, locked for 10 years from your interconnection date.",
      "That rate started at 12.9¢ in 2017 and has stepped down roughly 10% every September since.",
      "The lock happens at interconnection — not at signing. Timeline matters more than any discount.",
    ],
  },
  {
    title: "The $800/year battery move for SRP demand-plan homes in {n}",
    angle: "worked math: shaving an 8kW evening spike to 2kW saves $40–112/mo — real tariff numbers, not vibes",
    format: "carousel",
    theme: "battery-ev",
    deck: [
      "SRP's demand solar plans bill your worst evening grid spike — like 8kW when AC, oven and dryer overlap.",
      "A battery that shaves that spike to 2kW saves roughly $40–112 a month depending on season.",
      "Add SRP's Battery Partner program ($55/kW, paid twice a year) and the math lands near $800+ a year.",
    ],
  },
  {
    title: "The 30% federal solar credit is gone. Here's the honest 2026 math",
    angle: "objection-handling with real numbers: AZ's $1,000 credit + tax exemptions remain, leases price differently — and sometimes the answer is 'not yet'",
    format: "carousel",
    theme: "objection-handling",
    deck: [
      "Anything not fully installed by Dec 31, 2025 gets $0 federal — no matter when it was paid for.",
      "Arizona still stacks its own $1,000 credit plus sales-tax and property-tax exemptions.",
      "Real payback now runs 10+ years, not the 7 in the ads. For some homes the honest answer is 'not yet'.",
    ],
  },
  {
    title: "Your battery can earn ~$660 a summer from APS now",
    angle: "Storage Rewards pays $110/avg kW per season; SRP's Battery Partner pays $55/kW twice a year — the VPP era is here",
    format: "text",
    theme: "battery-ev",
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
    title: "Selling a {n} home with solar? APS terms transfer. SRP's don't.",
    angle: "APS legacy net metering follows the house; SRP grandfathering dies at sale and sunsets by 2029 — huge for sellers and buyers",
    format: "carousel",
    theme: "new-homeowner",
    deck: [
      "On APS, legacy net metering and export-rate locks follow the house to the next owner.",
      "On SRP, grandfathered plans die at the sale — and the old plans sunset by 2029 anyway.",
      "Buyers: ask which utility and which plan BEFORE you price that 'free solar' into your offer.",
    ],
  },
  {
    title: "APS is asking for ~16% more on your bill — what the rate case means",
    angle: "decision due by Dec 31, 2026, new rates early 2027; frame the 2022 precedent as a pattern of repeat increases (never reassurance) and locals will share it",
    format: "text",
    theme: "authority",
    deck: [
      "APS is asking for ~16.4% more from residential customers. The hearing ran 31 days — the longest in ACC history — and a decision is due by Dec 31, 2026.",
      "And this isn't a one-off: APS won a rate increase in 2022 and it's already back asking for more. The asks keep coming.",
      "What you control now: your rate plan and your 4–7pm usage — both free to fix.",
    ],
  },
  {
    title: "Arizona power: cheap by the kWh, expensive by the month",
    angle: "the nuanced take nobody posts — AZ rates rose SLOWER than the national average, but bills are bigger; credibility through less alarmism",
    format: "carousel",
    theme: "authority",
    deck: [
      "Arizona's average rate is ~10% BELOW the national average — and over the last decade it rose slower too (+23% here vs +30% nationally).",
      "But the average Arizona bill is $160/month vs $142 nationally, because desert homes use about 25% more electricity. AC is the whole story.",
      "Translation: the lever you control isn't the rate — it's when and how you use the expensive hours.",
    ],
  },
  {
    title: "100 solar companies have gone bankrupt since 2023. Vet yours.",
    angle: "the trust crisis is the credibility opening — calm, documented, homeowner-protective",
    format: "carousel",
    theme: "buyer-education",
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
      "Then check the utility lists: APS's Qualified Technology Installer program and SRP's Preferred Solar Installer list both require good standing and training.",
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
];
