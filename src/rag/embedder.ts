// Gemini embeddings via the app's /api/gemini proxy (the API key stays server-side).
// Up to 100 texts per request; retries with exponential backoff on rate limits / 5xx.

import { RAG_CONFIG } from "./config";

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbedDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** Vector size; defaults to VITE_RAG_EMBEDDING_DIM (the repository index uses 256). */
  dim?: number;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function normalize(v: number[]): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

async function embedBatch(texts: string[], taskType: EmbedTaskType, deps: EmbedDeps): Promise<Float32Array[]> {
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const maxRetries = deps.maxRetries ?? 5;
  const model = RAG_CONFIG.embeddingModel;
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: deps.dim ?? RAG_CONFIG.embeddingDim,
    })),
  });

  let lastError = "";
  let askedWaitMs: number | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // A rate limit says how long to wait ("retry in 35s"); otherwise back off exponentially.
      await sleep(askedWaitMs ?? Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.random() * 300);
      askedWaitMs = null;
    }
    let res: Response;
    try {
      res = await doFetch(`/api/gemini/models/${model}:batchEmbedContents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (e: any) {
      lastError = e?.message || "network error";
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      const embeddings: { values: number[] }[] = data?.embeddings ?? [];
      if (embeddings.length !== texts.length) throw new Error(`Embedding API returned ${embeddings.length} vectors for ${texts.length} texts.`);
      return embeddings.map((e) => normalize(e.values));
    }
    let detail = "";
    let errBody: any = null;
    try {
      errBody = await res.json();
      detail = errBody?.error?.message || "";
    } catch {}
    lastError = `${res.status} ${detail}`.trim();
    if (!RETRYABLE.has(res.status)) break;
    if (res.status === 429) {
      const info = (errBody?.error?.details || []).find((d: any) => String(d?.["@type"] || "").includes("RetryInfo"));
      const secs = Number(String(info?.retryDelay || "").replace(/s$/, "")) || Number(detail.match(/retry in ([\d.]+)s/i)?.[1]);
      if (secs > 0) askedWaitMs = Math.min(65000, Math.ceil(secs * 1000) + 500);
    }
  }
  throw new Error(`Embedding request failed (${lastError}).`);
}

/**
 * Most characters per request (~15K tokens). The free tier allows 30K embedding tokens per
 * minute, so a batch of 100 long chunks (~50K tokens) could never succeed in one request.
 */
const MAX_BATCH_CHARS = 60000;

/** Splits texts into requests of at most `maxCount` texts and about `maxChars` characters. */
export function batchesOf(texts: string[], maxCount: number, maxChars = MAX_BATCH_CHARS): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const t of texts) {
    if (cur.length && (cur.length >= maxCount || chars + t.length > maxChars)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(t);
    chars += t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Embed any number of texts, in batches (100 texts / ~15K tokens each), preserving order. */
export async function embedTexts(texts: string[], taskType: EmbedTaskType, deps: EmbedDeps = {}): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (const batch of batchesOf(texts, RAG_CONFIG.embedBatchSize)) {
    out.push(...(await embedBatch(batch, taskType, deps)));
  }
  return out;
}

// ── Query embedding cache ────────────────────────────────────────────────────
// Agents search with the same playbook-based queries for every contract, and people repeat
// Library searches, so query vectors are kept (memory + localStorage, newest 300).
const QCACHE_KEY = "cm-qcache-v1";
const QCACHE_MAX = 300;
let qcache: Map<string, string> | null = null;

function loadQCache(): Map<string, string> {
  if (qcache) return qcache;
  qcache = new Map();
  try {
    const raw = JSON.parse(localStorage.getItem(QCACHE_KEY) || "[]");
    if (Array.isArray(raw)) for (const [k, v] of raw) qcache.set(k, v);
  } catch {}
  return qcache;
}
function saveQCache() {
  try {
    localStorage.setItem(QCACHE_KEY, JSON.stringify([...loadQCache()].slice(-QCACHE_MAX)));
  } catch {
    // Storage full or blocked: the cache still works in memory for this visit.
  }
}
const toB64 = (v: Float32Array) => {
  const bytes = new Uint8Array(v.buffer.slice(0));
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const fromB64 = (b: string) => {
  const s = atob(b);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

/** Like embedTexts(…, "RETRIEVAL_QUERY"), but reuses vectors embedded before. */
export async function embedQueriesCached(texts: string[], deps: EmbedDeps = {}): Promise<Float32Array[]> {
  const cache = loadQCache();
  const dim = deps.dim ?? RAG_CONFIG.embeddingDim;
  const keyOf = (t: string) => `${RAG_CONFIG.embeddingModel}|${dim}|${t}`;
  const missing = [...new Set(texts.filter((t) => !cache.has(keyOf(t))))];
  if (missing.length) {
    const vecs = await embedTexts(missing, "RETRIEVAL_QUERY", deps);
    missing.forEach((t, i) => {
      cache.delete(keyOf(t));
      cache.set(keyOf(t), toB64(vecs[i]));
    });
    while (cache.size > QCACHE_MAX) cache.delete(cache.keys().next().value!);
    saveQCache();
  }
  return texts.map((t) => fromB64(cache.get(keyOf(t))!));
}

/** For tests: forget cached query vectors. */
export function __clearQueryCache() {
  qcache = new Map();
  try {
    localStorage.removeItem(QCACHE_KEY);
  } catch {}
}
