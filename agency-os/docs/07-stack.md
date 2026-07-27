# Phase 7 — Technology Recommendation

## Comparison

| Option | Fit for this system | Verdict |
|---|---|---|
| **Airtable** | Fastest CRUD + Interfaces + views for one founder; automations adequate for reminders. Weaknesses: no true row-level security for external users, weak audit immutability, 50k-record ceilings | **MVP core** (internal only; suppliers do NOT get logins) |
| SmartSuite | Similar to Airtable, better permissions granularity, smaller ecosystem/fewer integrations | Pass — ecosystem risk outweighs the permission edge |
| **Supabase** | Real Postgres + RLS + Auth + storage; enforces the permission model at the data layer; supplier portal becomes safe | **Scale core** |
| PostgreSQL (self-managed) | Same engine without auth/storage/hosting conveniences | Only inside Supabase — don't self-host at this size |
| **Retool** | Internal admin panels over Postgres in hours | Scale stack internal UI |
| **Next.js** | Needed only for the external supplier portal (custom auth'd UX) | Scale stack, portal only |
| **n8n** | Self-hostable workflow engine, versionable, cheap at volume | Scale stack automations |
| **Make** | Cheaper/more capable than Zapier per operation; good webhook handling | **MVP automations** |
| Zapier | Easiest but priciest per task; fine but strictly dominated by Make here | Pass |
| **Instantly (or Smartlead)** | Sending infra, warm-up, inbox rotation, opt-out handling | **MVP + scale sending**. Config constraint: brand-real domains, real identity, our suppression synced both ways (decision C6) |
| Email verification (NeverBounce / ZeroBounce / MillionVerifier) | Commodity API | MillionVerifier or NeverBounce PAYG |
| License-verification sources | NPPES NPI Registry API (free), state board of pharmacy verification portals, state medical board lookups, FDA drug establishment/registration DBs, FDA enforcement reports (recalls). DEA registration has no free public API — obtain DEA certificate copies from the counterparty and verify expiration | Links stored per license type; **verification act stays human (WF7)** |
| Document storage | Google Drive (MVP; structured folders, hash recorded in DB) → Supabase Storage (scale) | Both |
| Accounting | QuickBooks Online; commission invoices to suppliers issued from QBO; monthly close reconciles QBO ↔ system | MVP + scale |

## Chosen stacks

**MVP (months 0–6, internal-only):** Airtable (all tables from Phase 1, names/fields mirrored 1:1 with the Postgres DDL) + Airtable Interfaces (dashboard, queues) + Make (reminders, gate-sweep checks, webhooks from Instantly/Cal.com) + Instantly + MillionVerifier + Cal.com (free) + Google Drive + Dropbox Sign (attestations/contracts) + QuickBooks Online.
MVP concessions, stated honestly: suppliers interact by email/forms, not logins (Airtable can't safely row-scope external users); gate enforcement lives in Make scenarios + interface design rather than the DB, so the founder is the last gate — acceptable only while headcount = 1 and volumes are low; audit log is an Airtable table written by automations plus Airtable's revision history (not truly immutable — noted as a known MVP limitation).

**Scalable stack (from month ~6 or >2 seats/supplier-portal need):** Supabase (Postgres + RLS + Auth + Storage, `db/schema.sql` applies as-is) + Retool (internal ops UI + dashboard) + Next.js on Vercel (supplier portal only) + n8n (automations) + Instantly + QBO. Audit log becomes trigger-written and append-only at the DB layer; all six roles enforced by RLS.

**Migration path:** identical table/field/enum names from day one → CSV export from Airtable → import scripts into Postgres (schema is already written) → re-point Make scenarios to n8n one at a time (Make and n8n run in parallel during cutover) → decommission Airtable. Documents move from Drive to Supabase Storage with hashes re-verified against the recorded sha256. Trigger for migration: first supplier portal user, second internal seat, or 20k records — whichever comes first.

**Estimated monthly cost:** MVP ≈ **$180–260**: Airtable Team $24, Make Core $18, Instantly $37–97, MillionVerifier ~$10 PAYG, Google Workspace $14, Dropbox Sign $20, QBO $38, Cal.com $0, domains ~$10. Scale ≈ **$380–560**: Supabase Pro $25, Retool $10–50/seat, Vercel $20, n8n cloud $24 (or $0 self-hosted), plus the same sending/verification/QBO/sign costs at higher tiers.

**Must NOT be custom built initially:** email sending/warm-up/deliverability, email verification, e-signature, calendaring/booking, accounting/invoicing, document storage, license-registry scrapers (use official portals manually — scraping boards is brittle and some prohibit it), and any AI copy generation for outbound (G10). Custom build is reserved for: the gate engine, the schema, and (at scale) the supplier portal — the three things that ARE the business.
