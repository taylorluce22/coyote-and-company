import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";

/**
 * Reel assembly — SERVER-SIDE native encode. The client-side ffmpeg.wasm
 * path is dead and must never come back: wasm holds the whole job in one
 * grow-only linear-memory heap (all inputs + decoded frames + outputs
 * resident at once), which exhausted physical RAM on a unified-memory Mac
 * ~18s in and froze the entire browser via system-wide memory pressure —
 * regardless of which thread ran the encode (verified across three
 * client-side architectures, 2026-07-27). Native ffmpeg streams through
 * fixed buffers and encodes a ~25s reel in ~15-40s.
 *
 * POST { beats: [{ clip, vo?, cap?, duration }], music? }
 *   clip/vo/cap/music are OUR Blob-store URLs under reels/asm/ (the client
 *   uploads the vault-banked assets first via the blob-upload token route;
 *   caption cards are canvas-rendered PNGs — pixel-identical DESERT GRID
 *   styling, and no font bundling server-side).
 *   → downloads assets to /tmp, runs ONE ffmpeg pass (per-beat normalize
 *     to 720×1280 + caption overlay + VO timed to the beat, concat, x264
 *     veryfast CRF 20 + aac + faststart), uploads the MP4 to Blob and
 *     returns { url, seconds } — never the MP4 bytes themselves (4.5MB
 *     response cap). Input blobs are deleted as soon as they're on /tmp.
 * POST { phase: "cleanup", urls: [] }
 *   → deletes reels/asm/ blobs the client has finished banking.
 *
 * Runs on the Node runtime; the ffmpeg-static binary is traced into the
 * function via next.config outputFileTracingIncludes.
 */

export const maxDuration = 300;

const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Only OUR blob store, only the assembly prefix — these URLs get fetched
    AND deleted server-side, so the guard is load-bearing. */
function isAsmBlobUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".blob.vercel-storage.com") &&
      u.pathname.replace(/^\/+/, "").startsWith("reels/asm/")
    );
  } catch {
    return false;
  }
}

async function download(url: string, dest: string): Promise<void> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`couldn't read a timeline asset (${r.status})`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

function runFfmpeg(args: string[], cwd: string): Promise<{ code: number; stderrTail: string }> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegPath as unknown as string | null;
    if (!bin) return reject(new Error("ffmpeg binary missing from the deployment"));
    const proc = spawn(bin, args, { cwd });
    let tail = "";
    proc.stderr.on("data", (d: Buffer) => {
      tail = (tail + d.toString()).slice(-4000);
    });
    // the function budget is 300s — kill well inside it so the caller gets
    // a real error (with the log tail) instead of a platform timeout
    const killer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`encode exceeded 240s — last output: ${tail.slice(-300)}`));
    }, 240000);
    proc.on("error", (e) => {
      clearTimeout(killer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(killer);
      resolve({ code: code ?? 1, stderrTail: tail });
    });
  });
}

