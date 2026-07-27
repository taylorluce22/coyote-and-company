"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import { uploadInWorker, measureUpspeed, FILE_UNREADABLE, UPLOAD_STALLED, WORKER_UNAVAILABLE, type UploadProgress } from "@/lib/reelUploadClient";
import { useStore } from "@/lib/store";
import { ideasFor, type Idea, type StrategyProfile } from "@/lib/strategy";
import { reelVaultAdd, reelVaultAll, reelVaultDelete, type ReelAnalysis, type VaultReel } from "@/lib/reelVault";
import { buildHiggsfieldPrompt, recreationBriefText, type QualityFlag, type ReferenceVideoAnalysis } from "@/lib/styleGenome";
import { clipVaultDeleteForReel, clipVaultForReel } from "@/lib/clipVault";
import { captionPng } from "@/lib/captionPng";
import { record as meterRecord, UNIT_COST_CENTS, dollars } from "@/lib/meter";

const STEP_LABELS = ["Upload", "Hand-off", "Gemini processing", "Writing breakdown"];

const SOURCE_LABEL: Record<VaultReel["source"], string> = { own: "My content", reference: "Reference / competitor" };
const SOURCE_COLOR: Record<VaultReel["source"], string> = { own: "#26E0C8", reference: "#C9A8FF" };

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// 1GB — matches the blob-upload token cap; the server streams the clip to
// Gemini in chunks, so big files never sit in anyone's memory
const MAX_FILE_BYTES = 1024 * 1024 * 1024;
// soft warning only — big clips upload and analyze slower; Gemini only
// needs the style, not the runtime
const SOFT_WARN_BYTES = 200 * 1024 * 1024;

/* ---- pending analysis, persisted the moment the clip lands at Gemini ----
   Same crash-proof pattern as Composer's pendingBatch: if the tab dies, the
   connection drops, or a later phase fails, the uploaded clip is NOT lost —
   Gemini keeps files ~48h, and ⟳ Resume analysis picks up from here without
   re-uploading. Per-client key so analyses never cross client vaults. */
