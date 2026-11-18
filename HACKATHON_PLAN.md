# ContractMind: hackathon readiness plan

This plan takes ContractMind from its current state to a submission that covers every line of the hackathon brief. Each step names the files to change and how to tell it is done. Work through the phases in order: Phase 1 makes the demo safe, and phases 2 to 7 close the gaps against the brief.

---

## 1. Requirement checklist

Every item in the brief, where ContractMind stands today, and the step that finishes it.

| # | Brief requirement | Status today | Finished by |
| --- | --- | --- | --- |
| R1 | Take in a raw contract PDF | Done (PDF, DOCX, TXT; scanned PDFs sent whole to Gemini) | Step 1.3 (size limit on Vercel) |
| R2 | Automated risk scoring | Done (rule-by-rule scorecard calculated in code) | Step 2.2 (risk score explained) |
| R3 | Based on **custom** playbooks | Partly done: the builder exists but is hidden, and custom playbooks are not saved | Steps 1.1 and 2.1 |
| R4 | Structured JSON of obligations | Done (Obligations tab, JSON export) | Step 5.3 (published schema and validation) |
| R5 | Redlined version of the document | Done (Word file with tracked changes and a clean text version) | Step 5.2 (full redlined document view) |
| R6 | AI-native, beyond simple OCR | Done (LLM reasoning; scanned pages read by Gemini) | Step 4.1 (dedicated vision agent) |
| R7 | Multi-agent system | Partly done: 4 agents run in parallel but never hand off to each other | Step 3.1 |
| R8 | RAG architecture | Done for the contract (chunk, embed, retrieve) | Steps 3.2 and 6.2 |
| R9 | Contract redlining, risk discovery, obligation extraction | Done | Phase 5 (polish) |
| R10 | LLMs for semantic reasoning | Done (Gemini) | – |
| R11 | Vision models for complex legal formatting | Partly done: only scanned PDFs are seen as images | Step 4.1 |
| E1 | Opposing counsel agent + counter-offer agent | Partly done: both exist but work independently | Step 3.1 |
| E2 | RAG against company "Gold Standard" clauses: deviations and missing protections | Partly done: all 6 gold clauses are put in the prompt; no retrieval | Step 3.2 |
| E3 | Vision agent that parses hierarchical tables into a payment milestone **calendar** | Partly done: milestones come from text; no calendar | Steps 4.1 and 4.2 |
| E4 | Chain-of-thought rationale for every redline | Done | Step 5.1 (verify) |
| E5 | Natural-language search over 5,000+ contracts for liability caps | Missing: the Library has 8 made-up entries, keyword search, and is hidden | Phase 6 |
| D1 | EDGAR | Labels only (sample texts are synthetic) | Steps 6.1 and 7.1 |
| D2 | CUAD v1 | Labels only | Steps 6.1 and 7.2 |
| D3 | MAUD | Labels only | Step 6.1 |
| D4 | Open Legal Data (European, cross-jurisdiction) | Labels only | Step 6.4 |
| D5 | Common Crawl legal subset | Not used | Step 3.2 (gold clause sources) |

---

## Phase 1: Make the demo safe (about 1 day)

> **Status:** steps 1.1, 1.3, 1.4 and 1.5 are built. Step 1.2 (setting `GEMINI_API_KEY` in Vercel) is yours to do.

### 1.1 Bring back the hidden features
- **Files:** `src/App.tsx`.
- Restore the **Playbooks** and **Library** buttons in the top menu, the **Customize** link in step 2, and the sample contracts under the upload box.
- Hide **Land Guide** and **Case Helper** behind a build flag (`VITE_SHOW_LEGAL_BD=false` for the hackathon build) so the demo stays on the brief. Keep the code.
- **Done when:** a judge can reach playbooks, library and samples within one click from the home page.

### 1.2 Make sure the live site works
- In Vercel, set `GEMINI_API_KEY` for **Production** and redeploy.
- Open the site with a fresh browser and run one full analysis.
- **Done when:** the live site analyses a sample with no demo-mode banner.

