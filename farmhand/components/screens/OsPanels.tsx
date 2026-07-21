"use client";

/**
 * Lightweight OS panels — real vault summaries for the nav sections that
 * don't have a dedicated interactive screen yet (Tasks, Schedule, Tools).
 */

type Row = [string, string, string]; // label, meta, dotColor

function Panel({ title, sub, rows }: { title: string; sub: string; rows: Row[] }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "70ch", marginTop: 0, marginBottom: 18 }}>{sub}</p>
      <div className="fh-glass" style={{ borderRadius: 15, padding: "8px 18px", maxWidth: 620 }}>
        {rows.map(([label, meta, dot]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flex: "none" }} />
            {label}
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#8B89A0" }}>{meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TasksPanel() {
  return (
    <Panel
      title="Tasks"
      sub="Operational board — system work the Orchestrator triages. Content work lives in the Content queue."
      rows={[
        ["Approve the 5 briefs", "needs taylor", "#FFC23D"],
        ["Pexels API key", "needs taylor", "#FFC23D"],
        ["Reel Coach keys (Gemini + Blob)", "needs taylor", "#FFC23D"],
        ["Photo dump → brand/refs", "open", "#7DD3FC"],
        ["Wire /api/stock backgrounds", "backlog", "#26E0C8"],
        ["Feed Director grid plan", "backlog", "#26E0C8"],
      ]}
    />
  );
}

export function SchedulePanel() {
  return (
    <Panel
      title="Schedule"
      sub="Autonomous runs are owner-paused. The system runs on manual passes only until content is dialed in."
      rows={[
        ["Orchestrator cron", "deleted / paused", "#FFC23D"],
        ['Manual "run the brain"', "on demand", "#7DD3FC"],
      ]}
    />
  );
}

export function ToolsPanel() {
  return (
    <Panel
      title="Tools"
      sub="What the agents can use, what it costs, and the rules. Credit-preservation policy is binding."
      rows={[
        ["Higgsfield Soul", "~1 credit / image", "#FF9A62"],
        ["Perplexity sonar", "pennies / run", "#7DD3FC"],
        ["Gemini video (Reel Coach)", "pay-as-you-go", "#7BE495"],
        ["Pexels / stock", "free (needs key)", "#26E0C8"],
        ["Post Studio", "free", "#FF9EC4"],
      ]}
    />
  );
}
