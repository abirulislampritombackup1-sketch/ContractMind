// Custom playbooks: created in Playbook Studio, saved in localStorage, and shareable as
// JSON files. Built-in playbooks (src/data/playbooks.ts) are never changed.

import { Playbook, PlaybookRule } from "../types";

const KEY = "cm-playbooks";
export const PLAYBOOK_FILE_VERSION = 1;

export const RULE_CATEGORIES: PlaybookRule["category"][] = [
  "Indemnification",
  "Liability Cap",
  "Termination",
  "IP Rights",
  "Data Privacy",
  "Payment & Milestones",
  "Governing Law",
  "Compliance & Security",
];
export const SEVERITIES: PlaybookRule["severity"][] = ["Critical", "High", "Medium", "Low"];

export const DEFAULT_TOLERANCES: Playbook["tolerances"] = {
  maxLiabilityMultiplier: 1,
  requireMutualIndemnity: true,
  requireTerminationForConvenience: true,
  convenienceNoticeDays: 30,
  requireDataBreachNoticeHours: 48,
  paymentTermsMaxDays: 30,
  disallowNonCompete: true,
};

const uid = () => Math.random().toString(36).slice(2, 8);

export function newRule(existing: PlaybookRule[]): PlaybookRule {
  let n = existing.length + 1;
  const ids = new Set(existing.map((r) => r.id.toUpperCase()));
  while (ids.has(`C-${String(n).padStart(2, "0")}`)) n++;
  return {
    id: `C-${String(n).padStart(2, "0")}`,
    category: "Liability Cap",
    title: "",
    targetStandard: "",
    fallbackAllowed: "",
    unacceptableTerms: [],
    severity: "High",
    weight: 15,
  };
}

export function blankPlaybook(name = "My playbook"): Playbook {
  const pb: Playbook = {
    id: `custom-${uid()}`,
    name,
    description: "",
    badge: "Custom",
    stance: "Custom",
    tolerances: { ...DEFAULT_TOLERANCES },
    rules: [],
  };
  pb.rules = [newRule([])];
  return pb;
}

/** An editable copy of a built-in (or any) playbook. */
export function copyPlaybook(src: Playbook, name: string): Playbook {
  return {
    ...structuredClone(src),
    id: `custom-${uid()}`,
    name,
    badge: "Custom",
    stance: "Custom",
  };
}

export const isCustom = (pb: Playbook) => pb.id.startsWith("custom-");

/** Problems that would make the analysis meaningless; empty when the playbook is usable. */
export function playbookProblems(pb: Playbook): string[] {
  const out: string[] = [];
  if (!pb.name.trim()) out.push("name");
  if (!pb.rules.length) out.push("rules");
  pb.rules.forEach((r, i) => {
    if (!r.title.trim()) out.push(`rule ${i + 1} title`);
    if (!r.targetStandard.trim()) out.push(`rule ${i + 1} target`);
    if (!(r.weight > 0)) out.push(`rule ${i + 1} weight`);
  });
  const ids = pb.rules.map((r) => r.id.toUpperCase());
  if (new Set(ids).size !== ids.length) out.push("duplicate rule ids");
  return out;
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function loadCustomPlaybooks(): Playbook[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.map((p) => parsePlaybook(p)).filter((p): p is Playbook => !!p) : [];
  } catch {
    return [];
  }
}

export function saveCustomPlaybooks(list: Playbook[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the playbooks still work for this session.
  }
}

// ── Import / export ──────────────────────────────────────────────────────────

export function exportPlaybookJson(pb: Playbook): string {
  return JSON.stringify({ contractmindPlaybook: PLAYBOOK_FILE_VERSION, playbook: pb }, null, 2);
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Turns untrusted JSON into a valid custom playbook, or null if it is not one. */
export function parsePlaybook(input: any): Playbook | null {
  const p = input?.contractmindPlaybook ? input.playbook : input;
  if (!p || typeof p !== "object" || !Array.isArray(p.rules)) return null;
  const t = p.tolerances || {};
  const rules: PlaybookRule[] = p.rules
    .filter((r: any) => r && typeof r === "object")
    .slice(0, 50)
    .map((r: any, i: number) => ({
      id: str(r.id, `C-${String(i + 1).padStart(2, "0")}`).slice(0, 24) || `C-${i + 1}`,
      category: RULE_CATEGORIES.includes(r.category) ? r.category : "Compliance & Security",
      title: str(r.title).slice(0, 200),
      targetStandard: str(r.targetStandard).slice(0, 1000),
      fallbackAllowed: str(r.fallbackAllowed).slice(0, 1000),
      unacceptableTerms: (Array.isArray(r.unacceptableTerms) ? r.unacceptableTerms : []).filter((x: any) => typeof x === "string").slice(0, 20),
      severity: SEVERITIES.includes(r.severity) ? r.severity : "Medium",
      weight: Math.min(50, Math.max(1, Math.round(num(r.weight, 10)))),
    }));
  if (!rules.length) return null;
  return {
    id: str(p.id).startsWith("custom-") ? str(p.id) : `custom-${uid()}`,
    name: str(p.name, "Imported playbook").slice(0, 120) || "Imported playbook",
    description: str(p.description).slice(0, 600),
    badge: "Custom",
    stance: "Custom",
    tolerances: {
      maxLiabilityMultiplier: num(t.maxLiabilityMultiplier, DEFAULT_TOLERANCES.maxLiabilityMultiplier),
      requireMutualIndemnity: bool(t.requireMutualIndemnity, DEFAULT_TOLERANCES.requireMutualIndemnity),
      requireTerminationForConvenience: bool(t.requireTerminationForConvenience, DEFAULT_TOLERANCES.requireTerminationForConvenience),
      convenienceNoticeDays: num(t.convenienceNoticeDays, DEFAULT_TOLERANCES.convenienceNoticeDays),
      requireDataBreachNoticeHours: num(t.requireDataBreachNoticeHours, DEFAULT_TOLERANCES.requireDataBreachNoticeHours),
      paymentTermsMaxDays: num(t.paymentTermsMaxDays, DEFAULT_TOLERANCES.paymentTermsMaxDays),
      disallowNonCompete: bool(t.disallowNonCompete, DEFAULT_TOLERANCES.disallowNonCompete),
    },
    rules,
  };
}
