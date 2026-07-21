/* ============================================================
   Agentic OS layer — the roster + the knowledge-vault graph model.
   Powers the Agent Network, Command Center, and Knowledge Vault
   screens. Mirrors the brain vault (brain/) so the app reflects the
   real system: one command layer + six specialists, and a colored
   memory/database topology of agents, vault docs, KB sources, and
   the content posts they produce.
   ============================================================ */

export type AgentStatus = "hold" | "idle" | "active" | "pass";

export interface AgentDef {
  id: string;
  role: string;
  glyph: string;
  color: string;
  status: AgentStatus;
  statusLabel: string;
  model: string;
  desc: string;
  tools: string[];
  flow: string[];
  tagline?: string;
  output?: string;
  command?: boolean;
}

/**
 * The Agentic OS roster — one AI chief of staff coordinating five
 * specialists on a shared memory layer. Adapted to Taylor's solar
 * consulting: reel → homeowner inquiry → consult call → install → revenue.
 */
export const AGENTS: AgentDef[] = [
  {
    id: "CEO / Orchestrator", role: "Command Layer", glyph: "◆", color: "#A855F7", status: "hold", statusLabel: "waiting",
    model: "gpt-5.5", command: true,
    desc: "Your AI chief of staff. The main point of contact — routes every task and returns one debrief.",
    tools: ["Claude Code", "Obsidian", "Git"],
    flow: ["Every agent reports here", "You manage one conversation, not six tools"],
    tagline: "One conversation, not six tools.",
  },
  {
    id: "Researcher", role: "Intel Gatherer", glyph: "◉", color: "#38BDF8", status: "idle", statusLabel: "idle",
    model: "gemini-2.5-pro",
    desc: "Finds market signals, research briefs, sources, and strategic context.",
    tools: ["Apify", "Tavily", "Firecrawl"],
    flow: [
      "Scrapes top solar / competitor reels weekly — hooks, formats, CTAs",
      "Pulls niche + adjacent-niche outliers before they saturate",
      "Tracks the space and upgrades its own playbook",
    ],
    output: "Ranked ideas, angles + proof points",
    tagline: "Nothing generic. Everything sourced and scored.",
  },
  {
    id: "CMO", role: "Market Voice", glyph: "✷", color: "#FF9A62", status: "idle", statusLabel: "idle",
    model: "gpt-5.5",
    desc: "Turns strategy into consistent content angles, campaigns, and publish-ready drafts.",
    tools: ["Instagram", "X", "Post Studio"],
    flow: [
      "Pulls research + your performance data",
      "Ranks hooks by predicted performance",
      "Writes scripts in your voice",
      "You film + approve (approval queue)",
      "Posted + tracked per reel",
      "Winners replicated + one new idea",
    ],
    tagline: "I wake up to finished scripts.",
  },
  {
    id: "Lead Manager", role: "Revenue Ops", glyph: "⇆", color: "#FF5D8F", status: "idle", statusLabel: "waiting",
    model: "gpt-5.5",
    desc: "Converts web leads into booked in-home or virtual consults — and calls to set the appointment when that's what it takes.",
    tools: ["Gmail", "Google Meet", "Calendar", "Firecrawl"],
    flow: [
      "New web lead lands",
      "Researches the address, roof, and socials",
      "Fit score + pain summary",
      "Books an in-home or virtual consult (or calls to set it)",
      "Call brief ready before you open it",
      "Transcript + notes analyzed instantly",
    ],
    output: "Appointment booked · follow-up drafted + CRM updated · no-show recovery auto",
  },
  {
    id: "Data Analyst", role: "Signal Layer", glyph: "◭", color: "#FFC23D", status: "idle", statusLabel: "idle",
    model: "gemini-2.5-pro",
    desc: "Analyzes performance, trends, records, and operational signal quality — then tells every agent.",
    tools: ["Supabase", "Metricool"],
    flow: ["Tracks the full chain:", "reel → inquiry → booked → showed → closed → revenue"],
    tagline: "Communicates data to the rest of the agents.",
  },
  {
    id: "Dev", role: "Build System", glyph: "⚙", color: "#41D98A", status: "idle", statusLabel: "idle",
    model: "Claude Opus",
    desc: "Builds dashboards, integrations, and ships the technical changes the system needs.",
    tools: ["Next.js", "Vercel", "APIs"],
    flow: ["Builds + wires new capabilities", "Keeps the OS running"],
  },
];

