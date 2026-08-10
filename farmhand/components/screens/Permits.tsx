"use client";

/**
 * Permit Leads — solar-without-battery retrofit targets from building
 * permits, per client. INGEST -> FILTER -> ENRICH -> COMPLY.
 *
 * The call queue here is manual click-to-dial only, one call at a time. The
 * server never sends an unmasked number unless the COMPLY gate is armed AND
 * dialing is enabled server-side (PERMITS_DIALING_ENABLED, ships absent), so
 * this screen is structurally unable to start a call before then — there is
 * no number to dial. Lists are drafts for Taylor's review.
 */

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";

interface TargetRow {
  apn: string;
  address: string;
  newestSolarIssuedAt?: string;
  recency: string;
  solarPermits: Array<{ permitNumber: string; description: string }>;
}
interface PermitsState {
  enabled: boolean;
  meta: { lastIngestAt?: string; lastFilterAt?: string; lastIngestCounts?: Record<string, number> };
  records: number;
  targets: TargetRow[];
}
interface GateInfo {
  armed: boolean;
  dialingEnabled: boolean;
  canDial: boolean;
  blockers: string[];
}
interface QueueRow {
  apn: string;
  address: string;
  owner: string;
  lineType: string;
  phoneMasked: string;
  phone?: string;
}
interface ComplyState {
  enabled: boolean;
  state?: {
    san?: { number: string };
    azRegistration?: { status: string; kind: string; reference?: string };
    wirelessSuppression: boolean;
    lastDncScrubAt?: string;
    callWindow: { startHour: number; endHour: number };
  };
  gate?: GateInfo;
  counts?: { leads: number; withPhone: number; queue: number; suppressed: number };
  queue?: QueueRow[];
  suppressed?: Array<{ apn: string; reason: string }>;
  internalDnc?: number;
  log?: Array<{ at: string; kind: string; detail: string }>;
}
interface EnrichProbe {
  enabled: boolean;
  maricopa: boolean;
  providers: Record<string, { label: string; configured: boolean }>;
}

const label: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: "0.08em",
  fontFamily: "var(--label)",
  color: "#8B89A0",
  textTransform: "uppercase",
};

function btn(color: string, disabled = false): React.CSSProperties {
  return {
    background: disabled ? "rgba(255,255,255,0.04)" : `${color}1C`,
    color: disabled ? "#5A5870" : color,
    border: `1px solid ${disabled ? "rgba(255,255,255,0.1)" : color + "66"}`,
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
  };
}

function pill(color: string, text: string) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color, background: `${color}1F`, border: `1px solid ${color}55`, borderRadius: 999, padding: "3px 9px" }}>
      {text}
    </span>
  );
}

const card: React.CSSProperties = { borderRadius: 15, padding: "16px 18px", marginBottom: 14 };

