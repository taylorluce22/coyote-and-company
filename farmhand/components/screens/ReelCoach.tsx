"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { uploadInWorker, measureUpspeed, FILE_UNREADABLE, UPLOAD_STALLED, WORKER_UNAVAILABLE, type UploadProgress } from "@/lib/reelUploadClient";
import { useStore } from "@/lib/store";
import { ideasFor, type StrategyProfile } from "@/lib/strategy";
import { reelVaultAdd, reelVaultAll, reelVaultDelete, type ReelAnalysis, type VaultReel } from "@/lib/reelVault";

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
              clearPendingReel(workspace);
              setPending(null);
              setList(await reelVaultAll());
              setExpanded(reel.id);
              phasePost({ phase: "job-ack", jobId: rec.jobId }, 15000, "").catch(() => {});
              crumb("auto-banked a finished analysis ✓");
            }
          }
        } catch {
        } finally {
          autoBankRef.current = false;
        }
      })();
    }
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
      150000,
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
    clearPendingReel(workspace);
    setPending(null);
    setList(await reelVaultAll());
    setExpanded(reel.id);
    if (rec.jobId) phasePost({ phase: "job-ack", jobId: rec.jobId }, 15000, "").catch(() => {});
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
        phasePost({ phase: "job-ack", jobId }, 15000, "").catch(() => {});
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
    await reelVaultDelete(id);
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
              if (rec?.jobId) phasePost({ phase: "job-ack", jobId: rec.jobId }, 15000, "").catch(() => {});
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
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
