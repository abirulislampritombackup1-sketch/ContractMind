// Repository search service: AI query parsing (with an offline fallback), semantic +
// keyword ranking, and a short cited answer for non-lawyers.

import { callGemini } from "../services/gemini";
import { embedTexts } from "../rag/embedder";
import { logUsage } from "../rag/tokenLog";
import { Corpus, CorpusContract, cosineAt, loadCorpus, loadVectors } from "./corpus";
import { Bm25, CLAUSE_KEYS, ParsedQuery, rank, Ranked, RepoFilters, parseQueryRules } from "./query";

const STR = { type: "STRING" };
const NUM = { type: "NUMBER" };
const PARSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    searchText: STR,
    capMaxUSD: NUM,
    capMinUSD: NUM,
    hasDollarCap: { type: "BOOLEAN" },
    uncapped: { type: "BOOLEAN" },
    governingLaw: { type: "ARRAY", items: STR },
    dataset: { type: "ARRAY", items: { type: "STRING", enum: ["CUAD v1", "MAUD", "EDGAR (SEC)"] } },
    contractType: { type: "ARRAY", items: STR },
    clauses: { type: "ARRAY", items: { type: "STRING", enum: Object.keys(CLAUSE_KEYS) } },
    noticeDaysMin: { type: "INTEGER" },
    party: STR,
  },
  required: ["searchText"],
};

/** Gemini turns the question into filters; the rule parser is used when that fails. */
export async function parseQuery(q: string, laws: string[], types: string[]): Promise<ParsedQuery> {
  const rules = parseQueryRules(q);
  try {
    const { res, model } = await callGemini({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Turn this search over a contract repository into filters. Only set a filter the user clearly asked for. Amounts in US dollars (e.g. "$1M" → 1000000). governingLaw must use these exact names: ${laws.join(", ")}. contractType words come from: ${types.join(", ")}. searchText = the remaining topic words in English (e.g. "liability cap indemnification"), or "" when the filters say everything.\n\nSearch: ${q}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", responseSchema: PARSE_SCHEMA, temperature: 0, thinkingConfig: { thinkingLevel: "low" } },
    });
    if (!res.ok) return rules;
    const data = await res.json();
    logUsage("repo-parse", model, data?.usageMetadata, { mode: "full" });
    const p = JSON.parse((data?.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || "").join(""));
    const f: RepoFilters = {};
    if (p.capMaxUSD > 0) f.capMaxUSD = p.capMaxUSD;
    if (p.capMinUSD > 0) f.capMinUSD = p.capMinUSD;
    if (p.hasDollarCap || f.capMaxUSD || f.capMinUSD) f.hasDollarCap = true;
    if (p.uncapped) f.uncapped = true;
    const lawSet = new Set(laws.map((l) => l.toLowerCase()));
    if (p.governingLaw?.length) f.governingLaw = p.governingLaw.filter((l: string) => lawSet.has(l.toLowerCase()));
    if (p.dataset?.length) f.dataset = p.dataset;
    if (p.contractType?.length) f.contractType = p.contractType;
    if (p.clauses?.length) f.clauses = p.clauses.filter((k: string) => k in CLAUSE_KEYS);
    if (p.noticeDaysMin > 0) f.noticeDaysMin = p.noticeDaysMin;
    if (typeof p.party === "string" && p.party.trim()) f.party = p.party.trim();
    for (const k of Object.keys(f) as (keyof RepoFilters)[]) if (Array.isArray(f[k]) && !(f[k] as any[]).length) delete f[k];
    return { text: typeof p.searchText === "string" ? p.searchText : rules.text, filters: f, by: "ai" };
  } catch {
    return rules;
  }
}

let bm25: { key: string; index: Bm25 } | null = null;

export type SearchResult = { corpus: Corpus; parsed: ParsedQuery; results: Ranked[]; semantic: boolean };

/** Runs a search. `parsed` can be passed in to re-run with edited filters (no AI call). */
export async function searchRepository(q: string, opts: { parsed?: ParsedQuery; useAI?: boolean } = {}): Promise<SearchResult> {
  const corpus = await loadCorpus();
  const all = corpus.contracts;
  const key = `${corpus.builtAt}:${all.length}`;
  if (bm25?.key !== key) bm25 = { key, index: new Bm25(all.map((c) => `${c.title} ${c.contractType} ${c.summary}`)) };
  const laws = [...new Set(all.map((c) => c.governingLaw).filter(Boolean))];
  const types = [...new Set(all.map((c) => c.contractType))];
  const parsed = opts.parsed ?? (q.trim() ? (opts.useAI === false ? parseQueryRules(q) : await parseQuery(q, laws, types)) : { text: "", filters: {}, by: "rules" as const });

  let semantic: ((c: CorpusContract) => number | undefined) | undefined;
  if (parsed.text.trim()) {
    const vectors = await loadVectors();
    if (vectors) {
      try {
        const [qv] = await embedTexts([parsed.text], "RETRIEVAL_QUERY", { dim: vectors.dim });
        semantic = (c) => {
          const i = vectors.index.get(c.id);
          return i === undefined ? undefined : cosineAt(vectors, i, qv);
        };
      } catch (e) {
        console.warn("[ContractMind] Semantic search unavailable, using keywords:", e);
      }
    }
  }
  return { corpus, parsed, results: rank(all, parsed, bm25.index, semantic), semantic: !!semantic };
}

/** A short plain-language answer citing the top matches by id. */
export async function answerQuestion(q: string, results: Ranked[], lang: "en" | "bn"): Promise<string> {
  const top = results.slice(0, 8).map(({ c }) =>
    `[${c.id}] ${c.title} (${c.contractType}; ${c.parties.slice(0, 2).join(" / ")}; law: ${c.governingLaw || "not found"}; liability cap: ${
      c.cap.amountUSD ? `$${c.cap.amountUSD.toLocaleString("en-US")}` : c.cap.type
    }${c.cap.text ? ` — "${c.cap.text.slice(0, 220)}"` : ""})`
  );
  const { res, model } = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `A non-lawyer asked: "${q}". ${results.length} contracts matched. Using ONLY the matches below, answer in 2-4 short sentences${
              lang === "bn" ? " in simple Bengali (বাংলা)" : ""
            }: what the matches show (e.g. typical cap levels, common patterns) and which ones to look at first. Cite contracts by id in square brackets. If the matches do not answer the question, say so.\n\n${top.join("\n")}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  logUsage("repo-answer", model, data?.usageMetadata, { mode: "full" });
  return (data?.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || "").join("").trim();
}
