import { ContractAnalysisResult, Playbook } from "../types";
import { GOLD_STANDARD_CLAUSES } from "../data/goldStandards";
import { Language } from "../i18n/translations";
import { SAMPLE_CONTRACTS } from "../data/sampleContracts";
import { applyScoring, buildScoring } from "../utils/scoring";
import { RAG_CONFIG } from "../rag/config";
import { DocIndex, indexDocument, retrieveContext } from "../rag";
import { AGENT_RULES, ANSWER_RULES, NOT_FOUND } from "../rag/promptBuilder";
import { needsWholeDocument, summarizeDocument } from "../rag/summarize";
import { logUsage } from "../rag/tokenLog";

// The API key never reaches the browser: requests go to /api/gemini, and the
// server-side proxy (vite.config.ts) attaches GEMINI_API_KEY before forwarding.
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-3.8-flash";
// Used when the primary model is overloaded (503/429), erroring, or too slow.
const FALLBACK_MODEL =
  (import.meta.env.VITE_GEMINI_FALLBACK_MODEL as string | undefined) || "gemini-3.5-flash-lite";
const MAX_CHARS = 400000;

// Attempt plan per request: primary once, then the fallback (with one retry).
const ATTEMPTS: { model: string; timeoutMs: number; delayMs: number }[] = [
  { model: MODEL, timeoutMs: 25000, delayMs: 0 },
  { model: FALLBACK_MODEL, timeoutMs: 60000, delayMs: 0 },
  { model: FALLBACK_MODEL, timeoutMs: 60000, delayMs: 2000 },
];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Circuit breaker: after the primary model fails (overloaded / hung), skip it
// for a few minutes so every request doesn't wait out its timeout again.
const PRIMARY_COOLDOWN_MS = 5 * 60 * 1000;
let primaryBlockedUntil = 0;

// The canned demo analysis describes the bundled sample contracts only, so it
// may be shown for those — never for a contract the user uploaded.
const isSampleContract = (text: string) =>
  SAMPLE_CONTRACTS.some((s) => s.text.slice(0, MAX_CHARS).trim() === text.trim());

/**
 * POST to Gemini with a per-attempt timeout and automatic fallback to a second
 * model when the first is overloaded, failing, or hangs. Returns the final
 * Response (ok or not) and the model that produced it; throws only when every
 * attempt timed out or the network failed.
 */
