/**
 * Reel assembly — Phase 2 of the reel pipeline, per
 * docs/reel-assembly-spec-2026.md: stitch the per-beat Higgsfield clips,
 * lay the per-beat ElevenLabs narration on the audio track, burn in each
 * beat's on-screen text, optionally mix a low music bed → one 9:16 draft
 * MP4 (720×1280, 30fps).
 *
 * ARCHITECTURE (v2 — the first cut froze the tab): everything ffmpeg runs
 * inside OUR OWN dedicated Web Worker, created from an inline blob so the
 * bundler can never mangle it. The worker importScripts the ffmpeg.wasm
 * UMD wrapper (fetched on the main thread → blob URLs, so no cross-origin
 * importScripts games), which runs the single-thread core in ITS nested
 * worker — the main thread only renders caption PNGs and marshals bytes,
 * and the tab stays responsive for the whole encode. No SharedArrayBuffer
 * / COOP-COEP requirements.
 *
 * Progress is real (ffmpeg progress/log events forwarded from the worker),
 * and a hard 4-minute timeout kills the worker and surfaces the last
 * ffmpeg log line — a hang is visible, never infinite.
 *
 * Encode budget: each beat is decoded ONCE (normalize to 720×1280 +
 * caption overlay + VO mux in a single filter_complex pass, x264
 * ultrafast CRF 23), the concat is stream-copy, and the optional music
 * mux copies video. Captions are canvas-rendered transparent PNGs —
 * ffmpeg.wasm ships no fonts, canvas gets the app's real fonts + exact
 * DESERT GRID styling.
 */

export interface AssemblyBeat {
  clip: Blob;
  /** narration segment (mp3) — absent = silent beat */
  vo?: Blob;
  /** burned caption text — absent/empty/"none" = no caption this beat */
  caption?: string;
  /** visible seconds for this beat (caller decides: script vs VO length) */
  duration: number;
}

export interface AssemblyOptions {
  /** optional music bed, mixed low under the narration */
  music?: Blob;
  onProgress?: (stage: string, pct: number) => void;
}

/* pinned engine versions — wrapper minor must match its worker chunk */
const FFMPEG_VER = "0.12.15";
const CORE_VER = "0.12.10";
const ASSETS = {
  ffmpegJs: `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VER}/dist/umd/ffmpeg.js`,
  classWorkerJs: `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VER}/dist/umd/814.ffmpeg.js`,
  coreJs: `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/umd/ffmpeg-core.js`,
  wasm: `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/umd/ffmpeg-core.wasm`,
};

const HARD_TIMEOUT_MS = 4 * 60000;

/* engine assets → same-origin blob URLs, fetched once per session */
let assetUrls: { ffmpegJs: string; classWorkerJs: string; coreJs: string; wasm: string } | null = null;
async function loadAssets(onProgress?: (stage: string, pct: number) => void) {
  if (assetUrls) return assetUrls;
  onProgress?.("downloading the video engine (~31MB, first time only)", 2);
  const grab = async (url: string, type: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`couldn't download the video engine (${r.status}) — check the connection and retry`);
    return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
  };
  const [ffmpegJs, classWorkerJs, coreJs, wasm] = await Promise.all([
    grab(ASSETS.ffmpegJs, "text/javascript"),
    grab(ASSETS.classWorkerJs, "text/javascript"),
    grab(ASSETS.coreJs, "text/javascript"),
    grab(ASSETS.wasm, "application/wasm"),
  ]);
  assetUrls = { ffmpegJs, classWorkerJs, coreJs, wasm };
  return assetUrls;
}

/* The whole ffmpeg pipeline, as a classic worker. NO template literals or
   ${} inside — this string must survive being a string. */
