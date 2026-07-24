# Farmhand — Build Handoff & Launch Checklist

> **Upload this whole file into a fresh Dev agent.** It is self-contained: it explains the product, the
> stack, every external tool, the current state of the code, the known gaps, and the exact checklist to
> finish the build to launch. Read it top to bottom before touching code.

---

## 0. Your mission (read first)

Farmhand is a working, deployed Next.js app. It is **~85% of the way to a sellable, founder-operated
service**. Your job is to close the remaining gaps in the right order so the founder can charge real
money and, later, scale past a hand-run pilot. Do **not** rebuild what exists. Verify, harden, and
extend along the plan below.

**Non-negotiable working agreement:**
1. After every change run **both** `npx tsc --noEmit` and `npm run build` — both must exit clean before you commit. This app has a history of runtime crashes from unchecked persisted state; the build gate is how we stay safe.
2. **Client-isolation is the prime invariant.** One operator services many client accounts from one browser. Client A's data must NEVER surface under Client B — not in state, not in a vault, not in a meter, not in a cloud row. Any new persistence you add MUST be namespaced by the active client id. (See §5.)
3. **Never leak native provider credits/costs into the UI.** All money shown to the operator is a Farmhand-internal estimate (see `lib/meter.ts`). Never surface Higgsfield/Perplexity/Gemini raw credit numbers.
4. Small commits, descriptive messages, push to the working branch. Don't open a PR unless asked.

---

## 1. Product & business context

**What it is:** a done-with-you content + lead-generation service for local operators (solar installers
first, realtors second). The founder runs it as a service: onboard a client, and each week produce their
social posts (copy + AI imagery), surface local conversations worth joining (leads), and hand them a
clean weekly packet. The app is the operator's cockpit for delivering that.

**Beachhead vertical:** solar (Arizona). Realtor is the secondary/test vertical. The app is vertical-aware
(`lib/verticals.ts`, `lib/strategy.ts`).

**Business model:** founder-operated service, per-client monthly retainer. Gross margin depends on keeping
generation cost (images/reels/copy) low per client — hence the cost meter is a first-class feature, not a
nice-to-have.

**Revenue-critical loop (the "First-Revenue Slice", now built):**
1. Operator adds a client account (isolated).
2. Operator generates the week's posts + imagery, and reviews surfaced leads.
3. Cost is metered per client against a monthly allowance (margin guard).
4. Operator exports a branded **Monday packet** and sends it to the client.

---

## 2. Repo, stack, how to run

- **Repo root:** `/home/user/coyote-and-company` · **App dir:** `farmhand/` · **Working branch:** `claude/app-performance-max-h8tgoc`.
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript 5.7. Tailwind v4. Deployed on **Vercel**.
- **3D/anim:** three.js, gsap. **Canvas export:** html2canvas. **Blob storage:** `@vercel/blob`.
- **State:** a single React context store (`lib/store.tsx`) persisted to **localStorage**; heavy binary assets in **IndexedDB**. Optional server sync via **Supabase** and a lead cache via **Upstash Redis KV** — both inert until env vars are set.

**Commands (run from `farmhand/`):**
```bash
npm install
npm run dev            # local dev
npx tsc --noEmit       # typecheck — MUST be clean
npm run build          # production build — MUST be clean
npm run lint
```

**Verify state after changes:** there is no test suite yet (see checklist). The verification gate today is
tsc + build + manual click-through. Adding a smoke test is on the list.

---

## 3. Architecture map

