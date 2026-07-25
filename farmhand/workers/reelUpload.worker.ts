import { upload } from "@vercel/blob/client";
import { UPLOAD_STALLED } from "../lib/reelUploadClient";

/**
 * Reel upload, OFF the main thread. The owner's browsers (Mac Chrome and
 * phone) have repeatedly wedged during uploads — whatever the trigger, a
 * worker makes the tab immune: the multipart upload machinery, file
 * slicing, hashing and retries all run here, and the UI thread only
 * receives a small throttled progress message a few times a second.
 *
 * Messages in:  { file, pathname, contentType }
 * Messages out: { type: "progress", loaded, total, percentage }
 *               { type: "done", url }
 *               { type: "error", message }
 */

const post = (m: unknown) => (self as unknown as { postMessage: (x: unknown) => void }).postMessage(m);

self.onmessage = async (e: MessageEvent) => {
  const { file, pathname, contentType } = e.data as { file: File; pathname: string; contentType: string };
  let lastSent = 0;
  // stall watchdog: the owner sat 10+ minutes on an upload with ZERO
  // progress. If no progress event lands for 90s, declare the transfer
  // dead — the main thread surfaces guidance and terminates this worker
  // (which kills the hung transfer with it).
  let lastProgressAt = Date.now();
  const watchdog = setInterval(() => {
    if (Date.now() - lastProgressAt > 90000) {
      clearInterval(watchdog);
      post({ type: "error", message: UPLOAD_STALLED });
    }
  }, 5000);
  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/video-reference/blob-upload",
      contentType,
      multipart: true,
      onUploadProgress: ({ loaded, total, percentage }) => {
        lastProgressAt = Date.now();
        // throttle: the SDK can fire this per network write — the UI only
        // needs a few updates a second, and flooding postMessage would put
        // the render storm right back on the main thread
        const now = Date.now();
        if (now - lastSent < 300 && percentage < 100) return;
        lastSent = now;
        post({ type: "progress", loaded, total, percentage });
      },
    });
    clearInterval(watchdog);
    post({ type: "done", url: blob.url });
  } catch (err) {
    clearInterval(watchdog);
    post({ type: "error", message: err instanceof Error ? err.message : "upload failed" });
  }
};