### 1.3 Stay under Vercel's 4.5 MB request limit
- **Problem:** when retrieval is skipped (scanned PDF, retrieval error), the whole PDF is sent base64-encoded. Any PDF over about 3 MB fails on Vercel, although the upload box allows 50 MB.
- **Files:** `src/services/gemini.ts` (`getFullDocPart`, chat), new `src/rag/pageImages.ts`.
- For scanned or large PDFs, render pages with pdf.js to JPEG (about 1200 px wide, quality 0.7). Send only the pages a task needs, in batches that stay under 3.5 MB per request.
- Show a clear message if a file still cannot be sent.
- **Done when:** a 20 MB scanned PDF is analysed on the live site.

### 1.4 Cache results for a fast demo
- **Files:** `src/rag/vectorStore.ts` (add an `analyses` store), `src/App.tsx`.
- Store each finished analysis by file hash + playbook id + language. Re-opening the same file shows the result immediately, with a **Re-run** button.
- **Done when:** the second run of the same sample appears in under a second.

### 1.5 Protect the free-tier quota
- Add a short queue (at most 2 Gemini calls at a time) in `callGemini`, and show "waiting for the AI…" while queued.
- **Done when:** running two analyses back to back gives no 429 errors.

---

## Phase 2: Custom playbooks and transparent scoring (about 1 day)

> **Status:** built (steps 2.1 and 2.2).

### 2.1 Real custom playbooks
- **Files:** `src/components/PlaybookStudio.tsx`, new `src/utils/playbookStore.ts`.
- Allow creating a playbook from scratch or from a preset, adding, editing and deleting rules (category, title, target standard, unacceptable terms, severity, weight), and setting tolerances.
- Save to `localStorage`. Import and export a playbook as JSON so a team can share it.
- Rule text written in Bangla or English is fine: the AI reads it as is.
- **Done when:** a judge can create a playbook, add a rule, analyse a contract with it, and see that rule in the scorecard.

### 2.2 Explain the score
- The scorecard already shows the formula and a "what to do" suggestion for each failing rule.
- Add a one-line summary above it: "Score 72: 3 rules failed (45 points), 1 missing (9 points)".
- Add a **Download risk report (PDF)** button: scorecard, top risks, and suggested actions.
- **Done when:** the score can be explained without opening the code.

---

## Phase 3: A real multi-agent workflow and Gold Standard RAG (about 2 days)

> **Status:** built (steps 3.1 and 3.2). Calibrate `VITE_RAG_GOLD_MIN_SIMILARITY` once with a real key (see the note in the README).

### 3.1 Agents that hand off to each other (E1, R7)
- **Files:** `src/services/gemini.ts` (`runContractIntelligence`), `src/App.tsx` (`AnalyzingScreen`).
- Change from four independent agents to a pipeline:
  1. **Risk Auditor** and **Obligation Extractor** run in parallel.
  2. **Opposing Counsel** receives the Risk Auditor's failed rules and finds the most one-sided clauses, especially indemnification.
  3. **Commercial Dealmaker** receives Opposing Counsel's findings and writes commercially workable counter-offers. These become the redlines.
  4. **Benchmark Agent** receives the retrieved gold clauses (step 3.2).
- On the analysing screen, show the pipeline as connected steps, each with its model, time, tokens and how many excerpts it read.
- **Done when:** the analysing screen shows one agent's output feeding the next, and each redline names the Opposing Counsel finding it answers.

### 3.2 Gold Standard RAG (E2, R8, D5)
- **Files:** `src/data/goldStandards.ts`, new `src/rag/goldIndex.ts`, `src/services/gemini.ts` (benchmark agent).
- Expand the gold library from 6 to about 30 clauses. Cover the 41 CUAD clause categories that matter most: indemnity, liability cap, termination, IP ownership, confidentiality, data protection, governing law, assignment, non-compete, audit rights, warranty, SLA, payment and more. Record a source for each clause (public templates, for example the Common Crawl legal subset or CUAD examples).
- Embed the gold clauses once (cache in IndexedDB like contract chunks).
- For each contract chunk, retrieve the top 2 gold clauses by cosine similarity. Send only those pairs to the Benchmark Agent.
- Calculate **missing protections in code**: a required gold category with no contract chunk above a similarity threshold (about 0.6) is reported as missing, with the gold wording to add.
- Show the similarity score and the chunk/page next to each comparison.
- **Done when:** removing the indemnity clause from a test contract makes "Indemnification" appear as a missing protection without any prompt change.