### Client state & persistence (the heart)
- `lib/store.tsx` — the app store: `AppState`, `PERSIST_FIELDS`, hydrate/save effects, **client (workspace) management** (add/switch/rename/remove/export/import), Supabase pull/push wiring, browser-extension lead ingest. **Start here.**
- `lib/clients.ts` — the **client registry** + **lossless client-bundle export/import** + `purgeClient`. Owns `persistKeyFor(id)` and the storage-key naming convention.
- `lib/vault.ts` — **image vault** (IndexedDB, one DB per client via `setVaultClient`/`openDb` choke point). Generated images live here; capped asset library lives in state.
- `lib/reelVault.ts` — **reel-analysis vault** (IndexedDB, same per-client pattern via `setReelVaultClient`).
- `lib/meter.ts` — **per-client generation cost ledger + monthly image allowance** (localStorage). Warn @80%, block @100%.
- `lib/memory.ts` + `lib/memorySync.ts` + `lib/supabase.ts` — optional Supabase "shared memory layer" (contacts/opportunities/posts), namespaced by client id. Inert without env.
- `lib/kv.ts` + `lib/leadStore.ts` — Upstash Redis cache for the **always-on background lead hunt**. ⚠️ **still a single global namespace** — see gaps.

### Domain logic
- `lib/strategy.ts`, `lib/verticals.ts` — profile, vertical config, territories, ideal-client.
- `lib/hunt.ts`, `lib/huntServer.ts`, `lib/redditHunt.ts`, `lib/discover`(route), `lib/signals.ts`, `lib/feeds.ts`, `lib/sources.ts` — the lead engine (search, score, dedup, age-verify).
- `lib/engage.ts`, `lib/pipeline.ts`, `lib/actions.ts` — opportunities → conversations → leads → pipeline.
- `lib/planner.ts` — weekly content plan (`PlannedPost`, days/slots).
- `lib/postVisuals.ts`, `lib/studio.ts`, `lib/consultantLibrary.ts`, `lib/textures.ts`, `lib/desertGrid.ts` — the post/image studio + prompt craft.
- `lib/ideaCopy.ts` — AI copy generation prompts.
- `lib/packet.ts` — the **Monday packet** HTML builder (client-facing deliverable).
- `lib/agentOs.ts`, `lib/azEnergyKb.ts`, `lib/azTerritories.ts` — the in-app "Agentic OS" data model + AZ solar knowledge base.
- `lib/data.ts` — **nav registry (`NAV_DEFS`)** + `TabId` + static screen copy.

### Screens (`components/screens/`) — routed in `components/FarmhandApp.tsx` by `state.tab`
Command Center, Agents (AgentNetwork), Tasks/Schedule/Tools (OsPanels), Connectors, Engage (Lead Pipeline),
Content Analytics (Results/ContentEngine), Content, **PacketExport (Monday Packet)**, TemplateStudio,
ConsultantLibrary, KnowledgeVault, Settings, plus Dashboard/Market/Directory/Planner/Assistant/ReelCoach.
Shell: `components/TopBar.tsx` (active-client pill + switcher), `components/Rail.tsx`, `components/StockPanel.tsx`.

### API routes (`app/api/*/route.ts`)
| Route | Purpose | Provider |
|---|---|---|
| `copy` | AI post copy / "Sharpen" | Perplexity |
| `higgsfield` | AI image gen (start jobs, poll, proxy) | Higgsfield |
| `video-reference` + `/blob-upload` | Reel analysis (upload clip → analyze → delete) | Gemini + Vercel Blob |
| `hunt` + `/selftest` | On-demand lead hunt (stateless) | Reddit / search |
| `cron/hunt` | Always-on background hunt (Vercel Cron) | Reddit / KV |
| `leads` | Read/write background lead pool | Upstash KV |
| `radar` | Browser-extension lead capture bridge | — |
| `discover` | Source/feed discovery | search |
| `memory` | Supabase pull/push snapshot | Supabase |
| `conversations` | Thread/comment checks for engaged leads | Reddit |
| `stock` | Stock photo search | Pexels/Unsplash/Pixabay |

---

## 4. External tools & environment variables

Everything is **degrade-safe**: missing env → that feature no-ops, the app still runs on localStorage.

