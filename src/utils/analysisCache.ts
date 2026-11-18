// Saves finished analyses in the browser (IndexedDB), so analysing the same document
// again with the same playbook and language shows the result instantly, without new
// AI calls. "Re-run" skips the cache.

import { ContractAnalysisResult, Playbook } from "../types";
import { Language } from "../i18n/translations";
import { sha256 } from "../rag";

const DB = "contractmind-analyses";
const STORE = "results";
const MAX_ENTRIES = 30;

type Entry = { key: string; savedAt: number; result: ContractAnalysisResult };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** Same document + same playbook settings + same language → same key. */
export async function analysisKey(input: { file: File | null; text: string; playbook: Playbook; lang: Language }) {
  const doc = await sha256(input.file ? await input.file.arrayBuffer() : input.text);
  const pb = await sha256(JSON.stringify({ rules: input.playbook.rules, tolerances: input.playbook.tolerances, name: input.playbook.name }));
  return `${doc}:${pb.slice(0, 16)}:${input.lang}`;
}

export async function getCachedAnalysis(key: string): Promise<ContractAnalysisResult | null> {
  try {
    const entry = await tx<Entry | undefined>("readonly", (s) => s.get(key));
    return entry?.result ?? null;
  } catch {
    return null; // private mode or storage blocked: just run the analysis
  }
}

export async function saveAnalysis(key: string, result: ContractAnalysisResult): Promise<void> {
  if (result.isDemo || result.incompleteSections?.length) return; // only keep complete live results
  try {
    // Accepted/rejected redline decisions are not part of the saved result.
    const clean = { ...result, redlines: result.redlines.map((r) => ({ ...r, accepted: null })) };
    await tx("readwrite", (s) => s.put({ key, savedAt: Date.now(), result: clean } as Entry));
    const all = await tx<Entry[]>("readonly", (s) => s.getAll());
    if (all.length > MAX_ENTRIES) {
      const old = all.sort((a, b) => a.savedAt - b.savedAt).slice(0, all.length - MAX_ENTRIES);
      await Promise.all(old.map((e) => tx("readwrite", (s) => s.delete(e.key))));
    }
  } catch (e) {
    console.warn("[ContractMind] Could not save the analysis for reuse:", e);
  }
}
