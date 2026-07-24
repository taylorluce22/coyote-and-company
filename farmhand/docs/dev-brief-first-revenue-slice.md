# Dev Brief — First-Revenue Slice (E1 + E4 + E2-3)

_Independent engineering audit of `claude/app-performance-max-h8tgoc` @ commits `1925609`, `17dfda6`, `0638b8d`. Review only — no app code changed._

## Verdict

**Fix-first (small), then pilot.** The client-isolation model for **browser-local** surfaces (app state, image vault, reel vault, meter) is sound and the code is clean. But **two server surfaces silently commingle every client** (Supabase memory sync and the always-on lead store), and one live image-generation path bypasses the margin meter. A 1–3 friendly-client pilot is safe **only if cloud sync and the always-on cron stay OFF** and a few cheap browser-side bleeds are closed first. Do **not** enable any cloud/server feature for multi-client until the server layer is namespaced.

## Build status

- `npx tsc --noEmit` → **exit 0** (clean).
- `npm run build` (Next 15.5.20) → **exit 0**, 14/14 routes, no type errors.

## Findings (most severe first)

| # | Sev | Issue | Location | One-line fix |
|---|-----|-------|----------|--------------|
| 1 | **Blocker** (if cloud on) | Memory sync clamps **every** non-`default` client to `"solar"` — all real clients commingle contacts/opportunities/posts in one bucket, and with each other. Store sends the real client id; server throws it away. | `lib/memory.ts:18` (`ws()`), `app/api/memory/route.ts:19` (`clean()`) | Thread the real client id into the `workspace` column (sanitize, don't clamp to a 2-value enum). Keep sync OFF until fixed. |
| 2 | **High** | Server lead store is single global namespace `fh:default`. `/api/leads` GET injects the global background-lead pool into whatever client is active; POST overwrites the global hunt config (last client wins). Client id never reaches the server. | `lib/leadStore.ts:11`, `components/screens/Engage.tsx:120,139`, `app/api/cron/hunt/route.ts:42` | Namespace `leadStore` by client id passed from the app; keep the always-on cron OFF for multi-client until then. (On-demand `/api/hunt` is fine — it's stateless and lands in per-client local state.) |
| 3 | **High** | No server of record, no auth: **all** paying-client data lives in one operator browser's localStorage + IndexedDB. A cleared browser / lost laptop = total loss for every client. | architecture | Fine for a friendly pilot with disciplined exports; **required** to fix (multi-tenant tables + RLS + auth) before real scale. |
| 4 | **High** | StockPanel single-image "AI Generate" bypasses **both** the meter and the allowance cap — vaults a paid image with no `meterRecord` and no `imageAllowance` check. Margin guardrail has a hole; usage undercounts. | `components/StockPanel.tsx:198` (`save`), `:177` (`generate`) | Add `imageAllowance(workspace,1).blocked` guard before `generate()` and `meterRecord(workspace,"image",1)` in `save()`. |
| 5 | **Medium** | Export/import is **lossy**: bundle carries app state + image vault only — **not** the reel vault, **not** the meter ledger/cap. Restore loses reels + usage history. This is the "backup story" they're selling as critical. | `lib/clients.ts:83` (`exportClientBundle`) | Include reel-vault dump + meter keys in the bundle; restore them in `importClientBundle`. |
| 6 | **Medium** | `fh-hf-pending` recovery key is **global**. Start a batch for client A, switch to B, hit ⟳ Recover → A's paid images land in B's vault (module-global `activeClient`) and meter against B. | `components/screens/Composer.tsx:64` | Namespace the pending key per client (or clear/guard on switch). |
| 7 | **Medium** | `fh-soul-id` is **global**. The Higgsfield Soul (a consultant's face/identity) is shared across all clients — client B's consultant photos render with client A's soul. | `components/screens/ConsultantLibrary.tsx:18` | Namespace the soul id per client. |
| 8 | **Medium** | `removeClient` orphans storage: `purgeClient` drops app-state + image-vault DB but **not** the reel-vault DB or `farmhand-meter::`/cap keys. Leak, not a bleed. | `lib/clients.ts:114` (`purgeClient`) | Also delete the reel-vault DB and the two meter keys. |
| 9 | **Low-Med** | Meter records against a **stale** workspace if the operator switches clients mid-batch: `meterRecord(workspace,...)` closes over render-time `workspace` while `vaultAdd` writes the module-global `activeClient`. Image lands in new client's vault, counts against old client. Edge case. | `Composer.tsx:489`, `ConsultantLibrary.tsx:75` | Read active client from a single source at record time, or block switching during an in-flight batch. |
| 10 | **Low** | `fh-visual-log` anti-repetition log is global — purely cosmetic aesthetic rotation shared across clients. | `lib/postVisuals.ts:93` | Namespace per client (cosmetic, defer). |
| 11 | **Low** | `useRefreshOnClient` calls `setState` during render. Legal "derived-from-props" pattern, ref-guarded so no loop, but discouraged and can double-fire under StrictMode. | `components/screens/Settings.tsx:200` | Move to `useEffect([client])`. |
| 12 | **Low** | Allowance block is client-side only — a second tab or the StockPanel path bypasses it. Acceptable per meter.ts's own "server-authoritative is later-era" note. | `lib/meter.ts` | Defer to server-meter epoch. |

**Metering that IS correct:** Composer batch + ConsultantLibrary record exactly once (after `vaultAdd`, pruned from the pending list so re-polls don't double-count), and the allowance block is **pre-spend** (checks `used + need > cap` before starting the batch). The hole is only the StockPanel path (#4).

## Isolation matrix

| Surface | Per-client isolated? | Note |
|---|---|---|
| App state (localStorage) | **Yes** | `persistKeyFor` — `default` keeps original key, others suffixed. |
| Image vault (IndexedDB) | **Yes** | `dbNameFor` choke point in `openDb`. |
| Reel vault (IndexedDB) | **Partial** | Isolated for read/write, but not purged on remove (#8) and not in backup (#5). |
| Meter ledger (localStorage) | **Yes** (isolated) / **Partial** (lifecycle) | Per-client keys; not purged on remove (#8). |
| Supabase memory sync | **No** | Clamped to `default`/`solar`; all other clients commingle in `solar` (#1). |
| Server lead store | **No** | Single global `fh:default` namespace (#2). |
| Soul id (`fh-soul-id`) | **No** | Global (#7). |
| Pending recovery (`fh-hf-pending`) | **No** | Global — recovery bleed (#6). |
| Visual log (`fh-visual-log`) | **No** | Global, cosmetic only (#10). |

## Launch sequence recommendation

The plan's "E2 → E3 → later hardening" order is **mostly right, but the server bleeds must jump the queue if any cloud feature is turned on**, and E3 cannot ship on top of browser-only state. Recommended order:

1. **Close the live browser-side bleeds (before onboarding client #2).** Small, same-day fixes that make "Client A never surfaces under Client B" true on paths that are live today: StockPanel meter bypass (#4), `fh-hf-pending` (#6), `fh-soul-id` (#7), and make export/import lossless + `purgeClient` complete (#5, #8). Do these before the next commit.
2. **Namespace the server layer by real client id (before enabling ANY cloud feature):** memory route (#1) and lead store (#2). Keep Supabase sync and the always-on cron **off** for multi-client until this lands — today they are the single largest isolation risk.
3. **Then E2 (one-command weekly run + lead triage).** This is the value that gets servicing to ≤1 hr/client/week, and it mostly composes existing per-client reads, so it's safe once (1) and (2) are closed.
4. **Then E3 (client approve/reject share link) — but pair it with the first slice of server-authoritative storage.** A public share link that reads/writes cannot sit on one operator's browser-local state; it forces the durability + auth question. Don't bolt a link onto localStorage.
5. **Durability + auth + billing (server of record, multi-tenant tables with RLS, operator auth).** Required before real scale / before charging beyond friendly pilots. Export/import is the interim seatbelt, not a substitute — and it's currently lossy (#5).

**"Good enough for a founder-operated pilot with 1–3 friendly clients":** items 1–8 in the finding table closed (or the relevant cloud features left off), disciplined manual exports as backup, cloud sync and cron hunt disabled. **"Required before real scale":** #1, #2, #3 fully resolved with a server of record, auth, and per-tenant RLS.

## Sign-off

**Fix before the next commit:** #4 (StockPanel meter+cap bypass), #6 (`fh-hf-pending`), #7 (`fh-soul-id`), #5 (lossless backup), #8 (complete purge). All are small and close real cross-client bleeds/leaks on live paths.

**Fix before enabling any cloud/server feature (gate, not optional):** #1 (memory namespace), #2 (lead-store namespace). Until then, keep Supabase sync + always-on cron OFF.

**Defer (acceptable for pilot):** #9 (mid-batch switch), #10 (visual log), #11 (setState-in-render), #12 (client-side-only cap). Track #3 (durability/auth) as the gate for scale, not pilot.
