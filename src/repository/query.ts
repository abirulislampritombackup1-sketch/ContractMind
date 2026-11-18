// Natural-language search over the contract repository.
//
//   "contracts with liability caps below $1M under Delaware law"
//     → filters { capMaxUSD: 1_000_000, governingLaw: ["Delaware"] } + search text "liability cap"
//
// Gemini turns the question into filters when it is available; a rule-based parser does
// the same offline. Filters are applied to the metadata, then results are ranked by
// meaning (embeddings, when the index exists) blended with keyword relevance (BM25).

import type { CorpusContract } from "./corpus";

export const CLAUSE_KEYS: Record<string, string> = {
  terminationForConvenience: "Termination for convenience",
  nonCompete: "Non-compete",
  exclusivity: "Exclusivity",
  changeOfControl: "Change of control",
  antiAssignment: "Anti-assignment",
  auditRights: "Audit rights",
  mostFavoredNation: "Most favoured nation",
  ipAssignment: "IP ownership assignment",
  sourceCodeEscrow: "Source code escrow",
  insurance: "Insurance",
  liquidatedDamages: "Liquidated damages",
  warranty: "Warranty",
  minimumCommitment: "Minimum commitment",
  revenueSharing: "Revenue / profit sharing",
  noSolicitEmployees: "No-solicit of employees",
  covenantNotToSue: "Covenant not to sue",
  postTerminationServices: "Post-termination services",
  uncappedLiability: "Uncapped liability",
  capOnLiability: "Liability cap",
  terminationFee: "Termination fee",
};

export type RepoFilters = {
  capMaxUSD?: number;
  capMinUSD?: number;
  hasDollarCap?: boolean;
  uncapped?: boolean;
  governingLaw?: string[];
  dataset?: string[];
  contractType?: string[];
  clauses?: string[]; // flag keys that must be present
  noticeDaysMin?: number;
  party?: string;
};

export type ParsedQuery = { text: string; filters: RepoFilters; by: "ai" | "rules" };

// ── Rule-based parser (works offline) ────────────────────────────────────────

const JURIS: [RegExp, string][] = [
  [/\bdelaware\b/i, "Delaware"], [/\bnew york\b|\bn\.?y\.?\b(?! ?times)/i, "New York"], [/\bcalifornia\b/i, "California"],
  [/\btexas\b/i, "Texas"], [/\bflorida\b/i, "Florida"], [/\bnevada\b/i, "Nevada"], [/\billinois\b/i, "Illinois"],
  [/\bmassachusetts\b/i, "Massachusetts"], [/\bpennsylvania\b/i, "Pennsylvania"], [/\bnew jersey\b/i, "New Jersey"],
  [/\bgeorgia\b/i, "Georgia"], [/\bwashington\b/i, "Washington"], [/\bvirginia\b/i, "Virginia"], [/\bcolorado\b/i, "Colorado"],
  [/\bohio\b/i, "Ohio"], [/\bmaryland\b/i, "Maryland"], [/\butah\b/i, "Utah"], [/\bminnesota\b/i, "Minnesota"],
  [/\bengland\b|\bu\.?k\.?\b|united kingdom|english law/i, "England and Wales"], [/\bcanada\b|\bontario\b/i, "Canada"],
  [/\bchina\b|\bprc\b/i, "China"], [/\bhong kong\b/i, "Hong Kong"], [/\bsingapore\b/i, "Singapore"], [/\bgermany\b|german law/i, "Germany"],
  [/\bfrance\b|french law/i, "France"], [/\bireland\b|irish law/i, "Ireland"], [/\bnetherlands\b|dutch law/i, "Netherlands"],
  [/\bisrael\b/i, "Israel"], [/\bindia\b/i, "India"], [/\bjapan\b/i, "Japan"], [/\bswitzerland\b|swiss law/i, "Switzerland"],
];

const CLAUSE_WORDS: [RegExp, string][] = [
  [/termination for convenience|terminate for convenience|convenience termination/i, "terminationForConvenience"],
  [/non-?compete|non-?competition/i, "nonCompete"],
  [/exclusiv/i, "exclusivity"],
  [/change of control|change-of-control/i, "changeOfControl"],
  [/anti-?assignment|assignment restriction|no assignment/i, "antiAssignment"],
  [/audit/i, "auditRights"],
  [/most favou?red/i, "mostFavoredNation"],
  [/source code escrow|escrow/i, "sourceCodeEscrow"],
  [/insurance/i, "insurance"],
  [/liquidated damages/i, "liquidatedDamages"],
  [/warrant/i, "warranty"],
  [/minimum (purchase |volume )?commitment/i, "minimumCommitment"],
  [/revenue shar|profit shar|royalt/i, "revenueSharing"],
  [/non-?solicit|no-?solicit/i, "noSolicitEmployees"],
  [/termination fee|break(-| )?up fee/i, "terminationFee"],
  [/ip (ownership|assignment)|assignment of (ip|intellectual property)/i, "ipAssignment"],
];