async function callGemini(body: any): Promise<{ res: Response; model: string }> {
  let last: { res: Response; model: string } | null = null;
  let lastError = "";
  for (const { model, timeoutMs, delayMs } of ATTEMPTS) {
    const isPrimary = model === MODEL && model !== FALLBACK_MODEL;
    if (isPrimary && Date.now() < primaryBlockedUntil) continue;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    let payload = body;
    for (let strip = 0; strip < 2; strip++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`/api/gemini/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        // Some models reject thinkingConfig; retry the same model without it.
        if (res.status === 400 && payload?.generationConfig?.thinkingConfig && strip === 0) {
          const { thinkingConfig, ...rest } = payload.generationConfig;
          payload = { ...payload, generationConfig: rest };
          continue;
        }
        last = { res, model };
        if (res.ok || !RETRYABLE.has(res.status)) return last;
        lastError = `${model} returned ${res.status}`;
      } catch (e: any) {
        lastError =
          e?.name === "AbortError"
            ? `${model} did not respond within ${timeoutMs / 1000}s`
            : `${model}: ${e?.message || "network error"}`;
      } finally {
        clearTimeout(timer);
      }
      break;
    }
    if (isPrimary) primaryBlockedUntil = Date.now() + PRIMARY_COOLDOWN_MS;
    console.warn(`[ContractMind] ${lastError}; trying next option.`);
  }
  if (last) return last;
  throw new Error(`The AI service is not responding right now (${lastError}). Please try again in a minute.`);
}

async function geminiErrorMessage(res: Response, model: string): Promise<string> {
  let detail = "";
  try {
    detail = (await res.json())?.error?.message || "";
  } catch {}
  if (res.status === 401 || res.status === 403 || /api key/i.test(detail)) {
    return `Gemini rejected the request (${res.status}). Check GEMINI_API_KEY in .env and restart the server. ${detail}`.trim();
  }
  if (res.status === 404) {
    return `Gemini model "${model}" was not found (404). Check VITE_GEMINI_MODEL / VITE_GEMINI_FALLBACK_MODEL in .env. ${detail}`.trim();
  }
  if (res.status === 503 || res.status === 429) {
    return `Gemini is overloaded right now (${res.status}) on both the main and backup model. Please try again in a minute.`;
  }
  return `Gemini request failed (${res.status}). ${detail}`.trim();
}

async function toBase64(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// ── Response schemas (Gemini OpenAPI subset) ─────────────────────────────────
const STR = { type: "STRING" };
const INT = { type: "INTEGER" };
const en = (...values: string[]) => ({ type: "STRING", enum: values });
const arr = (items: any) => ({ type: "ARRAY", items });
const obj = (properties: Record<string, any>) => ({
  type: "OBJECT",
  properties,
  required: Object.keys(properties),
});

const RISK_SCHEMA = obj({
  contractTitle: STR,
  parties: arr(obj({ name: STR, role: STR })),
  overallRiskScore: INT, // AI estimate, only used if rule assessments are missing
  summary: STR,
  ruleAssessments: arr(
    obj({
      ruleId: STR,
      status: en("Pass", "Partial", "Fail", "Not Addressed"),
      clauseRef: STR,
      evidence: STR,
      explanation: STR,
    })
  ),
  keyFacts: arr(obj({ label: STR, value: STR })),
  agentPerspectives: arr(
    obj({
      agent: en("Opposing Counsel", "Commercial Dealmaker", "Risk Auditor"),
      roleDescription: STR,
      stance: STR,
      keyPoints: arr(STR),
      counterOfferRecommendation: STR,
    })
  ),
});

const REDLINE_SCHEMA = obj({
  redlines: arr(
    obj({
      id: STR,
      clauseId: STR,
      sectionTitle: STR,
      originalText: STR,
      proposedText: STR,
      action: en("replace", "delete", "insert"),
      severity: en("Critical", "High", "Medium", "Low"),
      chainOfThought: obj({
        opposingCounselStance: STR,
        commercialRiskAssessment: STR,
        legalRationale: STR,
        negotiationTalkingPoint: STR,
      }),
    })
  ),
});

const OBLIGATION_SCHEMA = obj({
  obligations: arr(
    obj({
      id: STR,
      clauseRef: STR,
      category: en("Payment & Financial", "Reporting & Notice", "Compliance & Security", "Delivery & Milestones", "Termination & Transition", "IP & Confidentiality"),
      obligor: en("Customer", "Vendor", "Mutual", "Third Party"),
      beneficiary: en("Customer", "Vendor", "Mutual"),
      requirement: STR,
      triggerOrDeadline: STR,
      recurrence: en("One-time", "Monthly", "Quarterly", "Annual", "Trigger-based", "Ongoing"),
      breachConsequence: STR,
      financialImpact: STR,
      status: en("Active", "Critical", "Pending Review"),
    })
  ),
  paymentMilestones: arr(
    obj({
      id: STR,
      milestone: STR,
      trigger: STR,
      amount: STR,
      deliverable: STR,
      responsibleParty: STR,
      status: en("Scheduled", "Conditional", "Pending"),
    })
  ),
});

const BENCHMARK_SCHEMA = obj({
  benchmarkComparisons: arr(
    obj({
      clauseCategory: STR,
      contractClauseTitle: STR,
      contractClauseText: STR,
      goldStandardTitle: STR,
      goldStandardText: STR,
      matchScore: INT,
      deviations: arr(STR),
      missingProtections: arr(STR),
      recommendation: STR,
    })
  ),
});

type AgentSpec = {
  key: "risk" | "redlines" | "obligations" | "benchmarks";
  label: string; // shown to the user if this section fails
  schema: any;
  context: string; // playbook / gold-standard material this agent needs
  task: string;
  // What this agent searches the contract for. `scale` multiplies VITE_RAG_TOP_K because
  // agents that must cover many clauses need more excerpts than a single question does.
  retrieval: { queries: string[]; scale: number; perQuery: number };
};

const usageText = (data: any): string =>
  (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");

export type AgentKey = AgentSpec["key"];
export type AgentState = "running" | "done" | "failed";

export async function runContractIntelligence(
  contractText: string,
  playbook: Playbook,
  file?: File,
  lang: Language = "en",
  onProgress?: (agent: AgentKey, state: AgentState) => void
): Promise<ContractAnalysisResult> {
  const truncatedText = contractText.slice(0, MAX_CHARS);

  // On failure: bundled samples get the labelled demo analysis; anything else
  // gets a real error instead of results that belong to a different contract.
  const failWith = (reason: string): ContractAnalysisResult => {
    if (!file && isSampleContract(truncatedText)) {
      console.warn(`Gemini unavailable (${reason}). Showing offline demo analysis for the sample contract.`);
      return { ...generateIntelligentFallback(truncatedText, playbook, lang), isDemo: true };
    }
    throw new Error(reason);
  };

  const playbookBlock = `=== SELECTED PLAYBOOK ===
Name: ${playbook.name} (${playbook.stance})
Description: ${playbook.description}
Tolerances:
- Max Liability Multiplier: ${playbook.tolerances.maxLiabilityMultiplier}x fees
- Require Mutual Indemnity: ${playbook.tolerances.requireMutualIndemnity}
- Require Termination for Convenience: ${playbook.tolerances.requireTerminationForConvenience} (Notice: ${playbook.tolerances.convenienceNoticeDays} days)
- Data Breach Notice Hours: ${playbook.tolerances.requireDataBreachNoticeHours} hours
- Payment Terms Max Days: Net ${playbook.tolerances.paymentTermsMaxDays}
Playbook Rules:
${playbook.rules.map((r) => `- [${r.category}] ${r.id} ${r.title} (Severity: ${r.severity}, Weight: ${r.weight}): Target: "${r.targetStandard}". Unacceptable: ${r.unacceptableTerms.join(", ")}`).join("\n")}`;

  const goldShort = `=== GOLD STANDARD BENCHMARKS ===
${GOLD_STANDARD_CLAUSES.map((g) => `- [${g.category}] ${g.title}: "${g.standardText.slice(0, 150)}..."`).join("\n")}`;

  // The benchmark agent gets the full gold-standard text (retrieval context).
  const goldFull = `=== GOLD STANDARD CLAUSE LIBRARY ===
${GOLD_STANDARD_CLAUSES.map((g) => `- ${g.id} [${g.category}] ${g.title} (source: ${g.marketSource})\n  Text: "${g.standardText}"\n  Rationale: ${g.rationale}`).join("\n")}`;

  const langBlock =
    lang === "bn"
      ? `=== LANGUAGE REQUIREMENT (CRITICAL) ===
Write all descriptive text in formal, high-quality Bengali (বাংলা). Keep verbatim contract quotes (originalText, contractClauseText) and clause numbers (e.g. "Section 5.2") in the contract's original language.`
      : "";

  const style =
    "Be concise: keep every free-text field to one or two sentences. Use only what is in the contract; never invent clauses. Return ONLY JSON matching the response schema.";

  const agents: AgentSpec[] = [
    {
      key: "risk",
      label: "Risk score & agent perspectives",
      schema: RISK_SCHEMA,
      retrieval: {
        queries: [
          "contract title, parties, effective date, term, governing law, key commercial terms",
          ...playbook.rules.map((r) => `${r.title}. ${r.targetStandard}`),
        ],
        scale: 3,
        perQuery: 2,
      },
      context: playbookBlock,
      task: `You are the RISK AUDITOR agent of ContractMind, a multi-agent contract intelligence system.
Score the contract against the selected playbook:
- contractTitle; parties (name, role).
- ruleAssessments: assess EVERY playbook rule listed above, one item per rule, using its exact rule id (e.g. "R-INDEM-01"):
  * status: "Pass" (contract meets the target standard or an allowed fallback), "Partial" (partly meets it / weaker but not unacceptable), "Fail" (contains unacceptable terms or clearly breaches the target), "Not Addressed" (contract is silent on it).
  * clauseRef: the section that governs it (e.g. "Section 6.2"), or "None".
  * evidence: an EXACT verbatim quote (max 200 characters) from the contract supporting the status — copy it character for character. Use "Not found" when the contract is silent.
  * explanation: one sentence on why.
  Where a playbook tolerance conflicts with a rule's target text, the tolerance wins.
- overallRiskScore: your own 0-100 estimate (100 = critical exposure). The final score is computed from ruleAssessments, so focus on those.
- summary: 2-4 sentence executive briefing on the deal and the main exposures.
- keyFacts: up to 8 essential terms (Contract Type, Effective Date, Initial Term, Liability Cap, Governing Law, Notice Period, ...). Use "Not found" when absent.
- agentPerspectives: exactly 3 items — "Opposing Counsel" (predatory clauses and traps the other side relies on), "Commercial Dealmaker" (balanced compromises to close the deal), "Risk Auditor" (specific playbook rule breaches by rule id). 2-4 keyPoints each.`,
    },
    {
      key: "redlines",
      label: "Redlines",
      schema: REDLINE_SCHEMA,
      retrieval: {
        queries: playbook.rules.map((r) => `${r.title}: ${r.unacceptableTerms.join("; ")}`),
        scale: 2.5,
        perQuery: 1,
      },
      context: `${playbookBlock}\n\n${goldShort}`,
      task: `You are the OPPOSING-COUNSEL & NEGOTIATOR agent of ContractMind.
Produce 4 to 6 redlines for the highest-risk clauses relative to the playbook. For each:
- id "RED-01", "RED-02", ...; clauseId (e.g. "Section 5.1"); sectionTitle.
- originalText: an EXACT verbatim quote from the contract (max 250 characters) — copy it character for character so it can be located in the document.
- proposedText: balanced replacement wording that satisfies the playbook.
- action, severity.
- chainOfThought: opposingCounselStance (why the clause is one-sided), commercialRiskAssessment (practical business risk), legalRationale (justification for the change), negotiationTalkingPoint (what to say to the other side).`,
    },
    {
      key: "obligations",
      label: "Obligations & payment milestones",
      schema: OBLIGATION_SCHEMA,
      retrieval: {
        queries: [
          "payment terms, fees, invoicing, payment schedule, milestone table",
          "obligations, deliverables, deadlines, notice and reporting requirements",
          "termination, renewal, breach consequences, penalties, late fees",
          "confidentiality, intellectual property, data security and compliance duties",
          "indemnification, liability, warranties, service levels",
        ],
        scale: 3,
        perQuery: 3,
      },
      context: "",
      task: `You are the OBLIGATION EXTRACTION agent of ContractMind.
- obligations: 5 to 10 concrete obligations, ids "OBL-001", ... Include clauseRef, who owes it (obligor) and to whom (beneficiary), the requirement, the trigger or deadline, recurrence, breachConsequence, financialImpact (amount, penalty, or "Not specified"), and status ("Critical" for obligations with severe consequences).
- paymentMilestones: every payment milestone or scheduled payment, including rows of any payment/milestone tables (ids "M-1", ...). Empty array if none.`,
    },
    {
      key: "benchmarks",
      label: "Gold Standard benchmark comparison",
      schema: BENCHMARK_SCHEMA,
      retrieval: {
        queries: GOLD_STANDARD_CLAUSES.map((g) => `${g.category}: ${g.title}`),
        scale: 2,
        perQuery: 1,
      },
      context: goldFull,
      task: `You are the BENCHMARK (RAG) agent of ContractMind.
Compare the contract against the Gold Standard clause library above. Produce 3 to 5 benchmarkComparisons for the most important clause categories: quote or summarize the contract clause, name the matching gold standard (title + its id), give matchScore 0-100 (100 = fully aligned), list concrete deviations and missing protections (use an empty array when there are none), and a practical recommendation.`,
    },
  ];

  try {
    const hasExtractedText =
      truncatedText.trim().length > 80 &&
      !truncatedText.includes("[Scanned PDF - Visual Processing Active]");

    // RAG: index the document once (cached by content hash), then each agent receives only
    // the excerpts relevant to its task. Any failure falls back to sending the whole document.
    let index: DocIndex | null = null;
    if (RAG_CONFIG.enabled && hasExtractedText) {
      try {
        index = await indexDocument({ file, text: contractText });
      } catch (e: any) {
        console.warn(`[ContractMind] Retrieval unavailable, sending the whole document instead: ${e?.message || e}`);
      }
    }

    // Whole-document part, encoded lazily and shared (only built if RAG is off or fails).
    let fullDocPart: Promise<any> | null = null;
    const getFullDocPart = () =>
      (fullDocPart ??= (async () =>
        !hasExtractedText && file && file.size < 14 * 1024 * 1024
          ? { inline_data: { mime_type: file.type || "application/pdf", data: await toBase64(file) } }
          : { text: `=== CONTRACT DOCUMENT TEXT ===\n${truncatedText}` })());

    const modelsUsed = new Set<string>();

    const runAgent = async (a: AgentSpec): Promise<any> => {
      onProgress?.(a.key, "running");
      try {
        const out = await runAgentInner(a);
        onProgress?.(a.key, "done");
        return out;
      } catch (e) {
        onProgress?.(a.key, "failed");
        throw e;
      }
    };

    const runAgentInner = async (a: AgentSpec): Promise<any> => {
      let docPart: any;
      let mode: "rag" | "full" = "full";
      let sent: { n: number; total: number } | undefined;
      if (index) {
        try {
          const ctx = await retrieveContext(index, a.retrieval.queries, {
            topK: Math.round(RAG_CONFIG.topK * a.retrieval.scale),
            perQuery: a.retrieval.perQuery,
          });
          docPart = { text: `${ctx.block}\n\n${AGENT_RULES}` };
          mode = "rag";
          sent = { n: ctx.chunks.length, total: ctx.totalChunks };
        } catch (e: any) {
          console.warn(`[ContractMind] Retrieval failed for ${a.key}, sending the whole document: ${e?.message || e}`);
        }
      }
      docPart ??= await getFullDocPart();
      const instructions = [a.context, langBlock, `=== YOUR TASK ===\n${a.task}`, style].filter(Boolean).join("\n\n");
      const { res, model } = await callGemini({
        contents: [{ role: "user", parts: [docPart, { text: instructions }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: a.schema,
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: "low" },
        },
      });
      if (!res.ok) throw new Error(await geminiErrorMessage(res, model));
      const data = await res.json();
      logUsage(a.key, model, data?.usageMetadata, { mode, chunksSent: sent?.n, chunksTotal: sent?.total });
      const rawText: string = usageText(data);
      if (!rawText.trim()) throw new Error("Gemini returned an empty response.");
      try {
        const parsed = JSON.parse(rawText.replace(/```json|```/gi, "").trim());
        modelsUsed.add(model);
        return parsed;
      } catch {
        throw new Error("Gemini returned a response that was not valid JSON.");
      }
    };

    // All four agents run in parallel, so total time ≈ the slowest agent.
    const settled = await Promise.allSettled(agents.map(runAgent));
    const byKey: Record<string, any> = {};
    const failed: string[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") byKey[agents[i].key] = s.value;
      else {
        failed.push(agents[i].label);
        console.warn(`[ContractMind] ${agents[i].label} failed:`, s.reason);
      }
    });

    // Without the risk agent there is no score or summary — treat as a failure.
    if (!byKey.risk) {
      const reason = settled[0].status === "rejected" ? (settled[0].reason as Error)?.message : "";
      throw new Error(reason || "The risk analysis could not be completed.");
    }

    let result = sanitizeResult(
      { ...byKey.risk, ...byKey.redlines, ...byKey.obligations, ...byKey.benchmarks },
      playbook
    );
    // The risk score is computed in code from the playbook's rule weights, not
    // taken from the model. Only fall back to the model's estimate if it
    // returned no rule assessments at all.
    const scoring = buildScoring(byKey.risk.ruleAssessments, playbook, truncatedText);
    if (scoring.rules.some((r) => r.status !== "Not Assessed")) {
      result = applyScoring(result, scoring);
    }
    return {
      ...result,
      incompleteSections: failed.length ? failed : undefined,
      modelsUsed: [...modelsUsed],
    };
  } catch (error: any) {
    return failWith(error?.message || "Could not reach the analysis service.");
  }
}

// ── Deep-defensive sanitizer ──────────────────────────────────────────────────
// Gemini may omit nested fields entirely (keyPoints, chainOfThought, deviations…).
// Without defaults the UI components crash on .map() / property access, React
// unmounts the whole app, and the user sees the upload screen again.
function sanitizeResult(raw: any, playbook: Playbook): ContractAnalysisResult {
  const p = raw ?? {};

  const safeString = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);
  const safeArray = (v: any) => (Array.isArray(v) ? v : []);
  const safeNum = (v: any, fallback = 50) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const emptyCot = {
    opposingCounselStance: "Not provided by analysis engine.",
    commercialRiskAssessment: "Not provided by analysis engine.",
    legalRationale: "Not provided by analysis engine.",
    negotiationTalkingPoint: "Not provided by analysis engine.",
  };

  const score = Math.min(100, Math.max(0, Math.round(safeNum(p.overallRiskScore, 50))));

  return {
    contractTitle: safeString(p.contractTitle, "Contract Intelligence Assessment"),
    summary: safeString(p.summary, "Analysis completed."),
    parties: safeArray(p.parties).length > 0
      ? safeArray(p.parties).map((pt: any) => ({
          name: safeString(pt?.name, "Unknown Party"),
          role: safeString(pt?.role, "Party"),
        }))
      : [{ name: "Party A", role: "Vendor" }, { name: "Party B", role: "Customer" }],

    overallRiskScore: score,
    riskLevel: safeString(
      p.riskLevel,
      score >= 70 ? "Critical" : score >= 40 ? "High" : "Medium"
    ) as ContractAnalysisResult["riskLevel"],

    playbookUsed: playbook.name,

    categoryScores: safeArray(p.categoryScores).map((c: any) => ({
      category: safeString(c?.category, "General"),
      score: Math.min(100, Math.max(0, Math.round(safeNum(c?.score, 50)))),
      status: (["Pass", "Warning", "Critical Deviation"].includes(c?.status)
        ? c.status
        : "Warning") as "Pass" | "Warning" | "Critical Deviation",
      comment: safeString(c?.comment, "No additional comment."),
    })),

    keyFacts: safeArray(p.keyFacts).map((k: any) => ({
      label: safeString(k?.label, "Fact"),
      value: safeString(k?.value, "Not available"),
    })),

    agentPerspectives: safeArray(p.agentPerspectives).map((a: any) => ({
      agent: (["Opposing Counsel", "Commercial Dealmaker", "Risk Auditor", "Contract Architect"].includes(a?.agent)
        ? a.agent
        : "Risk Auditor") as "Opposing Counsel" | "Commercial Dealmaker" | "Risk Auditor" | "Contract Architect",
      avatar: safeString(
        a?.avatar,
        a?.agent === "Opposing Counsel" ? "⚖️" : a?.agent === "Commercial Dealmaker" ? "🤝" : "🛡️"
      ),
      roleDescription: safeString(a?.roleDescription, "Automated risk agent"),
      stance: safeString(a?.stance, "Review required"),
      keyPoints: safeArray(a?.keyPoints).map((kp: any) => safeString(kp, "Review this area.")),
      counterOfferRecommendation: safeString(a?.counterOfferRecommendation, "Further review recommended."),
    })),

    redlines: safeArray(p.redlines).map((r: any, idx: number) => ({
      id: safeString(r?.id, `RED-${idx + 1}`),
      clauseId: safeString(r?.clauseId, `Clause ${idx + 1}`),
      sectionTitle: safeString(r?.sectionTitle, "Contract Clause"),
      originalText: safeString(r?.originalText, "Original text not captured."),
      proposedText: safeString(r?.proposedText, "Proposed text not generated."),
      action: (["replace", "delete", "insert"].includes(r?.action) ? r.action : "replace") as "replace" | "delete" | "insert",
      severity: (["Critical", "High", "Medium", "Low", "Review"].includes(r?.severity)
        ? r.severity
        : "Medium") as "Critical" | "High" | "Medium" | "Low" | "Review",
      chainOfThought: {
        opposingCounselStance: safeString(r?.chainOfThought?.opposingCounselStance, emptyCot.opposingCounselStance),
        commercialRiskAssessment: safeString(r?.chainOfThought?.commercialRiskAssessment, emptyCot.commercialRiskAssessment),
        legalRationale: safeString(r?.chainOfThought?.legalRationale, emptyCot.legalRationale),
        negotiationTalkingPoint: safeString(r?.chainOfThought?.negotiationTalkingPoint, emptyCot.negotiationTalkingPoint),
      },
      accepted: null,
      page: safeString(r?.page),
    })),

    obligations: safeArray(p.obligations).map((o: any, idx: number) => ({
      id: safeString(o?.id, `OBL-${idx + 1}`),
      clauseRef: safeString(o?.clauseRef, "Not specified"),
      category: (["Compliance & Security", "Payment & Financial", "Reporting & Notice", "Delivery & Milestones", "Termination & Transition", "IP & Confidentiality"].includes(o?.category)
        ? o.category
        : "Compliance & Security") as "Compliance & Security" | "Payment & Financial" | "Reporting & Notice" | "Delivery & Milestones" | "Termination & Transition" | "IP & Confidentiality",
      obligor: (["Customer", "Vendor", "Mutual", "Third Party"].includes(o?.obligor)
        ? o.obligor
        : "Mutual") as "Customer" | "Vendor" | "Mutual" | "Third Party",
      beneficiary: (["Customer", "Vendor", "Mutual"].includes(o?.beneficiary)
        ? o.beneficiary
        : "Mutual") as "Customer" | "Vendor" | "Mutual",
      requirement: safeString(o?.requirement, "Obligation detail not captured."),
      triggerOrDeadline: safeString(o?.triggerOrDeadline, "Not specified"),
      recurrence: (["One-time", "Monthly", "Quarterly", "Annual", "Trigger-based", "Ongoing"].includes(o?.recurrence)
        ? o.recurrence
        : "One-time") as "One-time" | "Monthly" | "Quarterly" | "Annual" | "Trigger-based" | "Ongoing",
      breachConsequence: safeString(o?.breachConsequence, "Not specified"),
      financialImpact: safeString(o?.financialImpact),
      status: (["Active", "Critical", "Pending Review"].includes(o?.status)
        ? o.status
        : "Pending Review") as "Active" | "Critical" | "Pending Review",
    })),

    paymentMilestones: safeArray(p.paymentMilestones).map((m: any, idx: number) => ({
      id: safeString(m?.id, `M-${idx + 1}`),
      milestone: safeString(m?.milestone, "Milestone"),
      trigger: safeString(m?.trigger, "Not specified"),
      amount: safeString(m?.amount, "TBD"),
      deliverable: safeString(m?.deliverable, "Not specified"),
      responsibleParty: safeString(m?.responsibleParty, "TBD"),
      status: (["Pending", "Scheduled", "Conditional"].includes(m?.status)
        ? m.status
        : "Pending") as "Pending" | "Scheduled" | "Conditional",
    })),

    benchmarkComparisons: safeArray(p.benchmarkComparisons).map((b: any) => ({
      clauseCategory: safeString(b?.clauseCategory, "General"),
      contractClauseTitle: safeString(b?.contractClauseTitle, "Contract clause"),
      contractClauseText: safeString(b?.contractClauseText, "Not captured."),
      goldStandardTitle: safeString(b?.goldStandardTitle, "Gold Standard"),
      goldStandardText: safeString(b?.goldStandardText, "Benchmark text not available."),
      matchScore: Math.min(100, Math.max(0, Math.round(safeNum(b?.matchScore, 50)))),
      deviations: safeArray(b?.deviations).map((d: any) => safeString(d, "Deviation noted.")),
      missingProtections: safeArray(b?.missingProtections).map((mp: any) => safeString(mp, "Protection gap.")),
      recommendation: safeString(b?.recommendation, "Review recommended."),
    })),
  };
}

/** Chat answer built from retrieved excerpts, or from a chunk-by-chunk summary for whole-document asks. */
async function answerFromIndex(
  index: DocIndex,
  personaPrompt: string,
  persona: string,
  history: { role: "user" | "ai"; text: string }[],
  question: string,
  lang: Language
): Promise<string> {
  const generate = async (text: string, label: string) => {
    const { res, model } = await callGemini({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
    });
    if (!res.ok) throw new Error(await geminiErrorMessage(res, model));
    const data = await res.json();
    logUsage(label, model, data?.usageMetadata, { mode: "rag", chunksTotal: index.chunks.length });
    return usageText(data);
  };

  if (needsWholeDocument(question)) {
    const langNote = lang === "bn" ? "Write the answer in clear, professional Bengali (বাংলা)." : "";
    return summarizeDocument(index.chunks, generate, { instruction: question, languageNote: langNote });
  }

  // A short follow-up ("and what about the cap?") is searched together with the previous question.
  const lastUser = [...history].reverse().find((h) => h.role === "user")?.text;
  const queries = question.length < 60 && lastUser ? [question, lastUser] : [question];
  const ctx = await retrieveContext(index, queries, { topK: RAG_CONFIG.topK, perQuery: Math.ceil(RAG_CONFIG.topK / queries.length) + 1 });

  const contents = [
    { role: "user", parts: [{ text: personaPrompt }] },
    { role: "model", parts: [{ text: `Understood. I am acting as ${persona}. I will answer only from the contract excerpts provided with each question.` }] },
    ...history.map((h) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: `${ctx.block}

${ANSWER_RULES}

=== QUESTION ===
${question}` }] },
  ];
  const { res, model } = await callGemini({
    contents,
    generationConfig: { temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
  });
  if (!res.ok) throw new Error(await geminiErrorMessage(res, model));
  const data = await res.json();
  logUsage("chat", model, data?.usageMetadata, { mode: "rag", chunksSent: ctx.chunks.length, chunksTotal: ctx.totalChunks });
  return usageText(data) || NOT_FOUND;
}