export async function GET() {
  return NextResponse.json({ configured: !!process.env.BLOB_READ_WRITE_TOKEN && !!ffmpegPath });
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}

  /* ---- cleanup: the client banked the draft — burn the asm blobs ---- */
  if (b.phase === "cleanup") {
    const urls = (Array.isArray(b.urls) ? b.urls : []).map((u) => clamp(u, 600)).filter(isAsmBlobUrl).slice(0, 40);
    if (urls.length) await del(urls).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  /* ---- assemble ---- */
  const rawBeats = Array.isArray(b.beats) ? b.beats : [];
  const beats = rawBeats
    .map((raw) => {
      const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const clip = clamp(r.clip, 600);
      const vo = clamp(r.vo, 600);
      const cap = clamp(r.cap, 600);
      const d = Number(r.duration);
      return isAsmBlobUrl(clip)
        ? {
            clip,
            vo: isAsmBlobUrl(vo) ? vo : null,
            cap: isAsmBlobUrl(cap) ? cap : null,
            duration: Number.isFinite(d) ? Math.min(12, Math.max(1.5, d)) : 5,
          }
        : null;
    })
    .filter((x): x is { clip: string; vo: string | null; cap: string | null; duration: number } => !!x)
    .slice(0, 12);
  if (!beats.length) return NextResponse.json({ error: "no valid timeline — upload the assets first" }, { status: 400 });
  const musicUrl = clamp(b.music, 600);
  const music = isAsmBlobUrl(musicUrl) ? musicUrl : null;

  const dir = await mkdtemp(path.join(tmpdir(), "asm-"));
  const inputUrls: string[] = [];
  try {
    // pull the timeline to /tmp (small files — a few MB each)
    await Promise.all(
      beats.flatMap((bt, i) => {
        const jobs = [download(bt.clip, path.join(dir, `c${i}.mp4`))];
        inputUrls.push(bt.clip);
        if (bt.vo) {
          jobs.push(download(bt.vo, path.join(dir, `a${i}.mp3`)));
          inputUrls.push(bt.vo);
        }
        if (bt.cap) {
          jobs.push(download(bt.cap, path.join(dir, `t${i}.png`)));
          inputUrls.push(bt.cap);
        }
        return jobs;
      })
    );
    if (music) {
      await download(music, path.join(dir, "music.bin"));
      inputUrls.push(music);
    }
    // inputs are safely local — burn the blobs now so nothing leaks even
    // if the encode dies
    del(inputUrls).catch(() => {});

    // ONE ffmpeg pass: per-beat normalize + caption + timed audio, concat all
    const args: string[] = ["-hide_banner", "-y"];
    const idxOf: Array<{ clip: number; cap: number; vo: number }> = [];
    let idx = 0;
    for (let i = 0; i < beats.length; i++) {
      const bt = beats[i];
      const rec = { clip: -1, cap: -1, vo: -1 };
      args.push("-i", `c${i}.mp4`);
      rec.clip = idx++;
      if (bt.cap) {
        args.push("-i", `t${i}.png`);
        rec.cap = idx++;
      }
      if (bt.vo) {
        args.push("-i", `a${i}.mp3`);
        rec.vo = idx++;
      } else {
        args.push("-f", "lavfi", "-t", bt.duration.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo");
        rec.vo = idx++;
      }
      idxOf.push(rec);
    }
    let musicIdx = -1;
    if (music) {
      args.push("-stream_loop", "-1", "-i", "music.bin");
      musicIdx = idx++;
    }

    const fc: string[] = [];
    const concatIn: string[] = [];
    beats.forEach((bt, i) => {
      const { clip, cap, vo } = idxOf[i];
      const D = bt.duration.toFixed(2);
      const base = `[${clip}:v]trim=duration=${D},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30`;
      fc.push(cap >= 0 ? `${base}[pv${i}];[pv${i}][${cap}:v]overlay=0:0[v${i}]` : `${base}[v${i}]`);
      fc.push(`[${vo}:a]aresample=44100,apad,atrim=duration=${D},asetpts=PTS-STARTPTS[a${i}]`);
      concatIn.push(`[v${i}][a${i}]`);
    });
    fc.push(`${concatIn.join("")}concat=n=${beats.length}:v=1:a=1[vc][ac]`);
    let aOut = "ac";
    if (musicIdx >= 0) {
      fc.push(`[${musicIdx}:a]volume=0.12[mm];[ac][mm]amix=inputs=2:duration=first:dropout_transition=0[am]`);
      aOut = "am";
    }
    args.push(
      "-filter_complex", fc.join(";"),
      "-map", "[vc]",
      "-map", `[${aOut}]`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ar", "44100",
      "-movflags", "+faststart",
      "out.mp4"
    );

    const { code, stderrTail } = await runFfmpeg(args, dir);
    if (code !== 0) {
      return NextResponse.json({ error: `encode failed (ffmpeg exit ${code}) — ${stderrTail.slice(-400)}` }, { status: 500 });
    }
    const out = await readFile(path.join(dir, "out.mp4"));
    if (out.byteLength < 50_000) return NextResponse.json({ error: "the draft came out empty — try again" }, { status: 500 });

    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const blob = await put(`reels/asm/out-${stamp}.mp4`, out, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
    const seconds = beats.reduce((s, bt) => s + bt.duration, 0);
    return NextResponse.json({ url: blob.url, seconds: Math.round(seconds), bytes: out.byteLength });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 400) : "assembly failed" }, { status: 500 });
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
