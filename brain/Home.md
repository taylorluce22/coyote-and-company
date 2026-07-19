# Home — Farmhand Brain

The one-screen view of the operation. Agents: read this first, every run.

## Current state

- **App**: Farmhand (Next.js, `farmhand/`), live at coyote-and-company.vercel.app, auto-deploys on merge to `main`.
- **Vertical**: Arizona residential solar. Territories: West Valley (Buckeye, Peoria — APS) and East Valley (Queen Creek — SRP), full catalog in `farmhand/lib/azTerritories.ts`.
- **Content system**: idea decks → AI copywriter → Higgsfield visuals (aesthetic-pack rotation) → Post Studio. Vault (IndexedDB) keeps every generated image.
- **Standing owner decisions**: quality over cost, but no credit ever spent on a post that isn't worth posting. Honest numbers only — no invented claims, no fake credentials. Geography belongs in the CTA, not sprinkled through statewide education.

## In flight

- [ ] Brand kit: Taylor to add 10–15 real reference photos → `Brain/Brand/` (paths listed in [[Visual Style]])
- [ ] Decide: real face vs. recurring stylized character for "realistic moment" posts (see [[Visual Style]])
- [ ] Produce-post one-button pipeline (planned; needs ANTHROPIC_API_KEY in Vercel for the director step)
- [ ] Security hygiene: rotate Higgsfield key, mark env vars Sensitive (advised earlier)

## How the agents divide the work

| Agent | Reads | Produces |
|---|---|---|
| [[Creative Director]] | Home, Brand notes, Queue, Log | Post briefs (format, angle, look) into the Queue |
| [[Copywriter]] | briefs, `farmhand/docs/az-energy-knowledge-2026.md` | Slide copy + caption + hashtags on each brief |
| [[Art Director]] | briefs, `farmhand/docs/higgsfield-instagram-playbook.md` | Image prompts / generation plans on each brief |
| [[Analyst]] | Log, posted results Taylor reports | Weekly read on what's working → updates Brand notes |

Taylor approves in [[Content Queue]]; nothing publishes without it.