export async function askContractChat(
  contractText: string,
  persona: "In-House Counsel" | "Opposing Counsel" | "Commercial Dealmaker",
  history: { role: "user" | "ai"; text: string }[],
  question: string,
  file?: File,
  lang: Language = "en"
): Promise<string> {
  const personaInstruction =
    persona === "Opposing Counsel"
      ? "You are aggressive Opposing Counsel representing the adverse counterparty. Emphasize why the contract terms favor your client, defend unilateral clauses, and push back hard on any concessions."
      : persona === "Commercial Dealmaker"
      ? "You are a pragmatic VP of Business Operations. Focus on deal velocity, revenue potential, commercial compromise, and closing the contract without bogging down in endless legal paralysis."
      : "You are strict In-House Legal Counsel protecting the client's balance sheet, IP rights, and data privacy. Point out every risk, cite specific clause numbers, and recommend bulletproof protections.";

  const langInstruction = lang === "bn" ? "\nPlease answer entirely in clear, professional Bengali (বাংলা)." : "";

  const prompt = `${personaInstruction}
Base your answer exclusively on the provided contract text. CITE specific section numbers and clause quotes when available. Keep your response punchy, professional, and actionable.${langInstruction}`;

  try {
    // RAG path: retrieve only the passages relevant to this question (or, for whole-document
    // requests, summarise chunk by chunk). Falls through to the full-document path on failure.
    if (RAG_CONFIG.enabled && contractText.trim().length > 80 && !contractText.includes("[Scanned PDF")) {
      try {
        const index = await indexDocument({ file, text: contractText });
        const ragReply = await answerFromIndex(index, prompt, persona, history, question, lang);
        if (ragReply) return ragReply;
      } catch (e: any) {
        console.warn(`[ContractMind] Retrieval unavailable for chat, sending the whole document: ${e?.message || e}`);
      }
    }

    const docPart = file
      ? { inline_data: { mime_type: file.type || "application/pdf", data: await toBase64(file) } }
      : { text: `=== CONTRACT TEXT ===\n${contractText.slice(0, MAX_CHARS)}` };

    const contents = [
      { role: "user", parts: [docPart, { text: prompt }] },
      { role: "model", parts: [{ text: `Understood. I am acting as ${persona}. I will answer all questions with precise clause references.` }] },
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    const { res: response, model } = await callGemini({
      contents,
      generationConfig: { temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
    });

    if (!response.ok) {
      throw new Error(await geminiErrorMessage(response, model));
    }

    const data = await response.json();
    logUsage("chat", model, data?.usageMetadata, { mode: "full" });
    return usageText(data) || "No response received.";
  } catch (err: any) {
    return `I encountered an issue analyzing this question: ${err.message}. Please try again.`;
  }
}

// Deterministic intelligent fallback engine when offline or if API has rate limits
function generateIntelligentFallback(text: string, playbook: Playbook, lang: Language = "en"): ContractAnalysisResult {
  const isHighRisk = text.includes("ONE THOUSAND DOLLARS") || text.includes("UNILATERAL") || text.includes("irrevocable license to ingest") || text.includes("deemed automatically");
  const overallRiskScore = isHighRisk ? 88 : 46;

  return {
    contractTitle: text.includes("MASTER CLOUD SERVICES")
      ? (lang === "bn" ? "মাস্টার ক্লাউড সার্ভিসেস ও প্ল্যাটফর্ম লাইসেন্স চুক্তি" : "Master Cloud Services and Platform License Agreement")
      : text.includes("ASSET PURCHASE")
      ? (lang === "bn" ? "অ্যাসেট ক্রয় ও রেভিনিউ মাইলস্টোন আর্নআউট চুক্তি" : "Asset Purchase and Revenue Milestone Earnout Agreement")
      : (lang === "bn" ? "বাণিজ্যিক মাস্টার চুক্তি" : "Commercial Master Agreement"),
    parties: [
      { name: "NexusTech Cloud Enterprise Inc.", role: lang === "bn" ? "প্রোভাইডার / ভেন্ডর" : "Provider / Vendor" },
      { name: "Apex Retail Ventures LLC", role: lang === "bn" ? "গ্রাহক / লাইসেন্সি" : "Customer / Licensee" },
    ],
    overallRiskScore,
    riskLevel: overallRiskScore > 75 ? "Critical" : "High",
    playbookUsed: playbook.name,
    summary: lang === "bn"
      ? `${playbook.name} অনুযায়ী এই চুক্তিতে গ্রাহকের জন্য মারাত্মক একতরফা ঝুঁকি চিহ্নিত হয়েছে। প্রধান দুর্বলতাসমূহ: একপাক্ষিক ক্ষতিপূরণ (Section 5), মাত্র $১,০০০ এর নামমাত্র লায়াবিলিটি ক্যাপ (Section 6.2), এবং ভেন্ডরের এআই মডেল ট্রেইনিংয়ে কোম্পানির গোপনীয় তথ্য ব্যবহারের অধিকার (Section 4.2)। চুক্তি স্বাক্ষরের পূর্বে তাৎক্ষণিক রেডলাইন সংশোধন আবশ্যক।`
      : `Contract contains significant asymmetric risk exposures for Customer under the ${playbook.name}. Key vulnerabilities identified in Unilateral Indemnification (Section 5), Token Liability Cap of $1,000 (Section 6.2), and broad license granting Vendor rights to ingest proprietary Customer Data for generative AI model training (Section 4.2). Immediate redlining required prior to execution.`,
    categoryScores: [
      {
        category: lang === "bn" ? "ক্ষতিপূরণ ও আইনি প্রতিরক্ষা" : "Indemnification & Defense",
        score: isHighRisk ? 95 : 55,
        status: isHighRisk ? "Critical Deviation" : "Warning",
        comment: lang === "bn"
          ? "ভেন্ডর নিজের আইপি লঙ্ঘনের কোনো দায় নিচ্ছে না, কিন্তু গ্রাহককে সম্পূর্ণ একতরফা ক্ষতিপূরণের বোঝা চাপিয়েছে।"
          : "Provider disclaims all IP infringement defense while requiring Customer to indemnify Provider unconditionally.",
      },
      {
        category: lang === "bn" ? "দায়বদ্ধতার সর্বোচ্চ সীমা (লায়াবিলিটি ক্যাপ)" : "Limitation of Liability",
        score: isHighRisk ? 92 : 45,
        status: isHighRisk ? "Critical Deviation" : "Warning",
        comment: lang === "bn"
          ? "ভেন্ডরের দায় মাত্র $১,০০০ বা ১ মাসের ফিতে সীমাবদ্ধ, যেখানে গ্রাহকের দায় সম্পূর্ণরূপে অসীম।"
          : "Provider liability capped at token $1,000 while Customer liability remains completely uncapped.",
      },
      {
        category: lang === "bn" ? "বৌদ্ধিক সম্পদ ও এআই মডেল ট্রেনিং" : "Intellectual Property & AI Training",
        score: isHighRisk ? 85 : 40,
        status: isHighRisk ? "Critical Deviation" : "Pass",
        comment: lang === "bn"
          ? "ধারা ৪.২ ভেন্ডরকে গ্রাহকের গোপনীয় ডেটা দিয়ে কৃত্রিম বুদ্ধিমত্তা মডেল প্রশিক্ষণের চিরস্থায়ী অনুমতি দেয়।"
          : "Section 4.2 grants perpetual irrevocable right to ingest Customer confidential data for AI model pre-training.",
      },
      {
        category: lang === "bn" ? "চুক্তি বাতিল ও স্বয়ংক্রিয় নবায়ন" : "Termination & Auto-Renewal",
        score: isHighRisk ? 78 : 35,
        status: isHighRisk ? "Warning" : "Pass",
        comment: lang === "bn"
          ? "৩৬ মাসের অনমনীয় লক-ইন এবং ১২০ দিন পূর্বে নোটিশ না দিলে স্বয়ংক্রিয় নবায়ন ও পুরো ফি আদায়ের ফাঁদ।"
          : "36-month non-cancelable lock-in with 120-day advance notice requirement and full fee acceleration penalty.",
      },
      {
        category: lang === "bn" ? "পেমেন্ট শর্তাবলী ও মাইলস্টোন প্রশাসন" : "Payment & Milestone Governance",
        score: 65,
        status: "Warning",
        comment: lang === "bn"
          ? "মাত্র ৫ দিনে ডেলিভারি স্বয়ংক্রিয়ভাবে গৃহীত হওয়ার বিধান ও ২.০% চড়া মাসিক বিলম্ব সুদ।"
          : "5-day deemed acceptance clause with aggressive 2.0% monthly compounded late payment interest.",
      },
      {
        category: lang === "bn" ? "ডেটা গোপনীয়তা ও সাইবার নিরাপত্তা" : "Data Privacy & Cybersecurity",
        score: isHighRisk ? 80 : 30,
        status: isHighRisk ? "Warning" : "Pass",
        comment: lang === "bn"
          ? "২১ দিনের বিলম্বিত নিরাপত্তা ব্রিচ নোটিশ যা জিডিপিআর ও আন্তর্জাতিক মানদণ্ড লঙ্ঘন করে; $১০,০০০ অডিট ফি।"
          : "21-day delayed incident notification violates standard 24-48 hour regulatory and GDPR mandates; $10k audit fee.",
      },
    ],
    keyFacts: [
      { label: lang === "bn" ? "চুক্তির ধরন" : "Contract Type", value: lang === "bn" ? "এন্টারপ্রাইজ ক্লাউড SaaS ও SOW" : "Enterprise Cloud SaaS & SOW" },
      { label: lang === "bn" ? "চুক্তির মেয়াদ" : "Initial Term", value: lang === "bn" ? "৩৬ মাস (৩ বছর)" : "36 Months (3 Years)" },
      { label: lang === "bn" ? "নবায়ন নোটিশ" : "Auto-Renewal Notice", value: lang === "bn" ? "মেয়াদ শেষের ১২০ দিন পূর্বে লিখিত নোটিশ" : "120 Days Prior Notice Required" },
      { label: lang === "bn" ? "দায়বদ্ধতা সীমা" : "Liability Cap", value: lang === "bn" ? "$১,০০০ অথবা ১ মাসের ফি" : "Lesser of $1,000 or 1 Month Fees" },
      { label: lang === "bn" ? "ক্ষতিপূরণ" : "Indemnification", value: lang === "bn" ? "একতরফা (শুধু গ্রাহকের)" : "Unilateral (Customer only)" },
      { label: lang === "bn" ? "পেমেন্ট শর্ত" : "Payment Terms", value: lang === "bn" ? "নেট ১৫ দিন (২% বিলম্ব সুদ)" : "Net 15 Days (2% monthly late fee)" },
      { label: lang === "bn" ? "এআই ট্রেইনিং অধিকার" : "AI Training Rights", value: lang === "bn" ? "গ্রাহকের ডেটা ব্যবহারে বাধাহীন অনুমতি" : "Broad Unrestricted Customer Data Ingestion" },
      { label: lang === "bn" ? "আইন ও সালিশি" : "Governing Law", value: lang === "bn" ? "ডেলাওয়্যার (ক্যালিফোর্নিয়ায় সালিশি)" : "Delaware (AAA Arbitration in CA)" },
    ],
    agentPerspectives: [
      {
        agent: "Opposing Counsel",
        avatar: "⚖️",
        roleDescription: "NexusTech Chief Legal Counsel (Aggressive Stance)",
        stance: "Defends high pricing leverage and minimal operational exposure",
        keyPoints: [
          "Our software is multi-tenant and low-margin; a $1,000 liability cap is non-negotiable to protect against system-wide class actions.",
          "Customer assumes risk of third-party IP infringement since customer customizes workflows on the platform.",
          "Model ingestion rights in Section 4.2 are essential for platform telemetry and automated intelligence improvements.",
        ],
        counterOfferRecommendation: "Will agree to increase liability cap to 12 months fees ONLY if Customer accepts mutual indemnity and removes termination for convenience.",
      },
      {
        agent: "Commercial Dealmaker",
        avatar: "🤝",
        roleDescription: "VP of Business Development (Commercial Velocity)",
        stance: "Focuses on closing the partnership while mitigating fatal balance-sheet risks",
        keyPoints: [
          "Do not kill the deal over Net 15 vs Net 30, but DO NOT sign an uncapped unilateral indemnification.",
          "Trade off: Offer annual upfront prepayment in exchange for striking the 120-day auto-renewal and deleting the AI training data rights.",
          "Propose standard 12-month trailing fee liability cap so insurance will underwrite the MSA.",
        ],
        counterOfferRecommendation: "Accept 36-month term with an annual review checkpoint, mutual IP indemnity, and Net 30 terms.",
      },
      {
        agent: "Risk Auditor",
        avatar: "🛡️",
        roleDescription: "Compliance & Playbook Enforcement Agent",
        stance: "Evaluates deviations against corporate playbook tolerances",
        keyPoints: [
          "Critical Playbook Failure: Rule R-INDEM-01 breached. Zero vendor IP indemnity violates company risk policy.",
          "Critical Playbook Failure: Rule R-LIAB-01 breached. $1,000 cap is 99.5% below standard 1x ARR tolerance.",
          "High Playbook Failure: Rule R-AI-01 breached. Unrestricted model training on enterprise confidential data.",
        ],
        counterOfferRecommendation: "Execute redlines RED-01 through RED-05 immediately before submitting revised draft.",
      },
    ],
    redlines: [
      {
        id: "RED-01",
        clauseId: "Section 5.2",
        sectionTitle: "Indemnification - Provider Disclaimer",
        action: "replace",
        severity: "Critical",
        originalText: "PROVIDER EXPRESSLY DISCLAIMS ANY OBLIGATION TO INDEMNIFY OR DEFEND CUSTOMER AGAINST THIRD-PARTY CLAIMS ALLEGING INTELLECTUAL PROPERTY INFRINGEMENT OR PATENT VIOLATIONS ARISING FROM THE CLOUD PLATFORM.",
        proposedText: "Provider shall defend, indemnify, and hold harmless Customer, its officers, directors, and employees from and against any third-party claims, suits, or proceedings alleging that the Cloud Platform or Services infringe any patent, copyright, trademark, or trade secret of any third party.",
        chainOfThought: {
          opposingCounselStance: "Provider seeks total immunity from patent troll suits and copyright disputes, offloading all third-party software risk onto the customer.",
          commercialRiskAssessment: "If a competitor sues Customer for using Provider's platform, Customer would be forced to fund hundreds of thousands of dollars in defense costs without recourse.",
          legalRationale: "Standard market standard across all tier-1 software contracts (CUAD & EDGAR benchmarks) dictates that the creator of the software indemnifies the licensee against core IP infringement.",
          negotiationTalkingPoint: "Our enterprise policy prohibits deploying software where the vendor refuses to stand behind their own intellectual property. We require mutual IP indemnification.",
        },
      },
      {
        id: "RED-02",
        clauseId: "Section 6.2",
        sectionTitle: "Limitation of Liability - Token Cap",
        action: "replace",
        severity: "Critical",
        originalText: "PROVIDER'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL BE STRICTLY LIMITED TO THE LESSER OF: (A) ONE THOUSAND DOLLARS ($1,000.00); OR (B) THE FEES ACTUALLY PAID BY CUSTOMER IN THE PRECEDING ONE (1) MONTH.",
        proposedText: "Except for breaches of Section 4 (Confidentiality) and indemnification obligations under Section 5, each party's total aggregate liability arising out of or related to this Agreement shall be limited to the total fees actually paid or payable by Customer in the twelve (12) month period preceding the incident.",
        chainOfThought: {
          opposingCounselStance: "Provider limits exposure to a trivial $1,000 amount, making any legal claim effectively unenforceable regardless of catastrophic loss.",
          commercialRiskAssessment: "A $1,000 cap on a $200,000 implementation leaves Customer completely uncompensated in the event of major data loss or platform collapse.",
          legalRationale: "Replaces unconscionable token liability cap with standard 12-month trailing contract value cap with customary carve-outs for IP indemnity.",
          negotiationTalkingPoint: "A $1,000 liability cap renders all provider warranties illusory. We must align liability to 12 months fees paid, which is customary for enterprise SaaS.",
        },
      },
      {
        id: "RED-03",
        clauseId: "Section 4.2",
        sectionTitle: "AI Training & Data Ingestion",
        action: "replace",
        severity: "Critical",
        originalText: "Customer grants Provider an irrevocable, perpetual, royalty-free, worldwide license to ingest, process, and use all Customer Data, input prompts, document contents, and transactional metadata to train, enhance, and commercialize Provider's machine learning, artificial intelligence, and automated legal reasoning models.",
        proposedText: "Customer retains all right, title, and interest in and to Customer Data. Provider covenants that it shall not use Customer Data, input prompts, document contents, or generated outputs to train, fine-tune, or benchmark any generalized artificial intelligence, machine learning model, or commercial LLM without Customer's express prior written consent.",
        chainOfThought: {
          opposingCounselStance: "Provider attempts to quietly expropriate proprietary customer data and trade secrets to train its commercial AI models for competitive advantage.",
          commercialRiskAssessment: "Violates enterprise data security covenants, GDPR customer privacy, and client confidentiality obligations. Exposure to proprietary trade secret leakage.",
          legalRationale: "Strict data sovereignty boundary ensuring customer data remains isolated and prohibited from foundation model training.",
          negotiationTalkingPoint: "Our regulatory obligations and customer DPAs strictly prohibit third-party vendors from using our business data to train external foundation models.",
        },
      },
      {
        id: "RED-04",
        clauseId: "Section 2.3",
        sectionTitle: "Deemed Acceptance of Milestones",
        action: "replace",
        severity: "High",
        originalText: "Any milestone deliverable submitted by Provider shall be deemed automatically and irrevocably accepted by Customer unless Customer delivers detailed written rejection within five (5) business days of delivery.",
        proposedText: "Customer shall have fifteen (15) business days following receipt of each Milestone Deliverable to evaluate and test compliance against agreed specifications. Milestone acceptance shall require Customer's written signoff or formal verification.",
        chainOfThought: {
          opposingCounselStance: "5 business days is designed to force automatic deemed acceptance when enterprise stakeholders are in scheduling bottlenecks.",
          commercialRiskAssessment: "Risk of premature payment triggers for defective software modules that have not undergone comprehensive QA.",
          legalRationale: "Extends testing window to realistic 15 business days and removes dangerous automatic deemed acceptance trap.",
          negotiationTalkingPoint: "Enterprise technical validation requires at least 15 business days to execute end-to-end UAT test suites.",
        },
      },
      {
        id: "RED-05",
        clauseId: "Section 3.2",
        sectionTitle: "120-Day Auto-Renewal Trap",
        action: "replace",
        severity: "Medium",
        originalText: "This Agreement shall automatically renew for successive twelve (12) month terms unless Customer provides written notice of non-renewal at least one hundred and twenty (120) days prior to the expiration of the then-current term.",
        proposedText: "This Agreement shall automatically renew for successive twelve (12) month terms unless either party provides written notice of non-renewal at least thirty (30) days prior to the expiration of the then-current term, provided that Provider sends written renewal notification sixty (60) days in advance.",
        chainOfThought: {
          opposingCounselStance: "120-day notice is intentionally punitive, causing customers to inadvertently miss the opt-out window and lock into unwanted annual renewals.",
          commercialRiskAssessment: "Accidental renewals cost enterprise budgets tens of thousands of dollars in unwanted commitments.",
          legalRationale: "Reduces notice to standard 30 days and imposes obligation on vendor to send a proactive 60-day reminder.",
          negotiationTalkingPoint: "A 120-day notice window is unreasonable; standard SaaS agreements require 30 days notice with a 60-day reminder notice.",
        },
      },
      {
        id: "RED-06",
        clauseId: "Section 7.2",
        sectionTitle: "Security Breach Notice Window",
        action: "replace",
        severity: "High",
        originalText: "Provider shall make reasonable efforts to inform Customer within twenty-one (21) calendar days following completion of Provider's internal forensic investigation.",
        proposedText: "In the event of a verified or reasonably suspected Security Incident affecting Customer Data, Provider shall notify Customer in writing within forty-eight (48) hours of discovery and take immediate remedial action.",
        chainOfThought: {
          opposingCounselStance: "21-day timeline after internal investigation allows provider to hide breaches for months while investigating.",
          commercialRiskAssessment: "Customer faces massive statutory fines under GDPR (72h limit) and SEC disclosure rules (4-day limit) if notified 21 days late.",
          legalRationale: "Aligns reporting timeline with mandatory statutory and regulatory standards (48 hours).",
          negotiationTalkingPoint: "Under current data privacy regulations, 21 days post-investigation is legally non-compliant. We require notification within 48 hours.",
        },
      },
    ],
    obligations: [
      {
        id: "OBL-001",
        clauseRef: "Section 2.1 - Milestone M-101",
        category: "Delivery & Milestones",
        obligor: "Vendor",
        beneficiary: "Customer",
        requirement: "Deliver Architecture Design & Schema Configuration blueprint with technical sign-off",
        triggerOrDeadline: "30 Days Post-Effective Date",
        recurrence: "One-time",
        breachConsequence: "Delay in downstream milestone releases",
        financialImpact: "$35,000.00 payment release",
        status: "Active",
      },
      {
        id: "OBL-002",
        clauseRef: "Section 2.1 - Milestone M-102",
        category: "Delivery & Milestones",
        obligor: "Vendor",
        beneficiary: "Customer",
        requirement: "Execute Data Migration & Core Integration of 100,000 historical customer records",
        triggerOrDeadline: "60 Days Post-Effective Date",
        recurrence: "One-time",
        breachConsequence: "Service credits and schedule adjustment",
        financialImpact: "$55,000.00 payment release",
        status: "Active",
      },
      {
        id: "OBL-003",
        clauseRef: "Section 2.2 - Payment Invoicing",
        category: "Payment & Financial",
        obligor: "Customer",
        beneficiary: "Vendor",
        requirement: "Remit payment for delivered milestone invoices within Net 15 days",
        triggerOrDeadline: "15 Days from invoice receipt",
        recurrence: "Monthly",
        breachConsequence: "2.0% monthly interest penalty and immediate suspension right",
        financialImpact: "$200,000.00 total contract commitment",
        status: "Critical",
      },
      {
        id: "OBL-004",
        clauseRef: "Section 2.3 - Deliverable Review",
        category: "Reporting & Notice",
        obligor: "Customer",
        beneficiary: "Vendor",
        requirement: "Inspect submitted deliverables and issue written notice of defect or acceptance",
        triggerOrDeadline: "Within 5 business days of delivery",
        recurrence: "Trigger-based",
        breachConsequence: "Deliverable deemed irrevocably accepted",
        financialImpact: "Forfeiture of QA rejection rights",
        status: "Critical",
      },
      {
        id: "OBL-005",
        clauseRef: "Section 3.2 - Non-Renewal Notice",
        category: "Termination & Transition",
        obligor: "Customer",
        beneficiary: "Vendor",
        requirement: "Deliver written notice of intent not to renew agreement",
        triggerOrDeadline: "At least 120 days prior to 36-month term expiration",
        recurrence: "One-time",
        breachConsequence: "Automatic 12-month renewal lock-in",
        financialImpact: "Additional annual contract liability",
        status: "Active",
      },
      {
        id: "OBL-006",
        clauseRef: "Section 5.1 - Defense & Hold Harmless",
        category: "Compliance & Security",
        obligor: "Customer",
        beneficiary: "Vendor",
        requirement: "Defend and indemnify Vendor from all third-party claims, legal fees, and regulatory penalties",
        triggerOrDeadline: "Upon receipt of third-party notice",
        recurrence: "Trigger-based",
        breachConsequence: "Unlimited indemnification liability",
        financialImpact: "Uncapped legal exposure",
        status: "Critical",
      },
      {
        id: "OBL-007",
        clauseRef: "Section 7.2 - Security Incident Notice",
        category: "Reporting & Notice",
        obligor: "Vendor",
        beneficiary: "Customer",
        requirement: "Inform Customer of verified breach of Customer Data following internal investigation",
        triggerOrDeadline: "Within 21 calendar days of investigation completion",
        recurrence: "Trigger-based",
        breachConsequence: "Material breach of confidentiality covenants",
        financialImpact: "Potential regulatory non-compliance fines",
        status: "Active",
      },
    ],
    paymentMilestones: [
      {
        id: "M-101",
        milestone: "Architecture Design & Schema Config",
        trigger: "30 Days Post-Effective Date",
        amount: "$35,000.00",
        deliverable: "Technical blueprint sign-off or 5 days of delivery",
        responsibleParty: "Vendor",
        status: "Scheduled",
      },
      {
        id: "M-102",
        milestone: "Data Migration & Core Integration",
        trigger: "60 Days Post-Effective Date",
        amount: "$55,000.00",
        deliverable: "Successful ingestion of 100,000 historical records",
        responsibleParty: "Vendor",
        status: "Scheduled",
      },
      {
        id: "M-103",
        milestone: "UAT & Staging Verification",
        trigger: "90 Days Post-Effective Date",
        amount: "$40,000.00",
        deliverable: "Completion of test scripts with zero Sev-1 defects",
        responsibleParty: "Vendor & Customer",
        status: "Scheduled",
      },
      {
        id: "M-104",
        milestone: "Production Cutover & Go-Live",
        trigger: "120 Days Post-Effective Date",
        amount: "$50,000.00",
        deliverable: "Successful deployment and 48 hours stable uptime",
        responsibleParty: "Vendor",
        status: "Conditional",
      },
      {
        id: "M-105",
        milestone: "Post-Launch Warranty & Optimization",
        trigger: "150 Days Post-Effective Date",
        amount: "$20,000.00",
        deliverable: "Final documentation delivery and administrator training",
        responsibleParty: "Vendor",
        status: "Conditional",
      },
    ],
    benchmarkComparisons: [
      {
        clauseCategory: "Indemnification",
        contractClauseTitle: "Section 5.1 & 5.2 - Unilateral Customer Indemnity",
        contractClauseText: "Customer indemnifies Provider; Provider disclaims all IP infringement defense obligations.",
        goldStandardTitle: "Market Mutual IP & Third-Party Indemnification (GS-INDEM-01)",
        goldStandardText: "Provider unconditionally defends and indemnifies Customer against 3rd-party IP infringement; Customer indemnifies for Customer Data.",
        matchScore: 18,
        deviations: [
          "Zero provider IP indemnification",
          "One-sided customer indemnification obligation",
          "Customer assumes 100% of third-party patent and copyright risk",
        ],
        missingProtections: [
          "Provider IP warranty and defense",
          "Mutual settlement consent condition",
          "Exclusion for customer unmodified software use",
        ],
        recommendation: "Reject Section 5.2 in its entirety. Replace with GS-INDEM-01 standard mutual language.",
      },
      {
        clauseCategory: "Limitation of Liability",
        contractClauseTitle: "Section 6.2 - $1,000 Token Cap",
        contractClauseText: "Provider total liability strictly limited to lesser of $1,000 or 1 month fees. Customer liability uncapped.",
        goldStandardTitle: "12-Month Trailing Fee Cap with Balanced Super-Cap (GS-LIAB-01)",
        goldStandardText: "Mutual liability cap equal to 12 months fees paid, with 3x super-cap for data privacy breaches.",
        matchScore: 22,
        deviations: [
          "Liability capped at nominal $1,000 amount",
          "Asymmetrical cap (Vendor capped, Customer uncapped)",
          "No super-cap for data security or gross negligence",
        ],
        missingProtections: [
          "Reciprocal 12-month trailing fee limit",
          "Customary super-cap for confidentiality / data breach",
        ],
        recommendation: "Strike $1,000 token limitation. Insist on reciprocal 12-month fees paid cap.",
      },
      {
        clauseCategory: "IP & AI Model Training",
        contractClauseTitle: "Section 4.2 - Platform Telemetry & AI Model Ingestion",
        contractClauseText: "Customer grants irrevocable perpetual license to ingest customer data to train commercial AI models.",
        goldStandardTitle: "Customer Work Product Ownership & Non-Use for AI Training (GS-IP-01)",
        goldStandardText: "Provider shall not use Customer Data to train, fine-tune, or improve any foundation AI/LLM without express consent.",
        matchScore: 12,
        deviations: [
          "Involuntary expropriation of customer data for commercial foundation model training",
          "Perpetual and irrevocable rights survive contract termination",
        ],
        missingProtections: [
          "Express prohibition on AI model training",
          "Data segregation guarantee",
          "Data return/destruction covenants upon exit",
        ],
        recommendation: "Execute RED-03 to explicitly prohibit generative model pre-training on company prompts.",
      },
      {
        clauseCategory: "Termination",
        contractClauseTitle: "Section 3.2 & 3.4 - Lock-in with Fee Acceleration",
        contractClauseText: "36-month non-cancelable term, 120-day auto-renewal notice, full fee acceleration upon cancellation.",
        goldStandardTitle: "Mutual 30-Day Convenience Option & Pro-Rata Refund (GS-TERM-01)",
        goldStandardText: "Termination for convenience with 30 days notice and pro-rata refund of prepaid unearned fees.",
        matchScore: 30,
        deviations: [
          "No convenience termination permitted for customer",
          "120-day advance notice trap for renewals",
          "Liquidated damages acceleration clause",
        ],
        missingProtections: [
          "Pro-rata refund of prepaid fees",
          "Reasonable 30-day notice window",
        ],
        recommendation: "Negotiate 30-day notice window with removal of fee acceleration penalties.",
      },
    ],
  };
}

