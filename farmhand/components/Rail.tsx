"use client";

import { useStore } from "@/lib/store";
import { NAV_DEFS, ENGINE_POSTS, type TabId } from "@/lib/data";

export default function Rail() {
  const { state, set } = useStore();
  const pending = state.demoMode ? ENGINE_POSTS.filter((p) => !state.approved[p.id]).length : 0;
  const drafts = state.plannedPosts.filter((p) => p.plannedDay && p.status === "draft").length;
  const badgeFor = (id: string) =>
    id === "content" ? (pending + drafts) || null : null;

  return (
    <aside className="fh-rail">
      <div className="fh-nav3d" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "6px 8px 20px",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "linear-gradient(135deg, #A855F7, #38BDF8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "var(--brand)",
              color: "#0B0B16",
              boxShadow: "0 8px 22px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            F
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontFamily: "var(--brand)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.06em",
              }}
            >
              FARMHAND
            </div>
            <div className="fh-kicker" style={{ fontSize: 9, marginTop: 2 }}>
              LOCAL PRESENCE OS
            </div>
          </div>
        </div>

        {NAV_DEFS.map((n) => {
          const active = state.tab === n.id;
          const badge = badgeFor(n.id);
          return (
            <button
              key={n.id}
              onClick={() => set({ tab: n.id as TabId })}
              className={`fh-navitem ${active ? "on" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                padding: "12px 13px",
                borderRadius: 13,
                color: active ? "#F4F3F8" : "#A6A4B8",
                background: active
                  ? `linear-gradient(145deg, ${n.color}30, ${n.color}0C 60%, rgba(14,12,28,0.7))`
                  : "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))",
                border: `1px solid ${active ? n.color + "66" : "rgba(255,255,255,0.07)"}`,
                boxShadow: active
                  ? `0 14px 30px rgba(0,0,0,0.5), 0 6px 22px ${n.color}38, inset 0 1px 0 rgba(255,255,255,0.18)`
                  : "0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: "var(--label)",
                  color: active ? "#0B0B16" : n.color,
                  background: active
                    ? `linear-gradient(145deg, ${n.color}, ${n.color}99)`
                    : `linear-gradient(145deg, ${n.color}2E, ${n.color}10)`,
                  border: `1px solid ${n.color}${active ? "" : "4D"}`,
                  boxShadow: active
                    ? `0 4px 12px ${n.color}66, inset 0 1px 0 rgba(255,255,255,0.4)`
                    : "inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                {n.label[0]}
              </span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{n.label}</span>
              {badge != null && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "var(--mono)",
                    color: "#0B0B16",
                    background: n.color,
                    borderRadius: 999,
                    padding: "2px 8px",
                    boxShadow: `0 3px 10px ${n.color}66, inset 0 1px 0 rgba(255,255,255,0.4)`,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
