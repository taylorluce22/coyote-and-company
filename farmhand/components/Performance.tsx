"use client";

import { useStore } from "@/lib/store";
import type { PlannedPost } from "@/lib/planner";
import type { Contact } from "@/lib/pipeline";

/**
 * Content ↔ CRM connection (manual until Meta APIs connect):
 * one tap logs a DM / comment / inquiry against a post; theme tallies
 * feed idea ranking and Insights. "+ Lead" turns a response into a
 * person with the post preserved as sourceContext.
 */

type Resp = { pillar: string; dm: number; comment: number; inquiry: number };

const PILLAR_COLORS: Record<string, string> = { market: "#38BDF8", story: "#FF9A62", tips: "#41D98A", spotlight: "#C9A8FF" };

export default function Performance() {
  const { state, set } = useStore();
  const posts = (state.plannedPosts as PlannedPost[]) || [];
  const responses = (state.contentResponses as Record<string, Resp>) || {};

  const bump = (post: PlannedPost, kind: "dm" | "comment" | "inquiry") =>
    set((s) => {
      const cur = ((s.contentResponses as Record<string, Resp>) || {})[post.id] || { pillar: post.pillar, dm: 0, comment: 0, inquiry: 0 };
      return { contentResponses: { ...(s.contentResponses as Record<string, Resp>), [post.id]: { ...cur, pillar: post.pillar, [kind]: cur[kind] + 1 } } };
    });

  const addLead = (post: PlannedPost) => {
    const now = Date.now();
    const c: Contact = {
      id: `c-post-${now}`,
      name: "Lead from post",
      origin: "instagram",
      stage: "new",
      warmth: "warming",
      note: `Responded to: “${post.topic.slice(0, 70)}”`,
      notes: [],
      ctype: "lead",
      tags: ["from-content"],
      sourceContext: `Post · ${post.topic.slice(0, 80)}`,
      createdAt: now,
      lastTouchAt: now,
    };
    set((s) => ({ contacts: [c, ...(s.contacts as Contact[])], tab: "pipeline" }));
  };

  // theme tallies
  const themeTotals = new Map<string, number>();
  Object.values(responses).forEach((r) => themeTotals.set(r.pillar, (themeTotals.get(r.pillar) || 0) + r.dm + r.comment + r.inquiry));
  const best = [...themeTotals.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <div style={{ fontSize: 13, color: "#A6A4B8", marginBottom: 8, lineHeight: 1.55 }}>
        When a post gets a DM, comment, or inquiry — log it with one tap. Farmhand learns which themes actually
        produce conversations and ranks your ideas accordingly.
      </div>
      {best && best[1] > 0 && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#41D98A", background: "rgba(65,217,138,0.07)", border: "1px solid rgba(65,217,138,0.25)", borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>
          ★ Your <b style={{ textTransform: "uppercase" }}>{best[0]}</b> content produces the most responses ({best[1]}) — make more of it.
        </div>
      )}

      {posts.length === 0 ? (
        <div style={{ padding: "26px 10px", fontSize: 12.5, color: "#77758C" }}>
          No posts yet — plan your week or draft in the Studio, then log responses here as they come in.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {posts.map((post) => {
            const r = responses[post.id];
            const total = r ? r.dm + r.comment + r.inquiry : 0;
            const col = PILLAR_COLORS[post.pillar] || "#8B89A0";
            return (
              <div key={post.id} className="fh-glass" style={{ borderRadius: 12, padding: "12px 15px", borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "var(--label)", color: col, textTransform: "uppercase" }}>{post.pillar}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#EDEBF6", flex: 1, minWidth: 200 }}>{post.topic}</span>
                  <span style={{ fontSize: 10, color: "#77758C", fontFamily: "var(--mono)" }}>
                    {post.status}{post.plannedDay ? ` · ${post.plannedDay}` : ""} {total > 0 && <b style={{ color: "#41D98A" }}>· {total} response{total > 1 ? "s" : ""}</b>}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  <button onClick={() => bump(post, "dm")} style={{ background: "rgba(125,211,252,0.1)", color: "#7DD3FC", border: "1px solid rgba(125,211,252,0.35)", borderRadius: 7, padding: "5px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
                    + DM {r?.dm ? `(${r.dm})` : ""}
                  </button>
                  <button onClick={() => bump(post, "comment")} style={{ background: "rgba(201,168,255,0.1)", color: "#C9A8FF", border: "1px solid rgba(201,168,255,0.35)", borderRadius: 7, padding: "5px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
                    + Comment {r?.comment ? `(${r.comment})` : ""}
                  </button>
                  <button onClick={() => bump(post, "inquiry")} style={{ background: "rgba(255,194,61,0.1)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.35)", borderRadius: 7, padding: "5px 12px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
                    + Inquiry {r?.inquiry ? `(${r.inquiry})` : ""}
                  </button>
                  <button onClick={() => addLead(post)} style={{ marginLeft: "auto", background: "rgba(65,217,138,0.12)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.4)", borderRadius: 7, padding: "5px 13px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
                    + Lead from this post →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
