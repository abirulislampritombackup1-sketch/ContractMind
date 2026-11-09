import { ContractAnalysisResult } from "../types";
import { locateQuote, normalizeWithMap } from "./textMatch";

/**
 * Everything the analysis says about the contract, tied back to the exact
 * place in the contract text it refers to — so every claim can be checked
 * against the source document.
 */

export type FindingKind = "redline" | "rule" | "obligation";
export type Tone = "danger" | "warn" | "ok" | "info";

export type Finding = {
  id: string; // "red:RED-01" | "rule:R-LIAB-01" | "obl:OBL-001"
  kind: FindingKind;
  ref: string; // clause reference shown to the user
  title: string;
  detail: string;
  tone: Tone;
  start?: number; // character range in the contract text (when located)
  end?: number;
  how: "quote" | "section" | "none"; // located by verbatim quote, by section heading, or not at all
};

export const findingId = {
  redline: (id: string) => `red:${id}`,
  rule: (id: string) => `rule:${id}`,
  obligation: (id: string) => `obl:${id}`,
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Find a numbered section ("Section 2.2", "2.2 Payment Terms", "Clause 7") and
 * return the range of its heading paragraph, up to the next numbered heading.
 */
export function locateSection(text: string, clauseRef: string): { start: number; end: number } | null {
  const num = clauseRef.match(/\d+(?:\.\d+)*/)?.[0];
  if (!num) return null;
  const n = escapeRe(num);
  const patterns = num.includes(".")
    ? [new RegExp(`(?:^|[\\s(])(?:Section\\s+|Clause\\s+|§\\s*)?(${n})\\.?\\s+(?=["“A-Z])`, "m")]
    : [
        // "SECTION 2. PAYMENT…" / "Article 5: …" — heading form, not "as set out in Section 2 of…"
        new RegExp(`(?:^|\\s)(?:Section|SECTION|Article|ARTICLE|Clause|CLAUSE)\\s+(${n})(?!\\.\\d)(?:[.:]|\\s+(?=[A-Z]{2}))`),
        new RegExp(`(?:^|\\n)\\s*(${n})\\.\\s+(?=[A-Z])`),
      ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const start = m.index + m[0].indexOf(m[1]);
    // Section body ends at the next numbered heading, a blank line, or 700 chars.
    const rest = text.slice(start + num.length + 1);
    const next = rest.search(/\n\s*\n|\n\s*\[Page \d+\]|(?:^|[\s])\d+\.\d+\.?\s+(?=[A-Z])/m);
    const len = Math.min(next >= 0 ? next + num.length + 1 : 700, 700);
    return { start, end: Math.min(text.length, start + len) };
  }
  return null;
}

export function buildFindings(result: ContractAnalysisResult, text: string): Finding[] {
  const usable = text.trim().length > 80 && !text.startsWith("[Scanned PDF");
  const hay = usable ? normalizeWithMap(text) : null;
  const viaQuote = (q?: string) => (hay && q ? locateQuote(hay, q) : null);
  const viaSection = (ref?: string) => (usable && ref ? locateSection(text, ref) : null);

  const out: Finding[] = [];

  for (const r of result.redlines) {
    const q = viaQuote(r.originalText);
    const s = q ? null : viaSection(r.clauseId);
    out.push({
      id: findingId.redline(r.id),
      kind: "redline",
      ref: r.clauseId,
      title: r.sectionTitle,
      detail: r.chainOfThought.legalRationale,
      tone: r.severity === "Critical" || r.severity === "High" ? "danger" : r.severity === "Medium" ? "warn" : "info",
      ...(q || s || {}),
      how: q ? "quote" : s ? "section" : "none",
    });
  }

  for (const r of result.scoring?.rules || []) {
    if (r.status === "Not Assessed") continue;
    const q = viaQuote(r.evidence);
    const s = q || r.status === "Not Addressed" ? null : viaSection(r.clauseRef);
    out.push({
      id: findingId.rule(r.ruleId),
      kind: "rule",
      ref: r.status === "Not Addressed" ? "Missing" : r.clauseRef,
      title: `${r.ruleId} · ${r.ruleTitle} — ${r.status}`,
      detail: r.explanation,
      tone: r.status === "Fail" ? "danger" : r.status === "Pass" ? "ok" : "warn",
      ...(q || s || {}),
      how: q ? "quote" : s ? "section" : "none",
    });
  }

  for (const o of result.obligations) {
    const s = viaSection(o.clauseRef);
    out.push({
      id: findingId.obligation(o.id),
      kind: "obligation",
      ref: o.clauseRef,
      title: o.requirement,
      detail: `${o.obligor} → ${o.beneficiary} · ${o.triggerOrDeadline}${o.financialImpact ? ` · ${o.financialImpact}` : ""}`,
      tone: "info",
      ...(s || {}),
      how: s ? "section" : "none",
    });
  }

  // Located findings in document order first, then the rest.
  return out.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
}
