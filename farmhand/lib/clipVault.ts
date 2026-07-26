/**
 * Clip Vault — permanent storage for AI-generated video clips (the per-beat
 * Higgsfield renders of a remake script). Same shape as the Image Vault:
 * IndexedDB, per-client databases, everything paid-for is kept. Clips are
 * stored as Blobs (IndexedDB handles them natively) — a 4s 720p clip is a
 * few MB, so dataURL strings would triple memory for nothing.
 *
 * Keying: one clip per (reelId, beatIndex) — regenerating a beat replaces
 * its clip. The deterministic id keeps that invariant without an index.
 */

export interface VaultClip {
  /** clip: `${reelId}::${beat}` · vo: `${reelId}::vo::${beat}` ·
      draft: `${reelId}::draft` — regeneration overwrites in place */
  id: string;
  reelId: string;
  beatIndex: number;
  /** undefined = video clip (pre-audio-lane records); "vo" = narration
      segment for a beat; "draft" = the assembled reel (beatIndex -1) */
  kind?: "clip" | "vo" | "draft";
  prompt: string;
  label: string;
  mime: string;
  blob: Blob;
  createdAt: number;
}

export const clipId = (reelId: string, beatIndex: number) => `${reelId}::${beatIndex}`;
export const voId = (reelId: string, beatIndex: number) => `${reelId}::vo::${beatIndex}`;
export const draftId = (reelId: string) => `${reelId}::draft`;
export const isClip = (c: VaultClip) => !c.kind || c.kind === "clip";

const DB_NAME = "farmhand-clip-vault";
const STORE = "clips";

let activeClient = "default";
export function setClipVaultClient(id: string) {
  activeClient = id || "default";
}
const dbNameFor = (id: string) => (id === "default" ? DB_NAME : `${DB_NAME}::${id}`);

function openDb(client: string = activeClient): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(dbNameFor(client), 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Pass `client` to pin the write to the vault the batch STARTED under —
    same invariant as the reel vault: a mid-run workspace switch must never
    leak a paid-for clip into another client's storage. */
export async function clipVaultAdd(clip: VaultClip, client?: string): Promise<boolean> {
  const db = await openDb(client);
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(clip);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function clipVaultAll(): Promise<VaultClip[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        db.close();
        const list = (req.result || []) as VaultClip[];
        resolve(list.filter((c) => c && c.blob).sort((a, b) => a.beatIndex - b.beatIndex));
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

/** All clips for one reel, in beat order. */
export async function clipVaultForReel(reelId: string): Promise<VaultClip[]> {
  return (await clipVaultAll()).filter((c) => c.reelId === reelId);
}

export async function clipVaultDelete(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = tx.onerror = tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/** Drop every clip belonging to a deleted reel. */
export async function clipVaultDeleteForReel(reelId: string): Promise<void> {
  const clips = await clipVaultForReel(reelId);
  for (const c of clips) await clipVaultDelete(c.id);
}

/** Drop a client's entire clip-vault DB (when the client is removed). */
export async function deleteClipVaultDb(client: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve();
      const req = indexedDB.deleteDatabase(dbNameFor(client));
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
