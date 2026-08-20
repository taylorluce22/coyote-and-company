# Live Pipeline — from actual Gmail state

Updated 2026-08-10 (Mon) from taylor@sonoranclinicalpartners.com. **Standing rule (refined 8/10): all meetings are phone calls, but email copy never mentions phone vs. video — schedule normally in email; the preference is expressed only in the calendar invite (Google Calendar invite with a phone-call location, no Meet link).** This file is the working tracker until the CRM backend exists; the daily routine keeps it current.

**Status is computed, not remembered — see `reply-triage-rules.md`.** Conversation state is per counterparty across all threads (last inbound vs. last delivered outbound), never per Gmail thread, because recaps start new subjects. Machine mail (calendar accepts, Bookings confirmations, bounces, auto-acks) never sets state.

> ⚠️ **Thu 8/20 13:32 UTC — eighth consecutive scheduled fire without Gmail** (8/11–8/14, 8/17–8/20). Last verified state is Fri 8/14 ~14:00 UTC, **~143 hours / 6 days old**. Every accurate update this file has ever received came from an interactive session; the schedule has never once succeeded.
>
> **Nothing new fell due today. The overdue set is unchanged in composition and one day older, still undraftable:**
>
> | Item | Basis | Days overdue |
> |---|---|---|
> | **ProRx follow-up** | Dave Dugas due back ~8/17 | 3 |
> | **Belmar A3 (day 7)** | Sent 8/10 21:01; day-3 also missed on 8/13 | 3 (day-3 leg: 7) |
> | **STASKA A3 (day 7)** | Times sent 8/10 21:01, no answer since | 3 |
>
> **Two conversations have been waiting on Taylor since Thursday 8/13 — now a full week**, per the 8/14 computation: **Medivant** (missed meeting with a four-person group; reschedule draft staged 8/14, unknown whether sent) and **Globyz/Ahmed** (tirzepatide sourcing request, no draft by design — see the Globyz section). Whether either moved is unobservable.
>
> **Date correction (found 8/20):** earlier entries called the board nudge "Fri 8/22." **8/22 is a Saturday** — the 8/8 letters also went out on a Saturday, so the clean two-week mark lands on a weekend. On business days the nudge is **Fri 8/21 (tomorrow) or Mon 8/24**; which one is Taylor's call. On current form it goes undrafted either way.
>
> <details><summary>Historical: recompute of Fri 8/14, and the four blind runs before it</summary>
>
> ✅ **RECOMPUTED Fri 8/14 ~14:00 UTC with Gmail restored.** The blind window was closed; the reconciliation queue below was worked through and folded into the rows above. Two items came back as **YOUR MOVE** (Medivant, Globyz) and the 39 A2 drafts were confirmed **unsent**.
>
> <details><summary>Historical: the four blind runs</summary>
>
> ⚠️ **BLIND 8/10 21:15 → 8/14 — four consecutive scheduled runs with no Gmail** (Tue 8/11 13:41, Wed 8/12 13:37, Thu 8/13 13:33, Fri 8/14 13:38 UTC). No mailbox read, no state recomputed, no drafts created on any of them. **Everything below is the 8/10 21:15 UTC snapshot — now ~88 hours old. Treat it as history, not status.** The entire operating week after Monday night is unobserved.
>
> **Costs so far are real, not cosmetic:** Belmar's day-3 came due 8/13 and no draft was created (now day-4 overdue). Two calls happened inside the blind window with no outcome logged. Nothing here reflects a decision by Taylor or a judgment by the agent — it is purely the missing connector.
>
> The pattern is structural: unattended fires of this routine do not carry Gmail. Re-create the routine from the claude.ai Routines UI with the connector attached, or run the check interactively.
>
> </details>
>
> **Eight for eight.** The scheduled routine has produced zero verified checks since it was created. Until the Gmail connector is attached in the Routines UI, the schedule is a reminder that a check is due, not a check.

## Reconciliation — worked 8/14, results

