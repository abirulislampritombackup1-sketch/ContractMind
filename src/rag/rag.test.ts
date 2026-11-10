import { describe, expect, it, vi } from "vitest";
import { chunkPages } from "./chunker";
import { embedTexts } from "./embedder";
import { buildExcerptBlock } from "./promptBuilder";
import { convertLines, Line } from "./pdfToMarkdown";
import { cosine, retrieve } from "./retriever";
import { batchChunks, needsWholeDocument, summarizeDocument } from "./summarize";

const unit = (...v: number[]) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};

describe("retriever", () => {
  const chunks = chunkPages(
    [{ page: 1, markdown: "# A\n\nalpha\n\n# B\n\nbeta\n\n# C\n\ngamma\n\n# D\n\ndelta" }],
    { maxChars: 2000, overlapChars: 200 }
  );
  const vectors = [unit(1, 0, 0), unit(0, 1, 0), unit(0, 0, 1), unit(1, 1, 0)];

  it("computes cosine similarity", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns the top K chunks in document order", () => {
    const r = retrieve(chunks, vectors, [unit(0, 1, 0)], { topK: 2 });
    expect(r.map((x) => x.chunk.id)).toEqual(["C2", "C4"]); // B (exact) and D (partial), re-sorted by position
  });

  it("merges several queries and caps at topK", () => {
    const r = retrieve(chunks, vectors, [unit(1, 0, 0), unit(0, 0, 1)], { topK: 2, perQuery: 1 });
    expect(r.map((x) => x.chunk.id)).toEqual(["C1", "C3"]);
  });
});

describe("prompt builder", () => {
  it("labels each excerpt with chunk id, heading and page", () => {
    const chunks = chunkPages([{ page: 4, markdown: "# Fees\n\n## Payment\n\nPay in 30 days." }], { maxChars: 2000, overlapChars: 200 });
    const block = buildExcerptBlock(chunks, 9);
    expect(block).toContain("[C1] | Heading: Fees > Payment | Page: 4");
    expect(block).toContain("Pay in 30 days.");
    expect(block).toContain("1 of 9");
  });
});

describe("embedder", () => {
  const ok = (n: number) =>
    new Response(JSON.stringify({ embeddings: Array.from({ length: n }, () => ({ values: [3, 4] })) }), { status: 200 });

  it("batches 100 texts per request and normalises vectors", async () => {
    const fetchImpl = vi.fn(async (_u: any, init: any) => ok(JSON.parse(init.body).requests.length));
    const out = await embedTexts(Array.from({ length: 250 }, (_, i) => `t${i}`), "RETRIEVAL_DOCUMENT", { fetchImpl: fetchImpl as any });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(out).toHaveLength(250);
    expect(out[0][0]).toBeCloseTo(0.6);
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
    expect(body.requests[0].taskType).toBe("RETRIEVAL_DOCUMENT");
  });

  it("retries rate limits with exponential backoff", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async () => (++calls < 3 ? new Response("{}", { status: 429 }) : ok(1)));
    await embedTexts(["x"], "RETRIEVAL_QUERY", { fetchImpl: fetchImpl as any, sleep: async (ms) => void sleeps.push(ms) });
    expect(calls).toBe(3);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(2000);
    expect(sleeps[1]).toBeGreaterThan(sleeps[0]);
  });

  it("does not retry client errors", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 403 }));
    await expect(embedTexts(["x"], "RETRIEVAL_QUERY", { fetchImpl: fetchImpl as any, sleep: async () => {} })).rejects.toThrow(/403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("whole-document fallback", () => {
  it("detects whole-document requests", () => {
    expect(needsWholeDocument("Summarize the whole PDF")).toBe(true);
    expect(needsWholeDocument("Give me an overview of the entire contract")).toBe(true);
    expect(needsWholeDocument("What is the liability cap?")).toBe(false);
  });

  it("summarises batch by batch, then combines", async () => {
    const md = Array.from({ length: 30 }, (_, i) => `# S${i}\n\n${"word ".repeat(400)}`).join("\n\n");
    const chunks = chunkPages([{ page: 1, markdown: md }], { maxChars: 2000, overlapChars: 200 });
    expect(batchChunks(chunks, 12000).length).toBeGreaterThan(1);
    const labels: string[] = [];
    const generate = async (_p: string, label: string) => (labels.push(label), `summary(${label})`);
    const out = await summarizeDocument(chunks, generate, { instruction: "Summarize the whole contract" });
    expect(labels.filter((l) => l.startsWith("summary-part")).length).toBe(batchChunks(chunks, 12000).length);
    expect(labels[labels.length - 1]).toBe("summary-final");
    expect(out).toBe("summary(summary-final)");
  });
});

describe("pdf → markdown", () => {
  const line = (text: string, y: number, size = 10, cells?: string[]): Line => ({ y, x: 50, size, text, cells: cells ?? [text] });
  const body = (t: string, y: number) => line(t.repeat(1), y);
  const page1: Line[] = [
    line("MASTER SERVICES AGREEMENT", 800, 20),
    line("2.1 Payment Terms", 760, 10),
    body("Invoices are payable within thirty days of receipt and late amounts accrue interest at the stated rate.", 740),
    body("Interest continues until the balance is paid in full by the customer to the provider.", 728),
    line("• First bullet point item", 700),
    line("Milestone Amount Due", 660, 10, ["Milestone", "Amount", "Due"]),
    line("Design $10,000 30 days", 648, 10, ["Design", "$10,000", "30 days"]),
    line("Page 1", 20),
  ];
  const res = convertLines([page1, [line("  ", 800)]]);

  it("detects headings, paragraphs, lists and tables, and drops bare page numbers", () => {
    const md = res.pages[0].markdown;
    expect(md).toContain("# MASTER SERVICES AGREEMENT");
    expect(md).toContain("## 2.1 Payment Terms");
    expect(md).toMatch(/receipt and late amounts accrue interest[^\n]* Interest continues/); // wrapped lines joined
    expect(md).toContain("- First bullet point item");
    expect(md).toContain("| Milestone | Amount | Due |\n| --- | --- | --- |\n| Design | $10,000 | 30 days |");
    expect(md).not.toMatch(/Page 1/);
  });

  it("flags pages with almost no text for OCR", () => {
    expect(res.lowTextPages).toEqual([2]);
    expect(res.pages[0].lowText).toBe(false);
  });
});
