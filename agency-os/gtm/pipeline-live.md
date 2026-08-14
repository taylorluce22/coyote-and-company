# Live Pipeline — from actual Gmail state

Updated 2026-08-10 (Mon) from taylor@sonoranclinicalpartners.com. **Standing rule (refined 8/10): all meetings are phone calls, but email copy never mentions phone vs. video — schedule normally in email; the preference is expressed only in the calendar invite (Google Calendar invite with a phone-call location, no Meet link).** This file is the working tracker until the CRM backend exists; the daily routine keeps it current.

**Status is computed, not remembered — see `reply-triage-rules.md`.** Conversation state is per counterparty across all threads (last inbound vs. last delivered outbound), never per Gmail thread, because recaps start new subjects. Machine mail (calendar accepts, Bookings confirmations, bounces, auto-acks) never sets state.

> ⚠️ **BLIND SINCE 8/10 21:15 UTC — four consecutive scheduled runs with no Gmail** (Tue 8/11 13:41, Wed 8/12 13:37, Thu 8/13 13:33, Fri 8/14 13:38 UTC). No mailbox read, no state recomputed, no drafts created on any of them. **Everything below is the 8/10 21:15 UTC snapshot — now ~88 hours old. Treat it as history, not status.** The entire operating week after Monday night is unobserved.
>
> **Costs so far are real, not cosmetic:** Belmar's day-3 came due 8/13 and no draft was created (now day-4 overdue). Two calls happened inside the blind window with no outcome logged. Nothing here reflects a decision by Taylor or a judgment by the agent — it is purely the missing connector.
>
> The pattern is structural: unattended fires of this routine do not carry Gmail, so this file cannot self-correct. Re-create the routine from the claude.ai Routines UI with the connector attached, or run the check interactively — an interactive session has Gmail and recomputes in about a minute. Until then, prefer the reconciliation list below over anything else on this page.

## Reconciliation queue — run these the moment Gmail is available

Everything unobserved since 8/10 21:15 UTC, as checkable items. Per `reply-triage-rules.md`, each counterparty needs BOTH searches (`from:{domain} newer_than:30d` and `in:sent to:{domain} newer_than:30d`) with timestamps compared — machine mail sets nothing.

| # | Check | Why it's open |
|---|---|---|
| 1 | **Assure Infusions** — did the Wed 8/12 10 AM MST call happen, and what came of it? | Call fell inside the blind window; no outcome recorded anywhere |
| 2 | **Globyz/NexGen** — did the Thu 8/13 10:25 AM MST call happen? | Same; confirmed via Bookings 8/10, never re-verified |
| 3 | **STASKA / Nick Shada** — did he pick a Thu or Fri slot? | Times sent 8/10 21:01; any reply landed in the blind window. Fri 8/14 was the fallback slot — today |
| 4 | **Belmar / Rob Kilgore** — any reply, and is the day-3 follow-up still unsent? | Never replied as of 8/10; follow-up due 8/13, undrafted |
| 5 | **The 39 A2 drafts** — sent, partially sent, or untouched? | Drafted 8/10, unsent then. Cadence for A3 (day 7) starts from actual sends, so it can't be computed until this is known |
| 6 | **AZ / OH / TN boards** — any guidance response? | Letters out 8/8; answers get recorded against the RC register in `docs/00-decision-table.md` |
| 7 | **ProRx / Dave Dugas** — back from travel ~8/17; anything early? | Ball was with them at 8/8 22:03 recap |
| 8 | **Any bounce or opt-out across all of the above** | An opt-out is honored immediately and permanently; a bounce means UNDELIVERED and needs a new route, not a wait |

Frier Levitt stays MUTED throughout — not checked, not drafted, not nudged.

## Active supplier conversations

