#!/usr/bin/env node
// Accuracy test against CUAD v1's expert labels.
//
//   GEMINI_API_KEY=... node scripts/eval/cuad-eval.mjs [--n 40] [--seed 7] [--model gemini-3.5-flash]
//   node scripts/eval/cuad-eval.mjs --baseline [--n 40]      (keyword baseline, no API key needed)
//
// For each sampled CUAD contract the model says, for 12 clause types, whether the contract
// contains that clause and quotes the evidence. Answers are compared with the lawyers'
// labels in CUAD (precision / recall / F1 per clause type), governing law is compared with
// the labelled jurisdiction, and every quote is checked against the contract text.
//
// Writes docs/eval/cuad-results.json and docs/eval/cuad-results.md.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]] : acc), []));
const N = Number(args.n || 40);
const SEED = Number(args.seed || 7);
const BASELINE = !!args.baseline;
const MODEL = args.model || process.env.GEMINI_MODEL || "gemini-3.5-flash";
const KEY = process.env.GEMINI_API_KEY;
const MAX_CHARS = 120000;

if (!BASELINE && !KEY) {
  console.error("Set GEMINI_API_KEY, or run with --baseline for the keyword baseline.");
  process.exit(1);
}

// Clause types evaluated (corpus flag key → CUAD category and a short definition for the model).
const CATS = {
  capOnLiability: ["Cap On Liability", "a cap or limit on the amount of damages or liability (including exclusions of indirect/consequential damages)"],
  uncappedLiability: ["Uncapped Liability", "liability that is expressly not limited / carved out of the cap"],
  terminationForConvenience: ["Termination For Convenience", "a party may terminate without cause (for convenience)"],
  nonCompete: ["Non-Compete", "a restriction on competing or operating in a market"],
  exclusivity: ["Exclusivity", "an exclusive dealing, exclusive supply/licence or similar commitment"],
  changeOfControl: ["Change Of Control", "rights or consequences triggered by a change of control, merger or acquisition"],
  antiAssignment: ["Anti-Assignment", "assignment requires consent or is restricted"],
  auditRights: ["Audit Rights", "a right to audit books, records or compliance"],
  ipAssignment: ["Ip Ownership Assignment", "intellectual property is assigned to or owned by a party as a result of the contract"],
  insurance: ["Insurance", "a requirement to maintain insurance"],
  sourceCodeEscrow: ["Source Code Escrow", "source code must be deposited with an escrow agent"],
  mostFavoredNation: ["Most Favored Nation", "most-favoured-customer / best-price protection"],
};

// Keyword baseline: what simple search would find.
const KEYWORDS = {
  capOnLiability: /limitation of liability|in no event shall[^.]{0,120}liab|shall not exceed|consequential damages/i,
  uncappedLiability: /(shall not apply|does not apply|not limit)[^.]{0,120}(indemnif|confidential|infring)|unlimited liability/i,
  terminationForConvenience: /for convenience|without cause|for any reason (or no reason )?upon/i,
  nonCompete: /non-?compet|shall not[^.]{0,80}compet/i,
  exclusivity: /exclusive (right|distributor|license|licence|supplier|basis)|exclusively/i,
  changeOfControl: /change (of|in) control/i,
  antiAssignment: /may not (be )?assign|shall not assign|without the prior written consent[^.]{0,80}assign|assign[^.]{0,80}without[^.]{0,40}consent/i,
  auditRights: /\baudit\b/i,
  ipAssignment: /hereby assigns|shall (be|become) the (sole and )?exclusive property|work made for hire/i,
  insurance: /\binsurance\b/i,
  sourceCodeEscrow: /escrow/i,
  mostFavoredNation: /most favou?red|no less favou?rable|best price/i,
};

// ── Data ─────────────────────────────────────────────────────────────────────
const corpus = JSON.parse(fs.readFileSync(path.resolve("public/repository/corpus.json"), "utf8"));
const cuad = corpus.contracts.filter((c) => c.dataset === "CUAD v1");
let s = SEED;
const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const sample = [...cuad].sort(() => rand() - 0.5).slice(0, N);
const textOf = (id) => zlib.gunzipSync(fs.readFileSync(path.resolve(`public/repository/texts/${id}.txt.gz`))).toString("utf8");
const norm = (t) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

// ── Model ────────────────────────────────────────────────────────────────────
const SCHEMA = {
  type: "OBJECT",
  properties: {
    governingLaw: { type: "STRING" },
    clauses: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { key: { type: "STRING", enum: Object.keys(CATS) }, present: { type: "BOOLEAN" }, quote: { type: "STRING" } }, required: ["key", "present", "quote"] },
    },
  },
  required: ["governingLaw", "clauses"],
};