const WORKER_SRC = `
self.onmessage = async function (e) {
  var msg = e.data;
  var lastLog = "";
  var post = function (type, payload) { self.postMessage(Object.assign({ type: type }, payload)); };
  try {
    importScripts(msg.urls.ffmpegJs);
    var ff = new self.FFmpegWASM.FFmpeg();
    var stage = { label: "starting", base: 0, span: 0 };
    var logTick = 0;
    ff.on("log", function (ev) {
      lastLog = String(ev.message || "");
      var now = Date.now();
      if (now - logTick > 700) { logTick = now; post("log", { line: lastLog }); }
    });
    ff.on("progress", function (ev) {
      var p = Number(ev.progress);
      if (!(p >= 0)) p = 0;
      if (p > 1) p = 1;
      post("progress", { stage: stage.label, pct: Math.min(99, Math.round(stage.base + p * stage.span)) });
    });
    post("progress", { stage: "starting the encoder", pct: 4 });
    await ff.load({ coreURL: msg.urls.coreJs, wasmURL: msg.urls.wasm, classWorkerURL: msg.urls.classWorkerJs });

    var beats = msg.beats;
    var n = beats.length;
    var segs = [];
    for (var i = 0; i < n; i++) {
      var b = beats[i];
      var D = Math.max(1.5, Math.min(12, Number(b.duration) || 5)).toFixed(2);
      stage = { label: "encoding beat " + (i + 1) + " of " + n, base: 6 + (i / n) * 64, span: 64 / n };
      post("progress", { stage: stage.label, pct: Math.round(stage.base) });
      var clipName = "c" + i + ".mp4";
      await ff.writeFile(clipName, new Uint8Array(b.clip));
      var args = ["-i", clipName];
      var capIdx = -1;
      if (b.cap) {
        await ff.writeFile("t" + i + ".png", new Uint8Array(b.cap));
        args.push("-i", "t" + i + ".png");
        capIdx = 1;
      }
      var voIdx;
      if (b.vo) {
        await ff.writeFile("a" + i + ".mp3", new Uint8Array(b.vo));
        args.push("-i", "a" + i + ".mp3");
        voIdx = capIdx === 1 ? 2 : 1;
      } else {
        args.push("-f", "lavfi", "-t", D, "-i", "anullsrc=r=44100:cl=stereo");
        voIdx = capIdx === 1 ? 2 : 1;
      }
      var base = "[0:v]trim=duration=" + D + ",setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30";
      var fc = capIdx === 1 ? base + "[bv];[bv][" + capIdx + ":v]overlay=0:0[v]" : base + "[v]";
      if (b.vo) fc += ";[" + voIdx + ":a]apad[a]";
      var seg = "seg" + i + ".mp4";
      await ff.exec(
        args.concat([
          "-filter_complex", fc,
          "-map", "[v]",
          "-map", b.vo ? "[a]" : voIdx + ":a",
          "-t", D,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "23",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          "-ar", "44100",
          seg,
        ])
      );
      segs.push("file '" + seg + "'");
      await ff.deleteFile(clipName);
      if (b.cap) await ff.deleteFile("t" + i + ".png");
      if (b.vo) await ff.deleteFile("a" + i + ".mp3");
    }

    stage = { label: "stitching the beats", base: 74, span: 8 };
    post("progress", { stage: stage.label, pct: 74 });
    await ff.writeFile("list.txt", new TextEncoder().encode(segs.join("\\n")));
    await ff.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "draft.mp4"]);

    var outName = "draft.mp4";
    if (msg.music) {
      stage = { label: "mixing the music bed", base: 84, span: 10 };
      post("progress", { stage: stage.label, pct: 84 });
      await ff.writeFile("music.bin", new Uint8Array(msg.music));
      await ff.exec([
        "-i", "draft.mp4",
        "-stream_loop", "-1",
        "-i", "music.bin",
        "-filter_complex", "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]",
        "-map", "0:v",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "final.mp4",
      ]);
      outName = "final.mp4";
    }

    post("progress", { stage: "finishing", pct: 97 });
    var out = await ff.readFile(outName);
    if (!out || !out.byteLength || out.byteLength < 50000) throw new Error("the draft came out empty");
    var buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    self.postMessage({ type: "done", data: buf }, [buf]);
  } catch (err) {
    post("error", { message: String((err && err.message) || err), lastLog: lastLog });
  }
};
`;

/** DESERT GRID caption card → transparent 720×1280 PNG. Bold sans in PAPER
    on a NIGHT pill, centered, pinned inside the 380–1420/1920 safe band
    (scaled: y ≤ 947). ≤6 words per the reel spec — the wrap is a guardrail. */
