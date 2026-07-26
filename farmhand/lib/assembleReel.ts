/**
 * Reel assembly — Phase 2 of the reel pipeline, per
 * docs/reel-assembly-spec-2026.md: stitch the per-beat Higgsfield clips,
 * lay the per-beat ElevenLabs narration on the audio track, burn in each
 * beat's on-screen text, optionally mix a low music bed → one 9:16 draft
 * MP4 (720×1280, 30fps).
 *
 * Runs entirely client-side with ffmpeg.wasm (single-thread core — no
 * SharedArrayBuffer/COOP-COEP requirements; the encode is slower but a
 * ~25s 720p draft stays in the low minutes). The wasm core runs in
 * ffmpeg.wasm's own worker thread, so the main thread only marshals files.
 *
 * Captions are rendered to transparent PNGs with <canvas> and overlaid —
 * ffmpeg.wasm ships no fonts, and canvas gets the app's real loaded fonts
 * plus full control of the DESERT GRID caption style (bold sans, PAPER
 * fill on a NIGHT pill, inside the vertical safe band).
 */

import type { FFmpeg as FFmpegT } from "@ffmpeg/ffmpeg";

export interface AssemblyBeat {
  clip: Blob;
  /** narration segment (mp3) — absent = silent beat */
  vo?: Blob;
  /** burned caption text — absent/empty = no caption this beat */
  caption?: string;
  /** visible seconds for this beat (caller decides: script vs VO length) */
  duration: number;
}

export interface AssemblyOptions {
  /** optional music bed, mixed at low volume under the narration */
  music?: Blob;
  onProgress?: (stage: string, pct: number) => void;
}

/* pinned single-thread core — must track the @ffmpeg/ffmpeg minor */
const CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegInstance: FFmpegT | null = null;

async function getFFmpeg(onProgress?: (stage: string, pct: number) => void): Promise<FFmpegT> {
  if (ffmpegInstance) return ffmpegInstance;
  onProgress?.("loading video engine (~30MB, first time only)", 2);
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
  const ff = new FFmpeg();
  await ff.load({
    coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInstance = ff;
  return ff;
}

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
    // wrap at ~620px
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
    const bottomY = 900; // block bottom, inside the safe band
    const topY = bottomY - blockH;
    // one pill per line (tighter than a block pill, reads like captions)
    lines.forEach((ln, i) => {
      const w = ctx.measureText(ln).width;
      const y = topY + padY + i * lineH + lineH / 2;
      const pillW = w + padX * 2;
      const pillH = lineH - 6;
      ctx.fillStyle = "rgba(16,24,32,0.74)"; // NIGHT @ 74%
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
      ctx.fillStyle = "#F4F0E6"; // PAPER
      ctx.fillText(ln, W / 2, y + 1);
    });
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  } catch {
    return null;
  }
}

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

/** Stitch beats → draft MP4 blob. Throws with a plain-English message. */
export async function assembleReel(beats: AssemblyBeat[], opts: AssemblyOptions = {}): Promise<Blob> {
  if (!beats.length) throw new Error("nothing to assemble");
  const prog = opts.onProgress;
  const ff = await getFFmpeg(prog);
  const cleanup: string[] = [];
  try {
    const segs: string[] = [];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const D = Math.max(1.5, Math.min(12, b.duration)).toFixed(2);
      prog?.(`encoding beat ${i + 1} of ${beats.length}`, 5 + Math.round((i / beats.length) * 70));
      const clipName = `c${i}.mp4`;
      await ff.writeFile(clipName, await bytes(b.clip));
      cleanup.push(clipName);
      const cap = b.caption && b.caption.trim() && b.caption.trim().toLowerCase() !== "none" ? await captionPng(b.caption) : null;
      const args: string[] = ["-i", clipName];
      let capIdx = -1;
      if (cap) {
        const capName = `t${i}.png`;
        await ff.writeFile(capName, await bytes(cap));
        cleanup.push(capName);
        args.push("-i", capName);
        capIdx = 1;
      }
      let voIdx: number;
      if (b.vo) {
        const voName = `a${i}.mp3`;
        await ff.writeFile(voName, await bytes(b.vo));
        cleanup.push(voName);
        args.push("-i", voName);
        voIdx = cap ? 2 : 1;
      } else {
        args.push("-f", "lavfi", "-t", D, "-i", "anullsrc=r=44100:cl=stereo");
        voIdx = cap ? 2 : 1;
      }
      const base = `[0:v]trim=duration=${D},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30`;
      const fc = [
        cap ? `${base}[bv];[bv][${capIdx}:v]overlay=0:0[v]` : `${base}[v]`,
        b.vo ? `[${voIdx}:a]apad[a]` : "",
      ]
        .filter(Boolean)
        .join(";");
      const seg = `seg${i}.mp4`;
      await ff.exec([
        ...args,
        "-filter_complex", fc,
        "-map", "[v]",
        "-map", b.vo ? "[a]" : `${voIdx}:a`,
        "-t", D,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "27",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        seg,
      ]);
      segs.push(seg);
      cleanup.push(seg);
    }

    prog?.("stitching beats together", 80);
    await ff.writeFile("list.txt", new TextEncoder().encode(segs.map((s) => `file '${s}'`).join("\n")));
    cleanup.push("list.txt");
    await ff.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "draft.mp4"]);
    cleanup.push("draft.mp4");

    let outName = "draft.mp4";
    if (opts.music) {
      prog?.("mixing the music bed", 90);
      await ff.writeFile("music.bin", await bytes(opts.music));
      cleanup.push("music.bin");
      // music at −18dB-ish under the voice (spec: voice is the loudest element)
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
      cleanup.push("final.mp4");
      outName = "final.mp4";
    }

    prog?.("finishing", 97);
    const out = await ff.readFile(outName);
    const data = out instanceof Uint8Array ? out : new TextEncoder().encode(String(out));
    if (data.byteLength < 50_000) throw new Error("the draft came out empty — try again");
    prog?.("done", 100);
    return new Blob([data as BlobPart], { type: "video/mp4" });
  } catch (e) {
    throw e instanceof Error && e.message !== "nothing to assemble" && !e.message.includes("draft came out")
      ? new Error("assembly failed mid-encode — close other tabs (it needs memory) and try again")
      : e;
  } finally {
    for (const f of cleanup) {
      try {
        await ff.deleteFile(f);
      } catch {}
    }
  }
}
