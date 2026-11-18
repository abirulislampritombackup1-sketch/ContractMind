export type RiskLevel = "Critical" | "High" | "Medium" | "Low" | "Review";

export type PlaybookRule = {
  id: string;
  category: "Indemnification" | "Liability Cap" | "Termination" | "IP Rights" | "Data Privacy" | "Payment & Milestones" | "Governing Law" | "Compliance & Security";
  title: string;
  targetStandard: string;
  fallbackAllowed: string;
  unacceptableTerms: string[];
  severity: "Critical" | "High" | "Medium" | "Low";
  weight: number;
};

export type Playbook = {
  id: string;
  name: string;
  description: string;
  badge: string;
  stance: "Buyer / Customer Protective" | "Vendor / Provider Shield" | "Balanced Market Standard" | "High-Growth Enterprise" | "Custom";
  rules: PlaybookRule[];
  tolerances: {
    maxLiabilityMultiplier: number; // e.g. 1x annual fees
    requireMutualIndemnity: boolean;
    requireTerminationForConvenience: boolean;
    convenienceNoticeDays: number;
    requireDataBreachNoticeHours: number;
    paymentTermsMaxDays: number;
    disallowNonCompete: boolean;
  };
};

export type CategoryScore = {
  category: string;
  score: number; // 0-100 (higher = higher risk)
  status: "Pass" | "Warning" | "Critical Deviation";
  comment: string;
};

export type RedlineItem = {
  id: string;
  clauseId: string;
  sectionTitle: string;
  originalText: string;
  proposedText: string;
  /** Bangla title and plain-Bangla meaning of the clauses (only for analyses run in Bangla). */
  sectionTitleBn?: string;
  originalTextBn?: string;
  proposedTextBn?: string;
  action: "replace" | "delete" | "insert";
  severity: RiskLevel;
  chainOfThought: {
    opposingCounselStance: string;
    commercialRiskAssessment: string;
    legalRationale: string;
    negotiationTalkingPoint: string;
  };
  answersFinding?: string; // Opposing Counsel finding id this redline answers ("OC-1")
  accepted?: boolean | null; // null = pending, true = accepted, false = rejected
  page?: string;
};

export type Obligation = {
  id: string;
  clauseRef: string;
  category: "Payment & Financial" | "Reporting & Notice" | "Compliance & Security" | "Delivery & Milestones" | "Termination & Transition" | "IP & Confidentiality";
  obligor: "Customer" | "Vendor" | "Mutual" | "Third Party";
  beneficiary: "Customer" | "Vendor" | "Mutual";
  requirement: string;
  triggerOrDeadline: string;
  recurrence: "One-time" | "Monthly" | "Quarterly" | "Annual" | "Trigger-based" | "Ongoing";
  breachConsequence: string;
  financialImpact?: string;
  status: "Pending Review" | "Active" | "Critical";
};

export type PaymentMilestone = {
  id: string;
  milestone: string;
  trigger: string;
  amount: string;
  deliverable: string;
  responsibleParty: string;
  status: "Pending" | "Scheduled" | "Conditional";
  phase?: string; // parent row in a nested table, e.g. "Phase 1 - Implementation"
  dueDate?: string; // ISO date when the contract states one
  offsetDays?: number; // days after offsetFrom, when the trigger is relative
  offsetFrom?: "effective_date" | "previous_milestone" | "acceptance" | "invoice" | "other";
  page?: number;
  source?: "text" | "table-image" | "both"; // where the row was read from
};

export type GoldStandardClause = {
  id: string;
  category: string;
  title: string;
  standardText: string;
  rationale: string;
  marketSource: string; // where the position comes from (described honestly, not a quotation)
  cuadCategory?: string; // matching CUAD v1 clause category, when there is one
  required?: boolean; // most commercial contracts should contain this protection
  jurisdiction?: string; // e.g. "EU / UK" for GDPR clauses
};

export type BenchmarkComparison = {
  clauseCategory: string;
  contractClauseTitle: string;
  contractClauseText: string;
  goldStandardTitle: string;
  goldStandardText: string;
  matchScore: number; // 0 - 100%
  deviations: string[];
  missingProtections: string[];
  recommendation: string;
  goldId?: string; // gold clause id (Gold Standard RAG)
  similarity?: number; // 0-1 cosine similarity between the gold clause and the contract section
  contractRef?: string; // contract section the comparison is based on, e.g. "C12 · Payment Terms"
  page?: number; // page of that section
};

