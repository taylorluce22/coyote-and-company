"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useStore } from "@/lib/store";
import { reelVaultAdd, reelVaultAll, reelVaultDelete, type ReelAnalysis, type VaultReel } from "@/lib/reelVault";

const SOURCE_LABEL: Record<VaultReel["source"], string> = { own: "My content", reference: "Reference / competitor" };
const SOURCE_COLOR: Record<VaultReel["source"], string> = { own: "#26E0C8", reference: "#C9A8FF" };

function noteFor(reel: VaultReel): string {
  const a = reel.analysis || {};
  const lines = [
    `**${reel.label}** (${SOURCE_LABEL[reel.source]}, reviewed ${new Date(reel.createdAt).toISOString().slice(0, 10)})`,
    a.summary ? `${a.summary}` : "",
    a.hook ? `- Hook: ${a.hook.technique || "?"} — ${a.hook.strength || "?"} (${a.hook.why || ""})` : "",
    a.structure ? `- Structure: ${a.structure.pacing || "?"}${a.structure.onScreenText && a.structure.onScreenText !== "none" ? `, on-screen text: ${a.structure.onScreenText}` : ""}` : "",
    a.visualStyle ? `- Visual style: ${a.visualStyle.setting || "?"}, ${a.visualStyle.lighting || "?"}, ${a.visualStyle.framing || "?"}` : "",
    a.audio?.spokenContent && a.audio.spokenContent !== "no speech" ? `- Audio: "${a.audio.spokenContent}"` : "",
    a.contentPattern ? `- Pattern: ${a.contentPattern}` : "",
    a.coachingNotes?.length ? `- Coaching notes:\n${a.coachingNotes.map((n) => `  - ${n}`).join("\n")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function AnalysisCard({ analysis }: { analysis: ReelAnalysis }) {
  const row = (label: string, value?: string | number | boolean) =>
    value === undefined || value === "" ? null : (
      <div style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ color: "#6E6C82", flexShrink: 0, minWidth: 92 }}>{label}</span>
        <span style={{ color: "#D9D7E4" }}>{String(value)}</span>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {analysis.summary && <div style={{ fontSize: 13, color: "#F4F3F8", lineHeight: 1.55 }}>{analysis.summary}</div>}

      <div>
        <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#FF9A62" }}>Hook</div>
        {row("First 1-2s", analysis.hook?.firstTwoSeconds)}
        {row("Technique", analysis.hook?.technique)}
        {row("Strength", analysis.hook?.strength)}
        {row("Why", analysis.hook?.why)}
      </div>

      <div>
        <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#7DD3FC" }}>Structure & pacing</div>
        {row("Cuts (est.)", analysis.structure?.estimatedCuts)}
        {row("Pacing", analysis.structure?.pacing)}
        {row("On-screen text", analysis.structure?.onScreenText)}
        {row("CTA", analysis.structure?.ctaPresent ? analysis.structure?.ctaNotes : "none")}
      </div>

      <div>
        <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#C9A8FF" }}>Visual style</div>
        {row("Setting", analysis.visualStyle?.setting)}
        {row("Lighting", analysis.visualStyle?.lighting)}
        {row("Framing", analysis.visualStyle?.framing)}
        {row("Wardrobe", analysis.visualStyle?.wardrobe)}
        {row("Branding", analysis.visualStyle?.brandingVisible)}
      </div>

      <div>
        <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#FFC23D" }}>Audio</div>
        {row("Said", analysis.audio?.spokenContent)}
        {row("Tone", analysis.audio?.tone)}
        {row("Music", analysis.audio?.music)}
      </div>

      {analysis.contentPattern && (
        <div>
          <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#26E0C8" }}>Reusable pattern</div>
          <div style={{ fontSize: 12.5, color: "#D9D7E4", lineHeight: 1.55 }}>{analysis.contentPattern}</div>
        </div>
      )}

      {!!analysis.coachingNotes?.length && (
        <div>
          <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#FF5D8F" }}>Coaching notes</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {analysis.coachingNotes.map((n, i) => (
              <li key={i} style={{ fontSize: 12.5, color: "#D9D7E4", lineHeight: 1.5 }}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ReelCoach() {
  const { copy } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<VaultReel["source"]>("own");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<VaultReel[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    reelVaultAll().then(setList);
  }, []);

  const analyze = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setStage("Uploading clip…");
    try {
      const blob = await upload(`reels/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`, file, {
        access: "public",
        handleUploadUrl: "/api/video-reference/blob-upload",
        contentType: file.type || "video/mp4",
      });

      setStage("Gemini is watching the clip — this can take a minute…");
      const r = await fetch("/api/video-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, contentType: file.type, label: label.trim(), source }),
        signal: AbortSignal.timeout(290000),
      });
      const j = await r.json();
      if (!j.configured) {
        setError("Needs GEMINI_API_KEY set in Vercel — ask Taylor to add it, then try again.");
        return;
      }
      if (j.error) {
        setError(j.error);
        return;
      }
      const reel: VaultReel = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: label.trim() || file.name,
        source,
        analysis: j.analysis,
        createdAt: Date.now(),
      };
      await reelVaultAdd(reel);
      setList(await reelVaultAll());
      setExpanded(reel.id);
      setFile(null);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const remove = async (id: string) => {
    await reelVaultDelete(id);
    setList(await reelVaultAll());
    if (expanded === id) setExpanded(null);
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: "#A6A4B8", marginBottom: 16, lineHeight: 1.5, maxWidth: 640 }}>
        Upload a real reel — yours or a reference from a page you admire — and Gemini watches the whole
        thing (video + audio together, not just stills) and hands back a coaching breakdown: hook
        strength, pacing, visual style, what&apos;s said, and the reusable pattern. Saved analyses feed the
        content agents in the brain vault.
      </div>

      <div className="fh-glass" style={{ borderRadius: 14, padding: "16px 17px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={busy}
            style={{ fontSize: 12, color: "#A6A4B8", maxWidth: 240 }}
          />
          <input
            type="text"
            placeholder="label (e.g. clip 1, @competitor reel)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
            style={{ background: "rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "7px 11px", fontSize: 12, color: "#F4F3F8", flex: 1, minWidth: 160 }}
          />
          <div style={{ display: "inline-flex", gap: 2, background: "rgba(8,8,18,0.6)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: 3 }}>
            {(["own", "reference"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                disabled={busy}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: busy ? "default" : "pointer",
                  background: source === s ? `${SOURCE_COLOR[s]}22` : "transparent",
                  color: source === s ? SOURCE_COLOR[s] : "#8B89A0",
                }}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
          <button
            onClick={analyze}
            disabled={!file || busy}
            style={{
              background: "rgba(255,154,98,0.12)",
              color: "#FF9A62",
              border: "1px solid rgba(255,154,98,0.4)",
              borderRadius: 9,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: !file || busy ? "default" : "pointer",
              opacity: !file || busy ? 0.6 : 1,
            }}
          >
            {busy ? "Watching…" : "▶ Analyze"}
          </button>
        </div>
        {busy && stage && <div style={{ fontSize: 11.5, color: "#7DD3FC", marginTop: 10 }}>{stage}</div>}
        {error && <div style={{ fontSize: 11.5, color: "#FF6B6B", marginTop: 10 }}>{error}</div>}
      </div>

      {list.length === 0 && !busy && (
        <div style={{ fontSize: 12, color: "#6E6C82", padding: "20px 4px" }}>No reels analyzed yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((reel) => (
          <div key={reel.id} className="fh-glass" style={{ borderRadius: 14, padding: "14px 17px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  fontFamily: "var(--label)",
                  color: SOURCE_COLOR[reel.source],
                  background: `${SOURCE_COLOR[reel.source]}18`,
                  border: `1px solid ${SOURCE_COLOR[reel.source]}44`,
                  borderRadius: 999,
                  padding: "2px 8px",
                  textTransform: "uppercase",
                }}
              >
                {SOURCE_LABEL[reel.source]}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#F4F3F8" }}>{reel.label}</span>
              <span style={{ fontSize: 10, color: "#5E5C72", fontFamily: "var(--mono)" }}>
                {new Date(reel.createdAt).toLocaleDateString()}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    copy(noteFor(reel));
                    setCopiedId(reel.id);
                    setTimeout(() => setCopiedId(null), 1400);
                  }}
                  style={{ background: "rgba(38,224,200,0.1)", color: "#26E0C8", border: "1px solid rgba(38,224,200,0.35)", borderRadius: 7, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                >
                  {copiedId === reel.id ? "Copied ✓" : "Copy as note"}
                </button>
                <button
                  onClick={() => setExpanded(expanded === reel.id ? null : reel.id)}
                  style={{ background: "rgba(125,211,252,0.1)", color: "#7DD3FC", border: "1px solid rgba(125,211,252,0.35)", borderRadius: 7, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                >
                  {expanded === reel.id ? "Collapse" : "Expand"}
                </button>
                <button
                  onClick={() => remove(reel.id)}
                  style={{ background: "rgba(255,107,107,0.1)", color: "#FF6B6B", border: "1px solid rgba(255,107,107,0.35)", borderRadius: 7, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
            {expanded === reel.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <AnalysisCard analysis={reel.analysis} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
