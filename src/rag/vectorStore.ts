// Persistent chunk + vector storage. The app has no backend database, so this uses
// IndexedDB in the browser (falling back to memory when unavailable). Records are keyed by
// content hash + embedding/chunking settings, so the same PDF is never processed twice.

import type { Chunk } from "./chunker";

export interface StoredDoc {
  key: string;
  name: string;
  createdAt: number;
  pageCount: number;
  lowTextPages: number[]; // pages with almost no text (scanned) — candidates for OCR
  chunks: Chunk[];
  vectors: Float32Array[]; // one per chunk, L2-normalised
}

export interface VectorStore {
  get(key: string): Promise<StoredDoc | undefined>;
  put(doc: StoredDoc): Promise<void>;
}

export class MemoryStore implements VectorStore {
  private m = new Map<string, StoredDoc>();
  async get(key: string) {
    return this.m.get(key);
  }
  async put(doc: StoredDoc) {
    this.m.set(doc.key, doc);
  }
}

const DB_NAME = "contractmind-rag";
const STORE = "docs";

export class IndexedDbStore implements VectorStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db() {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async get(key: string) {
    const db = await this.db();
    return new Promise<StoredDoc | undefined>((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as StoredDoc | undefined);
      r.onerror = () => reject(r.error);
    });
  }

  async put(doc: StoredDoc) {
    const db = await this.db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/** IndexedDB when available; any storage error silently degrades to an in-memory copy. */
export function createStore(): VectorStore {
  const memory = new MemoryStore();
  if (typeof indexedDB === "undefined") return memory;
  const idb = new IndexedDbStore();
  return {
    async get(key) {
      try {
        return (await idb.get(key)) ?? (await memory.get(key));
      } catch {
        return memory.get(key);
      }
    },
    async put(doc) {
      await memory.put(doc);
      try {
        await idb.put(doc);
      } catch (e) {
        console.warn("[ContractMind] Could not persist the document index (using memory only):", e);
      }
    },
  };
}
