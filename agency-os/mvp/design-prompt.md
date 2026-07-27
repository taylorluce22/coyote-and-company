# CRM Design Prompt (for Claude)

Paste the block below into Claude (claude.ai or Claude Code) to generate the Agency OS CRM design prototype. It encodes the business model, all nine screens, the design language, the compliance-driven UI rules, and realistic seed data from the current target list.

---

Design and build a polished, interactive CRM web app called "Agency OS" — a single-page
React prototype with realistic seed data, ready to be the visual spec for my real build.

THE BUSINESS (context you need to design correctly):
I run a one-founder B2B introduction agency in the pharma space. I connect vetted 503B
compounding facilities (my "Suppliers") with license-verified clinical buyers (med spas,
IV-therapy clinics, men's-health clinics, ophthalmology practices — my "Buyers"). I never
sell or touch product: suppliers quote and invoice buyers directly; I get paid retainers,
per-meeting fees, and commissions on supplier-reported collections. The whole business is
compliance-gated automation: emails only send to fully qualified contacts, opt-outs
suppress instantly, and a handful of actions stay human — approving templates, verifying
licenses, sending introductions, approving monthly commission statements. The CRM's job
is to make my daily work a short queue of one-click decisions on top of a machine that
runs itself.

DESIGN DIRECTION:
- Modern operations-cockpit aesthetic: dense but calm. Think Linear/Vercel-dashboard
  energy, not Salesforce. Dark mode primary, light mode supported.
- A restrained base palette with ONE signature accent color, plus a strict semantic
  color language reserved for status only: green=verified/active, amber=expiring/
  pending, red=blocked/exception, purple=awaiting-my-approval. Status colors never
  used decoratively — when something is red it must MEAN something.
- Everything is a scorecard, table, queue, or timeline. No decorative charts; the only
  trend visuals are small sparklines on money metrics.
- Every list row answers "what do I do about this?" — primary action button inline.
- Typography: clean grotesque for UI, tabular numerals for money columns.

SCREENS (build all, sidebar navigation in this order):
1. TODAY (home/cockpit): top strip of alert counts (open exceptions by severity, SLA
   timers, licenses expiring ≤30d); then three queues — "Waiting on me" (approvals:
   campaign templates, commission statements, supplier sign-offs — each with a one-click
   Approve button and a details drawer), "Reply triage" (email replies classified
   positive/neutral/negative, with respond links), "Verify" (licenses pending
   verification with a Verify button). If all queues are empty show a big calm
   "Machine's running. Nothing needs you." state.
2. PIPELINE: kanban of opportunities — stages: Qualified → Meeting Held → Intro
   Requested → Supplier Consented → Introduced → Quote Reported → Won/Lost. Each card
   shows buyer, supplier, est. monthly value, days-in-stage (highlight >21d), and small
   "gate chips" (green/red dots for: buyer verified, product approved, state allowed,
   supplier consented). A red chip blocks stage advance with an explanatory tooltip:
   why blocked, which record, what clears it, who can clear it.
3. SUPPLIERS: table with tier badges (Tier 1/Tier 2/Watch/Excluded), status, state,
   product focus, credential health (worst-status rollup), open exceptions. Detail
   drawer: contacts + hooks, credentials with expirations, agreement terms (retainer /
   meeting fee / commission %), reported orders & collections, activity timeline.
4. BUYERS: table with status pipeline (Prospect → Qualified → Verified → Active),
   buyer type, state, license status with expiry countdown, owner, last activity.
   Detail drawer: contacts (with email deliverability + outreach status incl. a
   permanent OPTED OUT badge), credentials with evidence links, opportunities, orders.
5. VERIFY (license workbench): split view — left: queue of credentials pending
   verification; right: work panel showing the credential, a prefilled state-board
   lookup URL button, an evidence upload slot, and Verified Active / Problem buttons.
   Show the rule: "verification is a human act — automation only schedules it."
6. OUTREACH: campaign cards (audience, status, daily cap, sent/reply/bounce stats,
   two approval checkmarks — Founder + Compliance — both required before Active);
   a sends log table with per-message gate results (pass/blocked + which gate);
   a suppression list view labeled "permanent — rows can never be deleted."
7. MONEY: scorecards with sparklines (MRR, new MRR, churned MRR, commissions due,
   commissions received); commission statement table by period per supplier with
   Draft → Approved → Invoiced → Paid status flow and a one-click "Approve statement"
   button; collections table (supplier-reported); aging view.
8. COMPLIANCE: exceptions table sorted severity-then-age, each row: gate code, what
   was blocked, blocking record, required remedy, who can clear, with Resolve (requires
   a note) and rare Waive (requires memo link) actions; a "Waived register" always
   visible at bottom; regulatory-updates triage queue (Unreviewed → None/Review
   Needed/Action Required); recalls banner if any open recall (auto-suspends product).
9. SETTINGS: users/roles matrix preview, integrations status tiles (Airtable, Make,
   Instantly, MillionVerifier, Cal.com, QuickBooks — connected/erroring), claims-linter
   word list editor (blocklist / flag list), audit log viewer (append-only, filterable).

SEED DATA (make it feel real):
Suppliers: Pine Pharmaceuticals (NY, Tier 1, ophthalmology), Belmar Pharma Solutions
(CO, Tier 1, hormone therapy), Olympia Pharmaceuticals (FL, Tier 1, men's health/IV),
AnazaoHealth (NV, Tier 1, aesthetics/IV), Nubratori RX (CA, Tier 1), KRS Global (FL,
Tier 2), Carie Boyd (TX, Watch — recent FDA warning letter), Edge Pharma (Excluded —
defunct). Buyers: ~12 across AZ/TX/CO/NV med spas, IV clinics, men's-health clinics,
ophtho practices in various statuses. A few opportunities in every stage, one blocked
by an expired license (red gate chip), 2 open exceptions (one critical: "recall —
product auto-suspended"), 3 licenses expiring soon, one campaign active with realistic
send stats, one commission statement awaiting approval, MRR ≈ $8.4k trending up.

HARD RULES THE UI MUST EXPRESS:
- Blocked actions always explain: why, which record, what document/approval clears it,
  who may clear it. Never a bare "blocked."
- Opt-outs and the audit log are visibly immutable (no delete affordances; lock icons).
- Approval buttons show WHO approved and WHEN after clicking (two-checkbox pattern for
  campaigns: Founder + Compliance).
- No medical/product claims anywhere in UI copy — product references are category-level
  ("office-use sterile preparations"), never drug names with outcomes.

Build it as a single-file React app with Tailwind, fully interactive (clickable queues,
drawers, kanban drag, working approve flows that update state), keyboard-friendly, and
with the seed data above. Make it beautiful enough that I'd screenshot it for a pitch
deck, and true enough to the spec that my Airtable/Make build can copy it screen-for-screen.
