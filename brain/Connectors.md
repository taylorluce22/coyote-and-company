# Connectors

Every integration the Agentic OS uses. Live status lives in the app
(**Connectors** tab, which probes the wired `/api` endpoints). This is the
setup checklist. Keys go in **Vercel → Project → Settings → Environment
Variables**, then redeploy. Managed by [[Dev]]; used across the roster.

## Wired now — just needs a key (flip green once set)
| Connector | Powers | Env var | Get it |
|---|---|---|---|
| Perplexity | [[CMO]] copywriter + [[Researcher]] intel + lead hunts | `PERPLEXITY_API_KEY` | perplexity.ai/settings/api |
| Higgsfield Soul | [[CMO]] photoreal images | `HIGGSFIELD_API_KEY` · `HIGGSFIELD_API_SECRET` | higgsfield.ai |
| Pexels | [[CMO]] photo backgrounds | `PEXELS_API_KEY` | pexels.com/api |
| Pixabay / Unsplash | backup stock | `PIXABAY_API_KEY` · `UNSPLASH_ACCESS_KEY` | pixabay/unsplash devs |
| Gemini (video) | [[CMO]] Reel Coach | `GEMINI_API_KEY` | aistudio.google.com/apikey |

## Attach a Vercel store (env auto-populates)
| Connector | Powers | Env var |
|---|---|---|
| Vercel Blob | Reel Coach upload hop | `BLOB_READ_WRITE_TOKEN` |
| Vercel KV | server-side state / autonomous production | `KV_REST_API_URL` · `KV_REST_API_TOKEN` |

## To wire — needs an `/api` route built ([[Dev]]) + the key
| Connector | Agent | Env var |
|---|---|---|
| Apify | [[Researcher]] — scrape competitor reels | `APIFY_TOKEN` |
| Tavily | [[Researcher]] — niche news search | `TAVILY_API_KEY` |
| Firecrawl | [[Researcher]] / [[Lead Manager]] — scrape a page | `FIRECRAWL_API_KEY` |
| Gmail · Meet · Calendar | [[Lead Manager]] — outreach, consults, booking | Google OAuth app |
| Supabase | **shared memory layer** (the big one) | `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE` |
| Metricool | [[Data Analyst]] — post performance | `METRICOOL_API_TOKEN` |
| Instagram / X | [[CMO]] — publish + metrics | Meta Graph / X API |
| Anthropic | in-app produce pipeline + the agents | `ANTHROPIC_API_KEY` |
| Reddit | [[Lead Manager]] — homeowner-thread hunt | `REDDIT_CLIENT_ID` · `REDDIT_CLIENT_SECRET` |

## Already connected
- **GitHub** — the sync layer; sessions push, Obsidian pulls. Live.

## Priority order (owner)
1. Keys you likely already have live: Perplexity, Higgsfield.
2. Turn on the built features: **Pexels** (photo carousels) + **Gemini** +
   **Vercel Blob** (Reel Coach).
3. The compounding one: **Supabase** shared memory (needs Dev to wire).
4. Everything else as the matching agent's lane gets built.
