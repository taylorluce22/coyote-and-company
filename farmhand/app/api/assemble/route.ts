import { NextRequest, NextResponse } from "next/server";
import { del, list, put } from "@vercel/blob";
import { spawn } from "child_process";
import { access, chmod, copyFile, mkdtemp, readFile, rename, rm, writeFile } from "fs/promises";
import { constants as fsConstants } from "fs";
import { randomUUID } from "crypto";
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
 * POST { phase: "posters", client, reelId, refUrl? }
 *   → extracts one small JPEG per video in the reel's vault (clip-N.jpg,
 *     draft.jpg, and the preserved reference's sibling .jpg). Idempotent:
 *     only missing posters are rendered, so it doubles as the backfill for
 *     reels produced before posters existed. Posters are what let the card
 *     render <img> thumbnails instead of a grid of decoding <video>
 *     elements — concurrent decode stalled the tab for ~30s.
 * POST { phase: "cleanup", urls: [] }
 *   → deletes reels/asm/ blobs the client has finished banking.
 *
 * Runs on the Node runtime; the ffmpeg-static binary is traced into the
 * function via next.config outputFileTracingIncludes.
 */

export const maxDuration = 300;

const clamp = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Only OUR blob store. Two permission tiers, and the split is
    load-bearing: reels/asm/ = transfer-hop inputs (caption PNGs, music,
    legacy uploads) that get fetched AND DELETED after download; vault/ =
    the permanent server-side media vault (clips, VO) that may only ever be
    FETCHED here — deleting a vault asset would destroy paid-for media. */
function blobPath(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}
function isAsmBlobUrl(raw: string): boolean {
  return (blobPath(raw) || "").startsWith("reels/asm/");
}
function isReadableBlobUrl(raw: string): boolean {
  const p = blobPath(raw) || "";
  return p.startsWith("reels/asm/") || p.startsWith("vault/");
}

async function download(url: string, dest: string): Promise<void> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`couldn't read a timeline asset (${r.status})`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

/**
 * Resolve a runnable ffmpeg. The package export is candidate #1, but a
 * bundler that inlined the module once rewrote its __dirname to the
 * compiled route dir (spawn ENOENT in prod) — so try the real filesystem
 * layouts too, and if a binary exists but lost its +x bit (zip/trace can
 * strip it), copy it to /tmp and chmod 755. Resolution is cached and the
 * chosen path is exposed via GET so a mismatch is diagnosable in one curl.
 */
let resolvedFfmpeg: string | null = null;
/** In-flight staging, shared across concurrent requests — under Fluid
    Compute N cold requests would otherwise each copy the 80MB binary into
    the ~512MB /tmp at once. One copy, everyone awaits it. */
let stagingInFlight: Promise<string> | null = null;

/** Stage a readable-but-not-executable binary into /tmp. Unique staging
    name + atomic rename: overwriting in place could truncate a binary
    another request is already executing, and a partial copy must never be
    visible at the published path. Failed stagings clean up after
    themselves — an orphaned 80MB partial would ratchet /tmp toward
    exhaustion on every retry. */
async function stageBinary(src: string): Promise<string> {
  const tmp = path.join(tmpdir(), "ffmpeg-bin");
  try {
    await access(tmp, fsConstants.X_OK); // already staged by an earlier request
    return tmp;
  } catch {}
  const staging = `${tmp}.${randomUUID()}`;
  try {
    await copyFile(src, staging);
    await chmod(staging, 0o755);
    await rename(staging, tmp);
  } catch (e) {
    rm(staging, { force: true }).catch(() => {});
    throw new Error(`ffmpeg exists at ${src} but couldn't be staged runnable in /tmp — ${e instanceof Error ? e.message : "copy failed"}`);
  }
  await access(tmp, fsConstants.X_OK);
  return tmp;
}

async function ffmpegBin(): Promise<string> {
  if (resolvedFfmpeg) return resolvedFfmpeg;
  const candidates = [
    ...(typeof ffmpegPath === "string" && ffmpegPath ? [ffmpegPath] : []),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    "/var/task/farmhand/node_modules/ffmpeg-static/ffmpeg",
    "/var/task/node_modules/ffmpeg-static/ffmpeg",
  ];
  // pass 1: anything directly executable wins — zero copying
  for (const c of candidates) {
    try {
      await access(c, fsConstants.X_OK);
      resolvedFfmpeg = c;
      return c;
    } catch {}
  }
  // pass 2: the zip stripped +x — stage ONE shared /tmp copy from the
  // first readable candidate
  let stageErr: unknown = null;
  for (const c of candidates) {
    try {
      await access(c, fsConstants.R_OK);
    } catch {
      continue;
    }
    try {
      const shared = (stagingInFlight ??= stageBinary(c));
      const tmp = await shared;
      if (stagingInFlight === shared) stagingInFlight = null;
      resolvedFfmpeg = tmp;
      return tmp;
    } catch (e) {
      stagingInFlight = null;
      stageErr = e;
    }
  }
  throw stageErr instanceof Error
    ? stageErr
    : new Error(`ffmpeg binary not found in the deployment — tried: ${candidates.join(" · ")}`);
}

