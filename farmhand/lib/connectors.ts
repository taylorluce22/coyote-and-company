/* ============================================================
   Connector registry — every integration the Agentic OS uses, which
   agent it powers, the env var it needs, and where to get the key.
   The Connectors screen live-checks the wired ones via their /api
   status endpoints; the rest show their setup state.
   ============================================================ */

export type ConnStatus = "live" | "needs-key" | "store" | "planned";

export interface Connector {
  id: string;
  name: string;
  agent: string;
  powers: string;
  env: string;
  getUrl?: string;
  /** live status probe: endpoint + optional key in the JSON response */
  check?: { endpoint: string; key?: string };
  /** default state when there's no live probe */
  status: ConnStatus;
  note?: string;
}

export interface ConnGroup {
  title: string;
  accent: string;
  items: Connector[];
}

export const CONNECTOR_GROUPS: ConnGroup[] = [
  {
    title: "Content & Media · CMO",
    accent: "#FF9A62",
    items: [
      { id: "perplexity", name: "Perplexity", agent: "CMO / Researcher", powers: "AI copywriter + live intel + lead hunts", env: "PERPLEXITY_API_KEY", getUrl: "https://www.perplexity.ai/settings/api", check: { endpoint: "/api/copy" }, status: "needs-key" },
      { id: "higgsfield", name: "Higgsfield Soul", agent: "CMO", powers: "Photoreal images / post scenes", env: "HIGGSFIELD_API_KEY · HIGGSFIELD_API_SECRET", getUrl: "https://higgsfield.ai", check: { endpoint: "/api/higgsfield" }, status: "needs-key" },
      { id: "pexels", name: "Pexels", agent: "CMO", powers: "Photo backgrounds for carousels", env: "PEXELS_API_KEY", getUrl: "https://www.pexels.com/api/", check: { endpoint: "/api/stock", key: "pexels" }, status: "needs-key" },
      { id: "pixabay", name: "Pixabay", agent: "CMO", powers: "Backup stock provider", env: "PIXABAY_API_KEY", getUrl: "https://pixabay.com/api/docs/", check: { endpoint: "/api/stock", key: "pixabay" }, status: "needs-key" },
      { id: "unsplash", name: "Unsplash", agent: "CMO", powers: "Backup stock provider", env: "UNSPLASH_ACCESS_KEY", getUrl: "https://unsplash.com/developers", check: { endpoint: "/api/stock", key: "unsplash" }, status: "needs-key" },
      { id: "gemini", name: "Gemini (video)", agent: "CMO", powers: "Reel Coach — watches reels for coaching", env: "GEMINI_API_KEY", getUrl: "https://aistudio.google.com/apikey", check: { endpoint: "/api/video-reference" }, status: "needs-key" },
      { id: "instagram", name: "Instagram", agent: "CMO", powers: "Publish + pull post metrics", env: "(Meta Graph API / Metricool)", status: "planned", note: "Publishing not wired yet — export from Post Studio for now." },
      { id: "x", name: "X (Twitter)", agent: "CMO", powers: "Cross-post", env: "(X API)", status: "planned", note: "Not wired yet." },
    ],
  },
  {
    title: "Research · Researcher",
    accent: "#38BDF8",
    items: [
      { id: "apify", name: "Apify", agent: "Researcher", powers: "Scrape competitor reels weekly", env: "APIFY_TOKEN", getUrl: "https://console.apify.com/account/integrations", status: "planned", note: "Not wired yet — needs an /api route + the token." },
      { id: "tavily", name: "Tavily", agent: "Researcher", powers: "Niche news + outlier search", env: "TAVILY_API_KEY", getUrl: "https://app.tavily.com", status: "planned", note: "Not wired yet." },
      { id: "firecrawl", name: "Firecrawl", agent: "Researcher / Lead Mgr", powers: "Scrape a page / lead site", env: "FIRECRAWL_API_KEY", getUrl: "https://www.firecrawl.dev", status: "planned", note: "Not wired yet." },
    ],
  },
  {
    title: "Lead / Revenue · Lead Manager",
    accent: "#FF5D8F",
    items: [
      { id: "gmail", name: "Gmail", agent: "Lead Manager", powers: "Outreach + follow-up drafts", env: "(Google OAuth)", getUrl: "https://console.cloud.google.com", status: "planned", note: "Needs a Google OAuth app + consent — owner setup." },
      { id: "gmeet", name: "Google Meet", agent: "Lead Manager", powers: "Virtual consults + transcripts", env: "(Google OAuth)", status: "planned" },
      { id: "gcal", name: "Google Calendar", agent: "Lead Manager", powers: "Book in-home / virtual appointments", env: "(Google OAuth)", status: "planned" },
    ],
  },
  {
    title: "Data & Memory · Data Analyst / shared",
    accent: "#7BE495",
    items: [
      { id: "supabase", name: "Supabase", agent: "shared memory", powers: "The shared memory layer — every agent reads/writes", env: "SUPABASE_URL · SUPABASE_SERVICE_ROLE · SUPABASE_ANON_KEY", getUrl: "https://supabase.com/dashboard", check: { endpoint: "/api/memory" }, status: "needs-key", note: "Wired. Create a Supabase project, run supabase/schema.sql, then add the 3 keys in Vercel → flips green and sync turns on." },
      { id: "metricool", name: "Metricool", agent: "Data Analyst", powers: "Post performance + scheduling", env: "METRICOOL_API_TOKEN", getUrl: "https://metricool.com", status: "planned", note: "Free tier only until owner approves a paid plan." },
      { id: "kv", name: "Vercel KV", agent: "Data Analyst / Dev", powers: "Server-side state (autonomous production)", env: "KV_REST_API_URL · KV_REST_API_TOKEN", getUrl: "https://vercel.com/dashboard/stores", status: "store", note: "Create a KV/Upstash store on the project → env auto-populates." },
    ],
  },
  {
    title: "Infrastructure · Dev",
    accent: "#41D98A",
    items: [
      { id: "blob", name: "Vercel Blob", agent: "Dev / CMO", powers: "Reel upload transfer hop (Reel Coach)", env: "BLOB_READ_WRITE_TOKEN", getUrl: "https://vercel.com/dashboard/stores", check: { endpoint: "/api/video-reference/blob-upload" }, status: "store", note: "Attach a Blob store to the project → token auto-populates." },
      { id: "anthropic", name: "Anthropic (Claude)", agent: "Dev / Orchestrator", powers: "In-app produce pipeline + the agents", env: "ANTHROPIC_API_KEY", getUrl: "https://console.anthropic.com", status: "planned", note: "Enables the future in-app /api/produce." },
      { id: "reddit", name: "Reddit", agent: "Lead Manager", powers: "Native homeowner-thread hunt lane", env: "REDDIT_CLIENT_ID · REDDIT_CLIENT_SECRET", getUrl: "https://www.reddit.com/prefs/apps", status: "planned" },
      { id: "github", name: "GitHub", agent: "Dev", powers: "Sync layer — sessions push, Obsidian pulls", env: "(connected)", status: "live", note: "Already connected — the vault syncs through it." },
    ],
  },
];

export const ALL_CONNECTORS = CONNECTOR_GROUPS.flatMap((g) => g.items);
