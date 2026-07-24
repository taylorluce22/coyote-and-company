/**
 * Launch plan — the build's road to launch as a checklist, distilled from the
 * three agent briefs (docs/dev-brief-first-revenue-slice.md, the strategy
 * brief, docs/first-client-playbook.md) and rendered by the Progress screen.
 *
 * Phases are sequential: finish the Taylor Solar test period (dogfooding the
 * founder's real business as client #1), build the efficiency layer the test
 * period informs, clear launch-readiness gates, then launch. Items marked
 * `shipped` are locked-done (they merged to production in PR #135); the rest
 * are checked off by the operator and persist in localStorage — build
 * progress is global, not per-client data.
 */

export interface LaunchItem {
  id: string;
  label: string;
  note?: string;
  /** built + merged — rendered as locked done */
  shipped?: boolean;
}

export interface LaunchPhase {
  id: string;
  kicker: string;
  title: string;
  goal: string;
  color: string;
  items: LaunchItem[];
}

export const LAUNCH_PLAN: LaunchPhase[] = [
  {
    id: "foundation",
    kicker: "Phase 1",
    title: "Foundation — First-Revenue Slice",
    goal: "The app can service isolated client accounts with cost control and a client-facing deliverable.",
    color: "#41D98A",
    items: [
      { id: "f-e1", label: "Operator multi-client mode (E1)", note: "Isolated client accounts · top-bar switcher pill · add/rename/remove/backup/restore", shipped: true },
      { id: "f-e4", label: "Per-client cost meter + allowance guard (E4)", note: "Generation ledger · monthly cap · warn 80% / block 100% · Settings card", shipped: true },
      { id: "f-packet", label: "Monday packet export (E2-3)", note: "Branded print-to-PDF weekly deliverable: posts, conversations, visuals, next move", shipped: true },
      { id: "f-harden", label: "Isolation hardening (Dev-audit fixes)", note: "Memory route per-client · Soul ID + pending batch namespaced · lossless bundles · complete purge", shipped: true },
      { id: "f-narrative", label: "Editorial narrative gate", note: "Intel + copy framed on pain/utility tactics — reassurance angles filtered at generation AND render", shipped: true },
      { id: "f-sticky", label: "Sticky-button + save-freeze fix", note: "No hit-target transforms · debounced multi-MB persist with loss-proof flushes", shipped: true },
      { id: "f-merge", label: "Merged to production (#135)", note: "27 commits · tsc + build green · live on the deployed app", shipped: true },
    ],
  },
  {
    id: "pilot",
    kicker: "Phase 2",
    title: "Taylor Solar test period",
    goal: "Run the real solar business through the app for a full cycle — every friction point becomes backlog.",
    color: "#FFC23D",
    items: [
      { id: "p-account", label: "Switch to My Solar · real and confirm ACTIVE", note: "Client pill, top-right — check it every session" },
      { id: "p-territories", label: "Set real solar territories", note: "Settings → Solar territories — names drive lead-hunt keywords, APS/SRP tags drive rate math" },
      { id: "p-keys", label: "Verify generation keys in Connectors", note: "Perplexity (copy) + Higgsfield (images) — the Connectors tab probes live; ignore the Settings demo card" },
      { id: "p-first-post", label: "Publish the first post", note: "Ideas → Studio → Sharpen copy → visuals → Download all → post to IG → mark Posted" },
      { id: "p-week", label: "Complete a full week on rhythm", note: "3+ posts · Mon build session · 15 min/day lead pipeline · Fri packet + backup" },
      { id: "p-leads", label: "Engage 3 real conversations from the Lead Pipeline", note: "Genuine, no-pitch first comments in your territories" },
      { id: "p-packet", label: "Generate your own Monday packet", note: "Use it as the weekly scorecard — this is what future clients receive" },
      { id: "p-backup", label: "Back up the client bundle weekly", note: "Settings → Clients → Back up — the only safety net while data is browser-local" },
      { id: "p-friction", label: "Keep the friction log", note: "Every manual step, silent failure, or realtor-shaped surface — it IS the build backlog" },
    ],
  },
  {
    id: "efficiency",
    kicker: "Phase 3",
    title: "Efficiency build",
    goal: "Turn test-period friction into product — cut servicing to ≤1 hr per client per week.",
    color: "#E8622C",
    items: [
      { id: "e-brand", label: "Brand identity field", note: "Real business name + IG handle on every image — kills the taylor.solar.az placeholder" },
      { id: "e-onboard", label: "New-client onboarding polish", note: "No seed-identity flash — a new client lands on clean intake" },
      { id: "e-weekly", label: "E2 — one-command “Run this week”", note: "Refresh leads → rank → draft posts → stage packet, per client, one action" },
      { id: "e-planner", label: "De-realtor the Planner", note: "Solar topic seeds + hashtags — currently realtor-shaped per the playbook audit" },
    ],
  },
  {
    id: "launch",
    kicker: "Phase 4",
    title: "Launch readiness",
    goal: "Safe to onboard paying clients beyond the founder.",
    color: "#7DD3FC",
    items: [
      { id: "l-leadstore", label: "Server lead-store namespacing", note: "fh:<clientId> in KV — the gate before the always-on cron ever turns on" },
      { id: "l-qa", label: "Two-client isolation QA pass", note: "State, image vault, reel vault, meter, Soul ID, pending batch, packet — documented" },
      { id: "l-runbook", label: "Operator runbook", note: "One page: onboard → run week → read meter → send packet → weekly backup" },
      { id: "l-approve", label: "E3 — client approve/reject link", note: "Public link forces the first slice of server-of-record + auth — paired, not premature" },
      { id: "l-scale", label: "Durability + auth + billing", note: "Server-authoritative storage with RLS, operator login, retainer collection — the scale gate" },
    ],
  },
];

export const LAUNCH_PROGRESS_KEY = "farmhand-launch-progress";

export function loadChecks(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LAUNCH_PROGRESS_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function saveChecks(checks: Record<string, boolean>): void {
  try {
    localStorage.setItem(LAUNCH_PROGRESS_KEY, JSON.stringify(checks));
  } catch {}
}