| Supplier | Contact | Status | Last touch | Next action |
|---|---|---|---|---|
| **Assure Infusions** (assureiv.com) | Andrea Caudill, Dir. of Business Development | 🟢 **Call confirmed: Wed Aug 12, 10:00–11:00 AM MST** (invite accepted 8/5) | 8/4 you → invite sent | **Prep brief ready: `call-brief-assure-infusions.md`** (FL-based IV-fluids 503B, registered 11/2024, never FDA-inspected as of 6/2025 — inspection question leads) |
| **ProRx Pharma** (Exton PA — location corrected 8/10; affiliated BoomRx portal) | Dave Dugas, VP Sales (904-945-1844) + Mark | 🟡 **Ball with them.** Call held 8/7; your recap sent 8/8 22:03 — **3% of gross on introduced customers, no intro fee**. Dave out of country week of 8/10, on email | 8/8 you → recap (new thread, not a reply in Dave's) | Follow up when Dave returns (~8/17). Compliance facts below — FYI, not a gate |
| **STASKA Pharmaceuticals** | Nick Shada | 🟢 **Ball with them.** Wants the call; times sent 8/10 21:01 | 8/10 you → times | Await Nick's pick. **Prep brief ready: `call-brief-staska.md`** (Class I recall 9/2024 + WL 5/2025, close-out unverified — remediation questions lead) |
| **Belmar Pharma Solutions** | Rob Kilgore, CEO (direct) | 🟡 **No reply yet** — no inbound from Rob at any point. Follow-up sent 8/10 21:01 (first email 8/6, after belmarselect@ bounced) | 8/10 you → rob@ | Day-3 clock restarts 8/10; next touch due 8/13 |
| **Globyz Pharma / Nexgen Formulations** (Folcroft PA) | Salman Pathan, CEO (sal@globyz.com) | 🟢 Replied 8/6 to the batch send; **call set: Thu Aug 13, 1:25 PM ET / 10:25 AM MST** (rescheduled from 8/10 via Microsoft Bookings) | 8/6 → reply received | **Prep brief ready: `call-brief-globyz-nexgen.md`** — registration RESOLVED (registered 503B 1/15/2026, never inspected). Schedule conflict RESOLVED 8/10: the AOS digest predated the ~9:15 AM reschedule; **Thursday 8/13 1:25 PM ET / 10:25 AM MST confirmed** (single Bookings ID = moved not duplicated; Monday calendar empty). Thursday confirm **sent 8/10 21:01** (bare confirm, no phone-vs-video language). Bookings re-confirmation arrived 8/10 16:20 UTC — machine mail, no reply owed |

## Counsel & regulatory

| Item | Status | Next |
|---|---|---|
| **Counsel — pivot 8/10** | Taylor withdrew the Frier Levitt nudge draft (trashed). **Tue 8/11 Frier Levitt slot: unconfirmed, likely off — do NOT nudge Denise/the thread.** New path: personal referral — a retired lawyer in Taylor's network will connect him to counsel | Taylor works the referral. Whoever engages: they see the ProRx recap + the three board letters first, before advising. Agenda `counsel-call-agenda.md` carries over to whichever counsel it ends up being |
| **AZ Board of Pharmacy** (K. Gandhi) | Guidance letter sent 8/8 — virtual wholesaler/broker classification | Await; nudge in 2 weeks if silent |
| **Ohio Board of Pharmacy** | Guidance letter sent 8/8 — broker classification, OAC 4729:6-1-01(G) | Await |
| **Tennessee Board of Pharmacy** | Guidance letter sent 8/8 — non-handling intermediary licensure | Await |

These three letters are exactly the verification path from `docs/10-regulatory-research.md` §6 — executed. Answers get recorded against the RC register when they arrive.

## 8/5 batch — full accounting (reconstructed from sent mail 8/10)

**The earlier version of this section listed 10 recipients. Sent mail shows 45.** The tracker was undercounting the batch by roughly three quarters, so most of it had no follow-up scheduled at all. Reconstructed from `in:sent after:2026/08/04 before:2026/08/07`:

| Outcome | Count | Who |
|---|---|---|
| Human reply | 3 | ProRx (info@ → Mark, then Dave), NexGen/Globyz (sal@), Assure (from the 8/3 send) |
| Auto-acknowledgement only | 2 | Olympia (customerservice@ replied to the clientservices@ send), GenoGenix (help@) — machine mail, day-3 clock kept running |
| Bounced | 3 | belmarselect@belmarpharma.com (superseded by rob@), pharmacistconsult@carieboyd.com (orders@ delivered fine), ernestos@pharmaceuticlabs.com (Galaxy — permanent failure 8/8, route dead, needs the web form) |
| No reply | 39 | everyone below |

**A2 follow-ups drafted 8/10 for all 39 non-responders** — threaded replies on the original messages, day-3 diligence angle per `outreach-templates.md`, no phone-vs-video language, postal footer plus reply-based opt-out. In Taylor's drafts folder, unsent, and mirrored into the OS at **`/agency/outreach`** (one-click open-in-Gmail per row, status tracked; activation steps in `farmhand/docs/agency-outreach-activation.md`):

Orion Specialty Labs · BPI Labs · GFC Pharma · Apertus · OurPharma · SCA Pharmaceuticals · Fagron Sterile Services · PQ Pharmacy · PGRrx · Olympia (ocs@) · Ocyon Bio · Wilcrest · Wesley Pharmaceuticals · Wells Pharmacy (wellsrx) · Wells Pharma (wellspharmatx) · US Specialty Formulations · Turbare · Medivant Health · STAQ Pharma · SKNV · RC Outsourcing · QuVa Pharma · OSRX · Nephron · Navinta · Medi-Fare Drug · Cost Plus · IntegraDose · ImprimisRx · Hybrid Pharma · GenoGenix · FarmaKeio · Empower · Leiters · CAPS · Brookfield Medical · Carie Boyd (orders@) · Apollo Care · New Life Rx

**Regulatory status FYI on this batch** (facts only, not a gate): GenoGenix — WL 1/2026, peptide-centric; Apollo Care — WL 2/2026; Carie Boyd — WL 12/2024; CAPS/Leiters/Empower — GPO-channel nationals with in-house sales. Every non-responder got a draft; who actually gets sent is Taylor's call. The prior instruction here — "A2s to the four cleared batch targets" — was gating by the agent's own risk read, which the compliance charter forbids; it's removed.

**Deliverability fact (not advice):** sonoranclinicalpartners.com is a new sending domain — 45 sends on 8/5 and 39 more in one pass is the volume pattern spam filters score on. Spacing the sends over a few days reduces that signal. Taylor's call.

## ProRx — compliance facts (decision is Taylor's)

- Verification complete — see `prorx-verification.md`. Both WLs confirmed (12/20/2024 amended 3/4/2025; 4/7/2026 after reinspection), Class II semaglutide/tirzepatide recall 10/2025 confirmed, no close-out letters found. Location corrected to Exton PA. FDA's 2026 letter cites post-eligibility tirzepatide production — overlaps the product categories SCP's own draft agreement §6(c) excludes from marketing. Contact note: 'Dave Dugas' unverifiable publicly; 'Mark' likely Mark Mousseau, VP Strategic Partnerships (BoomRx).
- A warning letter is not a legal prohibition. Nothing in law prevents introducing buyers to ProRx.
- Accuracy constraint (this part is law, not advice): buyer-facing copy currently says facilities are "vetted for state licensure, inspection history, and insurance." Statements made to buyers must be true as applied to any facility introduced — false B2B representations are reachable under FTC Act §5 and state UDAP statutes. What "vetted" means for a given facility, and what is said about it, is Taylor's call; the words used must match the facts.
- Civil-exposure allocation for supplier-caused harm lives in the indemnification section of the draft agreement.
- Terms on the table: 3% of collected revenue, no meeting fee (pay-on-performance model; benchmarks in `pricing-benchmarks.md` for reference).

## This week

| Day | Item |
|---|---|
| **Mon 8/10** | ✅ STASKA times, Belmar follow-up, Globyz Thursday confirm — **all three sent 21:01 UTC** · ✅ A2 follow-ups drafted for all 39 batch non-responders (in drafts, Taylor sends) · ⬜ start the counsel referral (retired-lawyer contact) |
| **Tue 8/11** | ~~Frier Levitt call~~ — slot unconfirmed/likely off after the counsel pivot; no nudge (MUTED). Day is open unless the referral moves fast. Routine ran 13:41 UTC without Gmail — nothing recomputed, no drafts created. Nothing was due today by cadence: Belmar day-3 lands 8/13, and the 39 A2s are drafted-but-unsent so no A3 clock has started |
| **Wed 8/12** | **Assure Infusions call, 10 AM MST / 17:00 UTC — TODAY.** Brief ready: `call-brief-assure-infusions.md` (Bartow FL IV-fluids/503B hybrid, registered 11/22/2024, never FDA-inspected as of 6/2025 — inspection question leads; Andrea Caudill's title verified, Alex Lucio CEO). Confirmed 8/4 in-thread; **not re-verified since 8/10 21:15 — a reschedule sent after that is not visible to this file** |
| **Thu 8/13** | **Globyz/NexGen call, 10:25 AM MST / 17:25 UTC — TODAY.** Brief: `call-brief-globyz-nexgen.md` (NexGen registered 503B 1/15/2026, never FDA-inspected; registration under NexGen not Globyz — that's the opening question). Confirmed 8/10 via Bookings; **not re-verified since — a reschedule after Mon night is invisible** · STASKA if Nick picked a Thu slot: unknown, his reply would have arrived during the blind window · **Belmar day-3 follow-up due today — draft NOT created (no Gmail this run)** |
| **Fri 8/14** | STASKA fallback slot (morning) — unknown whether Nick took it · **Week closes unlogged.** Assure 8/12 and Globyz 8/13 outcomes both unrecorded, Belmar day-3 undrafted since 8/13. See the reconciliation queue above — that list, not this table, is the accurate picture of the week |
