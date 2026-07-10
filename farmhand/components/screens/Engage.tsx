"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";
import Sources from "./Sources";
import Assistant from "./Assistant";
import { cadenceCap, type StrategyProfile } from "@/lib/strategy";
import { capturedAtLabel, draftReply, fairHousingLint, scoreOpportunity, tagOpportunity, type Opportunity } from "@/lib/engage";
import { INTENT_COLOR, INTENT_OPTS, isLikelyHousingLead, leadFingerprint, normalizeLeadUrl, PLATFORM_LABEL, pushExemplar, type Lead, type LeadTraining } from "@/lib/hunt";

function sinceLabel(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}

/**
 * Lead Engine — the web-wide hunt.
 * Searches the ENTIRE live web (Reddit, forums, Quora, public Facebook,
 * Nextdoor, X, local news, relocation boards…) for real people with buying /
 * selling / relocation / investing intent in the agent's territories, scores
 * every hit, and drops qualified ones straight into the inbox. Zero clicks.
 * It's TRAINABLE — the Teach panel + thumbs on each lead steer future hunts.
 * Engine = Perplexity live web search server-side (/api/hunt).
 */
function LeadEngine({ onAuto }: { onAuto: (leads: Lead[]) => number }) {
  const { state, set } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const training = state.leadTraining as LeadTraining;
  const [status, setStatus] = useState<"idle" | "scanning" | "ok" | "transient" | "needs-creds">("idle");
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [lastNew, setLastNew] = useState(0);
  const [teach, setTeach] = useState(false);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [serverMeta, setServerMeta] = useState<{ lastRunAt: number; lastCount: number; totalRuns: number } | null>(null);
  const running = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTraining = (patch: Partial<LeadTraining>) =>
    set((s) => ({ leadTraining: { ...(s.leadTraining as LeadTraining), ...patch } }));

  const hunt = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus("scanning");
    const t = state.leadTraining as LeadTraining;
    try {
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          territories: strategy.territories.map((x) => x.name),
          profession: "real estate agent",
          city: strategy.homeBase,
          idealClient: strategy.idealClient,
          intents: t.intents,
          guidance: t.guidance,
          good: t.good,
          bad: t.bad,
          sinceDays: t.sinceDays,
        }),
      }).then((r) => r.json());

      // Reddit is covered server-side now (see the multi-lane hunt) — the
      // extension is NOT nudged automatically here anymore. It used to fire a
      // "scan-request" on every auto-hunt cycle, which made the connected
      // extension pop open a batch of Reddit tabs every 6 minutes. The
      // extension still feeds Facebook Groups & Nextdoor passively (no tabs
      // opened) while you're browsing them logged in as yourself.

      const leads: Lead[] = Array.isArray(res.leads) ? res.leads : [];
      const qualified = leads.filter((l) => l.score >= t.minScore);
      const added = onAuto(qualified);
      setLastNew(added);
      setLastAt(Date.now());
      if (res.needsCreds || res.configured === false) setStatus("needs-creds");
      else if (!leads.length && res.error) setStatus("transient");
      else setStatus("ok");
    } catch {
      setStatus("transient");
    }
    running.current = false;
  }, [strategy.territories, strategy.homeBase, strategy.idealClient, state.extensionConnected, state.leadTraining, onAuto]);

  // keep a live handle to the latest hunt so the interval never fires stale —
  // and so editing training (guidance, sliders) doesn't retrigger a paid search
  const huntRef = useRef(hunt);
  huntRef.current = hunt;

  // auto-run on open + every 6 minutes while the tab is open (if auto is on)
  useEffect(() => {
    if (!training.autoOn) return;
    huntRef.current();
    const id = setInterval(() => huntRef.current(), 6 * 60 * 1000);
    return () => clearInterval(id);
  }, [training.autoOn]);

  // pull whatever the always-on background job found while the app was closed
  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => {
        if (d?.enabled) {
          setAlwaysOn(true);
          setServerMeta(d.meta || null);
          if (Array.isArray(d.leads) && d.leads.length) onAuto(d.leads as Lead[]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the background job's instructions current: push territories + training
  // up (debounced) whenever they change, so overnight hunts use the latest
  useEffect(() => {
    if (!alwaysOn) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            territories: strategy.territories.map((x) => x.name),
            profession: "real estate agent",
            city: strategy.homeBase,
            idealClient: strategy.idealClient,
            intents: training.intents,
            guidance: training.guidance,
            good: training.good,
            bad: training.bad,
            sinceDays: training.sinceDays,
          },
        }),
      }).catch(() => {});
    }, 1500);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [alwaysOn, strategy.territories, strategy.homeBase, strategy.idealClient, training.intents, training.guidance, training.good, training.bad, training.sinceDays]);

  const rel = lastAt ? (Date.now() - lastAt < 60000 ? "just now" : `${Math.round((Date.now() - lastAt) / 60000)}m ago`) : "—";
  const dot = status === "needs-creds" ? "#FFC23D" : status === "transient" ? "#FF5D8F" : "#41D98A";
  const learned = training.good.length + training.bad.length;

  return (
    <div className="fh-glass" style={{ borderRadius: 14, padding: "15px 17px", marginBottom: 16, border: `1px solid ${status === "needs-creds" ? "rgba(255,194,61,0.3)" : "rgba(65,217,138,0.25)"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, boxShadow: `0 0 8px ${dot}`, animation: status === "scanning" ? "fh-pulse 1s ease infinite" : "fh-pulse 2.4s ease infinite" }} />
        <span className="fh-kicker" style={{ fontSize: 9.5 }}>Lead engine · whole-web</span>
        <span style={{ fontSize: 10.5, color: "#8B89A0" }}>
          {status === "scanning"
            ? `Hunting the web for ${strategy.territories.slice(0, 3).map((x) => x.name).join(", ")}…`
            : status === "needs-creds"
            ? "One key away from live — see below"
            : `Auto-hunting the whole web · last run ${rel}${lastNew ? ` · +${lastNew} new` : ""}`}
        </span>
        <button
          onClick={() => setTeach((v) => !v)}
          style={{ marginLeft: "auto", background: teach ? "rgba(201,168,255,0.16)" : "rgba(201,168,255,0.09)", color: "#C9A8FF", border: "1px solid rgba(201,168,255,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {teach ? "Close" : `Teach${learned ? ` · ${learned}` : ""}`}
        </button>
        <button
          onClick={hunt}
          disabled={status === "scanning"}
          style={{ background: "rgba(65,217,138,0.12)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: status === "scanning" ? "default" : "pointer" }}
        >
          {status === "scanning" ? "Hunting…" : "↻ Hunt now"}
        </button>
      </div>

      {teach && (
        <div style={{ marginTop: 12, background: "rgba(201,168,255,0.05)", border: "1px solid rgba(201,168,255,0.18)", borderRadius: 11, padding: "13px 14px" }}>
          <div style={{ fontSize: 11.5, color: "#C9A8FF", fontWeight: 700, marginBottom: 8 }}>Teach the engine what a great lead looks like</div>
          <textarea
            value={training.guidance}
            onChange={(e) => setTraining({ guidance: e.target.value })}
            placeholder="In your words: who's a real lead for you? e.g. “People relocating to the East Valley for jobs, first-time buyers asking about Gilbert schools, anyone frustrated with their current agent. Skip investors and rentals.”"
            rows={3}
            style={{ width: "100%", fontSize: 12, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
          />

          <div style={{ fontSize: 10, color: "#8B89A0", margin: "12px 0 7px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>Hunt for these intents</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {INTENT_OPTS.map((io) => {
              const on = training.intents.includes(io.key);
              return (
                <button
                  key={io.key}
                  onClick={() => setTraining({ intents: on ? training.intents.filter((k) => k !== io.key) : [...training.intents, io.key] })}
                  style={{ fontSize: 11, fontWeight: 700, color: on ? "#04110E" : INTENT_COLOR[io.key] || "#8B89A0", background: on ? INTENT_COLOR[io.key] || "#8B89A0" : `${INTENT_COLOR[io.key] || "#8B89A0"}14`, border: `1px solid ${INTENT_COLOR[io.key] || "#8B89A0"}59`, borderRadius: 999, padding: "4px 12px", cursor: "pointer" }}
                >
                  {io.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10.5, color: "#8B89A0" }}>Only auto-add leads scoring</span>
              <input type="range" min={30} max={90} step={5} value={training.minScore} onChange={(e) => setTraining({ minScore: Number(e.target.value) })} style={{ accentColor: "#26E0C8", width: 120 }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, fontFamily: "var(--mono)", color: "#26E0C8" }}>{training.minScore}+</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10.5, color: "#8B89A0" }}>Recency</span>
              <select value={training.sinceDays} onChange={(e) => setTraining({ sinceDays: Number(e.target.value) })} style={{ fontSize: 11, color: "#F4F3F8", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, padding: "4px 8px", outline: "none" }}>
                <option value={14}>2 weeks</option>
                <option value={30}>1 month</option>
                <option value={45}>6 weeks</option>
                <option value={90}>3 months</option>
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#8B89A0", cursor: "pointer", marginLeft: "auto" }}>
              <input type="checkbox" checked={training.autoOn} onChange={(e) => setTraining({ autoOn: e.target.checked })} style={{ accentColor: "#41D98A" }} />
              Auto-hunt on open
            </label>
          </div>

          {learned > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 10.5, color: "#77758C" }}>
              <span>Learned from your feedback: <b style={{ color: "#41D98A" }}>{training.good.length} 👍</b> · <b style={{ color: "#FF5D8F" }}>{training.bad.length} 👎</b></span>
              <button onClick={() => setTraining({ good: [], bad: [] })} style={{ background: "transparent", color: "#77758C", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reset learning</button>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#5E5C72", marginTop: 11, lineHeight: 1.55 }}>
            Every 👍 / 👎 you give a lead below teaches the engine — it hunts for more like your 👍 and avoids your 👎.
          </div>
        </div>
      )}

      {status === "needs-creds" && (
        <div style={{ marginTop: 11, fontSize: 11.5, color: "#FFC23D", lineHeight: 1.6, background: "rgba(255,194,61,0.06)", borderRadius: 10, padding: "10px 12px" }}>
          <b>One key turns this fully live.</b> The engine searches the whole web through Perplexity. Add{" "}
          <span style={{ fontFamily: "var(--mono)" }}>PERPLEXITY_API_KEY</span> in Vercel → Settings → Environment
          Variables (grab it at <b>perplexity.ai/settings/api</b>) → redeploy. After that, real leads from across the web
          land here on their own — no clicks, no extension, no manual searching.
        </div>
      )}

      {alwaysOn && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10.5, color: "#41D98A", fontWeight: 600 }}>
          <span style={{ fontSize: 11 }}>⏱</span>
          <span>
            Always-on: hunting 24/7 in the background — leads keep arriving even when this is closed
            {serverMeta?.lastRunAt ? ` · last background run ${sinceLabel(serverMeta.lastRunAt)}` : ""}
            {serverMeta?.totalRuns ? ` · ${serverMeta.totalRuns} runs` : ""}
          </span>
        </div>
      )}

      <div style={{ fontSize: 10, color: "#5E5C72", marginTop: 10, lineHeight: 1.55 }}>
        Runs Reddit, Quora/City-Data/BiggerPockets, X, and the open web as separate parallel searches so no one
        platform crowds out the rest, scores every hit, and files the strong ones below.{" "}
        {state.extensionConnected
          ? "Your connected extension also reads Facebook Groups & Nextdoor while you're logged in and browsing them — the only account-safe way in, since private groups aren't visible to any web search."
          : "Facebook Groups and Nextdoor are login-walled — no web search (including this one) can see inside them. Connect the Radar extension to cover those two while you browse, logged in as yourself."}
        {!alwaysOn ? " Add a lead store (Vercel KV / Upstash) to keep it hunting 24/7 in the background." : ""}
      </div>
    </div>
  );
}

const TAG_COLORS: Record<string, string> = {
  relocation: "#7DD3FC",
  "market-question": "#FFC23D",
  "recommendation-ask": "#41D98A",
  "neighborhood-chat": "#C9A8FF",
  "agent-mention": "#FF9A62",
  general: "#8B89A0",
};

function Opportunities() {
  const { state, set, copy } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const opps = state.opportunities as Opportunity[];
  const cap = cadenceCap(strategy.prospectingMode);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const capture = () => {
    if (!text.trim()) return;
    const territoryNames = strategy.territories.map((t) => t.name);
    const matched = territoryNames.find((n) => text.toLowerCase().includes(n.toLowerCase()));
    const opp: Opportunity = {
      id: `opp-${Date.now()}`,
      sourceName: source.trim() || "Pasted thread",
      territory: matched || territoryNames[0] || "General",
      excerpt: text.trim().slice(0, 400),
      tags: tagOpportunity(text),
      status: "new",
      capturedAt: "just now",
      capturedAtMs: Date.now(),
      firstTouch: !opps.some((o) => o.sourceName === (source.trim() || "Pasted thread")),
    };
    set((s) => ({ opportunities: [opp, ...(s.opportunities as Opportunity[])] }));
    setText("");
    setSource("");
  };

  const setStatus = (id: string, status: Opportunity["status"]) =>
    set((s) => ({ opportunities: (s.opportunities as Opportunity[]).map((o) => (o.id === id ? { ...o, status } : o)) }));

  const engagedThisWeek = opps.filter((o) => o.status === "engaged").length;

  // auto-capture web-wide hunt results into the inbox, deduped by source url,
  // title fingerprint (catches the same real post re-cited under a different
  // URL), and a deterministic housing-relevance filter (the prompt tells the
  // engine to skip salon/bar/service-recommendation posts, but that's an
  // instruction, not a guarantee — this is the backstop that actually enforces it)
  const autoCapture = (leads: Lead[]): number => {
    const territoryNames = strategy.territories.map((t) => t.name);
    let addedCount = 0;
    set((s) => {
      const existing = s.opportunities as Opportunity[];
      const have = new Set(existing.map((o) => o.extKey).filter(Boolean));
      const haveTitle = new Set(existing.map((o) => o.titleFingerprint).filter(Boolean));
      const fresh: Opportunity[] = [];
      leads.forEach((l, i) => {
        const key = `web:${normalizeLeadUrl(l.url)}`;
        const full = `${l.title} ${l.snippet}`.trim();
        if (!isLikelyHousingLead(full)) return;
        const titleKey = leadFingerprint({ title: l.title, source: l.source || PLATFORM_LABEL[l.platform] || "Web" });
        if (have.has(key) || haveTitle.has(titleKey)) return;
        have.add(key);
        haveTitle.add(titleKey);
        const matched = l.territory && territoryNames.find((n) => l.territory.toLowerCase().includes(n.toLowerCase()));
        // a general "moving to Arizona, where should I live" lead doesn't belong to one named
        // territory — label it plainly rather than mislabeling it as the agent's first territory
        const statewide = !matched && /arizona|\bAZ\b/i.test(l.territory || "");
        fresh.push({
          id: `opp-hunt-${Date.now()}-${i}`,
          sourceName: l.source || PLATFORM_LABEL[l.platform] || "Web",
          territory: matched || territoryNames.find((n) => full.toLowerCase().includes(n.toLowerCase())) || (statewide ? "Arizona (general)" : territoryNames[0] || "General"),
          excerpt: (l.snippet || l.title).slice(0, 400),
          url: l.url,
          tags: tagOpportunity(full),
          status: "new",
          // capturedAt tracks when FARMHAND found it, not the source post's own
          // age (that's a different fact — shown separately as l.postedAgo /
          // "why"). Always a real timestamp so the label updates live instead
          // of freezing at "just now" forever.
          capturedAt: "just now",
          capturedAtMs: Date.now(),
          firstTouch: !existing.some((o) => o.sourceName === (l.source || l.platform)),
          extKey: key,
          titleFingerprint: titleKey,
          engineScore: l.score,
          platform: l.platform,
          intent: l.intent,
          why: l.why,
        });
      });
      addedCount = fresh.length;
      if (!fresh.length) return s;
      return { ...s, opportunities: [...fresh, ...existing] };
    });
    return addedCount;
  };

  // thumbs feedback trains the engine: teach it to find more (or fewer) like this
  const teachFromLead = (o: Opportunity, verdict: "good" | "bad") =>
    set((s) => {
      const t = s.leadTraining as LeadTraining;
      const snippet = `${o.excerpt}`.slice(0, 200);
      const list = pushExemplar(t[verdict], snippet);
      // if flipping a verdict, drop it from the opposite list
      const other = verdict === "good" ? "bad" : "good";
      return {
        leadTraining: { ...t, [verdict]: list, [other]: t[other].filter((x) => x !== snippet) },
        opportunities: (s.opportunities as Opportunity[]).map((x) => (x.id === o.id ? { ...x, feedback: verdict } : x)),
      };
    });

  return (
    <div>
      <LeadEngine onAuto={autoCapture} />
      {/* cadence cap — visible, not secret */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 12, color: "#A6A4B8", background: "rgba(38,224,200,0.06)", border: "1px solid rgba(38,224,200,0.22)", borderRadius: 11, padding: "10px 14px" }}>
        <span style={{ color: "#26E0C8", fontWeight: 800, fontFamily: "var(--mono)", fontSize: 12.5 }}>
          {engagedThisWeek}/{cap.perWeek}
        </span>
        <span>engagements this week · {cap.note}</span>
      </div>

      {/* capture box */}
      <div className="fh-glass" style={{ borderRadius: 14, padding: "16px 17px", marginBottom: 16 }}>
        <div className="fh-kicker" style={{ fontSize: 9.5, marginBottom: 10 }}>Capture a conversation</div>
        <div style={{ fontSize: 11.5, color: "#8B89A0", marginBottom: 10, lineHeight: 1.5 }}>
          See a thread worth joining — in a Facebook group, Nextdoor, Reddit, anywhere? Paste the text (or link + a
          line of context). Farmhand tags it, scores it, and drafts a reply that won&apos;t get you flagged.
        </div>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Where is it? e.g. Val Vista Lakes Neighbors (Facebook)"
          style={{ width: "100%", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "9px 12px", outline: "none", marginBottom: 8 }}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the thread text… e.g. “Moving to Gilbert from Chicago this fall — any neighborhoods we should look at with good parks?”"
          rows={3}
          style={{ width: "100%", fontSize: 12.5, color: "#F4F3F8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 9, padding: "10px 12px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
        <button onClick={capture} disabled={!text.trim()} style={{ marginTop: 10, background: text.trim() ? "linear-gradient(180deg,#2DD4BF,#0D9488)" : "rgba(255,255,255,0.06)", color: text.trim() ? "#04110E" : "#5E5C72", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 12.5, fontWeight: 800, cursor: text.trim() ? "pointer" : "default" }}>
          Capture →
        </button>
      </div>

      {/* inbox */}
      {opps.length === 0 ? (
        <div style={{ padding: "26px 10px", textAlign: "center", fontSize: 12.5, color: "#77758C", lineHeight: 1.7 }}>
          Your opportunity inbox is empty. Capture your first thread above —<br />
          relocation questions and “anyone recommend…” posts are gold.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {opps.filter((o) => o.status !== "skipped").map((o) => {
            const score = o.engineScore ?? scoreOpportunity(o.excerpt, strategy.territories.map((t) => t.name));
            const isDrafting = draftFor === o.id;
            const draft = isDrafting
              ? draftReply({ excerpt: o.excerpt, tags: o.tags, tone: strategy.tone, mode: strategy.prospectingMode, firstTouch: o.firstTouch, agentName: strategy.name, territory: o.territory })
              : "";
            const lint = isDrafting ? fairHousingLint(draft) : null;
            return (
              <div key={o.id} className="fh-glass" style={{ borderRadius: 13, padding: "14px 16px", borderLeft: `3px solid ${o.status === "engaged" ? "#41D98A" : o.status === "watching" ? "#FFC23D" : "#26E0C8"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {o.platform && (
                    <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: "#04110E", background: INTENT_COLOR[o.intent || "signal"] || "#8B89A0", borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>
                      {o.intent || "signal"}
                    </span>
                  )}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#D8D6E6" }}>{o.sourceName}</span>
                  <span style={{ fontSize: 10, color: "#77758C" }}>· {o.territory} · {capturedAtLabel(o)}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, fontFamily: "var(--mono)", color: score >= 60 ? "#41D98A" : score >= 40 ? "#FFC23D" : "#8B89A0" }}>
                    {score} {o.engineScore != null ? "intent" : "match"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#C9C7D6", marginTop: 7, lineHeight: 1.5 }}>&ldquo;{o.excerpt}&rdquo;</div>
                {o.why && (
                  <div style={{ fontSize: 10.5, color: "#26E0C8", marginTop: 6, lineHeight: 1.45 }}>→ {o.why}</div>
                )}
                {o.url && (
                  <a href={o.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 10.5, color: "#7DD3FC", textDecoration: "none", marginTop: 6, fontFamily: "var(--mono)" }}>
                    open source ↗
                  </a>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  {o.tags.map((tg) => (
                    <span key={tg} style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: TAG_COLORS[tg] || "#8B89A0", background: `${TAG_COLORS[tg] || "#8B89A0"}14`, border: `1px solid ${TAG_COLORS[tg] || "#8B89A0"}3D`, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase" }}>
                      {tg}
                    </span>
                  ))}
                  {o.firstTouch && (
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: "#FF9A62", background: "rgba(255,154,98,0.1)", border: "1px solid rgba(255,154,98,0.35)", borderRadius: 999, padding: "2px 8px" }}>
                      FIRST TOUCH — VALUE ONLY, NO PITCH
                    </span>
                  )}
                  {o.engineScore != null && (
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <button title="Great lead — find more like this" onClick={() => teachFromLead(o, "good")} style={{ background: o.feedback === "good" ? "rgba(65,217,138,0.22)" : "transparent", color: o.feedback === "good" ? "#41D98A" : "#77758C", border: `1px solid ${o.feedback === "good" ? "rgba(65,217,138,0.5)" : "rgba(255,255,255,0.12)"}`, borderRadius: 7, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>👍</button>
                      <button title="Not a lead — find fewer like this" onClick={() => teachFromLead(o, "bad")} style={{ background: o.feedback === "bad" ? "rgba(255,93,143,0.2)" : "transparent", color: o.feedback === "bad" ? "#FF5D8F" : "#77758C", border: `1px solid ${o.feedback === "bad" ? "rgba(255,93,143,0.5)" : "rgba(255,255,255,0.12)"}`, borderRadius: 7, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>👎</button>
                    </span>
                  )}
                </div>

                {isDrafting && (
                  <div style={{ marginTop: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "12px 14px" }}>
                    <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 8 }}>Drafted in your voice · {strategy.tone.join(" · ")}</div>
                    <div style={{ fontSize: 13, color: "#EDEBF6", lineHeight: 1.6 }}>{draft}</div>
                    {lint && !lint.pass && (
                      <div style={{ marginTop: 9, fontSize: 11, color: "#FF5D8F", lineHeight: 1.5 }}>
                        ⚠ Fair-housing check: {lint.flags.map((f) => `“${f.match}” — ${f.why}`).join(" · ")}
                      </div>
                    )}
                    {lint && lint.pass && (
                      <div style={{ marginTop: 9, fontSize: 10.5, color: "#41D98A" }}>✓ Fair-housing check passed</div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                      <button
                        onClick={() => { copy(draft); setCopied(true); setTimeout(() => setCopied(false), 1500); setStatus(o.id, "engaged"); }}
                        style={{ background: "linear-gradient(180deg,#4ADE80,#16A34A)", color: "#04110E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
                      >
                        {copied ? "Copied ✓ — go post it" : "Copy & mark engaged"}
                      </button>
                      <button onClick={() => setDraftFor(null)} style={{ background: "transparent", color: "#8B89A0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                        Close
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: "#5E5C72", marginTop: 9 }}>
                      Farmhand never posts for you — you review, you post, your name earns it.
                    </div>
                  </div>
                )}

                {!isDrafting && o.status !== "engaged" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setDraftFor(o.id)} style={{ background: "rgba(38,224,200,0.12)", color: "#26E0C8", border: "1px solid rgba(38,224,200,0.4)", borderRadius: 8, padding: "7px 15px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Draft reply
                    </button>
                    <button onClick={() => setStatus(o.id, "watching")} style={{ background: "transparent", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.35)", borderRadius: 8, padding: "7px 15px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Watch
                    </button>
                    <button onClick={() => setStatus(o.id, "skipped")} style={{ background: "transparent", color: "#77758C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 15px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Skip
                    </button>
                  </div>
                )}
                {o.status === "engaged" && !isDrafting && (
                  <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "#41D98A" }}>✓ Engaged — logged to this source</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* rotation shortcut */}
      <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="fh-kicker" style={{ fontSize: 9.5 }}>Not sure where to look?</div>
        <button
          onClick={() => set({ engageTab: "sources" })}
          style={{ background: "rgba(38,224,200,0.1)", color: "#26E0C8", border: "1px solid rgba(38,224,200,0.35)", borderRadius: 8, padding: "7px 15px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
        >
          Open your auto-discovered sources →
        </button>
      </div>
    </div>
  );
}

export default function Engage() {
  const { state, set } = useStore();
  const tab = state.engageTab;
  return (
    <div>
      <SubTabs
        tabs={[
          { id: "opportunities" as const, label: "Opportunities" },
          { id: "sources" as const, label: "Sources" },
          { id: "drafts" as const, label: "Reply Desk" },
        ]}
        active={tab}
        color="#26E0C8"
        onPick={(id) => set({ engageTab: id })}
      />
      {tab === "opportunities" ? <Opportunities /> : tab === "sources" ? <Sources /> : <Assistant />}
    </div>
  );
}
