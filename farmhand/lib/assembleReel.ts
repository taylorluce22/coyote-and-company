/**
 * Reel assembly — Phase 2 of the reel pipeline, per
 * docs/reel-assembly-spec-2026.md: stitch the per-beat Higgsfield clips,
 * lay the per-beat ElevenLabs narration on the audio track, burn in each
 * beat's on-screen text, optionally mix a low music bed → one 9:16 draft
 * MP4 (720×1280, 30fps).
 *
 * ARCHITECTURE (v3): NO wrapper library. v1 froze the tab because the
 * bundler broke @ffmpeg/ffmpeg's internal worker; v2 still froze because
 * the wrapper's nested-worker spawn is unverifiable black-box machinery.
 * Now OUR worker drives ffmpeg-core DIRECTLY — importScripts(core js) and
 * synchronous core.exec() in the same dedicated worker thread, exactly
 * what @ffmpeg/ffmpeg's own worker.js does internally. There is no code
 * path by which the encode can land on the main thread: the core only
 * exists inside the worker. Single-thread core → no SharedArrayBuffer /
 * COOP-COEP requirements.
 *
 * Liveness guarantees (from the live-test feedback):
 * - engine log lines stream out via postMessage (postMessage works from
 *   inside the wasm's synchronous callbacks) — the UI can show the last
 *   engine line at all times
 * - real per-exec progress via the core's progress hook
 * - PRIMARY timeout is per-exec INSIDE the worker (core.setTimeout abort)
 *   — it fires even though the worker thread is busy in wasm; the
 *   main-thread 5-minute terminate is only a backstop
 *
 * Encode: each beat is decoded once (normalize to 720×1280 + caption
 * overlay + VO mux in one filter_complex pass, x264 ultrafast CRF 23),
 * concat is stream-copy, music mux copies video. Captions are canvas
 * PNGs rendered on the main thread (the app's real fonts + DESERT GRID
 * styling) and passed in as bytes.
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
  /** raw engine output, throttled — surface the latest line in the UI */
  onLog?: (line: string) => void;
}

/* pinned single-thread core */
const CORE_VER = "0.12.10";
const CORE_JS_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/umd/ffmpeg-core.js`;
const CORE_WASM_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/umd/ffmpeg-core.wasm`;

/** main-thread backstop only — the worker's per-exec timeouts are primary */
const MAIN_BACKSTOP_MS = 5 * 60000;

let assetUrls: { coreJs: string; wasm: string } | null = null;
async function loadAssets(onProgress?: (stage: string, pct: number) => void) {
  if (assetUrls) return assetUrls;
  onProgress?.("downloading the video engine (~31MB, first time only)", 2);
  const grab = async (url: string, type: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`couldn't download the video engine (${r.status}) — check the connection and retry`);
    return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
  };
  const [coreJs, wasm] = await Promise.all([grab(CORE_JS_URL, "text/javascript"), grab(CORE_WASM_URL, "application/wasm")]);
  assetUrls = { coreJs, wasm };
  return assetUrls;
}

/* The whole pipeline against ffmpeg-core, as a classic worker. NO template
   literals or ${} inside — this string must survive being a string. */