const TYPES = ["License", "Distributor", "Franchise", "Hosting", "Outsourcing", "Supply", "Maintenance", "Development", "Reseller", "Joint Venture", "Sponsorship", "Service", "Endorsement", "Manufacturing", "Marketing", "Collaboration", "Consulting", "Agency", "Co Branding", "Strategic Alliance", "Transportation", "Promotion", "Affiliate", "Merger"];

function money(n: string, unit?: string) {
  const v = Number(n.replace(/,/g, ""));
  const u = (unit || "").toLowerCase();
  return v * (u.startsWith("b") ? 1e9 : u === "m" || u === "mm" || u.startsWith("mil") ? 1e6 : u === "k" || u.startsWith("thou") ? 1e3 : 1);
}

export function parseQueryRules(q: string): ParsedQuery {
  const f: RepoFilters = {};
  let rest = q;
  const take = (re: RegExp) => {
    rest = rest.replace(re, " ");
  };

  const below = q.match(/(below|under|less than|lower than|at most|up to|<=?|max(?:imum)?)\s*(?:of\s*)?(?:us)?\$\s?([\d.,]+)\s*(k|m|mm|million|thousand|b|bn|billion)?/i);
  if (below) {
    f.capMaxUSD = money(below[2], below[3]);
    f.hasDollarCap = true;
    take(new RegExp(below[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  const above = q.match(/(above|over|more than|greater than|at least|>=?|min(?:imum)?)\s*(?:of\s*)?(?:us)?\$\s?([\d.,]+)\s*(k|m|mm|million|thousand|b|bn|billion)?/i);
  if (above) {
    f.capMinUSD = money(above[2], above[3]);
    f.hasDollarCap = true;
    take(new RegExp(above[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  if (/\buncapped\b|unlimited liability|no (liability )?cap/i.test(q)) f.uncapped = true;
  else if (/\b(dollar|fixed) (liability )?cap\b/i.test(q)) f.hasDollarCap = true;

  const laws = JURIS.filter(([re]) => re.test(q)).map(([, name]) => name);
  if (laws.length) f.governingLaw = [...new Set(laws)];
  const clauses = CLAUSE_WORDS.filter(([re]) => re.test(q)).map(([, k]) => k);
  if (clauses.length) f.clauses = [...new Set(clauses)];

  if (/\bmaud\b|merger|m&a|\bacquisition\b/i.test(q)) f.dataset = ["MAUD"];
  else if (/\bcuad\b/i.test(q)) f.dataset = ["CUAD v1"];
  else if (/\bedgar\b|\bsec\b/i.test(q)) f.dataset = ["EDGAR (SEC)"];
  const types = TYPES.filter((t) => new RegExp(`\\b${t.replace(" ", "[ -]?")}`, "i").test(q) && !(t === "Merger" && f.dataset));
  if (types.length) f.contractType = types;

  const notice = q.match(/(\d+)\s*\+?\s*days?'?\s*(?:or more\s*)?(?:prior\s*)?notice/i);
  if (notice) f.noticeDaysMin = Number(notice[1]);

  // Words the filters already cover would only add noise to the ranking.
  if (f.capMaxUSD !== undefined || f.capMinUSD !== undefined || f.hasDollarCap || f.uncapped) take(/\b(liability|liabilities|caps?|capped|uncapped|unlimited|limitation of)\b/gi);
  for (const [re] of JURIS) if (f.governingLaw?.length) take(new RegExp(re.source, "gi"));
  if (f.governingLaw?.length) take(/\b(english|governed|governing|law|laws)\b/gi);
  for (const [re] of CLAUSE_WORDS) if (f.clauses?.length) take(new RegExp(re.source, "gi"));
  for (const t of f.contractType || []) take(new RegExp(`\\b${t.replace(" ", "[ -]?")}\\w*`, "gi"));
  if (f.dataset?.length) take(/\b(maud|cuad|edgar|sec|mergers?|m&a|acquisitions?)\b/gi);
  if (f.noticeDaysMin !== undefined) take(/\d+\s*\+?\s*days?'?\s*(or more\s*)?(prior\s*)?notice( for termination)?/gi);

  return { text: rest.replace(/\s+/g, " ").trim(), filters: f, by: "rules" };
}

// ── Filters and ranking ──────────────────────────────────────────────────────

export function matches(c: CorpusContract, f: RepoFilters): boolean {
  if (f.dataset?.length && !f.dataset.includes(c.dataset)) return false;
  if (f.governingLaw?.length && !f.governingLaw.some((l) => c.governingLaw.toLowerCase() === l.toLowerCase())) return false;
  if (f.contractType?.length && !f.contractType.some((t) => c.contractType.toLowerCase().replace(/[-_]/g, " ").includes(t.toLowerCase()))) return false;
  if (f.uncapped && !c.flags.uncappedLiability) return false;
  if (f.hasDollarCap && c.cap.amountUSD == null) return false;
  if (f.capMaxUSD !== undefined && !(c.cap.amountUSD != null && c.cap.amountUSD <= f.capMaxUSD)) return false;
  if (f.capMinUSD !== undefined && !(c.cap.amountUSD != null && c.cap.amountUSD >= f.capMinUSD)) return false;
  if (f.clauses?.length && !f.clauses.every((k) => c.flags[k])) return false;
  if (f.noticeDaysMin !== undefined && !(c.noticeToEndRenewalDays != null && c.noticeToEndRenewalDays >= f.noticeDaysMin)) return false;
  if (f.party && !c.parties.some((p) => p.toLowerCase().includes(f.party!.toLowerCase()))) return false;
  return true;
}

const STOP = new Set("a an the of for to in on and or with without contracts contract agreements agreement show find me all any that which where is are under law laws governed by clause clauses".split(" "));
export const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t));

/** BM25 over the key-terms summaries (built lazily, once). */
export class Bm25 {
  private docs: Map<string, number>[] = [];
  private len: number[] = [];
  private df = new Map<string, number>();
  private avg = 1;
  constructor(texts: string[]) {
    for (const t of texts) {
      const tf = new Map<string, number>();
      const toks = tokens(t);
      for (const w of toks) tf.set(w, (tf.get(w) || 0) + 1);
      this.docs.push(tf);
      this.len.push(toks.length);
      for (const w of tf.keys()) this.df.set(w, (this.df.get(w) || 0) + 1);
    }
    this.avg = this.len.reduce((a, b) => a + b, 0) / Math.max(1, this.len.length);
  }
  score(i: number, q: string[]): number {
    const N = this.docs.length, k1 = 1.2, b = 0.75;
    let s = 0;
    for (const w of q) {
      const f = this.docs[i].get(w);
      if (!f) continue;
      const idf = Math.log(1 + (N - (this.df.get(w) || 0) + 0.5) / ((this.df.get(w) || 0) + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.len[i]) / this.avg)));
    }
    return s;
  }
}

export type Ranked = { c: CorpusContract; score: number; semantic?: number };

/**
 * Filters, then ranks. `semantic(i)` gives the embedding similarity of contract i when an
 * index exists. Pure filter queries are ordered by the filtered value (e.g. smallest cap first).
 */
export function rank(all: CorpusContract[], parsed: ParsedQuery, bm25: Bm25, semantic?: (c: CorpusContract) => number | undefined): Ranked[] {
  const q = tokens(parsed.text);
  const idx = new Map(all.map((c, i) => [c.id, i]));
  const hits = all.filter((c) => matches(c, parsed.filters));
  if (!q.length && !semantic) {
    const f = parsed.filters;
    const sorted = [...hits].sort((a, b) =>
      f.capMaxUSD !== undefined || f.hasDollarCap ? (a.cap.amountUSD ?? Infinity) - (b.cap.amountUSD ?? Infinity) : (b.date || "").localeCompare(a.date || "")
    );
    return sorted.map((c) => ({ c, score: 1 }));
  }
  const raw = hits.map((c) => ({ c, kw: q.length ? bm25.score(idx.get(c.id)!, q) : 0, sem: semantic?.(c) }));
  const maxKw = Math.max(1e-9, ...raw.map((r) => r.kw));
  return raw
    .map((r) => ({ c: r.c, semantic: r.sem, score: r.sem !== undefined ? 0.7 * r.sem + 0.3 * (r.kw / maxKw) : r.kw / maxKw }))
    .filter((r) => r.score > 0 || !q.length)
    .sort((a, b) => b.score - a.score);
}

/** Readable labels for the active filters (shown as removable chips). */
export function describeFilters(f: RepoFilters): { key: keyof RepoFilters; label: string }[] {
  const usd = (n: number) => `$${n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : n}`;
  const out: { key: keyof RepoFilters; label: string }[] = [];
  if (f.capMaxUSD !== undefined) out.push({ key: "capMaxUSD", label: `Liability cap ≤ ${usd(f.capMaxUSD)}` });
  if (f.capMinUSD !== undefined) out.push({ key: "capMinUSD", label: `Liability cap ≥ ${usd(f.capMinUSD)}` });
  if (f.hasDollarCap && f.capMaxUSD === undefined && f.capMinUSD === undefined) out.push({ key: "hasDollarCap", label: "Has a dollar liability cap" });
  if (f.uncapped) out.push({ key: "uncapped", label: "Uncapped liability" });
  if (f.governingLaw?.length) out.push({ key: "governingLaw", label: `Governing law: ${f.governingLaw.join(" or ")}` });
  if (f.dataset?.length) out.push({ key: "dataset", label: `Dataset: ${f.dataset.join(", ")}` });
  if (f.contractType?.length) out.push({ key: "contractType", label: `Type: ${f.contractType.join(" or ")}` });
  if (f.clauses?.length) out.push({ key: "clauses", label: `Has: ${f.clauses.map((k) => CLAUSE_KEYS[k] || k).join(", ")}` });
  if (f.noticeDaysMin !== undefined) out.push({ key: "noticeDaysMin", label: `Renewal opt-out notice ≥ ${f.noticeDaysMin} days` });
  if (f.party) out.push({ key: "party", label: `Party: ${f.party}` });
  return out;
}