async function captionPng(text: string): Promise<Blob | null> {
  try {
    const W = 720;
    const H = 1280;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, W, H);
    ctx.font = "700 44px 'Inter Tight', Geist, -apple-system, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = text.trim().split(/\s+/).slice(0, 10);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const probe = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(probe).width > 620 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = probe;
    }
    if (cur) lines.push(cur);
    const lineH = 58;
    const padX = 26;
    const padY = 16;
    const blockH = lines.length * lineH + padY * 2;
    const bottomY = 900;
    const topY = bottomY - blockH;
    lines.forEach((ln, i) => {
      const w = ctx.measureText(ln).width;
      const y = topY + padY + i * lineH + lineH / 2;
      const pillW = w + padX * 2;
      const pillH = lineH - 6;
      ctx.fillStyle = "rgba(16,24,32,0.74)";
      const x = W / 2 - pillW / 2;
      const py = y - pillH / 2;
      const r = 12;
      ctx.beginPath();
      ctx.moveTo(x + r, py);
      ctx.arcTo(x + pillW, py, x + pillW, py + pillH, r);
      ctx.arcTo(x + pillW, py + pillH, x, py + pillH, r);
      ctx.arcTo(x, py + pillH, x, py, r);
      ctx.arcTo(x, py, x + pillW, py, r);
      ctx.fill();
      ctx.fillStyle = "#F4F0E6";
      ctx.fillText(ln, W / 2, y + 1);
    });
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  } catch {
    return null;
  }
}

/** Stitch beats → draft MP4 blob. Non-blocking (dedicated worker), real
    progress, hard 4-minute timeout that reports the last ffmpeg log line. */
export async function assembleReel(beats: AssemblyBeat[], opts: AssemblyOptions = {}): Promise<Blob> {
  if (!beats.length) throw new Error("nothing to assemble");
  const prog = opts.onProgress;

  // main-thread prep: caption PNGs (needs the DOM's fonts) + input bytes
  prog?.("preparing captions", 1);
  const payloadBeats = await Promise.all(
    beats.map(async (b) => {
      const wantCap = b.caption && b.caption.trim() && b.caption.trim().toLowerCase() !== "none";
      const cap = wantCap ? await captionPng(b.caption as string) : null;
      return {
        clip: await b.clip.arrayBuffer(),
        vo: b.vo ? await b.vo.arrayBuffer() : null,
        cap: cap ? await cap.arrayBuffer() : null,
        duration: b.duration,
      };
    })
  );
  const music = opts.music ? await opts.music.arrayBuffer() : null;
  const urls = await loadAssets(prog);

  const worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
  let lastLog = "";
  try {
    const result = await new Promise<ArrayBuffer>((resolve, reject) => {
      const killer = setTimeout(() => {
        reject(new Error(`assembly hit the 4-minute limit — last engine line: "${lastLog.slice(0, 160) || "(none)"}". Close other tabs and try again.`));
      }, HARD_TIMEOUT_MS);
      worker.onerror = (e) => {
        clearTimeout(killer);
        reject(new Error(`the video engine crashed: ${e.message || "worker error"}`));
      };
      worker.onmessage = (e) => {
        const m = e.data as { type: string; stage?: string; pct?: number; line?: string; message?: string; lastLog?: string; data?: ArrayBuffer };
        if (m.type === "log") lastLog = m.line || lastLog;
        else if (m.type === "progress") prog?.(m.stage || "working", m.pct || 0);
        else if (m.type === "done" && m.data) {
          clearTimeout(killer);
          resolve(m.data);
        } else if (m.type === "error") {
          clearTimeout(killer);
          reject(new Error(`${m.message || "assembly failed"}${m.lastLog ? ` — last engine line: "${m.lastLog.slice(0, 160)}"` : ""}`));
        }
      };
      const transfers = [
        ...payloadBeats.flatMap((b) => [b.clip, ...(b.vo ? [b.vo] : []), ...(b.cap ? [b.cap] : [])]),
        ...(music ? [music] : []),
      ];
      worker.postMessage({ beats: payloadBeats, music, urls }, transfers);
    });
    prog?.("done", 100);
    return new Blob([result], { type: "video/mp4" });
  } finally {
    worker.terminate();
  }
}
