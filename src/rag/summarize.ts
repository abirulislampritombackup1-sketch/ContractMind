// Whole-document tasks ("summarize the entire contract"): instead of sending everything in
// one request, summarise consecutive chunks in groups, then combine the partial summaries.

import type { Chunk } from "./chunker";
import { RAG_CONFIG } from "./config";
import { labelOf } from "./promptBuilder";

export type Generate = (prompt: string, label: string) => Promise<string>;

/** Detects requests that need the whole document rather than a few passages. */
export const needsWholeDocument = (q: string) =>
  /\b(summari[sz]e|summary|overview|recap|outline)\b[^.?!]{0,60}\b(whole|entire|full|complete|all|document|contract|agreement|pdf)\b/i.test(q) ||
  /\b(whole|entire|full|complete)\s+(document|contract|agreement|pdf)\b/i.test(q) ||
  /\bwhat\s+is\s+(this|the)\s+(document|contract|agreement)\s+about\b/i.test(q);

/** Group consecutive chunks (minus their overlap) into batches of about `maxChars`. */
export function batchChunks(chunks: Chunk[], maxChars: number): Chunk[][] {
  const batches: Chunk[][] = [];
  let cur: Chunk[] = [];
  let size = 0;
  for (const c of chunks) {
    if (cur.length && size + c.text.length > maxChars) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(c);
    size += c.text.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

const PART_PROMPT = `Summarise the following consecutive excerpts from a contract. Keep every concrete term: parties, dates, amounts, percentages, deadlines, obligations, rights, exceptions and clause/section numbers. Use compact bullet points. Do not add anything that is not in the excerpts.`;

export async function summarizeDocument(
  chunks: Chunk[],
  generate: Generate,
  opts: { instruction?: string; languageNote?: string } = {}
): Promise<string> {
  const maxChars = RAG_CONFIG.summaryBatchChars;
  const batches = batchChunks(chunks, maxChars);

  let partials: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    // overlap text is dropped here, since the previous chunk already contains it
    const text = batches[i].map((c) => `${labelOf(c)}\n${c.text.slice(c.overlapChars)}`).join("\n\n");
    partials.push(await generate(`${PART_PROMPT}\n\n${text}`, `summary-part-${i + 1}/${batches.length}`));
  }

  // Reduce until the partial summaries fit in one request.
  let round = 0;
  while (partials.join("\n\n").length > maxChars && partials.length > 1) {
    const grouped: string[] = [];
    let cur: string[] = [];
    let size = 0;
    for (const p of partials) {
      if (cur.length && size + p.length > maxChars) {
        grouped.push(cur.join("\n\n"));
        cur = [];
        size = 0;
      }
      cur.push(p);
      size += p.length;
    }
    grouped.push(cur.join("\n\n"));
    const next: string[] = [];
    for (let i = 0; i < grouped.length; i++) {
      next.push(await generate(`${PART_PROMPT}\n\n${grouped[i]}`, `summary-merge-${++round}`));
    }
    if (next.length >= partials.length) break; // cannot shrink further
    partials = next;
  }

  if (partials.length === 1 && batches.length === 1 && !opts.instruction) return partials[0];

  const finalPrompt = `Below are summaries of consecutive parts of one contract. Combine them into one coherent answer.
Task: ${opts.instruction || "Write a clear overall summary of the whole contract."}
Use only the information in these summaries; keep section numbers and key figures. ${opts.languageNote || ""}

${partials.map((p, i) => `--- Part ${i + 1} ---\n${p}`).join("\n\n")}`;
  return generate(finalPrompt, "summary-final");
}
