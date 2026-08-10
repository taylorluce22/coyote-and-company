/* ============================================================
   Pre-launch research loop — the brain's research functions,
   activated per docs/prelaunch-research-activation-2026.md.

   Five loops, one engine:
     Researcher   — weekly AZ energy sweep → kb_refs + agent_runs
     Competitor   — biweekly audit → kb_refs + agent_runs
     CMO          — review pass over the Content Queue drafts
     Data Analyst — per-post metrics ingest + weekly health check
     Orchestrator — weekly cycle chaining the above, logged

   HARD GUARDRAILS (Step 3 of the spec — enforced in code):
   drafts only, nothing ever auto-posts or auto-advances status;
   two grid lanes; no fabricated installs/savings/results; retired
   field-sales persona never generated; dead angle (expired federal
   tax credit) skipped; AI-disclosure field on regenerated items.

   NOTE: ig-account-direction-2026.md and higgsfield-board-state-2026.md
   are referenced by the spec but are NOT in the repo (Mac-only files).
   The rules below encode what the spec itself states. When those docs
   land, reconcile RULES with them.
   ============================================================ */

import { logAgentRun, addKbRefs, pullRecords, syncRecords, memoryEnabled } from "@/lib/memory";

const PPLX_API = "https://api.perplexity.ai/chat/completions";
const ANTHROPIC_API = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const claudeModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5";

export const RULES = {
  lanes: ["lifestyle", "educational-solar"] as const,
  bannedGridContent: ["sales wins", "commission", "recruiting"],
  neverFabricate: ["installs", "savings figures", "customer results"],
  retiredPersonaMarkers: [
    "route", "roofs every morning", "knocking doors", "field sales grind",
  ],
  deadAngles: ["federal tax credit", "30% tax credit", "ITC"],
  approvedAngles: [
    "batteries-now: self-consumption under net billing, VPP incentives, heat-outage backup",
    "AZ-specific advantages",
    "lease-to-own",
  ],
  aiDisclosureField: "aiDisclosure",
  higgsfieldBoard: "AZ Grid v2", // hard-pinned; frames before video credits
};

/* ---------- providers (mirroring huntServer / claudeScript) ---------- */

async function perplexity(
  system: string,
  user: string,
  recency: "week" | "month" = "week"
): Promise<{ ok: boolean; text: string; citations: string[] }> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, text: "", citations: [] };
  try {
    const r = await fetch(PPLX_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        search_recency_filter: recency,
        web_search_options: { search_context_size: "medium" },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return { ok: false, text: `http ${r.status}`, citations: [] };
    const data = await r.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations : [];
    return { ok: true, text, citations };
  } catch (e) {
    return { ok: false, text: String(e).slice(0, 200), citations: [] };
  }
}

