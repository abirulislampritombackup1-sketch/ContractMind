# ContractMind

AI contract review: risk scoring against a playbook, redlines, obligations, gold-standard benchmarking and a counsel chat.
React + Vite + TypeScript; Gemini is called through a server-side proxy so the API key never reaches the browser.

## Setup

```bash
pnpm install
```

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your-key-here
```

```bash
pnpm dev        # http://localhost:5173
pnpm test       # unit tests (chunker, retriever, embedder, converter, summariser)
pnpm build
```

On Vercel, set `GEMINI_API_KEY` in the project's environment variables (the `/api/gemini` function attaches it).

## Chunking + retrieval (RAG) pipeline

Instead of sending the whole contract to Gemini for every task, the app indexes each document once and sends only the relevant passages.

**On upload (once per document)** — `src/rag/`
1. `pdfToMarkdown.ts` converts the PDF to Markdown with pdf.js: headings (font size, numbering, ALL-CAPS), lists, simple tables and page numbers. Pages with almost no text are flagged as scanned (OCR can be added later). DOCX/TXT are chunked as plain text.
2. `chunker.ts` splits at headings and records each chunk's heading path (`Chapter 2 > Payment Terms`) and start page. Sections longer than `VITE_RAG_CHUNK_SIZE` are split at paragraph, line, then sentence breaks, repeating the last `VITE_RAG_CHUNK_OVERLAP` characters at the start of the next piece. No text is dropped.
3. `embedder.ts` embeds `heading path + text` with `gemini-embedding-001` (`RETRIEVAL_DOCUMENT`), 100 chunks per request, retrying rate limits with exponential backoff.
4. `vectorStore.ts` stores chunks and vectors in the browser's IndexedDB, keyed by the SHA-256 of the file plus the embedding/chunking settings, so the same PDF is never processed twice.

**Per task or question**
- `retriever.ts` embeds the query (`RETRIEVAL_QUERY`) and returns the top-K chunks by cosine similarity, in document order. Each analysis agent searches with its own queries (playbook rules, gold-standard categories, obligation topics) and a K scaled from the base value.
- `promptBuilder.ts` labels every excerpt with chunk ID, heading and page, and tells Gemini to answer only from the excerpts, say "Not found in the document" otherwise, and cite chunk IDs (chat).
- Whole-document requests in chat ("summarize the entire contract") use `summarize.ts`: consecutive chunks are summarised in groups, then the summaries are combined.
- If indexing or retrieval fails (no API key, rate limit, scanned PDF), the app falls back to the previous behaviour of sending the whole document.

**Token logging** — every Gemini response's `usageMetadata` is logged to the browser console, and kept in memory:

```js
__contractmindTokens.table()    // per request
__contractmindTokens.totals()   // sums
__contractmindTokens.clear()
```

To compare before/after, analyse the same PDF once with `VITE_RAG_ENABLED=false` and once with `true` (restart `pnpm dev` after changing `.env`) and compare `totals()`. `src/rag/payload.test.ts` prints an offline estimate on a synthetic contract.

### Environment variables

All optional, read at build/dev start (client-visible, so they need the `VITE_` prefix; none are secrets).

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | – | Server-side key used by the proxy (required). |
| `VITE_GEMINI_MODEL` | `gemini-3.8-flash` | Primary generation model. |
| `VITE_GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Fallback generation model. |
| `VITE_GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model. |
| `VITE_RAG_ENABLED` | `true` | `false` sends whole documents (old behaviour). |
| `VITE_RAG_TOP_K` | `5` | Base number of chunks per query. Agents use a multiple (risk and obligations ×3, redlines ×2.5, benchmarks ×2). |
| `VITE_RAG_CHUNK_SIZE` | `2000` | Max characters per chunk before a section is split. |
| `VITE_RAG_CHUNK_OVERLAP` | `200` | Characters repeated between split pieces. |
| `VITE_RAG_EMBEDDING_DIM` | `768` | Embedding vector size (128–3072). |
| `VITE_RAG_EMBED_BATCH` | `100` | Chunks per embedding request (max 100). |
| `VITE_RAG_SUMMARY_BATCH_CHARS` | `12000` | Characters per group in chunk-by-chunk summaries. |
| `VITE_RAG_MIN_PAGE_CHARS` | `40` | Pages with fewer characters are flagged as scanned. |

Changing the embedding model, dimension, chunk size or overlap re-indexes documents automatically (they are part of the cache key).

### Limits

- Scanned PDFs (no extractable text) are still sent to Gemini as page images, as before; OCR-based indexing is not implemented.
- The index lives in the user's browser (IndexedDB); clearing site data re-indexes on next use.
- Retrieval can miss a clause that does not resemble any query. Raise `VITE_RAG_TOP_K` if analyses report provisions as "Not Addressed" that exist in the document.
