/**
 * Image Vault — permanent storage for every AI-generated image.
 *
 * The regular asset library lives in localStorage and is capped at 40 (old
 * entries get evicted), which is fine for stock photos but not for images
 * that cost real credits. The vault keeps every Higgsfield result in
 * IndexedDB — effectively unlimited, survives the asset cap, and carries the
 * prompt + post it was made for so images can be reused on a later post even
 * if the original one never ships.
 */

export interface VaultImage {
  id: string;
  dataURL: string;
  lum?: number;
  busy?: number;
  prompt?: string;
  label: string;
  createdAt: number;
}

const DB_NAME = "farmhand-vault";
const STORE = "images";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
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

export async function vaultAdd(img: VaultImage): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(img);
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

export async function vaultAll(): Promise<VaultImage[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        db.close();
        const list = (req.result || []) as VaultImage[];
        resolve(list.filter((v) => v && typeof v.dataURL === "string").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
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

export async function vaultDelete(id: string): Promise<void> {
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
