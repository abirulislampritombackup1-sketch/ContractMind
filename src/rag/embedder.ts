// Gemini embeddings via the app's /api/gemini proxy (the API key stays server-side).
// Up to 100 texts per request; retries with exponential backoff on rate limits / 5xx.

import { RAG_CONFIG } from "./config";

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbedDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
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
      outputDimensionality: RAG_CONFIG.embeddingDim,
    })),
  });

  let lastError = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.random() * 300);
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
    try {
      detail = (await res.json())?.error?.message || "";
    } catch {}
    lastError = `${res.status} ${detail}`.trim();
    if (!RETRYABLE.has(res.status)) break;
  }
  throw new Error(`Embedding request failed (${lastError}).`);
}

/** Embed any number of texts, 100 per request (configurable), preserving order. */
export async function embedTexts(texts: string[], taskType: EmbedTaskType, deps: EmbedDeps = {}): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += RAG_CONFIG.embedBatchSize) {
    out.push(...(await embedBatch(texts.slice(i, i + RAG_CONFIG.embedBatchSize), taskType, deps)));
  }
  return out;
}
