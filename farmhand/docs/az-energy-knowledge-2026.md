# Arizona Energy & Solar Knowledge Base (condensed) — as of July 18, 2026

Condensed from a deep-research pass over primary sources: APS/SRP tariff PDFs, ACC dockets,
IRS FS-2025-05, the SRP Nov-2025 ratebook, and EIA. The reply/content wiring lives in
`lib/azEnergyKb.ts`. Re-verify anything marked PENDING before quoting to a homeowner.

## APS (regulated by ACC) — current residential plans (Decision 79293, eff. Mar 8 2024)

| Plan | Structure | Key numbers |
|---|---|---|
| R-1 Fixed | Flat, tiered by avg usage; **solar NOT eligible** | 12.925¢ (≤600 kWh) / 14.052¢ / 15.418¢ (≥1000 kWh); $0.362–0.458/day service |
| TOU-E (default for new solar) | TOU 4–7pm weekdays on-peak; no demand charge | Summer on-peak **34.396¢**, off-peak 12.345¢; winter super off-peak 3.495¢ (10am–3pm) |
| R-3 demand | Lowest energy rates + demand charge on highest on-peak hour | 14.227¢ on-peak summer; demand **$19.585/kW summer**, $13.747 winter |
| R-EV | EV owners; super off-peak 11pm–5am daily 3.495¢ | On-peak 46.444¢ summer — punishing |
| R-2 Saver Choice Plus | FROZEN (closed Dec 2021); 3–8pm on-peak | $9.389/kW demand both seasons |

- **Export (RCP)**: 6.171¢/kWh for Sep 2025–Aug 2026 interconnections, **locked 10 years**;
  stepped down 10%/yr from 12.9¢ (2017) — a 52% decline. Next reset Sep 1, 2026 (≤−10%).
- **Grid Access Charge** ($0.215–0.250/kW-dc/mo by plan): **VACATED by AZ Court of Appeals
  June 26, 2026** (due process); APS separately seeks to ~double it. PENDING/uncertain.
- **Legacy net metering (EPR-6, pre-Sep-2017 solar)**: 1:1 retail netting, 20-yr grandfather,
  **transfers to a homebuyer at the same site**. Year-end cash-out 2.895¢.
- **2025 rate case (Docket E-01345A-25-0105)**: ~14–14.75% net requested (~16% residential,
  ~+$20/mo); hearing ended Jul 7, 2026; ACC vote due Dec 31, 2026; new rates early 2027. PENDING.
- PSA fuel adjustor: +$0.002 (Mar 2025), +$0.003 → $0.016977/kWh (Feb 2026).

## SRP (self-governed board, not ACC) — Nov 2025 restructuring

- Overall +2.4% net Nov 2025 (avg residential +3.5%/$5.61; solar +5.5%). First base change since 2019.
- **Tiered monthly service charge all plans**: $20 (apt/condo) / $30 (single-family) / $40 (>225A).
- **Net metering retired Nov 2025.** Export credit **3.45¢/kWh flat** (resets each May on open plans;
  frozen plans hold 3.45¢ to sunset). All legacy solar plans (E-13/E-14/E-15/E-27) **end Nov 2029**;
  grandfathering **does NOT transfer on home sale** (opposite of APS).
- Open plans: E-23 Basic (12.10/14.04/11.03¢ by season), E-24 M-Power, E-16 (demand, 5–10pm),
  **E-28** (TOU 6–9pm on-peak, no demand; **summer-peak on-peak 40.26¢**).
- **E-27 Customer Generation** (legacy solar): lowest energy rates (6.62–8.23¢ on-peak) + tiered
  demand on the single highest 30-min on-peak grid draw: summer $9.85 (first 3 kW) / $16.32 (next 7)
  / $29.26 (beyond); Jul–Aug $11.98/$20.05/$36.13; winter $5.01/$7.10/$11.08.
  Worked example: shaving 8 kW→2 kW saves ≈$91 (summer) / $112 (Jul–Aug) / $41 (winter) per month
  ≈ **$833/yr**.
- Temporary −3% summer FPPAM May–Oct 2026 (−$0.0038/kWh; avg −$5.57/mo); reverts Nov 2026.
- Cumulative FPPAM/price increases Nov 2021–Nov 2025 ≈ **25%** (base flat 2019–2025).

## Federal tax (OBBBA, P.L. 119-21) — IRS FS-2025-05

- **§25D 30% residential credit TERMINATED** for expenditures after Dec 31, 2025; expenditure is
  "made" when **installation is completed** — paying in 2025 does NOT save a 2026 install. Applies
  to solar AND homeowner-owned batteries. (Claims of a "battery ITC through 2032" are wrong.)
- **§48E survives for third-party-owned (lease/PPA)**: begin-construction safe harbor closed
  July 4, 2026 → new TPO projects generally must be placed in service by Dec 31, 2027. TPO is now
  the dominant residential path; lease rates often 20–40% below retail, escalators 1.99–2.99%/yr.
