/**
 * Persistent Device-Local Cover Storage using browser IndexedDB.
 * Ensures all low-quality previews and full covers are stored on the user's device,
 * eliminating repeated network requests across app sessions.
 */

const DB_NAME = 'banca_geek_local_covers_v1';
const STORE_NAME = 'covers';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallbackMap = new Map<string, string>();

/**
 * Initializes and opens IndexedDB safely
 */
export function openCoverDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'comicId' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result as IDBDatabase);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Gets a cover or LQIP from local device storage
 */
export async function getLocalCover(comicId: string): Promise<string | null> {
  if (!comicId) return null;

  // 1. Check in-memory fast cache
  if (memoryFallbackMap.has(comicId)) {
    return memoryFallbackMap.get(comicId)!;
  }

  // 2. Query IndexedDB
  try {
    const db = await openCoverDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(comicId);

        req.onsuccess = () => {
          const res = req.result;
          if (res && res.dataUrl) {
            memoryFallbackMap.set(comicId, res.dataUrl);
            resolve(res.dataUrl);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Saves a cover or LQIP into device IndexedDB permanently
 */
export async function saveLocalCover(
  comicId: string,
  dataUrl: string,
  isFullRes: boolean = false
): Promise<void> {
  if (!comicId || !dataUrl) return;

  memoryFallbackMap.set(comicId, dataUrl);

  try {
    const db = await openCoverDb();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      comicId,
      dataUrl,
      isFullRes,
      savedAt: Date.now(),
    });
  } catch {}
}

/**
 * Bulk saves a batch of low-quality thumbnails (LQIP) into device IndexedDB
 */
export async function saveLocalCoversBatch(
  coversMap: Record<string, string>
): Promise<number> {
  if (!coversMap || typeof coversMap !== 'object') return 0;

  const entries = Object.entries(coversMap);
  if (entries.length === 0) return 0;

  for (const [id, dataUrl] of entries) {
    if (id && dataUrl) memoryFallbackMap.set(id, dataUrl);
  }

  try {
    const db = await openCoverDb();
    if (!db) return entries.length;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const [id, dataUrl] of entries) {
          if (id && dataUrl) {
            store.put({
              comicId: id,
              dataUrl,
              isFullRes: false,
              savedAt: Date.now(),
            });
          }
        }

        tx.oncomplete = () => resolve(entries.length);
        tx.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  } catch {
    return 0;
  }
}

/**
 * Returns count of covers cached locally on this device
 */
export async function countLocalCovers(): Promise<number> {
  try {
    const db = await openCoverDb();
    if (!db) return memoryFallbackMap.size;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(memoryFallbackMap.size);
      } catch {
        resolve(memoryFallbackMap.size);
      }
    });
  } catch {
    return memoryFallbackMap.size;
  }
}
