# Farmhand — Business & Build Brief (for strategy planning)

> **Purpose of this document.** This is a complete, honest snapshot of a working
> software product and the founder's goal. It is written to be uploaded to a
> strategy AI so it can reverse-engineer the **fastest, most capital-efficient
> path to first revenue within 60–90 days**, and produce a plan concrete enough
> to hand to a developer as a build backlog. The strategist's prompt is at the
> end (Section 10). Read everything first.

---

## 1. One-paragraph summary

Farmhand is a **local-market content + lead operating system** for sales
professionals and service-based businesses. It turns a person's territory and
profession into a running system: it plans what to post, generates the actual
posts (copy + on-brand images/reels), finds real buying-intent conversations
across the web, scores and organizes leads, and tells the user the single best
next action — so a solo operator runs the marketing program of a whole team. It
is built as a multi-agent "OS" (a CEO/orchestrator directing specialist agents
for research, marketing, lead ops, analytics, and development). It is live and
deployed. The founder's own **Arizona solar-consultant account is the test
instance / proof of concept**; the product is designed to be **sold to other
sales pros and service businesses** (real estate, solar, loan officers,
insurance, home services, etc.).

---

## 2. What the working product does today (built & deployed)

The app is real and running on Vercel. These modules exist in code:

**Onboarding → Strategy**
- A 6-step intake (~18 questions, each with a "why we ask") emits a
  `StrategyProfile`. The entire app personalizes off that profile. New users land
  on a dashboard with **week one already drafted** (the "aha" is a pre-built week,
  not an empty screen).

**Content production**
- **Composer / Post Studio** — builds multi-slide carousel posts; AI-written copy
  (via Perplexity), direct in-canvas text editing, image generation, export.
- **Template Studio (DESERT GRID system)** — a branded design system with 16 post
  "archetypes," brand tokens, and 20 QA gates, so posts render like an established
  media page instead of amateur slides.
- **Content Engine** — routes each post to the right visual source (custom
  AI image/reel vs. stock vs. rendered chart/table).
- **Consultant Photo Library** — generates real-looking field/consultant photos
  so a thin real-photo library still reads established (details in Section 4).
- **Reel Coach** — analyzes a reference video (via Google Gemini) and coaches the
  user's short-form video.
- **Planner** — a weekly content calendar.

**Demand / lead engine**
- **Whole-web lead hunt** — searches the open web + Reddit for real buying-intent
  conversations for the user's profession and territory, with a scoring model and
  a per-vertical relevance backstop. APIs: hunt, discover, radar, leads.
- **Engage** — an opportunity inbox with reply-draft assistance, source/community
  rules memory, first-touch and fair-housing guardrails. **The app never
  auto-posts to communities** — the user always hand-posts (ToS-safe by design).
- **Pipeline** — a light 7-stage CRM with source attribution and lead-warmth
  scoring (cold → hot, transparent rules).
- **Market** — territory watchlist, segments, market signals, content angles.
- **Insights** — presence score, coverage, performance.

**The agent OS layer**
- Six agent charters exist (CEO/Orchestrator, Researcher, CMO, Lead Manager, Data
  Analyst, Dev), plus a Command Center, an Agent Network view, a Knowledge Vault
  graph, and Tasks/Schedule/Tools panels. A file-based "brain" vault holds the
  agents' instructions, brand rules, knowledge base, and shared memory.
- A **shared memory layer** (Supabase + Upstash Redis) is scaffolded so agents and
  sessions can persist and share state.

**Verticals**
- The lead engine is one machine; what changes per profession is *what counts as
  intent*. Two verticals are defined today: **realtor** (original) and **solar**
  (the founder's test vertical). Adding a vertical = defining its intents, search
  phrasing, and relevance rules — this is the expansion model.

---

## 3. Tech architecture & integrations (for the Dev agent)

- **Stack:** Next.js 15, React 19, TypeScript. three.js + gsap for visuals,
  html2canvas for post export. Deployed on Vercel.
- **State today:** primarily **client-side** — browser `localStorage` for app
  state, IndexedDB for the image vault. Server-side memory via Supabase +
  Upstash Redis KV is scaffolded but the app is **effectively single-user right
  now** (see gaps, Section 6).
- **External integrations already wired (keys in Vercel env):**
  - **Higgsfield** — AI image/reel generation (the visual engine).
  - **Perplexity** — AI post copy.
  - **Google Gemini** — video-reference analysis (Reel Coach).
  - **Pixabay / Pexels / Unsplash** — stock imagery.
  - **Reddit** (OAuth) — lead hunt + engagement sources.
  - **Supabase** + **Upstash Redis** — shared memory / KV.
  - **Vercel Blob** — file/video uploads.
- **Security posture:** all secrets are server-side env vars only; the app never
  auto-publishes to third-party communities.

---

## 4. The single most important piece (founder's priority)

**Image/reel production from Higgsfield must be clean and reliably good enough to
automate** — because the entire content flywheel depends on the user *approving*
generated content quickly, before it's posted. If the images look AI-fake or
off-brand, the human-approval step becomes a bottleneck and the automation
promise breaks.

Current state of this piece:
- There is a **codified prompt-engineering skill** (a "CMO" skill) that composes
  spec-perfect image prompts from a shot intent, plus a moodboard + brand-look
  system, so the user writes nothing.
- A real-photo **reference set** (real Arizona homes/interiors/installs) now
  grounds the "environment" so generations read as genuinely local, not generic.
- **Known constraint / automation gap:** Higgsfield's identity-lock ("Soul ID" —
  making the image look like a *specific real person*) is **only available in
  Higgsfield's web UI, not via their API**. So *likeness* shots are currently
  generated by hand in Higgsfield and imported. Non-likeness on-brand scenes can
  be fully API-automated. **Closing or working around this gap is central to
  making content generation truly hands-off and sellable.**

