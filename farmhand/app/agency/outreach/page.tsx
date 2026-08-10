import { supabaseEnabled, sbSelect } from "@/lib/supabase";
import { summarizeOutreach } from "@/lib/agencyOutreach.mjs";
import { gmailEnabled } from "@/lib/gmailSend";
import OutreachRow, { type Item } from "./OutreachRow";

/**
 * Agency OS · Outreach — the queue of drafted touches, wired to real Gmail
 * drafts. Server component, same shared-memory pattern as the Money screen:
 * reads Supabase, computes with lib/agencyOutreach.mjs, renders truth.
 *
 * The app never sends. Each row opens its actual Gmail draft; Taylor sends
 * there and the status comes back here. Nothing on this page can transmit
 * mail, which is why it can show every queued item without a safety gate.
 */

export const dynamic = "force-dynamic";

type Summary = {
  asOf: string;
  total: number;
  queued: number;
  sent: number;
  replied: number;
  skipped: number;
  byStage: Record<string, Record<string, number>>;
  oldestQueuedDays: number;
  items: Item[];
};

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0c0f0d", color: "#e8e6df", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "48px 24px" },
  wrap: { maxWidth: 960, margin: "0 auto" },
  kicker: { fontSize: 11, letterSpacing: "0.25em", color: "#8a9187", textTransform: "uppercase" as const },
  h1: { fontSize: 28, margin: "8px 0 8px", fontWeight: 600 },
  lede: { fontSize: 13, color: "#8a9187", lineHeight: 1.6, marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 },
  card: { border: "1px solid #232a24", borderRadius: 10, padding: "16px 18px", background: "#111512" },
  label: { fontSize: 11, color: "#8a9187", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 },
  num: { fontSize: 26, fontWeight: 600 },
  sub: { fontSize: 12, color: "#8a9187", marginTop: 4 },
  h2: { fontSize: 13, letterSpacing: "0.15em", color: "#8a9187", textTransform: "uppercase" as const, margin: "32px 0 4px" },
  note: { fontSize: 13, color: "#8a9187", lineHeight: 1.6 },
  warn: { border: "1px solid #4a3a1a", background: "#1a150c", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#d8c9a3", marginBottom: 24, lineHeight: 1.6 },
};

export default async function AgencyOutreach() {
  if (!supabaseEnabled()) {
    return (
      <main style={S.page}>
        <div style={S.wrap}>
          <div style={S.kicker}>Sonoran Clinical Partners · Agency OS</div>
          <h1 style={S.h1}>Outreach</h1>
          <div style={S.warn}>
            Not connected. This screen reads the shared Supabase memory layer and the keys are not
            set. One-time setup: run <code>supabase/agency-outreach-schema.sql</code> in the
            Supabase SQL editor (same project as the money schema). No queue is shown because none
            would be real.
          </div>
        </div>
      </main>
    );
  }

  const rows = await sbSelect("agency_outreach", "workspace=eq.agency&order=drafted_on.desc&limit=2000");
  const s = summarizeOutreach(rows) as unknown as Summary;
  const canSend = gmailEnabled();

  const tiles = [
    { label: "Queued", value: String(s.queued), sub: s.oldestQueuedDays ? `oldest drafted ${s.oldestQueuedDays}d ago` : "nothing waiting" },
    { label: "Sent", value: String(s.sent), sub: "recorded after sending" },
    { label: "Replied", value: String(s.replied), sub: "counterparty came back" },
    { label: "Skipped", value: String(s.skipped), sub: "decided against" },
  ];

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <div style={S.kicker}>Sonoran Clinical Partners · Agency OS</div>
        <h1 style={S.h1}>Outreach — as of {s.asOf}</h1>
        <p style={S.lede}>
          Every row is a real draft sitting in Gmail. <strong>Open in Gmail</strong> takes you
          straight to the conversation with the draft in it.{" "}
          {canSend ? (
            <>
              <strong>Send</strong> arms, and a second press sends that one draft as written — one
              row per press, never a batch, and only rows still queued.
            </>
          ) : (
            <>
              Sending from this screen is not configured, so the app cannot transmit mail — send
              from Gmail and mark the row. Setup: <code>docs/gmail-send-setup.md</code>.
            </>
          )}
        </p>

        <div style={S.grid}>
          {tiles.map((t) => (
            <div key={t.label} style={S.card}>
              <div style={S.label}>{t.label}</div>
              <div style={S.num}>{t.value}</div>
              <div style={S.sub}>{t.sub}</div>
            </div>
          ))}
        </div>

        <div style={S.h2}>Queue</div>
        <div style={{ ...S.note, marginBottom: 12 }}>
          {s.total === 0
            ? "Empty. Drafts registered by the outreach agent appear here."
            : `${s.total} touch${s.total === 1 ? "" : "es"} tracked.`}
        </div>

        {s.items.map((item) => (
          <OutreachRow key={item.id} item={item} canSend={canSend} />
        ))}

        <p style={{ ...S.note, marginTop: 40 }}>
          A row exists only when its Gmail draft exists — the queue never shows a touch that
          hasn&apos;t been written. Status vocabulary and cadence ages:{" "}
          <code>lib/agencyOutreach.mjs</code>, proven by its test file.
        </p>
      </div>
    </main>
  );
}
