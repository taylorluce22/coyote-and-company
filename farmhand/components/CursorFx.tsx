"use client";

import { useEffect, useRef } from "react";

/**
 * Premium cursor layer — a soft glow that trails the pointer with a slight
 * lag (lerp), snapping brighter and larger over interactive elements. The
 * native cursor stays visible: this is an app people work in, not a splash
 * page, so the effect layers craft on top without hurting usability.
 * Skipped entirely on touch devices and for prefers-reduced-motion.
 */
export default function CursorFx() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dot = dotRef.current;
    const glow = glowRef.current;
    if (!dot || !glow) return;

    let tx = -100, ty = -100; // target (real pointer)
    let gx = -100, gy = -100; // lagged glow position
    let hot = false; // over an interactive element
    let raf = 0;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        dot.style.opacity = "1";
        glow.style.opacity = "1";
        gx = tx;
        gy = ty;
      }
      const el = (e.target as Element | null)?.closest?.("button, a, [role='button'], [role='switch'], input, textarea, select");
      hot = !!el;
    };
    const onLeave = () => {
      visible = false;
      dot.style.opacity = "0";
      glow.style.opacity = "0";
    };

    const tick = () => {
      // dot tracks tight, glow floats behind — the classic trail feel
      gx += (tx - gx) * 0.16;
      gy += (ty - gy) * 0.16;
      const dotScale = hot ? 2.2 : 1;
      const glowScale = hot ? 1.5 : 1;
      dot.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%) scale(${dotScale})`;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0) translate(-50%, -50%) scale(${glowScale})`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={glowRef}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 260,
          height: 260,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9998,
          opacity: 0,
          background: "radial-gradient(circle, rgba(255,154,98,0.10) 0%, rgba(201,168,255,0.05) 45%, transparent 70%)",
          transition: "opacity 0.35s ease",
          willChange: "transform",
        }}
      />
      <div
        ref={dotRef}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 9,
          height: 9,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9999,
          opacity: 0,
          background: "rgba(255,154,98,0.85)",
          boxShadow: "0 0 14px rgba(255,154,98,0.65)",
          mixBlendMode: "screen",
          transition: "opacity 0.35s ease, width 0.2s ease, height 0.2s ease",
          willChange: "transform",
        }}
      />
    </>
  );
}