/** The shared memory layer (Supabase) — what every agent reads from and writes back to. */
export const MEMORY_LAYER = [
  "Content metrics per reel", "Comments + DMs", "Applications + lead context", "Call transcripts + objections",
  "CRM + pipeline state", "Client brand docs + voice", "Weekly reports + learnings",
];

export const AGENT_STATUS_STYLE: Record<AgentStatus, { color: string; bg: string }> = {
  hold: { color: "#FFC23D", bg: "rgba(255,194,61,0.12)" },
  idle: { color: "#9aa6b8", bg: "rgba(255,255,255,0.06)" },
  active: { color: "#41D98A", bg: "rgba(65,217,138,0.14)" },
  pass: { color: "#7BE495", bg: "rgba(123,228,149,0.14)" },
};

/* ---- Knowledge Vault graph ---- */
export type NodeGroup =
  | "agents" | "system" | "brand" | "analytics" | "queue" | "pipelines" | "knowledge" | "content";

export const GRAPH_GROUPS: Record<NodeGroup, { color: string; label: string }> = {
  agents: { color: "#7DD3FC", label: "Agents" },
  system: { color: "#FFC23D", label: "System" },
  brand: { color: "#FF9A62", label: "Brand" },
  analytics: { color: "#C9A8FF", label: "Analytics" },
  queue: { color: "#FF5D8F", label: "Queue" },
  pipelines: { color: "#26E0C8", label: "Pipelines" },
  knowledge: { color: "#7BE495", label: "Knowledge" },
  content: { color: "#FF9EC4", label: "Content posts" },
};

export const GRAPH_NODES: [string, NodeGroup][] = [
  ["Home", "system"], ["Orchestrator", "agents"], ["Log", "system"], ["README", "system"], ["Tasks", "system"], ["Tools", "system"], ["Schedule", "system"],
  ["Analyst", "agents"], ["Art Director", "agents"], ["Copywriter", "agents"], ["Creative Director", "agents"], ["Fact Checker", "agents"], ["Feed Director", "agents"],
  ["Competitor Audit", "analytics"], ["Content Analytics", "analytics"], ["Growth Strategy", "analytics"],
  ["Editorial Direction", "brand"], ["Visual Style", "brand"], ["Voice", "brand"],
  ["Content Queue", "queue"], ["Lead Pipeline", "pipelines"],
  ["Rising-cost / heat KB", "knowledge"], ["Installer-quality KB", "knowledge"], ["Solar-market KB", "knowledge"], ["Rates / supply KB", "knowledge"], ["AZ energy KB", "knowledge"], ["IG / Higgsfield playbook", "knowledge"],
  ["Data centers heat", "content"], ["Hottest year", "content"], ["Battery VPP", "content"], ["APS bill climbs", "content"], ["Bill isn't going down", "content"], ["SRP rate design", "content"],
];

