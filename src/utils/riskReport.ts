// Printable risk report: opens a clean page with the score, its explanation, every rule
// with evidence and suggested action, and the proposed redlines. The browser's print
// dialog saves it as PDF (fonts render Bangla correctly, unlike most PDF libraries).

import { ContractAnalysisResult, PlaybookScoring, RuleStatus } from "../types";
import { Language } from "../i18n/translations";
import { RULES_BN, TERMS_BN } from "../i18n/dataBn";
import { STATUS_FACTOR, scoreOf } from "./scoring";
import { printHtml } from "./printHtml";

type T = (en: string, bn: string) => string;

const STATUS_BN: Record<RuleStatus, string> = {
  Fail: "ব্যর্থ",
  "Not Addressed": "উল্লেখ নেই",
  Partial: "আংশিক",
  Pass: "উত্তীর্ণ",
  "Not Assessed": "মূল্যায়িত হয়নি",
};

const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, "");

/** One-line explanation of the score, e.g. "Score 72: 3 rules failed (45 points), 1 missing (9 points)". */
export function scoreSummary(scoring: PlaybookScoring, lang: Language): string {
  const L: T = (en, bn) => (lang === "bn" ? bn : en);
  const parts: string[] = [];
  const groups: [RuleStatus, string, string][] = [
    ["Fail", "failed", "ব্যর্থ"],
    ["Not Addressed", "missing", "অনুপস্থিত"],
    ["Partial", "partial", "আংশিক"],
  ];
  for (const [status, en, bn] of groups) {
    const rules = scoring.rules.filter((r) => r.status === status);
    if (!rules.length) continue;
    const pts = fmt(rules.reduce((s, r) => s + r.pointsLost, 0));
    parts.push(L(`${rules.length} ${rules.length === 1 && status === "Fail" ? "rule" : "rules"} ${en} (${pts} points)`, `${rules.length}টি নিয়ম ${bn} (${pts} পয়েন্ট)`));
  }
  const passed = scoring.rules.filter((r) => r.status === "Pass").length;
  if (passed) parts.push(L(`${passed} passed`, `${passed}টি উত্তীর্ণ`));
  return `${L("Score", "স্কোর")} ${scoreOf(scoring)}: ${parts.join(", ") || L("no rule was assessed", "কোনো নিয়ম মূল্যায়ন হয়নি")}`;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildRiskReportHtml(result: ContractAnalysisResult, playbookName: string, lang: Language): string {
  const bn = lang === "bn";
  const L: T = (en, b) => (bn ? b : en);
  const scoring = result.scoring;
  const score = scoring ? scoreOf(scoring) : result.overallRiskScore;
  const rules = scoring ? [...scoring.rules].sort((a, b) => b.pointsLost - a.pointsLost) : [];
  const date = new Date().toLocaleDateString(bn ? "bn-BD" : "en-GB", { year: "numeric", month: "long", day: "numeric" });

  const ruleRows = rules
    .map((r) => {
      const title = (bn && RULES_BN[r.ruleId]?.title) || r.ruleTitle;
      const status = bn ? STATUS_BN[r.status] : r.status;
      const pts = r.status === "Not Assessed" ? "—" : `${fmt(r.pointsLost)} / ${r.weight}`;
      return `<tr class="${r.status.replace(/\s/g, "")}">
        <td><b>${esc(title)}</b><br><small>${esc(r.ruleId)} · ${esc((bn && TERMS_BN[r.category]) || r.category)} · ${esc(r.clauseRef)}</small></td>
        <td class="st">${esc(status)}</td>
        <td class="pts">${pts}</td>
        <td>${esc(r.explanation)}${r.evidence ? `<blockquote>“${esc(r.evidence)}”${r.evidenceBn && bn ? `<br><span>${esc(r.evidenceBn)}</span>` : ""}</blockquote>` : ""}${
          r.recommendation ? `<p class="act"><b>${L("What to do:", "করণীয়:")}</b> ${esc(r.recommendation)}</p>` : ""
        }</td>
      </tr>`;
    })
    .join("");

  const redlines = result.redlines
    .map(
      (r) => `<div class="red">
        <h4>${esc(r.clauseId)} — ${esc((bn && r.sectionTitleBn) || r.sectionTitle)} <small>(${esc(bn ? TERMS_BN[r.severity] || r.severity : r.severity)})</small></h4>
        <p class="del">${esc(r.originalText)}</p>
        <p class="ins">${esc(r.proposedText)}</p>
        <p><b>${L("Why:", "কেন:")}</b> ${esc(r.chainOfThought.legalRationale)}</p>
        <p><b>${L("What to say:", "কী বলবেন:")}</b> ${esc(r.chainOfThought.negotiationTalkingPoint)}</p>
      </div>`
    )
    .join("");

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>${esc(L("Risk report", "ঝুঁকি প্রতিবেদন"))} — ${esc(result.contractTitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans+Bengali:wght@400;600;800&display=swap">
<style>
  body { font: 13px/1.6 Inter, 'Noto Sans Bengali', sans-serif; color: #1b2033; margin: 32px auto; max-width: 900px; padding: 0 20px; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 2px solid #e4e6ef; padding-bottom: 6px; }
  .meta { color: #5b6275; font-size: 12px; }
  .score { display: flex; gap: 18px; align-items: center; margin: 18px 0; padding: 14px 18px; border: 1px solid #e4e6ef; border-radius: 12px; }
  .score b { font-size: 40px; line-height: 1; } .score p { margin: 0; }
  table { width: 100%; border-collapse: collapse; } td, th { border-bottom: 1px solid #e4e6ef; padding: 8px; vertical-align: top; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; color: #5b6275; } small { color: #5b6275; }
  .st { font-weight: 700; white-space: nowrap; } .pts { white-space: nowrap; }
  tr.Fail .st { color: #c0283d; } tr.NotAddressed .st, tr.Partial .st { color: #b26b00; } tr.Pass .st { color: #127a4a; }
  blockquote { margin: 6px 0 0; padding: 6px 10px; border-left: 3px solid #c9cddb; background: #f6f7fb; font-style: italic; }
  blockquote span { font-style: normal; color: #3a4155; }
  .act { margin: 6px 0 0; padding: 6px 10px; background: #eef0ff; border-radius: 8px; }
  .red { border: 1px solid #e4e6ef; border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; break-inside: avoid; }
  .red h4 { margin: 0 0 6px; } .del { color: #c0283d; text-decoration: line-through; } .ins { color: #127a4a; }
  .foot { margin-top: 30px; color: #8a90a2; font-size: 11px; }
  @media print { body { margin: 0 auto; } a { color: inherit; } }
</style></head><body>
<h1>${esc(result.contractTitle)}</h1>
<div class="meta">${esc(L("Risk report", "ঝুঁকি প্রতিবেদন"))} · ${esc(playbookName)} · ${esc(date)} · ${result.parties.map((p) => esc(p.name)).join(" / ")}</div>
<div class="score"><b>${score}</b><div><p><b style="font-size:14px">${esc(L(`${result.riskLevel} risk`, `${TERMS_BN[result.riskLevel] || result.riskLevel} ঝুঁকি`))}</b> · ${esc(L("out of 100 (higher = riskier)", "১০০-এর মধ্যে (বেশি = বেশি ঝুঁকি)"))}</p>
<p>${scoring ? esc(scoreSummary(scoring, lang)) : ""}</p>
<p><small>${esc(L(`Each rule adds weight × factor (Fail 1, Not addressed ${STATUS_FACTOR["Not Addressed"]}, Partial ${STATUS_FACTOR.Partial}, Pass 0).`, `প্রতিটি নিয়ম যোগ করে ওজন × গুণক (ব্যর্থ ১, উল্লেখ নেই ${STATUS_FACTOR["Not Addressed"]}, আংশিক ${STATUS_FACTOR.Partial}, উত্তীর্ণ ০)।`))}</small></p></div></div>
<h2>${esc(L("Summary", "সারসংক্ষেপ"))}</h2><p>${esc(result.summary)}</p>
${rules.length ? `<h2>${esc(L("Playbook rules", "প্লেবুকের নিয়ম"))}</h2><table><thead><tr><th>${esc(L("Rule", "নিয়ম"))}</th><th>${esc(L("Status", "অবস্থা"))}</th><th>${esc(L("Points", "পয়েন্ট"))}</th><th>${esc(L("Finding and action", "ফলাফল ও করণীয়"))}</th></tr></thead><tbody>${ruleRows}</tbody></table>` : ""}
${redlines ? `<h2>${esc(L("Proposed redlines", "প্রস্তাবিত সংশোধন"))}</h2>${redlines}` : ""}
<div class="foot">${esc(L("Generated by ContractMind. AI-assisted review, not legal advice.", "ContractMind দিয়ে তৈরি। এআই-সহায়িত পর্যালোচনা, আইনি পরামর্শ নয়।"))}</div>
</body></html>`;
}

/** Prints the report (no pop-up); the user picks "Save as PDF" in the print dialog. */
export function openRiskReport(result: ContractAnalysisResult, playbookName: string, lang: Language): boolean {
  printHtml(buildRiskReportHtml(result, playbookName, lang), "cm-report-frame");
  return true;
}
