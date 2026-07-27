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

/**
 * Operator multi-client mode: each client's images live in their own IndexedDB
 * so nothing bleeds between accounts (E1-1). "default" keeps the original DB
 * name so existing images are untouched; other clients get a suffixed DB. The
 * active client is a module variable the store sets on hydrate/switch — every
 * vault op flows through openDb(), so this one choke point isolates them all.
 */
let activeClient = "default";
export function setVaultClient(id: string) {
  activeClient = id || "default";
}
const dbNameFor = (id: string) => (id === "default" ? DB_NAME : `${DB_NAME}::${id}`);

function openDb(client: string = activeClient): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(dbNameFor(client), 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        const store = db.objectStoreNames.contains(STORE)
          ? req.transaction!.objectStore(STORE)
          : db.createObjectStore(STORE, { keyPath: "id" });
        // v2: index on createdAt so the UI can read the newest N images
        // instead of materializing EVERY stored dataURL (an unbounded
        // getAll of full-size base64 is a browser-killer once the vault
        // has a few hundred images).
        if (!store.indexNames.contains("createdAt")) store.createIndex("createdAt", "createdAt");
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

/** The newest `limit` images only — what every UI surface should use.
    vaultAll() materializes every stored dataURL and is reserved for
    export/bundle paths. */
export async function vaultRecent(limit = 24): Promise<VaultImage[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const out: VaultImage[] = [];
    try {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const src = store.indexNames.contains("createdAt") ? store.index("createdAt") : store;
      const req = src.openCursor(null, "prev"); // newest first
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur || out.length >= limit) {
          db.close();
          resolve(out);
          return;
        }
        const v = cur.value as VaultImage;
        if (v && v.dataURL) out.push(v);
        cur.continue();
      };
      req.onerror = () => {
        db.close();
        resolve(out);
      };
    } catch {
      db.close();
      resolve(out);
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

/** Read a specific client's vault (for exporting a client bundle). */
export async function vaultAllFor(client: string): Promise<VaultImage[]> {
  const db = await openDb(client);
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => { db.close(); resolve(((req.result || []) as VaultImage[]).filter((v) => v && typeof v.dataURL === "string")); };
      req.onerror = () => { db.close(); resolve([]); };
    } catch { db.close(); resolve([]); }
  });
}

/** Write many images into a specific client's vault (for importing a bundle). */
export async function vaultAddManyTo(client: string, imgs: VaultImage[]): Promise<number> {
  const db = await openDb(client);
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let n = 0;
      imgs.forEach((img) => { if (img && typeof img.dataURL === "string") { store.put(img); n++; } });
      tx.oncomplete = () => { db.close(); resolve(n); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(0); };
    } catch { db.close(); resolve(0); }
  });
}

/** Drop a client's entire vault DB (when the client is removed). */
export async function deleteVaultDb(client: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve();
      const req = indexedDB.deleteDatabase(dbNameFor(client));
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
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
