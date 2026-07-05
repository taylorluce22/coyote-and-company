"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

/**
 * Designer slot: renders a scene built visually in Spline (spline.design)
 * via the Spline runtime on a plain canvas — no wrapper dependency.
 * Design anything in Spline's editor → Export → Code Export → copy the
 * scene URL (.splinecode) → paste it in Settings → it renders here, live
 * and interactive.
 */
export default function SplineHero() {
  const { state, set } = useStore();
  const url = (state.splineUrl as string) || "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let disposed = false;
    let app: { dispose?: () => void } | null = null;
    setStatus("loading");
    import("@splinetool/runtime")
      .then(({ Application }) => {
        if (disposed || !canvasRef.current) return;
        const a = new Application(canvasRef.current);
        app = a;
        return a.load(url).then(() => {
          if (!disposed) setStatus("ready");
        });
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      try {
        app?.dispose?.();
      } catch {}
    };
  }, [url]);

  if (!url) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="fh-glass" style={{ borderRadius: 18, padding: "28px 30px", maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🎨</div>
          <div className="fh-title" style={{ fontSize: 19, marginBottom: 10 }}>
            Design your own hero scene
          </div>
          <div style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.65, textAlign: "left" }}>
            1. Go to <b style={{ color: "#C9A8FF" }}>spline.design</b> (free) and build any 3D scene — drag, drop, sculpt, color.
            <br />
            2. Hit <b style={{ color: "#C9A8FF" }}>Export → Code Export</b> and copy the scene URL (ends in{" "}
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>.splinecode</span>).
            <br />
            3. Paste it in <b style={{ color: "#C9A8FF" }}>Settings → Designer scene</b> — it renders right here, interactive.
          </div>
          <button
            onClick={() => set({ tab: "settings" })}
            style={{
              marginTop: 16,
              background: "linear-gradient(180deg,#C084FC,#9333EA)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(147,51,234,0.5)",
            }}
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {status !== "ready" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            fontSize: 13,
            color: status === "error" ? "#FF5D8F" : "#8D89C0",
            fontFamily: "var(--label)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {status === "error" ? "Couldn't load that scene URL — check it in Settings" : "Loading your scene…"}
        </div>
      )}
    </div>
  );
}
