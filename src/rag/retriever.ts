// Cosine-similarity retrieval over an indexed document.

import type { Chunk } from "./chunker";

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface RetrieveOptions {
  /** Maximum chunks returned in total. */
  topK: number;
  /** Chunks taken per query before merging (defaults to topK, i.e. plain top-K for one query). */
  perQuery?: number;
}

/**
 * Top chunks for one or more query vectors. Each query contributes its own best
 * `perQuery` chunks; the union is trimmed to the `topK` highest-scoring and returned in
 * document order.
 */
export function retrieve(chunks: Chunk[], vectors: ArrayLike<number>[], queryVecs: ArrayLike<number>[], opts: RetrieveOptions): ScoredChunk[] {
  const perQuery = Math.max(1, opts.perQuery ?? opts.topK);
  const best = new Map<number, number>(); // chunk index → best score over queries

  for (const q of queryVecs) {
    const scored = chunks.map((_, i) => ({ i, s: cosine(q, vectors[i]) })).sort((a, b) => b.s - a.s);
    for (const { i, s } of scored.slice(0, perQuery)) best.set(i, Math.max(best.get(i) ?? -1, s));
  }

  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, opts.topK))
    .map(([i, score]) => ({ chunk: chunks[i], score }))
    .sort((a, b) => a.chunk.index - b.chunk.index);
}
