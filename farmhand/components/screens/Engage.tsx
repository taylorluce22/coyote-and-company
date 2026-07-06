"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";
import Sources from "./Sources";
import Assistant from "./Assistant";
import { cadenceCap, type StrategyProfile } from "@/lib/strategy";
import { draftReply, fairHousingLint, scoreOpportunity, tagOpportunity, type Opportunity } from "@/lib/engage";

interface RadarItem {
  id: string;
  title: string;
  text: string;
  subreddit: string;
  author: string;
  url: string;
  ageMins: number;
  comments: number;
}

function ageLabel(mins: number) {
  return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`;
}

/** Live Reddit radar — real conversations mentioning the agent's territories. */
function Radar({ onCapture }: { onCapture: (item: RadarItem) => void }) {
  const { state } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const [items, setItems] = useState<RadarItem[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [captured, setCaptured] = useState<Record<string, boolean>>({});

  const scan = async () => {
    if (scanning) return;
    setScanning(true);
    setError(false);
    try {
      const results = await Promise.all(
        strategy.territories.slice(0, 4).map((t) =>
          fetch(`/api/radar?q=${encodeURIComponent(`"${t.name}"`)}`)
            .then((r) => r.json())
            .catch(() => ({ items: [] }))
        )
      );
      const seen = new Set<string>();
      const all: RadarItem[] = [];
      results.forEach((r) => (r.items || []).forEach((it: RadarItem) => {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          all.push(it);
        }
      }));
      all.sort((a, b) => a.ageMins - b.ageMins);
      setItems(all.slice(0, 8));
      if (!all.length && results.every((r) => r.error)) setError(true);
    } catch {
      setError(true);
      setItems([]);
    }
    setScanning(false);
  };

  return (
    <div className="fh-glass" style={{ borderRadius: 14, padding: "15px 17px", marginBottom: 16, border: "1px solid rgba(255,154,98,0.22)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF9A62", boxShadow: "0 0 8px #FF9A62", animation: "fh-pulse 2s ease infinite" }} />
        <span className="fh-kicker" style={{ fontSize: 9.5 }}>Live radar · Reddit</span>
        <span style={{ fontSize: 10.5, color: "#77758C" }}>
          real conversations mentioning {strategy.territories.map((t) => t.name).join(", ")}
        </span>
        <button
          onClick={scan}
          disabled={scanning}
          style={{ marginLeft: "auto", background: scanning ? "rgba(255,255,255,0.05)" : "rgba(255,154,98,0.12)", color: scanning ? "#8B89A0" : "#FF9A62", border: "1px solid rgba(255,154,98,0.4)", borderRadius: 8, padding: "6px 15px", fontSize: 11.5, fontWeight: 700, cursor: scanning ? "default" : "pointer" }}
        >
          {scanning ? "Scanning…" : items === null ? "Scan now" : "↻ Rescan"}
        </button>
      </div>

      {items !== null && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "#77758C", lineHeight: 1.55 }}>
              {error
                ? "Couldn't reach Reddit from this deployment right now — try again in a minute."
                : "No fresh threads mentioning your territories this month. Rescan tomorrow — relocation questions come in waves."}
            </div>
          ) : (
            items.map((it) => (
              <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", background: "rgba(0,0,0,0.24)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 650, color: "#EDEBF6", lineHeight: 1.4 }}>{it.title}</div>
                  <div style={{ fontSize: 10, color: "#77758C", marginTop: 3, fontFamily: "var(--mono)" }}>
                    r/{it.subreddit} · u/{it.author} · {ageLabel(it.ageMins)} · {it.comments} comments ·{" "}
                    <a href={it.url} target="_blank" rel="noreferrer" style={{ color: "#7DD3FC", textDecoration: "none" }}>
                      open thread ↗
                    </a>
                  </div>
                </div>
                <button
                  onClick={() => { onCapture(it); setCaptured((c) => ({ ...c, [it.id]: true })); }}
                  disabled={!!captured[it.id]}
                  style={{ flexShrink: 0, background: captured[it.id] ? "transparent" : "rgba(38,224,200,0.12)", color: captured[it.id] ? "#41D98A" : "#26E0C8", border: captured[it.id] ? "none" : "1px solid rgba(38,224,200,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: captured[it.id] ? "default" : "pointer" }}
                >
                  {captured[it.id] ? "✓ In inbox" : "→ Inbox"}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#5E5C72", marginTop: 10, lineHeight: 1.5 }}>
        Reddit is the one platform apps may read. Facebook Groups &amp; Nextdoor don&apos;t allow it (and scraping risks
        your account) — capture those below, and turn on each group&apos;s keyword alerts so they come to you.
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
      firstTouch: !opps.some((o) => o.sourceName === (source.trim() || "Pasted thread")),
    };
    set((s) => ({ opportunities: [opp, ...(s.opportunities as Opportunity[])] }));
    setText("");
    setSource("");
  };

  const setStatus = (id: string, status: Opportunity["status"]) =>
    set((s) => ({ opportunities: (s.opportunities as Opportunity[]).map((o) => (o.id === id ? { ...o, status } : o)) }));

  const engagedThisWeek = opps.filter((o) => o.status === "engaged").length;

  const captureFromRadar = (it: { title: string; text: string; subreddit: string; url: string }) => {
    const full = `${it.title} ${it.text}`.trim();
    const territoryNames = strategy.territories.map((t) => t.name);
    const matched = territoryNames.find((n) => full.toLowerCase().includes(n.toLowerCase()));
    const opp: Opportunity = {
      id: `opp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      sourceName: `r/${it.subreddit}`,
      territory: matched || territoryNames[0] || "General",
      excerpt: full.slice(0, 400),
      url: it.url,
      tags: tagOpportunity(full),
      status: "new",
      capturedAt: "just now",
      firstTouch: !opps.some((o) => o.sourceName === `r/${it.subreddit}`),
    };
    set((s) => ({ opportunities: [opp, ...(s.opportunities as Opportunity[])] }));
  };

  return (
    <div>
      <Radar onCapture={captureFromRadar} />
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
            const score = scoreOpportunity(o.excerpt, strategy.territories.map((t) => t.name));
            const isDrafting = draftFor === o.id;
            const draft = isDrafting
              ? draftReply({ excerpt: o.excerpt, tags: o.tags, tone: strategy.tone, mode: strategy.prospectingMode, firstTouch: o.firstTouch, agentName: strategy.name, territory: o.territory })
              : "";
            const lint = isDrafting ? fairHousingLint(draft) : null;
            return (
              <div key={o.id} className="fh-glass" style={{ borderRadius: 13, padding: "14px 16px", borderLeft: `3px solid ${o.status === "engaged" ? "#41D98A" : o.status === "watching" ? "#FFC23D" : "#26E0C8"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#D8D6E6" }}>{o.sourceName}</span>
                  <span style={{ fontSize: 10, color: "#77758C" }}>· {o.territory} · {o.capturedAt}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, fontFamily: "var(--mono)", color: score >= 60 ? "#41D98A" : score >= 40 ? "#FFC23D" : "#8B89A0" }}>
                    {score} match
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#C9C7D6", marginTop: 7, lineHeight: 1.5 }}>&ldquo;{o.excerpt}&rdquo;</div>
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
