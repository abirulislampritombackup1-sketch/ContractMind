// Builds the prompt text sent to Gemini in place of the whole document.

import type { Chunk } from "./chunker";

export const NOT_FOUND = "Not found in the document";

export const labelOf = (c: Chunk) => {
  const parts = [`[${c.id}]`];
  parts.push(c.headingPath ? `Heading: ${c.headingPath}` : "Heading: (none)");
  if (c.page > 0) parts.push(`Page: ${c.page}`);
  return parts.join(" | ");
};

/** The retrieved excerpts, in document order, each labelled with chunk ID, heading and page. */
export function buildExcerptBlock(chunks: Chunk[], totalChunks: number): string {
  const body = chunks.map((c) => `${labelOf(c)}\n${c.text}`).join("\n\n---\n\n");
  return `=== CONTRACT EXCERPTS (${chunks.length} of ${totalChunks} sections, retrieved as most relevant to the task, in document order) ===\n${body}`;
}

/** Rules for free-text answers (chat): excerpts only, "Not found" fallback, cite chunk IDs. */
export const ANSWER_RULES = `=== RULES FOR USING THE EXCERPTS ===
- Answer ONLY from the contract excerpts provided. Do not use outside knowledge about this contract.
- If the answer is not in the excerpts, reply exactly: "${NOT_FOUND}" (you may add what is missing).
- Cite the chunk IDs you used in square brackets, e.g. [C4], [C7], next to the statements they support.
- Excerpts are part of a longer document; do not assume anything about sections you cannot see.`;

/** Rules for the structured-JSON analysis agents (schema fixed, so no chunk-ID field). */
export const AGENT_RULES = `=== RULES FOR USING THE EXCERPTS ===
- The contract is provided only as the excerpts above: the sections most relevant to this task, not the whole document.
- Base everything ONLY on these excerpts. If a provision is not in them, treat it as absent ("Not Addressed" / "Not found in the document") rather than guessing.
- Verbatim quotes must be plain text copied from the excerpts, without Markdown symbols (#, -, |) and without the [C#] labels.
- Use the section numbers and page numbers shown in the excerpts for clause references.`;
