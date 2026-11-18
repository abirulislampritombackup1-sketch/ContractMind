// Table Vision agent helpers. Payment and milestone tables lose their structure when a
// PDF is turned into text (merged cells, nested phases, columns read out of order), so
// pages that look like they hold such tables are rendered to images and read by Gemini
// as images. The rows are then merged with the milestones found in the text.

import type { Chunk } from "../rag/chunker";
import type { PaymentMilestone } from "../types";

const PAY_WORDS = /\b(milestone|payment schedule|instal+ment|tranche|earn-?out|fee schedule|payment terms|deliverable|phase|invoice|retainer|deposit|advance payment)\b/gi;
const SCHEDULE = /\b(schedule|exhibit|annex|appendix)\s+[A-Z0-9]+\b/gi;
const MONEY = /([$€£৳]|\b(USD|EUR|GBP|BDT|Tk\.?|INR)\b)\s?\d[\d,.]*/gi;
const PERCENT = /\b\d{1,3}(\.\d+)?\s?%/g;

const count = (re: RegExp, text: string) => (text.match(re) || []).length;

/**
 * Pages most likely to contain payment or milestone tables, best first.
 * A markdown table row counts most; payment words, schedules, money and percentages add.
 */
export function findTablePages(chunks: Chunk[], max = 4): number[] {
  const score = new Map<number, number>();
  for (const c of chunks) {
    if (!c.page) continue; // DOCX / TXT have no pages
    const t = c.text;
    const tableRows = t.split("\n").filter((l) => /^\s*\|.*\|\s*$/.test(l)).length;
    let s = 0;
    if (tableRows >= 2) s += 4;
    s += Math.min(4, count(PAY_WORDS, t));
    s += Math.min(2, count(SCHEDULE, t));
    s += Math.min(3, count(MONEY, t));
    s += Math.min(2, count(PERCENT, t));
    score.set(c.page, (score.get(c.page) || 0) + s);
  }
  return [...score.entries()]
    .filter(([, s]) => s >= 6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([page]) => page)
    .sort((a, b) => a - b);
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿ ]+/g, " ").split(/\s+/).filter(Boolean);
const amountKey = (s: string) =>
  (s.match(/\d[\d,]*(\.\d+)?/g) || []).map((d) => String(parseFloat(d.replace(/,/g, "")))).join("|");

/** True when two milestones are the same row (same amount, similar name). */
function sameRow(a: PaymentMilestone, b: PaymentMilestone): boolean {
  const ka = amountKey(a.amount);
  const kb = amountKey(b.amount);
  if (ka && kb && ka !== kb) return false;
  const wa = new Set(words(`${a.milestone} ${a.deliverable}`));
  const wb = words(`${b.milestone} ${b.deliverable}`);
  const shared = wb.filter((w) => w.length > 3 && wa.has(w)).length;
  return (!!ka && ka === kb && shared >= 1) || shared >= 3;
}

/**
 * Text milestones + table-image rows → one list without duplicates. Matching rows keep
 * the text version's id and gain the image's structure (phase, page, dates).
 */
export function mergeMilestones(fromText: PaymentMilestone[], fromImages: PaymentMilestone[]): PaymentMilestone[] {
  const out: PaymentMilestone[] = fromText.map((m) => ({ ...m, source: m.source || "text" }));
  for (const img of fromImages) {
    const i = out.findIndex((m) => m.source !== "table-image" && sameRow(m, img));
    if (i >= 0) {
      const t = out[i];
      out[i] = {
        ...t,
        phase: t.phase || img.phase,
        page: img.page || t.page,
        dueDate: t.dueDate || img.dueDate,
        offsetDays: t.offsetDays ?? img.offsetDays,
        offsetFrom: t.offsetFrom || img.offsetFrom,
        source: "both",
      };
    } else {
      out.push({ ...img, id: img.id || `T-${out.length + 1}`, source: "table-image" });
    }
  }
  return out;
}