export const GRAPH_LINKS: [string, string][] = [
  ["Content Queue", "Editorial Direction"], ["Tools", "Log"], ["Tools", "Tasks"],
  ["Lead Pipeline", "Analyst"], ["Lead Pipeline", "Content Analytics"], ["Lead Pipeline", "Creative Director"], ["Lead Pipeline", "Tasks"],
  ["Log", "Competitor Audit"], ["Log", "Content Queue"], ["Log", "Editorial Direction"], ["Log", "Fact Checker"], ["Log", "Feed Director"], ["Log", "Growth Strategy"], ["Log", "Schedule"], ["Log", "Tasks"], ["Log", "Tools"], ["Log", "Visual Style"],
  ["README", "Content Analytics"], ["README", "Content Queue"], ["README", "Editorial Direction"], ["README", "Fact Checker"], ["README", "Feed Director"], ["README", "Home"], ["README", "Lead Pipeline"], ["README", "Log"], ["README", "Orchestrator"], ["README", "Schedule"], ["README", "Tasks"], ["README", "Tools"], ["README", "Visual Style"], ["README", "Voice"],
  ["Competitor Audit", "Editorial Direction"], ["Competitor Audit", "Feed Director"], ["Competitor Audit", "Visual Style"],
  ["Content Analytics", "Analyst"], ["Content Analytics", "Creative Director"],
  ["Growth Strategy", "Analyst"], ["Growth Strategy", "Competitor Audit"], ["Growth Strategy", "Content Analytics"],
  ["Tasks", "Competitor Audit"], ["Tasks", "Content Analytics"], ["Tasks", "Content Queue"], ["Tasks", "Editorial Direction"], ["Tasks", "Feed Director"], ["Tasks", "Visual Style"],
  ["Editorial Direction", "Creative Director"], ["Editorial Direction", "Fact Checker"], ["Editorial Direction", "Visual Style"],
  ["Visual Style", "Feed Director"], ["Visual Style", "Tasks"],
  ["Home", "Analyst"], ["Home", "Art Director"], ["Home", "Competitor Audit"], ["Home", "Content Analytics"], ["Home", "Content Queue"], ["Home", "Copywriter"], ["Home", "Creative Director"], ["Home", "Fact Checker"], ["Home", "Feed Director"], ["Home", "Growth Strategy"], ["Home", "Lead Pipeline"], ["Home", "Log"], ["Home", "Orchestrator"], ["Home", "Schedule"], ["Home", "Tasks"], ["Home", "Tools"], ["Home", "Visual Style"], ["Home", "Voice"],
  ["Schedule", "Content Analytics"], ["Schedule", "Content Queue"], ["Schedule", "Log"], ["Schedule", "Tools"],
  ["Orchestrator", "Analyst"], ["Orchestrator", "Art Director"], ["Orchestrator", "Competitor Audit"], ["Orchestrator", "Content Queue"], ["Orchestrator", "Copywriter"], ["Orchestrator", "Creative Director"], ["Orchestrator", "Fact Checker"], ["Orchestrator", "Feed Director"], ["Orchestrator", "Home"], ["Orchestrator", "Log"], ["Orchestrator", "Schedule"], ["Orchestrator", "Tasks"],
  ["Creative Director", "Content Queue"], ["Creative Director", "Editorial Direction"], ["Creative Director", "Home"], ["Creative Director", "Log"], ["Creative Director", "Visual Style"], ["Creative Director", "Voice"],
  ["Fact Checker", "Editorial Direction"], ["Fact Checker", "Tasks"], ["Fact Checker", "Voice"],
  ["Analyst", "Content Queue"], ["Analyst", "Log"], ["Analyst", "Visual Style"], ["Analyst", "Voice"],
  ["Copywriter", "Content Queue"], ["Copywriter", "Editorial Direction"], ["Copywriter", "Voice"],
  ["Art Director", "Log"], ["Art Director", "Visual Style"],
  ["Feed Director", "Competitor Audit"], ["Feed Director", "Content Queue"], ["Feed Director", "Growth Strategy"], ["Feed Director", "Log"], ["Feed Director", "Visual Style"],
  ["Fact Checker", "Rising-cost / heat KB"], ["Fact Checker", "Installer-quality KB"], ["Fact Checker", "Solar-market KB"], ["Fact Checker", "Rates / supply KB"], ["Fact Checker", "AZ energy KB"],
  ["Copywriter", "Rising-cost / heat KB"], ["Copywriter", "Rates / supply KB"], ["Copywriter", "AZ energy KB"], ["Copywriter", "Solar-market KB"],
  ["Editorial Direction", "Rising-cost / heat KB"], ["Editorial Direction", "Installer-quality KB"], ["Editorial Direction", "Solar-market KB"], ["Editorial Direction", "Rates / supply KB"],
  ["Art Director", "IG / Higgsfield playbook"], ["Visual Style", "IG / Higgsfield playbook"],
  ["Content Queue", "Data centers heat"], ["Content Queue", "Hottest year"], ["Content Queue", "Battery VPP"], ["Content Queue", "APS bill climbs"], ["Content Queue", "Bill isn't going down"], ["Content Queue", "SRP rate design"],
  ["Data centers heat", "Rising-cost / heat KB"], ["Hottest year", "Rising-cost / heat KB"], ["Battery VPP", "Rising-cost / heat KB"], ["APS bill climbs", "Rates / supply KB"], ["APS bill climbs", "Rising-cost / heat KB"], ["Bill isn't going down", "Rising-cost / heat KB"], ["SRP rate design", "Rising-cost / heat KB"],
];

export const GRAPH_TAGS: Record<NodeGroup, string[]> = {
  agents: ["SPECIALIST-AGENT", "ORCHESTRATES"], system: ["SYSTEM-DOC", "OWNS_CONTEXT"],
  brand: ["BRAND-RULE", "GOVERNS"], analytics: ["ANALYTICS", "SIGNAL"], queue: ["PRODUCTION-LINE"],
  pipelines: ["PIPELINE"], knowledge: ["KB-SOURCE", "GROUNDS"], content: ["CONTENT-POST", "CITES"],
};
