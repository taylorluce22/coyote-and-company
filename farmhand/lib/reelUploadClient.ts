/**
 * Client helper: run the reel upload inside a Web Worker so the tab's main
 * thread does essentially nothing while a big clip uploads — the owner's
 * browsers have repeatedly frozen mid-upload, and whatever the local
 * trigger is, moving the upload machinery off-thread makes the tab immune.
 *
 * Rejects with WORKER_UNAVAILABLE when workers can't run here (blocked
 * construction, broken bundle) — callers fall back to the main-thread
 * upload. Any other rejection is a real upload failure.
 */

export const WORKER_UNAVAILABLE = "__worker_unavailable__";

/** Plain-English guidance for a File the browser can't actually read. */
export const FILE_UNREADABLE =
  "That clip can't be read from where it's stored — it looks like a Photos-library placeholder, not a real file. Save it to Files (or your Desktop/Dropbox) first, then upload that copy.";

const CANARY_BYTES = 65536; // 64KB — enough to force the OS to prove the bytes exist
const CANARY_TIMEOUT_MS = 10000;

// same crumb trail ReelCoach and the lite page write — if the tab wedges
// during the probe, "probing file readability" is the last surviving line
const crumb = (msg: string) => {
  try {
    const list = JSON.parse(localStorage.getItem("fh-reel-crumbs") || "[]") as string[];
    list.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
    localStorage.setItem("fh-reel-crumbs", JSON.stringify(list.slice(-25)));
  } catch {}
};

export type UploadProgress = { loaded: number; total: number; percentage: number };

/**
 * Canary read: prove the first 64KB of the File is actually readable BEFORE
 * the File goes anywhere. macOS Photos-library-backed Files are promise-backed
 * placeholders — reading them (or structured-cloning them into a worker via
 * postMessage) can force full materialization on the main thread and wedge
 * the tab on a memory-pressured machine. A tiny read raced against a timeout
 * turns "complete freeze" into a fast, plain-English failure.
 * Throws Error(FILE_UNREADABLE) on timeout or read failure.
 */
export async function probeFileReadable(file: File): Promise<void> {
  crumb("attach: probing file readability");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      file.slice(0, CANARY_BYTES).arrayBuffer(),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error("canary read timed out")), CANARY_TIMEOUT_MS);
      }),
    ]);
    crumb("attach: probe ok — file is readable");
  } catch (e) {
    crumb(`attach: probe FAILED — ${e instanceof Error ? e.message.slice(0, 50) : "unknown"}`);
    throw new Error(FILE_UNREADABLE);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function uploadInWorker(
  file: File,
  pathname: string,
  contentType: string,
  onProgress: (p: UploadProgress) => void
): Promise<string> {
  // probe BEFORE constructing the worker or postMessage-ing the File —
  // cloning an unreadable placeholder is exactly the wedge we're avoiding.
  // Throws FILE_UNREADABLE (not WORKER_UNAVAILABLE), so callers surface it
  // instead of falling back to a main-thread upload that would wedge worse.
  await probeFileReadable(file);
  return new Promise((resolve, reject) => {
    let w: Worker;
    try {
      w = new Worker(new URL("../workers/reelUpload.worker.ts", import.meta.url));
    } catch {
      reject(new Error(WORKER_UNAVAILABLE));
      return;
    }
    const finish = (fn: () => void) => {
      try {
        w.terminate();
      } catch {}
      fn();
    };
    w.onerror = () => finish(() => reject(new Error(WORKER_UNAVAILABLE)));
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { type?: string; url?: string; message?: string; loaded?: number; total?: number; percentage?: number };
      if (m.type === "progress") onProgress({ loaded: m.loaded || 0, total: m.total || 0, percentage: m.percentage || 0 });
      else if (m.type === "done") finish(() => resolve(String(m.url || "")));
      else if (m.type === "error") finish(() => reject(new Error(m.message || "upload failed")));
    };
    w.postMessage({ file, pathname, contentType });
  });
}
