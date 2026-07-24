/**
 * Reel Vault — permanent storage for Gemini's coaching analysis of reference
 * video clips (own posted reels or competitor/reference reels). Only the
 * structured analysis is kept, never the raw video — the clip itself is
 * deleted from Blob storage right after Gemini finishes with it (see
 * /api/video-reference), so this store stays small regardless of how many
 * clips get reviewed.
 */

export interface ReelAnalysis {
  summary?: string;
  hook?: { firstTwoSeconds?: string; technique?: string; strength?: string; why?: string };
  structure?: { estimatedCuts?: number; pacing?: string; onScreenText?: string; ctaPresent?: boolean; ctaNotes?: string };
  visualStyle?: { setting?: string; lighting?: string; framing?: string; wardrobe?: string; brandingVisible?: string };
  audio?: { spokenContent?: string; tone?: string; music?: string };
  contentPattern?: string;
  coachingNotes?: string[];
  [key: string]: unknown;
}

export interface VaultReel {
  id: string;
  label: string;
  source: "own" | "reference";
  analysis: ReelAnalysis;
  createdAt: number;
}

const DB_NAME = "farmhand-reel-vault";
const STORE = "reels";

/** Operator multi-client mode: reels are isolated per client, same pattern as
    the image vault. "default" keeps the original DB name. */
let activeClient = "default";
export function setReelVaultClient(id: string) {
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

export async function reelVaultAdd(reel: VaultReel): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(reel);
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

export async function reelVaultAll(): Promise<VaultReel[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        db.close();
        const list = (req.result || []) as VaultReel[];
        resolve(list.filter((v) => v && v.analysis).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
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

/** Read a specific client's reels (for exporting a client bundle). */
export async function reelVaultAllFor(client: string): Promise<VaultReel[]> {
  const db = await openDb(client);
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => { db.close(); resolve(((req.result || []) as VaultReel[]).filter((v) => v && v.analysis)); };
      req.onerror = () => { db.close(); resolve([]); };
    } catch { db.close(); resolve([]); }
  });
}

/** Write many reels into a specific client's vault (for importing a bundle). */
export async function reelVaultAddManyTo(client: string, reels: VaultReel[]): Promise<number> {
  const db = await openDb(client);
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let n = 0;
      reels.forEach((r) => { if (r && r.analysis) { store.put(r); n++; } });
      tx.oncomplete = () => { db.close(); resolve(n); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(0); };
    } catch { db.close(); resolve(0); }
  });
}

/** Drop a client's entire reel-vault DB (when the client is removed). */
export async function deleteReelVaultDb(client: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve();
      const req = indexedDB.deleteDatabase(dbNameFor(client));
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

export async function reelVaultDelete(id: string): Promise<void> {
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
