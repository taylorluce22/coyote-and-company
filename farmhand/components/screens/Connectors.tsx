"use client";

import { useEffect, useMemo, useState } from "react";
import { CONNECTOR_GROUPS, ALL_CONNECTORS, type ConnStatus } from "@/lib/connectors";

/**
 * Connectors — a live status board for every integration the Agentic OS
 * uses. Probes the wired /api status endpoints for real connected/needs-key
 * state; the rest show their setup state. This is the "is everything set up"
 * screen.
 */

const STATUS_META: Record<ConnStatus | "checking", { label: string; color: string; bg: string }> = {
  live: { label: "Connected", color: "#41D98A", bg: "rgba(65,217,138,0.14)" },
  "needs-key": { label: "Needs key", color: "#FFC23D", bg: "rgba(255,194,61,0.14)" },
  store: { label: "Attach store", color: "#7DD3FC", bg: "rgba(125,211,252,0.14)" },
  planned: { label: "To wire", color: "#8B89A0", bg: "rgba(255,255,255,0.06)" },
  checking: { label: "Checking…", color: "#A6A4B8", bg: "rgba(255,255,255,0.05)" },
};

type Verdict = "valid" | "invalid" | "missing" | "error";

const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string }> = {
  valid: { label: "Key valid", color: "#41D98A", bg: "rgba(65,217,138,0.16)" },
  invalid: { label: "Bad / placeholder", color: "#FF6B6B", bg: "rgba(255,107,107,0.16)" },
  missing: { label: "No key set", color: "#FFC23D", bg: "rgba(255,194,61,0.14)" },
  error: { label: "Couldn't reach", color: "#A6A4B8", bg: "rgba(255,255,255,0.06)" },
};

