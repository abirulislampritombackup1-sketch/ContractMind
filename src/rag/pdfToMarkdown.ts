// PDF → Markdown, built on pdf.js text items (no extra dependency, runs in the browser).
// Keeps page numbers, detects headings (font size / numbering / ALL-CAPS), lists and
// simple tables (cells separated by wide gaps), and flags pages with almost no text
// (scanned pages) so OCR can be added later.

import { RAG_CONFIG } from "./config";

export interface PdfPageLike {
  getTextContent(): Promise<{ items: any[] }>;
}
export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}
export interface PageMarkdown {
  page: number; // 1-based
  markdown: string;
  charCount: number; // meaningful (non-space, non-markup) characters
  lowText: boolean; // likely scanned: needs OCR
}
export interface ConversionResult {
  pages: PageMarkdown[];
  lowTextPages: number[];
}

export interface Line {
  y: number;
  x: number;
  size: number;
  text: string;
  cells: string[];
}

const BULLET_MARK_RE = /^([•●▪◦○■▫‣\-–—*])\s+/;
const BULLET_RE = /^([•●▪◦○■▫‣\-–—*]|\(?[a-zA-Z0-9]{1,3}[.)])\s+/;
const PAGE_NUMBER_RE = /^(page\s+)?\d+(\s*(of|\/)\s*\d+)?$/i;
const NUMBERED_HEADING_RE = /^(\d+(?:\.\d+)*)[.)]?\s+\S/;
const KEYWORD_HEADING_RE = /^(article|section|chapter|part|schedule|exhibit|appendix)\s+[\dIVXLCA-Z]+\b/i;

/** Group raw pdf.js items into visual lines; wide gaps become table cells. */
function buildLines(items: any[]): Line[] {
  const prepared = items
    .filter((it) => it && typeof it.str === "string" && Array.isArray(it.transform))
    .map((it) => ({
      str: it.str as string,
      x: it.transform[4] as number,
      y: it.transform[5] as number,
      w: (it.width as number) || 0,
      size: Math.abs(it.transform[3]) || (it.height as number) || 10,
    }))
    .filter((it) => it.str.length > 0);

  prepared.sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: (typeof prepared)[] = [];
  for (const it of prepared) {
    const g = groups[groups.length - 1];
    const ref = g?.[0];
    if (g && ref && Math.abs(it.y - ref.y) <= Math.max(2, ref.size * 0.5)) g.push(it);
    else groups.push([it]);
  }

  const lines: Line[] = [];
  for (const g of groups) {
    g.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let cur = "";
    let prevEnd: number | null = null;
    const sizeWeight = new Map<number, number>();
    for (const it of g) {
      const rounded = Math.round(it.size * 2) / 2;
      sizeWeight.set(rounded, (sizeWeight.get(rounded) || 0) + it.str.trim().length);
      if (it.str.trim() === "") {
        if (prevEnd !== null) prevEnd = Math.max(prevEnd, it.x + it.w);
        continue;
      }
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > it.size * 1.8 && cur.trim()) {
          cells.push(cur.trim());
          cur = "";
        } else if (gap > it.size * 0.12 && cur && !/\s$/.test(cur) && !/^\s/.test(it.str)) {
          cur += " ";
        }
      }
      cur += it.str;
      prevEnd = it.x + it.w;
    }
    if (cur.trim()) cells.push(cur.trim());
    if (!cells.length) continue;
    let size = 10;
    let best = -1;
    for (const [s, w] of sizeWeight) {
      if (w > best) {
        best = w;
        size = s;
      }
    }
    lines.push({ y: g[0].y, x: g[0].x, size, text: cells.join(" "), cells });
  }
  return lines;
}

type Block = { kind: "heading" | "list" | "table" | "para"; text: string };

export async function convertPdfToMarkdown(pdf: PdfDocLike): Promise<ConversionResult> {
  const perPage: Line[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    perPage.push(buildLines(content.items));
  }
  return convertLines(perPage);
}

