"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import SubTabs from "@/components/SubTabs";
import Sources from "./Sources";
import Assistant from "./Assistant";
import { cadenceCap, type StrategyProfile } from "@/lib/strategy";
import { draftReply, fairHousingLint, scoreOpportunity, tagOpportunity, type Opportunity } from "@/lib/engage";

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

  return (
    <div>
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
