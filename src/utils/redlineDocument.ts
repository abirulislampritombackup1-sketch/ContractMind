// The whole contract with the redlines placed where they belong. Used by the "Full
// document" view, the redlined PDF and the clean (accepted-changes) text export.
//
// Each redline's quote is located with the same tolerant matching used elsewhere
// (whitespace, quotes and case are normalised). Changes whose quote cannot be found,
// or that overlap an earlier change, are listed separately instead of being guessed.

import type { RedlineItem } from "../types";
import { locateQuote, normalizeWithMap } from "./textMatch";
import { escapeHtml } from "./printHtml";

export type DocSegment = { kind: "text"; text: string } | { kind: "change"; redline: RedlineItem; original: string };

export type RedlinedDocument = {
  segments: DocSegment[];
  unplaced: RedlineItem[]; // quote not found, or overlapping another change
  inserts: RedlineItem[]; // new clauses (action "insert"), shown as additions
};

/** Splits the contract into plain text and changes. `include` picks which redlines to show. */
export function buildRedlinedDocument(text: string, redlines: RedlineItem[], include: (r: RedlineItem) => boolean = () => true): RedlinedDocument {
  const hay = normalizeWithMap(text);
  const inserts = redlines.filter((r) => include(r) && r.action === "insert");
  const placed: { r: RedlineItem; start: number; end: number }[] = [];
  const unplaced: RedlineItem[] = [];
  for (const r of redlines) {
    if (!include(r) || r.action === "insert") continue;
    const hit = locateQuote(hay, r.originalText);
    if (hit) placed.push({ r, ...hit });
    else unplaced.push(r);
  }
  placed.sort((a, b) => a.start - b.start);
  const segments: DocSegment[] = [];
  let pos = 0;
  for (const p of placed) {
    if (p.start < pos) {
      unplaced.push(p.r); // overlaps the previous change
      continue;
    }
    if (p.start > pos) segments.push({ kind: "text", text: text.slice(pos, p.start) });
    segments.push({ kind: "change", redline: p.r, original: text.slice(p.start, p.end) });
    pos = p.end;
  }
  if (pos < text.length) segments.push({ kind: "text", text: text.slice(pos) });
  return { segments, unplaced, inserts };
}

/** The contract with only the accepted changes applied (clean text export). */
export function reconciledText(text: string, redlines: RedlineItem[]): string {
  const doc = buildRedlinedDocument(text, redlines, (r) => r.accepted === true);
  let out = doc.segments.map((s) => (s.kind === "text" ? s.text : s.redline.action === "delete" ? "" : s.redline.proposedText)).join("");
  for (const r of doc.inserts) out += `\n\n[Inserted under ${r.clauseId}]\n${r.proposedText}\n`;
  return out;
}

