import { supabaseEnabled, sbSelect } from "@/lib/supabase";
import { computeMoney } from "@/lib/agencyMoney.mjs";

/**
 * Agency OS · Money — the real MRR layer for Sonoran Clinical Partners.
 * Server component: reads Supabase directly (same shared-memory pattern
 * as the farmhand OS), computes with lib/agencyMoney.mjs, renders truth.
 * No keys → an honest "not connected" state, never fake numbers.
 */

export const dynamic = "force-dynamic";

type Acct = { supplier: string; buyer: string; recurring: boolean; mrrContribution: number };
type Unattr = { supplier: string; buyer: string; amount: number; collected_on: string; reason: string };
type Agreement = {
  supplier: string; status: string; commission_pct: number;
  meeting_fee: number; effective: string | null;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0c0f0d", color: "#e8e6df", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "48px 24px" },
  wrap: { maxWidth: 960, margin: "0 auto" },
  kicker: { fontSize: 11, letterSpacing: "0.25em", color: "#8a9187", textTransform: "uppercase" as const },
  h1: { fontSize: 28, margin: "8px 0 32px", fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 32 },
  card: { border: "1px solid #232a24", borderRadius: 10, padding: "18px 20px", background: "#111512" },
  label: { fontSize: 11, color: "#8a9187", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 },
  num: { fontSize: 26, fontWeight: 600 },
  sub: { fontSize: 12, color: "#8a9187", marginTop: 4 },
  h2: { fontSize: 13, letterSpacing: "0.15em", color: "#8a9187", textTransform: "uppercase" as const, margin: "32px 0 12px" },
  row: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1a201b", fontSize: 14 },
  note: { fontSize: 13, color: "#8a9187", lineHeight: 1.6 },
  warn: { border: "1px solid #4a3a1a", background: "#1a150c", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#d8c9a3", marginBottom: 24 },
};

export default async function AgencyMoney() {
  if (!supabaseEnabled()) {
    return (
      <main style={S.page}>
        <div style={S.wrap}>
          <div style={S.kicker}>Sonoran Clinical Partners · Agency OS</div>
          <h1 style={S.h1}>Money</h1>
          <div style={S.warn}>
            Not connected. This screen reads the shared Supabase memory layer and the keys are not
            set. One-time setup: run <code>supabase/agency-schema.sql</code> in the Supabase SQL
            editor (same project as the farmhand schema) — the env vars already configured for the
            app cover this screen too. No numbers are shown because none would be real.
          </div>
        </div>
      </main>
    );
  }

  const ws = "workspace=eq.agency";
  const [agreements, meetings, collections] = await Promise.all([
    sbSelect<Agreement>("agency_agreements", `${ws}&order=created_at.desc&limit=500`),
    sbSelect("agency_meetings", `${ws}&order=held_on.desc&limit=2000`),
    sbSelect("agency_collections", `${ws}&order=collected_on.desc&limit=5000`),
  ]);
  const m = computeMoney({ agreements, meetings, collections }) as {
    asOf: string; mrr: number; newMrr: number; churnedMrr: number;
    recurringAccounts: number; totalAccounts: number;
    grossThisMonth: number; commissionThisMonth: number;
    meetingFeesThisMonth: number; meetingsHeldThisMonth: number;
    commissionsUnpaid: number; unattributedCollections: Unattr[]; accounts: Acct[];
  };

  const tiles = [
    { label: "MRR", value: usd(m.mrr), sub: `${m.recurringAccounts} recurring account${m.recurringAccounts === 1 ? "" : "s"}` },
    { label: "New MRR (30d)", value: usd(m.newMrr), sub: "accounts newly recurring" },
    { label: "Churned MRR (30d)", value: usd(m.churnedMrr), sub: "recurring then, not now" },
    { label: "Gross this month", value: usd(m.grossThisMonth), sub: `${usd(m.commissionThisMonth)} commission + ${usd(m.meetingFeesThisMonth)} meeting fees` },
    { label: "Meetings held (month)", value: String(m.meetingsHeldThisMonth), sub: "qualified-held, fee-bearing" },
    { label: "Commission unpaid", value: usd(m.commissionsUnpaid), sub: "earned, not yet received" },
  ];

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <div style={S.kicker}>Sonoran Clinical Partners · Agency OS</div>
        <h1 style={S.h1}>Money — as of {m.asOf}</h1>
        <p style={{ ...S.note, marginTop: -20, marginBottom: 28 }}>
          <a href="/agency/outreach" style={{ color: "#8ab4d1" }}>Outreach queue →</a>
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

        {m.unattributedCollections.length > 0 && (
          <div style={S.warn}>
            {m.unattributedCollections.length} collection{m.unattributedCollections.length === 1 ? "" : "s"} with no
            signed agreement covering the date — money reported but attributing $0 commission (G7).
            Fix by signing/activating the agreement, not by editing the number.
            {m.unattributedCollections.map((u, i) => (
              <div key={i} style={{ marginTop: 8 }}>
                {u.supplier} / {u.buyer} — {usd(u.amount)} on {u.collected_on}
              </div>
            ))}
          </div>
        )}

        <div style={S.h2}>Agreements</div>
        {agreements.length === 0 && <div style={S.note}>None recorded yet.</div>}
        {agreements.map((a, i) => (
          <div key={i} style={S.row}>
            <span>{a.supplier}</span>
            <span>
              {(a.commission_pct * 100).toFixed(1)}% commission
              {a.meeting_fee > 0 ? ` · ${usd(a.meeting_fee)}/meeting` : " · no meeting fee"}
              {" · "}
              <span style={{ color: a.status === "signed_active" ? "#7fd18a" : "#d8c9a3" }}>{a.status}</span>
            </span>
          </div>
        ))}

        <div style={S.h2}>Accounts</div>
        {m.accounts.length === 0 && (
          <div style={S.note}>
            No introduced accounts with collections yet. Every number above is computed from real
            rows — when the first supplier reports a collection, this page changes on its own.
          </div>
        )}
        {m.accounts.map((a, i) => (
          <div key={i} style={S.row}>
            <span>{a.buyer} <span style={{ color: "#8a9187" }}>via {a.supplier}</span></span>
            <span>{a.recurring ? `recurring · ${usd(a.mrrContribution)}/mo` : "not yet recurring"}</span>
          </div>
        ))}

        <p style={{ ...S.note, marginTop: 40 }}>
          Definitions: recurring = ≥2 collections in 120d with the latest inside 60d. MRR = each
          recurring account&apos;s trailing-90-day commission ÷ 3. Meeting fees are one-time
          revenue, never MRR. Math: <code>lib/agencyMoney.mjs</code>, proven by its test file.
        </p>
      </div>
    </main>
  );
}