| Capability | Env vars | Notes |
|---|---|---|
| AI images | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` | primary image cost driver — metered |
| AI copy | `PERPLEXITY_API_KEY` | post copy + sharpen |
| Reel analysis | `GEMINI_API_KEY`, `GEMINI_MODEL` | + Blob upload for the clip |
| Blob storage | `BLOB_READ_WRITE_TOKEN` | temp clip hosting for Gemini |
| Stock photos | `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PIXABAY_API_KEY` | fallback imagery |
| Lead hunt | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | source for conversations |
| Background lead cache | `KV_REST_API_URL`/`TOKEN` or `UPSTASH_REDIS_REST_URL`/`TOKEN` | ⚠️ single-namespace today |
| Cron auth | `CRON_SECRET` | protects `cron/hunt` |
| Shared memory (cloud) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE` | ⚠️ per-client column, keep OFF until §6 gate cleared |
| Build stamp | `VERCEL_GIT_COMMIT_SHA` | display only |

---

## 5. Current state — what's built (and the isolation model)

**Shipped and verified (tsc + build green) on the working branch:**
- **E1 — Operator multi-client mode.** Dynamic client registry; add/switch/rename/remove; active-client pill + switcher on every screen; each client isolated (own app state, image vault, reel vault). Seed accounts `default` (realtor test) + `solar` (real) preserved with original storage keys — no data migration needed.
- **E4 — Cost & usage metering.** Per-client generation ledger, monthly image allowance with 80% warn / 100% block, operator-editable cap, "Generation usage & cost" card in Settings. Enforced at all three image-gen entry points (Composer batch, ConsultantLibrary, StockPanel single).
- **E2-3 — Monday packet.** One-click branded, self-contained, print-to-PDF client deliverable (posts + visuals + hottest conversations + single next move). Pulls only the active client's data.
- **Isolation hardening** (post-audit): memory route preserves real client id (no more "collapse to solar"); pending-batch key, Soul ID namespaced per client; client bundles are lossless (image + reel vaults + meter); `purgeClient` leaves no orphans.

**Isolation matrix (current):**
| Surface | Per-client isolated? |
|---|---|
| App state (localStorage) | ✅ yes (`persistKeyFor`) |
| Image vault (IndexedDB) | ✅ yes |
| Reel vault (IndexedDB) | ✅ yes |
| Cost meter (localStorage) | ✅ yes |
| Pending Higgsfield batch, Soul ID | ✅ yes (post-hardening) |
| Supabase memory (cloud) | ✅ column-isolated in code — **but keep OFF until validated end-to-end** |
| **Server lead store / cron (`lib/leadStore.ts`, KV)** | ❌ **NO — single global namespace. Top gap.** |
| Server of record / auth | ❌ none — all client data lives in one browser |

---

## 6. Known gaps & risks (from the Dev audit)

Full audit: `docs/dev-brief-first-revenue-slice.md`. Ranked:

1. **HIGH — Server lead store is one global namespace.** `lib/leadStore.ts` uses `NS = "fh:default"`; the client id never reaches `/api/leads`, `/api/cron/hunt`. The always-on cron pool bleeds into whatever client is active, and POST overwrites a shared hunt config (last client wins). On-demand `/api/hunt` is fine (stateless, lands in per-client local state). **Keep the cron OFF for multi-client until this is namespaced.**
2. **HIGH — No server of record, no auth.** All paying-client data is in one operator browser (localStorage + IndexedDB). Cleared browser / lost laptop = total loss. Interim seatbelt = the client-bundle export (now lossless). Fine for a disciplined 1–3 client pilot; **required before scale.**
3. **MEDIUM — Cloud sync validation.** The memory route is now per-client in code but has not been exercised end-to-end with >1 real client. Don't flip Supabase on for a paying client until you've verified two clients stay separate in the actual tables (RLS included).
4. **LOW/MEDIUM — polish:** no automated smoke test; onboarding for a brand-new client seeds `name:"Taylor"` briefly until intake overwrites; the pending-batch effect refreshes on switch but the recovery banner UX across switches is untested.

---