The strategist should treat "high-approval, low-touch visual generation" as the
core product risk and the core product moat.

---

## 5. Business goal (what we're solving for)

- **Test account:** the founder's Arizona solar-consultant social account is the
  proof of concept — it demonstrates the content + lead engine on a real person.
- **Product goal:** make Farmhand **sellable within 60–90 days** to **sales
  professionals and service-based businesses** (realtors, solar consultants, loan
  officers, insurance agents, home-service owners, etc.).
- **Founder stance:** willing to invest in the dev work to turn the POC into a
  releasable, sellable SaaS — but wants a strategist to define the **fastest,
  most efficient path to revenue first**, then use that to direct the build.
- **Constraint:** small/solo team, wants capital efficiency and speed over
  breadth. Prefers to nail one wedge and expand via the vertical model.

---

## 6. Honest gaps between "working POC" and "sellable SaaS"

The strategist and Dev agent must plan around these — they are the real backlog:

1. **Multi-tenancy & auth.** App is effectively single-user (localStorage). No
   login, no per-account data isolation, no team seats. This is the biggest lift
   to become sellable.
2. **Billing.** No subscription/payment system, no plan tiers, no usage metering
   (image generation has real per-unit cost).
3. **Higgsfield likeness automation** (Section 4) — the manual web-UI step for
   personalized photos.
4. **Onboarding self-serve.** Intake exists but the whole "spin up a new customer
   in their own territory/vertical" flow needs to be productized.
5. **Live data.** Some market/signal data is seeded rather than live-fed.
6. **Reliability/observability** for paid, unattended runs (partly addressed:
   image batches are crash-hardened; broader coverage needed).
7. **Compliance surface** for regulated verticals (fair-housing lint exists;
   solar/finance claims and TCPA-style outreach rules would need review).

---

## 7. Assets that lower execution risk

- A live, deployed, genuinely functional app (not vaporware).
- A real design system that makes output look premium.
- A working multi-source lead engine with guardrails.
- A vertical-abstraction already proven with two verticals.
- A real end user (the founder) dogfooding it daily on a real account.
- A documented product spec and agent/knowledge vault.

---

## 8. Open strategic questions for the plan to answer

- **ICP & wedge:** which single profession/segment is the fastest first dollar —
  the founder's own world (solar consultants), realtors (most built), or a
  service niche with less software competition and clearer ROI?
- **Packaging:** is this sold as (a) a self-serve SaaS tool, (b) a
  "done-with-you"/managed content service using the tool as the engine, or (c) an
  agency/white-label play? Which reaches revenue fastest given the multi-tenancy
  gap?
- **Pricing:** subscription tiers vs. per-seat vs. usage (image credits)? What
  price clears value for a solo salesperson vs. a small team?
- **Fastest-revenue sequence:** what is the minimum set of the Section-6 gaps that
  must close before the first paying customer, and what can be deferred or done
  manually behind the scenes at first (concierge MVP)?
- **Distribution:** how does a solo founder get the first 10, then 100 paying
  users efficiently (founder-led, niche communities, partnerships, affiliate/
  referral like the founder's own SunSolar affiliation)?
- **Moat:** is it the local/territory data, the content quality, the lead engine,
  or the vertical library — and which to lean on in positioning?

---

## 9. Success criteria for the plan

The plan is good if it delivers: a chosen **ICP + wedge**, a **positioning/offer**,
a **pricing & packaging** recommendation, a **GTM motion** to first revenue, and a
**prioritized 60–90 day roadmap** that ties each build item to a revenue milestone
(so we know what to build first and why). It must be concrete enough to convert
directly into developer tasks.

---

## 10. Prompt for the strategy AI (paste this with the brief)

> You are a pragmatic startup strategist and go-to-market operator advising a
> solo/small founder. Above is a complete brief on a live product ("Farmhand").
> Your job is to design the **fastest, most capital-efficient path to first
> revenue within 60–90 days**, then a path to a repeatable revenue engine.
>
> Produce:
> 1. **ICP & wedge** — pick ONE beachhead customer (profession + segment + why
>    they'll pay fastest) and justify it against the alternatives in the brief.
> 2. **Offer & positioning** — the exact promise, the "before/after," and how it's
>    differentiated. State whether to sell as self-serve SaaS, done-with-you
>    service, or white-label/agency — and why that reaches revenue fastest given
>    the multi-tenancy gap.
> 3. **Pricing & packaging** — concrete tiers/prices with rationale, including how
>    to handle image-generation cost.
> 4. **Minimum sellable scope** — of the gaps in Section 6, exactly which must
>    close before the first paying customer, which can be faked/concierged at
>    first, and which are deferred. Be ruthless about scope.
> 5. **90-day roadmap** — week-by-week or milestone-by-milestone, each item tied to
>    a revenue or validation milestone, ordered by impact-to-effort.
> 6. **GTM motion** — how the founder gets the first 10 and first 100 paying users
>    with near-zero budget (founder-led sales, communities, partnerships,
>    referral/affiliate).
> 7. **Risks & kill-criteria** — what would tell us the wedge is wrong, and when to
>    pivot.
> 8. **A build backlog** — translate the roadmap into a prioritized list of
>    developer tasks (epics → stories) that a coding agent could execute, each with
>    an acceptance criterion. Flag anything that needs a product decision first.
>
> Assume a small team and limited capital. Prefer speed and focus over breadth.
> Where you make an assumption, state it. Ask me nothing — deliver the plan.
