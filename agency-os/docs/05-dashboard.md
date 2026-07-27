# Phase 5 — Founder Dashboard

Design rule from the spec: **no decorative graphs.** Every element is a scorecard (number + period delta), a table, an alert, or an action queue that leads to a decision. The only trend visualization is a 6-month sparkline on the four MRR/revenue scorecards, because "is this growing" is an actual operating decision input.

Layout: four bands, in priority order — **1) Compliance & risk (top), 2) Money, 3) Pipeline, 4) Account health.** Compliance is above money on purpose: an exception can invalidate revenue.

## Band 1 — Compliance & risk (alerts + action queues)

| Element | Type | Definition / source | Decision it serves |
|---|---|---|---|
| Open exceptions | Queue (sorted severity, age) | compliance_exceptions status ∈ {open, in_progress}; row shows gate, subject, remedy, clearable-by | What must I clear today |
| Upcoming license expirations | Table | supplier_licenses + buyer_licenses expiring ≤ 60d, with dependent frozen actions count | Whom to chase before revenue freezes |
| Missing compliance documents | Queue | Required-doc checklists (WF2/WF4/WF7) with absent/expired docs | Chase list |
| Complaints | Queue | complaints open/forwarded with SLA timers (forward ≤ 1 bd; ack ≤ 2d) | SLA protection |
| Recalls | Alert banner + table | recalls open; affected orders/buyers counts | Immediate attention |
| Regulatory alerts | Queue | regulatory_updates impact=unreviewed (age) + action_required (open) | Triage within 2 bd |
| Waived-gate register | Table (always visible) | Exceptions status=waived with memo link | Standing risk acceptance visibility |

## Band 2 — Money (scorecards + tables)

Definitions (all from supplier-reported data; commission figures only from approved calcs):

| Metric | Definition |
|---|---|
| **Current MRR** | Σ per active recurring account of trailing-90-day approved commission ÷ 3. Recurring account = ≥2 completed orders within 120d, not lapsed. Management metric, not GAAP (decision C2) |
| **New MRR** | MRR from accounts that became recurring this month |
| **Churned MRR** | Prior-month MRR of accounts that lapsed (no order for cadence+30d) |
| **Gross agency revenue** | Σ commission_calculations approved, period = month |
| **Collected revenue** (supplier-side) | Σ collected_revenue in period — the commission basis |
| **Commissions due** | Approved + invoiced calcs unpaid, with aging (current / 30 / 60 / 90) |
| **Commissions received** | Σ commission_payments in period; unreconciled count flagged |

Scorecards: Current MRR, New MRR, Churned MRR, Gross agency revenue (each with 6-mo sparkline + MoM delta). Tables: commissions due by supplier with aging; collected revenue by supplier vs. prior period.

## Band 3 — Pipeline (scorecards + tables)

| Element | Type | Definition |
|---|---|---|
| Sales pipeline | Table by stage | opportunities open: count + Σ est_monthly_value per stage |
| Opportunities by stage | Same table (merged — one artifact, not two) | qualified → quoted, with age-in-stage; stale (>21d) highlighted |
| Meetings booked | Scorecard | meetings scheduled_at in period; held rate shown beside |
| Supplier conversion rate | Scorecard | suppliers approved ÷ suppliers entering in_review (trailing 90d) |
| Buyer conversion rate | Scorecard | buyer entities with first order ÷ entities receiving first outreach (cohort, trailing 90d) |
| Days first contact → first order | Scorecard (median) | buyer_entities first_order_date − first_contact_date, trailing 90d cohort |
| Days first order → repeat order | Scorecard (median) | second completed order date − first, per account |

## Band 4 — Account health (scorecards + tables)

| Element | Type | Definition |
|---|---|---|
| Active suppliers | Scorecard | suppliers status=approved with ≥1 order in 90d (approved-but-idle shown as secondary number) |
| Active buyer accounts | Scorecard | buyer_entities with completed order in 90d |
| Average revenue per account | Scorecard | trailing-90d approved commission ÷ active accounts |
| Avg monthly purchasing volume | Scorecard | trailing-90d Σ order totals ÷ 3 (supplier-reported gross, not agency revenue — labeled as such) |
| Repeat-order rate | Scorecard | accounts with ≥2 completed orders ÷ accounts with ≥1 (trailing 180d) |
| Supplier concentration | Table + flag | Top supplier % of trailing-90d commission; flag > 40% |
| Buyer concentration | Table + flag | Top account % of trailing-90d order volume; flag > 30% |

Refresh: Band 1 live/on-load; Bands 2–4 nightly rollup with on-demand recalc. Every number links to its underlying filtered table — no unexplorable aggregates. Monthly close (WF23) snapshots all Band 2–4 metrics for history.
