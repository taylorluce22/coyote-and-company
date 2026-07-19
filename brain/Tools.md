# Tools

Registry of what the agents can actually use, what it costs, and the rules.

| Tool | What it does | Access | Cost | Rules |
|---|---|---|---|---|
| Higgsfield Soul | photoreal images (posts, scenes) | app `/api/higgsfield` (keys in Vercel env) | ~1 credit/image | ONLY after a brief is `approved`; batch ≤6; every image auto-saves to the app's AI vault |
| Perplexity sonar | copy writing + live research | app `/api/copy`, `/api/discover`, hunt lanes | pennies/run | facts must still trace to the KB; research cites sources |
| App lead engine | finds real homeowner threads | in-app (Engage tab, cron) | Perplexity tokens | thumbs-down avoid-rules are owner training data — never delete |
| Claude (sessions/Routines) | the agents themselves | this environment, repo access | API tokens | vault edits via `brain/` only on scheduled runs; app code changes only in interactive sessions with Taylor |
| Post Studio | assembles + exports finished posts | in-app | free | production happens here until `/api/produce` exists |
| GitHub | sync layer for everything | sessions push; Obsidian Git pulls | free | scheduled runs commit with `brain:` prefix, PR + squash |

Knowledge sources (read-only ground truth):
- `farmhand/docs/az-energy-knowledge-2026.md` — AZ utility numbers
- `farmhand/docs/higgsfield-instagram-playbook.md` — visual + IG craft
- `farmhand/lib/strategy.ts`, `farmhand/lib/azEnergyKb.ts` — idea decks
- `farmhand/lib/azTerritories.ts` — territory/utility map
