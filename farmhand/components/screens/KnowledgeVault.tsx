"use client";

import { useEffect, useRef, useState } from "react";
import {
  GRAPH_GROUPS, GRAPH_NODES, GRAPH_LINKS, GRAPH_TAGS, type NodeGroup,
} from "@/lib/agentOs";

interface GNode { id: string; g: NodeGroup; x: number; y: number; vx: number; vy: number; fx: number | null; fy: number | null; deg: number; r: number; }

/**
 * Knowledge Vault — colored memory/database topology. Force-directed
 * graph of agents, vault docs, KB sources, and the content posts they
 * produce, wired by every link between them. Canvas + a lightweight
 * velocity-Verlet force sim; no external libraries.
 */
export default function KnowledgeVault() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<{ id: string; g: NodeGroup; deg: number; out: string[]; inn: string[] } | null>(null);
  const offRef = useRef(off);
  offRef.current = off;

  // model built once
  const model = useRef<{
    nodes: GNode[]; idx: Record<string, number>; links: { s: number; t: number }[];
    adj: Record<string, { out: string[]; in: string[] }>; nb: Record<number, Record<number, boolean>>;
  } | null>(null);

  if (!model.current) {
    const idx: Record<string, number> = {};
    const nodes: GNode[] = GRAPH_NODES.map((n, i) => {
      idx[n[0]] = i;
      const a = (i / GRAPH_NODES.length) * Math.PI * 2;
      return { id: n[0], g: n[1], x: Math.cos(a) * (160 + (i % 3) * 40), y: Math.sin(a) * (160 + (i % 3) * 40), vx: 0, vy: 0, fx: null, fy: null, deg: 0, r: 6 };
    });
    const adj: Record<string, { out: string[]; in: string[] }> = {};
    nodes.forEach((n) => { adj[n.id] = { out: [], in: [] }; });
    const seen: Record<string, boolean> = {};
    const links: { s: number; t: number }[] = [];
    GRAPH_LINKS.forEach(([a, b]) => {
      if (idx[a] == null || idx[b] == null) return;
      adj[a].out.push(b); adj[b].in.push(a);
      const k = a < b ? a + "|" + b : b + "|" + a;
      if (!seen[k]) { seen[k] = true; links.push({ s: idx[a], t: idx[b] }); }
    });
    const nb: Record<number, Record<number, boolean>> = {};
    nodes.forEach((n, i) => {
      const s: Record<number, boolean> = {};
      adj[n.id].out.forEach((x) => (s[idx[x]] = true));
      adj[n.id].in.forEach((x) => (s[idx[x]] = true));
      nb[i] = s; n.deg = Object.keys(s).length; n.r = 5 + Math.sqrt(n.deg) * 3.1;
    });
    model.current = { nodes, idx, links, adj, nb };
  }

  useEffect(() => {
    const M = model.current!;
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    const view = { x: 0, y: 0, k: 1 };
    let hoverI = -1, alpha = 0.14, raf = 0, dragI = -1, pan = false;
    const last = { x: 0, y: 0 };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const r = wrap.getBoundingClientRect(); W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

    const step = (al: number) => {
      const N = M.nodes;
      for (let i = 0; i < N.length; i++) { const a = N[i];
        for (let j = i + 1; j < N.length; j++) { const b = N[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2), f = 3800 / d2, ux = dx / d, uy = dy / d;
          a.vx += ux * f * al; a.vy += uy * f * al; b.vx -= ux * f * al; b.vy -= uy * f * al;
        }
      }
      M.links.forEach((l) => { const a = N[l.s], b = N[l.t];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01, f = (d - 132) * 0.036 * al, ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
      });
      N.forEach((n) => {
        n.vx += -n.x * 0.006 * al; n.vy += -n.y * 0.006 * al;
        if (n.fx != null) { n.x = n.fx; n.y = n.fy!; n.vx = 0; n.vy = 0; return; }
        n.vx *= 0.86; n.vy *= 0.86; n.x += n.vx; n.y += n.vy;
      });
    };
    for (let w = 0; w < 420; w++) step(1);

    const vis = (n: GNode) => !offRef.current[n.g];
    const draw = () => {
      ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(W / 2 + view.x, H / 2 + view.y); ctx.scale(view.k, view.k);
      const focus = hoverI, nbSet = focus >= 0 ? M.nb[focus] : null;
      M.links.forEach((l) => { const a = M.nodes[l.s], b = M.nodes[l.t]; if (!vis(a) || !vis(b)) return;
        const on = focus < 0 || l.s === focus || l.t === focus;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = on ? "rgba(122,162,255,0.4)" : "rgba(150,160,190,0.06)"; ctx.lineWidth = on ? 1.3 : 0.6; ctx.stroke();
      });
      M.nodes.forEach((n, i) => { if (!vis(n)) return; const col = GRAPH_GROUPS[n.g].color;
        const dim = focus >= 0 && i !== focus && !(nbSet && nbSet[i]);
        ctx.globalAlpha = dim ? 0.2 : 1; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.2832);
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = i === focus ? 22 : dim ? 0 : 9; ctx.fill(); ctx.shadowBlur = 0;
        if (i === focus) { ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); }
        const lab = !dim && (n.deg >= 6 || i === focus || (nbSet && nbSet[i]) || view.k > 1.2);
        if (lab) { ctx.globalAlpha = 1; ctx.font = (i === focus ? "600 " : "") + "10.5px system-ui,sans-serif"; ctx.textAlign = "center";
          ctx.fillStyle = i === focus ? "#fff" : "#c3c9d6"; ctx.fillText(n.id, n.x, n.y + n.r + 11); }
      });
      ctx.globalAlpha = 1; ctx.restore();
    };
    const loop = () => { if (alpha > 0.008) { step(alpha); alpha *= 0.992; } draw(); raf = requestAnimationFrame(loop); };
    if (reduce) { alpha = 0.02; }
    loop();

    const toW = (px: number, py: number) => ({ x: (px - W / 2 - view.x) / view.k, y: (py - H / 2 - view.y) / view.k });
    const pick = (px: number, py: number) => { const w = toW(px, py); let best = -1, bd = 1e9;
      for (let i = 0; i < M.nodes.length; i++) { const n = M.nodes[i]; if (offRef.current[n.g]) continue;
        const dx = n.x - w.x, dy = n.y - w.y, d = Math.sqrt(dx * dx + dy * dy); if (d < n.r + 6 && d < bd) { bd = d; best = i; } } return best; };
    const showDetail = (i: number) => { const n = M.nodes[i];
      setDetail({ id: n.id, g: n.g, deg: n.deg, out: M.adj[n.id].out.slice().sort(), inn: M.adj[n.id].in.slice().sort() }); };
    const pos = (e: MouseEvent | Touch) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    const down = (p: { x: number; y: number }) => { const i = pick(p.x, p.y);
      if (i >= 0) { dragI = i; M.nodes[i].fx = M.nodes[i].x; M.nodes[i].fy = M.nodes[i].y; alpha = Math.max(alpha, 0.12); hoverI = i; showDetail(i); }
      else { pan = true; last.x = p.x; last.y = p.y; } };
    const move = (p: { x: number; y: number }) => {
      if (dragI >= 0) { const w = toW(p.x, p.y); M.nodes[dragI].fx = w.x; M.nodes[dragI].fy = w.y; alpha = Math.max(alpha, 0.1); }
      else if (pan) { view.x += p.x - last.x; view.y += p.y - last.y; last.x = p.x; last.y = p.y; }
      else { const i = pick(p.x, p.y); if (i !== hoverI) { hoverI = i; if (i >= 0) showDetail(i); } canvas.style.cursor = i >= 0 ? "pointer" : "grab"; } };
    const up = () => { if (dragI >= 0) { M.nodes[dragI].fx = null; M.nodes[dragI].fy = null; } dragI = -1; pan = false; };

    const md = (e: MouseEvent) => down(pos(e));
    const mm = (e: MouseEvent) => move(pos(e));
    const ts = (e: TouchEvent) => { down(pos(e.touches[0])); e.preventDefault(); };
    const tm = (e: TouchEvent) => { move(pos(e.touches[0])); e.preventDefault(); };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.12 : 0.89; const p = pos(e);
      const wx = (p.x - W / 2 - view.x) / view.k, wy = (p.y - H / 2 - view.y) / view.k;
      view.k = Math.max(0.4, Math.min(3, view.k * f)); view.x = p.x - W / 2 - wx * view.k; view.y = p.y - H / 2 - wy * view.k; };

    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", ts, { passive: false });
    canvas.addEventListener("touchmove", tm, { passive: false });
    canvas.addEventListener("touchend", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("mousedown", md); canvas.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", up);
      canvas.removeEventListener("touchstart", ts); canvas.removeEventListener("touchmove", tm); canvas.removeEventListener("touchend", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, []);

  const groupKeys = Object.keys(GRAPH_GROUPS) as NodeGroup[];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span className="fh-kicker" style={{ fontSize: 10 }}>Knowledge Vault</span>
        <span
          style={{
            marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "#7BE495",
            background: "rgba(123,228,149,0.1)", border: "1px solid rgba(123,228,149,0.3)", borderRadius: 999, padding: "5px 12px",
          }}
        >
          {GRAPH_NODES.length} nodes · {model.current!.links.length} edges
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 16 }}>
        Colored memory / database topology — agents, vault docs, knowledge-base sources, and the content posts they
        produce, wired by every link between them.
      </p>

      <div
        ref={wrapRef}
        style={{
          position: "relative", height: "calc(100vh - 240px)", minHeight: 420, borderRadius: 18, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "radial-gradient(70% 60% at 50% 40%, #0c1220, #06060d)",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }} />

        {/* legend */}
        <div
          style={{
            position: "absolute", left: 14, bottom: 14, background: "rgba(11,11,22,0.82)",
            border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "10px 12px",
            backdropFilter: "blur(8px)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px",
          }}
        >
          {groupKeys.map((g) => (
            <div
              key={g}
              onClick={() => setOff((o) => ({ ...o, [g]: !o[g] }))}
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, cursor: "pointer", opacity: off[g] ? 0.32 : 1 }}
            >
              <i style={{ width: 9, height: 9, borderRadius: "50%", flex: "none", background: GRAPH_GROUPS[g].color, boxShadow: `0 0 7px ${GRAPH_GROUPS[g].color}` }} />
              {GRAPH_GROUPS[g].label}
            </div>
          ))}
        </div>

        {/* detail */}
        <div
          style={{
            position: "absolute", right: 14, top: 14, width: 262, maxWidth: "calc(100% - 28px)",
            background: "rgba(11,11,22,0.92)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14,
            padding: 16, backdropFilter: "blur(10px)",
          }}
        >
          {!detail ? (
            <div style={{ fontSize: 12, color: "#A6A4B8", lineHeight: 1.55 }}>
              Hover a node to trace its links. Drag to rearrange. Click a connection to jump.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 750, display: "flex", alignItems: "center", gap: 9 }}>
                <i style={{ width: 11, height: 11, borderRadius: "50%", flex: "none", background: GRAPH_GROUPS[detail.g].color, boxShadow: `0 0 9px ${GRAPH_GROUPS[detail.g].color}` }} />
                {detail.id}
              </div>
              <div className="fh-kicker" style={{ fontSize: 9.5, margin: "5px 0 11px" }}>{GRAPH_GROUPS[detail.g].label} · {detail.deg} connections</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 11 }}>
                {GRAPH_TAGS[detail.g].map((t) => (
                  <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.06em", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.28)", borderRadius: 6, padding: "3px 6px", textTransform: "uppercase" }}>{t}</span>
                ))}
              </div>
              <DetailList label={`Links to (${detail.out.length})`} items={detail.out} onPick={(id) => { const M = model.current!; setDetail({ id, g: M.nodes[M.idx[id]].g, deg: M.nodes[M.idx[id]].deg, out: M.adj[id].out.slice().sort(), inn: M.adj[id].in.slice().sort() }); }} />
              <DetailList label={`Linked from (${detail.inn.length})`} items={detail.inn} onPick={(id) => { const M = model.current!; setDetail({ id, g: M.nodes[M.idx[id]].g, deg: M.nodes[M.idx[id]].deg, out: M.adj[id].out.slice().sort(), inn: M.adj[id].in.slice().sort() }); }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailList({ label, items, onPick }: { label: string; items: string[]; onPick: (id: string) => void }) {
  return (
    <div>
      <div className="fh-kicker" style={{ fontSize: 9, margin: "10px 0 6px", color: "#6E6C82" }}>{label}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: "#6E6C82" }}>none</div>
      ) : (
        items.map((x) => {
          const g = GRAPH_GROUPS[(GRAPH_NODES.find((n) => n[0] === x)?.[1] || "system") as NodeGroup];
          return (
            <div key={x} onClick={() => onPick(x)} style={{ fontSize: 12, color: "#D8D6E6", display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "1px 0" }}>
              <i style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: g.color }} />
              {x}
            </div>
          );
        })
      )}
    </div>
  );
}
