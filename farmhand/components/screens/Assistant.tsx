"use client";

import { useStore } from "@/lib/store";
import { MagneticButton } from "@/components/ui";
import { draftReply } from "@/lib/engage";
import { tagFor, verticalOf } from "@/lib/verticals";
import type { StrategyProfile } from "@/lib/strategy";

const TONES: [string, string][] = [
  ["warm", "Warm"],
  ["expert", "Expert"],
  ["brief", "Brief"],
];

/**
 * Draft from the ACTUAL pasted text through the real reply engine —
 * vertical-aware (solar accounts get solar replies + the identity CTA),
 * tag-driven, first-touch safe. Replaces the old canned demo strings that
 * ignored the input entirely.
 */
function buildReply(input: string, strategy: StrategyProfile, tone: string, variant: number): string {
  const vert = verticalOf(strategy.vertical);
  const tags = tagFor(vert, input);
  const territoryNames = strategy.territories.map((t) => t.name);
  const territory =
    territoryNames.find((n) => input.toLowerCase().includes(n.toLowerCase())) ||
    (vert.id === "solar" ? "the Valley" : territoryNames[0] || strategy.homeBase || "Arizona");
  const toneArr =
    variant === 1 ? ["warm", "neighborly"] : tone === "warm" ? ["warm", "neighborly"] : tone === "expert" ? ["data-driven", "sharp"] : ["direct"];
  const mode: "observer" | "participant" = variant === 2 || tone === "brief" ? "observer" : "participant";
  return draftReply({
    excerpt: input,
    tags,
    tone: toneArr,
    mode,
    firstTouch: true,
    agentName: strategy.name,
    territory,
    vertical: vert.id,
  });
}

export default function Assistant() {
  const { state, set, copy } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const tone = state.asstTone;
  const reply = state.asstShown
    ? buildReply(state.asstInput, strategy, tone, state.asstVariant)
    : "Your drafted reply will appear here — helpful, human, and never salesy. Paste a thread, pick a tone, and hit Draft reply.";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
      {/* input */}
      <div className="fh-glass" style={{ borderRadius: 16, padding: 20 }}>
        <div className="fh-kicker" style={{ marginBottom: 12 }}>Paste a group thread or question</div>
        <textarea
          value={state.asstInput}
          onChange={(e) => set({ asstInput: e.target.value })}
          style={{
            width: "100%",
            minHeight: 150,
            resize: "vertical",
            fontFamily: "var(--body)",
            fontSize: 14,
            lineHeight: 1.6,
            color: "#F4F3F8",
            background: "rgba(0,0,0,0.28)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "13px 15px",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <span className="fh-kicker" style={{ fontSize: 10 }}>Tone</span>
          {TONES.map(([k, label]) => {
            const on = tone === k;
            return (
              <button
                key={k}
                onClick={() => set({ asstTone: k, asstCopied: false })}
                style={{
                  border: `1px solid ${on ? "#FF9A62" : "rgba(255,255,255,0.14)"}`,
                  background: on ? "rgba(255,154,98,0.18)" : "transparent",
                  color: on ? "#FF9A62" : "#A6A4B8",
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
          <MagneticButton
            onClick={() => set({ asstShown: true, asstVariant: 0, asstCopied: false })}
            style={{
              marginLeft: "auto",
              background: "#FF9A62",
              color: "#0B0B16",
              border: "none",
              borderRadius: 9,
              padding: "9px 18px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(255,154,98,0.4)",
            }}
          >
            Draft reply
          </MagneticButton>
        </div>
      </div>

      {/* output */}
      <div className="fh-glass" style={{ borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div className="fh-kicker" style={{ fontSize: 10 }}>Drafted reply · in your voice</div>
          <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: "#41D98A", background: "rgba(65,217,138,0.12)", border: "1px solid rgba(65,217,138,0.35)", borderRadius: 999, padding: "2px 9px" }}>
            NON-SALESY
          </span>
        </div>
        <div
          style={{
            fontSize: 14.5,
            lineHeight: 1.65,
            color: state.asstShown ? "#E8E6F2" : "#6E6C82",
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "16px 18px",
            minHeight: 150,
          }}
        >
          {reply}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => set({ asstShown: true, asstVariant: 1, asstCopied: false })}
            style={{ border: "1px solid rgba(255,255,255,0.14)", background: "none", color: "#A6A4B8", borderRadius: 9, padding: "8px 15px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            More casual
          </button>
          <button
            onClick={() => set({ asstShown: true, asstVariant: 2, asstCopied: false })}
            style={{ border: "1px solid rgba(255,255,255,0.14)", background: "none", color: "#A6A4B8", borderRadius: 9, padding: "8px 15px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Shorter
          </button>
          <button
            onClick={() => {
              copy(buildReply(state.asstInput, strategy, tone, state.asstVariant));
              set({ asstCopied: true });
            }}
            disabled={!state.asstShown}
            style={{
              marginLeft: "auto",
              border: state.asstCopied ? "1px solid rgba(65,217,138,0.4)" : "none",
              borderRadius: 9,
              padding: "9px 18px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: state.asstShown ? "pointer" : "default",
              background: state.asstCopied ? "rgba(65,217,138,0.16)" : "#FF9A62",
              color: state.asstCopied ? "#41D98A" : "#0B0B16",
              opacity: state.asstShown ? 1 : 0.5,
            }}
          >
            {state.asstCopied ? "Copied ✓" : "Copy reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
