import type { TestResult } from '../engine/types';

/**
 * Lightweight IndexedDB wrapper for storing test history locally.
 * No external dependency — uses the raw IndexedDB API.
 */

const DB_NAME = 'pulse-db';
const DB_VERSION = 1;
const STORE = 'results';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveResult(result: TestResult): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(result);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    // Fail silently — history is a convenience, not critical to a test.
    console.warn('[pulse] could not save result', e);
  }
}

export async function getResults(limit = 100): Promise<TestResult[]> {
  try {
    const db = await openDB();
    const results = await new Promise<TestResult[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const idx = store.index('timestamp');
      const out: TestResult[] = [];
      const cursorReq = idx.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && out.length < limit) {
          out.push(cursor.value as TestResult);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    db.close();
    return results;
  } catch (e) {
    console.warn('[pulse] could not load results', e);
    return [];
  }
}

export async function clearResults(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[pulse] could not clear results', e);
  }
}
