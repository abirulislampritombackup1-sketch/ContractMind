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
  action: "replace" | "delete" | "insert";
  severity: RiskLevel;
  chainOfThought: {
    opposingCounselStance: string;
    commercialRiskAssessment: string;
    legalRationale: string;
    negotiationTalkingPoint: string;
  };
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
};

export type GoldStandardClause = {
  id: string;
  category: string;
  title: string;
  standardText: string;
  rationale: string;
  marketSource: string; // e.g. "ABA Model Contract", "NVCA Model Docs", "EDGAR Tier-1"
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
