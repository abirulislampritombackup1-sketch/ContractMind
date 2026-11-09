import {
  BorderStyle,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  DeletedTextRun,
  Document,
  HeadingLevel,
  InsertedTextRun,
  Packer,
  Paragraph,
  ParagraphChild,
  TextRun,
} from "docx";
import { RedlineItem } from "../types";
import { normalizeWithMap, locateQuote } from "./textMatch";

/**
 * Builds a Word (.docx) file of the contract with every suggested redline as a
 * real tracked change (w:del / w:ins) plus a margin comment carrying the AI's
 * legal rationale — so it opens in Word / Google Docs as a genuine redline that
 * counsel can Accept / Reject change by change.
 */

const AUTHOR = "ContractMind AI";

export type RedlineDocxResult = {
  blob: Blob;
  placed: number; // redlines anchored at their exact location in the contract
  unplaced: number; // redlines whose quote could not be found (listed in an appendix)
};

type Located = { r: RedlineItem; start: number; end: number; commentId: number };

// ── Document assembly ────────────────────────────────────────────────────────

export async function buildRedlinedDocx(opts: {
  contractText: string;
  redlines: RedlineItem[];
  title: string;
  playbook?: string;
}): Promise<RedlineDocxResult> {
  const date = new Date();
  const iso = date.toISOString();
  let revId = 1;
  const rev = () => ({ id: revId++, author: AUTHOR, date: iso });

  const isScanned = !opts.contractText.trim() || opts.contractText.startsWith("[Scanned PDF");
  const text = isScanned ? "" : opts.contractText.replace(/\r\n?/g, "\n");
  const hay = normalizeWithMap(text);

  // Rejected redlines are left out; accepted + pending go in as tracked changes.
  const candidates = opts.redlines.filter((r) => r.accepted !== false);

  const located: Located[] = [];
  const unplaced: (RedlineItem & { commentId: number })[] = [];
  let commentId = 0;
  for (const r of candidates) {
    const hit = text ? locateQuote(hay, r.originalText) : null;
    const id = commentId++;
    if (hit && !located.some((l) => hit.start < l.end && l.start < hit.end)) {
      located.push({ r, start: hit.start, end: hit.end, commentId: id });
    } else {
      unplaced.push({ ...r, commentId: id });
    }
  }
  located.sort((a, b) => a.start - b.start);

  // Body paragraphs built from the contract text with changes spliced in.
  const paras: { children: ParagraphChild[]; raw: string }[] = [{ children: [], raw: "" }];
  const cur = () => paras[paras.length - 1];
  const emit = (kind: "text" | "del" | "ins", s: string) => {
    s.split("\n").forEach((part, i) => {
      if (i > 0) paras.push({ children: [], raw: "" });
      if (!part) return;
      if (kind === "text") {
        cur().children.push(new TextRun(part));
        cur().raw += part;
      } else if (kind === "del") {
        cur().children.push(new DeletedTextRun({ text: part, ...rev() }));
      } else {
        cur().children.push(new InsertedTextRun({ text: part, ...rev() }));
      }
    });
  };

  let pos = 0;
  for (const l of located) {
    emit("text", text.slice(pos, l.start));
    cur().children.push(new CommentRangeStart(l.commentId));
    const original = text.slice(l.start, l.end);
    if (l.r.action === "insert") {
      emit("text", original);
      emit("ins", " " + l.r.proposedText);
    } else {
      emit("del", original);
      if (l.r.action === "replace") emit("ins", l.r.proposedText);
    }
    cur().children.push(new CommentRangeEnd(l.commentId));
    cur().children.push(new TextRun({ children: [new CommentReference(l.commentId)] }));
    pos = l.end;
  }
  emit("text", text.slice(pos));

  const PAGE_MARK = /^\s*\[Page (\d+)\]\s*$/;
  let firstPage = true;
  const body: Paragraph[] = [];
  for (const p of paras) {
    const m = p.raw.match(PAGE_MARK);
    if (m && p.children.length <= 1) {
      // PDF page markers from extraction become real page breaks.
      if (!firstPage) body.push(new Paragraph({ children: [], pageBreakBefore: true }));
      firstPage = false;
      continue;
    }
    if (!p.children.length && !p.raw.trim()) continue; // collapse blank lines
    body.push(new Paragraph({ children: p.children, spacing: { after: 120 } }));
  }

  // Header block (not tracked).
  const header: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`Redline: ${opts.title}`)] }),
    new Paragraph({
      children: [
        new TextRun({ text: `Prepared by ContractMind AI on ${date.toLocaleDateString()}`, color: "666666" }),
        ...(opts.playbook ? [new TextRun({ text: ` · Playbook: ${opts.playbook}`, color: "666666" })] : []),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 8 } },
      children: [
        new TextRun({
          text: `${candidates.length} suggested change${candidates.length === 1 ? "" : "s"} shown as tracked changes${
            unplaced.length ? ` (${unplaced.length} listed in the appendix)` : ""
          }. Each change has a comment explaining the legal rationale. Use Review → Accept / Reject in Word to decide on each one.`,
          italics: true,
          color: "666666",
          size: 18,
        }),
      ],
    }),
  ];

  if (isScanned) {
    body.push(
      new Paragraph({
        children: [new TextRun({ text: "The original document is a scanned PDF, so its text is not reproduced here. The suggested changes are listed below.", italics: true })],
      })
    );
  }

  // Appendix for redlines that could not be anchored in the text.
  const appendix: Paragraph[] = [];
  if (unplaced.length) {
    appendix.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: !isScanned, children: [new TextRun("Appendix: changes to apply manually")] }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "The quoted wording for these changes could not be matched exactly in the document text. Each shows the original wording and the proposed replacement as tracked changes.", italics: true, color: "666666" })],
      })
    );
    for (const r of unplaced) {
      appendix.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(`${r.clauseId} — ${r.sectionTitle}`)] }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new CommentRangeStart(r.commentId),
            ...(r.action !== "insert" ? [new DeletedTextRun({ text: r.originalText, ...rev() })] : [new TextRun(r.originalText + " ")]),
            ...(r.action !== "delete" ? [new InsertedTextRun({ text: (r.action === "replace" ? " " : "") + r.proposedText, ...rev() })] : []),
            new CommentRangeEnd(r.commentId),
            new TextRun({ children: [new CommentReference(r.commentId)] }),
          ],
        })
      );
    }
  }

  const commentFor = (r: RedlineItem, id: number) => ({
    id,
    author: AUTHOR,
    initials: "CM",
    date,
    children: [
      new Paragraph({ children: [new TextRun({ text: `${r.severity} · ${r.clauseId} — ${r.sectionTitle}`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: "Why change it: ", bold: true }), new TextRun(r.chainOfThought.legalRationale)] }),
      new Paragraph({ children: [new TextRun({ text: "Business risk: ", bold: true }), new TextRun(r.chainOfThought.commercialRiskAssessment)] }),
      new Paragraph({ children: [new TextRun({ text: "Other side's position: ", bold: true }), new TextRun(r.chainOfThought.opposingCounselStance)] }),
      new Paragraph({ children: [new TextRun({ text: "Talking point: ", bold: true }), new TextRun(r.chainOfThought.negotiationTalkingPoint)] }),
      new Paragraph({ children: [new TextRun({ text: r.accepted ? "Status: accepted in ContractMind" : "Status: pending review", italics: true })] }),
    ],
  });

  const doc = new Document({
    creator: AUTHOR,
    title: `Redline: ${opts.title}`,
    features: { trackRevisions: true },
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    comments: {
      children: [
        ...located.map((l) => commentFor(l.r, l.commentId)),
        ...unplaced.map((r) => commentFor(r, r.commentId)),
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } },
        children: [...header, ...body, ...appendix],
      },
    ],
  });

  return { blob: await Packer.toBlob(doc), placed: located.length, unplaced: unplaced.length };
}
