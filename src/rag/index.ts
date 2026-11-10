// Public entry points of the RAG layer.
//   indexDocument()    once per document: convert → chunk → embed → store (cached by content hash)
//   retrieveContext()  per task/question: embed queries → top-K chunks → labelled excerpt block

import { chunkPages, Chunk, SourcePage } from "./chunker";
import { RAG_CONFIG } from "./config";
import { embedTexts } from "./embedder";
import { buildExcerptBlock } from "./promptBuilder";
import { convertPdfToMarkdown } from "./pdfToMarkdown";
import { retrieve, ScoredChunk } from "./retriever";
import { createStore, StoredDoc, VectorStore } from "./vectorStore";

export interface DocIndex {
  key: string;
  chunks: Chunk[];
  vectors: Float32Array[];
  lowTextPages: number[];
  pageCount: number;
  fromCache: boolean;
}

export interface RetrievedContext {
  block: string; // ready-to-send excerpt text
  chunks: ScoredChunk[];
  totalChunks: number;
}

export class ScannedDocumentError extends Error {
  constructor() {
    super("This PDF has no extractable text (scanned); it needs OCR or direct page-image processing.");
  }
}

let store: VectorStore | null = null;
const getStore = () => (store ??= createStore());
const inflight = new Map<string, Promise<DocIndex>>();

async function sha256(data: ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure contexts have no crypto.subtle: fall back to a simple FNV-1a hash.
  const arr = new Uint8Array(bytes);
  let h = 0x811c9dc5;
  for (let i = 0; i < arr.length; i++) h = Math.imul(h ^ arr[i], 0x01000193) >>> 0;
  return `fnv-${h.toString(16)}-${arr.length}`;
}

const isPdf = (f?: File) => !!f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));

/** Index a document once; later calls with the same content return the stored index. */
export function indexDocument(input: { file?: File; text: string; name?: string }): Promise<DocIndex> {
  return (async () => {
    const pdf = isPdf(input.file);
    const hash = await sha256(pdf ? await input.file!.arrayBuffer() : input.text);
    const key = [hash, RAG_CONFIG.embeddingModel, RAG_CONFIG.embeddingDim, RAG_CONFIG.chunkSize, RAG_CONFIG.chunkOverlap].join(":");

    const pending = inflight.get(key);
    if (pending) return pending;

    const job = (async (): Promise<DocIndex> => {
      const cached = await getStore().get(key).catch(() => undefined);
      if (cached) return { ...cached, fromCache: true };

      // a) PDF → Markdown (with page numbers), or plain text for DOCX/TXT/samples
      let pages: SourcePage[];
      let lowTextPages: number[] = [];
      if (pdf) {
        const pdfjs = await import("pdfjs-dist"); // worker is configured once in App.tsx
        const doc = await pdfjs.getDocument({ data: await input.file!.arrayBuffer() }).promise;
        const conv = await convertPdfToMarkdown(doc as any);
        lowTextPages = conv.lowTextPages;
        if (lowTextPages.length === conv.pages.length) throw new ScannedDocumentError();
        if (lowTextPages.length) {
          console.warn(`[ContractMind] Pages with almost no text (scanned? OCR needed): ${lowTextPages.join(", ")}`);
        }
        pages = conv.pages.map((p) => ({ page: p.page, markdown: p.markdown }));
      } else {
        pages = [{ page: 0, markdown: input.text }];
      }

      // b) heading-aware chunks   c) embeddings   d) store
      const chunks = chunkPages(pages, { maxChars: RAG_CONFIG.chunkSize, overlapChars: RAG_CONFIG.chunkOverlap });
      if (!chunks.length) throw new Error("Nothing to index: the document has no text.");
      const vectors = await embedTexts(chunks.map((c) => c.embedText), "RETRIEVAL_DOCUMENT");

      const doc: StoredDoc = {
        key,
        name: input.name || input.file?.name || "document",
        createdAt: Date.now(),
        pageCount: pages.length,
        lowTextPages,
        chunks,
        vectors,
      };
      await getStore().put(doc);
      console.info(`[ContractMind] Indexed "${doc.name}": ${chunks.length} chunks, ${pages.length} page(s).`);
      return { ...doc, fromCache: false };
    })();

    inflight.set(key, job);
    // Failures are not cached, so a later request can retry.
    job.catch(() => inflight.delete(key));
    return job;
  })();
}

/** Embed the queries (RETRIEVAL_QUERY), pick the top chunks, and format them for the prompt. */
export async function retrieveContext(
  index: DocIndex,
  queries: string[],
  opts: { topK?: number; perQuery?: number } = {}
): Promise<RetrievedContext> {
  const qs = queries.map((q) => q.trim()).filter(Boolean);
  const topK = Math.min(opts.topK ?? RAG_CONFIG.topK, index.chunks.length);
  if (topK >= index.chunks.length) {
    // Small document: everything fits, so skip the query embedding and send all sections.
    const all = index.chunks.map((chunk) => ({ chunk, score: 1 }));
    return { block: buildExcerptBlock(index.chunks, index.chunks.length), chunks: all, totalChunks: index.chunks.length };
  }
  const queryVecs = await embedTexts(qs, "RETRIEVAL_QUERY");
  const chunks = retrieve(index.chunks, index.vectors, queryVecs, { topK, perQuery: opts.perQuery });
  return { block: buildExcerptBlock(chunks.map((c) => c.chunk), index.chunks.length), chunks, totalChunks: index.chunks.length };
}