async function askModel(text) {
  const list = Object.entries(CATS).map(([k, [, d]]) => `- ${k}: ${d}`).join("\n");
  const body = {
    contents: [{ role: "user", parts: [{ text: `=== CONTRACT ===\n${text.slice(0, MAX_CHARS)}\n\n=== TASK ===\nFor each clause type below, say whether this contract contains it (present) and give an EXACT verbatim quote (max 200 characters) as evidence, or "" if absent. Also give governingLaw: the state or country whose law governs, or "".\n${list}` }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 4000 * 2 ** attempt));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return { out: JSON.parse(data.candidates[0].content.parts.map((p) => p.text).join("")), tokens: data.usageMetadata?.totalTokenCount || 0 };
    }
    if (![429, 500, 503].includes(res.status)) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error("Gemini kept failing.");
}

function baseline(text) {
  const t = text.slice(0, MAX_CHARS);
  const law = (t.match(/governed by[^.]{0,200}?laws? of[^.]{0,80}/i) || [""])[0];
  return { out: { governingLaw: law, clauses: Object.keys(CATS).map((key) => ({ key, present: KEYWORDS[key].test(t), quote: (t.match(KEYWORDS[key]) || [""])[0] })) }, tokens: 0 };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const stats = Object.fromEntries(Object.keys(CATS).map((k) => [k, { tp: 0, fp: 0, fn: 0, tn: 0 }]));
let lawRight = 0, lawTotal = 0, quotes = 0, quotesFound = 0, tokens = 0;
const perContract = [];

for (const [i, c] of sample.entries()) {
  const text = textOf(c.id);
  const { out, tokens: tk } = BASELINE ? baseline(text) : await askModel(text);
  tokens += tk;
  const hay = norm(text);
  for (const key of Object.keys(CATS)) {
    const got = out.clauses.find((x) => x.key === key);
    const pred = !!got?.present;
    const truth = !!c.flags[key];
    const st = stats[key];
    if (pred && truth) st.tp++; else if (pred && !truth) st.fp++; else if (!pred && truth) st.fn++; else st.tn++;
    if (pred && got.quote && got.quote.length >= 12) {
      quotes++;
      if (hay.includes(norm(got.quote).replace(/^["'.…\s]+|["'.…\s]+$/g, ""))) quotesFound++;
    }
  }
  if (c.governingLaw) {
    lawTotal++;
    if (norm(out.governingLaw || "").includes(c.governingLaw.toLowerCase()) || (c.governingLaw === "England and Wales" && /england/i.test(out.governingLaw || ""))) lawRight++;
  }
  perContract.push({ id: c.id, title: c.title });
  console.log(`${i + 1}/${sample.length} ${c.id} ${c.title.slice(0, 50)}`);
  if (!BASELINE) await new Promise((r) => setTimeout(r, 4500)); // free-tier pacing
}

const pct = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : null);
const rows = Object.entries(stats).map(([k, st]) => {
  const p = st.tp / (st.tp + st.fp), r = st.tp / (st.tp + st.fn);
  return { key: k, category: CATS[k][0], labelled: st.tp + st.fn, precision: pct(p), recall: pct(r), f1: pct((2 * p * r) / (p + r)), accuracy: pct((st.tp + st.tn) / sample.length) };
});
const micro = Object.values(stats).reduce((a, st) => ({ tp: a.tp + st.tp, fp: a.fp + st.fp, fn: a.fn + st.fn }), { tp: 0, fp: 0, fn: 0 });
const mp = micro.tp / (micro.tp + micro.fp), mr = micro.tp / (micro.tp + micro.fn);
const result = {
  method: BASELINE ? "keyword baseline (regular expressions, no AI)" : `Gemini ${MODEL}`,
  contracts: sample.length,
  seed: SEED,
  ranAt: new Date().toISOString(),
  overall: { precision: pct(mp), recall: pct(mr), f1: pct((2 * mp * mr) / (mp + mr)) },
  governingLawAccuracy: pct(lawRight / lawTotal),
  quoteVerbatimRate: pct(quotes ? quotesFound / quotes : NaN),
  tokens,
  categories: rows,
  sample: perContract,
};

fs.mkdirSync(path.resolve("docs/eval"), { recursive: true });
const suffix = BASELINE ? "-baseline" : "";
fs.writeFileSync(path.resolve(`docs/eval/cuad-results${suffix}.json`), JSON.stringify(result, null, 2));
const md = `# CUAD accuracy test — ${result.method}

${result.contracts} CUAD v1 contracts (seed ${SEED}), compared with the expert labels. Run ${result.ranAt.slice(0, 10)}.

| | Precision | Recall | F1 |
| --- | --- | --- | --- |
| **All 12 clause types (micro)** | ${result.overall.precision}% | ${result.overall.recall}% | ${result.overall.f1}% |

- Governing law matches the label: **${result.governingLawAccuracy}%**
- Evidence quotes found verbatim in the contract: **${result.quoteVerbatimRate ?? "–"}%**${tokens ? `\n- Tokens used: ${tokens.toLocaleString("en-US")}` : ""}

| Clause type (CUAD) | Contracts with it | Precision | Recall | F1 |
| --- | --- | --- | --- | --- |
${rows.map((r) => `| ${r.category} | ${r.labelled} | ${r.precision ?? "–"}% | ${r.recall ?? "–"}% | ${r.f1 ?? "–"}% |`).join("\n")}

Precision: of the clauses reported, how many CUAD's lawyers also labelled. Recall: of the labelled clauses, how many were found. "–" means there were no positive cases to measure.
`;
fs.writeFileSync(path.resolve(`docs/eval/cuad-results${suffix}.md`), md);
console.log(md);
