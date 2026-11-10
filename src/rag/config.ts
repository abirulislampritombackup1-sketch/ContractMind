// All RAG tunables live here and come from Vite env vars (see README).
// Client-visible env vars need the VITE_ prefix; none of these are secrets.

const env = (((import.meta as any).env ?? {}) as Record<string, string | undefined>);

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const RAG_CONFIG = {
  /** Master switch. Set VITE_RAG_ENABLED=false to send whole documents (the old behaviour). */
  enabled: env.VITE_RAG_ENABLED !== "false",
  embeddingModel: env.VITE_GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  /** Embedding vector size. gemini-embedding-001 supports 128–3072; smaller = less storage. */
  embeddingDim: num(env.VITE_RAG_EMBEDDING_DIM, 768),
  /** Chunks retrieved per query (each agent scales this, see src/services/gemini.ts). */
  topK: num(env.VITE_RAG_TOP_K, 5),
  /** Sections longer than this (characters) are split at paragraph/sentence breaks. */
  chunkSize: num(env.VITE_RAG_CHUNK_SIZE, 2000),
  /** Characters repeated from the end of one piece at the start of the next. */
  chunkOverlap: num(env.VITE_RAG_CHUNK_OVERLAP, 200),
  /** Chunks per embedding request (the API allows up to 100). */
  embedBatchSize: Math.min(100, num(env.VITE_RAG_EMBED_BATCH, 100)),
  /** Whole-document summaries: consecutive chunks are grouped up to this many characters per call. */
  summaryBatchChars: num(env.VITE_RAG_SUMMARY_BATCH_CHARS, 12000),
  /** A PDF page with fewer non-space characters than this is flagged as scanned / needing OCR. */
  minPageChars: num(env.VITE_RAG_MIN_PAGE_CHARS, 40),
};
