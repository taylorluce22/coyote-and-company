"use client";

import { forwardRef } from "react";
import {
  HEAD_FONTS,
  STUDIO_RATIOS,
  sizeFor,
  splitHook,
  type Slide,
  type StudioDesign,
  type Bg,
} from "@/lib/studio";
import { textures } from "@/lib/textures";

/**
 * Full-resolution post slide — faithful port of the Coyote engine's
 * PostSlide renderer: auto-sized headlines, punchline highlight,
 * texture/image/gradient/glow backgrounds with legibility scrim +
 * dim control, pillar tag, slide counter, CTA row, brand handle.
 * Rendered at true pixel size (1080×1350 etc.) and scaled by the parent;
 * html2canvas captures this exact DOM for export.
 */
export interface PillarInfo {
  short: string;
  color: string;
}

interface Props {
  slide: Slide;
  index: number;
  total: number;
  design: StudioDesign;
  bg: Bg;
  accent: string; // signature accent color
  pillar?: PillarInfo | null;
  handle: string;
}

const PostSlide = forwardRef<HTMLDivElement, Props>(function PostSlide(
  { slide, index, total, design, bg, accent, pillar, handle },
  ref
) {
  const ratio = STUDIO_RATIOS.find((r) => r.id === design.ratio) || STUDIO_RATIOS[0];
  const W = ratio.w,
    H = ratio.h;
  const pad = ratio.id === "story" ? 108 : 100;
  const fs = sizeFor(slide.text, slide.role, design.headFont);
  const head = HEAD_FONTS[design.headFont] || HEAD_FONTS.impact;
  const isCTA = slide.role === "CTA";
  const counter =
    total > 1
      ? String(index + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0")
      : null;

  const align = design.layout === "center" ? "center" : "flex-start";
  const justify = design.layout === "bottom" ? "flex-end" : "center";
  const textAlign = design.layout === "center" ? ("center" as const) : ("left" as const);

  const isPhoto = bg.type === "image";
  const isTex = bg.type === "texture";
  const lightBg = isTex && textures.isLight(bg.tex);
  const imgSrc = bg.type === "image" ? bg.img : bg.type === "texture" ? textures.src(bg.tex) : null;
  const baseColor =
    bg.type === "gradient" ? "linear-gradient(157deg, #16110b 0%, #0A0A0A 52%)" : "#0A0A0A";
  const textColor = lightBg ? "#1a140d" : "#F8F6F3";
  const subColor = lightBg ? "#5a5040" : "#CFC9C1";
  const handleColor = lightBg ? "#2a241c" : "#D4CFC8";
  const scrim = isPhoto || (isTex && !lightBg);
  const f = (design.dim == null ? 55 : design.dim) / 55;
  const cl = (v: number) => Math.max(0, Math.min(0.96, v));
  const scrimBg = isPhoto
    ? `linear-gradient(180deg, rgba(8,8,8,${cl(0.55 * f)}) 0%, rgba(8,8,8,${cl(0.28 * f)}) 38%, rgba(8,8,8,${cl(0.82 * f)}) 100%)`
    : `linear-gradient(180deg, rgba(8,8,8,${cl(0.3 * f)}) 0%, rgba(8,8,8,${cl(0.1 * f)}) 40%, rgba(8,8,8,${cl(0.55 * f)}) 100%)`;

  const hook = splitHook(slide.text);
  const useAccent = design.emphasis !== "off" && !isCTA && Array.isArray(hook);
  const accentStyle =
    design.emphasis === "box"
      ? {
          background: accent,
          color: "#160c04",
          padding: "0.01em 0.16em",
          borderRadius: "0.1em",
          boxDecorationBreak: "clone" as const,
          WebkitBoxDecorationBreak: "clone" as const,
        }
      : { color: accent };

  const rgba = (hex: string, a: number) => {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16),
      g = parseInt(m.slice(2, 4), 16),
      b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <div
      ref={ref}
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        background: baseColor,
        color: textColor,
        fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
        boxSizing: "border-box",
      }}
    >
      {imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt=""
          crossOrigin="anonymous"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {scrim && <div style={{ position: "absolute", inset: 0, background: scrimBg }} />}
      {bg.type === "glow" && (
        <div
          style={{
            position: "absolute",
            top: "-22%",
            left: "-10%",
            width: "80%",
            height: "70%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${rgba(accent, 0.3)} 0%, ${rgba(accent, 0)} 62%)`,
          }}
        />
      )}
      {bg.type === "gradient" && (
        <div
          style={{
            position: "absolute",
            bottom: "-20%",
            right: "-12%",
            width: "70%",
            height: "55%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${rgba(accent, 0.12)} 0%, ${rgba(accent, 0)} 60%)`,
          }}
        />
      )}

      {design.pillarTag && pillar && (
        <div style={{ position: "absolute", top: pad, left: pad, display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: pillar.color,
              boxShadow: "0 0 16px " + pillar.color,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-geist), 'Geist', sans-serif",
              fontSize: 26,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: subColor,
              fontWeight: 600,
            }}
          >
            {pillar.short}
          </span>
        </div>
      )}
      {counter && (
        <div
          style={{
            position: "absolute",
            top: pad,
            right: pad,
            fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
            fontSize: 26,
            letterSpacing: "0.08em",
            color: accent,
            fontWeight: 500,
          }}
        >
          {counter}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: pad,
          paddingTop: pad + 64,
          paddingBottom: pad + 124,
          display: "flex",
          flexDirection: "column",
          alignItems: align,
          justifyContent: justify,
          textAlign,
        }}
      >
        {design.accent && (
          <div
            style={{
              width: 96,
              height: 7,
              borderRadius: 8,
              background: accent,
              marginBottom: 44,
              boxShadow: `0 0 22px ${rgba(accent, 0.5)}`,
            }}
          />
        )}
        <div
          style={{
            fontFamily: head.family,
            fontWeight: head.weight,
            fontSize: fs,
            lineHeight: (slide.text || "").length < 56 ? head.leading : head.leading + 0.1,
            letterSpacing: head.track,
            textTransform: design.upper ? "uppercase" : "none",
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            color: textColor,
            textShadow: scrim ? "0 2px 34px rgba(0,0,0,0.7)" : "none",
          }}
        >
          {useAccent ? (
            <>
              {hook[0] ? <span>{hook[0]}</span> : null}
              <span style={accentStyle}>{hook[1]}</span>
            </>
          ) : Array.isArray(hook) ? (
            hook[0] + hook[1]
          ) : (
            hook
          )}
        </div>
        {isCTA && !/follow/i.test(slide.text || "") && (
          <div
            style={{
              marginTop: 40,
              display: "inline-flex",
              alignItems: "center",
              gap: 18,
              color: accent,
              fontSize: 34,
              fontFamily: "var(--font-geist), 'Geist', sans-serif",
              fontWeight: 600,
            }}
          >
            <span>Save &amp; share</span>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {slide.sticker && (
          <div
            style={{
              marginTop: 56,
              alignSelf: design.layout === "center" ? "center" : "flex-start",
              maxWidth: "82%",
              background: "rgba(16,16,16,0.9)",
              border: `2px solid ${rgba(accent, 0.5)}`,
              borderRadius: 28,
              padding: "26px 34px",
              fontFamily: "var(--font-geist), 'Geist', sans-serif",
            }}
          >
            <div style={{ fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, fontWeight: 700, marginBottom: 12 }}>
              Poll / CTA
            </div>
            <div style={{ fontSize: 32, color: "#F4F2EF", lineHeight: 1.25 }}>{slide.sticker}</div>
          </div>
        )}
      </div>

      {design.handle && (
        <div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: pad - 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                border: `1px solid ${rgba(accent, 0.4)}`,
                display: "grid",
                placeItems: "center",
                background: rgba(accent, 0.06),
                fontFamily: "var(--font-orbitron), 'Orbitron', sans-serif",
                fontSize: 24,
                fontWeight: 800,
                color: accent,
              }}
            >
              F
            </div>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
                fontSize: 27,
                color: handleColor,
                letterSpacing: "0.01em",
              }}
            >
              {handle}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default PostSlide;