/** A one-sided clause found by the Opposing Counsel agent (handed to the Dealmaker). */
export type OpposingFinding = {
  id: string; // "OC-1"
  clauseRef: string;
  quote: string; // verbatim contract text
  issue: string; // why it is one-sided
  severity: "Critical" | "High" | "Medium" | "Low";
  ruleId: string; // playbook rule it breaches, or ""
  leverage: string; // what the other side will argue
};

/** A protection the Gold Standard library expects but the contract may lack. */
export type MissingProtection = {
  goldId: string;
  category: string;
  title: string;
  standardText: string;
  bestSimilarity: number; // closest contract section, 0-1
  status: "missing" | "present" | "not_applicable";
  evidence: string; // AI's reason, or the clause it found
  confirmedByAI: boolean; // false when only the similarity search decided
};

/** What one agent did in the pipeline (shown on screen). */
export type AgentRun = {
  key: string;
  ok: boolean;
  model?: string;
  ms: number;
  tokens?: number;
  mode: "rag" | "full" | "gold" | "vision";
  skipped?: boolean; // the agent was not needed (e.g. no table pages)
  chunksSent?: number;
  chunksTotal?: number;
  receivedFrom?: string[]; // agents whose output this agent received
  note?: string;
};

export type AgentPerspective = {
  agent: "Opposing Counsel" | "Commercial Dealmaker" | "Risk Auditor" | "Contract Architect";
  avatar: string;
  roleDescription: string;
  stance: string;
  keyPoints: string[];
  counterOfferRecommendation: string;
};

export type RuleStatus = "Pass" | "Partial" | "Fail" | "Not Addressed" | "Not Assessed";

export type RuleAssessment = {
  ruleId: string;
  ruleTitle: string;
  category: string;
  severity: PlaybookRule["severity"];
  weight: number; // current weight (may be adjusted in the scorecard)
  baseWeight: number; // weight defined in the playbook
  status: RuleStatus;
  clauseRef: string;
  evidence: string; // verbatim contract quote ("" when the contract is silent)
  evidenceBn?: string; // plain-Bangla meaning of the quote (analyses run in Bangla)
  recommendation?: string; // AI's suggested fix for a rule that is not passing
  explanation: string;
  verified?: boolean; // evidence quote found in the contract text
  pointsLost: number; // weight × status factor
};

export type PlaybookScoring = {
  rules: RuleAssessment[];
  totalWeight: number; // Σ weight of assessed rules
  pointsLost: number; // Σ weight × factor
};

export type ContractAnalysisResult = {
  summary: string;
  contractTitle: string;
  parties: { name: string; role: string }[];
  overallRiskScore: number; // 0-100
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  playbookUsed: string;
  categoryScores: CategoryScore[];
  keyFacts: { label: string; value: string; icon?: string }[];
  agentPerspectives: AgentPerspective[];
  redlines: RedlineItem[];
  obligations: Obligation[];
  paymentMilestones: PaymentMilestone[];
  benchmarkComparisons: BenchmarkComparison[];
  scoring?: PlaybookScoring; // rule-by-rule playbook scoring the overall score is computed from
  isDemo?: boolean; // true = canned offline analysis of a bundled sample, not a live AI result
  incompleteSections?: string[]; // agent sections that failed (others still returned)
  modelsUsed?: string[]; // Gemini models that produced this result (shows fallback use)
  opposingFindings?: OpposingFinding[];
  missingProtections?: MissingProtection[];
  agentRuns?: AgentRun[];
  effectiveDate?: string; // ISO date found in the contract, used for the milestone calendar
  tableVision?: { pages: number[]; rows: number }; // pages read as images by the Table Vision agent
  rationaleCheck?: { repaired: number; dropped: number }; // redlines whose reasoning was filled in or that were removed
  goldSearch?: { clauses: number; matched: number; threshold: number }; // Gold Standard RAG stats
};

export type RepositoryContract = {
  id: string;
  title: string;
  dataset: "EDGAR (SEC)" | "CUAD v1" | "MAUD" | "Open Legal Data";
  parties: string;
  contractType: "Master Services Agreement (MSA)" | "SaaS & Cloud Agreement" | "Asset Purchase (M&A)" | "Non-Disclosure (NDA)" | "Software License";
  liabilityCap: string;
  indemnityType: "Mutual" | "Unilateral (Customer only)" | "Unilateral (Vendor only)" | "Uncapped";
  riskScore: number;
  snippet: string;
  governingLaw: string;
  keyObligationsCount: number;
  date: string;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  persona?: "In-House Counsel" | "Opposing Counsel" | "Commercial Dealmaker";
  text: string;
  timestamp: string;
  citations?: string[];
};
