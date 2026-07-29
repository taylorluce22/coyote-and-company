# Handoff Prompt — paste into a fresh Claude Code session on your own machine

Run Claude Code from the repo root on a machine with normal internet access. Paste everything below the line.

---

I'm launching a B2B pharmaceutical sales & sourcing agency and I need you to help me finish setup and get to first revenue. The entire system — spec, database schema, regulatory research, go-to-market pack, and tooling — is already built in this repo under `agency-os/`. Your job is execution, not redesign.

## Read these first, in this order

1. `agency-os/README.md` — what the system is
2. `agency-os/docs/10-regulatory-research.md` — **the most important file.** The regulatory research that determined the business model, product lanes, and state posture. Everything else follows from it.
3. `agency-os/docs/00-decision-table.md` — build / do-not-build decisions and the open register
4. `agency-os/mvp/prospect-runbook.md` — how buyer lists get built
5. `agency-os/gtm/supplier-contacts.md` and `agency-os/gtm/first-touches.md` — who I'm pitching and the drafts

## The business in one paragraph

I connect vetted 503B compounding facilities (suppliers) with license-verified clinical buyers (med spas with medical directors, IV therapy clinics, men's health clinics, ophthalmology and dermatology practices). I am a **marketing and introduction agency only**: the supplier quotes, prices, contracts, invoices, and ships — the supplier is seller-of-record on every transaction. I never take title or possession of product, never transmit pricing or quotes, never negotiate a sale. That activity discipline is exactly what keeps me outside state wholesale-distributor/broker licensing and federal DSCSA trading-partner status, so it is not a style preference — it is the legal architecture. I'm paid by suppliers via retainer, per-qualified-meeting fee, and commission on their collected revenue.

## What I need done today

Run me through `agency-os/mvp/setup-day1.py` (it's a guided, resumable walkthrough) and help with whatever breaks:

**Step 1 — Email infrastructure.** Buy domains, set up Google Workspace mailboxes, configure SPF/DKIM/DMARC, connect to Instantly, start warm-up. Help me troubleshoot DNS records and verify propagation. This is first because warm-up takes 2-3 weeks and gates all bulk outreach.

**Step 2 — Fill the CRM with buyers.** Run `agency-os/mvp/build-prospects.py` (NPPES federal registry pull — free, no API key) then `import-prospects.py`. Help me review the outputs: the qualification worklist, the near-duplicate review file, and the rejects. Then map the CSVs into my CRM's import fields.

**Step 3 — Send five supplier pitches.** The drafts are in `gtm/first-touches.md`. Help me personalize each with the real buyer count from step 2, find current contact details, and log the touches.

After that, in priority order: Google Places pull for med spas/IV clinics, then the Make automation wiring in `agency-os/mvp/automations.md`.

## Hard rules — do not break these, and stop me if I try

These come from the regulatory research and each one has real enforcement behind it:

1. **No medical, efficacy, or safety claims** in any copy, ever. No "FDA-approved," no "generic version of," no "same as [brand drug]," no outcome claims. FDA sent 130+ warning letters to marketing intermediaries in 2025-26 over exactly this language. The blocklist is in `agency-os/mvp/claims-linter.md` — check any copy against it.
2. **Two product categories are permanently off-limits:** compounded GLP-1s (semaglutide/tirzepatide/liraglutide) and "research use only" peptides sold toward clinical channels. Both are active enforcement zones. Don't let me rationalize into them because the market looks big.
3. **State carve-outs:** no Florida buyers (all-payor Patient Brokering Act plus a broker permit regime). No California, Alabama, or New Jersey for office-use compounded products. The scripts enforce this — don't disable it.
4. **I never quote, price, or negotiate.** If a workflow or draft has me sending pricing to a buyer, that's a bug — flag it.
5. **Opt-outs are permanent and instant.** Never build anything that delays or reverses a suppression.
6. **No new outreach template sends without my explicit approval** of that exact version. Editing an approved template creates a new version needing re-approval.
7. **Never invent business data.** If a prospect list, contact, or license status can't be verified from a real source, leave it blank and tell me. A fabricated row wastes my outreach and burns sender reputation.

## How I want you to work

- Be direct about problems. If something in the plan is wrong, say so and propose the fix.
- Prefer running things yourself over telling me commands to copy, when you can.
- When a decision is genuinely mine (money, legal risk, which supplier to prioritize), give me a recommendation and the reasoning, then let me decide.
- Keep commits clean and push to the branch this repo is on.
- Don't rebuild what exists. If you think something needs redesign, tell me why before doing it.

Start by reading the files above, then check `python3 agency-os/mvp/setup-day1.py --status` and tell me where I am and what we're doing first.
