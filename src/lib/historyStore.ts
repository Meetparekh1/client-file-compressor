/**
 * History & Recent Files Store
 * 100% on-device private storage using IndexedDB with in-memory / local fallback.
 * Manages recently processed documents, operation statuses, error tracking,
 * and allows reopening and redownloading processed files.
 */

export interface HistoryItem {
  id: string;
  timestamp: number;
  toolId: string;
  toolName: string;
  fileName: string;
  fileSize: number;
  status: 'completed' | 'failed' | 'processing';
  errorMessage?: string;
  resultFileName?: string;
  resultSize?: number;
  hasBlob: boolean;
  pageCount?: number;
}

const DB_NAME = 'docukit_history_db';
const DB_VERSION = 1;
const STORE_NAME = 'history_records';
const BLOB_STORE_NAME = 'history_blobs';
const MAX_HISTORY_RECORDS = 25;

// In-memory fallback stores for environments without IndexedDB (e.g. tests, SSR, private browsing)
const fallbackRecords = new Map<string, HistoryItem>();
const fallbackBlobs = new Map<string, Blob>();

let dbPromise: Promise<IDBDatabase> | null = null;
let isIndexedDBAvailable: boolean | null = null;

function checkIndexedDB(): boolean {
  if (isIndexedDBAvailable !== null) return isIndexedDBAvailable;
  try {
    isIndexedDBAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    isIndexedDBAvailable = false;
  }
  return isIndexedDBAvailable;
}

function getDB(): Promise<IDBDatabase> {
  if (!checkIndexedDB()) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
            db.createObjectStore(BLOB_STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          isIndexedDBAvailable = false;
          reject(request.error);
        };
      } catch (err) {
        isIndexedDBAvailable = false;
        reject(err);
      }
    });
  }
  return dbPromise;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

/**
 * Adds an operation to recent history.
 */
export async function addHistoryEntry(entry: {
  toolId: string;
  toolName: string;
  fileName: string;
  fileSize: number;
  status: 'completed' | 'failed' | 'processing';
  errorMessage?: string;
  resultFileName?: string;
  resultSize?: number;
  resultBlob?: Blob;
  pageCount?: number;
}): Promise<string> {
  const id = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record: HistoryItem = {
    id,
    timestamp: Date.now(),
    toolId: entry.toolId,
    toolName: entry.toolName,
    fileName: entry.fileName,
    fileSize: entry.fileSize,
    status: entry.status,
    errorMessage: entry.errorMessage,
    resultFileName: entry.resultFileName,
    resultSize: entry.resultSize !== undefined ? entry.resultSize : (entry.resultBlob ? entry.resultBlob.size : undefined),
    hasBlob: !!entry.resultBlob,
    pageCount: entry.pageCount,
  };

  try {
    const db = await getDB();
    const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const blobStore = tx.objectStore(BLOB_STORE_NAME);

    store.put(record);
    if (entry.resultBlob) {
      blobStore.put({ id, blob: entry.resultBlob });
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback store
    fallbackRecords.set(id, record);
    if (entry.resultBlob) {
      fallbackBlobs.set(id, entry.resultBlob);
    }
  }

  // Prune old records if over MAX_HISTORY_RECORDS
  pruneOldHistory().catch(() => {});

  notifyListeners();
  return id;
}

/**
 * Returns all recent history items, sorted descending by timestamp.
 */
export async function getHistoryEntries(): Promise<HistoryItem[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return await new Promise<HistoryItem[]>((resolve, reject) => {
      request.onsuccess = () => {
        const items: HistoryItem[] = request.result || [];
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    const items = Array.from(fallbackRecords.values());
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }
}

/**
 * Retrieves the stored result Blob for a history record.
 */
export async function getHistoryBlob(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(BLOB_STORE_NAME, 'readonly');
    const store = tx.objectStore(BLOB_STORE_NAME);
    const request = store.get(id);

    return await new Promise<Blob | null>((resolve) => {
      request.onsuccess = () => {
        resolve(request.result?.blob || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return fallbackBlobs.get(id) || null;
  }
}

/**
 * Deletes a single history record and its associated blob.
 */
export async function deleteHistoryEntry(id: string): Promise<void> {
  fallbackRecords.delete(id);
  fallbackBlobs.delete(id);

  try {
    const db = await getDB();
    const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.objectStore(BLOB_STORE_NAME).delete(id);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  notifyListeners();
}

/**
 * Clears all history records and blobs to free local resources.
 */
export async function clearAllHistory(): Promise<void> {
  fallbackRecords.clear();
  fallbackBlobs.clear();

  try {
    const db = await getDB();
    const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(BLOB_STORE_NAME).clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  notifyListeners();
}

/**
 * Prunes history exceeding maximum record capacity.
 */
async function pruneOldHistory(): Promise<void> {
  try {
    const entries = await getHistoryEntries();
    if (entries.length > MAX_HISTORY_RECORDS) {
      const toDelete = entries.slice(MAX_HISTORY_RECORDS);
      for (const item of toDelete) {
        await deleteHistoryEntry(item.id);
      }
    }
  } catch {
    // ignore
  }
}
