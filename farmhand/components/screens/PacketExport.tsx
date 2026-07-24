"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { buildPacketHTML } from "@/lib/packet";
import { vaultAll } from "@/lib/vault";
import type { PlannedPost } from "@/lib/planner";
import type { Opportunity } from "@/lib/engage";
import type { StrategyProfile } from "@/lib/strategy";

/**
 * Monday Packet (E2-3) — one click turns the active client's week into a
 * branded, client-facing document (open in a tab → print to PDF, or download
 * the HTML). The deliverable the founder sends every Monday.
 */
export default function PacketExport() {
  const { state, workspace, clients } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const strategy = state.strategy as StrategyProfile;
  const posts = (state.plannedPosts as PlannedPost[]) || [];
  const opps = (state.opportunities as Opportunity[]) || [];
  const clientLabel = clients.find((c) => c.id === workspace)?.label || strategy?.name || "Client";

  async function build(): Promise<string> {
    const images = await vaultAll(); // active client's vault only
    return buildPacketHTML({ clientLabel, strategy, posts, opportunities: opps, images, weekOf: Date.now() });
  }

  async function openPacket() {
    setBusy(true); setMsg("Building the packet…");
    try {
      const html = await build();
      const w = window.open("", "_blank");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); setMsg("✓ Opened in a new tab — use your browser's Print → Save as PDF to send it."); }
      else { setMsg("Popup blocked — use Download instead."); }
    } catch { setMsg("Couldn't build the packet."); }
    setBusy(false);
  }

  async function downloadPacket() {
    setBusy(true); setMsg("Building the packet…");
    try {
      const html = await build();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workspace}-weekly-packet-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg("✓ Downloaded. Open it and Print → Save as PDF, or send the file as-is.");
    } catch { setMsg("Couldn't build the packet."); }
    setBusy(false);
  }

  const scheduled = posts.filter((p) => p.plannedDay).length;
  const freshLeads = opps.filter((o) => o.status === "new").length;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.55, maxWidth: "72ch", marginTop: 0, marginBottom: 20 }}>
        The Monday packet is what you send <b>{clientLabel}</b> every week — a clean, branded document with this week&apos;s posts,
        the live conversations worth joining, and the single best next move. It pulls only this client&apos;s data. Open it and
        Print → Save as PDF, or download the file.
      </p>

      <div className="fh-glass" style={{ borderRadius: 16, padding: 22, maxWidth: 560 }}>
        <div className="fh-kicker" style={{ marginBottom: 14 }}>What&apos;s in this week&apos;s packet</div>
        <div style={{ display: "flex", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
          <Stat n={scheduled} label="scheduled posts" />
          <Stat n={posts.length} label="posts total" />
          <Stat n={freshLeads} label="fresh conversations" />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={openPacket} disabled={busy}
            style={{ cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 700, color: "#0B0A12", background: busy ? "#6E6C82" : "#E8622C", border: "none", borderRadius: 10, padding: "11px 18px" }}>
            {busy ? "Building…" : "Open packet (Print → PDF)"}
          </button>
          <button onClick={downloadPacket} disabled={busy}
            style={{ cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 650, color: "#F4F3F8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "11px 18px" }}>
            Download HTML
          </button>
        </div>
        {msg && <div style={{ fontSize: 11.5, color: "#8B89A0", marginTop: 14, lineHeight: 1.5 }}>{msg}</div>}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#F4F3F8", lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 4 }}>{label}</div>
    </div>
  );
}
