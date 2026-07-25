"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useStore } from "@/lib/store";
import { ideasFor, type StrategyProfile } from "@/lib/strategy";
import { reelVaultAdd, reelVaultAll, reelVaultDelete, type ReelAnalysis, type VaultReel } from "@/lib/reelVault";

const SOURCE_LABEL: Record<VaultReel["source"], string> = { own: "My content", reference: "Reference / competitor" };
const SOURCE_COLOR: Record<VaultReel["source"], string> = { own: "#26E0C8", reference: "#C9A8FF" };

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_BYTES = 200 * 1024 * 1024;

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
    a.remake?.beats?.length
      ? `\n**Remake script**${a.remake.hookLine ? `\nHOOK: "${a.remake.hookLine}"` : ""}\n${a.remake.beats
          .map((b, i) => `${i + 1}. [${b.duration || "~"}] ${b.shot || ""}${b.say ? ` — SAY: "${b.say}"` : ""}${b.onScreenText && b.onScreenText !== "none" ? ` — TEXT: ${b.onScreenText}` : ""}`)
          .join("\n")}${a.remake.cta ? `\nCTA: "${a.remake.cta}"` : ""}`
      : "",
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

      {!!analysis.styleDna?.beats?.length && (
        <div>
          <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#C9A8FF" }}>Style DNA · beat by beat</div>
          {analysis.styleDna.energy && <div style={{ fontSize: 12, color: "#D9D7E4", lineHeight: 1.5, marginBottom: 6 }}>{analysis.styleDna.energy}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {analysis.styleDna.beats.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11.5, lineHeight: 1.45, background: "rgba(201,168,255,0.05)", border: "1px solid rgba(201,168,255,0.14)", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ color: "#C9A8FF", fontWeight: 800, fontFamily: "var(--mono)", flexShrink: 0, minWidth: 44 }}>{b.t}</span>
                <span style={{ color: "#D9D7E4" }}>
                  {b.visual}
                  {b.onScreenText && b.onScreenText !== "none" && <> · <b style={{ color: "#EDEBF6" }}>“{b.onScreenText}”</b> ({b.textStyle})</>}
                  {b.transition && <span style={{ color: "#77758C" }}> → {b.transition}</span>}
                </span>
              </div>
            ))}
          </div>
          {analysis.styleDna.textTreatment && (
            <div style={{ fontSize: 11.5, color: "#A6A4B8", lineHeight: 1.5, marginTop: 6 }}><b style={{ color: "#C9A8FF" }}>Text system:</b> {analysis.styleDna.textTreatment}</div>
          )}
        </div>
      )}

      {!!analysis.remake?.beats?.length && (
        <div style={{ background: "rgba(232,98,44,0.06)", border: "1px solid rgba(232,98,44,0.3)", borderRadius: 12, padding: "12px 14px" }}>
          <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 8, color: "#E8622C" }}>🎬 Your remake · shot for shot</div>
          {analysis.remake.hookLine && (
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#F4F3F8", lineHeight: 1.35, marginBottom: 10 }}>HOOK: “{analysis.remake.hookLine}”</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {analysis.remake.beats.map((b, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5, borderLeft: "2px solid rgba(232,98,44,0.5)", paddingLeft: 10 }}>
                <div style={{ color: "#FF9A62", fontWeight: 800, fontSize: 10.5, fontFamily: "var(--mono)" }}>SHOT {i + 1}{b.duration ? ` · ${b.duration}` : ""}</div>
                <div style={{ color: "#D9D7E4" }}>{b.shot}</div>
                {b.say && <div style={{ color: "#EDEBF6" }}>🗣 “{b.say}”</div>}
                {b.onScreenText && b.onScreenText !== "none" && <div style={{ color: "#FFC23D" }}>📝 {b.onScreenText}</div>}
              </div>
            ))}
          </div>
          {analysis.remake.cta && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F4F3F8", marginTop: 10 }}>CTA: “{analysis.remake.cta}”</div>}
          {!!analysis.remake.productionNotes?.length && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
              {analysis.remake.productionNotes.map((n, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#A6A4B8", lineHeight: 1.45 }}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReelCoach() {
  const { state, copy } = useStore();
  const strategy = state.strategy as StrategyProfile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<VaultReel["source"]>("own");
  // style-match: pick one of your topics and the analysis also returns a
  // shot-for-shot remake script in the reference's style
  const [topicId, setTopicId] = useState("");
  const ideas = useMemo(() => ideasFor(strategy), [strategy]);
  const topic = ideas.find((i) => i.id === topicId) || null;
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<VaultReel[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    reelVaultAll().then(setList);
  }, []);

  const pickFile = (f: File | null | undefined) => {
    console.log("[reel-coach] pickFile", f ? { name: f.name, size: f.size, type: f.type } : null);
    if (f && !f.type.startsWith("video/")) {
      setError(`"${f.name}" doesn't look like a video file (${f.type || "unknown type"}) — pick a video clip.`);
      return;
    }
    if (f && f.size > MAX_FILE_BYTES) {
      setError(`"${f.name}" is ${formatBytes(f.size)} — that's over the 200MB cap. Trim or compress it first.`);
      return;
    }
    setError(null);
    setFile(f || null);
  };

  const analyze = async () => {
    if (!file || busy) return;
    const tag = `[reel-coach ${Date.now()}]`;
    console.log(tag, "analyze() start", { name: file.name, size: file.size, type: file.type });
    setBusy(true);
    setError(null);
    setStage("Uploading clip…");
    (window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg = true;
    try {
      console.log(tag, "calling blob upload()…");
      const blob = await upload(`reels/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`, file, {
        access: "public",
        handleUploadUrl: "/api/video-reference/blob-upload",
        contentType: file.type || "video/mp4",
      });
      console.log(tag, "blob upload() resolved", blob.url);

      setStage("Gemini is watching the clip — this can take a minute…");
      console.log(tag, "calling /api/video-reference…");
      const r = await fetch("/api/video-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: blob.url,
          contentType: file.type,
          label: label.trim(),
          source,
          ...(source === "reference" && topic
            ? { topic: { title: topic.title, angle: topic.angle, facts: topic.deck?.length ? topic.deck : [topic.angle] } }
            : {}),
        }),
        signal: AbortSignal.timeout(290000),
      });
      console.log(tag, "/api/video-reference responded", r.status);
      const j = await r.json();
      console.log(tag, "response parsed", { configured: j.configured, hasError: !!j.error });
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
      console.log(tag, "done");
    } catch (e) {
      console.error(tag, "analyze() threw", e);
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      (window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg = false;
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
        <div
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (busy) return;
            pickFile(e.dataTransfer.files?.[0]);
          }}
          style={{
            border: `1.5px dashed ${dragOver ? "#FF9A62" : "rgba(255,255,255,0.16)"}`,
            borderRadius: 12,
            padding: "18px 16px",
            textAlign: "center",
            cursor: busy ? "default" : "pointer",
            background: dragOver ? "rgba(255,154,98,0.08)" : "transparent",
            transition: "border-color .15s ease, background .15s ease",
            marginBottom: 12,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={(e) => pickFile(e.target.files?.[0])}
            disabled={busy}
            style={{ display: "none" }}
          />
          {file ? (
            <div style={{ fontSize: 12.5, color: "#F4F3F8" }}>
              <strong>{file.name}</strong>{" "}
              <span style={{ color: "#6E6C82" }}>({formatBytes(file.size)})</span>
              <div style={{ fontSize: 11, color: "#7DD3FC", marginTop: 4 }}>selected — click to swap, or Analyze below</div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#8B89A0" }}>
              Drag a clip here, or click to browse
              <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 3 }}>video files only — .mov, .mp4, up to 200MB</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
        {source === "reference" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#C9A8FF" }}>🎬 Style match</span>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={busy}
              style={{ background: "rgba(0,0,0,0.28)", color: "#F4F3F8", border: "1px solid rgba(201,168,255,0.35)", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, maxWidth: 340, fontFamily: "var(--body)" }}
            >
              <option value="">Coaching only — no remake script</option>
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
            <span style={{ fontSize: 10.5, color: "#8B89A0", lineHeight: 1.4, flex: 1, minWidth: 200 }}>
              Pick a topic and the analysis also returns a shot-for-shot script that remakes this video&apos;s
              style with YOUR content — hook, spoken lines, on-screen text, beat timings.
            </span>
          </div>
        )}
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
