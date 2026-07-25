"use client";

/**
 * LITE UPLOADER — a deliberately bare page for the one job that keeps
 * freezing the owner's browsers inside the full app: getting a big clip
 * off the device. It shares NOTHING with the main app at runtime — no
 * store, no three.js scene, no GSAP, no app shell — just this component,
 * the upload worker, and a few small pure helpers. The upload itself runs
 * in a Web Worker, so this tab's main thread is essentially idle.
 *
 * It cooperates with the main app through the SAME localStorage records
 * Reel Coach uses (fh-reel-pending::<client>, shared jobId) and the same
 * IndexedDB vault — so a breakdown finished here shows up in Farmhand →
 * Content → Reel Coach automatically, and vice versa: a run started here
 * can be picked up in the app later.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { uploadInWorker, probeFileReadable, measureUpspeed, UPLOAD_STALLED, WORKER_UNAVAILABLE, type UploadProgress } from "@/lib/reelUploadClient";
import { ideasFor, DEFAULT_STRATEGY, type StrategyProfile } from "@/lib/strategy";
import { reelVaultAdd, type ReelAnalysis, type VaultReel } from "@/lib/reelVault";

const MAX_FILE_BYTES = 1024 * 1024 * 1024;
const STEP_LABELS = ["Upload", "Hand-off", "Gemini processing", "Writing breakdown"];

/* ---- the same client-cooperation keys Reel Coach uses ---- */
type PendingReel = {
  jobId?: string;
  fileName: string;
  fileUri: string;
  mimeType: string;
  label: string;
  source: "own" | "reference";
  topic: { title: string; angle: string; facts: string[] } | null;
  createdAt: number;
};
const pendingReelKey = (client: string) => (client === "default" ? "fh-reel-pending" : `fh-reel-pending::${client}`);
const readPending = (client: string): PendingReel | null => {
  try {
    const p = JSON.parse(localStorage.getItem(pendingReelKey(client)) || "null") as PendingReel | null;
    return p && (p.jobId || (p.fileName && p.fileUri)) && p.createdAt > Date.now() - 40 * 3600000 ? p : null;
  } catch {
    return null;
  }
};
const writePending = (rec: PendingReel, client: string) => {
  try {
    localStorage.setItem(pendingReelKey(client), JSON.stringify(rec));
  } catch {}
};
const clearPending = (client: string) => {
  try {
    localStorage.removeItem(pendingReelKey(client));
  } catch {}
};
const crumb = (msg: string) => {
  try {
    const list = JSON.parse(localStorage.getItem("fh-reel-crumbs") || "[]") as string[];
    list.push(`${new Date().toISOString().slice(11, 19)} [lite] ${msg}`);
    localStorage.setItem("fh-reel-crumbs", JSON.stringify(list.slice(-25)));
  } catch {}
};
const readStrategy = (client: string): StrategyProfile => {
  try {
    const key = client === "default" ? "farmhand-studio-v1" : `farmhand-studio-v1::${client}`;
    const st = JSON.parse(localStorage.getItem(key) || "null") as { strategy?: StrategyProfile } | null;
    if (st?.strategy) return st.strategy;
  } catch {}
  return DEFAULT_STRATEGY;
};

/* same dedupe set Reel Coach maintains — a banked job must never re-import */
const BANKED_KEY = "fh-reel-banked-jobs";
const markBanked = (id: string) => {
  try {
    const list = JSON.parse(localStorage.getItem(BANKED_KEY) || "[]") as string[];
    localStorage.setItem(BANKED_KEY, JSON.stringify([...list, id].slice(-100)));
  } catch {}
};
/** Optional shared secret for the destructive job phases (see Reel Coach). */
const jobToken = () => (process.env.NEXT_PUBLIC_REEL_JOB_TOKEN ? { token: process.env.NEXT_PUBLIC_REEL_JOB_TOKEN } : {});

const newJobId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
};

