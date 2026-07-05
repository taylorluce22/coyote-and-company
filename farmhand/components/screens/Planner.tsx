"use client";

import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { useStore } from "@/lib/store";
import { MagneticButton } from "@/components/ui";
import PostSlide from "@/components/PostSlide";
import {
  DAYS,
  PILLARS,
  TYPE_LABEL,
  WEEK_PLAN,
  draftPost,
  slotHHMM,
  fmtTime12,
  nextDateISO,
  metricoolCSV,
  downloadText,
  captionText,
  cloudinaryUpload,
  igType,
  type PlannedPost,
} from "@/lib/planner";
import { copyToSlides, downloadDataUrl, pickTextures, slugify, uid, DEFAULT_DESIGN, type Bg, type Slide } from "@/lib/studio";

/* derive renderable slides + look for a planned post (matches Composer rules) */
function postSlidesFor(p: PlannedPost): Slide[] {
  const lines = p.caption.split(/\n\s*\n/);
  const cta = lines[lines.length - 1] || "Save & share";
  if (p.type === "single") return [{ role: "Hook", text: p.topic }];
  return copyToSlides(p.caption, cta);
}
function lookFor(p: PlannedPost): { design: typeof DEFAULT_DESIGN & { ratio: string }; coverBg: Bg; bodyBg: Bg } {
  const picks = pickTextures(p.pillar, p.topic + " " + p.caption, p.id);
  return {
    design: { ...DEFAULT_DESIGN, ratio: p.type === "story" ? "story" : "portrait" },
    coverBg: { type: "texture", tex: picks.cover },
    bodyBg: { type: "texture", tex: picks.body },
  };
}

