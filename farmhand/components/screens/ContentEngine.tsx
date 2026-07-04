"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { MagneticButton } from "@/components/ui";
import {
  ENGINE_POSTS,
  STUDIO_META,
  STUDIO_ACCENTS,
  STUDIO_LIB,
  IMG,
} from "@/lib/data";

function PlatformPreview() {
  const { state } = useStore();
  const post = ENGINE_POSTS.find((p) => p.id === state.studioSel) || ENGINE_POSTS[0];
  const seed = STUDIO_META[post.id].seed;
  const likes = ({ e1: "38", e2: "94", e3: "21", e4: "57" } as Record<string, string>)[post.id] || "42";
  const img = IMG(seed, 700, 700);

  const shell: React.CSSProperties = {
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 16px 44px rgba(0,0,0,0.4)",
  };

  return (
    <div className="fh-engpv">
      <div className="fh-kicker" style={{ marginBottom: 10 }}>
        How it&apos;ll look · {post.channel.toUpperCase()}
      </div>
      {post.channel === "Instagram" && (
        <div style={{ ...shell, background: "#000", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: 11 }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", padding: 2, background: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)" }}>
              <span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", backgroundImage: `url(${IMG("fh-ava", 60, 60)})`, backgroundSize: "cover" }} />
            </span>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>jess.sells.gilbert</div>
              <div style={{ fontSize: 10.5, color: "#aaa" }}>Gilbert, Arizona</div>
            </div>
          </div>
          <div style={{ width: "100%", aspectRatio: "4/5", backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div style={{ padding: "10px 12px 14px" }}>
            <div style={{ display: "flex", gap: 14, fontSize: 20, marginBottom: 8 }}>
              <span>♡</span><span>💬</span><span>➤</span><span style={{ marginLeft: "auto" }}>🔖</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{likes} likes</div>
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.4 }}>
              <b>jess.sells.gilbert</b> {post.preview}
            </div>
            <div style={{ fontSize: 11.5, color: "#8a8a8a", marginTop: 6 }}>View all 12 comments</div>
            <div style={{ fontSize: 10, color: "#8a8a8a", marginTop: 4 }}>{post.when}</div>
          </div>
        </div>
      )}
      {post.channel === "Facebook" && (
        <div style={{ ...shell, background: "#242526", color: "#e4e6eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", backgroundImage: `url(${IMG("fh-ava", 60, 60)})`, backgroundSize: "cover" }} />
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Jess Sells Gilbert</div>
              <div style={{ fontSize: 11, color: "#b0b3b8" }}>🌐 {post.when}</div>
            </div>
          </div>
          <div style={{ padding: "0 12px 10px", fontSize: 13, lineHeight: 1.5 }}>{post.preview}</div>
          <div style={{ width: "100%", aspectRatio: "16/10", backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div style={{ padding: "8px 12px", fontSize: 11.5, color: "#b0b3b8", borderBottom: "1px solid #3a3b3c" }}>
            👍❤️ 62 · 12 comments · 4 shares
          </div>
          <div style={{ display: "flex", padding: "6px 0", fontSize: 12.5, color: "#b0b3b8" }}>
            {["👍 Like", "💬 Comment", "↪ Share"].map((x) => (
              <span key={x} style={{ flex: 1, textAlign: "center", padding: 6 }}>{x}</span>
            ))}
          </div>
        </div>
      )}
      {post.channel === "Nextdoor" && (
        <div style={{ ...shell, background: "#fff", color: "#1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", backgroundImage: `url(${IMG("fh-ava", 60, 60)})`, backgroundSize: "cover" }} />
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                Jess Luce
                <span style={{ fontSize: 9, color: "#0a7d3c", background: "#e3f5e9", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>Neighborhood Pro</span>
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>Val Vista Lakes</div>
            </div>
          </div>
          <div style={{ padding: "0 12px 8px" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{post.title}</div>
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5, color: "#333" }}>{post.preview}</div>
          </div>
          <div style={{ width: "100%", aspectRatio: "16/10", backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div style={{ display: "flex", padding: "8px 12px", gap: 18, fontSize: 12.5, color: "#555" }}>
            <span>🤍 Like</span><span>💬 Reply</span><span>↗ Share</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PostStudio() {
  const { state, set } = useStore();
  const post = ENGINE_POSTS.find((p) => p.id === state.studioSel) || ENGINE_POSTS[0];
  const meta = STUDIO_META[post.id];
  const seed = state.studioImgs[post.id] || meta.seed;
  const accent = state.studioAccents[post.id] || STUDIO_ACCENTS[meta.pillar];
  const img = IMG(seed, 400, 500);

  const firstPerson = useMemo(() => {
    const text = (post.title + " " + post.preview).toLowerCase();
    return (text.match(/\b(i|i'm|i've|my|me|we|we're|our|us)\b/g) || []).length >= 2;
  }, [post]);

  const slides = [
    { kicker: post.channel.toUpperCase() + " · COVER", text: post.title, big: true },
    { kicker: "VALUE", text: post.preview, big: false },
    { kicker: "CTA", text: meta.cta, big: true },
  ];
  const lib = STUDIO_LIB[post.id] || [];
  const tierColors: Record<string, string> = { YOURS: "#41D98A", TEMPLATE: "#C9A8FF" };

  return (
    <div className="fh-glass" style={{ borderRadius: 18, padding: 22, marginTop: 20 }}>
      <div
        style={{
          fontFamily: "var(--label)",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.03em",
          background: "linear-gradient(90deg,#F4F3F8,#C9A8FF)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 8px rgba(168,85,247,0.35))",
          marginBottom: 16,
        }}
      >
        {post.title} — {post.channel}
        {firstPerson ? " · first-person → same human photo on every slide" : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 240px", gap: 22, alignItems: "start" }}>
        {/* slides */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {slides.map((sl, i) => {
            const photo = firstPerson || i === 0;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  width: 186,
                  aspectRatio: "4/5",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.13)",
                  flex: "none",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.42)",
                  background: "#0B1120",
                  animation: `fh-pop .5s ease ${(i * 0.1).toFixed(1)}s both`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    ...(photo
                      ? { backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center", filter: "grayscale(0.45) contrast(1.05)" }
                      : { background: "linear-gradient(135deg,#020617,#111827)" }),
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: photo
                      ? "linear-gradient(rgba(2,6,23,0.5),rgba(2,6,23,0.8))"
                      : `radial-gradient(120% 90% at 18% 0%, ${accent}17, transparent 55%)`,
                  }}
                />
                <div style={{ position: "absolute", inset: 0, padding: 13, zIndex: 1 }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.1em", fontFamily: "var(--mono)", color: accent }}>{sl.kicker}</div>
                  <div
                    style={{
                      marginTop: 7,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.32,
                      display: "-webkit-box",
                      WebkitLineClamp: 6,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      ...(sl.big
                        ? { fontSize: 12.5, fontWeight: 800, color: "#F9FAFB" }
                        : { fontSize: 10, fontWeight: 600, color: "#E5E7EB" }),
                    }}
                  >
                    {sl.text}
                  </div>
                </div>
                <div style={{ position: "absolute", left: "9%", bottom: "17.5%", width: 26, height: 3, borderRadius: 2, background: accent, zIndex: 1 }} />
                <div style={{ position: "absolute", right: 8, bottom: 8, fontSize: 9, fontFamily: "var(--mono)", color: "#8B89A0", zIndex: 1 }}>{i + 1}/3</div>
              </div>
            );
          })}
        </div>

        {/* side controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="fh-kicker" style={{ fontSize: 10, marginBottom: 8 }}>Images · matched to subject</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {lib.map((im, li) => {
                const active = seed === im.seed;
                return (
                  <button
                    key={im.seed + li}
                    onClick={() => set({ studioImgs: { ...state.studioImgs, [post.id]: im.seed } })}
                    title={im.alt}
                    style={{
                      position: "relative",
                      padding: 0,
                      width: 76,
                      aspectRatio: "1",
                      borderRadius: 9,
                      overflow: "hidden",
                      cursor: "pointer",
                      flex: "none",
                      backgroundImage: `url(${IMG(im.seed, 160, 160)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      border: `2px solid ${active ? accent : "rgba(255,255,255,0.12)"}`,
                      boxShadow: active ? `0 0 14px ${accent}66` : "none",
                      animation: `fh-pop .4s ease ${(li * 0.05).toFixed(2)}s both`,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 4,
                        fontSize: 7.5,
                        fontWeight: 700,
                        fontFamily: "var(--mono)",
                        letterSpacing: "0.05em",
                        color: "#0B0B16",
                        background: tierColors[im.tier] || "#FFC23D",
                        borderRadius: 4,
                        padding: "2px 5px",
                      }}
                    >
                      {im.tier}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="fh-kicker" style={{ fontSize: 10, marginBottom: 8 }}>Signature accent · by pillar</div>
            <div style={{ display: "flex", gap: 9 }}>
              {Object.keys(STUDIO_ACCENTS).map((pillar) => {
                const col = STUDIO_ACCENTS[pillar];
                const active = accent === col;
                return (
                  <button
                    key={pillar}
                    title={pillar}
                    onClick={() => set({ studioAccents: { ...state.studioAccents, [post.id]: col } })}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: `2px solid ${active ? "#F4F3F8" : "transparent"}`,
                      background: col,
                      cursor: "pointer",
                      padding: 0,
                      flex: "none",
                      boxShadow: active ? `0 0 12px ${col}88` : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "#6E6C82", lineHeight: 1.6 }}>
            One signature accent per post · 4:5 canvas · safe-zone margins · footer band on every slide · first-person posts carry the same human photo across all slides.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContentEngine() {
  const { state, set } = useStore();
  const pending = ENGINE_POSTS.filter((p) => !state.approved[p.id]).length;

  return (
    <div>
      <div className="fh-enggrid">
        <PlatformPreview />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 14, color: "#A6A4B8" }}>
              {pending} posts waiting for your approval. Tap a card to preview &amp; style it.
            </div>
            <MagneticButton
              onClick={() => {
                const patch: Record<string, boolean> = { ...state.approved };
                ENGINE_POSTS.forEach((p) => (patch[p.id] = true));
                set({ approved: patch });
              }}
              style={{
                background: "linear-gradient(180deg,#C084FC,#9333EA)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "9px 18px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 22px rgba(147,51,234,0.5)",
              }}
            >
              Approve all {pending}
            </MagneticButton>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ENGINE_POSTS.map((p, qi) => {
              const approved = !!state.approved[p.id];
              const inStudio = state.studioSel === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => set({ studioSel: p.id })}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    cursor: "pointer",
                    backdropFilter: "blur(12px)",
                    background: "linear-gradient(160deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))",
                    border: `1px solid ${inStudio ? "rgba(168,85,247,0.55)" : approved ? "rgba(65,217,138,0.3)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 15,
                    padding: "16px 18px",
                    boxShadow: `0 10px 28px rgba(0,0,0,0.28)${inStudio ? ", 0 0 24px rgba(168,85,247,0.12)" : ""}`,
                    opacity: approved ? 0.72 : 1,
                    transition: "border-color .26s ease, box-shadow .26s ease, opacity .26s ease",
                    animation: `fh-rise .5s ease ${(0.05 + qi * 0.08).toFixed(2)}s both`,
                  }}
                >
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 11,
                      flexShrink: 0,
                      background: p.thumb,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: "var(--mono)",
                      color: "rgba(255,255,255,0.8)",
                      textAlign: "center",
                      whiteSpace: "pre-line",
                      lineHeight: 1.2,
                    }}
                  >
                    {p.thumbLabel}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", color: "#C9A8FF" }}>{p.channel}</span>
                      <span style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "#6E6C82" }}>{p.when}</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          fontFamily: "var(--mono)",
                          color: p.layer === "PERSONAL" ? "#FF9A62" : "#8B89A0",
                          border: `1px solid ${p.layer === "PERSONAL" ? "rgba(255,154,98,0.4)" : "rgba(255,255,255,0.15)"}`,
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        {p.layer}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "#8B89A0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.preview}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!approved) set({ approved: { ...state.approved, [p.id]: true } });
                    }}
                    style={{
                      border: approved ? "1px solid rgba(65,217,138,0.4)" : "none",
                      borderRadius: 9,
                      padding: "8px 18px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: approved ? "default" : "pointer",
                      flexShrink: 0,
                      background: approved ? "rgba(65,217,138,0.16)" : "#A855F7",
                      color: approved ? "#41D98A" : "#0B0B16",
                      boxShadow: approved ? "none" : "0 4px 18px rgba(168,85,247,0.4)",
                    }}
                  >
                    {approved ? "Scheduled ✓" : "Approve"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PostStudio />
    </div>
  );
}