| # | Check | Result |
|---|---|---|
| 1 | Assure — did the 8/12 call happen? | **No trace in mail either way.** No message from acaudill@ since 8/5, none from Taylor since 8/4 22:16. The call was accepted on the calendar and nothing contradicts it; whether it was held is not determinable from email |
| 2 | Globyz — did the 8/13 call happen? | **Yes.** See the Globyz section below — Ahmed Saeed-Khan's 8/13 23:00 follow-up says "nice speaking to you" |
| 3 | STASKA / Nick Shada | **No reply.** Nothing inbound since 8/6 21:14; Taylor's times went 8/10 21:01. Ball with them, day-4 |
| 4 | Belmar / Rob Kilgore | **No reply, ever.** Last outbound 8/10 21:01. Day-3 came due 8/13 — draft still owed |
| 5 | The 39 A2 drafts | **All 39 unsent**, sitting in drafts, timestamped 8/10 22:20–22:22 UTC. No A3 clock has started |
| 6 | AZ / OH / TN boards | **No response** from any of the three |
| 7 | ProRx / Dave Dugas | **Nothing new.** Ball with them since the 8/8 22:03 recap; he was due back ~8/17 |
| 8 | Bounces / opt-outs | **None new** |

Also found, not on the list: **Medivant Health** ran a scheduled meeting on 8/13 that isn't recorded anywhere in this tracker, and two deliverability test sends went out 8/13 22:55 to `test.mailpool.io` and `apollomailtester.com` (Apollo tooling — machine mail, not counterparties).

Frier Levitt: MUTED, not checked, not drafted, not nudged.

## Medivant Health — live, and waiting on Taylor

**State: YOUR MOVE since 8/13 21:11 UTC (~41 hours).** Last inbound is Jessica Kientz's message; nothing outbound since 21:07.

What happened, from the thread: Jessica Kientz (Administrative Assistant, +1 480-956-5484) wrote at 21:03 asking if Taylor was joining "the meeting we have scheduled today," cc'ing R.Dave@, jbowley@ and klatusek@medivanthealth.com. Taylor replied at 21:05 that he couldn't join — technical trouble — and offered his number at 21:07. Jessica sent a Teams invite at 21:11. The thread ends there.

**A follow-up draft is staged** (reschedule, asks for windows next week, no phone-vs-video language per the standing rule).

**Conflict with the batch queue — worth catching before any bulk send:** Medivant is also row 18 of the 39 queued A2 drafts, addressed to `customerservice@medivanthealth.com`. That draft is now wrong: it treats a live, named, multi-person conversation as a cold non-responder. It should be skipped or rewritten before the queue goes out.

## Globyz/NexGen — call held 8/13; they asked Taylor to source tirzepatide

The call happened. **Ahmed Saeed-Khan** (Business Development Director / Special Projects Co-ordinator; Mississauga ON, new US office at 6 Horne Drive, Folcroft PA; M +1 647-825-6774) wrote at 8/13 23:00:54, cc sal@globyz.com, verbatim:

> "As mentioned for now we're buying Tirzepatide mainly, if you have any suppliers you could link us up with that would be appreciated. Further down the line once we have our own production facility and products to offer we can certainly look at your proposal."

**State: YOUR MOVE since 8/13 23:00 UTC.** Two facts follow, reported as facts — the decision is Taylor's.

**1. This inverts the model's direction.** SCP's structure is: supplier pays, SCP introduces license-verified *buyers* to that supplier. Ahmed is asking SCP to find *suppliers* for Globyz as a buyer. Sourcing product on a buyer's behalf is procurement, not introduction. **Legally exposed, with mechanism:** the whole zero-license position in `docs/10-regulatory-research.md` rests on never taking title, never transmitting price, never negotiating a sale — and on not acting as a broker. A sourcing role for a purchaser is the fact pattern that state "broker"/"virtual wholesaler" definitions are aimed at, which is precisely the open question in the guidance letters sitting unanswered at the AZ, OH and TN boards. Doing this before those answers arrive resolves the question by conduct rather than by ruling.

