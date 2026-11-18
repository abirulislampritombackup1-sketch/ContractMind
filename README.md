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

## Agent pipeline

Five Gemini agents work on each analysis (`runContractIntelligence` in `src/services/gemini.ts`):

```
Risk Auditor ──► Opposing Counsel ──► Commercial Dealmaker (redlines)
Obligation Extractor                         (in parallel)
Gold Standard search ──► Benchmark Agent     (in parallel)
```

- **Risk Auditor** scores every playbook rule. Its failed, partial and missing rules are handed to **Opposing Counsel**.
- **Opposing Counsel** reviews the contract as the other side's lawyer, indemnification first, and lists one-sided clauses (`OC-1`, `OC-2`, ...) with the other side's argument.
- **Commercial Dealmaker** answers each finding with a commercially workable counter-offer; every redline names the finding it answers.
- If an earlier agent fails, the next one still runs without the hand-off.
- The analysing screen shows the pipeline live, and the Overview tab shows each agent's model, time, tokens and how many contract sections it read.

## Gold Standard RAG

- `src/data/goldStandards.ts` + `goldStandardsMore.ts`: 30 gold clauses, one per common CUAD v1 category (indemnity, liability cap, termination, confidentiality, governing law, assignment, change of control, non-compete, renewal, price changes, audit, warranties, SLA, insurance, GDPR processing and transfers, exit, and more). The wording is ContractMind's own balanced drafting of common market positions, labelled as such.
- `src/rag/goldIndex.ts` embeds the library once (cached in IndexedDB) and compares every gold clause with every contract section by cosine similarity.
- Gold clauses with a similar section (at least `VITE_RAG_GOLD_MIN_SIMILARITY`, default 0.6) are sent to the Benchmark Agent together with their closest sections, instead of the whole library.
- **Required** gold clauses with no similar section are flagged in code as possibly missing; the agent then confirms each as missing, present or not applicable. The Benchmarks tab lists confirmed missing protections with the gold wording to copy, and shows similarity, section and page for each comparison.
- Without an index (scanned PDF, RAG off) the agent falls back to the full library in the prompt.

## Custom playbooks and the risk report

- **Playbooks** page: duplicate a built-in playbook or start a new one, then edit its name, tolerances and rules (category, title, target standard, acceptable fallback, unacceptable terms, severity, weight). Changes save automatically in the browser (`localStorage`). Built-in playbooks stay read-only.
- **Import / Export JSON** shares a playbook between people (`*.playbook.json`). Imports are validated and cleaned (`src/utils/playbookStore.ts`), and never replace a built-in playbook.
- The scorecard shows a one-line explanation of the score, and every rule that is not passing gets an AI "what to do" suggestion.
- **Risk report (PDF)** on the results page opens the print dialog with the score, rules, evidence, suggested actions and redlines; choose *Save as PDF*.

## Land Guide and Case Helper

Two extra tabs for people in Bangladesh. Their content is in Bangla; the tab names follow the EN/বাংলা toggle.

- **Land Guide (জমি গাইড)**: steps for inheritance mutation (namjari) without a broker, how to find a khatian on the government portals, a khatian reader (upload a photo or PDF and Gemini explains owners, shares and plots), an inheritance share calculator (Muslim faraid, Hindu Dayabhaga, Christian Succession Act 1925, common family cases only), an heir-details organiser with a copy button, and a Q&A chat.
- **Case Helper (আইনি সহায়তা)**: first steps after receiving a summons or notice, free legal aid information, an explainer for a legal paper or a typed problem (options, a sensible next step, questions for a lawyer), and a Q&A chat.

Code: `src/components/legal/` (pages), `src/services/legalAssist.ts` (prompts and Gemini calls through the same `/api/gemini` proxy), `src/legal/faraid.ts` (share calculator, tested in `faraid.test.ts`). Styles are scoped under `.legalPage` in `src/style.css`.

Uploads on these pages are limited to 3 MB, because Vercel functions reject request bodies over 4.5 MB and files are sent base64-encoded. Everything shown is general information, not legal advice; the calculator refuses cases it does not cover and says to ask a lawyer.

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
| `VITE_GEMINI_MAX_CONCURRENT` | `3` | Most Gemini requests running at once (protects the free-tier rate limit). |
| `VITE_RAG_GOLD_MIN_SIMILARITY` | `0.6` | Similarity (0-1) at which a contract section counts as covering a Gold Standard clause. |
| `VITE_SHOW_LEGAL_BD` | `true` | `false` hides the Land Guide and Case Helper tabs. |

Changing the embedding model, dimension, chunk size or overlap re-indexes documents automatically (they are part of the cache key).

### Limits

- Scanned PDFs (no extractable text) are read by Gemini directly. Files up to about 2.4 MB are sent as they are; larger ones are rendered to page images with pdf.js and shrunk to fit Vercel's 4.5 MB request limit (up to 60 pages; if pages still do not fit, only the first ones are sent and the AI is told). OCR-based indexing is not implemented.
- Finished analyses are saved in the browser (IndexedDB) by document, playbook and language, so the same analysis opens instantly. **Re-run** always asks the AI again. Demo and incomplete results are not saved.
- The index lives in the user's browser (IndexedDB); clearing site data re-indexes on next use.
- The Gold Standard similarity threshold (0.6) has not yet been calibrated on real `gemini-embedding-001` vectors. Run one analysis with a key and check the Benchmarks tab: if clauses that are clearly in the contract are listed as possibly missing, lower `VITE_RAG_GOLD_MIN_SIMILARITY`; if almost nothing is checked for gaps, raise it. The agent's confirmation step limits the damage either way.
- Retrieval can miss a clause that does not resemble any query. Raise `VITE_RAG_TOP_K` if analyses report provisions as "Not Addressed" that exist in the document.
