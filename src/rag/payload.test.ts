// Offline before/after estimate of the document tokens sent to Gemini, using a synthetic
// 60-section agreement (no API key needed). Retrieval picks the K most relevant chunks; this test
// charges it the K LARGEST chunks, so the RAG number is a worst case.
// Real numbers: run the app with VITE_RAG_ENABLED=false vs true and read
// `__contractmindTokens.totals()` in the browser console (usageMetadata from every response).

import { describe, expect, it } from "vitest";
import { chunkPages } from "./chunker";
import { RAG_CONFIG } from "./config";
import { buildExcerptBlock } from "./promptBuilder";

const TOPICS = [
  "Payment Terms", "Limitation of Liability", "Indemnification", "Termination", "Confidentiality", "Data Protection",
  "Intellectual Property", "Service Levels", "Warranties", "Governing Law", "Force Majeure", "Audit Rights",
];

function syntheticContract(sections: number) {
  const pages: { page: number; markdown: string }[] = [];
  for (let i = 0; i < sections; i++) {
    const topic = TOPICS[i % TOPICS.length];
    const n = i + 1;
    const para = (k: number) =>
      `${n}.${k} The ${topic.toLowerCase()} obligations of the Provider and the Customer under this Agreement apply to all Services, Statements of Work and ` +
      `Deliverables, and each party shall comply with the notice periods, cure periods, fees and standards set out in Schedule ${n} and in Section ${n}.${k}.`;
    const md = `## ${n}. ${topic}\n\n${[1, 2, 3, 4, 5, 6].map(para).join("\n\n")}`;
    pages.push({ page: Math.floor(i / 1.5) + 1, markdown: md });
  }
  return pages;
}

describe("token payload estimate (synthetic 60-section contract)", () => {
  const pages = syntheticContract(60);
  const fullText = pages.map((p) => `[Page ${p.page}]\n${p.markdown}`).join("\n");
  const chunks = chunkPages(pages, { maxChars: RAG_CONFIG.chunkSize, overlapChars: RAG_CONFIG.chunkOverlap });
  const tok = (chars: number) => Math.ceil(chars / 4);
  const bySize = [...chunks].sort((a, b) => b.text.length - a.text.length);
  const ragChars = (k: number) => buildExcerptBlock(bySize.slice(0, Math.min(k, chunks.length)), chunks.length).length;

  // Same per-task K as src/services/gemini.ts: base K × scale.
  const K = RAG_CONFIG.topK;
  const tasks = [
    { name: "risk agent", k: Math.round(K * 3) },
    { name: "redlines agent", k: Math.round(K * 2.5) },
    { name: "obligations agent", k: Math.round(K * 3) },
    { name: "benchmarks agent", k: Math.round(K * 2) },
    { name: "chat question", k: K },
  ];

  it("sends far fewer document tokens than the whole document", () => {
    const rows = tasks.map((t) => ({ task: t.name, before: tok(fullText.length), after: tok(ragChars(t.k)), chunks: `${t.k}/${chunks.length}` }));
    const before = rows.reduce((s, r) => s + r.before, 0);
    const after = rows.reduce((s, r) => s + r.after, 0);
    const analysis = rows.slice(0, 4).reduce((s, r) => ({ b: s.b + r.before, a: s.a + r.after }), { b: 0, a: 0 });
    console.table(rows);
    console.log(
      `Document: ${fullText.length.toLocaleString()} chars (~${tok(fullText.length).toLocaleString()} tokens), ${chunks.length} chunks.\n` +
        `One analysis (4 agents): ${analysis.b.toLocaleString()} -> ${analysis.a.toLocaleString()} document tokens (${Math.round((1 - analysis.a / analysis.b) * 100)}% less).\n` +
        `Analysis + 1 chat question: ${before.toLocaleString()} -> ${after.toLocaleString()} (${Math.round((1 - after / before) * 100)}% less).`
    );
    expect(after).toBeLessThan(before * 0.5);
  });
});