const WORKER_SRC = `
self.onmessage = async function (e) {
  var msg = e.data;
  var lastLog = "";
  var post = function (type, payload) { self.postMessage(Object.assign({ type: type }, payload)); };
  try {
    post("progress", { stage: "starting the encoder", pct: 4 });
    importScripts(msg.urls.coreJs);
    if (typeof self.createFFmpegCore !== "function") throw new Error("engine script loaded but createFFmpegCore is missing");
    var core = await self.createFFmpegCore({
      mainScriptUrlOrBlob: msg.urls.coreJs + "#" + btoa(JSON.stringify({ wasmURL: msg.urls.wasm }))
    });
    var logTick = 0;
    if (core.setLogger) core.setLogger(function (l) {
      lastLog = String((l && l.message) || "");
      var now = Date.now();
      if (now - logTick > 600) { logTick = now; post("log", { line: lastLog }); }
    });
    var stage = { label: "starting", base: 4, span: 0 };
    if (core.setProgress) core.setProgress(function (p) {
      var r = p && typeof p.progress === "number" ? p.progress : 0;
      if (!(r >= 0)) r = 0;
      if (r > 1) r = 1;
      post("progress", { stage: stage.label, pct: Math.min(99, Math.round(stage.base + r * stage.span)) });
    });
    var run = function (args, timeoutMs, what) {
      if (core.setTimeout) core.setTimeout(timeoutMs);
      core.exec.apply(core, args);
      var ret = core.ret;
      if (core.reset) core.reset();
      if (ret !== 0) throw new Error(what + " failed (ffmpeg exit " + ret + ")");
    };

    var beats = msg.beats;
    var n = beats.length;
    var segs = [];
    for (var i = 0; i < n; i++) {
      var b = beats[i];
      var D = Math.max(1.5, Math.min(12, Number(b.duration) || 5)).toFixed(2);
      stage = { label: "encoding beat " + (i + 1) + " of " + n, base: 6 + (i / n) * 66, span: 66 / n };
      post("progress", { stage: stage.label, pct: Math.round(stage.base) });
      var clipName = "c" + i + ".mp4";
      core.FS.writeFile(clipName, new Uint8Array(b.clip));
      var args = ["-i", clipName];
      var capIdx = -1;
      if (b.cap) {
        core.FS.writeFile("t" + i + ".png", new Uint8Array(b.cap));
        args.push("-i", "t" + i + ".png");
        capIdx = 1;
      }
      var voIdx;
      if (b.vo) {
        core.FS.writeFile("a" + i + ".mp3", new Uint8Array(b.vo));
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
      run(
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
        ]),
        120000,
        "beat " + (i + 1)
      );
      segs.push("file '" + seg + "'");
      try { core.FS.unlink(clipName); } catch (x) {}
      if (b.cap) try { core.FS.unlink("t" + i + ".png"); } catch (x) {}
      if (b.vo) try { core.FS.unlink("a" + i + ".mp3"); } catch (x) {}
    }

    stage = { label: "stitching the beats", base: 76, span: 8 };
    post("progress", { stage: stage.label, pct: 76 });
    core.FS.writeFile("list.txt", new TextEncoder().encode(segs.join("\\n")));
    run(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "draft.mp4"], 60000, "stitch");

    var outName = "draft.mp4";
    if (msg.music) {
      stage = { label: "mixing the music bed", base: 86, span: 8 };
      post("progress", { stage: stage.label, pct: 86 });
      core.FS.writeFile("music.bin", new Uint8Array(msg.music));
      run([
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
      ], 90000, "music mix");
      outName = "final.mp4";
    }

    post("progress", { stage: "finishing", pct: 97 });
    var out = core.FS.readFile(outName, { encoding: "binary" });
    if (!out || out.length < 50000) throw new Error("the draft came out empty");
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

/** Stitch beats → draft MP4 blob. Non-blocking (dedicated worker driving
    ffmpeg-core directly), streamed progress + engine log, worker-side
    per-exec timeouts, main-thread terminate as backstop. */
export async function assembleReel(beats: AssemblyBeat[], opts: AssemblyOptions = {}): Promise<Blob> {
  if (!beats.length) throw new Error("nothing to assemble");
  const prog = opts.onProgress;

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

  const workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  let lastLog = "";
  try {
    const result = await new Promise<ArrayBuffer>((resolve, reject) => {
      // backstop only — the worker's own per-exec timeouts fire first
      const killer = setTimeout(() => {
        reject(new Error(`assembly hit the 5-minute backstop — last engine line: "${lastLog.slice(0, 160) || "(none)"}". Close other tabs and try again.`));
      }, MAIN_BACKSTOP_MS);
      worker.onerror = (e) => {
        clearTimeout(killer);
        reject(new Error(`the video engine crashed: ${e.message || "worker error"}`));
      };
      worker.onmessage = (e) => {
        const m = e.data as { type: string; stage?: string; pct?: number; line?: string; message?: string; lastLog?: string; data?: ArrayBuffer };
        if (m.type === "log") {
          lastLog = m.line || lastLog;
          if (lastLog) opts.onLog?.(lastLog);
        } else if (m.type === "progress") prog?.(m.stage || "working", m.pct || 0);
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
    URL.revokeObjectURL(workerUrl);
  }
}
