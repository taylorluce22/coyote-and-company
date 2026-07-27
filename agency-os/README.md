# Agency OS — Compliance-First B2B Pharmaceutical Sales Agency

Operating system specification and database for a one-founder **marketing & introduction agency** (launch mode): the agency vets suppliers, verifies B2B buyers, runs compliant outreach, and makes warm introductions — the supplier quotes, negotiates, invoices, ships, and is seller-of-record for every sale. This activity discipline is what keeps the agency outside wholesale-distributor/broker licensing and DSCSA trading-partner status (researched in `docs/10-regulatory-research.md`); the fuller quote-brokering mode is documented but deferred. It is **not** a storefront: no patient-facing features, no product possession or title, no buyer invoicing, no automated legal conclusions.

**Read first:** [`docs/10-regulatory-research.md`](docs/10-regulatory-research.md) — the 2026-07 regulatory research and lowest-barrier model selection (business-model ranking, product lanes incl. the two prohibited categories, compensation contract terms, state posture, launch checklist). Then [`docs/00-decision-table.md`](docs/00-decision-table.md) — build / do-not-build decisions and the research-answered navigation register (RC1–RC12), which ships as founder-clearable seeded exceptions.

| File | Contents |
|---|---|
| `docs/00-decision-table.md` | Controlling decisions, contradictions resolved, counsel register |
| `docs/01-data-model.md` | Phase 1 — all 40 tables: fields, types, validation, relationships, permissions, source, review frequency |
| `docs/02-roles-permissions.md` | Phase 2 — 6 roles, full permission matrix, separation-of-duties rules |
| `docs/03-compliance-gates.md` | Phase 3 — gates G1–G10, block-message contract, fail-closed rules |
| `docs/04-workflows.md` | Phase 4 — 23 workflows, each step tagged automated / human / supplier / compliance / prohibited-from-automation |
| `docs/05-dashboard.md` | Phase 5 — founder dashboard: scorecards, tables, queues; metric definitions |
| `docs/06-outreach.md` | Phase 6 — outreach components + outbound copy rules |
| `docs/07-stack.md` | Phase 7 — stack comparison, MVP + scale choice, migration path, costs |
| `docs/08-build-plan.md` | Phase 8 — PRD, user stories, acceptance criteria, screens, navigation, automations, error states, test plan, deployment |
| `docs/09-operating-manual.md` | Daily/weekly/monthly operating loops + incident playbooks |
| `docs/10-regulatory-research.md` | Regulatory research (2026-07), model selection, product lanes, state posture, launch checklist |
| `db/schema.sql` | PostgreSQL 15+/Supabase DDL — validated against Postgres 16 (applies clean) |
| `db/seed.sql` | Seed data exercising every queue and gate — validated (applies clean; audit triggers verified) |
| `db/erd.md` | Mermaid database diagram |

Core invariants, enforced in the schema itself: append-only audit log (triggers reject edits by anyone, including admins); suppression list is delete-proof and opt-outs are permanent; commissions compute only under a signed, counsel-reviewed agreement; approvals require a human approver distinct from the creator; product offerability is allow-list-only by buyer type and state; automation can restrict but never approve, verify, classify, un-suspend, or un-suppress.
