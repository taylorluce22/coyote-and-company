"use client";

import { useMemo, useRef, useCallback } from "react";
import { useStore, type Upload } from "@/lib/store";
import { MagneticButton } from "@/components/ui";
import {
  COMP_COPY,
  COMP_IMGS,
  COMP_RATIOS,
  COMP_ACCENTS,
  COMP_TIERS,
  IMG,
  type CompCh,
} from "@/lib/data";

const CHANNELS: [CompCh, string][] = [
  ["ig", "Instagram"],
  ["fb", "Facebook"],
  ["nd", "Nextdoor"],
];

/* ---- canvas PNG export (studio parity, true output sizes) ---- */
function exportPNG(o: {
  url: string;
  bgMode: string;
  gradBg: string;
  accent: string;
  kicker: string;
  headline: string;
  w: number;
  h: number;
}) {
  const draw = (img: HTMLImageElement | null) => {
    const cv = document.createElement("canvas");
    cv.width = o.w;
    cv.height = o.h;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const W = o.w,
      H = o.h,
      pad = Math.round(W * 0.08);
    if (o.bgMode === "gradient" || !img) {
      const g = cx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#020617");
      g.addColorStop(0.55, "#0B0F1A");
      g.addColorStop(1, o.accent);
      cx.fillStyle = g;
      cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 0.13;
      const rg = cx.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W);
      rg.addColorStop(0, o.accent);
      rg.addColorStop(1, "transparent");
      cx.fillStyle = rg;
      cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 1;
    } else {
      const ir = img.width / img.height,
        cr = W / H;
      let dw = W,
        dh = H,
        dx = 0,
        dy = 0;
      if (ir > cr) {
        dh = H;
        dw = H * ir;
        dx = (W - dw) / 2;
      } else {
        dw = W;
        dh = W / ir;
        dy = (H - dh) / 2;
      }
      cx.drawImage(img, dx, dy, dw, dh);
      const sc = cx.createLinearGradient(0, 0, 0, H);
      sc.addColorStop(0, "rgba(2,6,23,0.35)");
      sc.addColorStop(1, "rgba(2,6,23,0.82)");
      cx.fillStyle = sc;
      cx.fillRect(0, 0, W, H);
    }
    cx.textBaseline = "top";
    cx.fillStyle = o.accent;
    cx.font = "700 " + Math.round(W * 0.026) + "px 'Geist Mono', monospace";
    cx.fillText(o.kicker.toUpperCase(), pad, Math.round(H * 0.09));
    cx.fillStyle = "#F9FAFB";
    const fs = Math.round(W * (o.h > o.w * 1.5 ? 0.058 : 0.07));
    cx.font = "700 " + fs + "px 'Space Grotesk', 'Geist', sans-serif";
    const words = o.headline.split(" ");
    let line = "",
      y = Math.round(H * 0.09) + Math.round(W * 0.06);
    const maxW = W - pad * 2;
    words.forEach((w) => {
      const test = line ? line + " " + w : w;
      if (cx.measureText(test).width > maxW && line) {
        cx.fillText(line, pad, y);
        line = w;
        y += fs * 1.16;
      } else line = test;
    });
    if (line) cx.fillText(line, pad, y);
    cx.fillStyle = o.accent;
    cx.fillRect(pad, Math.round(H * 0.84), Math.round(W * 0.14), Math.max(3, Math.round(W * 0.006)));
    cx.fillStyle = "rgba(2,6,23,0.9)";
    const fb = Math.round(H * 0.12);
    cx.fillRect(0, H - fb, W, fb);
    cx.fillStyle = "#E5E7EB";
    cx.font = "600 " + Math.round(W * 0.024) + "px 'Geist Mono', monospace";
    cx.textBaseline = "middle";
    cx.fillText("@jess.sells.gilbert", pad, H - fb / 2);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = "farmhand-post-" + o.w + "x" + o.h + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  if (o.bgMode === "gradient") {
    draw(null);
    return;
  }
  const im = new Image();
  im.crossOrigin = "anonymous";
  im.onload = () => draw(im);
  im.onerror = () => draw(null);
  im.src = o.url;
}

