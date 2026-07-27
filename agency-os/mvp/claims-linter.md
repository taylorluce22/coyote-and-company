# Claims Linter — Word Lists v1

Used two ways: (1) the human template-approval checklist (WF8/G10) — every new template version is checked against these lists before the two approval clicks; (2) optionally in Make (text-match module on template bodies at campaign activation, M3) as a backstop that blocks activation and opens an exception on a hard-block hit. Human judgment is final — the linter flags, people decide. Maintained by the founder; version-date every change.

Basis: FDA misbranding rules for compounded preparations, the 2025–26 warning-letter language, FTC health-claims guidance (`docs/10-regulatory-research.md` §4).

## Hard blocks (never in any outbound copy; automation may refuse on these)

**Approval/equivalence:** FDA-approved · FDA approved · FDA-cleared · approved by the FDA · generic version · generic Ozempic|Wegovy|Mounjaro|Zepbound|[any brand] · same as [brand] · equivalent to [brand] · bioequivalent · interchangeable with · "the branded alternative"

**Efficacy/outcome (drug-type claims):** treats · cures · heals · prevents · reverses · clinically proven · proven results · effective for · efficacy · patient outcomes · guaranteed results · weight loss · fat loss · muscle growth · anti-aging · rejuvenat- · boosts immunity · safe and effective

**Legality overreach:** fully legal · 100% compliant · FDA-registered product (registration attaches to facilities, not products) · pharmaceutical grade (meaningless + implies approval) · no prescription needed

**Prohibited categories (any mention in outbound = wrong campaign):** semaglutide · tirzepatide · liraglutide · retatrutide · research use only · RUO · not for human consumption · BPC-157 · TB-500 · SARM

## Flags (allowed only in specific factual frames; human reviews context)

| Term | Allowed frame | Blocked frame |
|---|---|---|
| FDA-registered | "FDA-registered 503B outsourcing facility" (fact about the facility) | anything attaching it to a product |
| licensed | "licensed to ship to {state}" / "state-licensed facility" with verifiable referent | "licensed product", unqualified "fully licensed" |
| compounded | fine as category descriptor; required disclosure context when product-specific | paired with any outcome word |
| sterile | as facility/process fact ("sterile preparations", "cGMP") | as a safety claim ("sterile so it's safe") |
| safe / safety | never as product claim; OK in "safety data sheet" literal doc name | everything else |
| shortage | historical/factual with date and source | as a sales-pressure claim about current availability |
| verified | only about *our own* license verification with evidence | about product quality |

## Always required (presence checks)

- Physical postal address in footer
- Working one-click unsubscribe
- Real sender name + real org name
- For any product-specific copy: supplier pre-approval on file (link in campaign record)

## Safe vocabulary (pre-cleared frames — write from these)

"FDA-registered 503B outsourcing facility" · "licensed to ship to {state} — license #{n}, verifiable at {board URL}" · "office-use sterile preparations" · "{category} preparations for in-office administration" · "we verify state licensure with primary-source evidence" · "the facility quotes and invoices you directly" · "no cost to your practice for the introduction"

## Change log

v1 — 2026-07-27 — initial lists from regulatory research.
