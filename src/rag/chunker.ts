// Markdown → chunks. Splits at headings, tracks the heading path and start page,
// and splits oversized sections at paragraph / line / sentence breaks with overlap.
// Invariant: no text is dropped — every non-whitespace character of the input appears
// in the chunks (overlap characters repeat, and are counted in `overlapChars`).

export interface SourcePage {
  /** 1-based page number; 0 when the source has no pages (txt/docx). */
  page: number;
  markdown: string;
}

export interface Chunk {
  id: string; // "C1", "C2", … unique within a document
  index: number;
  headingPath: string; // "Chapter 2 > Payment Terms" ('' before the first heading)
  page: number; // page where the chunk's own (non-overlap) text starts
  text: string; // includes the repeated overlap prefix, if any
  overlapChars: number; // length of that repeated prefix
  embedText: string; // heading path + text: what gets embedded
}

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const WS = /\s/;

interface Line {
  t: string;
  page: number;
}
interface Section {
  path: string;
  lines: Line[];
  hasBody: boolean;
}

/** Best place to cut text[start..end): paragraph break, then line break, then sentence end, then whitespace. */
function findBreak(text: string, start: number, end: number, max: number): number {
  const minEnd = start + Math.floor(max * 0.5);
  let i = text.lastIndexOf("\n\n", end - 2);
  if (i >= minEnd) return i + 2;
  i = text.lastIndexOf("\n", end - 1);
  if (i >= minEnd) return i + 1;
  for (let j = end - 1; j >= minEnd; j--) {
    const c = text[j];
    if ((c === "." || c === "!" || c === "?" || c === ";") && (j + 1 >= text.length || WS.test(text[j + 1]))) return j + 1;
  }
  for (let j = end - 1; j >= minEnd; j--) if (WS.test(text[j])) return j + 1;
  return end;
}

export function chunkPages(pages: SourcePage[], opts: ChunkOptions): Chunk[] {
  const max = Math.max(200, opts.maxChars);
  const overlap = Math.max(0, Math.min(opts.overlapChars, Math.floor(max / 2)));

  // 1. Parse into sections at headings.
  const sections: Section[] = [];
  const stack: { level: number; title: string }[] = [];
  let cur: Section = { path: "", lines: [], hasBody: false };
  const flush = () => {
    if (cur.lines.some((l) => l.t.trim())) sections.push(cur);
  };

  for (const p of pages) {
    for (const raw of p.markdown.split("\n")) {
      const m = HEADING_RE.exec(raw);
      if (m) {
        const level = m[1].length;
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        stack.push({ level, title: m[2].trim() });
        const path = stack.map((s) => s.title).join(" > ");
        // A heading with no body of its own is carried into the next section rather than
        // becoming a useless heading-only chunk.
        const carry = !cur.hasBody && cur.lines.some((l) => l.t.trim()) ? cur.lines : [];
        if (!carry.length) flush();
        cur = { path, lines: [...carry, { t: raw, page: p.page }], hasBody: false };
      } else {
        cur.lines.push({ t: raw, page: p.page });
        if (raw.trim()) cur.hasBody = true;
      }
    }
  }
  flush();

  // 2. Section → one chunk, or several with overlap when too long.
  const chunks: Chunk[] = [];
  const push = (path: string, page: number, text: string, overlapChars: number) => {
    const index = chunks.length;
    chunks.push({
      id: `C${index + 1}`,
      index,
      headingPath: path,
      page,
      text,
      overlapChars,
      embedText: path ? `${path}\n\n${text}` : text,
    });
  };

  for (const s of sections) {
    let text = "";
    const marks: { offset: number; page: number }[] = [];
    s.lines.forEach((l, i) => {
      if (i > 0) text += "\n";
      if (!marks.length || marks[marks.length - 1].page !== l.page) marks.push({ offset: text.length, page: l.page });
      text += l.t;
    });
    const pageAt = (off: number) => {
      let pg = marks[0].page;
      for (const m of marks) if (m.offset <= off) pg = m.page;
      return pg;
    };

    if (text.length <= max) {
      push(s.path, pageAt(Math.max(0, text.search(/\S/))), text.trim(), 0);
      continue;
    }

    let start = 0;
    let prevStart = 0;
    while (start < text.length) {
      let end = Math.min(start + max, text.length);
      if (end < text.length) end = findBreak(text, start, end, max);
      if (end <= start) end = Math.min(start + max, text.length);

      const body = text.slice(start, end);
      if (body.trim()) {
        const firstNonWs = start + (body.length - body.trimStart().length);
        let ovStart = start;
        if (start > 0 && overlap > 0) {
          ovStart = Math.max(prevStart, start - overlap);
          // begin the overlap on a word boundary
          if (ovStart > prevStart && !WS.test(text[ovStart - 1])) {
            let k = ovStart;
            while (k < start && !WS.test(text[k])) k++;
            if (k < start) ovStart = k + 1;
          }
        }
        const ov = start - ovStart;
        const full = text.slice(ovStart, end).trimEnd();
        if (ov === 0) push(s.path, pageAt(firstNonWs), full.trimStart(), 0);
        else push(s.path, pageAt(firstNonWs), full, ov);
      }
      prevStart = start;
      start = end;
    }
  }
  return chunks;
}