/** Exported for tests: converts already-grouped lines (one array per page). */
export function convertLines(perPage: Line[][]): ConversionResult {
  // Body font size = the most common size, weighted by characters.
  const weight = new Map<number, number>();
  for (const lines of perPage) for (const l of lines) weight.set(l.size, (weight.get(l.size) || 0) + l.text.length);
  let body = 10;
  let bestW = -1;
  for (const [s, w] of weight) {
    if (w > bestW) {
      bestW = w;
      body = s;
    }
  }

  // Sizes larger than body, biggest first → heading level 1, 2, 3…
  const headingSizes = [...weight.keys()].filter((s) => s >= body * 1.15).sort((a, b) => b - a);
  const sizeLevel = (s: number) => Math.min(4, headingSizes.indexOf(s) + 1);

  const pages: PageMarkdown[] = [];
  perPage.forEach((lines, idx) => {
    const kept = lines.filter((l) => !PAGE_NUMBER_RE.test(l.text.trim()));
    const isRow = (l?: Line) => !!l && l.cells.length >= 2;
    const blocks: Block[] = [];
    let prevLine: Line | undefined;

    kept.forEach((l, i) => {
      const text = l.text.trim();
      const tableRow = isRow(l) && (isRow(kept[i - 1]) || isRow(kept[i + 1]));
      let block: Block;

      if (tableRow) {
        block = { kind: "table", text: `| ${l.cells.join(" | ")} |` };
      } else if (l.size >= body * 1.15 && text.length <= 150) {
        block = { kind: "heading", text: `${"#".repeat(Math.max(1, sizeLevel(l.size)))} ${text}` };
      } else if (KEYWORD_HEADING_RE.test(text) && text.length <= 100) {
        block = { kind: "heading", text: `${/^(article|chapter|part)/i.test(text) ? "#" : "##"} ${text}` };
      } else if (NUMBERED_HEADING_RE.test(text) && text.length <= 80 && !/[.;,:]$/.test(text)) {
        const depth = text.match(NUMBERED_HEADING_RE)![1].split(".").length;
        block = { kind: "heading", text: `${"#".repeat(Math.min(4, depth + 1))} ${text}` };
      } else if (text.length <= 80 && /[A-Z]{4}/.test(text) && text === text.toUpperCase() && !/\d{3,}/.test(text) && !/[.;]$/.test(text)) {
        block = { kind: "heading", text: `## ${text}` };
      } else if (BULLET_RE.test(text)) {
        block = { kind: "list", text: `- ${text.replace(BULLET_MARK_RE, "")}` };
      } else {
        block = { kind: "para", text };
      }

      const prev = blocks[blocks.length - 1];
      const gap = prevLine ? prevLine.y - l.y : 0;
      if (block.kind === "para" && (prev?.kind === "para" || prev?.kind === "list") && gap <= l.size * 1.7) {
        prev.text += " " + block.text; // wrapped line of the same paragraph / list item
      } else {
        blocks.push(block);
      }
      prevLine = l;
    });

    // Table rows and list items stay on consecutive lines; everything else is a paragraph.
    let md = "";
    let sepAdded = false;
    blocks.forEach((b, i) => {
      const prev = blocks[i - 1];
      if (i > 0) md += prev.kind === b.kind && (b.kind === "list" || b.kind === "table") ? "\n" : "\n\n";
      md += b.text;
      if (b.kind === "table") {
        if (prev?.kind !== "table") sepAdded = false;
        if (!sepAdded) {
          const cols = b.text.split("|").length - 2;
          md += "\n|" + " --- |".repeat(Math.max(1, cols));
          sepAdded = true;
        }
      }
    });

    const charCount = blocks.reduce((n, b) => n + b.text.replace(/[#|\-\s]/g, "").length, 0);
    pages.push({ page: idx + 1, markdown: md, charCount, lowText: charCount < RAG_CONFIG.minPageChars });
  });

  return { pages, lowTextPages: pages.filter((p) => p.lowText).map((p) => p.page) };
}