---

## Phase 4: The vision table agent and milestone calendar (about 1.5 days)

> **Status:** built (steps 4.1 and 4.2).

### 4.1 Vision agent for tables (E3, R11)
- **Files:** `src/rag/pdfToMarkdown.ts` (already detects tables), new `src/services/tableVision.ts`.
- Find pages with tables, payment words or nested numbering (for example "Schedule", "Milestone", "Payment", "%", currency symbols).
- Render those pages to images (step 1.3) and send them to a dedicated **Table Vision Agent** with a schema for nested rows: phase → milestone → deliverable → amount → trigger → due date → page.
- Merge with the text-based milestones and drop duplicates. Mark each milestone as "read from table image" or "read from text".
- Rename the "Vision-Enhanced Table Parser" badge only if the vision agent actually ran.
- **Done when:** a PDF with a two-level milestone table (phase rows with sub-milestones) produces the right rows, with page numbers.

### 4.2 Payment milestone calendar
- **Files:** `src/components/ObligationsView.tsx`, new `src/utils/calendar.ts`.
- Ask for an effective date (taken from the contract when found, editable by the user). Turn triggers such as "30 days after the effective date" into real dates. Keep event-based triggers ("on acceptance") as undated items.
- Show a month calendar and a timeline, colour-coded by party and status.
- Add **Export to calendar (.ics)** and **Export CSV**.
- **Done when:** milestones appear on the right dates and the .ics file opens in Google Calendar or Outlook.

---

## Phase 5: Redlines and obligations polish (about 1 day)

> **Status:** built (steps 5.1, 5.2 and 5.3). The schema is downloadable from the app and kept at `src/schema/obligations.v1.json`.

### 5.1 Chain of thought for every redline (E4)
- Already shown. Add a check that drops or re-asks for any redline missing its rationale, and include the rationale as Word comments (already done) and in the full document view.

### 5.2 Full redlined document (R5)
- **Files:** `src/components/RedlineViewer.tsx`.
- Add a third view, **Full document**: the whole contract with accepted and pending changes shown inline (deletions struck through, insertions underlined). Clicking a change opens its rationale.
- Add **Download redlined PDF** (print-styled HTML to PDF) next to the Word download.
- **Done when:** the full contract can be read top to bottom with every change in place.

### 5.3 Validated obligations JSON (R4)
- **Files:** new `public/schema/obligations.v1.json`, `src/components/ObligationsView.tsx`.
- Publish a JSON Schema (draft 2020-12). Validate the export with `ajv` before download, and add `schemaVersion`, ISO dates, page numbers and clause references to every obligation.
- **Done when:** the exported file passes schema validation, and the schema link is shown next to the JSON view.

---

## Phase 6: Contract repository with natural-language search (about 3 days, the largest item)

### 6.1 Build a real corpus of 5,000+ contracts (E5, D1–D3)
- **New folder:** `scripts/repository/` (Node scripts run on your computer, not in the browser).
- Sources:
  - **CUAD v1:** 510 contracts with expert labels, including Cap on Liability, Governing Law, Termination for Convenience and Uncapped Liability. Download from the official CUAD release.
  - **MAUD:** about 150 merger agreements.
  - **EDGAR:** about 4,500 material contracts (Exhibit 10 filings). Fetch them with SEC full-text search. Requests must stay under 10 per second and send a User-Agent with contact details: **you** must choose that contact; I will not add personal details.
- For each contract, store: id, title, parties, date, type, source URL, governing law, liability cap (text and a number in USD where possible), indemnity type, termination notice days, and a 1,000-character key-terms summary.
- CUAD labels supply these fields for its 510 contracts. For EDGAR, extract them with Gemini Flash-Lite in batches over several days to stay within the free tier, or a paid key if you have one.
- **Done when:** `public/repository/contracts.json` lists 5,000+ real contracts with source links.