export default function Connectors() {
  // live-probe results keyed by connector id → true/false, or undefined while loading
  const [live, setLive] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(true);
  // real key-validation verdicts (only the providers we can test for free)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [verifying, setVerifying] = useState(false);

  async function runVerify() {
    setVerifying(true);
    try {
      const [stock, video] = await Promise.all([
        fetch("/api/stock?verify=1", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/video-reference?verify=1", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      const next: Record<string, Verdict> = {};
      (["pexels", "pixabay", "unsplash"] as const).forEach((k) => {
        if (stock?.[k]) next[k] = stock[k] as Verdict;
      });
      if (video?.gemini) next.gemini = video.gemini as Verdict;
      setVerdicts(next);
    } finally {
      setVerifying(false);
    }
  }

  // connectors we can validate for free (no paid call, per credit policy)
  const VERIFIABLE = new Set(["pexels", "pixabay", "unsplash", "gemini"]);

  useEffect(() => {
    let alive = true;
    const probes = ALL_CONNECTORS.filter((c) => c.check);
    // group unique endpoints to avoid duplicate fetches
    const endpoints = Array.from(new Set(probes.map((c) => c.check!.endpoint)));
    Promise.all(
      endpoints.map((ep) =>
        fetch(ep, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => [ep, j] as const)
          .catch(() => [ep, null] as const)
      )
    ).then((pairs) => {
      if (!alive) return;
      const byEp = Object.fromEntries(pairs);
      const out: Record<string, boolean> = {};
      probes.forEach((c) => {
        const j = byEp[c.check!.endpoint];
        if (!j) { out[c.id] = false; return; }
        out[c.id] = c.check!.key ? !!j[c.check!.key] : !!j.configured;
      });
      setLive(out);
      setChecking(false);
    });
    return () => { alive = false; };
  }, []);

  const statusOf = (id: string, base: ConnStatus): ConnStatus | "checking" => {
    const c = ALL_CONNECTORS.find((x) => x.id === id)!;
    if (!c.check) return base;
    if (checking) return "checking";
    return live[id] ? "live" : "needs-key";
  };

  const counts = useMemo(() => {
    let connected = 0, need = 0, planned = 0;
    ALL_CONNECTORS.forEach((c) => {
      const s = statusOf(c.id, c.status);
      if (s === "live") connected++;
      else if (s === "needs-key" || s === "store") need++;
      else if (s === "planned") planned++;
    });
    return { connected, need, planned, total: ALL_CONNECTORS.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, checking]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "58ch", margin: 0, flex: 1, minWidth: 260 }}>
          Every integration the agents use — live status where it&apos;s wired, and exactly what each still needs.
          Keys are set once in Vercel → Project → Settings → Environment Variables, then redeploy.
        </p>
        <button
          onClick={runVerify}
          disabled={verifying}
          style={{
            display: "flex", alignItems: "center", gap: 8, cursor: verifying ? "default" : "pointer",
            fontSize: 12, fontWeight: 650, color: "#0B0A12", background: verifying ? "#6E6C82" : "#41D98A",
            border: "none", borderRadius: 10, padding: "9px 15px", whiteSpace: "nowrap",
          }}
        >
          {verifying ? "Verifying…" : "Verify keys"}
        </button>
      </div>
      {Object.keys(verdicts).length > 0 && (
        <p style={{ fontSize: 11, color: "#6E6C82", lineHeight: 1.5, marginTop: -8, marginBottom: 18, maxWidth: "72ch" }}>
          A real call was made to each testable provider — a placeholder or typo&apos;d key shows{" "}
          <span style={{ color: "#FF6B6B" }}>Bad / placeholder</span>. Perplexity &amp; Higgsfield stay presence-only
          (testing them spends a credit, so we don&apos;t).
        </p>
      )}

      {/* summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Connected", counts.connected, "#41D98A"],
          ["Need a key / store", counts.need, "#FFC23D"],
          ["To wire", counts.planned, "#8B89A0"],
          ["Total", counts.total, "#F4F3F8"],
        ].map(([l, n, c]) => (
          <div key={l as string} className="fh-glass" style={{ borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 24, fontWeight: 750, color: c as string, fontVariantNumeric: "tabular-nums" }}>{checking && l === "Connected" ? "…" : (n as number)}</div>
            <div className="fh-kicker" style={{ fontSize: 8.5, marginTop: 4 }}>{l as string}</div>
          </div>
        ))}
      </div>

      {CONNECTOR_GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: g.accent, boxShadow: `0 0 8px ${g.accent}` }} />
            <h3 style={{ margin: 0, fontSize: 14.5, color: "#F4F3F8" }}>{g.title}</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {g.items.map((c) => {
              const s = statusOf(c.id, c.status);
              const m = STATUS_META[s];
              return (
                <div key={c.id} className="fh-glass" style={{ borderRadius: 14, padding: "14px 16px", borderLeft: `3px solid ${g.accent}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "#F4F3F8" }}>{c.name}</span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase", color: m.color, background: m.bg, borderRadius: 999, padding: "3px 9px" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, boxShadow: s === "live" ? `0 0 7px ${m.color}` : "none" }} />
                      {m.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8B89A0", lineHeight: 1.5, marginTop: 6 }}>{c.powers}</div>
                  {verdicts[c.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: VERDICT_META[verdicts[c.id]].color, background: VERDICT_META[verdicts[c.id]].bg, borderRadius: 8, padding: "4px 9px", width: "fit-content", fontWeight: 650 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: VERDICT_META[verdicts[c.id]].color }} />
                      {VERDICT_META[verdicts[c.id]].label}
                    </div>
                  )}
                  {!verdicts[c.id] && VERIFIABLE.has(c.id) && Object.keys(verdicts).length > 0 && (
                    <div style={{ fontSize: 10, color: "#6E6C82", marginTop: 8 }}>not tested</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "#77758C", background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "3px 7px" }}>{c.env}</span>
                    {c.getUrl && s !== "live" && (
                      <a href={c.getUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: g.accent, textDecoration: "none", fontFamily: "var(--mono)" }}>get key ↗</a>
                    )}
                  </div>
                  {c.note && <div style={{ fontSize: 10.5, color: "#6E6C82", lineHeight: 1.45, marginTop: 8 }}>{c.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 11, color: "#6E6C82", lineHeight: 1.55, marginTop: 8, maxWidth: "70ch" }}>
        Live checks probe the app&apos;s own status endpoints (no keys ever leave the server). &ldquo;Attach store&rdquo;
        items are created in Vercel → Storage and auto-populate their env vars. &ldquo;To wire&rdquo; items need an
        `/api` route built (a Dev task) in addition to the key.
      </div>
    </div>
  );
}