export default function Permits() {
  const { workspace } = useStore();
  const [tab, setTab] = useState<"targets" | "enrich" | "comply" | "queue">("targets");
  const [permits, setPermits] = useState<PermitsState | null>(null);
  const [comply, setComply] = useState<ComplyState | null>(null);
  const [probe, setProbe] = useState<EnrichProbe | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [activeCallApn, setActiveCallApn] = useState<string | null>(null);
  const [sanInput, setSanInput] = useState("");
  const [azRef, setAzRef] = useState("");
  const [scrubReceipt, setScrubReceipt] = useState("");
  const [scrubListed, setScrubListed] = useState("");
  const [optOutNum, setOptOutNum] = useState("");

  const refresh = useCallback(async () => {
    const qs = `?client=${encodeURIComponent(workspace)}`;
    const [p, c, e] = await Promise.all([
      fetch(`/api/permits${qs}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/permits/comply${qs}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/permits/enrich`).then((r) => r.json()).catch(() => null),
    ]);
    setPermits(p);
    setComply(c);
    setProbe(e);
  }, [workspace]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = async (path: string, body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    setNote("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, client: workspace }),
      });
      const data = await res.json();
      setNote(data.ok ? `${tag}: ${JSON.stringify({ ...data, ok: undefined, targets: undefined, queue: undefined }).slice(0, 220)}` : `${tag} failed: ${data.error ?? "unknown"}`);
      await refresh();
    } catch (err) {
      setNote(`${tag} failed: ${String(err).slice(0, 160)}`);
    } finally {
      setBusy(null);
    }
  };

  const gate = comply?.gate;
  const kvOff = permits ? !permits.enabled : false;

  return (
    <div className="fh-rise">
      <div className="fh-kicker">PERMIT LEADS · {workspace}</div>
      <h1 className="fh-title" style={{ marginBottom: 4 }}>Solar without battery</h1>
      <p style={{ color: "#8B89A0", fontSize: 12.5, marginBottom: 14, maxWidth: 640 }}>
        Homes with a solar PV permit and no energy-storage permit — battery retrofit targets.
        Lists are drafts for review. Dialing ships OFF until the compliance gate is armed and enabled server-side.
      </p>

      <SubTabs
        tabs={[
          { id: "targets", label: "Targets" },
          { id: "enrich", label: "Enrich" },
          { id: "comply", label: "Comply" },
          { id: "queue", label: `Call queue${comply?.counts ? ` (${comply.counts.queue})` : ""}` },
        ]}
        active={tab}
        color="#FF8A3D"
        onPick={(id) => setTab(id)}
      />

      {kvOff && (
        <div className="fh-glass" style={{ ...card, border: "1px solid rgba(255,194,61,0.4)" }}>
          <span style={{ color: "#FFC23D", fontSize: 12 }}>
            KV store not configured — ingest/enrich state can&apos;t persist. Set KV_REST_API_URL / KV_REST_API_TOKEN.
          </span>
        </div>
      )}
      {note && (
        <div style={{ color: "#7DD3FC", fontSize: 11, marginBottom: 10, fontFamily: "var(--label)" }}>{note}</div>
      )}

      {tab === "targets" && (
        <>
          <div className="fh-glass" style={card}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={btn("#38BDF8", busy !== null)} disabled={busy !== null} onClick={() => post("/api/permits", { action: "ingest", jurisdiction: "mesa" }, "ingest mesa")}>
                {busy === "ingest mesa" ? "Ingesting…" : "Ingest Mesa permits"}
              </button>
              <button style={btn("#41D98A", busy !== null)} disabled={busy !== null} onClick={() => post("/api/permits", { action: "filter" }, "filter")}>
                {busy === "filter" ? "Filtering…" : "Run set-difference"}
              </button>
              <a href={`/api/permits?client=${encodeURIComponent(workspace)}&format=csv`} style={{ ...btn("#C9A8FF"), textDecoration: "none" }}>
                Download CSV
              </a>
              <span style={{ ...label, marginLeft: "auto" }}>
                {permits?.records ?? 0} permits · {permits?.targets.length ?? 0} targets
                {permits?.meta.lastFilterAt ? ` · filtered ${new Date(permits.meta.lastFilterAt).toLocaleDateString()}` : ""}
              </span>
            </div>
          </div>
          {(permits?.targets ?? []).slice(0, 60).map((t) => (
            <div key={t.apn} className="fh-glass" style={{ ...card, padding: "12px 16px", marginBottom: 8, display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, color: "#F4F3F8", fontSize: 13 }}>{t.address || "(no address)"}</span>
              <span style={{ ...label }}>APN {t.apn}</span>
              {pill(t.recency === "in-window" ? "#41D98A" : "#8B89A0", t.recency)}
              <span style={{ color: "#8B89A0", fontSize: 11, flexBasis: "100%" }}>
                {t.solarPermits.map((p) => `${p.permitNumber || "?"} — ${p.description}`).join(" · ")}
              </span>
            </div>
          ))}
          {permits && permits.targets.length === 0 && (
            <div style={{ color: "#8B89A0", fontSize: 12 }}>No targets yet — ingest Mesa, then run the set-difference.</div>
          )}
        </>
      )}

      {tab === "enrich" && (
        <div className="fh-glass" style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <button style={btn("#38BDF8", busy !== null)} disabled={busy !== null} onClick={() => post("/api/permits/enrich", { action: "seed" }, "seed leads")}>
              Seed leads from targets
            </button>
            <button
              style={btn("#41D98A", busy !== null || !probe?.maricopa)}
              disabled={busy !== null || !probe?.maricopa}
              title={probe?.maricopa ? "" : "MARICOPA_ASSESSOR_TOKEN not set"}
              onClick={() => post("/api/permits/enrich", { action: "owners" }, "enrich owners")}
            >
              Enrich owners (assessor)
            </button>
            <button
              style={btn("#C9A8FF", busy !== null || !probe?.providers?.datazapp?.configured)}
              disabled={busy !== null || !probe?.providers?.datazapp?.configured}
              title={probe?.providers?.datazapp?.configured ? "" : "DATAZAPP_API_KEY not set"}
              onClick={() => post("/api/permits/enrich", { action: "phones", provider: "datazapp" }, "append phones")}
            >
              Append phones (Datazapp)
            </button>
          </div>
          <div style={{ color: "#8B89A0", fontSize: 11.5, lineHeight: 1.6 }}>
            <div>Maricopa assessor token: {probe?.maricopa ? pill("#41D98A", "configured") : pill("#FF5D8F", "missing")}</div>
            <div style={{ marginTop: 4 }}>
              Datazapp: {probe?.providers?.datazapp?.configured ? pill("#41D98A", "configured") : pill("#FF5D8F", "missing")}
            </div>
            <div style={{ marginTop: 8 }}>
              Leads: {comply?.counts?.leads ?? 0} · with phone: {comply?.counts?.withPhone ?? 0}. Every enriched field
              carries provenance (source + fetch date); numbers are never fabricated — a vendor miss stays empty.
            </div>
          </div>
        </div>
      )}

      {tab === "comply" && (
        <>
          <div className="fh-glass" style={{ ...card, border: `1px solid ${gate?.canDial ? "rgba(65,217,138,0.45)" : "rgba(255,93,143,0.45)"}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "#F4F3F8" }}>HARD GATE</span>
              {pill(gate?.armed ? "#41D98A" : "#FF5D8F", gate?.armed ? "ARMED" : "NOT ARMED")}
              {pill(gate?.dialingEnabled ? "#41D98A" : "#FFC23D", gate?.dialingEnabled ? "DIALING ENABLED" : "DIALING OFF (shipped)")}
            </div>
            {(gate?.blockers ?? []).map((b) => (
              <div key={b} style={{ color: "#FF5D8F", fontSize: 11.5, marginBottom: 3 }}>✕ {b}</div>
            ))}
            {gate?.armed && !gate.dialingEnabled && (
              <div style={{ color: "#FFC23D", fontSize: 11.5 }}>
                Gate armed. Dialing stays OFF until PERMITS_DIALING_ENABLED=true is set server-side — a deliberate config act, not a click.
              </div>
            )}
          </div>

          <div className="fh-glass" style={card}>
            <div style={{ ...label, marginBottom: 8 }}>FTC SAN + AZ registration (A.R.S. 44-1272.01 ROC limited path)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={sanInput} onChange={(e) => setSanInput(e.target.value)} placeholder={comply?.state?.san ? `SAN on file: ${comply.state.san.number}` : "SAN number"} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", color: "#F4F3F8", fontSize: 12 }} />
              <button style={btn("#38BDF8", busy !== null || !sanInput.trim())} disabled={busy !== null || !sanInput.trim()} onClick={() => { post("/api/permits/comply", { action: "setState", san: sanInput.trim() }, "record SAN"); setSanInput(""); }}>
                Record SAN
              </button>
              <input value={azRef} onChange={(e) => setAzRef(e.target.value)} placeholder={comply?.state?.azRegistration ? `AZ reg: ${comply.state.azRegistration.status} (${comply.state.azRegistration.kind})` : "AZ registration reference"} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", color: "#F4F3F8", fontSize: 12 }} />
              <button style={btn("#38BDF8", busy !== null)} disabled={busy !== null} onClick={() => { post("/api/permits/comply", { action: "setState", azRegistration: { status: "filed", kind: "roc-limited-44-1272.01", reference: azRef.trim() || undefined } }, "record AZ registration"); setAzRef(""); }}>
                Record AZ registration
              </button>
            </div>
          </div>

          <div className="fh-glass" style={card}>
            <div style={{ ...label, marginBottom: 8 }}>
              National DNC scrub — 31-day clock
              {comply?.state?.lastDncScrubAt ? ` · last ${new Date(comply.state.lastDncScrubAt).toLocaleDateString()}` : " · never"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={scrubReceipt} onChange={(e) => setScrubReceipt(e.target.value)} placeholder="scrub receipt id" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", color: "#F4F3F8", fontSize: 12 }} />
              <input value={scrubListed} onChange={(e) => setScrubListed(e.target.value)} placeholder="listed numbers, comma-sep" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", color: "#F4F3F8", fontSize: 12, minWidth: 220 }} />
              <button
                style={btn("#41D98A", busy !== null || !scrubReceipt.trim())}
                disabled={busy !== null || !scrubReceipt.trim()}
                onClick={() => {
                  post("/api/permits/comply", { action: "recordScrub", receipt: scrubReceipt.trim(), listedNumbers: scrubListed.split(",").map((s) => s.trim()).filter(Boolean) }, "record scrub");
                  setScrubReceipt("");
                  setScrubListed("");
                }}
              >
                Record scrub
              </button>
            </div>
          </div>

          <div className="fh-glass" style={card}>
            <div style={{ ...label, marginBottom: 8 }}>
              Wireless suppression {comply?.state?.wirelessSuppression ? "(ON — A.R.S. 44-1278(B)(3))" : "(OFF — gate disarmed)"} · internal DNC: {comply?.internalDnc ?? 0} (kept 10yr) · window {comply?.state?.callWindow.startHour ?? 9}:00–{comply?.state?.callWindow.endHour ?? 20}:00 at called party&apos;s local time
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={optOutNum} onChange={(e) => setOptOutNum(e.target.value)} placeholder="opt-out number" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", color: "#F4F3F8", fontSize: 12 }} />
              <button style={btn("#FF5D8F", busy !== null || optOutNum.replace(/\D/g, "").length < 10)} disabled={busy !== null || optOutNum.replace(/\D/g, "").length < 10} onClick={() => { post("/api/permits/comply", { action: "optOut", number: optOutNum }, "opt out"); setOptOutNum(""); }}>
                Add to internal DNC
              </button>
            </div>
          </div>

          <div className="fh-glass" style={card}>
            <div style={{ ...label, marginBottom: 8 }}>Compliance log (retained 5+ yr)</div>
            {(comply?.log ?? []).slice(-12).reverse().map((e, i) => (
              <div key={i} style={{ color: "#8B89A0", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: "#7DD3FC" }}>{new Date(e.at).toLocaleString()}</span> · {e.kind} · {e.detail}
              </div>
            ))}
            {!comply?.log?.length && <div style={{ color: "#5A5870", fontSize: 11 }}>empty</div>}
          </div>
        </>
      )}

      {tab === "queue" && (
        <>
          <div className="fh-glass" style={{ ...card, border: "1px solid rgba(255,194,61,0.35)" }}>
            <span style={{ color: "#FFC23D", fontSize: 11.5 }}>
              Manual click-to-dial only — one call at a time. No predictive/power dialer, no prerecorded or AI voice,
              no ringless voicemail, no cold SMS. Numbers stay masked until the gate is armed AND dialing is enabled server-side.
            </span>
          </div>
          {(comply?.queue ?? []).map((q) => {
            const callable = !!q.phone && (activeCallApn === null || activeCallApn === q.apn);
            return (
              <div key={q.apn} className="fh-glass" style={{ ...card, padding: "12px 16px", marginBottom: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: "#F4F3F8", fontSize: 13 }}>{q.owner || "(owner unknown)"}</span>
                <span style={{ color: "#8B89A0", fontSize: 11.5 }}>{q.address}</span>
                {pill("#7DD3FC", q.lineType)}
                <span style={{ color: "#8B89A0", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{q.phone ?? q.phoneMasked}</span>
                {q.phone ? (
                  activeCallApn === q.apn ? (
                    <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                      {["reached", "voicemail", "no answer", "bad number"].map((o) => (
                        <button key={o} style={btn("#41D98A")} onClick={() => { post("/api/permits/comply", { action: "logCall", apn: q.apn, outcome: o }, "log call"); setActiveCallApn(null); }}>
                          {o}
                        </button>
                      ))}
                      <button style={btn("#FF5D8F")} onClick={() => { post("/api/permits/comply", { action: "optOut", number: q.phone!, apn: q.apn, reason: "asked on call" }, "opt out"); setActiveCallApn(null); }}>
                        do not call
                      </button>
                    </span>
                  ) : (
                    <a
                      href={callable ? `tel:${q.phone}` : undefined}
                      onClick={(e) => { if (!callable) { e.preventDefault(); return; } setActiveCallApn(q.apn); }}
                      style={{ ...btn("#41D98A", !callable), marginLeft: "auto", textDecoration: "none" }}
                    >
                      📞 Call (manual)
                    </a>
                  )
                ) : (
                  <span style={{ ...btn("#8B89A0", true), marginLeft: "auto" }}>🔒 gated</span>
                )}
              </div>
            );
          })}
          {!comply?.queue?.length && (
            <div style={{ color: "#8B89A0", fontSize: 12 }}>
              Queue is empty — leads need a landline-flagged number, a fresh DNC scrub, and an in-window clock to appear here.
            </div>
          )}
          {!!comply?.suppressed?.length && (
            <div className="fh-glass" style={{ ...card, marginTop: 10 }}>
              <div style={{ ...label, marginBottom: 6 }}>Suppressed ({comply.suppressed.length})</div>
              {comply.suppressed.slice(0, 30).map((s) => (
                <div key={s.apn} style={{ color: "#8B89A0", fontSize: 11, marginBottom: 2 }}>APN {s.apn} — {s.reason}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