async function jobPost(body: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
  const r = await fetch("/api/video-reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = (await r.json()) as Record<string, unknown>;
  if (j.configured === false) throw new Error("The app's Gemini key isn't set up — open the main app's Connectors screen.");
  if (typeof j.error === "string" && j.error) throw new Error(j.error);
  return j;
}

const fmtSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.max(1, Math.round(s))}s`);
const fmtBytes = (n: number) =>
  n < 1024 * 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;

export default function ReelUploadLite() {
  const [workspace, setWorkspace] = useState("default");
  const [strategy, setStrategy] = useState<StrategyProfile>(DEFAULT_STRATEGY);
  const [file, setFile] = useState<File | null>(null);
  // name/size/type captured ONCE at attach time, inside a defensive try —
  // render and start() never re-read metadata off the File object (with
  // Photos-library placeholders even .name/.size can block or throw)
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; type: string } | null>(null);
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<"own" | "reference">("reference");
  const [topicId, setTopicId] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReel | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ideas = useMemo(() => ideasFor(strategy), [strategy]);
  const topic = ideas.find((i) => i.id === topicId) || null;

  useEffect(() => {
    const ws = localStorage.getItem("farmhand-ws-active") || "default";
    setWorkspace(ws);
    setStrategy(readStrategy(ws));
    setPending(readPending(ws));
    crumb("lite uploader open");
  }, []);

  // keep the screen awake while a run is live — auto-lock mid-upload is
  // the same silent killer here as in the app
  useEffect(() => {
    if (!busy) return;
    type WakeNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    const grab = async () => {
      try {
        const wl = await (navigator as WakeNav).wakeLock?.request("screen");
        if (gone) wl?.release().catch(() => {});
        else lock = wl || null;
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
      lock?.release().catch(() => {});
    };
  }, [busy]);

  /** Same server-driven watch loop as Reel Coach, compact form. */
  const watch = async (rec: PendingReel) => {
    const jobId = rec.jobId;
    if (!jobId) throw new Error("no job id");
    const t0 = Date.now();
    let analyzingSince = 0;
    let lastKick = 0;
    let errorKicks = 0;
    const kick = async (why: string, minGapMs: number) => {
      if (Date.now() - lastKick < minGapMs) return;
      lastKick = Date.now();
      crumb(why);
      try {
        await jobPost({ phase: "job-continue", jobId }, 25000);
        analyzingSince = Date.now();
      } catch {}
    };
    for (;;) {
      let j: Record<string, unknown> = {};
      try {
        j = await jobPost({ phase: "job-status", jobId }, 20000);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Gemini key")) throw e;
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const js = String(j.jobState || "");
      if (js === "done") {
        if (!readPending(workspace)) return; // the main app banked it first
        if (!j.analysis) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        const reel: VaultReel = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: rec.label,
          source: rec.source,
          analysis: j.analysis as ReelAnalysis,
          createdAt: Date.now(),
        };
        const saved = await reelVaultAdd(reel, workspace);
        if (!saved) throw new Error("The analysis finished but couldn't be saved on this device — open the main app and hit ⟳ Resume analysis.");
        markBanked(jobId);
        clearPending(workspace);
        setPending(null);
        jobPost({ phase: "job-ack", jobId, ...jobToken() }, 15000).catch(() => {});
        crumb("done ✓ (lite) analysis in the vault");
        return;
      }
      if (js === "error") {
        const msg = String(j.jobError || "The analysis failed — try again.");
        if (j.retryable === true && errorKicks < 2) {
          errorKicks += 1;
          setStage("That try failed — giving it another shot…");
          await kick("lite: retryable error — re-kicking", 30000);
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        if (j.retryable !== true) {
          clearPending(workspace);
          setPending(null);
          jobPost({ phase: "job-ack", jobId, ...jobToken() }, 15000).catch(() => {});
        }
        throw new Error(msg);
      }
      if (js === "received" || js === "none") {
        setStep(1);
        setStage("Handing the clip to Gemini… (the server does this part)");
        if (Date.now() - t0 > 75000) await kick("lite: hand-off stalled — re-kicking", 3 * 60000);
        if (Date.now() - t0 > 10 * 60000) throw new Error("The hand-off is taking too long — try Check on it again in a minute.");
      } else if (js === "processing") {
        setStep(2);
        setStage("Gemini is processing the clip… ✅ safe to close this page — check back in a few minutes");
        if (String(j.geminiState || "") === "ACTIVE") await kick("lite: kicking analysis", 3 * 60000);
        if (Date.now() - t0 > 30 * 60000) throw new Error("Gemini is taking unusually long — your upload is safe; come back later and hit Check on it.");
      } else if (js === "analyzing") {
        setStep(3);
        setStage("Gemini is watching the clip and writing your breakdown… (usually 1–2 minutes)");
        if (!analyzingSince) analyzingSince = Date.now();
        if (Date.now() - analyzingSince > 3 * 60000) await kick("lite: analysis stalled — re-kicking", 3 * 60000);
      }
      await new Promise((r) => setTimeout(r, 4500));
    }
  };

  const start = async () => {
    if (!file || !fileMeta || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setStep(0);
    setUploadPct(null);
    setStage("Checking your connection speed…");
    crumb(`lite: starting (${fmtBytes(fileMeta.size)})`);
    try {
      // preflight: measure the pipe before committing a big clip to it —
      // a dead connection fails HERE in seconds, not silently 10 min in
      const bps = await measureUpspeed();
      if (bps === 0) {
        crumb("lite upspeed: dead/blocked");
        throw new Error(UPLOAD_STALLED);
      }
      if (bps && fileMeta.size > 0) {
        const mbps = (bps * 8) / 1e6;
        const est = (fileMeta.size / bps) * 1.15;
        crumb(`lite upspeed: ~${mbps.toFixed(1)} Mbps · est ${fmtSecs(est)}`);
        setStage(`Uploading clip… (≈${mbps.toFixed(1)} Mbps up — expect about ${fmtSecs(est)}${est > 300 ? "; a Dropbox link in the main app would be much faster" : ""})`);
      } else {
        setStage("Uploading clip…");
      }
      const t0 = Date.now();
      let lastProg = 0;
      const onProg = ({ loaded, total, percentage }: UploadProgress) => {
        const now = Date.now();
        if (now - lastProg < 250 && percentage < 99) return;
        lastProg = now;
        const elapsed = Math.max(0.5, (now - t0) / 1000);
        const remain = loaded > 0 && total > loaded ? (total - loaded) / (loaded / elapsed) : 0;
        setUploadPct(percentage);
        setStage(`Uploading… ${Math.round(percentage)}%${remain > 1 ? ` · about ${fmtSecs(remain)} left` : ""}`);
      };
      const pathname = `reels/${Date.now()}-${fileMeta.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const ctype = fileMeta.type || "video/mp4";
      let blobUrl = "";
      try {
        // uploadInWorker runs a 64KB canary read first (fails fast with
        // Photos-placeholder guidance instead of wedging the tab), then
        // hands the File to the worker
        blobUrl = await uploadInWorker(file, pathname, ctype, onProg);
        crumb("lite: upload done (worker)");
      } catch (we) {
        if (!(we instanceof Error) || we.message !== WORKER_UNAVAILABLE) throw we;
        crumb("lite: worker unavailable — main-thread fallback");
        // the worker never ran, so the canary probe hasn't either — probe
        // before letting the blob SDK read the whole File on the main thread
        await probeFileReadable(file);
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/video-reference/blob-upload",
          contentType: ctype,
          multipart: true,
          onUploadProgress: onProg,
        });
        blobUrl = blob.url;
      }

      const jobId = newJobId();
      const rec: PendingReel = {
        jobId,
        fileName: "",
        fileUri: "",
        mimeType: ctype,
        label: label.trim() || fileMeta.name,
        source,
        topic:
          source === "reference" && topic
            ? { title: topic.title, angle: topic.angle, facts: topic.deck?.length ? topic.deck : [topic.angle] }
            : null,
        createdAt: Date.now(),
      };
      writePending(rec, workspace);
      setPending(rec);
      setUploadPct(null);
      setStep(1);
      setStage("Handing the clip to Gemini…");
      await jobPost(
        {
          phase: "job-start",
          jobId,
          url: blobUrl,
          contentType: ctype,
          client: workspace,
          label: label.trim(),
          source,
          ...(rec.topic ? { topic: rec.topic } : {}),
        },
        30000
      );
      crumb(`lite: job started ${jobId.slice(0, 8)}`);
      await watch(rec);
      setDone(rec.label);
      setFile(null);
      setFileMeta(null);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      crumb(`lite error: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
      setStage("");
      setStep(0);
      setUploadPct(null);
    }
  };

  const checkPending = async () => {
    const rec = readPending(workspace);
    if (!rec?.jobId || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setStage("⟳ Checking on your clip…");
    try {
      await watch(rec);
      setDone(rec.label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check — try again in a minute.");
    } finally {
      setBusy(false);
      setStage("");
      setStep(0);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "11px 12px",
    fontSize: 13,
    color: "#F4F3F8",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0A12", color: "#F4F3F8", display: "flex", justifyContent: "center", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #26E0C8, #7DD3FC)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#0B0A12" }}>
            F
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>Lite Uploader</div>
            <div style={{ fontSize: 10.5, color: "#6E6C82" }}>nothing else runs on this page — built for big clips</div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "#8B89A0", lineHeight: 1.5, marginBottom: 16 }}>
          Upload here, and the breakdown appears in Farmhand → Content → Reel Coach on its own. Once it says the server
          has the clip, you can close this page completely.
        </div>

        {pending?.jobId && !busy && !done && (
          <div style={{ background: "rgba(125,211,252,0.08)", border: "1px solid rgba(125,211,252,0.25)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#7DD3FC" }}>A run is already going: “{pending.label}”</div>
            <div style={{ fontSize: 11, color: "#8B89A0", marginTop: 3 }}>
              started {Math.max(1, Math.round((Date.now() - pending.createdAt) / 60000))} min ago — the server may already be done
            </div>
            <button
              onClick={checkPending}
              style={{ marginTop: 10, background: "#7DD3FC", color: "#0B0A12", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              ⟳ Check on it
            </button>
          </div>
        )}

        {done && (
          <div style={{ background: "rgba(38,224,200,0.08)", border: "1px solid rgba(38,224,200,0.3)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#26E0C8" }}>✓ Breakdown saved</div>
            <div style={{ fontSize: 11.5, color: "#A6A4B8", marginTop: 4, lineHeight: 1.5 }}>
              “{done}” is analyzed. Open Farmhand → Content → Reel Coach to read the coaching breakdown
              {source === "reference" ? " and your shot-for-shot remake script" : ""}.
            </div>
          </div>
        )}

        <div
          onClick={() => !busy && fileRef.current?.click()}
          style={{
            border: `1.5px dashed ${file ? "rgba(38,224,200,0.5)" : "rgba(255,255,255,0.18)"}`,
            borderRadius: 14,
            padding: "26px 14px",
            textAlign: "center",
            cursor: busy ? "default" : "pointer",
            background: file ? "rgba(38,224,200,0.05)" : "rgba(255,255,255,0.02)",
            marginBottom: 12,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            disabled={busy}
            style={{ display: "none" }}
            onChange={(e) => {
              // DEFENSIVE WRAPPER (same as ReelCoach.pickFile): with
              // promise-backed files picked out of the Photos library, even
              // reading name/size/type can block or throw — that must never
              // escape and wedge the tab. Crumb before/after so a freeze
              // here is visible in the trail afterwards.
              try {
                const f = e.target.files?.[0] || null;
                if (!f) {
                  crumb("lite attach: none");
                  setFile(null);
                  setFileMeta(null);
                  return;
                }
                crumb("lite attach: reading file metadata");
                const meta = { name: f.name, size: f.size, type: f.type };
                crumb(`lite attach: ${meta.name} · ${fmtBytes(meta.size)} · ${meta.type || "no-type"}`);
                if (meta.size > MAX_FILE_BYTES) {
                  crumb("lite attach rejected: over 1GB cap");
                  setError(`"${meta.name}" is ${fmtBytes(meta.size)} — over the 1GB cap. Trim or compress it first.`);
                  return;
                }
                setError(null);
                setDone(null);
                setFile(f);
                setFileMeta(meta);
                crumb("lite attach ok — Start enabled");
              } catch (err) {
                crumb(`lite attach FAILED reading file metadata: ${err instanceof Error ? err.message.slice(0, 60) : "unknown"}`);
                setFile(null);
                setFileMeta(null);
                if (fileRef.current) fileRef.current.value = "";
                setError(
                  "That video couldn't be read — it's probably still living in the Photos library. Save it to Files (or your Desktop/Dropbox) first, then pick that copy here."
                );
              }
            }}
          />
          {file && fileMeta ? (
            <div style={{ fontSize: 12.5 }}>
              <strong>{fileMeta.name}</strong> <span style={{ color: "#6E6C82" }}>({fmtBytes(fileMeta.size)})</span>
              <div style={{ fontSize: 11, color: "#7DD3FC", marginTop: 4 }}>ready — tap Start below</div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#8B89A0" }}>
              Tap to pick a video
              <div style={{ fontSize: 10.5, color: "#5E5C72", marginTop: 3 }}>.mov / .mp4 · up to 1GB</div>
            </div>
          )}
        </div>

        <input type="text" placeholder="Label (optional) — e.g. competitor hook reel" value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["own", "reference"] as const).map((s) => (
            <button
              key={s}
              onClick={() => !busy && setSource(s)}
              style={{
                flex: 1,
                background: source === s ? "rgba(125,211,252,0.15)" : "rgba(255,255,255,0.04)",
                color: source === s ? "#7DD3FC" : "#8B89A0",
                border: `1px solid ${source === s ? "rgba(125,211,252,0.45)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10,
                padding: "10px 8px",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {s === "own" ? "My content" : "Reference / competitor"}
            </button>
          ))}
        </div>

        {source === "reference" && (
          <select value={topicId} disabled={busy} onChange={(e) => setTopicId(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
            <option value="">Style match topic (optional) — remake script in this reel’s style</option>
            {ideas.slice(0, 30).map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={start}
          disabled={!file || busy}
          style={{
            width: "100%",
            background: !file || busy ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #26E0C8, #7DD3FC)",
            color: !file || busy ? "#6E6C82" : "#0B0A12",
            border: "none",
            borderRadius: 12,
            padding: "13px",
            fontSize: 14,
            fontWeight: 800,
            cursor: !file || busy ? "default" : "pointer",
          }}
        >
          {busy ? "Working…" : "▶ Start"}
        </button>

        {busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
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
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", marginTop: 9, overflow: "hidden" }}>
              {uploadPct != null ? (
                <div style={{ height: "100%", borderRadius: 3, width: `${Math.max(2, Math.min(100, uploadPct))}%`, background: "linear-gradient(90deg, #26E0C8, #7DD3FC)", transition: "width 0.5s ease" }} />
              ) : (
                <div className="fh-progress-indet" style={{ height: "100%", borderRadius: 3 }} />
              )}
            </div>
            {stage && <div style={{ fontSize: 11.5, color: "#7DD3FC", marginTop: 7, textAlign: "center" }}>{stage}</div>}
          </div>
        )}

        {error && <div style={{ fontSize: 11.5, color: "#FF6B6B", marginTop: 12, lineHeight: 1.5 }}>{error}</div>}

        <a href="/" style={{ display: "block", textAlign: "center", fontSize: 11, color: "#5E5C72", marginTop: 22, textDecoration: "none" }}>
          ← back to Farmhand
        </a>
      </div>
    </div>
  );
}
