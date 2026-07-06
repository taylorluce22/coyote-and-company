/**
 * Next Money Moves — the rules engine behind Today's queue.
 * Money order: respond to new leads > overdue follow-ups > hot conversations >
 * sphere/reactivation > seller-signal content > approvals > planning.
 * Call-type actions always outrank content-type. Max 5; done = gone.
 */

import type { AppState } from "./store";
import type { Opportunity } from "./engage";
import { isOverdue, isStale, needsResponse, type Contact } from "./pipeline";
import type { PlannedPost } from "./planner";
import type { StrategyProfile } from "./strategy";
import type { SourceEntry } from "./sources";
import { ENGINE_POSTS } from "./data";

export interface NextAction {
  id: string;
  title: string;
  detail: string;
  cta: string;
  color: string;
  go: { tab: string; contentTab?: string; engageTab?: string };
  weight: number;
}

export function deriveActions(state: AppState): NextAction[] {
  const strategy = state.strategy as StrategyProfile;
  const opps = (state.opportunities as Opportunity[]) || [];
  const contacts = (state.contacts as Contact[]) || [];
  const planned = (state.plannedPosts as PlannedPost[]) || [];
  const sources = (state.sources as SourceEntry[]) || [];
  const done = (state.doneActions as Record<string, boolean>) || {};
  const out: NextAction[] = [];

  // 110 — uncontacted leads (speed-to-lead beats everything)
  const fresh = contacts.filter(needsResponse);
  if (fresh.length)
    out.push({
      id: `act-respond-${fresh[0].id}-${fresh.length}`,
      title: `${fresh.length} lead${fresh.length > 1 ? "s" : ""} waiting for a first response`,
      detail: `${fresh[0].name}${fresh.length > 1 ? ` and ${fresh.length - 1} more` : ""} — every hour of silence costs conversion.`,
      cta: "Open respond queue",
      color: "#FF5D8F",
      go: { tab: "today" },
      weight: 110,
    });

  // 100 — overdue follow-ups
  const overdue = contacts.filter(isOverdue);
  overdue.slice(0, 2).forEach((c) =>
    out.push({
      id: `act-fu-${c.id}`,
      title: `Overdue follow-up: ${c.name}`,
      detail: c.note.slice(0, 100),
      cta: "Open People",
      color: "#FFC23D",
      go: { tab: "pipeline" },
      weight: 100,
    })
  );

  // 90 — hot conversations waiting for a reply
  opps
    .filter((o) => o.status === "new")
    .slice(0, 2)
    .forEach((o) =>
      out.push({
        id: `act-opp-${o.id}`,
        title: `Reply waiting: thread in ${o.sourceName}`,
        detail: `“${o.excerpt.slice(0, 90)}${o.excerpt.length > 90 ? "…" : ""}”`,
        cta: "Review & reply",
        color: "#26E0C8",
        go: { tab: "engage", engageTab: "opportunities" },
        weight: 90,
      })
    );

  // 85 — reactivation (stale relationships)
  const stale = contacts.filter(isStale);
  if (stale.length)
    out.push({
      id: `act-stale-${stale[0].id}-${stale.length}`,
      title: `${stale.length} relationship${stale.length > 1 ? "s" : ""} going stale (30+ days)`,
      detail: `${stale[0].name}${stale.length > 1 ? ` and ${stale.length - 1} more` : ""} — one honest check-in revives more deals than any ad.`,
      cta: "Open reactivation list",
      color: "#C9A8FF",
      go: { tab: "pipeline" },
      weight: 85,
    });

  // 80 — approvals (example queue only exists in demo mode)
  const pending = state.demoMode ? ENGINE_POSTS.filter((p) => !(state.approved as Record<string, boolean>)[p.id]).length : 0;
  if (pending > 0)
    out.push({
      id: "act-approve",
      title: `${pending} post${pending > 1 ? "s" : ""} waiting for your approval`,
      detail: "Drafted in your voice — approve and they're scheduled.",
      cta: "Review queue",
      color: "#A855F7",
      go: { tab: "content", contentTab: "queue" },
      weight: 80,
    });

  // 75 — listing-opportunity content: seller questions live in a territory
  const sellerT = strategy.territories.find((t) =>
    opps.some((o) => o.territory === t.name && o.tags.includes("market-question") && o.status !== "skipped")
  );
  if (sellerT)
    out.push({
      id: `act-seller-${sellerT.slug}`,
      title: `${sellerT.name} is asking seller questions`,
      detail: "Home-value threads are live there — seller education content converts this exact moment.",
      cta: "Draft seller content",
      color: sellerT.hex,
      go: { tab: "content", contentTab: "ideas" },
      weight: 75,
    });

  // 70 — week not planned
  if (!planned.some((p) => p.plannedDay))
    out.push({
      id: "act-plan-week",
      title: "This week isn't planned yet",
      detail: `One click drafts your ${strategy.postingTarget}-post week across best time slots.`,
      cta: "Plan my week",
      color: "#FF9A62",
      go: { tab: "content", contentTab: "week" },
      weight: 70,
    });

  // 60 — coverage gap
  const quiet = strategy.territories.find((t) => !opps.some((o) => o.territory === t.name));
  if (quiet)
    out.push({
      id: `act-quiet-${quiet.slug}`,
      title: `${quiet.name} has no conversations captured`,
      detail: "Scan the radar or open its communities — presence starts with one useful comment.",
      cta: "Find conversations",
      color: quiet.hex,
      go: { tab: "engage", engageTab: "opportunities" },
      weight: 60,
    });

  // 55 — empty rotation
  if (!sources.some((s) => s.status === "added"))
    out.push({
      id: "act-rotation",
      title: "Your community rotation is empty",
      detail: "Add 3–5 suggested communities so Farmhand knows where you engage.",
      cta: "Pick communities",
      color: "#7DD3FC",
      go: { tab: "engage", engageTab: "sources" },
      weight: 55,
    });

  return out
    .filter((a) => !done[a.id])
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

/** Presence Score — transparent inputs, each 0..1. */
export interface PresenceBreakdown {
  score: number;
  parts: { key: string; label: string; value: number; weight: number; tip: string }[];
}

export function presenceScore(state: AppState): PresenceBreakdown {
  const strategy = state.strategy as StrategyProfile;
  const opps = (state.opportunities as Opportunity[]) || [];
  const contacts = (state.contacts as Contact[]) || [];
  const planned = (state.plannedPosts as PlannedPost[]) || [];

  const scheduled = planned.filter((p) => p.plannedDay).length;
  const consistency = Math.min(1, scheduled / Math.max(1, strategy.postingTarget));

  const covered = strategy.territories.filter((t) => opps.some((o) => o.territory === t.name)).length;
  const coverage = strategy.territories.length ? covered / strategy.territories.length : 0;

  const engagedCount = opps.filter((o) => o.status === "engaged").length;
  const engagement = Math.min(1, 0.3 + engagedCount * 0.175);

  // follow-up discipline: of contacts with a next-touch set, how many aren't overdue?
  const withNext = contacts.filter((c) => c.nextTouchAt && !c.stage.startsWith("closed"));
  const overdueN = withNext.filter(isOverdue).length;
  const discipline = withNext.length ? (withNext.length - overdueN) / withNext.length : contacts.length ? 0.5 : 0;

  const tended = contacts.filter((c) => c.nextTouchAt || c.stage === "consult" || c.stage === "active" || c.stage === "under_contract").length;
  const hygiene = contacts.length ? tended / contacts.length : 0;

  const parts = [
    { key: "consistency", label: "Consistency", value: consistency, weight: 0.3, tip: `${scheduled}/${strategy.postingTarget} posts planned this week — plan the rest` },
    { key: "coverage", label: "Territory coverage", value: coverage, weight: 0.2, tip: `${covered}/${strategy.territories.length} territories have live conversations` },
    { key: "engagement", label: "Engagement", value: engagement, weight: 0.2, tip: engagedCount ? `${engagedCount} replies posted — keep going` : "Post your first community reply this week" },
    { key: "discipline", label: "Follow-up discipline", value: discipline, weight: 0.2, tip: overdueN ? `${overdueN} overdue follow-up${overdueN > 1 ? "s" : ""} — clear them today` : "Set a next-touch date on every active person" },
    { key: "hygiene", label: "Pipeline hygiene", value: hygiene, weight: 0.1, tip: "Give every warm contact a next-touch date" },
  ];
  const score = Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) * 100);
  return { score, parts };
}