function Seg({
  options,
  active,
  onPick,
}: {
  options: { key: string; label: string }[];
  active: string;
  onPick: (k: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const on = active === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "5px 11px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: on ? "rgba(255,93,143,0.18)" : "transparent",
              color: on ? "#FF5D8F" : "#8B89A0",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Composer() {
  const { state, set } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const compCh = state.compChannel;
  const variant = COMP_COPY[compCh];
  const copyText = state.compShort
    ? variant.short
    : state.compRegen
      ? variant.alt
      : variant.long;

  const compSel = state.compImg;
  const uploads = state.uploads;
  const upSel = uploads.find((u) => u.id === compSel);
  const baseImg = COMP_IMGS[compSel] || COMP_IMGS.t1a;
  const selImg: { tier: string; provider?: string } = upSel
    ? { tier: "YOUR UPLOAD", provider: undefined }
    : baseImg;
  const previewUrl = upSel ? upSel.url : IMG(baseImg.seed, 800, 500);

  const CR = COMP_RATIOS[state.compRatio];
  const bgMode = state.compBgMode;
  const accentVal = COMP_ACCENTS[state.compAccent];

  const headline = useMemo(
    () =>
      copyText
        .split(/\n/)[0]
        .replace(/\s+[🌩⛈🔑].*$/u, "")
        .trim(),
    [copyText]
  );
  const kicker =
    (compCh === "ig" ? "INSTAGRAM · " : compCh === "fb" ? "FACEBOOK · " : "NEXTDOOR · ") +
    CR.label;
  const headPx = state.compRatio === "story" ? 22 : state.compRatio === "square" ? 27 : 25;
  const gradBg = `linear-gradient(135deg, #020617 0%, #0B0F1A 55%, ${accentVal}22 120%)`;

  const onUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((f) => {
        const r = new FileReader();
        r.onload = () =>
          set((s2) => ({
            uploads: [
              ...s2.uploads,
              {
                id: "u" + Math.random().toString(36).slice(2),
                url: String(r.result),
                alt: f.name,
              } as Upload,
            ],
          }));
        r.readAsDataURL(f);
      });
      e.target.value = "";
    },
    [set]
  );

  const download = () =>
    exportPNG({
      url: previewUrl,
      bgMode,
      gradBg,
      accent: accentVal,
      kicker,
      headline,
      w: CR.w,
      h: CR.h,
    });

  const tile = (id: string, i: number, upload?: Upload) => {
    const active = compSel === id;
    const url = upload ? upload.url : IMG(COMP_IMGS[id].seed, 200, 200);
    return (
      <button
        key={id}
        onClick={() => set({ compImg: id })}
        title={upload ? upload.alt : COMP_IMGS[id].alt}
        style={{
          position: "relative",
          padding: 0,
          borderRadius: 9,
          overflow: "hidden",
          cursor: "pointer",
          aspectRatio: "1",
          minWidth: 0,
          border: `2px solid ${active ? "#FF5D8F" : upload ? "rgba(65,217,138,0.5)" : "rgba(255,255,255,0.1)"}`,
          background: "#16162A",
          boxShadow: active ? "0 0 14px rgba(255,93,143,0.4)" : "none",
          animation: `fh-pop .4s ease ${(i * 0.06).toFixed(2)}s both`,
        }}
      >
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </button>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 20,
        alignItems: "start",
      }}
    >
      {/* LEFT — editing + preview */}
      <div style={{ minWidth: 0 }}>
        {/* header */}
        <div style={{ marginBottom: 16 }}>
          <div className="fh-kicker">Editing · Monsoon roof-check</div>
          <div
            style={{
              display: "flex",
              gap: 2,
              marginTop: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 9,
              padding: 3,
              width: "fit-content",
            }}
          >
            {CHANNELS.map(([id, label]) => {
              const on = compCh === id;
              return (
                <button
                  key={id}
                  onClick={() => set({ compChannel: id })}
                  style={{
                    border: "none",
                    borderRadius: 7,
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: on ? "rgba(255,93,143,0.16)" : "transparent",
                    color: on ? "#FF5D8F" : "#8B89A0",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* controls bar */}
        <div
          className="fh-glass"
          style={{
            display: "flex",
            gap: 22,
            flexWrap: "wrap",
            alignItems: "center",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 18,
          }}
        >
          <label style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <span className="fh-kicker" style={{ fontSize: 10 }}>
              Ratio
            </span>
            <Seg
              options={Object.keys(COMP_RATIOS).map((k) => ({ key: k, label: COMP_RATIOS[k].label }))}
              active={state.compRatio}
              onPick={(k) => set({ compRatio: k })}
            />
          </label>
          <label style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <span className="fh-kicker" style={{ fontSize: 10 }}>
              Fill
            </span>
            <Seg
              options={[
                { key: "photo", label: "Photo" },
                { key: "gradient", label: "Gradient" },
              ]}
              active={bgMode}
              onPick={(k) => set({ compBgMode: k })}
            />
          </label>
          <label style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <span className="fh-kicker" style={{ fontSize: 10 }}>
              Accent
            </span>
            <span style={{ display: "flex", gap: 7 }}>
              {Object.keys(COMP_ACCENTS).map((k) => {
                const on = state.compAccent === k;
                return (
                  <button
                    key={k}
                    aria-label={k}
                    onClick={() => set({ compAccent: k })}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      border: `2px solid ${on ? "#F4F3F8" : "transparent"}`,
                      background: COMP_ACCENTS[k],
                      cursor: "pointer",
                      padding: 0,
                      boxShadow: on ? `0 0 10px ${COMP_ACCENTS[k]}99` : "none",
                    }}
                  />
                );
              })}
            </span>
          </label>
        </div>

        {/* branded preview */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div
            style={{
              position: "relative",
              width: CR.box,
              aspectRatio: CR.ar,
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 16px 44px rgba(0,0,0,0.45)",
              background: "#0B1120",
              transition: "width .3s ease",
            }}
          >
            <div
              style={
                bgMode === "gradient"
                  ? { position: "absolute", inset: 0, background: gradBg }
                  : {
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `url(${previewUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
              }
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                background:
                  bgMode === "gradient"
                    ? `radial-gradient(120% 90% at 18% 0%, ${accentVal}1A, transparent 55%)`
                    : "linear-gradient(rgba(2,6,23,0.35),rgba(2,6,23,0.82))",
              }}
            />
            <div style={{ position: "absolute", inset: 0, zIndex: 2, padding: "8%" }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  fontFamily: "var(--mono)",
                  color: accentVal,
                }}
              >
                {kicker}
              </div>
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  marginTop: 8,
                  color: "#F9FAFB",
                  fontSize: headPx,
                  lineHeight: 1.15,
                  textShadow: "0 2px 14px rgba(0,0,0,0.6)",
                  display: "-webkit-box",
                  WebkitLineClamp: 5,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {headline}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: "8%",
                bottom: "16%",
                width: 30,
                height: 3,
                borderRadius: 2,
                background: accentVal,
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "12%",
                background: "rgba(2,6,23,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8%",
                zIndex: 2,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: "#E5E7EB", fontFamily: "var(--mono)" }}>
                @jess.sells.gilbert
              </span>
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  fontFamily: "var(--mono)",
                  color: "#0B0B16",
                  background: selImg.provider ? "#FFC23D" : "#41D98A",
                  borderRadius: 5,
                  padding: "3px 7px",
                }}
              >
                {selImg.tier}
              </span>
            </div>
          </div>
        </div>

        {/* caption card */}
        <div className="fh-glass" style={{ borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#A855F7,#38BDF8)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "#0B0B16",
              }}
            >
              J
            </span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{variant.handle}</span>
            <span className="fh-kicker" style={{ fontSize: 10.5 }}>
              {variant.meta}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "#D8D6E6",
              whiteSpace: "pre-line",
            }}
          >
            {copyText}
          </div>
        </div>

        {/* action row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => set({ compRegen: !state.compRegen, compShort: false })}
            style={{
              background: "rgba(168,85,247,0.14)",
              color: "#C9A8FF",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: 9,
              padding: "9px 17px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {state.compRegen ? "Back to original" : "Regenerate"}
          </button>
          <button
            onClick={() => set({ compShort: !state.compShort })}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#A6A4B8",
              borderRadius: 9,
              padding: "9px 17px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {state.compShort ? "Full length" : "Make it shorter"}
          </button>
          <button
            onClick={download}
            style={{
              marginLeft: "auto",
              background: "rgba(255,194,61,0.14)",
              color: "#FFC23D",
              border: "1px solid rgba(255,194,61,0.4)",
              borderRadius: 9,
              padding: "9px 17px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ↓ Download PNG
          </button>
          <MagneticButton
            onClick={download}
            style={{
              background: "linear-gradient(180deg,#7DD3FC,#38BDF8)",
              color: "#04121f",
              border: "none",
              borderRadius: 9,
              padding: "9px 18px",
              fontSize: 12.5,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(56,189,248,0.45)",
            }}
          >
            Approve &amp; schedule
          </MagneticButton>
        </div>
      </div>

      {/* RIGHT — image tier walk */}
      <div style={{ minWidth: 0, position: "sticky", top: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div className="fh-kicker">Image library · tiered</div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onUpload} style={{ display: "none" }} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              marginLeft: "auto",
              background: "rgba(65,217,138,0.12)",
              border: "1px dashed rgba(65,217,138,0.5)",
              color: "#41D98A",
              borderRadius: 8,
              padding: "7px 13px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Upload from device
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {COMP_TIERS.map((t) => {
            const imgs =
              t.num === "1"
                ? [
                    ...uploads.map((u, i) => tile(u.id, i, u)),
                    ...t.ids.map((id, i) => tile(id, i + uploads.length)),
                  ]
                : t.ids.map((id, i) => tile(id, i));
            return (
              <div
                key={t.num}
                className="fh-glass"
                style={{ borderRadius: 14, padding: 14 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: `${t.color}26`,
                      border: `1px solid ${t.color}66`,
                      color: t.color,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {t.num}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{t.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "#8B89A0", lineHeight: 1.5, marginBottom: 10 }}>
                  {t.note}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {imgs}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
