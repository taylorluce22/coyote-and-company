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

export type UploadProgress = { loaded: number; total: number; percentage: number };

export function uploadInWorker(
  file: File,
  pathname: string,
  contentType: string,
  onProgress: (p: UploadProgress) => void
): Promise<string> {
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
