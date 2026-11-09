import React from "react";
import { ContractAnalysisResult } from "../types";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Building2,
  FileText,
  FileEdit,
  ListOrdered,
  GitCompare,
  ArrowRight,
  TrendingDown,
  Sparkles,
} from "lucide-react";

interface AnalysisOverviewProps {
  analysis: ContractAnalysisResult;
  onNavigateTab: (tab: string) => void;
  scorecard?: React.ReactNode;
}

export const AnalysisOverview: React.FC<AnalysisOverviewProps> = ({ analysis, onNavigateTab, scorecard }) => {
  const isCritical = analysis.overallRiskScore >= 70;
  const isWarning = analysis.overallRiskScore >= 40 && analysis.overallRiskScore < 70;

  return (
    <div className="space-y-6">
      {/* Top Hero Risk Summary */}
      <div className="p-6 rounded-2xl bg-surface border border-line flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-brand/15 text-brand">
              {analysis.contractTitle}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-solid border border-line text-muted">
              Calibrated to: <b className="text-white">{analysis.playbookUsed}</b>
            </span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">Contract Risk & Exposure Assessment</h2>
          <p className="text-muted text-xs leading-relaxed">{analysis.summary}</p>

          {/* Parties */}
          <div className="flex items-center gap-4 text-xs pt-1 flex-wrap">
            {(analysis.parties || []).map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-white/90">
                <Building2 size={13} className="text-brand" />
                <span>
                  <b>{p?.name || "Party"}</b> ({p?.role || "Role"})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Score Dial Card */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface-solid border border-line self-stretch lg:self-auto justify-center">
          <div
            className={`w-24 h-24 rounded-full border-8 flex flex-col items-center justify-center text-center ${
              isCritical
                ? "border-danger text-danger bg-danger/10 shadow-lg shadow-danger/10"
                : isWarning
                ? "border-warn text-warn bg-warn/10"
                : "border-brand text-brand bg-brand/10"
            }`}
          >
            <span className="text-2xl font-black leading-none">{analysis.overallRiskScore}</span>
            <span className="text-[10px] font-semibold uppercase mt-0.5 tracking-wider">/ 100</span>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted font-medium">Overall Exposure</div>
            <div
              className={`text-base font-extrabold ${
                isCritical ? "text-danger" : isWarning ? "text-warn" : "text-brand"
              }`}
            >
              {analysis.riskLevel} Risk
            </div>
            <div className="text-[11px] text-faint">
              {isCritical
                ? "Immediate redline required"
                : isWarning
                ? "Negotiation recommended"
                : "Acceptable standard"}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab("Redlines")}
          className="p-4 rounded-xl bg-surface border border-line hover:border-brand cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center">
              <FileEdit size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-brand transition-colors">
                Interactive Redlines
              </div>
              <div className="text-xs text-muted">{analysis.redlines.length} clause edits ready</div>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted group-hover:text-brand transition-transform group-hover:translate-x-1" />
        </div>

        <div
          onClick={() => onNavigateTab("Obligations")}
          className="p-4 rounded-xl bg-surface border border-line hover:border-brand-2 cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-2/15 text-brand-2 flex items-center justify-center">
              <ListOrdered size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-brand-2 transition-colors">
                Obligations & Milestones
              </div>
              <div className="text-xs text-muted">{analysis.obligations.length} duties extracted</div>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted group-hover:text-brand-2 transition-transform group-hover:translate-x-1" />
        </div>

        <div
          onClick={() => onNavigateTab("Gold Standard")}
          className="p-4 rounded-xl bg-surface border border-line hover:border-warn cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warn/15 text-warn flex items-center justify-center">
              <GitCompare size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-warn transition-colors">
                Gold Standard RAG
              </div>
              <div className="text-xs text-muted">{analysis.benchmarkComparisons.length} benchmark comparisons</div>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted group-hover:text-warn transition-transform group-hover:translate-x-1" />
        </div>
      </div>

      {scorecard}

      {/* Key Facts Grid */}
      {(analysis.keyFacts || []).length > 0 && (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
          <h3 className="font-bold text-white text-base">Key Extracted Contract Facts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(analysis.keyFacts || []).map((kf, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-surface-solid border border-line">
                <div className="text-[11px] text-faint mb-1">{kf?.label}</div>
                <div className="text-xs font-bold text-white break-words">{kf?.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Risk Breakdown */}
      <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base">Clause Risk Category Breakdown</h3>
          <span className="text-xs text-muted">Evaluated against {analysis.playbookUsed}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(analysis.categoryScores || []).map((cat, idx) => {
            const score = Number(cat?.score) || 0;
            const isCatCrit = score >= 70;
            const isCatWarn = score >= 40 && score < 70;

            return (
              <div key={idx} className="p-4 rounded-xl bg-surface-solid border border-line space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{cat?.category || "General"}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cat?.status === "Critical Deviation"
                          ? "bg-danger/20 text-danger"
                          : cat?.status === "Warning"
                          ? "bg-warn/20 text-warn"
                          : "bg-brand/20 text-brand"
                      }`}
                    >
                      {cat?.status || "Pass"}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isCatCrit ? "text-danger" : isCatWarn ? "text-warn" : "text-brand"
                      }`}
                    >
                      {score}/100
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isCatCrit ? "bg-danger" : isCatWarn ? "bg-warn" : "bg-brand"
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>

                <p className="text-xs text-muted leading-relaxed">{cat?.comment || ""}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Agent Perspectives Panel */}
      <div className="bg-surface p-6 rounded-2xl border border-line space-y-5">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <Sparkles size={15} /> Collaborative Multi-Agent Reasoning
          </div>
          <h3 className="font-bold text-white text-lg">Adversarial & Commercial Agent Perspectives</h3>
          <p className="text-xs text-muted mt-0.5">
            Different AI agents simulate opposing counsel aggressiveness vs commercial business deal velocity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(analysis.agentPerspectives || []).map((agent, idx) => {
            const isOpposing = agent?.agent === "Opposing Counsel";
            const isDealmaker = agent?.agent === "Commercial Dealmaker";

            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                  isOpposing
                    ? "bg-danger/5 border-danger/30"
                    : isDealmaker
                    ? "bg-brand-2/5 border-brand-2/30"
                    : "bg-brand/5 border-brand/30"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{agent?.avatar || "🛡️"}</span>
                    <div>
                      <h4
                        className={`text-sm font-bold ${
                          isOpposing ? "text-danger" : isDealmaker ? "text-brand-2" : "text-brand"
                        }`}
                      >
                        {agent?.agent || "Agent"}
                      </h4>
                      <div className="text-[10px] text-faint">{agent?.roleDescription}</div>
                    </div>
                  </div>

                  <div className="text-xs text-white/90 italic mb-3">"{agent?.stance || "Review required"}"</div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Key Arguments:</div>
                    <ul className="space-y-1 pl-4 list-disc text-xs text-muted marker:text-brand">
                      {(agent?.keyPoints || []).map((kp, kpIdx) => (
                        <li key={kpIdx}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-line/60">
                  <div className="text-[11px] font-bold text-white mb-1">Recommended Move:</div>
                  <div className="text-xs text-muted leading-relaxed bg-black/20 p-2.5 rounded-lg">
                    {agent?.counterOfferRecommendation || "Review carefully."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

