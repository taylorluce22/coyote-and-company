# Reply Triage — how conversation state is computed

Written 2026-08-10 after the triage card showed **"YOUR MOVE — Dave Dugas, waiting on you"** for a thread Taylor had already answered. Anything that renders a triage list — the dashboard card, the morning routine, the daily digest — computes state by these rules or it will be wrong again.

## The defect this fixes

The card keyed state to the **Gmail thread**: last message in thread `19fdca2b…` is inbound from Dave (8/7 20:18) → "waiting on you."

Taylor did reply. He replied on 8/8 22:03 — in a **new thread**, new subject ("ProRx + Sonoran Clinical Partners — call summary"), to `sales@prorxpharma.com` with `dave@` and `mark@` cc'd. Different `threadId`, so thread-level logic never saw it.

This is normal behavior, not an edge case: recaps, summaries, and "here's what we agreed" emails almost always start a fresh subject. **Thread-level reply detection is structurally wrong for this pipeline.** Two consequences:

1. State must be computed **per counterparty**, across all threads.
2. The search must include `in:sent`. A sent message that opened a new thread appears in *no* inbound-side search — searching the inbox and reading thread tails can never find it.

## The computation

For each counterparty (a person, plus their org domain — `dave@prorxpharma.com` and `sales@prorxpharma.com` are one counterparty):

```
lastInbound  = max(date) over messages FROM that person/domain,   all threads, that are HUMAN mail
lastOutbound = max(date) over messages TO   that person/domain,   all threads, in:sent, DELIVERED
```

Then:

| Condition | State | Surfaces as |
|---|---|---|
| `lastOutbound > lastInbound` | **BALL WITH THEM** | Not a triage item. Becomes a cadence item at day 3 / 7 / 14 per `outreach-templates.md` |
| `lastInbound > lastOutbound`, inbound is a human ask | **YOUR MOVE** | Triage item — the only thing that earns this label |
| `lastInbound > lastOutbound`, inbound is machine mail | drop | Nothing. Machine mail never sets state |
| No inbound ever, outbound delivered | **NO REPLY YET** | Cadence item at day 3 / 7 / 14 — never "your move" |
| Last outbound bounced | **UNDELIVERED** | Its own item: the message never landed, a new route is needed. Never "waiting on them" |
| Founder muted it | **MUTED** | Nothing, ever, until Taylor unmutes |

Ranking within triage is by age of `lastInbound`, oldest first.

## Machine mail — never sets state, never resets a cadence clock

Classify as machine and drop: calendar accept/decline/tentative notices (`Accepted: …`), Bookings/Teams/Calendly confirmations and reschedules, `mailer-daemon@` bounces, out-of-office auto-replies, "thanks, we received your message" auto-acknowledgements from `info@`/`help@`/`customerservice@` aliases, DMARC/DKIM reports, Google Workspace notices.

Two live examples of why: `acaudill@assureiv.com` 8/5 11:30 is **"Accepted: Intro call"** — a calendar acceptance, not an ask; treating it as inbound would put Assure in triage forever. `help@genogenix.com` and `customerservice@olympiapharmacy.com` 8/5 are auto-acknowledgements of the batch send — they are not replies, and the day-3 clock keeps running from Taylor's send.

A bounce is not inbound from the counterparty. It means `lastOutbound` never arrived: state is UNDELIVERED, not "waiting on them." Live: `belmarselect@belmarpharma.com` (superseded by `rob@`), `pharmacistconsult@carieboyd.com` (the `orders@` send went through), `ernestos@pharmaceuticlabs.com` (three bounces — route is dead, needs the web form).

## Muting is founder-set and absolute

MUTED is set by Taylor, never by an agent's own judgment — that is the compliance charter's no-steering rule applied to triage. A muted conversation does not appear in triage, does not generate cadence items, and does not get a draft. Currently muted: **Frier Levitt / Arielle Miliambro / Denise Schallenberger** — last inbound 8/7 14:35 with no reply from Taylor, which the old logic would surface as "your move" every morning; the founder withdrew the nudge on 8/10 and is routing counsel through a personal referral. Do not surface it.

## Verified state as of 2026-08-10 21:15 UTC

> **Stale — two failed recomputes (Tue 8/11 13:41 UTC, Wed 8/12 13:37 UTC).** Both scheduled runs fired without a Gmail connector. This table is the last *verified* snapshot, not current state — treat every row as "true at 8/10 21:15, unknown since." The staleness is structural, not incidental: a routine that can't reach Gmail can never satisfy the rule this file describes, because the rule is defined by mailbox state.

Computed by this rule against live Gmail, not from the tracker:

| Counterparty | Last inbound | Last outbound | State |
|---|---|---|---|
| ProRx (Dave Dugas / Mark L'Hommedieu / sales@) | 8/7 20:18 | **8/8 22:03** (recap, new thread) | BALL WITH THEM — Dave abroad, back ~8/17 |
| STASKA (Nick Shada) | 8/6 21:14 | **8/10 21:01** | BALL WITH THEM |
| Belmar (Rob Kilgore) | never | **8/10 21:01** | NO REPLY YET — day-3 clock from 8/10 |
| Globyz/NexGen (Salman Pathan) | 8/6 05:30 (human) | **8/10 21:01** | BALL WITH THEM — call Thu 8/13 |
| Assure (Andrea Caudill) | 8/4 12:18 human; 8/5 accept = machine | 8/4 22:16 | BALL WITH THEM — call Wed 8/12 |
| Frier Levitt | 8/7 14:35 | 8/7 14:33 | **MUTED** (founder, 8/10) |
| AZ / OH / TN boards | never | 8/8 12:41 | NO REPLY YET — nudge at 2 weeks (8/22) |
| 8/5 batch — 39 facilities | never (2 auto-acks don't count) | 8/5 | NO REPLY YET — A2 drafted 8/10, unsent |
| Galaxy Pharmaceuticals | never | 8/5, failed 8/8 | **UNDELIVERED** — route dead, needs the web form |

The batch row is why the count matters: the tracker listed 10 of 45 sends, so 29 conversations existed in Gmail and nowhere else. A triage view built only from what a tracker remembers will miss whatever the tracker forgot — the counts have to come from mail state each run.

**Zero conversations are genuinely "your move" right now.** The card's 7 were: one answered out-of-thread, three answered 8/10, one calendar acceptance, one muted, one auto-acknowledgement.

## Implementation note for whoever renders the card

Gmail queries that produce the inputs — both are required, neither is sufficient alone:

```
inbound:  from:{domain} newer_than:30d -in:draft
outbound: in:sent to:{domain} newer_than:30d
```

Then compare timestamps per counterparty. Do not read `threadId`, do not read the last message of a thread, do not use "unread" as a proxy for "needs a reply" — Taylor reads on his phone and the flag means nothing.
