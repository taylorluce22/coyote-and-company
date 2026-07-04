"use client";

import { useStore } from "@/lib/store";
import { CAL, WEEK_DAYS, TODAY, type CalPost } from "@/lib/data";

export default function Calendar() {
  const { state, set, dragId } = useStore();
  const week = state.calView === "week";

  const isJune = (c: CalPost) => c.id === "c1" || c.id === "c2" || c.id === "c3";
  const bucketOf = (c: CalPost) =>
    state.moved[c.id] || (isJune(c) ? "jun" + c.day : "jul" + c.day);
  const title = (c: CalPost) => (state.regens[c.id] ? c.alt : c.title);

  const volCount = CAL.filter((c) => c.layer === "volume").length;
  const mixPct = Math.round((volCount / CAL.length) * 100);

  const drop = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragId.current) set({ moved: { ...state.moved, [dragId.current]: key } });
    dragId.current = null;
  };
  const allow = (e: React.DragEvent) => e.preventDefault();

  const Chip = ({ c }: { c: CalPost }) => {
    const auto = c.eng === "auto";
    const col = auto ? "#A855F7" : "#38BDF8";
    return (
      <div
        draggable
        onDragStart={() => (dragId.current = c.id)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          minWidth: 0,
          overflow: "hidden",
          background: `linear-gradient(160deg,${col}1F,${col}08)`,
          border: `1px solid ${col}4D`,
          borderLeft: `3px solid ${col}`,
          borderRadius: 10,
          padding: "9px 11px",
          cursor: "grab",
          boxShadow: `0 6px 16px rgba(0,0,0,0.3), 0 0 14px ${col}12`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: "var(--mono)", color: auto ? "#C9A8FF" : "#7DD3FC" }}>{c.tag}</span>
          <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: "#6E6C82" }}>{c.time}</span>
          {c.layer === "personal" && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#FF9A62" }} />}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{title(c)}</div>
        <button
          onClick={() => set({ regens: { ...state.regens, [c.id]: !state.regens[c.id] } })}
          style={{ marginTop: 6, fontSize: 10, color: "#8B89A0", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {state.regens[c.id] ? "↺ Undo" : "↻ Regenerate"}
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: 3 }}>
          {(["week", "month"] as const).map((v) => {
            const on = state.calView === v;
            return (
              <button
                key={v}
                onClick={() => set({ calView: v })}
                style={{
                  border: "none",
                  borderRadius: 7,
                  padding: "7px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  background: on ? "rgba(255,194,61,0.16)" : "transparent",
                  color: on ? "#FFC23D" : "#8B89A0",
                }}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="fh-title" style={{ fontSize: 15 }}>{week ? "Jun 29 – Jul 5" : "July 2026"}</div>
        <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#6E6C82" }}>drag any post to reschedule</div>

        {/* mix meter */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 160 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontFamily: "var(--mono)", color: "#8B89A0", marginBottom: 4 }}>
              <span>VOLUME {mixPct}%</span>
              <span>PERSONAL {100 - mixPct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", display: "flex" }}>
              <span style={{ width: `${mixPct}%`, background: "linear-gradient(90deg,#8B89A0,#C9A8FF)" }} />
              <span style={{ width: `${100 - mixPct}%`, background: "linear-gradient(90deg,#FF9A62,#FF7A2F)" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 10.5, color: "#A6A4B8" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: "#A855F7" }} />Auto</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: "#38BDF8" }} />Play</span>
          </div>
        </div>
      </div>

      {week ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(128px, 1fr))", gap: 10, overflowX: "auto" }}>
          {WEEK_DAYS.map((d, wi) => {
            const isToday = d.key === "jul" + TODAY;
            const posts = CAL.filter((c) => bucketOf(c) === d.key);
            return (
              <div
                key={d.key}
                onDragOver={allow}
                onDrop={drop(d.key)}
                style={{
                  minWidth: 0,
                  background: isToday ? "rgba(255,194,61,0.05)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isToday ? "rgba(255,194,61,0.35)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14,
                  padding: "12px 10px",
                  minHeight: 300,
                  boxShadow: isToday ? "0 0 34px rgba(255,194,61,0.1)" : "none",
                  animation: `fh-rise .45s ease ${(wi * 0.06).toFixed(2)}s both`,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--label)", letterSpacing: "0.08em", color: isToday ? "#FFC23D" : "#6E6C82" }}>{d.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: d.june ? "#6E6C82" : "#F4F3F8" }}>{d.num}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {posts.map((c) => <Chip key={c.id} c={c} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--label)", letterSpacing: "0.08em", color: "#6E6C82", textAlign: "center", paddingBottom: 4 }}>{d}</div>
          ))}
          {[0, 1].map((b) => (
            <div key={"b" + b} style={{ border: "1px dashed rgba(255,255,255,0.05)", borderRadius: 12, minHeight: 86 }} />
          ))}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((dnum) => {
            const isToday = dnum === TODAY;
            const posts = CAL.filter((c) => bucketOf(c) === "jul" + dnum);
            return (
              <div
                key={dnum}
                onDragOver={allow}
                onDrop={drop("jul" + dnum)}
                style={{
                  minWidth: 0,
                  background: isToday ? "rgba(255,194,61,0.05)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isToday ? "rgba(255,194,61,0.35)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12,
                  padding: "10px 11px",
                  minHeight: 86,
                  animation: `fh-pop .4s ease ${(dnum * 0.012).toFixed(3)}s both`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--display)", color: isToday ? "#FFC23D" : "#A6A4B8", marginBottom: 6 }}>{dnum}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {posts.map((c) => {
                    const col = c.eng === "auto" ? "#A855F7" : "#38BDF8";
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => (dragId.current = c.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: "#E8E6F2",
                          background: `${col}1C`,
                          borderLeft: `2px solid ${col}`,
                          borderRadius: 5,
                          padding: "3px 7px",
                          minWidth: 0,
                          cursor: "grab",
                        }}
                      >
                        {c.layer === "personal" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF9A62", flexShrink: 0 }} />}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title(c)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
