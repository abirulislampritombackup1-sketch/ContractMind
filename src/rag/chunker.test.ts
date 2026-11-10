import { describe, expect, it } from "vitest";
import { chunkPages, SourcePage } from "./chunker";

const squash = (s: string) => s.replace(/\s+/g, "");
const sentence = (n: number) => `Sentence number ${n} says that the parties shall perform obligation ${n} promptly.`;
const longBody = (count: number) => Array.from({ length: count }, (_, i) => sentence(i)).join(" ");

const OPTS = { maxChars: 2000, overlapChars: 200 };

/** Rebuild the document from chunks by dropping each chunk's repeated overlap prefix. */
const rebuild = (chunks: ReturnType<typeof chunkPages>) => chunks.map((c) => c.text.slice(c.overlapChars)).join("\n");

describe("chunkPages: headings", () => {
  const pages: SourcePage[] = [
    {
      page: 1,
      markdown: [
        "Preamble text before any heading.",
        "",
        "# Chapter 1",
        "",
        "## Definitions",
        "",
        "Terms are defined here.",
        "",
        "## Payment Terms",
        "",
        "Invoices are due in 30 days.",
        "",
        "### Late Fees",
        "",
        "Interest is 1% per month.",
      ].join("\n"),
    },
    {
      page: 2,
      markdown: ["More late fee text on the next page.", "", "# Chapter 2", "", "## Termination", "", "Either party may terminate."].join("\n"),
    },
  ];
  const chunks = chunkPages(pages, OPTS);

  it("tracks the heading path, popping siblings and parents correctly", () => {
    const byText = (needle: string) => chunks.find((c) => c.text.includes(needle))!;
    expect(byText("Preamble").headingPath).toBe("");
    expect(byText("Terms are defined").headingPath).toBe("Chapter 1 > Definitions");
    expect(byText("due in 30 days").headingPath).toBe("Chapter 1 > Payment Terms");
    expect(byText("1% per month").headingPath).toBe("Chapter 1 > Payment Terms > Late Fees");
    expect(byText("Either party may terminate").headingPath).toBe("Chapter 2 > Termination");
  });

  it("records the page where a section starts, even when it continues on the next page", () => {
    const late = chunks.find((c) => c.text.includes("1% per month"))!;
    expect(late.page).toBe(1);
    expect(late.text).toContain("next page"); // continuation stays in the same chunk
    expect(chunks.find((c) => c.text.includes("Either party"))!.page).toBe(2);
  });

  it("does not create heading-only chunks", () => {
    expect(chunks.every((c) => c.text.replace(/^#+.*$/gm, "").trim().length > 0)).toBe(true);
    expect(chunks.find((c) => c.text.startsWith("# Chapter 1"))?.headingPath).toBe("Chapter 1 > Definitions");
  });

  it("gives ids C1..Cn and prefixes the embedding text with the heading path", () => {
    expect(chunks.map((c) => c.id)).toEqual(chunks.map((_, i) => `C${i + 1}`));
    const c = chunks.find((x) => x.headingPath === "Chapter 2 > Termination")!;
    expect(c.embedText.startsWith("Chapter 2 > Termination\n\n")).toBe(true);
  });
});

describe("chunkPages: no text lost", () => {
  it("keeps every character of short sections", () => {
    const pages: SourcePage[] = [
      { page: 1, markdown: "# A\n\nAlpha text.\n\n# B\n\nBeta text.\n\n## C\n\nGamma text." },
      { page: 2, markdown: "# D\n\n| x | y |\n| --- | --- |\n| 1 | 2 |" },
    ];
    const all = pages.map((p) => p.markdown).join("\n");
    expect(squash(rebuild(chunkPages(pages, OPTS)))).toBe(squash(all));
  });

  it("keeps every character when sections are split", () => {
    const md = `# Big\n\n${longBody(120)}\n\n## Small\n\nTail text.`;
    const chunks = chunkPages([{ page: 1, markdown: md }], OPTS);
    expect(chunks.length).toBeGreaterThan(3);
    expect(squash(rebuild(chunks))).toBe(squash(md));
  });

  it("keeps every character of a single giant paragraph with no break points", () => {
    const md = "x".repeat(7500);
    const chunks = chunkPages([{ page: 1, markdown: md }], OPTS);
    expect(squash(rebuild(chunks))).toBe(md);
  });
});

describe("chunkPages: long sections", () => {
  const md = `# Liability\n\n${longBody(100)}`;
  const chunks = chunkPages([{ page: 3, markdown: md }], OPTS);

  it("splits sections over the size limit, all under the heading", () => {
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.headingPath).toBe("Liability");
      expect(c.page).toBe(3);
      expect(c.text.length - c.overlapChars).toBeLessThanOrEqual(OPTS.maxChars);
    }
  });

  it("repeats the end of each piece at the start of the next", () => {
    for (let i = 1; i < chunks.length; i++) {
      const overlap = chunks[i].text.slice(0, chunks[i].overlapChars).trim();
      expect(overlap.length).toBeGreaterThan(0);
      expect(overlap.length).toBeLessThanOrEqual(OPTS.overlapChars);
      expect(chunks[i - 1].text.includes(overlap)).toBe(true);
    }
    expect(chunks[0].overlapChars).toBe(0);
  });

  it("prefers sentence breaks over mid-sentence cuts", () => {
    for (const c of chunks.slice(0, -1)) expect(c.text.trimEnd()).toMatch(/[.!?]$/);
  });

  it("splits at paragraph breaks when available", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `Paragraph ${i}. ${longBody(4)}`).join("\n\n");
    const cs = chunkPages([{ page: 1, markdown: `# P\n\n${paras}` }], { maxChars: 1000, overlapChars: 100 });
    for (const c of cs.slice(0, -1)) expect(c.text).toMatch(/\.$/);
    expect(squash(rebuild(cs))).toBe(squash(`# P\n\n${paras}`));
  });

  it("tracks the page of a split piece when the section spans pages", () => {
    const cs = chunkPages(
      [
        { page: 1, markdown: `# Long\n\n${longBody(40)}` },
        { page: 2, markdown: longBody(40) },
      ],
      OPTS
    );
    expect(cs[0].page).toBe(1);
    expect(cs[cs.length - 1].page).toBe(2);
  });
});
