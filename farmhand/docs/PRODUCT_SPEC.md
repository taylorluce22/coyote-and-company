# Farmhand — Product Spec (LocalOS evolution)

> The local-market operating system for sales professionals. Phase 1: Arizona real estate agents.
> One-liner: **Own your farm.**

## 1. Positioning

Farmhand turns a territory into a system: what to publish, where the conversations are, who's
warming up, and what to do next — so a solo agent runs the visibility program of a team with a
marketing department.

Differentiators:
- **Territory-first, not calendar-first.** Content, conversations, market signals, and leads all
  hang off neighborhoods — the way agents actually think ("I farm Paradise Valley"). This is also
  the vertical-expansion moat (loan officers farm ZIPs; insurance agents farm communities).
- **An action engine, not a stats page.** Every screen ends in a ranked "do this next."
- **Participation-based prospecting.** Useful presence in existing communities — the only
  compliant option (Facebook Groups/Nextdoor have no third-party APIs) and the only one that
  builds real local reputation. The app NEVER posts to a community on the agent's behalf.
- **Personalized by strategy intake.** Onboarding emits a `StrategyProfile`; the whole app
  renders from it.

## 2. Modules

| Module | What | Phase |
|---|---|---|
| Today | Presence score, streak, market pulse, next-actions queue | MVP |
| Content | Ideas / Studio (Composer) / Week (Planner) / Queue (Engine) | MVP (mostly built) |
| Market | Territory watchlist, segments, signals, content angles | MVP seeded, live feeds P2 |
| Engage | Sources, opportunity inbox, reply drafting, log, follow-ups | MVP manual core, Reddit P1.5 |
| Pipeline | 7-stage CRM-lite w/ source attribution + warmth | MVP light |
| Insights | Scores, performance, coverage | MVP thin |
| Onboarding | Strategy intake → StrategyProfile | MVP first |
| Valuation/lead pages, team seats, other verticals | | P2/P3 |

Rejected: auto-posting to groups (ToS), scraped lead lists (spam/fair-housing risk),
external-data "authority score" (fake precision), separate Reply Assistant tab (folds into Engage).

## 3. IA

Nav: Today · Content · Market · Engage · Pipeline · Insights · Settings.
Content tabs: Ideas / Studio / Week / Queue. Engage tabs: Opportunities / Sources / Drafts
(/ Follow-ups P1.5). Market: watchlist grid → neighborhood detail.

## 4. Onboarding (6 steps, ~18 questions, every question shows "why we ask")

1. **Identity** — name, brokerage, license #, experience level, home base.
2. **Territory** — pick 2–6 AZ areas (Paradise Valley→luxury, Buckeye→growth seeded); status
   own/building/exploring; segment per area.
3. **Positioning** — ≤2 of luxury/growth/first-time/investor/relocation/generalist; ideal client;
   "what do clients say you're great at."
4. **Voice & platforms** — platforms used; 3 tone chips; camera comfort.
5. **Prospecting comfort** — observer/participant/connector (drives Engage cadence caps and
   draft assertiveness); follow-up honesty; off-limits list (hard guardrails).
6. **Goals & cadence** — sustainable posting target (scored against THEIR target); 90-day goal;
   time budget.

Ends with an animated "Building your OS" transition; lands on a dashboard with week one already
drafted. The aha moment is a pre-built week, not an empty state.

## 5. Scores

- **Presence (headline)** = 35% Consistency + 25% Coverage + 25% Engagement + 15% Pipeline hygiene.
- Consistency = published ÷ agent's own target, trailing 28d.
- Coverage = each territory touched by ≥1 content + ≥1 engagement per 14d.
- Engagement health = replies per post trailing, platform-weighted.
- Neighborhood opportunity = conversation volume + signal activity + inverted share of voice.
- Lead warmth = recency × initiative × depth → cold/warming/warm/hot (transparent rules).
- Next Actions rank = impact × urgency × strategy fit. Rules-based in MVP.

## 6. Engage guardrails (product-enforced)

First-touch rule (no CTA/link/pitch on first engagement in a source) · cadence caps by comfort
level · duplicate-engagement warnings · per-source community-rules memory injected into drafts ·
fair-housing lint on every draft · the agent always hand-posts (no last-mile automation).

## 7. Data model (target)

Agent, StrategyProfile, Neighborhood (join hub — everything carries neighborhoodId),
MarketSignal, Source, Opportunity, Engagement, Contact (stage + warmth + origin), ContentItem,
ScoreSnapshot, Action. See `lib/strategy.ts`, `lib/feeds.ts`, `lib/pipeline.ts` for current shapes.

## 8. Build plan

Sprint 1–2 onboarding + spine + nav (THIS). Sprint 3 Market signal packs. Sprint 4 Engage core.
Sprint 5 Pipeline + scores. Sprint 6 Reddit monitors + mobile pass + 5-agent AZ beta.
Persistence: localStorage now, Supabase adapter next (auth + RLS).
Beta success metric: ≥3 of 5 agents complete ≥5 next actions/week by week 3.
