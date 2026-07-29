/**
 * Image refs — the out-of-band store for the base64 payloads that used to
 * ride along inside the localStorage snapshot.
 *
 * WHY THIS EXISTS (2026-07-29, Chrome freeze):
 * `stAssets` and `stStudio.slideBg` hold full-size dataURLs — a 1200px JPEG
 * at q0.8 is ~200-470KB of base64, and JS strings are UTF-16, so each one is
 * ~400-940KB of heap. Both fields were in PERSIST_FIELDS, and the persist
 * path is `JSON.stringify(everything)` + a SYNCHRONOUS `localStorage.setItem`
 * on a 350ms debounce. With forty assets banked that is 15-35MB serialized on
 * the main thread on every state change — several hundred ms of hard freeze,
 * re-paid on the next interaction. It also blew Chrome's ~5MB origin quota,
 * so `setItem` threw and the whole snapshot silently stopped persisting.
 *
 * The fix: the snapshot carries `idbref:<id>` markers, the bytes live here in
 * IndexedDB (async, off the main thread, no 5MB ceiling), and the in-memory
 * state still holds real dataURLs so nothing about rendering changes.
 *
 * Per-client DBs, same convention as the image vault — nothing bleeds between
 * accounts. Every op takes an explicit client so a workspace switch mid-flight
 * can never write one client's images into another's DB.
 */

const DB_NAME = "farmhand-imagerefs";
const STORE = "refs";

let activeClient = "default";
export function setRefClient(id: string) {
  activeClient = id || "default";
}
const dbNameFor = (id: string) => (id === "default" ? DB_NAME : `${DB_NAME}::${id}`);

function openDb(client: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(dbNameFor(client), 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export interface ImageRef {
  id: string;
  data: string;
}

/** Write a batch. Fire-and-forget from the save path — the debounce runs long
    before any unload, so a queued write has ample time to land. */
export async function refPutMany(items: ImageRef[], client = activeClient): Promise<boolean> {
  if (!items.length) return true;
  const db = await openDb(client);
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      items.forEach((it) => {
        if (it && it.id && typeof it.data === "string") store.put(it);
      });
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

/** Resolve ids back to dataURLs. Missing ids are simply absent from the
    result — callers drop the asset rather than render a broken marker. */
export async function refGetMany(ids: string[], client = activeClient): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!ids.length) return out;
  const db = await openDb(client);
  if (!db) return out;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      let left = ids.length;
      const finish = () => {
        db.close();
        resolve(out);
      };
      ids.forEach((id) => {
        const req = store.get(id);
        req.onsuccess = () => {
          const v = req.result as ImageRef | undefined;
          if (v && typeof v.data === "string") out[id] = v.data;
          if (--left === 0) finish();
        };
        req.onerror = () => {
          if (--left === 0) finish();
        };
      });
      tx.onerror = tx.onabort = finish;
    } catch {
      db.close();
      resolve(out);
    }
  });
}

/** Drop every ref the live snapshot no longer points at, so removing an
    image actually reclaims its bytes instead of orphaning them forever.
    `keep` must be computed from CURRENT state at call time — that is what
    makes this safe against a write still in flight. */
export async function refPrune(keep: Set<string>, client = activeClient): Promise<number> {
  const db = await openDb(client);
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.openKeyCursor();
      let n = 0;
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        const id = String(cur.key);
        if (!keep.has(id)) {
          store.delete(id);
          n++;
        }
        cur.continue();
      };
      tx.oncomplete = () => {
        db.close();
        resolve(n);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(n);
      };
    } catch {
      db.close();
      resolve(0);
    }
  });
}

/** Every ref a client holds — for the lossless client bundle. Without this,
    an export would carry only the `idbref:` markers and restore a workspace
    with its uploaded assets and slide backgrounds silently missing. */
export async function refAllFor(client: string): Promise<ImageRef[]> {
  const db = await openDb(client);
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        db.close();
        resolve(((req.result || []) as ImageRef[]).filter((r) => r && typeof r.data === "string"));
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

/** Drop a client's ref DB entirely (when the client is removed). */
export async function deleteRefDb(client: string): Promise<void> {
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