type PendingReel = {
  // jobId set = server-driven job (the server owns the pipeline and journals
  // progress — this device only peeks). fileName/fileUri set = legacy phased
  // record from an older build; resumed via the old client-driven path.
  jobId?: string;
  fileName: string;
  fileUri: string;
  mimeType: string;
  label: string;
  source: VaultReel["source"];
  topic: { title: string; angle: string; facts: string[] } | null;
  createdAt: number;
};
const pendingReelKey = (client: string) => (client === "default" ? "fh-reel-pending" : `fh-reel-pending::${client}`);
function readPendingReel(client: string): PendingReel | null {
  try {
    const raw = localStorage.getItem(pendingReelKey(client));
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingReel;
    if (!p.jobId && (!p.fileName || !p.fileUri)) return null;
    // Gemini files live ~48h — stop offering resume shortly before that
    if (!(p.createdAt > Date.now() - 40 * 3600000)) {
      localStorage.removeItem(pendingReelKey(client));
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
function writePendingReel(rec: PendingReel, client: string) {
  try {
    localStorage.setItem(pendingReelKey(client), JSON.stringify(rec));
  } catch {}
}
function clearPendingReel(client: string) {
  try {
    localStorage.removeItem(pendingReelKey(client));
  } catch {}
}

/* ---- inbox dedupe: job ids this DEVICE has already banked. Without it,
   an ack that fails to land would make the same finished job re-import as
   a duplicate vault card on every visit. ---- */
const BANKED_KEY = "fh-reel-banked-jobs";
function bankedJobs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(BANKED_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}
function markJobBanked(id: string) {
  try {
    // cap 100: must comfortably outlast the 40h journal window — evicting
    // an id whose failed-ack journal is still listable re-imports it
    localStorage.setItem(BANKED_KEY, JSON.stringify([...bankedJobs(), id].slice(-100)));
  } catch {}
}

/** Optional shared secret for the enumerating/destructive job phases —
    active only when the owner sets REEL_JOB_TOKEN (server) and
    NEXT_PUBLIC_REEL_JOB_TOKEN (app) in Vercel. */
const jobToken = () => (process.env.NEXT_PUBLIC_REEL_JOB_TOKEN ? { token: process.env.NEXT_PUBLIC_REEL_JOB_TOKEN } : {});

const TRIM_HINT =
  "the clip may be too long — trim it to under ~90 seconds of the reference (Gemini only needs the style, not the full runtime) and retry.";

/** Client-minted job id — minted BEFORE the job-start call so a lost
    response can never strand a job the client doesn't know about. */
function newJobId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/* ---- crash-surviving diagnostics ----
   The owner has hit repeated freezes here that never reproduce for the
   devs. Every step writes a breadcrumb SYNCHRONOUSLY to localStorage, so
   after a freeze/crash the next visit shows exactly where the last run
   died — plus a build stamp so "am I even running the fixed code?" is
   answerable at a glance. */
const BUILD_STAMP = `${process.env.NEXT_PUBLIC_COMMIT_SHA || "dev"} · ${process.env.NEXT_PUBLIC_BUILD_TIME || ""}`;
const CRUMB_KEY = "fh-reel-crumbs";
function crumb(msg: string) {
  try {
    const list = JSON.parse(localStorage.getItem(CRUMB_KEY) || "[]") as string[];
    list.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
    localStorage.setItem(CRUMB_KEY, JSON.stringify(list.slice(-25)));
  } catch {}
}
function readCrumbs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CRUMB_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

/** One short phased call to /api/video-reference. Throws plain-English on any failure. */
async function phasePost(body: Record<string, unknown>, timeoutMs: number, timeoutMsg: string): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch("/api/video-reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error(timeoutMsg);
  }
  let j: Record<string, unknown>;
  try {
    j = await r.json();
  } catch {
    // a platform-killed function returns an HTML error page, not JSON
    throw new Error(r.status === 504 || r.status === 502 ? `The server ran out of time — ${TRIM_HINT}` : timeoutMsg);
  }
  if (j.configured === false) {
    throw new Error("Needs GEMINI_API_KEY set in Vercel — ask Taylor to add it, then try again.");
  }
  if (typeof j.error === "string" && j.error) throw new Error(j.error);
  return j;
}

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
    a.genome?.overview?.formulaSummary ? `- Formula: ${a.genome.overview.formulaSummary}` : "",
    a.genome?.reusableStyleRules?.length ? `- Style rules:\n${a.genome.reusableStyleRules.map((r) => `  - ${r}`).join("\n")}` : "",
    a.coachingNotes?.length ? `- Coaching notes:\n${a.coachingNotes.map((n) => `  - ${n}`).join("\n")}` : "",
    a.remake?.beats?.length
      ? `\n**Remake script**${a.remake.hookLine ? `\nHOOK: "${a.remake.hookLine}"` : ""}\n${a.remake.beats
          .map(
            (b, i) =>
              `${i + 1}. [${b.duration || "~"}] ${b.shot || ""}${b.camera ? ` — CAMERA: ${b.camera}` : ""}${b.visualDetail ? ` — VISUAL: ${b.visualDetail}` : ""}${b.say ? ` — SAY: "${b.say}"` : ""}${b.onScreenText && b.onScreenText !== "none" ? ` — TEXT: ${b.onScreenText}${b.textStyle ? ` (${b.textStyle})` : ""}` : ""}${b.genPrompt ? `\n   GEN PROMPT: ${b.genPrompt}` : ""}`
          )
          .join("\n")}${a.remake.cta ? `\nCTA: "${a.remake.cta}"` : ""}`
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Per-beat AI-generation prompt: collapsed by default, one tap to copy —
    this text IS what goes into the video generator, so it must move as a
    unit, never retyped. */
function GenPromptRow({ prompt, shot }: { prompt: string; shot: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div style={{ marginTop: 3 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "transparent", border: "none", color: "#C9A8FF", fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
      >
        {open ? "▾" : "▸"} AI generation prompt
      </button>
      {open && (
        <div style={{ background: "rgba(201,168,255,0.07)", border: "1px solid rgba(201,168,255,0.25)", borderRadius: 8, padding: "8px 10px", marginTop: 4 }}>
          <div style={{ fontSize: 10.5, color: "#CFCBE0", fontFamily: "var(--mono)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{prompt}</div>
          <button
            onClick={copy}
            style={{ marginTop: 6, background: copied ? "#26E0C8" : "rgba(201,168,255,0.18)", color: copied ? "#0B0A12" : "#C9A8FF", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
          >
            {copied ? "✓ copied" : `copy shot ${shot} prompt`}
          </button>
        </div>
      )}
    </div>
  );
}

/** Copy-as-a-unit text block (master generation prompt, recreation brief) —
    this text feeds a generator, so it moves whole, never retyped. */
function CopyBlock({ title, text, color }: { title: string; text: string; color: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div style={{ background: `${color}0D`, border: `1px solid ${color}40`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</span>
        <button
          onClick={copy}
          style={{ marginLeft: "auto", background: copied ? "#26E0C8" : `${color}2E`, color: copied ? "#0B0A12" : color, border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: "#CFCBE0", fontFamily: "var(--mono)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{text}</div>
    </div>
  );
}

/** Chip row for the genome's list fields — scannable, not a paragraph. */
function Chips({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 10.5, color: "#6E6C82", flexShrink: 0, minWidth: 92 }}>{label}</span>
      {items.map((it, i) => (
        <span key={i} style={{ fontSize: 10.5, color: "#D9D7E4", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "2px 9px", lineHeight: 1.5 }}>
          {it}
        </span>
      ))}
    </div>
  );
}

/** Collapsible structured panel — compact by default, one tap to open. */
function Panel({ title, color, defaultOpen, children }: { title: string; color: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px" }}>
      <summary style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}>{title}</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>{children}</div>
    </details>
  );
}

const kvRow = (label: string, value?: string | number) =>
  value === undefined || value === "" ? null : (
    <div key={label} style={{ display: "flex", gap: 8, fontSize: 11.5, lineHeight: 1.5 }}>
      <span style={{ color: "#6E6C82", flexShrink: 0, minWidth: 92 }}>{label}</span>
      <span style={{ color: "#D9D7E4" }}>{String(value)}</span>
    </div>
  );

/** Quality-gate chips on an adapted script — flags, never silent. */
function QualityChips({ flags }: { flags?: QualityFlag[] }) {
  if (!flags?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
      {flags.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 11, lineHeight: 1.45 }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: 9,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: f.level === "block" ? "#FF6B6B" : "#FFC23D",
              background: f.level === "block" ? "rgba(255,107,107,0.12)" : "rgba(255,194,61,0.1)",
              border: `1px solid ${f.level === "block" ? "rgba(255,107,107,0.4)" : "rgba(255,194,61,0.35)"}`,
              borderRadius: 999,
              padding: "1px 8px",
            }}
          >
            {f.code}
          </span>
          <span style={{ color: "#A6A4B8" }}>{f.note}</span>
        </div>
      ))}
    </div>
  );
}

/** The reference video's decoded style genome — the Stage-1 extraction,
    rendered as compact collapsible panels instead of a text dump. */
function GenomeCard({ genome }: { genome: ReferenceVideoAnalysis }) {
  const ov = genome.overview;
  const hk = genome.hookAnalysis;
  const sc = genome.scriptStructure;
  const st = genome.styleAnalysis;
  const vl = genome.visualLanguage;
  const ed = genome.editingSystem;
  const pe = genome.persuasionSystem;
  const pr = genome.preserveVsReplace;
  const energy = (n?: number) => (n ? "▮".repeat(n) + "▯".repeat(5 - n) : "");
  return (
    <div>
      <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 6, color: "#7DD3FC" }}>Reference DNA · style genome</div>
      {ov?.formulaSummary && (
        <div style={{ fontSize: 12.5, color: "#F4F3F8", lineHeight: 1.5, marginBottom: 4 }}>
          {ov.formulaSummary}
          {ov.primaryStyleCategory && <span style={{ color: "#7DD3FC", fontSize: 11 }}> · {ov.primaryStyleCategory}</span>}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {!!genome.beatMap?.length && (
          <Panel title={`Beat map · ${genome.beatMap.length} beats`} color="#7DD3FC">
            {genome.beatMap.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, lineHeight: 1.45, background: "rgba(125,211,252,0.04)", border: "1px solid rgba(125,211,252,0.12)", borderRadius: 8, padding: "5px 9px" }}>
                <span style={{ color: "#7DD3FC", fontWeight: 800, fontFamily: "var(--mono)", flexShrink: 0, minWidth: 74 }}>
                  {b.startTime}–{b.endTime}
                </span>
                <span style={{ color: "#D9D7E4" }}>
                  {b.purpose && <b style={{ color: "#EDEBF6", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 0.4 }}>{b.purpose} </b>}
                  {b.visuals}
                  {b.dialogueOrText && <span style={{ color: "#A6A4B8" }}> · “{b.dialogueOrText}”</span>}
                  {b.editPattern && <span style={{ color: "#77758C" }}> → {b.editPattern}</span>}
                  {b.energyLevel !== undefined && (
                    <span style={{ color: "#FF9A62", fontFamily: "var(--mono)", fontSize: 9.5 }}> {energy(b.energyLevel)}</span>
                  )}
                </span>
              </div>
            ))}
          </Panel>
        )}
        {hk && (
          <Panel title="Hook mechanics" color="#FF9A62">
            {kvRow("Type", hk.hookType)}
            {kvRow("First 3s", hk.firstThreeSecondMechanics)}
            {kvRow("Promise", hk.emotionalPromise)}
            {kvRow("First change", hk.openingVisualChange)}
            {kvRow("Text pattern", hk.openingTextPattern)}
            <Chips label="Retention" items={hk.retentionDrivers} />
          </Panel>
        )}
        {sc && (
          <Panel title="Script skeleton" color="#FFC23D">
            {kvRow("Hook", sc.hook)}
            {kvRow("Setup", sc.setup)}
            {kvRow("Problem", sc.problem)}
            {kvRow("Reframe", sc.reframe)}
            {kvRow("Value", sc.valueDelivery)}
            {kvRow("Proof", sc.proof)}
            {kvRow("CTA", sc.cta)}
            {kvRow("Transitions", sc.transitionLogic)}
          </Panel>
        )}
        {(st || vl) && (
          <Panel title="Visual language" color="#C9A8FF">
            {kvRow("Format", st?.formatIdentity)}
            {kvRow("Pacing", st?.pacing)}
            {kvRow("Tone", st?.tone)}
            <Chips label="Vibe" items={st?.vibe} />
            <Chips label="Shots" items={vl?.shotTypes} />
            <Chips label="Camera" items={vl?.cameraMovement} />
            <Chips label="Composition" items={vl?.composition} />
            <Chips label="Lighting" items={vl?.lighting} />
            <Chips label="Palette" items={vl?.colorPalette} />
            <Chips label="Props" items={vl?.wardrobeOrProps} />
            <Chips label="Background" items={vl?.backgroundStyle} />
            {kvRow("Text overlays", vl?.textOverlayStyle)}
            {kvRow("B-roll", vl?.bRollStyle)}
            <Chips label="Transitions" items={vl?.transitions} />
          </Panel>
        )}
        {ed && (
          <Panel title="Editing system" color="#26E0C8">
            {kvRow("Avg shot", ed.averageShotDuration)}
            {kvRow("Cut frequency", ed.cutFrequency)}
            <Chips label="Cuts timed to" items={ed.cutMotivation} />
            {kvRow("Captions", ed.captionStyle)}
            {kvRow("Text density", ed.textDensity)}
            {kvRow("Sound design", ed.soundDesignRole)}
            {kvRow("Music", ed.musicRole)}
            <Chips label="Interrupts" items={ed.patternInterrupts} />
            {kvRow("Loop", ed.loopMechanics)}
          </Panel>
        )}
        {pe && (
          <Panel title="Persuasion system" color="#FF5D8F">
            <Chips label="Believability" items={pe.believabilityDrivers} />
            <Chips label="Premium" items={pe.premiumSignals} />
            <Chips label="Shareability" items={pe.shareabilityDrivers} />
            <Chips label="Save-worthy" items={pe.saveWorthyDrivers} />
            <Chips label="Authority" items={pe.authoritySignals} />
            <Chips label="Psychology" items={pe.psychologicalMechanics} />
          </Panel>
        )}
        {!!genome.reusableStyleRules?.length && (
          <Panel title="Reusable style rules" color="#41D98A" defaultOpen>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
              {genome.reusableStyleRules.map((r, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#D9D7E4", lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
          </Panel>
        )}
        {!!(pr?.preserve?.length || pr?.replace?.length) && (
          <Panel title="Preserve vs replace" color="#FFC23D" defaultOpen>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(["preserve", "replace"] as const).map((side) => (
                <div key={side} style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: side === "preserve" ? "#41D98A" : "#FF9A62", marginBottom: 4 }}>
                    {side === "preserve" ? "✓ keep — style DNA" : "↻ swap — topic content"}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                    {(pr?.[side] || []).map((it, i) => (
                      <li key={i} style={{ fontSize: 11.5, color: "#D9D7E4", lineHeight: 1.45 }}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {genome.recreationBrief && <CopyBlock title="Recreation brief" text={recreationBriefText(genome)} color="#7DD3FC" />}
        <CopyBlock title="Higgsfield master prompt" text={buildHiggsfieldPrompt(genome)} color="#C9A8FF" />
      </div>
    </div>
  );
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

      {analysis.genome && <GenomeCard genome={analysis.genome} />}

      {!analysis.genome && !!analysis.styleDna?.beats?.length && (
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
          <div className="fh-kicker" style={{ fontSize: 9, marginBottom: 8, color: "#E8622C" }}>
            🎬 Your remake · shot for shot{analysis.adaptedTopic ? ` · ${analysis.adaptedTopic}` : ""}
          </div>
          <QualityChips flags={analysis.remakeQuality} />
          {analysis.remake.concept && (
            <div style={{ fontSize: 12, color: "#D9D7E4", lineHeight: 1.5, marginBottom: 8 }}>{analysis.remake.concept}</div>
          )}
          {analysis.remake.hookLine && (
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#F4F3F8", lineHeight: 1.35, marginBottom: 10 }}>HOOK: “{analysis.remake.hookLine}”</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {analysis.remake.beats.map((b, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5, borderLeft: "2px solid rgba(232,98,44,0.5)", paddingLeft: 10 }}>
                <div style={{ color: "#FF9A62", fontWeight: 800, fontSize: 10.5, fontFamily: "var(--mono)" }}>SHOT {i + 1}{b.duration ? ` · ${b.duration}` : ""}</div>
                <div style={{ color: "#D9D7E4" }}>{b.shot}</div>
                {b.camera && <div style={{ color: "#8B89A0", fontSize: 11 }}>🎥 {b.camera}</div>}
                {b.visualDetail && <div style={{ color: "#A6A4B8", fontSize: 11 }}>{b.visualDetail}</div>}
                {b.say && <div style={{ color: "#EDEBF6" }}>🗣 “{b.say}”</div>}
                {b.onScreenText && b.onScreenText !== "none" && (
                  <div style={{ color: "#FFC23D" }}>
                    📝 {b.onScreenText}
                    {b.textStyle && <span style={{ color: "#7A7890", fontSize: 10.5 }}> — {b.textStyle}</span>}
                  </div>
                )}
                {b.genPrompt && <GenPromptRow prompt={b.genPrompt} shot={i + 1} />}
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

/* ---- Stage 3: per-beat video generation (Higgsfield) ----
   One t2v job per remake beat genPrompt, shared seed, 9:16. Crash-proof by
   the same design as Composer's image batches: jobs are recorded locally
   BEFORE the first poll, every finished clip is committed to the clip vault
   the moment it lands, and ⟳ Recover pulls paid-for clips after any crash. */
type PendingClip = { url: string; beat: number; prompt: string };
const clipPendingKey = (client: string) => (client === "default" ? "fh-clip-pending" : `fh-clip-pending::${client}`);
function readClipPending(client: string): { reelId: string; items: PendingClip[] } | null {
  try {
    const raw = localStorage.getItem(clipPendingKey(client));
    if (!raw) return null;
    const p = JSON.parse(raw) as { reelId?: string; items?: PendingClip[]; at?: number };
    if (!p.reelId || !Array.isArray(p.items) || !p.items.length) return null;
    // platform jobs are unpollable after ~24h — stop offering recovery then
    if (!(Number(p.at) > Date.now() - 24 * 3600000)) {
      localStorage.removeItem(clipPendingKey(client));
      return null;
    }
    return { reelId: p.reelId, items: p.items };
  } catch {
    return null;
  }
}
function writeClipPending(reelId: string, items: PendingClip[], client: string) {
  try {
    localStorage.setItem(clipPendingKey(client), JSON.stringify({ reelId, items, at: Date.now() }));
  } catch {}
}
function pruneClipPending(beat: number, client: string) {
  try {
    const raw = localStorage.getItem(clipPendingKey(client));
    if (!raw) return;
    const p = JSON.parse(raw) as { reelId?: string; items?: PendingClip[]; at?: number };
    p.items = (Array.isArray(p.items) ? p.items : []).filter((it) => it.beat !== beat);
    if (!p.items.length) localStorage.removeItem(clipPendingKey(client));
    else localStorage.setItem(clipPendingKey(client), JSON.stringify(p));
  } catch {}
}

type BeatClipState = "none" | "rendering" | "done" | "failed";

/* ---- spoken-voice settings (per workspace, client-side) ----
   me  = the owner's cloned ElevenLabs voice (Settings › Spoken voice)
   edu = the brand narrator (workspace override, else ELEVENLABS_VOICE_ID) */
const spokenVoiceKey = (ws: string) => `fh-spoken-voice::${ws}`;
const narratorVoiceKey = (ws: string) => `fh-narrator-voice::${ws}`;
const voModeKey = (ws: string) => `fh-vo-mode::${ws}`;
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};
const lsSet = (k: string, v: string) => {
  try {
    v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  } catch {}
};

/** Bound any prep-stage promise — a stuck step must FAIL with its name,
    never spin on a static label (live-tested lesson: an unbounded await
    before the first network call reads as a silent hang). */
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} stalled after ${Math.round(ms / 1000)}s — reload the tab and try again`)), ms)),
  ]);

/** Duration of an audio URL via metadata — used to time beats to the VO.
    Streams only the header off the CDN (range request), never the file.
    CANNOT hang: if the browser never fires a metadata event, the 8s
    fallback resolves 0 and the beat falls back to its scripted duration. */
const audioSecs = (src: string): Promise<number> =>
  new Promise((res) => {
    let settled = false;
    const done = (n: number) => {
      if (settled) return;
      settled = true;
      res(n);
    };
    try {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0);
      a.ondurationchange = () => {
        if (Number.isFinite(a.duration) && a.duration > 0) done(a.duration);
      };
      a.onerror = () => done(0);
      a.src = src;
      a.load();
      setTimeout(() => done(0), 8000);
    } catch {
      done(0);
    }
  });

/** Scripted beat seconds ("~4s" → 4), clamped to the ~6s clip ceiling. */
const secsOf = (d?: string) => {
  const n = parseInt(String(d || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(6, n) : 5;
};

/** The reel's server-side media manifest: URLs only — the browser never
    holds media bytes again (the no-media-on-the-main-thread rule). */
type Manifest = { clips: Record<number, string>; vos: Record<number, string>; draft?: string };

/* ---- quality tiers (P2) ----
   standard = text-to-video, fast/cheap (hailuo-02 standard, 720p draft).
   premium  = style-locked KEYFRAME image per beat first (shared seed), then
   image-to-video at top fidelity + 1080×1920 assembly — the i2v step is the
   single biggest quality lever vs professionally-animated references.
   Cost-aware: blended UI estimates shown BEFORE spending. */
type Tier = "standard" | "premium";
const qualityKey = (ws: string, reelId: string) => `fh-reel-quality::${ws}::${reelId}`;
const KEYFRAME_CENTS = UNIT_COST_CENTS.image;
const PREMIUM_CLIP_CENTS = 240; // blended estimate for a hi-fi 1080p i2v render
const perClipCents = (t: Tier) => (t === "premium" ? PREMIUM_CLIP_CENTS + KEYFRAME_CENTS : UNIT_COST_CENTS.reel);

/* ---- Reference vs Draft compare (P3) ----
   Both stream from the server vault; play/pause/scrub drive BOTH players
   (the reference is the sync master) so the quality gap is visible shot by
   shot on every iteration. */
function CompareView({ referenceUrl, draftUrl }: { referenceUrl: string; draftUrl: string }) {
  const refV = useRef<HTMLVideoElement>(null);
  const drV = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  const both = (fn: (v: HTMLVideoElement) => void) => {
    if (refV.current) fn(refV.current);
    if (drV.current) fn(drV.current);
  };
  const toggle = () => {
    if (playing) {
      both((v) => v.pause());
      setPlaying(false);
    } else {
      both((v) => {
        v.play().catch(() => {});
      });
      setPlaying(true);
    }
  };
  const seek = (sec: number) => {
    setT(sec);
    both((v) => {
      try {
        v.currentTime = Math.min(sec, Number.isFinite(v.duration) ? v.duration : sec);
      } catch {}
    });
  };
  const onRefTime = () => {
    const rv = refV.current;
    const dv = drV.current;
    if (!rv) return;
    setT(rv.currentTime);
    // keep the draft within a third of a second of the reference
    if (dv && Number.isFinite(dv.duration) && Math.abs(dv.currentTime - rv.currentTime) > 0.35) {
      try {
        dv.currentTime = Math.min(rv.currentTime, dv.duration);
      } catch {}
    }
  };
  const onMeta = () => {
    const d = Math.max(refV.current?.duration || 0, drV.current?.duration || 0);
    if (Number.isFinite(d) && d > 0) setDur(d);
  };
  const vid = (ref: React.RefObject<HTMLVideoElement | null>, url: string, label: string, accent: string, master: boolean) => (
    <div style={{ flex: 1, minWidth: 130, maxWidth: 200 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <video
        ref={ref}
        src={url}
        playsInline
        preload="metadata"
        muted={!master} /* one soundtrack at a time — the reference leads */
        onLoadedMetadata={onMeta}
        onTimeUpdate={master ? onRefTime : undefined}
        onEnded={master ? () => setPlaying(false) : undefined}
        style={{ width: "100%", aspectRatio: "9/16", borderRadius: 10, background: "#000", border: `1px solid ${accent}55` }}
      />
    </div>
  );
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        ⚖ Reference vs your draft — synced
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {vid(refV, referenceUrl, "Reference", "#C9A8FF", true)}
        {vid(drV, draftUrl, "Your draft", "#41D98A", false)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          onClick={toggle}
          style={{ background: "rgba(125,211,252,0.14)", color: "#7DD3FC", border: "1px solid rgba(125,211,252,0.4)", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.05}
          value={Math.min(t, dur || 1)}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#7DD3FC" }}
        />
        <span style={{ fontSize: 10, color: "#8B89A0", fontFamily: "var(--mono)", minWidth: 66, textAlign: "right" }}>
          {t.toFixed(1)}s / {dur ? dur.toFixed(1) : "–"}s
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 4, lineHeight: 1.45 }}>
        Reference audio plays; the draft is muted and follows the scrub. Spot the gap, tweak, re-produce.
      </div>
    </div>
  );
}

/** Generate, track, play and produce a remake's media — every asset lives
    in the SERVER vault (Vercel Blob) and streams straight off the CDN into
    <video>/<audio> tags. The browser only triggers work and renders URLs:
    clips are ingested Higgsfield→server→Blob, narration is stored
    server-side by /api/tts, and /api/assemble reads and writes the vault
    directly. IndexedDB media is migrated up once, then retired. */
function ClipStudio({ reel, workspace }: { reel: VaultReel; workspace: string }) {
  const beats = (reel.analysis.remake?.beats || []).filter((b) => b.genPrompt);
  const [man, setMan] = useState<Manifest>({ clips: {}, vos: {} });
  const [manErr, setManErr] = useState<string | null>(null);
  const [migMsg, setMigMsg] = useState<string | null>(null);
  // bump busts the CDN cache after an overwrite (regen/re-assemble reuse
  // the same vault key, so the URL alone would keep serving the old bytes)
  const [bump, setBump] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [beatState, setBeatState] = useState<Record<number, BeatClipState>>({});
  const [pending, setPending] = useState<{ reelId: string; items: PendingClip[] } | null>(null);
  // quality tier — persisted per reel; premium = keyframe i2v + 1080p
  const [tier, setTier] = useState<Tier>(() => (lsGet(qualityKey(workspace, reel.id)) === "premium" ? "premium" : "standard"));
  // voiceover + assembly
  const [voMode, setVoMode] = useState<"edu" | "me">(() => (lsGet(voModeKey(workspace)) === "me" ? "me" : "edu"));
  const [voBusy, setVoBusy] = useState(false);
  const [voMsg, setVoMsg] = useState<string | null>(null);
  const [asmBusy, setAsmBusy] = useState(false);
  const [asmMsg, setAsmMsg] = useState<string | null>(null);
  const [music, setMusic] = useState<File | null>(null);
  const [prodBusy, setProdBusy] = useState(false);
  const [prodArm, setProdArm] = useState(false);
  useEffect(() => {
    if (!prodArm) return;
    const t = setTimeout(() => setProdArm(false), 10000);
    return () => clearTimeout(t);
  }, [prodArm]);
  const anyBusy = busy || voBusy || asmBusy || prodBusy;
  const src = (u?: string) => (u ? `${u}${u.includes("?") ? "&" : "?"}v=${bump}` : undefined);

  // manRef mirrors man so async flows read fresh state without stale closures
  const manRef = useRef<Manifest>({ clips: {}, vos: {} });
  const applyMan = (next: Manifest) => {
    manRef.current = next;
    setMan(next);
  };
  const loadManifest = async (): Promise<Manifest> => {
    const r = await withTimeout(
      fetch(`/api/vault?client=${encodeURIComponent(workspace)}&reelId=${encodeURIComponent(reel.id)}`, { cache: "no-store", signal: AbortSignal.timeout(20000) }),
      25000,
      "reading the server vault"
    );
    const j = (await r.json()) as { clips?: Array<{ beat: number; url: string }>; vos?: Array<{ beat: number; url: string }>; draft?: string; error?: string };
    if (!r.ok || j.error) throw new Error(j.error || `vault read failed (${r.status})`);
    const listed: Manifest = { clips: {}, vos: {}, draft: j.draft };
    (j.clips || []).forEach((c) => (listed.clips[c.beat] = c.url));
    (j.vos || []).forEach((v) => (listed.vos[v.beat] = v.url));
    // MERGE, never replace: Blob list() can lag a just-finished put, and a
    // stale listing must not un-render banked media (that's how credits get
    // re-spent). Keys the client wrote this session are authoritative.
    const merged: Manifest = {
      clips: { ...listed.clips, ...manRef.current.clips },
      vos: { ...listed.vos, ...manRef.current.vos },
      draft: manRef.current.draft || listed.draft,
    };
    applyMan(merged);
    return merged;
  };

  /* mount: manifest, then a ONE-TIME migration of any media this device
     still holds in IndexedDB (the pre-server-vault era). Local copies are
     deleted only after the server manifest confirms every asset landed —
     paid-for media is never dropped on faith. */
  const migRef = useRef(false);
  useEffect(() => {
    (async () => {
      setManErr(null);
      let m: Manifest = { clips: {}, vos: {} };
      try {
        m = await loadManifest();
      } catch (e) {
        setManErr(e instanceof Error ? e.message : "couldn't read the server vault");
        return; // no migration against an unreadable manifest
      }
      if (migRef.current) return;
      migRef.current = true;
      try {
        // reads/deletes are PINNED to the captured workspace — a mid-flight
        // client switch must never touch another client's local vault
        const local = await clipVaultForReel(reel.id, workspace);
        if (!local.length) return;
        const slotFilled = (c: (typeof local)[number], mm: Manifest) =>
          c.kind === "vo" ? !!mm.vos[c.beatIndex] : c.kind === "draft" ? !!mm.draft : !!mm.clips[c.beatIndex];
        const todo = local.filter((c) => !slotFilled(c, m));
        let failed = 0;
        if (todo.length) {
          for (let k = 0; k < todo.length; k++) {
            const c = todo[k];
            setMigMsg(`⤴ One-time move to the server vault… ${k + 1}/${todo.length} (this ends the freezing era)`);
            const name = c.kind === "vo" ? `vo-${c.beatIndex}.mp3` : c.kind === "draft" ? "draft.mp4" : `clip-${c.beatIndex}.mp4`;
            // legacy mimes can be off-allowlist oddities — fall back to the
            // kind default; one bad asset must not strand the rest
            const type = c.kind === "vo" ? (c.mime?.startsWith("audio/") ? c.mime : "audio/mpeg") : c.mime?.startsWith("video/") ? c.mime : "video/mp4";
            try {
              await withTimeout(
                upload(`vault/${workspace}/${reel.id}/${name}`, c.blob, {
                  access: "public",
                  handleUploadUrl: "/api/video-reference/blob-upload",
                  contentType: type,
                }),
                180000,
                `migrating ${name}`
              );
            } catch {
              failed++;
            }
          }
        }
        const fresh = await loadManifest();
        if (!failed && local.every((c) => slotFilled(c, fresh))) {
          await clipVaultDeleteForReel(reel.id, workspace);
          setMigMsg(todo.length ? `✓ ${todo.length} asset${todo.length === 1 ? "" : "s"} moved to the server vault — media now streams, never loads.` : null);
        } else {
          setMigMsg(`Migration incomplete${failed ? ` (${failed} upload${failed === 1 ? "" : "s"} failed)` : ""} — banked media stays safe on this device; it retries next visit.`);
        }
      } catch (e) {
        setMigMsg(`Migration paused (${e instanceof Error ? e.message : "upload failed"}) — banked media stays safe on this device; it retries next visit.`);
      }
    })();
    const rec = readClipPending(workspace);
    setPending(rec && rec.reelId === reel.id ? rec : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel.id, workspace]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 10000);
    return () => clearTimeout(t);
  }, [armed]);

  /** Poll tracked Higgsfield jobs; finished clips are ingested SERVER-SIDE
      (Higgsfield CDN → function → Blob vault) — the bytes never touch the
      browser. */
  const pollClips = async (items: PendingClip[], budgetMs: number): Promise<{ ok: number; failed: number }> => {
    const deadline = Date.now() + budgetMs;
    const settled = new Set<number>();
    let ok = 0;
    let failed = 0;
    while (settled.size < items.length && Date.now() < deadline) {
      const open = items.filter((it) => !settled.has(it.beat));
      let results: { status?: string; videos?: string[] }[] = [];
      try {
        const r = await fetch("/api/higgsfield", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ check: open.map((o) => o.url) }),
          signal: AbortSignal.timeout(30000),
        });
        const j = await r.json();
        results = Array.isArray(j.results) ? j.results : [];
      } catch {}
      for (let k = 0; k < open.length; k++) {
        const it = open[k];
        const res = results[k];
        if (!res) continue;
        if (res.status === "failed") {
          settled.add(it.beat);
          failed++;
          setBeatState((s) => ({ ...s, [it.beat]: "failed" }));
          pruneClipPending(it.beat, workspace);
          continue;
        }
        const u = res.status === "completed" ? res.videos?.[0] : null;
        if (!u) continue; // completed-without-video = thumbnails only, keep waiting
        try {
          const vr = await fetch("/api/vault", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phase: "ingest", client: workspace, reelId: reel.id, beat: it.beat, sourceUrl: u }),
            signal: AbortSignal.timeout(120000),
          });
          const vj = (await vr.json().catch(() => ({}))) as { url?: string; error?: string };
          if (!vr.ok || !vj.url) continue; // transient — retry on the next sweep
          settled.add(it.beat);
          meterRecord(workspace, "reel", 1);
          ok++;
          applyMan({ ...manRef.current, clips: { ...manRef.current.clips, [it.beat]: vj.url! } });
          setBump((x) => x + 1);
          setBeatState((s) => ({ ...s, [it.beat]: "done" }));
          pruneClipPending(it.beat, workspace);
          setMsg(`🎬 ${ok}/${items.length} clips in — the rest are still rendering…`);
        } catch {}
      }
      if (settled.size < items.length) await new Promise((r) => setTimeout(r, 6000));
    }
    return { ok, failed };
  };

  /** Render beat clips. `onlyMissing` skips beats already in the vault (the
      Produce-reel path — never re-spends on a rendered beat). Returns true
      when every targeted beat has a clip server-side. */
  const generate = async (onlyMissing = false): Promise<boolean> => {
    if (busy || !beats.length) return false;
    setBusy(true);
    setArmed(false);
    setMsg("🎬 Starting the beat renders…");
    try {
      const m = await loadManifest();
      const targets = beats
        .map((b, i) => ({ i, prompt: b.genPrompt || "", duration: b.duration }))
        .filter((t) => t.prompt && (!onlyMissing || !m.clips[t.i]));
      if (!targets.length) {
        setMsg(onlyMissing ? "✓ Every beat already has a clip — nothing to render." : "No beats with generation prompts.");
        return onlyMissing;
      }
      const seed = 1 + Math.floor(Math.random() * 999_999);

      /* PREMIUM stage 1/2 — style-locked keyframe per beat (shared seed for
         cross-beat consistency). Keyframes are cheap; every one must land
         BEFORE any video credits are spent. */
      const keyframes: Record<number, string> = {};
      if (tier === "premium") {
        setMsg("🎨 Premium 1/2 — rendering style-locked keyframes…");
        const kr = await fetch("/api/higgsfield", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompts: targets.map((t) => t.prompt.slice(0, 1500)), seed, aspect: "9:16" }),
          signal: AbortSignal.timeout(90000),
        });
        const kj = await kr.json();
        if (kj.needsCreds) {
          setMsg("Add your Higgsfield API keys in Connectors first — no credits were spent.");
          return false;
        }
        const kHandles: (string | null)[] = Array.isArray(kj.jobs) ? kj.jobs : [];
        const kfPending = kHandles
          .map((u, k) => (u && targets[k] ? { url: u, beat: targets[k].i } : null))
          .filter((x): x is { url: string; beat: number } => !!x);
        if (kfPending.length < targets.length) {
          setMsg(kj.error || "Couldn't start the keyframes — no video credits were spent.");
          return false;
        }
        const kfDeadline = Date.now() + 4 * 60000;
        const kfOpen = () => kfPending.filter((it) => !keyframes[it.beat]);
        while (kfOpen().length && Date.now() < kfDeadline) {
          const open = kfOpen();
          try {
            const cr = await fetch("/api/higgsfield", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ check: open.map((o) => o.url) }),
              signal: AbortSignal.timeout(30000),
            });
            const cj = await cr.json();
            const results: { status?: string; images?: string[] }[] = Array.isArray(cj.results) ? cj.results : [];
            open.forEach((it, k) => {
              const img = results[k]?.status === "completed" ? results[k]?.images?.[0] : null;
              if (img) {
                keyframes[it.beat] = img;
                meterRecord(workspace, "image", 1);
              }
            });
          } catch {}
          if (kfOpen().length) await new Promise((r2) => setTimeout(r2, 3500));
          setMsg(`🎨 Premium 1/2 — keyframes ${targets.length - kfOpen().length}/${targets.length} ready…`);
        }
        if (kfOpen().length) {
          setMsg("Some keyframes didn't finish — no video credits were spent. Try again in a minute.");
          return false;
        }
        setMsg("🎨 Premium 2/2 — animating keyframes at top fidelity (1080p)…");
      }

      const r = await fetch("/api/higgsfield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPrompts: targets.map((t) => ({
            prompt: t.prompt,
            duration: t.duration,
            ...(tier === "premium" ? { imageUrl: keyframes[t.i] } : {}),
          })),
          seed,
          aspect: "9:16",
          ...(tier === "premium" ? { tier: "premium" } : {}),
        }),
        signal: AbortSignal.timeout(120000),
      });
      const j = await r.json();
      if (j.needsCreds) {
        setMsg("Add your Higgsfield API keys in Connectors first — no credits were spent.");
        return false;
      }
      const handles: (string | null)[] = Array.isArray(j.jobs) ? j.jobs : [];
      const items: PendingClip[] = handles
        .map((u, k) => (u && targets[k] ? { url: u, beat: targets[k].i, prompt: targets[k].prompt } : null))
        .filter((x): x is PendingClip => !!x);
      if (!items.length) {
        setMsg(j.error || "Couldn't start the renders — no credits were spent.");
        return false;
      }
      // record the paid-for jobs BEFORE polling — a crash can't lose them
      writeClipPending(reel.id, items, workspace);
      setPending({ reelId: reel.id, items });
      setBeatState(Object.fromEntries(items.map((it) => [it.beat, "rendering" as BeatClipState])));
      setMsg(`🎬 ${items.length} beat${items.length === 1 ? "" : "s"} rendering — clips land below as they finish (a few minutes each)…`);
      const { ok, failed } = await pollClips(items, 8 * 60000);
      setPending(readClipPending(workspace));
      if (!ok && !failed) setMsg("The clips didn't come back in time — they're already paid for. Hit ⟳ Recover clips in a few minutes.");
      else if (failed) setMsg(`✓ ${ok} clip${ok === 1 ? "" : "s"} landed — ${failed} failed on Higgsfield's side (credits refunded there). Regenerate anytime.`);
      else setMsg(`✓ All ${ok} beat${ok === 1 ? "" : "s"} rendered into the server vault — play them below.`);
      return ok === items.length && !failed;
    } catch {
      setPending(readClipPending(workspace));
      setMsg("Lost the connection mid-batch — your clips are safe. Hit ⟳ Recover clips to pull them in.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Pull finished clips from an interrupted batch — no new credits spent. */
  const recover = async () => {
    const rec = readClipPending(workspace);
    if (!rec || rec.reelId !== reel.id || busy) return;
    setBusy(true);
    setMsg("⟳ Checking Higgsfield for your finished clips…");
    try {
      setBeatState(Object.fromEntries(rec.items.map((it) => [it.beat, "rendering" as BeatClipState])));
      const { ok } = await pollClips(rec.items, 90000);
      setPending(readClipPending(workspace));
      setMsg(ok ? `✓ Recovered ${ok} clip${ok === 1 ? "" : "s"} — nothing wasted.` : "Nothing ready yet — try again in a few minutes.");
    } finally {
      setBusy(false);
    }
  };

  /** Per-beat narration via /api/tts in vault mode: the mp3 goes straight
      to the server vault and only the URL comes back. Re-running SKIPS
      beats that already have a segment; `force` regenerates everything
      (voice change). Returns true when every spoken beat has a segment. */
  const generateVo = async (force = false): Promise<boolean> => {
    if (voBusy) return false;
    const m = await loadManifest().catch(() => man);
    const targets = beats
      .map((b, i) => ({ i, say: (b.say || "").trim() }))
      .filter((t) => t.say && (force || !m.vos[t.i]));
    if (!targets.length) {
      setVoMsg("✓ Every spoken beat already has narration — use ↻ Re-voice to redo them.");
      return true;
    }
    const voiceId = voMode === "me" ? lsGet(spokenVoiceKey(workspace)) : lsGet(narratorVoiceKey(workspace));
    if (voMode === "me" && !voiceId) {
      setVoMsg("No personal voice yet — record one in Settings › Spoken voice first (≈60 seconds).");
      return false;
    }
    setVoBusy(true);
    let done = 0;
    try {
      for (const t of targets) {
        setVoMsg(`🎙 Narrating beat ${t.i + 1} of ${beats.length}…`);
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: t.say,
            ...(voiceId ? { voiceId } : {}),
            store: { client: workspace, reelId: reel.id, beat: t.i },
          }),
          signal: AbortSignal.timeout(60000),
        });
        const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string; configured?: boolean };
        if (j.configured === false) throw new Error("Needs ELEVENLABS_API_KEY in Vercel — add it in Connectors, then retry.");
        if (!j.url) throw new Error(j.error || `narration failed on beat ${t.i + 1}`);
        done++;
        applyMan({ ...manRef.current, vos: { ...manRef.current.vos, [t.i]: j.url! } });
        setBump((x) => x + 1);
      }
      setVoMsg(`✓ ${done} narration segment${done === 1 ? "" : "s"} in the server vault — play them below, then Assemble.`);
      return true;
    } catch (e) {
      setVoMsg(`${e instanceof Error ? e.message : "narration failed"}${done ? ` (${done} segment${done === 1 ? "" : "s"} already banked — re-running skips them)` : ""}`);
      return false;
    } finally {
      setVoBusy(false);
    }
  };

  /** Phase 2: the server assembles straight FROM the vault (clips + VO by
      URL) and writes the draft back TO the vault — the browser uploads only
      the tiny caption PNGs (and music, if attached) and then streams the
      result. Returns true on success. */
  const assemble = async (): Promise<boolean> => {
    if (asmBusy) return false;
    setAsmBusy(true);
    setAsmMsg("① Reading the server vault…");
    try {
      const m = await loadManifest();
      const missing = beats.map((_, i) => i).filter((i) => !m.clips[i]);
      if (missing.length) {
        setAsmMsg(`Beat${missing.length === 1 ? "" : "s"} ${missing.map((i) => i + 1).join(", ")} ${missing.length === 1 ? "has" : "have"} no clip yet — generate beats first.`);
        return false;
      }
      const tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const timeline: Array<{ clip: string; vo?: string; cap?: string; duration: number }> = [];
      for (let i = 0; i < beats.length; i++) {
        setAsmMsg(`② Timing beat ${i + 1}/${beats.length} + rendering its caption…`);
        const vo = m.vos[i];
        const scriptD = secsOf(beats[i].duration);
        // beat runs as long as the voice needs (plus a breath), inside the
        // clip; audioSecs streams metadata only and can't hang (8s fallback)
        const voD = vo ? await audioSecs(src(vo) as string) : 0;
        const D = Math.min(6, Math.max(scriptD, voD > 0 ? voD + 0.3 : 0) || scriptD);
        const entry: { clip: string; vo?: string; cap?: string; duration: number } = { clip: m.clips[i], duration: D };
        if (vo) entry.vo = vo;
        const capText = (beats[i].onScreenText || "").trim();
        if (capText && capText.toLowerCase() !== "none") {
          // caption cards are tiny canvas PNGs — the one thing the client
          // still renders (it has the real fonts); a wedged toBlob skips
          // the caption rather than hanging the run
          const cap = await withTimeout(captionPng(capText), 8000, `rendering beat ${i + 1}'s caption`).catch(() => null);
          if (cap) {
            const up = await withTimeout(
              upload(`reels/asm/${tag}/b${i}-cap.png`, cap, { access: "public", handleUploadUrl: "/api/video-reference/blob-upload", contentType: "image/png" }),
              60000,
              `uploading beat ${i + 1}'s caption`
            );
            entry.cap = up.url;
          }
        }
        timeline.push(entry);
      }
      let musicUrl: string | undefined;
      if (music) {
        setAsmMsg("③ Uploading the music bed…");
        const up = await withTimeout(
          upload(`reels/asm/${tag}/music-${music.name.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 40)}`, music, {
            access: "public",
            handleUploadUrl: "/api/video-reference/blob-upload",
            contentType: music.type || "audio/mpeg",
          }),
          120000,
          "uploading the music bed"
        );
        musicUrl = up.url;
      }

      setAsmMsg("④ Server is encoding the reel… (usually 15–60s, native ffmpeg — your browser stays free)");
      const r = await fetch("/api/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beats: timeline, client: workspace, reelId: reel.id, quality: tier, ...(musicUrl ? { music: musicUrl } : {}) }),
        signal: AbortSignal.timeout(290000),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; seconds?: number; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || `the encode failed (${r.status}) — try again`);
      applyMan({ ...manRef.current, draft: j.url });
      setBump((x) => x + 1);
      const total = timeline.reduce((s, p) => s + p.duration, 0);
      setAsmMsg(`✓ Draft reel assembled (${Math.round(total)}s, narration + captions${music ? " + music" : ""}) — streaming below.`);
      return true;
    } catch (e) {
      setAsmMsg(e instanceof Error ? e.message : "assembly failed — try again");
      return false;
    } finally {
      setAsmBusy(false);
    }
  };

  /** ONE TAP: beats → voiceover → assembled draft, skipping anything
      already banked — the acceptance path "imported genome job → finished
      narrated + captioned reel". Individual buttons stay for re-runs. */
  const produceReel = async () => {
    if (busy || voBusy || asmBusy || prodBusy) return;
    setProdBusy(true);
    setProdArm(false);
    try {
      const clipsOk = await generate(true);
      if (!clipsOk) return; // generate() already surfaced why
      const voOk = await generateVo(false);
      if (!voOk) return;
      await assemble();
    } finally {
      setProdBusy(false);
    }
  };

  if (!beats.length) return null;
  const estCents = beats.length * perClipCents(tier);
  const stateFor = (i: number): BeatClipState =>
    man.clips[i] ? "done" : beatState[i] || (pending?.items.some((it) => it.beat === i) ? "rendering" : "none");
  const chip: Record<BeatClipState, { label: string; color: string }> = {
    none: { label: "not rendered", color: "#5E5C72" },
    rendering: { label: "rendering…", color: "#7DD3FC" },
    done: { label: "✓ clip saved", color: "#41D98A" },
    failed: { label: "failed", color: "#FF6B6B" },
  };
  const clipCount = Object.keys(man.clips).length;

  return (
    <div style={{ marginTop: 12, background: "rgba(232,98,44,0.05)", border: "1px solid rgba(232,98,44,0.28)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#E8622C", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Beat clips — server vault, streamed
        </span>
        <div style={{ display: "inline-flex", gap: 2, background: "rgba(8,8,18,0.6)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: 3 }}>
          {(
            [
              { id: "standard" as Tier, label: "Standard", tip: `Fast + cheap — text-to-video, ≈${dollars(perClipCents("standard"))}/clip` },
              { id: "premium" as Tier, label: "✨ Premium", tip: `Keyframe → image-to-video at 1080p, style-locked — ≈${dollars(perClipCents("premium"))}/clip` },
            ]
          ).map((q) => (
            <button
              key={q.id}
              onClick={() => {
                setTier(q.id);
                lsSet(qualityKey(workspace, reel.id), q.id === "premium" ? "premium" : "");
              }}
              disabled={anyBusy}
              title={q.tip}
              style={{
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 10.5,
                fontWeight: 700,
                cursor: anyBusy ? "default" : "pointer",
                background: tier === q.id ? (q.id === "premium" ? "rgba(255,194,61,0.22)" : "rgba(125,211,252,0.18)") : "transparent",
                color: tier === q.id ? (q.id === "premium" ? "#FFC23D" : "#7DD3FC") : "#8B89A0",
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pending && !anyBusy && (
            <button
              onClick={recover}
              style={{ background: "rgba(255,194,61,0.12)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              ⟳ Recover clips
            </button>
          )}
          <button
            onClick={() => (armed ? generate(false) : setArmed(true))}
            disabled={anyBusy}
            style={{
              background: armed ? "rgba(232,98,44,0.25)" : "rgba(232,98,44,0.12)",
              color: "#FF9A62",
              border: "1px solid rgba(232,98,44,0.5)",
              borderRadius: 8,
              padding: "6px 13px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: anyBusy ? "default" : "pointer",
              opacity: anyBusy ? 0.6 : 1,
            }}
          >
            {busy ? "Rendering…" : armed ? `Confirm — ${beats.length} ${tier === "premium" ? "premium " : ""}clips ≈ ${dollars(estCents)}` : clipCount ? "↻ Regenerate beats" : "▶ Generate beats"}
          </button>
          {(() => {
            const missingCount = beats.filter((_, i) => !man.clips[i]).length;
            const prodLabel = prodBusy
              ? "Producing…"
              : prodArm
                ? `Confirm — renders ${missingCount} ${tier === "premium" ? "premium " : ""}clip${missingCount === 1 ? "" : "s"} ≈ ${dollars(missingCount * perClipCents(tier))}`
                : "⚡ Produce reel";
            return (
              <button
                onClick={() => {
                  if (prodBusy || anyBusy) return;
                  if (missingCount && !prodArm) setProdArm(true);
                  else produceReel();
                }}
                disabled={anyBusy}
                title="Beats → voiceover → assembled draft, skipping anything already rendered"
                style={{
                  background: prodArm ? "rgba(65,217,138,0.3)" : "rgba(65,217,138,0.16)",
                  color: "#41D98A",
                  border: "1px solid rgba(65,217,138,0.55)",
                  borderRadius: 8,
                  padding: "6px 13px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: anyBusy ? "default" : "pointer",
                  opacity: anyBusy && !prodBusy ? 0.6 : 1,
                }}
              >
                {prodLabel}
              </button>
            );
          })()}
        </div>
      </div>
      {manErr && (
        <div style={{ fontSize: 11, color: "#FF6B6B", marginTop: 6, lineHeight: 1.45 }}>
          {manErr} — reload to retry; nothing is lost.
        </div>
      )}
      {migMsg && <div style={{ fontSize: 11, color: "#FFC23D", marginTop: 6, lineHeight: 1.45 }}>{migMsg}</div>}
      {msg && <div style={{ fontSize: 11, color: "#7DD3FC", marginTop: 6, lineHeight: 1.45 }}>{msg}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {beats.map((b, i) => {
          const st = stateFor(i);
          const clipUrl = man.clips[i];
          const voUrl = man.vos[i];
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderLeft: "2px solid rgba(232,98,44,0.4)", paddingLeft: 10 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#FF9A62", fontFamily: "var(--mono)" }}>
                  SHOT {i + 1}
                  {b.duration ? ` · ${b.duration}` : ""}{" "}
                  <span style={{ color: chip[st].color, fontWeight: 700 }}>· {chip[st].label}</span>
                  {(b.say || "").trim() && (
                    <span style={{ color: voUrl ? "#41D98A" : "#5E5C72", fontWeight: 700 }}> · {voUrl ? "✓ voiced" : "no VO yet"}</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "#A6A4B8", lineHeight: 1.45 }}>{b.shot}</div>
                {voUrl && <audio src={src(voUrl)} controls preload="metadata" style={{ width: "100%", maxWidth: 300, height: 30, marginTop: 4 }} />}
                {clipUrl && (
                  <a href={src(clipUrl)} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#7DD3FC", fontWeight: 700, textDecoration: "none" }}>
                    ↗ open clip
                  </a>
                )}
              </div>
              {clipUrl && (
                <video
                  src={src(clipUrl)}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: 108, aspectRatio: "9/16", borderRadius: 8, background: "#000", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ---- voiceover row: narration for every spoken beat ---- */}
      {beats.some((b) => (b.say || "").trim()) && (
        <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#C9A8FF", textTransform: "uppercase", letterSpacing: 0.5 }}>🎙 Voiceover</span>
            <div style={{ display: "inline-flex", gap: 2, background: "rgba(8,8,18,0.6)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: 3 }}>
              {(
                [
                  { id: "edu" as const, label: "Brand narrator" },
                  { id: "me" as const, label: "My voice" },
                ]
              ).map((mo) => (
                <button
                  key={mo.id}
                  onClick={() => {
                    setVoMode(mo.id);
                    lsSet(voModeKey(workspace), mo.id);
                  }}
                  disabled={anyBusy}
                  style={{
                    border: "none",
                    borderRadius: 6,
                    padding: "5px 11px",
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: anyBusy ? "default" : "pointer",
                    background: voMode === mo.id ? "rgba(201,168,255,0.2)" : "transparent",
                    color: voMode === mo.id ? "#C9A8FF" : "#8B89A0",
                  }}
                >
                  {mo.label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {!!Object.keys(man.vos).length && (
                <button
                  onClick={() => generateVo(true)}
                  disabled={anyBusy}
                  style={{ background: "transparent", color: "#8B89A0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 11px", fontSize: 10.5, fontWeight: 700, cursor: anyBusy ? "default" : "pointer" }}
                >
                  ↻ Re-voice all
                </button>
              )}
              <button
                onClick={() => generateVo(false)}
                disabled={anyBusy}
                style={{ background: "rgba(201,168,255,0.14)", color: "#C9A8FF", border: "1px solid rgba(201,168,255,0.45)", borderRadius: 8, padding: "6px 13px", fontSize: 11.5, fontWeight: 700, cursor: anyBusy ? "default" : "pointer", opacity: anyBusy ? 0.6 : 1 }}
              >
                {voBusy ? "Narrating…" : "🎙 Generate voiceover"}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 4, lineHeight: 1.45 }}>
            {voMode === "me"
              ? lsGet(spokenVoiceKey(workspace))
                ? "Uses your cloned voice (Settings › Spoken voice)."
                : "No personal voice yet — record one in Settings › Spoken voice."
              : "Uses the brand narrator voice — pick/override it in Settings › Spoken voice."}{" "}
            Segments store server-side; re-running only voices missing beats.
          </div>
          {voMsg && <div style={{ fontSize: 11, color: "#C9A8FF", marginTop: 5, lineHeight: 1.45 }}>{voMsg}</div>}
        </div>
      )}

      {/* ---- assembly row: the payoff — one action, one draft reel ---- */}
      <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#41D98A", textTransform: "uppercase", letterSpacing: 0.5 }}>🎞 Draft reel</span>
          <label style={{ fontSize: 10.5, color: "#8B89A0", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setMusic(e.target.files?.[0] || null)}
              disabled={anyBusy}
              style={{ display: "none" }}
            />
            <span style={{ border: "1px dashed rgba(255,255,255,0.18)", borderRadius: 7, padding: "4px 9px" }}>
              {music ? `♪ ${music.name.slice(0, 24)}` : "♪ add music bed (optional)"}
            </span>
            {music && (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  setMusic(null);
                }}
                style={{ color: "#FF6B6B", fontWeight: 700 }}
              >
                ✕
              </span>
            )}
          </label>
          <button
            onClick={() => assemble()}
            disabled={anyBusy || clipCount < beats.length}
            style={{
              marginLeft: "auto",
              background: "rgba(65,217,138,0.14)",
              color: "#41D98A",
              border: "1px solid rgba(65,217,138,0.45)",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: anyBusy || clipCount < beats.length ? "default" : "pointer",
              opacity: anyBusy || clipCount < beats.length ? 0.6 : 1,
            }}
          >
            {asmBusy ? "Assembling…" : man.draft ? "↻ Re-assemble draft" : "🎞 Assemble draft"}
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: "#8B89A0", marginTop: 4, lineHeight: 1.45 }}>
          The server assembles straight from the vault (native ffmpeg, 15–60s) — your browser only uploads the tiny
          caption cards and streams the finished 9:16 MP4 back. Nothing heavy ever runs in this tab.
        </div>
        {asmMsg && <div style={{ fontSize: 11, color: "#41D98A", marginTop: 5, lineHeight: 1.45 }}>{asmMsg}</div>}
        {man.draft && !asmBusy && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 10 }}>
            <video
              src={src(man.draft)}
              controls
              playsInline
              preload="metadata"
              style={{ width: 148, aspectRatio: "9/16", borderRadius: 10, background: "#000", border: "1px solid rgba(65,217,138,0.4)" }}
            />
            <div style={{ fontSize: 11, color: "#A6A4B8", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 800, color: "#41D98A", marginBottom: 4 }}>Draft reel — narration + captions</div>
              <a href={src(man.draft)} target="_blank" rel="noreferrer" style={{ color: "#7DD3FC", fontWeight: 700, textDecoration: "none", fontSize: 11.5 }}>
                ↗ open / save draft.mp4
              </a>
              <div style={{ marginTop: 4 }}>Good enough → post it. Want polish → drop it in CapCut; the cut, VO and captions are already done.</div>
            </div>
          </div>
        )}
        {man.draft && typeof reel.analysis.referenceUrl === "string" && reel.analysis.referenceUrl && !asmBusy && (
          <CompareView referenceUrl={reel.analysis.referenceUrl} draftUrl={src(man.draft) as string} />
        )}
      </div>
    </div>
  );
}

/** Stage 2 alone: re-run the ADAPTATION from the saved genome — new topic,
    new inputs, zero re-analysis, zero video upload. The style DNA was paid
    for once; this is where it gets reused. */
function ReAdapt({ reel, ideas, onSaved }: { reel: VaultReel; ideas: Idea[]; onSaved: () => Promise<void> }) {
  const [topicId, setTopicId] = useState("");
  const [audience, setAudience] = useState("");
  const [cta, setCta] = useState("");
  const [tone, setTone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idea = ideas.find((i) => i.id === topicId) || null;
  const inputStyle = {
    background: "rgba(0,0,0,0.24)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 11.5,
    color: "#F4F3F8",
    flex: 1,
    minWidth: 130,
  } as const;
  const run = async () => {
    if (!idea || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/reel-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genome: reel.analysis.genome,
          topic: { title: idea.title, angle: idea.angle, facts: idea.deck?.length ? idea.deck : [idea.angle] },
          ...(audience.trim() ? { audience: audience.trim() } : {}),
          ...(cta.trim() ? { cta: cta.trim() } : {}),
          ...(tone.trim() ? { tone: tone.trim() } : {}),
        }),
        signal: AbortSignal.timeout(220000),
      });
      const j = (await r.json()) as { script?: { remake?: ReelAnalysis["remake"] }; quality?: QualityFlag[]; error?: string; configured?: boolean };
      if (j.configured === false) throw new Error("Needs a Gemini or Claude key in Connectors first.");
      if (j.error) throw new Error(j.error);
      const remake = j.script?.remake;
      if (!remake?.beats?.length) throw new Error("The adaptation came back empty — try again.");
      const updated: VaultReel = {
        ...reel,
        analysis: { ...reel.analysis, remake, remakeQuality: j.quality || [], adaptedTopic: idea.title },
      };
      if (!(await reelVaultAdd(updated))) throw new Error("The new script couldn't be saved on this device — free up browser storage and retry.");
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Adaptation failed — try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 12, background: "rgba(201,168,255,0.05)", border: "1px solid rgba(201,168,255,0.25)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#C9A8FF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Re-adapt this style — new topic, no re-analysis
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          disabled={busy}
          style={{ background: "rgba(0,0,0,0.28)", color: "#F4F3F8", border: "1px solid rgba(201,168,255,0.35)", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, maxWidth: 300, fontFamily: "var(--body)" }}
        >
          <option value="">Pick the new topic…</option>
          {ideas.map((i) => (
            <option key={i.id} value={i.id}>{i.title}</option>
          ))}
        </select>
        <input placeholder="audience (optional)" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={busy} style={inputStyle} />
        <input placeholder="CTA direction (optional)" value={cta} onChange={(e) => setCta(e.target.value)} disabled={busy} style={inputStyle} />
        <input placeholder="tone (optional)" value={tone} onChange={(e) => setTone(e.target.value)} disabled={busy} style={inputStyle} />
        <button
          onClick={run}
          disabled={!idea || busy}
          style={{
            background: "rgba(201,168,255,0.14)",
            color: "#C9A8FF",
            border: "1px solid rgba(201,168,255,0.45)",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: !idea || busy ? "default" : "pointer",
            opacity: !idea || busy ? 0.6 : 1,
          }}
        >
          {busy ? "Adapting… (1–2 min)" : "↻ Write new script"}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: "#8B89A0", lineHeight: 1.45, marginTop: 6 }}>
        Reuses this reel&apos;s saved style genome and replaces the current remake script in place.
      </div>
      {err && <div style={{ fontSize: 11, color: "#FF6B6B", marginTop: 6 }}>{err}</div>}
    </div>
  );
}

export default function ReelCoach() {
  const { state, copy, workspace } = useStore();
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
  // visual progress: real % while upload events arrive (null = shimmer),
  // and which of the 4 steps the run is on
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  // live timing: upload ETA computed from the real transfer rate; all other
  // stages show elapsed seconds so a long wait never looks like a hang
  const upStartRef = useRef(0);
  const busyStartRef = useRef(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!busy) return;
    busyStartRef.current = Date.now();
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const fmtSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.max(1, Math.round(s))}s`);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<VaultReel[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingReel | null>(null);
  // guards the silent on-open job peek against double-banking a result
  const autoBankRef = useRef(false);
  // one inbox sweep at a time — StrictMode double-mounts and workspace
  // switches must not run two sweeps that double-bank the same job
  const inboxSweepRef = useRef(false);

  useEffect(() => {
    crumb(`screen open · build ${BUILD_STAMP}`);
    reelVaultAll().then(setList);
    const rec = readPendingReel(workspace);
    setPending(rec);
    // server-driven jobs finish while the phone is away — one silent peek on
    // open, and a finished breakdown is banked without any tap at all
    if (rec?.jobId && !autoBankRef.current) {
      autoBankRef.current = true;
      (async () => {
        try {
          const j = await phasePost({ phase: "job-status", jobId: rec.jobId }, 15000, "");
          if (j.jobState === "done" && j.analysis && readPendingReel(workspace)) {
            const reel: VaultReel = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              label: rec.label,
              source: rec.source,
              analysis: j.analysis as ReelAnalysis,
              createdAt: Date.now(),
            };
            if (await reelVaultAdd(reel, workspace)) {
              if (rec.jobId) markJobBanked(rec.jobId);
              clearPendingReel(workspace);
              setPending(null);
              setList(await reelVaultAll());
              setExpanded(reel.id);
              phasePost({ phase: "job-ack", jobId: rec.jobId, ...jobToken() }, 15000, "").catch(() => {});
              crumb("auto-banked a finished analysis ✓");
            }
          }
        } catch {
        } finally {
          autoBankRef.current = false;
        }
      })();
    }
    // INBOX SWEEP: jobs started OUTSIDE this browser entirely — a Cowork
    // terminal upload, another device — finished on the server and waiting.
    // Bank them automatically; no manual hand-off ever. Every guard here
    // exists because an adversarial review traced a duplicate or data-loss
    // path without it.
    let cancelled = false;
    (async () => {
      if (inboxSweepRef.current) return; // one sweep at a time (StrictMode double-mount, workspace switches)
      inboxSweepRef.current = true;
      try {
        const inbox = await phasePost({ phase: "job-inbox", ...jobToken() }, 30000, "");
        const jobs = Array.isArray(inbox.jobs)
          ? (inbox.jobs as Array<{ jobId?: string; label?: string; source?: string; client?: string }>)
          : [];
        const seen = new Set<string>();
        for (const jb of jobs.slice(0, 3)) {
          if (cancelled) break;
          try {
            const jobId = String(jb.jobId || "");
            if (!jobId || seen.has(jobId)) continue;
            seen.add(jobId);
            // re-read the banked-set EVERY iteration — a concurrent banker
            // (auto-peek, watchJob) may have marked it mid-loop
            if (bankedJobs().includes(jobId)) {
              // journal outlived a failed ack — burn it so it stops
              // occupying inbox slots
              phasePost({ phase: "job-ack", jobId, ...jobToken() }, 15000, "").catch(() => {});
              continue;
            }
            // the job's HOME client: tagged at job-start, else the active
            // workspace. Banking into the wrong client's vault would strand
            // the analysis where its owner never looks.
            const home = String(jb.client || "") || workspace;
            if (readPendingReel(home)?.jobId === jobId) continue; // its own watcher banks it
            const j = await phasePost({ phase: "job-status", jobId }, 20000, "");
            if (j.jobState !== "done" || !j.analysis) continue;
            if (bankedJobs().includes(jobId)) continue; // raced a concurrent banker while fetching
            const reel: VaultReel = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              label: String(j.label || jb.label || "imported reel"),
              source: j.source === "reference" || jb.source === "reference" ? "reference" : "own",
              analysis: j.analysis as ReelAnalysis,
              createdAt: Date.now(),
            };
            const saved = await reelVaultAdd(reel, home);
            if (!saved) continue; // vault blocked — leave the job on the server for later
            markJobBanked(jobId);
            phasePost({ phase: "job-ack", jobId, ...jobToken() }, 15000, "").catch(() => {});
            crumb(`inbox: banked "${reel.label}" ✓${home !== workspace ? ` → ${home}` : ""}`);
            if (home === workspace) {
              setList(await reelVaultAll());
              setExpanded(reel.id);
            }
          } catch (e) {
            // one bad entry must not abort the rest of the sweep
            console.warn("[reel-inbox] entry failed", e);
          }
        }
      } catch {
      } finally {
        inboxSweepRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  // hold the screen awake while a run is live — phone auto-lock mid-upload
  // was the silent killer; once the job is with the server this matters
  // less, but the upload itself still needs the tab alive
  const wakeRef = useRef<{ release?: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!busy) return;
    type WakeNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    let gone = false;
    const grab = async () => {
      try {
        const wl = await (navigator as WakeNav).wakeLock?.request("screen");
        if (gone) wl?.release().catch(() => {});
        else wakeRef.current = wl || null;
      } catch {}
    };
    grab();
    const onVis = () => {
      if (document.visibilityState === "visible") grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onVis);
      wakeRef.current?.release?.().catch(() => {});
      wakeRef.current = null;
    };
  }, [busy]);

  const pickFile = (f: File | null | undefined) => {
    // DEFENSIVE WRAPPER: with promise-backed files dragged straight out of
    // Photos.app, even reading name/size/type can throw — that must never
    // escape and wedge the tab. Catch → crumb → plain-English guidance.
    try {
      // breadcrumb FIRST — if the tab wedges during attach, this is the last
      // thing that survives and tells us exactly what file did it
      crumb(f ? `attach: ${f.name} · ${formatBytes(f.size)} · ${f.type || "no-type"}` : "attach: none");
      if (f && !(f.type.startsWith("video/") || f.type === "")) {
        crumb("attach rejected: not a video type");
        setError(`"${f.name}" doesn't look like a video file (${f.type || "unknown type"}) — pick a video clip.`);
        return;
      }
      if (f && f.size > MAX_FILE_BYTES) {
        crumb("attach rejected: over 1GB cap");
        setError(`"${f.name}" is ${formatBytes(f.size)} — that's over the 1GB cap. Trim or compress it first.`);
        return;
      }
      setError(null);
      setFile(f || null);
      if (f) crumb("attach ok — Analyze enabled");
    } catch (e) {
      crumb(`attach FAILED reading file metadata: ${e instanceof Error ? e.message.slice(0, 60) : "unknown"}`);
      setError("That file couldn't be read — drag it to your Desktop first, then upload the copy.");
    }
  };

  /** Phases 2+3 (poll processing, then analyze) — shared by a fresh analyze
      and by ⟳ Resume, so an interrupted run picks up exactly where it died.
      Throws plain-English on failure; the pending record stays until the
      analysis is safely in the vault. */
  const pollAndAnalyze = async (rec: PendingReel, tag: string) => {
    crumb("poll: waiting for Gemini processing");
    setStep(2);
    setStage("Gemini is processing the clip… (usually under 2 minutes)");
    const deadline = Date.now() + 180000; // client-owned poll budget
    let fileState = "PROCESSING";
    while (fileState === "PROCESSING" && Date.now() < deadline) {
      try {
        const j = await phasePost(
          { phase: "status", fileName: rec.fileName },
          20000,
          "Lost the connection while checking on the clip — your upload is safe, hit ⟳ Resume analysis."
        );
        fileState = String(j.state || "PROCESSING");
      } catch (e) {
        // one flaky poll shouldn't kill the run — only a hard config error should
        if (e instanceof Error && e.message.includes("GEMINI_API_KEY")) throw e;
        console.warn(tag, "status poll hiccup", e);
      }
      if (fileState === "PROCESSING") await new Promise((r) => setTimeout(r, 3000));
    }
    console.log(tag, "file state", fileState);
    crumb(`poll done: ${fileState}`);
    if (fileState === "NOT_FOUND") {
      clearPendingReel(workspace);
      setPending(null);
      throw new Error("That upload expired on Gemini's side — upload the clip again.");
    }
    if (fileState === "FAILED") {
      clearPendingReel(workspace);
      setPending(null);
      throw new Error(`Gemini couldn't process that video — ${TRIM_HINT}`);
    }
    if (fileState !== "ACTIVE") {
      throw new Error("Gemini is still processing the clip — your upload is safe. Hit ⟳ Resume analysis in a minute.");
    }

    setStep(3);
    setStage("Gemini is watching the clip and writing your breakdown… (usually 1–2 minutes)");
    crumb("analyze: sent to Gemini");
    const j = await phasePost(
      {
        phase: "analyze",
        fileUri: rec.fileUri,
        mimeType: rec.mimeType,
        label: rec.label,
        source: rec.source,
        ...(rec.topic ? { topic: rec.topic } : {}),
      },
      220000,
      `The analysis didn't come back in time — your upload is safe, hit ⟳ Resume analysis to retry without re-uploading. If it keeps failing, ${TRIM_HINT}`
    );
    const reel: VaultReel = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: rec.label,
      source: rec.source,
      analysis: j.analysis as ReelAnalysis,
      createdAt: Date.now(),
    };
    // vault FIRST — and pinned to the run's client, so a mid-run workspace
    // switch can't leak the analysis into another client's vault. The write
    // reports failure via its boolean (it never throws), so ENFORCE the
    // "analysis is safe before cleanup" invariant here: on a failed save the
    // pending record survives and ⟳ Resume retries without re-uploading.
    crumb("analyze: result received, saving");
    const saved = await reelVaultAdd(reel, workspace);
    if (!saved) {
      throw new Error(
        "The analysis finished but couldn't be saved on this device (browser storage blocked or full) — your upload is still safe at Gemini. Free up storage or exit private browsing, then hit ⟳ Resume analysis to retry without re-uploading."
      );
    }
    clearPendingReel(workspace);
    setPending(null);
    setList(await reelVaultAll());
    setExpanded(reel.id);
    crumb("done ✓ analysis in the vault");
  };

  /** Save a finished job's analysis. Vault FIRST (same invariant as
      pollAndAnalyze: nothing is cleaned up until the analysis is safe on
      this device), then burn the server-side job journal. */
  const bankAnalysis = async (rec: PendingReel, analysis: ReelAnalysis) => {
    const reel: VaultReel = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: rec.label,
      source: rec.source,
      analysis,
      createdAt: Date.now(),
    };
    const saved = await reelVaultAdd(reel, workspace);
    if (!saved) {
      throw new Error(
        "The analysis finished but couldn't be saved on this device (browser storage blocked or full) — it's still waiting on the server. Free up storage or exit private browsing, then hit ⟳ Resume analysis."
      );
    }
    if (rec.jobId) markJobBanked(rec.jobId);
    clearPendingReel(workspace);
    setPending(null);
    setList(await reelVaultAll());
    setExpanded(reel.id);
    if (rec.jobId) phasePost({ phase: "job-ack", jobId: rec.jobId, ...jobToken() }, 15000, "").catch(() => {});
    crumb("done ✓ analysis in the vault");
  };

  /** Server-driven job watcher: the SERVER owns the pipeline — these are
      status peeks, so a locked phone or closed tab can't kill the run.
      If the ingest invocation ran out of budget while Gemini was still
      processing, this kicks job-continue to finish on a fresh one. */
  const watchJob = async (rec: PendingReel, tag: string) => {
    const jobId = rec.jobId;
    if (!jobId) throw new Error("no job id");
    const t0 = Date.now();
    let analyzingSince = 0;
    let lastKick = 0;
    let errorKicks = 0;
    let lastState = "";
    // ONE continue-kick per cooldown window no matter which branch asks —
    // journal-visibility lag must not fan out into duplicate pipelines
    const kick = async (why: string, minGapMs: number) => {
      if (Date.now() - lastKick < minGapMs) return;
      lastKick = Date.now();
      crumb(why);
      try {
        await phasePost({ phase: "job-continue", jobId }, 25000, "couldn't restart the analysis — will retry");
        analyzingSince = Date.now();
      } catch (e) {
        console.warn(tag, "job-continue hiccup", e);
      }
    };
    for (;;) {
      let j: Record<string, unknown> = {};
      try {
        j = await phasePost({ phase: "job-status", jobId }, 20000, "status check dropped");
      } catch (e) {
        // one flaky peek must never kill the run — only a hard config error
        if (e instanceof Error && e.message.includes("GEMINI_API_KEY")) throw e;
        console.warn(tag, "job-status hiccup", e);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const js = String(j.jobState || "");
      if (js !== lastState) {
        crumb(`job: ${js || "waiting"}`);
        lastState = js;
      }
      if (js === "done") {
        // auto-bank on mount may have won a race with this loop — that's success
        if (!readPendingReel(workspace)) {
          setList(await reelVaultAll());
          return;
        }
        // "done" with no payload = flaky read of the done record — banking
        // it would ack away the only copy of the analysis. Re-peek instead.
        if (!j.analysis) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        await bankAnalysis(rec, j.analysis as ReelAnalysis);
        return;
      }
      if (js === "error") {
        const msg = String(j.jobError || "The analysis failed — try again.");
        if (j.retryable === true) {
          // an error record is the newest journal entry forever — "hit
          // Resume" alone would just re-read it. Retry FOR the owner: a
          // fresh job-continue writes newer records that supersede it.
          if (errorKicks < 2) {
            errorKicks += 1;
            setStage("That try failed — giving it another shot…");
            await kick("job: retryable error — re-kicking", 30000);
            await new Promise((r) => setTimeout(r, 4000));
            continue;
          }
          throw new Error(`${msg} Your clip is still at Gemini — hit ⟳ Resume analysis to retry without re-uploading.`);
        }
        clearPendingReel(workspace);
        setPending(null);
        phasePost({ phase: "job-ack", jobId, ...jobToken() }, 15000, "").catch(() => {});
        throw new Error(msg);
      }
      if (js === "received" || js === "none") {
        setStep(1);
        setStage("Handing the clip to Gemini… (the server does this part — usually 30–90s for a big clip)");
        // a platform-killed ingest leaves "received" as the latest record —
        // job-continue re-runs the ingest from the journaled video url
        if (Date.now() - t0 > 75000) await kick("job: hand-off stalled — re-kicking ingest", 3 * 60000);
        if (Date.now() - t0 > 10 * 60000) {
          throw new Error("The hand-off to Gemini is taking too long — hit ⟳ Resume analysis in a minute; if it keeps happening, re-upload.");
        }
      } else if (js === "processing") {
        setStep(2);
        setStage("Gemini is processing the clip… ✅ safe to close the app — the server finishes on its own; check back in a few minutes");
        if (String(j.geminiState || "") === "ACTIVE") {
          // ingest invocation spent its budget before analyzing — fresh one
          await kick("job: kicking analysis", 3 * 60000);
        }
        if (Date.now() - t0 > 30 * 60000) {
          throw new Error("Gemini has been processing this clip for a long time — your upload is safe; hit ⟳ Resume analysis later, or trim the clip and re-upload.");
        }
      } else if (js === "analyzing") {
        setStep(3);
        setStage("Gemini is watching the clip and writing your breakdown… (usually 1–2 minutes)");
        if (!analyzingSince) analyzingSince = Date.now();
        // a platform-killed analyze leaves "analyzing" as the latest record;
        // a live one can't run past ~2min — after 3min of silence, re-kick
        if (Date.now() - analyzingSince > 3 * 60000) {
          await kick("job: analysis stalled — re-kicking", 3 * 60000);
        }
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };

  const analyze = async () => {
    if (!file || busy) return;
    const tag = `[reel-coach ${Date.now()}]`;
    setBusy(true);
    setError(null);
    setStage("Uploading clip…");
    (window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg = true;
    try {
      // metadata reads live INSIDE the try — with a Photos-library
      // placeholder even .name/.size can block or throw
      console.log(tag, "analyze() start", { name: file.name, size: file.size, type: file.type });
      // Phase 0: browser → Vercel Blob. multipart chunks the file (~8MB parts
      // with retries) instead of one giant buffered request — the old
      // single-shot upload of a 100-200MB reel is what OOM-crashed the tab.
      console.log(tag, "calling blob upload()…");
      crumb(`upload: starting (${formatBytes(file.size)})`);
      // preflight: measure the pipe before committing a big clip to it —
      // a dead connection fails HERE in seconds with guidance, and a slow
      // one gets an honest time estimate up front
      setStage("Checking your connection speed…");
      const bps = await measureUpspeed();
      if (bps === 0) {
        crumb("upspeed: dead/blocked");
        throw new Error(UPLOAD_STALLED);
      }
      if (bps) {
        const mbps = (bps * 8) / 1e6;
        const estSecs = (file.size / bps) * 1.15;
        crumb(`upspeed: ~${mbps.toFixed(1)} Mbps · est ${fmtSecs(estSecs)}`);
        setStage(
          `Uploading clip… (your connection ≈${mbps.toFixed(1)} Mbps up — expect about ${fmtSecs(estSecs)}${estSecs > 300 ? "; the 🔗 link lane below would be much faster" : ""})`
        );
      } else {
        setStage("Uploading clip…");
      }
      upStartRef.current = Date.now();
      const pathname = `reels/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const ctype = file.type || "video/mp4";
      let lastMilestone = 0;
      let lastProg = 0;
      const onProg = ({ loaded, total, percentage }: UploadProgress) => {
        // throttle re-renders — flooding setState from progress events is
        // main-thread work during the exact window the tab keeps freezing
        const now = Date.now();
        if (now - lastProg < 250 && percentage < 99) return;
        lastProg = now;
        // ETA from the measured transfer rate — the thing the owner
        // actually wants to know: "how long will this take"
        const elapsed = Math.max(0.5, (now - upStartRef.current) / 1000);
        const rate = loaded / elapsed;
        const remain = rate > 0 && total > loaded ? (total - loaded) / rate : 0;
        setUploadPct(percentage);
        setStage(`Uploading… ${Math.round(percentage)}%${remain > 1 ? ` · about ${fmtSecs(remain)} left` : ""}`);
        const m = Math.floor(percentage / 25) * 25;
        if (m > lastMilestone) {
          lastMilestone = m;
          crumb(`upload: ${m}%`);
        }
      };
      let blobUrl = "";
      try {
        try {
          // preferred: the upload runs in a Web Worker — file slicing,
          // multipart machinery and retries all happen OFF the main thread
          blobUrl = await uploadInWorker(file, pathname, ctype, onProg);
          crumb("upload done (worker)");
        } catch (we) {
          if (!(we instanceof Error) || we.message !== WORKER_UNAVAILABLE) throw we;
          crumb("upload worker unavailable — main-thread fallback");
          const blob = await upload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/video-reference/blob-upload",
            contentType: ctype,
            multipart: true,
            onUploadProgress: onProg,
          });
          blobUrl = blob.url;
          crumb("upload done (main thread)");
        }
      } catch (e) {
        console.error(tag, "blob upload failed", e);
        crumb("upload FAILED");
        // the canary probe's Photos-placeholder guidance and the stall
        // watchdog's dead-connection guidance must reach the owner
        // verbatim — don't bury them under the generic retry message
        if (e instanceof Error && (e.message === FILE_UNREADABLE || e.message === UPLOAD_STALLED)) throw e;
        throw new Error(
          "The upload didn't finish — check your connection and try again. If the clip is big, trim it to under ~90 seconds first (Gemini only needs the style, not the full runtime)."
        );
      }
      console.log(tag, "blob upload resolved", blobUrl);

      // The upload was the ONLY part that needed this device. From here the
      // SERVER runs the whole pipeline as a background job — one fast call
      // to hand it off, then this loop just peeks at the journal.
      const jobId = newJobId();
      const rec: PendingReel = {
        jobId,
        fileName: "",
        fileUri: "",
        mimeType: file.type || "video/mp4",
        label: label.trim() || file.name,
        source,
        topic:
          source === "reference" && topic
            ? { title: topic.title, angle: topic.angle, facts: topic.deck?.length ? topic.deck : [topic.angle] }
            : null,
        createdAt: Date.now(),
      };
      // pending record BEFORE job-start: even a lost response strands nothing —
      // ⟳ Resume (or the next visit's auto-check) peeks the same jobId
      writePendingReel(rec, workspace);
      setPending(rec);
      setUploadPct(null);
      setStep(1);
      setStage("Handing the clip to Gemini…");
      await phasePost(
        {
          phase: "job-start",
          jobId,
          url: blobUrl,
          contentType: file.type || "video/mp4",
          label: label.trim(),
          source,
          client: workspace,
          ...(rec.topic ? { topic: rec.topic } : {}),
        },
        30000,
        "Couldn't start the analysis — check your connection and try again."
      );
      crumb(`job started: ${jobId.slice(0, 8)}`);
      console.log(tag, "job", jobId);

      await watchJob(rec, tag);

      setFile(null);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      console.log(tag, "done");
    } catch (e) {
      console.error(tag, "analyze() threw", e);
      crumb(`error: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
      setError(e instanceof Error ? e.message : "Something went wrong during the upload — try again.");
    } finally {
      (window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg = false;
      setBusy(false);
      setStage("");
      setStep(0);
      setUploadPct(null);
    }
  };

  /** Link lane — the browser never touches the file. Paste a direct video
      link (Dropbox/Drive share of the clip) and the SERVER fetches it and
      hands it to Gemini. Built because local file handling kept freezing
      the owner's browsers; this path does zero file work in the tab. */
  const [linkUrl, setLinkUrl] = useState("");
  const analyzeFromLink = async () => {
    const url = linkUrl.trim();
    if (!url || busy) return;
    const tag = `[reel-link ${Date.now()}]`;
    setBusy(true);
    setError(null);
    setStep(1);
    setStage("Server is fetching the video from your link…");
    crumb(`link: ${url.slice(0, 60)}`);
    try {
      const jobId = newJobId();
      const rec: PendingReel = {
        jobId,
        fileName: "",
        fileUri: "",
        mimeType: "video/mp4",
        label: label.trim() || url.split("/").pop()?.split("?")[0] || "linked clip",
        source,
        topic:
          source === "reference" && topic
            ? { title: topic.title, angle: topic.angle, facts: topic.deck?.length ? topic.deck : [topic.angle] }
            : null,
        createdAt: Date.now(),
      };
      writePendingReel(rec, workspace);
      setPending(rec);
      await phasePost(
        {
          phase: "job-start",
          jobId,
          remoteUrl: url,
          contentType: "video/mp4",
          label: label.trim(),
          source,
          client: workspace,
          ...(rec.topic ? { topic: rec.topic } : {}),
        },
        30000,
        "Couldn't start the analysis — check your connection and try again."
      );
      crumb(`link job started: ${jobId.slice(0, 8)}`);
      await watchJob(rec, tag);
      setLinkUrl("");
      setLabel("");
    } catch (e) {
      console.error(tag, "link analyze threw", e);
      crumb(`error: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
      setError(e instanceof Error ? e.message : "Couldn't analyze from that link — try again.");
    } finally {
      setBusy(false);
      setStage("");
      setStep(0);
      setUploadPct(null);
    }
  };

  /** Pick an interrupted run back up — no re-upload, no extra Gemini cost. */
  const resumePending = async () => {
    const rec = readPendingReel(workspace);
    if (!rec || busy) return;
    const tag = `[reel-coach resume ${Date.now()}]`;
    setBusy(true);
    setError(null);
    setStage("⟳ Checking on your clip…");
    (window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg = true;
    try {
      // job records resume via the server journal; legacy records (older
      // build) still resume through the client-driven phases
      if (rec.jobId) await watchJob(rec, tag);
      else await pollAndAnalyze(rec, tag);
      console.log(tag, "recovered");
    } catch (e) {
      console.error(tag, "resume threw", e);
      setError(e instanceof Error ? e.message : "Couldn't resume — try again in a minute.");
    } finally {
      (window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg = false;
      setBusy(false);
      setStage("");
      setStep(0);
      setUploadPct(null);
    }
  };

  const remove = async (id: string) => {
    const doomed = list.find((r) => r.id === id);
    await reelVaultDelete(id);
    await clipVaultDeleteForReel(id, workspace); // any legacy local media — no orphans
    // server vault: burn the reel's media (+ its preserved reference)
    const refUrl = typeof doomed?.analysis.referenceUrl === "string" ? doomed.analysis.referenceUrl : "";
    fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "delete", client: workspace, reelId: id, ...(refUrl ? { extraUrls: [refUrl] } : {}) }),
    }).catch(() => {});
    setList(await reelVaultAll());
    if (expanded === id) setExpanded(null);
  };

  /** ONE-TAP FAILURE REPORT — turns "read me the trail over the phone" into
      one tap + one paste. Everything a remote debugger needs to reproduce an
      environment-specific freeze: exact build, device/browser, display mode,
      the full crash-surviving breadcrumb trail, current error, pending state. */
  const [reportCopied, setReportCopied] = useState(false);
  const copyDiagReport = async () => {
    const trail = readCrumbs();
    const pend = readPendingReel(workspace);
    // covers installed-PWA on both platforms: display-mode media query
    // (Android/desktop) and legacy navigator.standalone (iOS Safari)
    let standalone = false;
    try {
      standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
    } catch {}
    const report = [
      "FARMHAND REEL COACH — DIAGNOSTIC REPORT",
      `build: ${BUILD_STAMP}`,
      `when: ${new Date().toISOString()}`,
      `ua: ${navigator.userAgent}`,
      `screen: ${window.screen?.width}x${window.screen?.height} @${window.devicePixelRatio}x · viewport ${window.innerWidth}x${window.innerHeight}`,
      `pwa-standalone: ${standalone ? "yes" : "no"}`,
      `error: ${error || "none"}`,
      pend
        ? `pending: yes — "${pend.label}" · ${Math.max(0, Math.round((Date.now() - pend.createdAt) / 60000))} min old`
        : "pending: none",
      `trail (${trail.length} entries):`,
      ...(trail.length ? trail.map((c) => `  ${c}`) : ["  (empty)"]),
    ].join("\n");
    let ok = false;
    try {
      await navigator.clipboard.writeText(report);
      ok = true;
    } catch {
      // clipboard API blocked — invisible-textarea fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = report;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch {}
    }
    crumb(ok ? "diag report copied" : "diag report copy FAILED");
    if (ok) {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2600);
    } else {
      setError("Couldn't copy the report on this browser — open the trail below and screenshot it instead.");
    }
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
            // pulling the File out of a Photos.app drag can itself throw —
            // the accessor runs before pickFile's own try/catch, so keep it
            // inside the same defensive net
            try {
              pickFile(e.dataTransfer.files?.[0]);
            } catch (err) {
              crumb(`attach FAILED reading dropped file: ${err instanceof Error ? err.message.slice(0, 60) : "unknown"}`);
              setError("That dropped file couldn't be read — save it to Files or your Desktop first, then upload the copy.");
            }
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
              {(file.size > SOFT_WARN_BYTES || file.type === "video/quicktime") && (
                <div style={{ fontSize: 10.5, color: "#FFC23D", marginTop: 5, lineHeight: 1.45, maxWidth: 420, marginInline: "auto" }}>
                  ⚠{" "}
                  {file.size > SOFT_WARN_BYTES && (
                    <>
                      {formatBytes(file.size)} is a big clip — it&apos;ll work, and once the upload finishes you can close the app
                      while the server does the rest. Mac screen recordings are HUGE for their length: in QuickTime use
                      File → Export As → 1080p and the copy is ~8x smaller with zero loss for analysis.{" "}
                    </>
                  )}
                  From the Photos app? iPhone converts the video during picking — if selection seems stuck, that&apos;s iOS
                  working, not the app. Tip: share the clip to Files first and pick it from there, or save it to Dropbox
                  and paste the link below.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#8B89A0" }}>
              Drag a clip here, or click to browse
              <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 3 }}>video files only — .mov, .mp4, up to 1GB</div>
              <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 3 }}>
                on a Mac: drag videos out of the Photos app onto the Desktop first (Photos hands over a placeholder some browsers choke on), then upload from there
              </div>
              <div style={{ fontSize: 10.5, marginTop: 6 }}>
                <a
                  href="/reel-upload"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "#7DD3FC", textDecoration: "none", fontWeight: 700 }}
                >
                  ⚡ Browser keeps freezing? Use the Lite Uploader →
                </a>{" "}
                <span style={{ color: "#5E5C72" }}>a bare page that does nothing but upload — the breakdown still lands here</span>
              </div>
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
        {/* link lane: zero file handling in this tab — the server fetches it */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#41D98A", flexShrink: 0 }}>🔗 Or skip the upload</span>
          <input
            placeholder="paste a Dropbox / Google Drive link to the clip"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            disabled={busy}
            style={{ background: "rgba(0,0,0,0.24)", border: "1px solid rgba(65,217,138,0.3)", borderRadius: 8, padding: "9px 11px", fontSize: 12, color: "#F4F3F8", flex: 1, minWidth: 200 }}
          />
          <button
            onClick={analyzeFromLink}
            disabled={!linkUrl.trim() || busy}
            style={{ background: "rgba(65,217,138,0.14)", color: "#41D98A", border: "1px solid rgba(65,217,138,0.45)", borderRadius: 9, padding: "9px 15px", fontSize: 12, fontWeight: 700, cursor: !linkUrl.trim() || busy ? "default" : "pointer", opacity: !linkUrl.trim() || busy ? 0.6 : 1 }}
          >
            {busy ? "Working…" : "▶ Analyze link"}
          </button>
          <span style={{ fontSize: 10.5, color: "#8B89A0", lineHeight: 1.45, flexBasis: "100%" }}>
            Your browser never touches the file — the server fetches it directly. Share the clip from Dropbox or
            Drive (any link works; we auto-convert to direct download). Best for machines where the upload freezes.
          </span>
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
        {busy && (
          <div style={{ marginTop: 12, textAlign: "left", maxWidth: 460, marginInline: "auto" }}>
            {/* step tracker — the run is a journey, not a stuck timer */}
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              {STEP_LABELS.map((s, i) => (
                <span
                  key={s}
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: i < step ? "rgba(38,224,200,0.14)" : i === step ? "rgba(125,211,252,0.16)" : "rgba(255,255,255,0.05)",
                    color: i < step ? "#26E0C8" : i === step ? "#7DD3FC" : "#5E5C72",
                    border: `1px solid ${i === step ? "rgba(125,211,252,0.45)" : "transparent"}`,
                  }}
                >
                  {i < step ? "✓ " : ""}
                  {s}
                </span>
              ))}
            </div>
            {/* the bar: real % when progress events arrive, moving shimmer
                when they don't — it must NEVER look frozen */}
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", marginTop: 9, overflow: "hidden" }}>
              {uploadPct != null ? (
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    width: `${Math.max(2, Math.min(100, uploadPct))}%`,
                    background: "linear-gradient(90deg, #26E0C8, #7DD3FC)",
                    transition: "width 0.5s ease",
                  }}
                />
              ) : (
                <div className="fh-progress-indet" style={{ height: "100%", borderRadius: 3 }} />
              )}
            </div>
            {stage && (
              <div style={{ fontSize: 11.5, color: "#7DD3FC", marginTop: 7, textAlign: "center" }}>
                {stage}
                {!stage.includes("left") && busyStartRef.current > 0 && (
                  <span style={{ color: "#5E5C72" }}> · {fmtSecs((Date.now() - busyStartRef.current) / 1000)} elapsed</span>
                )}
              </div>
            )}
          </div>
        )}
        {error && <div style={{ fontSize: 11.5, color: "#FF6B6B", marginTop: 10 }}>{error}</div>}

        {/* crash-surviving diagnostics: the build you're ACTUALLY running +
            the last run's breadcrumb trail. If this screen ever freezes,
            reopen it and read this trail back — it shows the exact last step
            that completed before the freeze. */}
        <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
          <div style={{ fontSize: 9.5, color: "#5E5C72", fontFamily: "var(--mono)" }}>
            build {BUILD_STAMP} — if this doesn&apos;t match the latest fix, fully close this tab and reopen the app
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <details style={{ flex: 1, minWidth: 200 }}>
              <summary style={{ fontSize: 10, color: "#77758C", cursor: "pointer" }}>Last run trail (survives crashes — read this back if it freezes)</summary>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "#8B89A0", lineHeight: 1.6, marginTop: 4, whiteSpace: "pre-wrap" }}>
                {readCrumbs().slice(-10).join("\n") || "no runs yet"}
              </div>
            </details>
            {/* one tap → full diagnostic report on the clipboard, ready to paste */}
            <button
              onClick={copyDiagReport}
              style={{
                background: reportCopied ? "rgba(65,217,138,0.12)" : "rgba(125,211,252,0.1)",
                color: reportCopied ? "#41D98A" : "#7DD3FC",
                border: `1px solid ${reportCopied ? "rgba(65,217,138,0.45)" : "rgba(125,211,252,0.35)"}`,
                borderRadius: 7,
                padding: "4px 11px",
                fontSize: 10.5,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {reportCopied ? "Copied ✓ — paste it to Claude" : "📋 Copy report for Claude"}
            </button>
          </div>
        </div>
      </div>

      {pending && !busy && (
        <div
          className="fh-glass"
          style={{ borderRadius: 14, padding: "13px 17px", marginBottom: 20, border: "1px solid rgba(255,194,61,0.35)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <div style={{ fontSize: 12, color: "#D9D7E4", lineHeight: 1.5, flex: 1, minWidth: 220 }}>
            An analysis didn&apos;t finish — <b style={{ color: "#F4F3F8" }}>{pending.label}</b> is already uploaded and waiting at
            Gemini (uploads live ~48h). Resume picks up right where it stopped, no re-upload.
          </div>
          <button
            onClick={resumePending}
            style={{ background: "rgba(255,194,61,0.12)", color: "#FFC23D", border: "1px solid rgba(255,194,61,0.4)", borderRadius: 8, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            ⟳ Resume analysis
          </button>
          <button
            onClick={() => {
              // burn the server journal too — it may hold an orphaned clip
              const rec = readPendingReel(workspace);
              if (rec?.jobId) phasePost({ phase: "job-ack", jobId: rec.jobId, ...jobToken() }, 15000, "").catch(() => {});
              clearPendingReel(workspace);
              setPending(null);
            }}
            style={{ background: "transparent", color: "#8B89A0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}

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
                {!!reel.analysis.remake?.beats?.some((b) => b.genPrompt) && <ClipStudio reel={reel} workspace={workspace} />}
                {reel.source === "reference" && reel.analysis.genome && (
                  <ReAdapt reel={reel} ideas={ideas} onSaved={async () => setList(await reelVaultAll())} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