function runFfmpeg(bin: string, args: string[], cwd: string): Promise<{ code: number; stderrTail: string }> {
  return new Promise((resolve, reject) => {
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
      // a resolvable-but-unrunnable path must not poison the warm instance —
      // drop the cache so the next request re-resolves past it
      resolvedFfmpeg = null;
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(killer);
      resolve({ code: code ?? 1, stderrTail: tail });
    });
  });
}

export async function GET() {
  // the probe RESOLVES the binary for real — "configured: true" here means
  // a spawn will actually find something executable
  try {
    const bin = await ffmpegBin();
    return NextResponse.json({ configured: !!process.env.BLOB_READ_WRITE_TOKEN, ffmpeg: bin });
  } catch (e) {
    return NextResponse.json({ configured: false, error: e instanceof Error ? e.message : "ffmpeg missing" });
  }
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {}

  /* ---- posters: one small JPEG per video in a reel's vault ----
     THE ANTI-STALL LEVER: a card that renders N <video> elements makes
     Chrome decode N streams at once and the tab stalls for ~30s. Posters
     let the grid render plain <img> thumbnails and instantiate a real
     <video> only on an explicit play. Idempotent — only missing posters
     are generated, so this doubles as the backfill for reels produced
     before posters existed. */
  if (b.phase === "posters") {
    const SEGP = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
    const client = SEGP.test(String(b.client ?? "")) ? String(b.client) : null;
    const reelId = SEGP.test(String(b.reelId ?? "")) ? String(b.reelId) : null;
    if (!client || !reelId) return NextResponse.json({ error: "bad client/reel id" }, { status: 400 });
    const refUrl = clamp(b.refUrl, 600);
    const dir = await mkdtemp(path.join(tmpdir(), "post-"));
    try {
      const { blobs } = await list({ prefix: `vault/${client}/${reelId}/`, limit: 200 });
      const have = new Set(blobs.map((x) => x.pathname.split("/").pop() || ""));
      type Target = { key: string; src: string; out: string; beat: number | null; kind: "clip" | "draft" | "ref" };
      const targets: Target[] = [];
      for (const x of blobs) {
        const name = x.pathname.split("/").pop() || "";
        const mClip = name.match(/^clip-(\d+)\.mp4$/);
        if (mClip && !have.has(`clip-${mClip[1]}.jpg`)) {
          targets.push({ key: `vault/${client}/${reelId}/clip-${mClip[1]}.jpg`, src: x.url, out: `clip-${mClip[1]}.jpg`, beat: Number(mClip[1]), kind: "clip" });
        } else if (name === "draft.mp4" && !have.has("draft.jpg")) {
          targets.push({ key: `vault/${client}/${reelId}/draft.jpg`, src: x.url, out: "draft.jpg", beat: null, kind: "draft" });
        }
      }
      // the preserved reference lives under refs/ — same treatment
      let refPoster: string | undefined;
      if (refUrl && isReadableBlobUrl(refUrl) && /\.mp4$/i.test(refUrl)) {
        const refPath = (blobPath(refUrl) || "").replace(/\.mp4$/i, ".jpg");
        if (refPath.startsWith(`vault/${client}/`)) {
          const { blobs: refBlobs } = await list({ prefix: refPath, limit: 1 });
          const existing = refBlobs.find((x) => x.pathname === refPath);
          if (existing) refPoster = existing.url;
          else targets.push({ key: refPath, src: refUrl, out: "ref.jpg", beat: null, kind: "ref" });
        }
      }

      const posters: Record<number, string> = {};
      let draftPoster: string | undefined;
      // reuse posters already in the store
      for (const x of blobs) {
        const name = x.pathname.split("/").pop() || "";
        const m = name.match(/^clip-(\d+)\.jpg$/);
        if (m) posters[Number(m[1])] = x.url;
        else if (name === "draft.jpg") draftPoster = x.url;
      }

      if (targets.length) {
        const bin = await ffmpegBin();
        for (const t of targets.slice(0, 16)) {
          try {
            const local = path.join(dir, `in-${t.out}.mp4`);
            await download(t.src, local);
            // fast seek before -i, one frame, small: a poster is a thumbnail
            const { code } = await runFfmpeg(
              bin,
              ["-hide_banner", "-y", "-ss", "0.5", "-i", local, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "5", t.out],
              dir
            );
            if (code !== 0) continue;
            const bytes = await readFile(path.join(dir, t.out));
            if (bytes.byteLength < 500) continue;
            const up = await put(t.key, bytes, {
              access: "public",
              contentType: "image/jpeg",
              addRandomSuffix: false,
              allowOverwrite: true,
              cacheControlMaxAge: 60,
            });
            if (t.kind === "clip" && t.beat !== null) posters[t.beat] = up.url;
            else if (t.kind === "draft") draftPoster = up.url;
            else if (t.kind === "ref") refPoster = up.url;
            await rm(local, { force: true });
          } catch {
            // one bad clip must never fail the whole poster pass
          }
        }
      }
      return NextResponse.json({ posters, ...(draftPoster ? { draftPoster } : {}), ...(refPoster ? { refPoster } : {}), generated: targets.length });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 300) : "poster pass failed" }, { status: 500 });
    } finally {
      rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

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
      return isReadableBlobUrl(clip)
        ? {
            clip,
            vo: isReadableBlobUrl(vo) ? vo : null,
            cap: isReadableBlobUrl(cap) ? cap : null,
            duration: Number.isFinite(d) ? Math.min(12, Math.max(1.5, d)) : 5,
          }
        : null;
    })
    .filter((x): x is { clip: string; vo: string | null; cap: string | null; duration: number } => !!x)
    .slice(0, 12);
  if (!beats.length) return NextResponse.json({ error: "no valid timeline — upload the assets first" }, { status: 400 });
  const musicUrl = clamp(b.music, 600);
  const music = isReadableBlobUrl(musicUrl) ? musicUrl : null;
  // vault target: when the client names its reel, the draft lands at the
  // reel's permanent vault key (overwrite = re-assemble in place)
  const SEG = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
  const vaultClient = SEG.test(String(b.client ?? "")) ? String(b.client) : null;
  const vaultReel = SEG.test(String(b.reelId ?? "")) ? String(b.reelId) : null;
  // premium quality: full 1080x1920 at a finer CRF — pairs with the 1080p
  // image-to-video clips so no upscaling mush sneaks in
  const premium = String(b.quality ?? "") === "premium";
  const W = premium ? 1080 : 720;
  const H = premium ? 1920 : 1280;
  const CRF = premium ? "19" : "20";

  const dir = await mkdtemp(path.join(tmpdir(), "asm-"));
  const inputUrls: string[] = [];
  try {
    // pull the timeline to /tmp (small files — a few MB each). Only
    // TRANSFER-HOP inputs (reels/asm/: caption PNGs, music, legacy asset
    // uploads) are queued for deletion — vault/ media is permanent.
    const noteInput = (u: string) => {
      if (isAsmBlobUrl(u)) inputUrls.push(u);
    };
    await Promise.all(
      beats.flatMap((bt, i) => {
        const jobs = [download(bt.clip, path.join(dir, `c${i}.mp4`))];
        noteInput(bt.clip);
        if (bt.vo) {
          jobs.push(download(bt.vo, path.join(dir, `a${i}.mp3`)));
          noteInput(bt.vo);
        }
        if (bt.cap) {
          jobs.push(download(bt.cap, path.join(dir, `t${i}.png`)));
          noteInput(bt.cap);
        }
        return jobs;
      })
    );
    if (music) {
      await download(music, path.join(dir, "music.bin"));
      noteInput(music);
    }
    // transfer-hop inputs are safely local — burn those blobs now so
    // nothing leaks even if the encode dies
    if (inputUrls.length) del(inputUrls).catch(() => {});

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
      const base = `[${clip}:v]trim=duration=${D},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30`;
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
      "-crf", CRF,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", premium ? "192k" : "128k",
      "-ar", "44100",
      "-movflags", "+faststart",
      "out.mp4"
    );

    const bin = await ffmpegBin();
    const { code, stderrTail } = await runFfmpeg(bin, args, dir);
    if (code !== 0) {
      return NextResponse.json({ error: `encode failed (ffmpeg exit ${code}) — ${stderrTail.slice(-400)}` }, { status: 500 });
    }
    const out = await readFile(path.join(dir, "out.mp4"));
    if (out.byteLength < 50_000) return NextResponse.json({ error: "the draft came out empty — try again" }, { status: 500 });

    // vault-targeted drafts land at the reel's permanent key (overwrite =
    // re-assemble in place); legacy callers still get a one-off asm output
    const outPath =
      vaultClient && vaultReel
        ? `vault/${vaultClient}/${vaultReel}/draft.mp4`
        : `reels/asm/out-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const blob = await put(outPath, out, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
      allowOverwrite: true,
      // overwritable key — a long CDN TTL would serve a stale draft after re-assembly
      cacheControlMaxAge: 60,
    });
    const seconds = beats.reduce((s, bt) => s + bt.duration, 0);
    return NextResponse.json({ url: blob.url, seconds: Math.round(seconds), bytes: out.byteLength });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 400) : "assembly failed" }, { status: 500 });
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