- Market impact: purchase ≈$8k more expensive, payback ~7→10+ yrs (AZ estimate 13–16 yrs for
  ~$21.8k net 8 kW); SEIA forecasts −19–20% residential installs in 2026.

## Arizona state incentives (all IN EFFECT)

- **$1,000 state credit** (25% capped; ARS §43-1083; Form 310; 5-yr carryforward, nonrefundable).
- **Sales/TPT exemption** (5.6%; ARS §42-5061). **Property-tax exemption** (ARS §42-11054).

## Batteries & VPP

- AZ installed cost ~$960–1,020/kWh; 13.5 kWh ≈ $12.5–13.8k. Top sellers: Powerwall 3 ($967/kWh
  avg), Enphase 5P/10C, FranklinWH.
- APS value: TOU arbitrage spread ~$0.2205/kWh (≈$60/mo summer) + self-consumption vs 6.17¢ export.
- SRP value: demand shaving (see E-27 math) — batteries near-essential for SRP solar.
- **APS Storage Rewards** (BYOD pilot, 5 yr / 5,000): **$110 per avg kW delivered per summer
  season** (May–Oct, ≤60 events 4–10pm); typical $330–660/season. Replaced the old $3,750 upfront pilot.
- **SRP Battery Partner** (pilot to Apr 2030 / 5,000): **$55/kW per season × 2 seasons**; never
  discharges below 20%. Old upfront $300/kWh rebate closed.
- **APS Cool Rewards** (thermostat): $50 enroll + $35/yr; ~90k thermostats ≈ 160 MW; total APS
  VPP ~200 MW.
- Grid is reliable: SRP SAIDI 70 min (nat'l median 203); **zero major outages in the 2024 heat wave**
  (113 days ≥100°F). Backup = severity insurance, not frequency.

## Supply/demand crunch

- Peaks (Aug 7, 2025): APS 8,631 MW, SRP 8,542 MW, TEP 2,502 MW — all records.
- APS: peak 8.7→**12.0 GW by 2035**; retail sales +67% by 2041; **76% of growth = data centers /
  large industrial**. ~19–20 GW of data-center load committed or negotiating (3,296 MW committed
  by end-2028 per rate-case testimony).
- TSMC Phoenix: ~1.2 GW at full six-fab build; Intel Chandler → up to ~900 MW (SRP).
- Supply: SRP Coolidge +575 MW gas (2026–27); APS ~9.8 GW additions 2025–28 (solar/wind/storage/gas);
  SRP 2035 goals 7 GW renewables + 1.5 GW batteries + 1 GW pumped hydro + 2 GW gas; APS/SRP/TEP
  joint nuclear siting study; Palo Verde license extension to 2065–67 planned.
- Coal: Cholla closed 2025 (converting 2 units to gas ~380 MW by 2029); Four Corners delayed to 2038.
- **Who pays**: ACC "Ratepayer Protection Pledge" + XHLF class — data centers pay ~45% above
  residential and fund their own infrastructure. Don't overstate "data centers will spike your bill."

## Generation mix (EIA 2024)

Gas 45% · Nuclear 27% (Palo Verde — now **2nd**-largest US plant behind Vogtle; largest in the West)
· Solar 13% · Coal 8% · Hydro 4% · Wind 2%. AZ residential avg ~15.5¢/kWh (~15% below US avg),
~1,100 kWh/mo, ~$160–164/mo. Net-load peak has shifted to 6–8pm (duck curve) — exactly why on-peak
windows and demand charges sit there, and why storage arbitrage works.

## Honest counterpoints (always disclose)

1. Post-OBBBA purchase payback is 10–16 yrs, not 7 — sometimes the answer is "not yet."
2. APS export rate keeps stepping down (next cut Sep 2026, floor ~5.5¢).
3. SRP demand charges can ERASE savings for an unmanaged system.
4. Lease ≠ buy (no personal credit, escalators, resale friction).
5. SRP grandfathering dies at home sale and everything sunsets Nov 2029.
6. SRP E-28 without a battery can disappoint despite a working system.
7. Data-center strain is real but regulators are actively isolating residential rates from it.

## See also (July 2026 research expansion)

Two companion fact-check documents, distilled from the July 2026 deep-research
pass, extend this KB and are equal sources of truth for the Fact Checker:

- `az-rates-supply-demand-2026.md` — the APS rate case in full (asks,
  intervenors, schedule, precedent), data-center/growth supply-demand story
  (with the contested points labeled), 10-year price history vs national,
  forecasts, homeowner bill translations, and the sourced consumer-pain
  record (named bills, hearing testimony, the October cliff, disconnection
  history). Every line labeled [fact]/[projection]/[contested].
- `az-solar-market-2026.md` — how solar is sold in metro Phoenix in 2026:
  the post-§25D TPO/lease wave and why, pricing ($2.30/W local), installer
  bankruptcies + AZ AG enforcement record, ranked objection data, and the
  consultant-not-salesperson positioning evidence.
