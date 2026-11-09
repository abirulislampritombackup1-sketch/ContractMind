import { CategoryScore, ContractAnalysisResult, Playbook, PlaybookScoring, RuleAssessment, RuleStatus } from "../types";
import { locateQuote, normalizeWithMap } from "./textMatch";

/**
 * Deterministic, playbook-driven risk scoring.
 *
 * The Risk Auditor agent only judges each playbook rule (Pass / Partial / Fail /
 * Not Addressed) and quotes evidence. The score itself is computed here:
 *
 *   rule risk     = rule weight × status factor
 *   overall score = 100 × Σ rule risk / Σ weight of assessed rules
 *
 * So the same assessments always give the same score, a different playbook
 * (different rules / weights) gives a different score, and the maths is shown
 * to the user.
 */

export const STATUS_FACTOR: Record<Exclude<RuleStatus, "Not Assessed">, number> = {
  Pass: 0,
  Partial: 0.5,
  "Not Addressed": 0.6, // contract is silent on a protection the playbook requires
  Fail: 1,
};

const STATUSES: RuleStatus[] = ["Pass", "Partial", "Fail", "Not Addressed"];

export function riskLevelFor(score: number): ContractAnalysisResult["riskLevel"] {
  return score >= 70 ? "Critical" : score >= 45 ? "High" : score >= 20 ? "Medium" : "Low";
}

/** Merge the AI's per-rule judgements with the playbook's rules and weights. */
export function buildScoring(rawAssessments: any[], playbook: Playbook, contractText: string): PlaybookScoring {
  const byId = new Map<string, any>();
  for (const a of Array.isArray(rawAssessments) ? rawAssessments : []) {
    if (a?.ruleId) byId.set(String(a.ruleId).trim().toUpperCase(), a);
  }
  const canVerify = contractText.trim().length > 80 && !contractText.startsWith("[Scanned PDF");
  const hay = canVerify ? normalizeWithMap(contractText) : null;

  const rules: RuleAssessment[] = playbook.rules.map((rule) => {
    const a = byId.get(rule.id.toUpperCase());
    const status: RuleStatus = a && STATUSES.includes(a.status) ? a.status : "Not Assessed";
    const evidence = typeof a?.evidence === "string" ? a.evidence.trim() : "";
    const hasQuote = !!evidence && !/^not (found|addressed|specified)/i.test(evidence);
    return {
      ruleId: rule.id,
      ruleTitle: rule.title,
      category: rule.category,
      severity: rule.severity,
      weight: rule.weight,
      baseWeight: rule.weight,
      status,
      clauseRef: typeof a?.clauseRef === "string" && a.clauseRef.trim() ? a.clauseRef.trim() : "—",
      evidence: hasQuote ? evidence : "",
      explanation: typeof a?.explanation === "string" ? a.explanation : "The analysis did not assess this rule.",
      verified: hasQuote && hay ? !!locateQuote(hay, evidence) : undefined,
      pointsLost: 0,
    };
  });
  return rescore({ rules, totalWeight: 0, pointsLost: 0 });
}

/** Recompute points with the rules' current weights (used live by the weight sliders). */
export function rescore(scoring: PlaybookScoring, weights?: Record<string, number>): PlaybookScoring {
  let totalWeight = 0;
  let pointsLost = 0;
  const rules = scoring.rules.map((r) => {
    const weight = weights?.[r.ruleId] ?? r.weight;
    if (r.status === "Not Assessed") return { ...r, weight, pointsLost: 0 };
    const lost = weight * STATUS_FACTOR[r.status];
    totalWeight += weight;
    pointsLost += lost;
    return { ...r, weight, pointsLost: lost };
  });
  return { rules, totalWeight, pointsLost };
}

export function scoreOf(scoring: PlaybookScoring): number {
  return scoring.totalWeight > 0 ? Math.round((100 * scoring.pointsLost) / scoring.totalWeight) : 0;
}

/** Per-category scores derived from the same rule results. */
export function categoriesFrom(scoring: PlaybookScoring): CategoryScore[] {
  const groups = new Map<string, RuleAssessment[]>();
  for (const r of scoring.rules) {
    if (r.status === "Not Assessed") continue;
    groups.set(r.category, [...(groups.get(r.category) || []), r]);
  }
  const rank: Record<string, number> = { Fail: 3, "Not Addressed": 2, Partial: 1, Pass: 0 };
  return [...groups.entries()].map(([category, rs]) => {
    const w = rs.reduce((s, r) => s + r.weight, 0);
    const lost = rs.reduce((s, r) => s + r.pointsLost, 0);
    const score = w > 0 ? Math.round((100 * lost) / w) : 0;
    const worst = [...rs].sort((a, b) => rank[b.status] - rank[a.status])[0];
    return {
      category,
      score,
      status: score >= 70 ? "Critical Deviation" : score >= 40 ? "Warning" : "Pass",
      comment: `${worst.ruleId} ${worst.status}: ${worst.explanation}`,
    };
  });
}

/** Apply a scoring object to a result: score, level and categories all follow from it. */
export function applyScoring<T extends ContractAnalysisResult>(result: T, scoring: PlaybookScoring): T {
  const score = scoreOf(scoring);
  return {
    ...result,
    scoring,
    overallRiskScore: score,
    riskLevel: riskLevelFor(score),
    categoryScores: categoriesFrom(scoring),
  };
}