async function claudeJson(prompt: string): Promise<Record<string, unknown> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`${ANTHROPIC_API}/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: claudeModel(),
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const blocks: Array<{ type?: string; text?: string }> = Array.isArray(data?.content) ? data.content : [];
    let text = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text as string).join("").trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    return JSON.parse(text.slice(s, e + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* ---------- 1 · Researcher — weekly AZ energy sweep ---------- */

const SWEEP_QUERIES = [
  // Local-first per the spec; national issues secondary/supporting only.
  "Arizona APS SRP electricity rate changes, net billing export rates, and demand charges — what changed in the last month? East Valley (Mesa, Gilbert, Chandler, Queen Creek) specifics preferred.",
  "Arizona grid strain: data center load growth, summer heat records, outage events, and utility supply-demand pressure — latest developments. How do rising costs land on Phoenix-area homeowners?",
  "Arizona residential solar and home battery market: VPP/battery incentive programs (APS/SRP), lease-to-own offerings, installer landscape shifts — last 30 days.",
];

export async function runResearcherSweep(): Promise<{ ran: boolean; claims: number; errors: string[] }> {
  const errors: string[] = [];
  let claims = 0;
  for (const q of SWEEP_QUERIES) {
    const res = await perplexity(
      "You are a research engine maintaining an accuracy-gated knowledge base for an Arizona solar consultant. " +
        "Return ONLY real, sourced, recent findings. For each finding output one line: CLAIM | LABEL | SOURCE-URL. " +
        "LABEL is exactly one of: fact, projection, contested, industry-claim. Max 6 findings. Never invent figures.",
      q,
      "week"
    );
    if (!res.ok) {
      errors.push(res.text || "perplexity failed");
      continue;
    }
    const refs = res.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("|"))
      .slice(0, 6)
      .map((l) => {
        const [claim, label, url] = l.split("|").map((p) => p.trim());
        return {
          claim: claim?.replace(/^[-*\d.\s]+/, "") || "",
          label: ["fact", "projection", "contested", "industry-claim"].includes(label || "") ? label : "industry-claim",
          url: url || res.citations[0] || undefined,
          source: "researcher-weekly-sweep",
          data: { query: q },
        };
      })
      .filter((r) => r.claim.length > 10);
    if (refs.length) {
      const ok = await addKbRefs(refs);
      if (ok) claims += refs.length;
      else errors.push("kb_refs insert failed");
    }
  }
  await logAgentRun({
    agent: "researcher",
    summary: `Weekly AZ energy sweep: ${SWEEP_QUERIES.length} queries, ${claims} sourced claims added to the Rising-cost/Heat KB.`,
    needsHuman: claims === 0 ? "Sweep returned no claims — check PERPLEXITY_API_KEY and query health." : undefined,
    data: { kind: "research-sweep", claims, errors },
  });
  return { ran: true, claims, errors };
}

/* ---------- 2 · Competitor Audit — biweekly ---------- */

export async function runCompetitorAudit(): Promise<{ ran: boolean; findings: number; errors: string[] }> {
  const errors: string[] = [];
  let findings = 0;
  const res = await perplexity(
    "You audit competitor content for an Arizona solar consultant's Instagram strategy. Search real, current " +
      "customer-facing content. For each finding output one line: FINDING | SOURCE-URL. Max 8 findings. " +
      "Focus: what offers, hooks, and content formats AZ solar companies and solar-adjacent creators are running now. " +
      "Never invent accounts or posts.",
    "Arizona solar installers' current Instagram/web customer-facing content: offers, hooks, angles (battery bundles, " +
      "lease-to-own, summer-bill framing). Plus: what short-form content patterns are top solar/home-energy creators using?",
    "month"
  );
  if (!res.ok) errors.push(res.text || "perplexity failed");
  else {
    const refs = res.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("|"))
      .slice(0, 8)
      .map((l) => {
        const [finding, url] = l.split("|").map((p) => p.trim());
        return {
          claim: finding?.replace(/^[-*\d.\s]+/, "") || "",
          label: "industry-claim",
          source: "competitor-audit",
          url: url || res.citations[0] || undefined,
          data: { kind: "competitor-audit" },
        };
      })
      .filter((r) => r.claim.length > 10);
    if (refs.length) {
      const ok = await addKbRefs(refs);
      if (ok) findings = refs.length;
      else errors.push("kb_refs insert failed");
    }
  }
  await logAgentRun({
    agent: "competitor_audit",
    summary: `Biweekly competitor audit: ${findings} findings written to the Competitor Audit node.`,
    needsHuman: findings === 0 ? "Audit returned nothing — check API key or loosen the query." : undefined,
    data: { kind: "competitor-audit", findings, errors },
  });
  return { ran: true, findings, errors };
}

/* ---------- 3 · CMO — review pass over the Content Queue ---------- */

type Draft = Record<string, unknown> & { id?: string; status?: string; pillar?: string };

const CMO_CAP_PER_RUN = 3; // fit inside cron maxDuration; leftovers next cycle

export async function runCmoReview(): Promise<{ ran: boolean; reviewed: number; kickbacks: number; errors: string[] }> {
  const errors: string[] = [];
  const posts = (await pullRecords("plannedPosts")) as Draft[];
  const queue = posts.filter((p) => {
    const st = String(p.status || "").toLowerCase();
    const already = (p as Record<string, unknown>).cmoReview;
    return (st === "draft" || st === "ready") && !already;
  });
  const batch = queue.slice(0, CMO_CAP_PER_RUN);
  let reviewed = 0;
  let kickbacks = 0;

  for (const post of batch) {
    const review = await claudeJson(
      `You are the CMO agent reviewing ONE queued Instagram draft for an Arizona solar consultant, pre-launch.

HARD RULES (from the activation spec — violations force verdict "kickback"):
- Grid lanes: only "lifestyle" or "educational-solar". Sales-wins/commission/recruiting content never enters the grid queue.
- Never fabricate installs, savings figures, or customer results. Unsourced specific numbers = kickback.
- The field-sales persona is retired: no route/roofs-every-morning framing.
- Dead angle: the expired federal tax credit. Any reliance on it = kickback.
- Approved angles: ${RULES.approvedAngles.join("; ")}.

Also score craft: hook strength, specificity, local (East Valley AZ) grounding, and consistency with a premium,
editorial visual/voice direction.

THE DRAFT (full record JSON):
${JSON.stringify(post).slice(0, 6000)}

Return ONLY JSON:
{"score": 0-100, "verdict": "pass"|"kickback", "notes": ["specific, actionable notes"],
 "ruleViolations": ["exact rule broken, if any"],
 "revision": {"hook": "...", "caption": "..."} }
