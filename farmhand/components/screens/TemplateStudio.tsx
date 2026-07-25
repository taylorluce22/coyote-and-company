"use client";

import { useEffect, useState } from "react";
import { DG, ARCHETYPES, SAMPLE_POSTS, PILLARS, type DGPost } from "@/lib/desertGrid";
import { DGSlideView } from "@/components/DGSlide";

/**
 * DESERT GRID Studio — the template-system reference gallery, rendered
 * through the SHARED archetype renderer (components/DGSlide.tsx — the same
 * component the Composer's Editorial mode captures at 1080×1350). Sample
 * posts here are the spec's fact-bank demos; real posts compile from the
 * idea engine via lib/dgCompile.ts.
 */
export default function TemplateStudio() {
  const [postId, setPostId] = useState(SAMPLE_POSTS[0].id);
  const post = SAMPLE_POSTS.find((p) => p.id === postId) as DGPost;
  // slide width fits 320px-class phones; measured post-mount so SSR and the
  // first client render agree (hydration-safe)
  const [slideW, setSlideW] = useState(336);
  useEffect(() => {
    const fit = () => setSlideW(Math.min(336, document.documentElement.clientWidth - 44));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 18 }}>
        The DESERT GRID template system, live in the app. Each post is a data object rendered through the archetypes —
        one idea per frame, the number set as a hero, a source line on every data slide. This same renderer powers the
        Composer&apos;s <b style={{ color: "#F4F0E6" }}>Editorial · data</b> mode, where your real ideas compile into
        these slides and export free (no image credits).
      </p>

      {/* token legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {([["Paper", DG.paper], ["Ink", DG.ink], ["Accent Hot", DG.hot], ["Data Cool", DG.cool], ["Neutral", DG.neutral], ["Night", DG.night]] as [string, string][]).map(([n, hex]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: "#8B89A0" }}>
            <span style={{ width: 18, height: 18, borderRadius: 3, background: hex, border: "1px solid rgba(255,255,255,0.14)" }} />{n}
          </div>
        ))}
      </div>

      {/* post picker */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {SAMPLE_POSTS.map((p) => {
          const on = p.id === postId;
          return (
            <button key={p.id} onClick={() => setPostId(p.id)} style={{ cursor: "pointer", border: on ? "1px solid #E8622C" : "1px solid rgba(255,255,255,0.12)", background: on ? "rgba(232,98,44,0.14)" : "rgba(255,255,255,0.04)", color: on ? "#F4F0E6" : "#A6A4B8", borderRadius: 10, padding: "8px 13px", fontSize: 12, fontWeight: 600 }}>
              <span style={{ color: "#E8622C", fontWeight: 700, marginRight: 6 }}>{PILLARS[p.pillar].label}</span>{p.title}
            </button>
          );
        })}
      </div>

      {/* the carousel */}
      <div style={{ display: "flex", gap: 18, overflowX: "auto", padding: "4px 2px 20px", scrollSnapType: "x mandatory" }}>
        {post.slides.map((s, i) => (
          <div key={i} style={{ flex: "0 0 auto", scrollSnapAlign: "center", boxShadow: "0 14px 34px rgba(0,0,0,0.34)", border: "1px solid rgba(0,0,0,0.1)" }}>
            <DGSlideView s={s} idx={i + 1} total={post.slides.length} width={slideW} />
          </div>
        ))}
      </div>

      {/* archetype library reference */}
      <div style={{ marginTop: 20 }}>
        <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 10 }}>The 16-archetype library</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {ARCHETYPES.map((a) => (
            <div key={a.id} className="fh-glass" style={{ borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#F4F3F8" }}><span style={{ color: "#E8622C" }}>{a.id}</span> · {a.name}</div>
              <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 2 }}>{a.shape}</div>
            </div>
          ))}
          <div className="fh-glass" style={{ borderRadius: 10, padding: "10px 12px", opacity: 0.6 }}>
            <div style={{ fontSize: 10.5, color: "#8B89A0" }}>+7 more (map, small-multiples, timeline, teardown, scorecard, quote, isometric)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
