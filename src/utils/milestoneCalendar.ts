// Payment milestone calendar: turns milestone triggers into calendar dates and exports
// them as .ics (Google Calendar, Outlook, Apple Calendar) or CSV.
//
// A milestone gets a date when (in this order):
//   1. the contract states an exact date (dueDate),
//   2. it is N days after the effective date or after the previous dated milestone,
//   3. its trigger text says so ("within thirty (30) days of the Effective Date").
// Event-based triggers ("upon acceptance") stay undated: they depend on something happening.

import type { PaymentMilestone } from "../types";

export type ResolvedMilestone = {
  m: PaymentMilestone;
  date?: string; // YYYY-MM-DD
  how: "stated" | "computed" | "event";
  basis: string; // human-readable reason, e.g. "Effective date + 30 days"
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number, businessDays = false): string {
  const d = toDate(iso);
  if (!businessDays) {
    d.setUTCDate(d.getUTCDate() + days);
    return toIso(d);
  }
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return toIso(d);
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };
const REF_EFFECTIVE = /(effective|commencement|execution|signing|start)\s*date|date of (this agreement|execution|signing)|execution|signing/i;

/** Reads "30 days after the Effective Date" (also "thirty (30) business days", weeks, months) from free text. */
export function parseRelativeTrigger(text: string): { days: number; business: boolean; from: "effective_date" | "other" } | null {
  const m = text.match(/(\d+)\)?\s*(business\s+|working\s+|calendar\s+)?(day|week|month)s?\s*(after|following|from|of|of the|post)\b(.{0,60})/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const business = !!m[2] && /business|working/i.test(m[2]);
  const days = n * UNIT_DAYS[m[3].toLowerCase()];
  return { days, business, from: REF_EFFECTIVE.test(m[5]) ? "effective_date" : "other" };
}

export function resolveMilestoneDates(list: PaymentMilestone[], effectiveDate?: string): ResolvedMilestone[] {
  const eff = effectiveDate && ISO.test(effectiveDate) ? effectiveDate : undefined;
  let previous: string | undefined;
  return list.map((m) => {
    let out: ResolvedMilestone;
    if (m.dueDate && ISO.test(m.dueDate)) {
      out = { m, date: m.dueDate, how: "stated", basis: m.dueDate };
    } else if (m.offsetDays !== undefined && m.offsetFrom === "effective_date" && eff) {
      out = { m, date: addDays(eff, m.offsetDays), how: "computed", basis: `effective+${m.offsetDays}` };
    } else if (m.offsetDays !== undefined && m.offsetFrom === "previous_milestone" && previous) {
      out = { m, date: addDays(previous, m.offsetDays), how: "computed", basis: `previous+${m.offsetDays}` };
    } else {
      const rel = parseRelativeTrigger(m.trigger || "");
      out =
        rel && rel.from === "effective_date" && eff
          ? { m, date: addDays(eff, rel.days, rel.business), how: "computed", basis: `effective+${rel.days}${rel.business ? "b" : ""}` }
          : { m, how: "event", basis: m.trigger };
    }
    if (out.date) previous = out.date;
    return out;
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds long lines at 75 octets as RFC 5545 requires (continuation lines start with a space). */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function toIcs(items: ResolvedMilestone[], contractTitle: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ContractMind//Milestones//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsText(contractTitle)} milestones`];
  for (const it of items) {
    if (!it.date) continue;
    const start = it.date.replace(/-/g, "");
    const end = addDays(it.date, 1).replace(/-/g, "");
    const m = it.m;
    const desc = [
      m.phase && `Phase: ${m.phase}`,
      `Deliverable: ${m.deliverable}`,
      `Amount: ${m.amount}`,
      `Trigger: ${m.trigger}`,
      `Responsible: ${m.responsibleParty}`,
      m.page && `Contract page: ${m.page}`,
      it.how === "computed" ? "Date calculated by ContractMind from the trigger; confirm before relying on it." : "",
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsText(`${m.id}-${start}`)}@contractmind`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsText(`${m.milestone} (${m.amount})`)}`,
      `DESCRIPTION:${icsText(desc)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(`Due in 7 days: ${m.milestone}`)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(items: ResolvedMilestone[]): string {
  const head = ["ID", "Phase", "Milestone", "Deliverable", "Amount", "Trigger", "Due date", "Date basis", "Responsible", "Status", "Read from", "Page"];
  const rows = items.map((it) => [
    it.m.id,
    it.m.phase,
    it.m.milestone,
    it.m.deliverable,
    it.m.amount,
    it.m.trigger,
    it.date || "",
    it.how === "stated" ? "Stated in contract" : it.how === "computed" ? "Calculated from trigger" : "Depends on an event",
    it.m.responsibleParty,
    it.m.status,
    it.m.source === "table-image" ? "Table image" : it.m.source === "both" ? "Text and table image" : "Text",
    it.m.page,
  ]);
  // BOM so Excel opens UTF-8 (Bangla text) correctly.
  return "\ufeff" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