**2. Tirzepatide is a prohibited category in SCP's own documents, and an active FDA enforcement area.** Facts: FDA declared the tirzepatide shortage resolved in December 2024, which ended the §503A/§503B compounding permission tied to shortage status; FDA's enforcement discretion for 503B tirzepatide compounding ran out in March 2025. Compounding a drug that is essentially a copy of an approved drug (Mounjaro/Zepbound) is restricted under FDCA §503B(a)(5). This is not theoretical — **ProRx's 4/7/2026 warning letter cites post-eligibility tirzepatide production**, documented in `prorx-verification.md`. Separately, SCP's own draft supplier agreement §6(c) excludes GLP-1s — semaglutide, tirzepatide, liraglutide — from marketing, and `docs/10-regulatory-research.md` lists them as a prohibited lane. Introducing a tirzepatide supply relationship would contradict the contract SCP asks its own suppliers to sign.

**Also from the same message: Globyz is deferring on being a supplier** — "further down the line once we have our own production facility and products to offer." NexGen's 503B registration is 1/15/2026 with no inspection yet, which is consistent with that. As a supplier lead this is a later-stage conversation, not a near-term one.

No draft was prepared for this thread. Whether and how to answer Ahmed is Taylor's call, and any reply turns on the two facts above rather than on wording.

## Active supplier conversations

| Supplier | Contact | Status | Last touch | Next action |
|---|---|---|---|---|
| **Assure Infusions** (assureiv.com) | Andrea Caudill, Dir. of Business Development | 🟢 **Call confirmed: Wed Aug 12, 10:00–11:00 AM MST** (invite accepted 8/5) | 8/4 you → invite sent | **Prep brief ready: `call-brief-assure-infusions.md`** (FL-based IV-fluids 503B, registered 11/2024, never FDA-inspected as of 6/2025 — inspection question leads) |
| **ProRx Pharma** (Exton PA — location corrected 8/10; affiliated BoomRx portal) | Dave Dugas, VP Sales (904-945-1844) + Mark | 🟡 **Ball with them.** Call held 8/7; your recap sent 8/8 22:03 — **3% of gross on introduced customers, no intro fee**. Dave out of country week of 8/10, on email | 8/8 you → recap (new thread, not a reply in Dave's) | Follow up when Dave returns (~8/17). Compliance facts below — FYI, not a gate |
| **STASKA Pharmaceuticals** | Nick Shada | 🟢 **Ball with them.** Wants the call; times sent 8/10 21:01 | 8/10 you → times | Await Nick's pick. **Prep brief ready: `call-brief-staska.md`** (Class I recall 9/2024 + WL 5/2025, close-out unverified — remediation questions lead) |
| **Belmar Pharma Solutions** | Rob Kilgore, CEO (direct) | 🟡 **No reply yet** — no inbound from Rob at any point. Follow-up sent 8/10 21:01 (first email 8/6, after belmarselect@ bounced) | 8/10 you → rob@ | Day-3 clock restarts 8/10; next touch due 8/13 |
| **Globyz Pharma / NexGen Formulations** (Folcroft PA) | Salman Pathan, CEO (sal@) · **Ahmed Saeed-Khan, BD Director (Ahmed@)** — the active contact | 🔴 **YOUR MOVE since 8/13 23:00.** Call held Thu 8/13. Ahmed: they're **buying tirzepatide** and want SCP to source suppliers; SCP's proposal deferred until they have their own production. See the Globyz section below — direction inversion + prohibited category | 8/13 23:00 ← Ahmed | **Prep brief ready: `call-brief-globyz-nexgen.md`** — registration RESOLVED (registered 503B 1/15/2026, never inspected). Schedule conflict RESOLVED 8/10: the AOS digest predated the ~9:15 AM reschedule; **Thursday 8/13 1:25 PM ET / 10:25 AM MST confirmed** (single Bookings ID = moved not duplicated; Monday calendar empty). Thursday confirm **sent 8/10 21:01** (bare confirm, no phone-vs-video language). Bookings re-confirmation arrived 8/10 16:20 UTC — machine mail, no reply owed |

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
