# START HERE — Today's Session

You are helping launch a B2B pharmaceutical sourcing agency. Everything is already built in this repo. Your job today is execution, not redesign.

## Read first
- `agency-os/HANDOFF-PROMPT.md` — full context, business model, hard rules
- `agency-os/docs/10-regulatory-research.md` — why the business is structured this way

## The business, short version
We connect vetted 503B compounding pharmacies with license-verified clinical buyers (med spas, IV therapy clinics, men's health clinics, ophthalmology practices). We are a **marketing and introduction agency only** — the supplier quotes, prices, invoices, ships, and stays seller-of-record on every sale. We never take title or possession, never send pricing, never negotiate. That isn't a preference; it's what keeps the agency outside pharmaceutical distributor licensing. Don't suggest otherwise.

## Today, in order

### 1. Name + domains — do this first; it starts a 2–3 week clock everything else waits on
No business name picked yet. Recommended: **Provenance Clinical Sourcing** (`provenancesourcing.com`) — provenance means documented chain of origin, which is literally the product. Alternatives: Meridian Clinical Partners, Verity Sourcing Partners, Keystone Clinical Sourcing, Sonoran Supply Partners.

Check availability at porkbun.com or Cloudflare Registrar, then buy **three** domains: one brand domain plus two sending variants (e.g. `provenancesourcing.com` + `getprovenancesourcing.com` + `provenancesourcing.co`).

**Hard rule:** sending domains must be obvious variants of the real brand. No unrelated words, no lookalikes — truthful sender identity is legally required (CAN-SPAM; California's anti-spam statute carries $1,000-per-email private damages).

Once the name is picked, replace `Sonoran Clinical Partners` throughout `agency-os/`.

### 2. Email infrastructure
Google Workspace on the brand domain → add both sending domains as secondary domains (free) → mailboxes on each → SPF/DKIM/DMARC on all three, verified at mxtoolbox.com → Instantly.ai, connect mailboxes, **warm-up ON**, cap 30/day/mailbox.

`agency-os/mvp/setup-day1.py` walks all of this interactively with exact DNS values. Run it together: `python3 setup-day1.py`

### 3. Pull the buyer list (free, no API key)
```
cd agency-os/mvp
python3 build-prospects.py nppes --taxonomy ophthalmology,dermatology,urology,plastic-surgery --state AZ,TX,CO,NV -o raw/clinics-launch.csv
python3 import-prospects.py raw/ out/
```
Then review `out/qualification-worklist.csv` and `out/near-duplicate-review.csv` together, and import the CSVs into the CRM.

### 4. Send five supplier pitches
Drafts in `agency-os/gtm/first-touches.md` (wave-2 additions at the bottom). Top target is **McGuff Outsourcing Solutions** — see `agency-os/gtm/supplier-contacts.md` for why. Personalize each with the real buyer count from step 3, send from the founder's actual email address.

## Rules to enforce — say something if the founder drifts
1. **No medical, efficacy, or safety claims** in any copy. No "FDA-approved," no "generic version of," no "same as [brand]." Check against `agency-os/mvp/claims-linter.md`.
2. **Never touch compounded GLP-1s** (semaglutide/tirzepatide) or **"research use only" peptides.** Both are active FDA enforcement zones that hit marketers, not just sellers.
3. **No Florida buyers. No California, Alabama, or New Jersey** for office-use compounded products. The scripts enforce this — don't disable it.
4. **Never invent** a business, contact, email, or license status. If it can't be verified from a real source, leave it blank and say so.
5. **The founder never quotes, prices, or negotiates.** If a draft has him sending pricing to a buyer, that's a bug — flag it.

Start with step 1. Report what you find on domain availability before buying anything.