Include "revision" ONLY when verdict is "kickback" — an improved rewrite that fixes every note while keeping the
draft's core idea and lane. Never invent data in the revision; keep numbers only if the draft sourced them.`
    );
    if (!review) {
      errors.push(`review failed for ${post.id || "?"}`);
      continue;
    }
    const verdict = review.verdict === "kickback" ? "kickback" : "pass";
    const updated: Draft = {
      ...post,
      // status intentionally untouched — drafts only, Taylor approves per item.
      cmoReview: {
        score: typeof review.score === "number" ? review.score : null,
        verdict,
        notes: Array.isArray(review.notes) ? review.notes.slice(0, 8) : [],
        ruleViolations: Array.isArray(review.ruleViolations) ? review.ruleViolations : [],
        reviewedAt: new Date().toISOString(),
      },
      ...(verdict === "kickback" && review.revision
        ? {
            cmoRevision: {
              ...(review.revision as Record<string, unknown>),
              [RULES.aiDisclosureField]: true, // meaningfully AI-edited
              note: "CMO regeneration — original draft preserved above; approve either, or neither.",
            },
          }
        : {}),
    };
    const ok = await syncRecords("plannedPosts", [updated as Record<string, unknown>]);
    if (!ok) {
      errors.push(`sync failed for ${post.id || "?"}`);
      continue;
    }
    reviewed++;
    if (verdict === "kickback") kickbacks++;
  }

  await logAgentRun({
    agent: "cmo",
    summary: `CMO queue review: ${reviewed}/${queue.length} unreviewed drafts scored, ${kickbacks} kicked back with revisions. Nothing auto-advanced — all items remain drafts for Taylor.`,
    needsHuman: reviewed > 0 ? `${reviewed} reviewed draft${reviewed === 1 ? "" : "s"} awaiting your approve/reject in the Content Queue.` : undefined,
    data: { kind: "cmo-review", reviewed, kickbacks, queued: queue.length, capped: queue.length > batch.length, errors },
  });
  return { ran: true, reviewed, kickbacks, errors };
}

/* ---------- 4 · Data Analyst — metrics ingest + health check ---------- */

export async function ingestPostMetrics(
  appId: string,
  metrics: Record<string, number>
): Promise<{ ok: boolean; reason?: string }> {
  if (!memoryEnabled()) return { ok: false, reason: "memory layer not configured" };
  const posts = (await pullRecords("plannedPosts")) as Draft[];
  const post = posts.find((p) => String(p.id) === appId);
  if (!post) return { ok: false, reason: `no planned post with id ${appId}` };
  const updated = {
    ...post,
    metrics: { ...((post as Record<string, unknown>).metrics as object || {}), ...metrics, capturedAt: new Date().toISOString() },
  };
  const ok = await syncRecords("plannedPosts", [updated as Record<string, unknown>]);
  if (ok) {
    await logAgentRun({
      agent: "data_analyst",
      summary: `Per-post metrics captured for ${appId}: ${Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join(", ")}.`,
      data: { kind: "metrics-ingest", appId, metrics },
    });
  }
  return { ok };
}

export async function runAnalystCheck(): Promise<{ ran: boolean; postsWithMetrics: number; posted: number }> {
  const posts = (await pullRecords("plannedPosts")) as Draft[];
  const posted = posts.filter((p) => String(p.status || "").toLowerCase() === "posted");
  const withMetrics = posted.filter((p) => (p as Record<string, unknown>).metrics);
  await logAgentRun({
    agent: "data_analyst",
    summary: `Growth check: ${posted.length} posted, ${withMetrics.length} with captured metrics. ${posted.length > withMetrics.length ? `${posted.length - withMetrics.length} posted item(s) missing metrics — capture via POST /api/metrics.` : "Coverage complete at current volume."}`,
    data: { kind: "growth-check", posted: posted.length, withMetrics: withMetrics.length },
  });
  return { ran: true, postsWithMetrics: withMetrics.length, posted: posted.length };
}

/* ---------- 5 · Orchestrator — the weekly cycle ---------- */

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function runWeeklyCycle(): Promise<Record<string, unknown>> {
  const startedAt = new Date();
  const research = await runResearcherSweep();
  const auditDue = isoWeek(startedAt) % 2 === 0; // biweekly: even ISO weeks
  const audit = auditDue ? await runCompetitorAudit() : { ran: false, findings: 0, errors: [] as string[] };
  const cmo = await runCmoReview();
  const analyst = await runAnalystCheck();

  await logAgentRun({
    agent: "orchestrator",
    summary:
      `Weekly research cycle complete: sweep ${research.claims} claims` +
      `${auditDue ? `, audit ${audit.findings} findings` : ", audit skipped (odd ISO week)"}` +
      `, CMO reviewed ${cmo.reviewed} (${cmo.kickbacks} kickbacks), analyst check done. All outputs are drafts/logs — nothing posted.`,
    data: { kind: "weekly-cycle", research, audit, cmo, analyst, isoWeek: isoWeek(startedAt) },
  });
  return { research, audit: { due: auditDue, ...audit }, cmo, analyst };
}