/** Printable HTML of the redlined contract (deletions struck through, insertions underlined, rationale as notes). */
export function redlinedHtml(opts: {
  title: string;
  playbook?: string;
  text: string;
  redlines: RedlineItem[];
  lang: "en" | "bn";
}): string {
  const bn = opts.lang === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  // Rejected changes are not shown; pending ones are marked as proposals.
  const doc = buildRedlinedDocument(opts.text, opts.redlines, (r) => r.accepted !== false);
  const notes: RedlineItem[] = [];
  const body = doc.segments
    .map((s) => {
      if (s.kind === "text") return escapeHtml(s.text.replace(/\n?\[Page (\d+)\]\n?/g, "\n⸺ $1 ⸺\n"));
      notes.push(s.redline);
      const n = notes.length;
      const pending = s.redline.accepted !== true;
      return `<span class="chg${pending ? " pending" : ""}"><del>${escapeHtml(s.original)}</del>${
        s.redline.action === "delete" ? "" : `<ins>${escapeHtml(s.redline.proposedText)}</ins>`
      }<sup>${n}</sup></span>`;
    })
    .join("");
  for (const r of [...doc.inserts, ...doc.unplaced]) notes.push(r);
  const noteHtml = notes
    .map(
      (r, i) => `<li><b>${escapeHtml(r.clauseId)} — ${escapeHtml((bn && r.sectionTitleBn) || r.sectionTitle)}</b> <small>${r.accepted === true ? L("accepted", "গৃহীত") : L("proposed", "প্রস্তাবিত")}</small>
        ${i >= notes.length - doc.inserts.length - doc.unplaced.length ? `<p class="del">${escapeHtml(r.originalText)}</p><p class="ins">${escapeHtml(r.proposedText)}</p>` : ""}
        <p><b>${L("Why:", "কেন:")}</b> ${escapeHtml(r.chainOfThought.legalRationale)}</p>
        <p><b>${L("Business risk:", "ব্যবসায়িক ঝুঁকি:")}</b> ${escapeHtml(r.chainOfThought.commercialRiskAssessment)}</p>
        <p><b>${L("What to say:", "কী বলবেন:")}</b> ${escapeHtml(r.chainOfThought.negotiationTalkingPoint)}</p></li>`
    )
    .join("");
  return `<!doctype html><html lang="${opts.lang}"><head><meta charset="utf-8"><title>${escapeHtml(opts.title)} — ${L("Redline", "রেডলাইন")}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Noto+Sans+Bengali:wght@400;700&family=Inter:wght@400;700&display=swap">
<style>
  body { margin: 28px auto; max-width: 820px; padding: 0 22px; color: #1b2033; font: 13px/1.7 'Noto Serif', 'Noto Sans Bengali', Georgia, serif; }
  h1 { font: 700 20px/1.3 Inter, 'Noto Sans Bengali', sans-serif; margin: 0 0 4px; } .meta { font: 12px Inter, sans-serif; color: #5b6275; margin-bottom: 18px; }
  .legend { font: 11.5px Inter, sans-serif; color: #5b6275; margin-bottom: 14px; } .doc { white-space: pre-wrap; }
  del { color: #b4232f; text-decoration: line-through; } ins { color: #11683f; text-decoration: underline; text-decoration-thickness: 1px; }
  .chg.pending del, .chg.pending ins { text-decoration-style: dotted; } sup { font: 700 9px Inter, sans-serif; color: #4b55c8; margin-left: 2px; }
  h2 { font: 700 15px Inter, sans-serif; margin: 28px 0 8px; border-top: 2px solid #e4e6ef; padding-top: 14px; }
  ol { padding-left: 20px; } li { margin-bottom: 10px; break-inside: avoid; } li p { margin: 2px 0; } li small { color: #5b6275; font-family: Inter, sans-serif; }
  p.del { color: #b4232f; text-decoration: line-through; } p.ins { color: #11683f; }
  .foot { margin-top: 26px; font: 11px Inter, sans-serif; color: #8a90a2; }
</style></head><body>
<h1>${escapeHtml(opts.title)}</h1>
<div class="meta">${L("Redlined version", "সংশোধিত সংস্করণ")}${opts.playbook ? ` · ${escapeHtml(opts.playbook)}` : ""} · ${new Date().toLocaleDateString(bn ? "bn-BD" : "en-GB")}</div>
<div class="legend"><del>${L("deleted", "বাদ")}</del> · <ins>${L("inserted", "যোগ")}</ins> · ${L("dotted = proposed, not yet accepted; numbers refer to the notes at the end", "ডটেড = প্রস্তাবিত, এখনও গৃহীত নয়; সংখ্যাগুলো শেষের নোট নির্দেশ করে")}</div>
<div class="doc">${body}</div>
${notes.length ? `<h2>${L("Changes and reasoning", "পরিবর্তন ও যুক্তি")}</h2><ol>${noteHtml}</ol>` : ""}
<div class="foot">${L("Generated by ContractMind. AI-assisted review, not legal advice.", "ContractMind দিয়ে তৈরি। এআই-সহায়িত পর্যালোচনা, আইনি পরামর্শ নয়।")}</div>
</body></html>`;
}