### 6.2 Semantic search index
- Embed each contract's key-terms summary with `gemini-embedding-001` at 256 dimensions. Store the vectors as int8 in `public/repository/vectors.bin` (about 1.3 MB for 5,000 contracts).
- Search in the browser: embed the query (through the existing proxy) and rank by cosine similarity.
- **Done when:** a search over 5,000 contracts returns in under a second after the first load.

### 6.3 Natural-language queries for non-lawyers
- **Files:** `src/components/RepositorySearch.tsx`, new `src/services/repoQuery.ts`.
- Gemini turns a question into filters plus a search text. For example, "contracts with liability caps below $1M under Delaware law" becomes `{ capUSD < 1,000,000, governingLaw = Delaware }` plus "liability cap". Apply the filters to the metadata, rank by similarity, and write a short answer that cites the matching contracts.
- Show the real contract count. Remove the made-up "5,420" label.
- Keep **Inspect in review workspace**, which loads the real contract text from its source.
- **Done when:** the five example questions in the brief's spirit return correct, cited results.

### 6.4 Cross-jurisdiction (D4)
- Add about 50 European decisions or contracts from Open Legal Data to the corpus, with jurisdiction metadata.
- Add EU gold clauses (GDPR Article 28 processor terms, Standard Contractual Clauses).
- When governing law is in the EU, the Benchmark Agent also checks these clauses.
- **Done when:** a contract under French law is checked against GDPR processor clauses.

---

## Phase 7: Real data, evaluation and submission (about 2 days)

### 7.1 Real sample contracts (D1)
- Replace the three synthetic samples with three real public contracts: one EDGAR SaaS/MSA, one MAUD merger agreement, one CUAD agreement with a payment table. Show the source link on each sample.

### 7.2 Accuracy evaluation on CUAD (D2)
- **New:** `scripts/eval/cuad-eval.ts`.
- Run the risk agent on 30 to 50 CUAD contracts and compare against CUAD's expert labels for the categories the playbooks cover. Report precision and recall per category, and quote accuracy (the share of evidence quotes found verbatim).
- Put the results table in the README and on an **About** page.
- **Done when:** the README shows a measured accuracy table.

### 7.3 Tests
- Add unit tests for the gold retrieval, missing-protection logic, milestone date calculation, .ics export, schema validation and repository query parsing. Keep `pnpm test` green.

### 7.4 Submission materials
- **README:** problem, architecture diagram (upload → PDF to Markdown → chunks → embeddings → agent pipeline → outputs), how each brief requirement is met (this checklist), setup and environment variables, limits.
- **Demo script (3 minutes):**
  1. Upload a real EDGAR contract.
  2. Pick a custom playbook.
  3. Show the agent pipeline.
  4. Show the scorecard and its suggestions.
  5. Show the redlines with rationale and download the Word file.
  6. Show the obligations JSON and the calendar export.
  7. Show the Gold Standard missing protections.
  8. Ask the 5,000-contract repository a liability-cap question.
- **Video:** record that script.
- **Pitch:** a comparison with Ironclad, Luminance, Spellbook, Kira and LawGeex. ContractMind's edge: open playbooks, explainable scoring, Bangla support, free-tier cost.

---

## Order and time

| Phase | Days | Why in this order |
| --- | --- | --- |
| 1. Demo safety | 1 | Nothing else matters if the live demo breaks |
| 2. Custom playbooks | 1 | Named in the main ask |
| 3. Agent pipeline + Gold Standard RAG | 2 | Two of the five example ideas |
| 4. Vision tables + calendar | 1.5 | Example idea three |
| 5. Redline and JSON polish | 1 | Finishes the main deliverables |
| 6. 5,000+ contract repository | 3 | Largest task; can run in parallel with 4 and 5 |
| 7. Real data, evaluation, submission | 2 | What judges read first |

Total: about 11 working days for one person. If time is short, do phases 1, 2, 3 and 7.4 first. That covers the main ask and two example ideas. Then do phase 6 with CUAD and MAUD only (about 660 real contracts) and state the true count.

## Things you need to provide

- `GEMINI_API_KEY` set for Production in Vercel.
- A contact name or email for the SEC User-Agent (step 6.1). The SEC requires it; I will not invent one.
- A decision on the Gemini tier for phase 6: the free tier makes extracting metadata for 4,500 EDGAR contracts take several days.
