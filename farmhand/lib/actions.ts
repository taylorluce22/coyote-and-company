/**
 * Next Actions — the rules engine behind Today's queue.
 * rank = impact × urgency × strategy fit, expressed as transparent weights:
 * expiring conversation replies > due follow-ups > approvals > coverage gaps.
 * Max 5 shown; completing one removes it.
 */

import type { AppState } from "./store";
import type { Opportunity } from "./engage";
import type { Contact } from "./pipeline";
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

  // 1 — conversations waiting (these expire fastest)
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
        weight: 100,
      })
    );

  // 2 — follow-ups due
  contacts
    .filter((c) => c.nextTouch)
    .slice(0, 2)
    .forEach((c) =>
      out.push({
        id: `act-fu-${c.id}`,
        title: `Follow up with ${c.name} — ${c.nextTouch}`,
        detail: c.note.slice(0, 100),
        cta: "Open pipeline",
        color: "#FFC23D",
        go: { tab: "pipeline" },
        weight: 90,
      })
    );

  // 3 — posts waiting for approval
  const pending = ENGINE_POSTS.filter((p) => !(state.approved as Record<string, boolean>)[p.id]).length;
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

  // 4 — week not planned
  if (!planned.some((p) => p.plannedDay))
    out.push({
      id: "act-plan-week",
      title: "This week isn't planned yet",
      detail: `One click drafts your ${strategy.postingTarget}-post week across best time slots.`,
      cta: "Plan my week",
      color: "#FF5D8F",
      go: { tab: "content", contentTab: "week" },
      weight: 70,
    });

  // 5 — coverage gap: a territory with zero captured conversations
  const quiet = strategy.territories.find((t) => !opps.some((o) => o.territory === t.name));
  if (quiet)
    out.push({
      id: `act-quiet-${quiet.slug}`,
      title: `${quiet.name} has no conversations captured`,
      detail: "Scan the radar or open its suggested communities — presence starts with one useful comment.",
      cta: "Find conversations",
      color: quiet.hex,
      go: { tab: "engage", engageTab: "opportunities" },
      weight: 60,
    });

  // 6 — empty rotation
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

  const tended = contacts.filter((c) => c.nextTouch || c.stage === "consult" || c.stage === "active").length;
  const hygiene = contacts.length ? tended / contacts.length : 0;

  const parts = [
    { key: "consistency", label: "Consistency", value: consistency, weight: 0.35, tip: `${scheduled}/${strategy.postingTarget} posts planned this week — plan the rest` },
    { key: "coverage", label: "Territory coverage", value: coverage, weight: 0.25, tip: `${covered}/${strategy.territories.length} territories have live conversations — capture one in the quiet areas` },
    { key: "engagement", label: "Engagement", value: engagement, weight: 0.25, tip: engagedCount ? `${engagedCount} replies posted — keep the streak` : "Post your first community reply this week" },
    { key: "hygiene", label: "Pipeline hygiene", value: hygiene, weight: 0.15, tip: "Give every warm contact a next-touch date" },
  ];
  const score = Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) * 100);
  return { score, parts };
}