## 7. Launch checklist (do in this order)

### Phase A — Safe to run a friendly pilot (1–3 clients), cloud + cron OFF
- [ ] **A1.** Smoke test: a tiny script or Playwright flow that boots the app, adds a client, switches, generates (mock), and exports a packet — so "build green" also means "core loop works". *(no test harness exists yet — establish one)*
- [ ] **A2.** New-client onboarding polish: don't show `Taylor`/solar seed identity before intake; land a new client cleanly on onboarding. (`newClientSeed` in `lib/store.tsx`.)
- [ ] **A3.** Manual QA pass of the isolation matrix with 2 dummy clients: confirm state, image vault, reel vault, meter, Soul ID, pending batch, and packet are all separate. Document results.
- [ ] **A4.** Operator runbook (1 page): how to onboard a client, run the week, read the meter, export + send the packet, and **back up every client weekly** (the export is the only safety net until Phase C).

### Phase B — E2 & E3 (servicing efficiency + client approval)
- [ ] **B1. E2 — One-command weekly run + lead triage.** A single action per client that assembles the week: pull/refresh leads, rank, draft the posts, and stage the packet — target ≤1 hr/client/week. Composes existing per-client reads; add a "Run this week" flow. Safe once isolation holds.
- [ ] **B2. E3 — Client approve/reject share link.** A link the client opens to approve/reject the week's posts. ⚠️ **This forces the server-of-record question** — a public read/write link cannot ride on localStorage. Pair B2 with the first slice of B3.
- [ ] **B3. Server lead-store namespacing (HIGH gap #1).** Thread the active client id into `/api/leads`, `/api/hunt`, `/api/cron/hunt`, `lib/leadStore.ts` (`NS = fh:<clientId>`). Required before turning the cron on for >1 client.

### Phase C — Durability, auth, billing (before real scale)
- [ ] **C1.** Server-authoritative multi-tenant storage: move client state to Supabase tables with **Row-Level Security**, keyed by client id (and eventually operator id). Validate isolation gap #3 here.
- [ ] **C2.** Operator authentication (so the cockpit isn't an open browser tab).
- [ ] **C3.** Validate Supabase per-client sync end-to-end with 2+ clients before relying on it.
- [ ] **C4.** Billing/subscription per client (retainer collection).
- [ ] **C5.** Backups/observability: automated per-client export or DB backups; basic error monitoring.

### Cross-cutting quality (any phase)
- [ ] Establish the automated test harness (A1) and grow it as features land.
- [ ] Keep the tsc + build gate green on every commit.
- [ ] Every new persistence surface namespaced by client id (invariant §0.2).
- [ ] Keep all provider cost out of the UI; route new gen paths through `lib/meter.ts` (record + allowance guard) — mirror how Composer/ConsultantLibrary/StockPanel do it.

---

## 8. How to extend common things (quick reference)
- **Add a screen:** add to `NAV_DEFS` in `lib/data.ts`, add a `case` in `components/FarmhandApp.tsx`, create `components/screens/<Name>.tsx` (`"use client"`, read `useStore()`).
- **Read/write app state:** `const { state, set, workspace } = useStore();` — `workspace` is the active client id.
- **New generation path:** guard with `imageAllowance(workspace, need).blocked` before spend, then `record(workspace, "image"|"reel"|"copy", n)` after success (`lib/meter.ts`).
- **New per-client storage:** localStorage → derive a key with the `id === "default" ? base : `${base}::${id}`` convention (see `persistKeyFor`); IndexedDB → mirror the `setVaultClient`/`openDb(client)` choke-point pattern in `lib/vault.ts`.
- **Add to the client bundle:** update `ClientBundle` + `exportClientBundle`/`importClientBundle`/`purgeClient` in `lib/clients.ts` (keep it lossless).

---

*Generated as a build handoff. The commit history on the working branch is the source of truth for what
shipped; `docs/dev-brief-first-revenue-slice.md` is the detailed audit behind §6.*
