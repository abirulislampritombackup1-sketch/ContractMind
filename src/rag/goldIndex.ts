// Gold Standard RAG: embeds the gold clause library once (cached in IndexedDB), then
// finds, for every gold clause, the contract sections that are most similar to it.
//
//   matched gold clauses → sent with their best contract sections to the benchmark agent
//   required gold clauses with no similar section → "possibly missing" protections,
//   which the agent then confirms (missing / present / not applicable)

import { GoldStandardClause } from "../types";
import { Chunk } from "./chunker";
import { RAG_CONFIG } from "./config";
import { embedTexts } from "./embedder";
import { cosine } from "./retriever";
import { createStore, VectorStore } from "./vectorStore";
import { sha256 } from "./index";

export interface GoldMatch {
  gold: GoldStandardClause;
  /** Best contract sections for this gold clause, highest similarity first. */
  hits: { chunk: Chunk; score: number }[];
  best: number; // similarity of the best section (0 when there is none)
}

export interface GoldRetrieval {
  matched: GoldMatch[]; // best >= threshold, strongest first
  possiblyMissing: GoldMatch[]; // required clauses below the threshold
}

/** Embedding text for a gold clause (used as a search query against the contract). */
export const goldQueryText = (g: GoldStandardClause) => `${g.category}: ${g.title}. ${g.standardText}`;

/** Pure matching step, kept separate so it can be tested with hand-made vectors. */
export function matchGold(
  chunks: Chunk[],
  chunkVecs: ArrayLike<number>[],
  gold: GoldStandardClause[],
  goldVecs: ArrayLike<number>[],
  opts: { threshold: number; perGold?: number; maxMatched?: number }
): GoldRetrieval {
  const perGold = opts.perGold ?? 2;
  const all: GoldMatch[] = gold.map((g, gi) => {
    const hits = chunks
      .map((chunk, ci) => ({ chunk, score: cosine(goldVecs[gi], chunkVecs[ci]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, perGold);
    return { gold: g, hits, best: hits[0]?.score ?? 0 };
  });
  const matched = all
    .filter((m) => m.best >= opts.threshold)
    .sort((a, b) => b.best - a.best)
    .slice(0, opts.maxMatched ?? 8);
  const possiblyMissing = all.filter((m) => m.gold.required && m.best < opts.threshold);
  return { matched, possiblyMissing };
}

let store: VectorStore | null = null;
let memo: { key: string; vecs: Promise<Float32Array[]> } | null = null;

/** Gold clause vectors, embedded once per library version / embedding settings. */
export async function goldVectors(gold: GoldStandardClause[]): Promise<Float32Array[]> {
  const texts = gold.map(goldQueryText);
  const key = ["gold", await sha256(texts.join("\n§\n")), RAG_CONFIG.embeddingModel, RAG_CONFIG.embeddingDim].join(":");
  if (memo?.key === key) return memo.vecs;
  const vecs = (async () => {
    store ??= createStore();
    const cached = await store.get(key).catch(() => undefined);
    if (cached?.vectors.length === gold.length) return cached.vectors;
    const v = await embedTexts(texts, "RETRIEVAL_QUERY");
    await store
      .put({ key, name: "gold-standard-library", createdAt: Date.now(), pageCount: 0, lowTextPages: [], chunks: [], vectors: v })
      .catch(() => {});
    return v;
  })();
  memo = { key, vecs };
  vecs.catch(() => (memo = null));
  return vecs;
}

/** Retrieves gold clauses for a contract index (chunks + vectors from indexDocument). */
export async function retrieveGold(
  index: { chunks: Chunk[]; vectors: Float32Array[] },
  gold: GoldStandardClause[],
  opts: { threshold?: number } = {}
): Promise<GoldRetrieval> {
  const goldVecs = await goldVectors(gold);
  return matchGold(index.chunks, index.vectors, gold, goldVecs, { threshold: opts.threshold ?? RAG_CONFIG.goldMinSimilarity });
}