/* offscreen full-res render of one slide → PNG data URL */
function renderSlidePNG(p: PlannedPost, slide: Slide, index: number, total: number): Promise<string | null> {
  return new Promise((resolve) => {
    const look = lookFor(p);
    const ratio = look.design.ratio === "story" ? { w: 1080, h: 1920 } : { w: 1080, h: 1350 };
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${ratio.w}px;height:${ratio.h}px;z-index:-1;`;
    document.body.appendChild(host);
    const root = createRoot(host);
    const bg = index === 0 ? look.coverBg : look.bodyBg;
    root.render(
      <PostSlide
        slide={slide}
        index={index}
        total={total}
        design={look.design}
        bg={bg}
        accent={PILLARS[p.pillar].color}
        pillar={PILLARS[p.pillar]}
        handle="@jess.sells.gilbert"
      />
    );
    setTimeout(async () => {
      try {
        try {
          await document.fonts.ready;
        } catch {}
        const imgs = Array.from(host.querySelectorAll("img"));
        await Promise.all(
          imgs.map((im) =>
            im.complete && im.naturalWidth ? Promise.resolve() : new Promise<void>((r) => { im.onload = im.onerror = () => r(); })
          )
        );
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const canvas = await html2canvas(host.firstChild as HTMLElement, {
          scale: 2,
          backgroundColor: "#0A0A0A",
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: ratio.w,
          height: ratio.h,
          windowWidth: ratio.w,
          windowHeight: ratio.h,
        });
        const url = canvas.toDataURL("image/png");
        root.unmount();
        host.remove();
        resolve(url);
      } catch {
        root.unmount();
        host.remove();
        resolve(null);
      }
    }, 60);
  });
}

const btn = (bg: string, color: string, border = "none"): React.CSSProperties => ({
  background: bg,
  color,
  border,
  borderRadius: 9,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

export default function Planner() {
  const { state, set } = useStore();
  const posts = state.plannedPosts;
  const dragId = useRef<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [review, setReview] = useState<PlannedPost | null>(null);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAuto, setShowAuto] = useState(false);
  const cfg = state.integrations;

  const unscheduled = posts.filter((p) => !p.plannedDay);
  const byDay = (d: string) => posts.filter((p) => p.plannedDay === d);
  const scheduledCount = posts.filter((p) => p.plannedDay).length;
  const readyCount = posts.filter((p) => p.plannedDay && p.status !== "draft").length;

  const update = (id: string, patch: Partial<PlannedPost>) =>
    set((s) => ({ plannedPosts: s.plannedPosts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const moveTo = (id: string, day: string | null) => update(id, { plannedDay: day });
  const remove = (id: string) => set((s) => ({ plannedPosts: s.plannedPosts.filter((p) => p.id !== id) }));

  /* Plan my week — fills every empty day from the brief (balanced pillar/format rotation) */
  function planWeek() {
    const empty = WEEK_PLAN.filter((w) => byDay(w.day).length === 0);
    if (!empty.length) return;
    setPlanning(true);
    setTimeout(() => {
      const drafts = empty.map((w) => draftPost(w.day, w.pillar, w.type, state.weekBrief, "d" + uid()));
      set((s) => ({ plannedPosts: [...s.plannedPosts, ...drafts] }));
      setPlanning(false);
    }, 450);
  }

  const queue = () => {
    const q: { post: PlannedPost; dayId: string; slotIdx: number }[] = [];
    DAYS.forEach((d) => byDay(d.id).forEach((p, i) => q.push({ post: p, dayId: d.id, slotIdx: i })));
    return q;
  };

  function exportCSV() {
    const q = queue();
    if (!q.length) return;
    downloadText("farmhand-week-metricool.csv", metricoolCSV(q));
  }

  async function downloadWeek() {
    const q = queue();
    if (!q.length) return;
    setBusy("Rendering…");
    const captions: string[] = [];
    let n = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const { post, dayId, slotIdx } = q[qi];
      const slides = postSlidesFor(post);
      const day = DAYS.find((d) => d.id === dayId)!;
      const prefix = String(qi + 1).padStart(2, "0") + "-" + day.short;
      for (let i = 0; i < slides.length; i++) {
        setBusy(`Rendering ${++n}…`);
        const url = await renderSlidePNG(post, slides[i], i, slides.length);
        if (url) {
          downloadDataUrl(url, `${prefix}-${slugify(post.topic)}${slides.length > 1 ? "-" + String(i + 1).padStart(2, "0") : ""}.png`);
          await new Promise((r) => setTimeout(r, 320));
        }
      }
      captions.push(
        "━━━━━━━━━━━━━━━━━━━━",
        `${day.label.toUpperCase()} · ${TYPE_LABEL[post.type]} · ${nextDateISO(dayId)} ${slotHHMM(dayId, slotIdx)}`,
        "",
        captionText(post),
        ""
      );
    }
    downloadText("farmhand-week-captions.txt", captions.join("\n"), "text/plain;charset=utf-8");
    setBusy(null);
  }

  /* Auto-publish: render → Cloudinary → Make webhook (→ Metricool) */
  async function autoPublishWeek() {
    if (!cfg.cloudName || !cfg.uploadPreset || !cfg.makeWebhook) {
      setShowAuto(true);
      return;
    }
    const q = queue();
    if (!q.length) return;
    setBusy("Hosting…");
    try {
      const tz = cfg.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const payload = [];
      let n = 0;
      for (const { post, dayId, slotIdx } of q) {
        const slides = postSlidesFor(post);
        const urls: string[] = [];
        for (let i = 0; i < slides.length; i++) {
          setBusy(`Hosting ${++n}…`);
          const png = await renderSlidePNG(post, slides[i], i, slides.length);
          if (png) urls.push(await cloudinaryUpload(png, cfg));
        }
        payload.push({
          text: captionText(post),
          dateTime: nextDateISO(dayId) + "T" + slotHHMM(dayId, slotIdx) + ":00",
          timezone: tz,
          network: "instagram",
          type: igType(post.type).toLowerCase(),
          autoPublish: cfg.autoPublish !== false,
          media: urls,
          topic: post.topic,
        });
      }
      setBusy("Sending…");
      const res = await fetch(cfg.makeWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "farmhand", count: payload.length, posts: payload }),
      });
      if (!res.ok) throw new Error("Webhook returned " + res.status);
      q.forEach(({ post }) => update(post.id, { status: "scheduled" }));
      setBusy(null);
    } catch (e) {
      setBusy(null);
      alert(e instanceof Error ? e.message : "Publish failed — check your setup");
    }
  }

  const Chip = ({ p }: { p: PlannedPost }) => {
    const pillar = PILLARS[p.pillar];
    return (
      <div
        draggable
        onDragStart={() => (dragId.current = p.id)}
        onClick={() => {
          setReview(p);
          setReviewIdx(0);
        }}
        style={{
          background: `linear-gradient(160deg, ${pillar.color}14, rgba(255,255,255,0.02))`,
          border: `1px solid ${pillar.color}3D`,
          borderLeft: `3px solid ${pillar.color}`,
          borderRadius: 10,
          padding: "9px 11px",
          cursor: "grab",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)", color: pillar.color }}>
            {pillar.short.toUpperCase()}
          </span>
          <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "#6E6C82" }}>{TYPE_LABEL[p.type]}</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 8.5,
              fontWeight: 700,
              fontFamily: "var(--mono)",
              color: p.status === "draft" ? "#8B89A0" : "#41D98A",
            }}
          >
            {p.status === "draft" ? "DRAFT" : p.status.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{p.topic}</div>
      </div>
    );
  };

  return (
    <div>
      {/* header: brief + actions */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <input
          value={state.weekBrief}
          onChange={(e) => set({ weekBrief: e.target.value })}
          placeholder="What are you trying to post about this week? (e.g. monsoon prep + the Willow St closing)"
          style={{
            flex: 1,
            minWidth: 260,
            fontFamily: "var(--body)",
            fontSize: 13,
            color: "#F4F3F8",
            background: "rgba(0,0,0,0.28)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            outline: "none",
          }}
        />
        <MagneticButton
          onClick={planWeek}
          disabled={planning}
          style={{
            ...btn("linear-gradient(180deg,#FFD98A,#FFC23D)", "#1a1205"),
            boxShadow: "0 6px 20px rgba(255,194,61,0.4)",
          }}
        >
          {planning ? "Planning…" : "✨ Plan my week"}
        </MagneticButton>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "#8B89A0" }}>
          {readyCount}/{scheduledCount} approved · drag posts between days
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowAuto(true)} title="Auto-publish setup" style={btn("rgba(255,255,255,0.05)", "#A6A4B8", "1px solid rgba(255,255,255,0.12)")}>
            ⚙
          </button>
          <button onClick={downloadWeek} disabled={!scheduledCount || !!busy} style={btn("rgba(255,194,61,0.12)", "#FFC23D", "1px solid rgba(255,194,61,0.35)")}>
            {busy && busy.startsWith("Rendering") ? busy : "↓ Download week"}
          </button>
          <button onClick={exportCSV} disabled={!scheduledCount} style={btn("rgba(255,255,255,0.05)", "#A6A4B8", "1px solid rgba(255,255,255,0.12)")}>
            Metricool CSV
          </button>
          <MagneticButton
            onClick={autoPublishWeek}
            disabled={!scheduledCount || !!busy}
            style={{ ...btn("linear-gradient(180deg,#C084FC,#9333EA)", "#fff"), boxShadow: "0 6px 20px rgba(147,51,234,0.45)" }}
          >
            {busy && !busy.startsWith("Rendering") ? busy : "⚡ Auto-publish week"}
          </MagneticButton>
        </div>
      </div>

      {/* unscheduled pool */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId.current) moveTo(dragId.current, null);
          dragId.current = null;
        }}
        className="fh-glass"
        style={{ borderRadius: 14, padding: 14, marginBottom: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: unscheduled.length ? 10 : 0 }}>
          <span className="fh-kicker" style={{ fontSize: 10 }}>
            Unscheduled · drag onto a day
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#6E6C82" }}>
            {scheduledCount} scheduled · {unscheduled.length} waiting
          </span>
        </div>
        {unscheduled.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6E6C82" }}>
            Everything&apos;s scheduled. Hit ✨ Plan my week to fill empty days, or drag a card here to unschedule it.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
            {unscheduled.map((p) => (
              <Chip key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* 7-day grid with best-time slots */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", gap: 10, overflowX: "auto" }}>
        {DAYS.map((d, di) => {
          const items = byDay(d.id);
          const over = dragOverDay === d.id;
          return (
            <div
              key={d.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDay(d.id);
              }}
              onDragLeave={() => setDragOverDay((v) => (v === d.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId.current) moveTo(dragId.current, d.id);
                dragId.current = null;
                setDragOverDay(null);
              }}
              style={{
                minWidth: 0,
                background: over ? "rgba(255,194,61,0.07)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${over ? "rgba(255,194,61,0.45)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14,
                padding: "12px 10px",
                minHeight: 280,
                transition: "background .2s ease, border-color .2s ease",
                animation: `fh-rise .45s ease ${(di * 0.05).toFixed(2)}s both`,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--label)", letterSpacing: "0.08em", color: "#8D89C0" }}>
                  {d.short.toUpperCase()}
                </span>
                <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: "#6E6C82" }}>{nextDateISO(d.id).slice(5)}</span>
              </div>
              <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "#77758C", marginBottom: 10 }}>
                best: {d.slots.map(fmtTime12).join(" · ")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((p, i) => (
                  <div key={p.id}>
                    <div style={{ fontSize: 8.5, fontFamily: "var(--mono)", color: "#FFC23D", marginBottom: 3 }}>
                      {fmtTime12(slotHHMM(d.id, i))}
                    </div>
                    <Chip p={p} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* review modal */}
      {review && (() => {
        const p = posts.find((x) => x.id === review.id) || review;
        const slides = postSlidesFor(p);
        const cur = Math.min(reviewIdx, slides.length - 1);
        const look = lookFor(p);
        const ratio = look.design.ratio === "story" ? { w: 1080, h: 1920 } : { w: 1080, h: 1350 };
        const scale = 280 / ratio.w;
        return (
          <div
            onClick={() => setReview(null)}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,4,10,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="fh-glass"
              style={{ borderRadius: 18, padding: 22, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", color: PILLARS[p.pillar].color }}>
                  {PILLARS[p.pillar].short.toUpperCase()} · {TYPE_LABEL[p.type]}
                </span>
                <button onClick={() => setReview(null)} style={{ marginLeft: "auto", ...btn("none", "#A6A4B8", "1px solid rgba(255,255,255,0.14)") }}>
                  ✕
                </button>
              </div>
              <div className="fh-title" style={{ fontSize: 18, marginBottom: 14 }}>{p.topic}</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ width: ratio.w * scale, height: ratio.h * scale, position: "relative", borderRadius: 10, overflow: "hidden", boxShadow: "0 14px 44px rgba(0,0,0,0.55)", outline: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                      <PostSlide
                        slide={slides[cur]}
                        index={cur}
                        total={slides.length}
                        design={look.design}
                        bg={cur === 0 ? look.coverBg : look.bodyBg}
                        accent={PILLARS[p.pillar].color}
                        pillar={PILLARS[p.pillar]}
                        handle="@jess.sells.gilbert"
                      />
                    </div>
                  </div>
                  {slides.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
                      <button onClick={() => setReviewIdx((i) => Math.max(0, i - 1))} disabled={cur === 0} style={btn("rgba(255,255,255,0.05)", "#A6A4B8", "1px solid rgba(255,255,255,0.12)")}>‹</button>
                      <span style={{ fontSize: 11, color: "#6E6C82", alignSelf: "center" }}>{cur + 1} / {slides.length}</span>
                      <button onClick={() => setReviewIdx((i) => Math.min(slides.length - 1, i + 1))} disabled={cur === slides.length - 1} style={btn("rgba(255,255,255,0.05)", "#A6A4B8", "1px solid rgba(255,255,255,0.12)")}>›</button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#D8D6E6", whiteSpace: "pre-line", background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "12px 14px" }}>
                    {captionText(p)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button
                      onClick={() => update(p.id, { status: p.status === "draft" ? "ready" : "draft" })}
                      style={btn(p.status === "draft" ? "#41D98A" : "rgba(65,217,138,0.14)", p.status === "draft" ? "#0B0B16" : "#41D98A", p.status === "draft" ? "none" : "1px solid rgba(65,217,138,0.4)")}
                    >
                      {p.status === "draft" ? "✓ Approve" : "Approved ✓"}
                    </button>
                    <button
                      onClick={() => { remove(p.id); setReview(null); }}
                      style={{ marginLeft: "auto", ...btn("none", "#FF5D8F", "1px solid rgba(255,93,143,0.35)") }}
                    >
                      Delete
                    </button>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#6E6C82", marginTop: 12, lineHeight: 1.5 }}>
                    Fine-tune the look in the Composer — the planner uses the same rendering rules for export and auto-publish.
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* auto-publish setup modal */}
      {showAuto && (
        <div
          onClick={() => setShowAuto(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,4,10,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="fh-glass" style={{ borderRadius: 18, padding: 24, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto" }}>
            <div className="fh-title" style={{ fontSize: 18, marginBottom: 8 }}>⚡ Auto-publish setup</div>
            <div style={{ fontSize: 12.5, color: "#A6A4B8", lineHeight: 1.55, marginBottom: 18 }}>
              Connect once and the planner renders your week, hosts the images on Cloudinary (free), and fires them to Metricool through a Make webhook — fully automated. Your Metricool token stays inside Make, never here.
            </div>
            {(
              [
                ["cloudName", "Cloudinary cloud name", "Cloudinary dashboard → top of the page. Free account at cloudinary.com."],
                ["uploadPreset", "Unsigned upload preset", "Cloudinary → Settings → Upload → add an unsigned preset, paste its name."],
                ["makeWebhook", "Make webhook URL", "Make: new scenario → Webhooks → Custom webhook → copy the address. It receives your week and calls Metricool."],
                ["timezone", "Timezone (IANA)", "e.g. America/Phoenix — used for the scheduled publish time."],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} style={{ marginBottom: 13 }}>
                <label style={{ display: "block", fontSize: 10, fontFamily: "var(--label)", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8D89C0", marginBottom: 5 }}>
                  {label}
                </label>
                <input
                  value={cfg[key]}
                  onChange={(e) => set((s) => ({ integrations: { ...s.integrations, [key]: e.target.value } }))}
                  style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "#F4F3F8", background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "9px 12px", outline: "none" }}
                />
                <div style={{ fontSize: 10.5, color: "#6E6C82", marginTop: 4, lineHeight: 1.45 }}>{hint}</div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0 14px" }}>
              <span style={{ flex: 1, fontSize: 13, color: "#D8D6E6" }}>Auto-publish at scheduled time</span>
              <button
                role="switch"
                aria-checked={cfg.autoPublish}
                onClick={() => set((s) => ({ integrations: { ...s.integrations, autoPublish: !s.integrations.autoPublish } }))}
                style={{ position: "relative", width: 40, height: 22, borderRadius: 99, border: "none", cursor: "pointer", background: cfg.autoPublish ? "#FFC23D" : "rgba(255,255,255,0.14)", transition: "background .25s ease" }}
              >
                <span style={{ position: "absolute", top: 2, left: cfg.autoPublish ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#F4F3F8", transition: "left .25s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: "#6E6C82", marginBottom: 16 }}>Off = posts land in Metricool as drafts for you to approve.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 11, color: cfg.cloudName && cfg.uploadPreset && cfg.makeWebhook ? "#41D98A" : "#6E6C82", flex: 1, alignSelf: "center" }}>
                {cfg.cloudName && cfg.uploadPreset && cfg.makeWebhook ? "● Ready to auto-publish" : "Fill the first three to enable"}
              </span>
              <button onClick={() => setShowAuto(false)} style={btn("linear-gradient(180deg,#FFD98A,#FFC23D)", "#1a1205")}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
