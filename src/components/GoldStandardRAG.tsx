import React, { useState } from "react";
import { BenchmarkComparison } from "../types";
import { GOLD_STANDARD_CLAUSES } from "../data/goldStandards";
import {
  GitCompare,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowRight,
  BookmarkCheck,
} from "lucide-react";

interface GoldStandardRAGProps {
  comparisons: BenchmarkComparison[];
}

export const GoldStandardRAG: React.FC<GoldStandardRAGProps> = ({ comparisons }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyClause = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const avgMatch =
    comparisons.length > 0
      ? Math.round(comparisons.reduce((acc, c) => acc + c.matchScore, 0) / comparisons.length)
      : 50;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <GitCompare size={15} /> RAG Benchmark Cross-Referencing
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Gold Standard Clause Alignment</h2>
          <p className="text-muted text-sm mt-1">
            Cross-references incoming contract clauses against company historical "Gold Standard" templates to identify missing protections and structural deviations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted font-medium">Average Benchmark Fit</div>
            <div
              className={`text-2xl font-black ${
                avgMatch >= 70 ? "text-brand" : avgMatch >= 40 ? "text-warn" : "text-danger"
              }`}
            >
              {avgMatch}%
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-xs ${
              avgMatch >= 70
                ? "border-brand text-brand bg-brand/10"
                : avgMatch >= 40
                ? "border-warn text-warn bg-warn/10"
                : "border-danger text-danger bg-danger/10"
            }`}
          >
            {avgMatch >= 70 ? "HIGH" : avgMatch >= 40 ? "FAIR" : "LOW"}
          </div>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="space-y-6">
        {comparisons.map((c, idx) => {
          const isCritical = c.matchScore < 35;
          const isWarning = c.matchScore >= 35 && c.matchScore < 70;

          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-surface border border-line hover:border-line-strong transition-all space-y-4"
            >
              {/* Category Header & Score */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-brand/15 text-brand">
                    {c.clauseCategory}
                  </span>
                  <h3 className="font-bold text-white text-base">{c.contractClauseTitle}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">Benchmark Match:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-24 h-2 bg-surface-solid rounded-full overflow-hidden border border-line">
                      <div
                        className={`h-full rounded-full ${
                          isCritical ? "bg-danger" : isWarning ? "bg-warn" : "bg-brand"
                        }`}
                        style={{ width: `${c.matchScore}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isCritical ? "text-danger" : isWarning ? "text-warn" : "text-brand"
                      }`}
                    >
                      {c.matchScore}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Side by Side Clauses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contract Ingested Clause */}
                <div className="p-4 rounded-xl bg-surface-solid/80 border border-line space-y-2">
                  <div className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center justify-between">
                    <span>Ingested Contract Clause</span>
                    <span className="text-danger font-mono text-[10px]">Current Exposure</span>
                  </div>
                  <div className="text-xs text-white/80 leading-relaxed font-mono bg-black/30 p-3 rounded-lg border border-line/40">
                    {c.contractClauseText}
                  </div>
                </div>

                {/* Company Gold Standard Clause */}
                <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-2 relative">
                  <div className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <BookmarkCheck size={13} /> {c.goldStandardTitle}
                    </span>
                    <button
                      onClick={() => handleCopyClause(String(idx), c.goldStandardText)}
                      className="text-[10px] text-brand hover:underline flex items-center gap-1 normal-case"
                    >
                      <Copy size={11} /> {copiedId === String(idx) ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="text-xs text-brand/90 leading-relaxed font-mono bg-black/30 p-3 rounded-lg border border-brand/20">
                    {c.goldStandardText}
                  </div>
                </div>
              </div>

              {/* Deviations & Missing Protections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Specific Deviations */}
                <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 space-y-2">
                  <div className="text-xs font-bold text-danger flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Identified Deviations from Gold Standard:
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-xs text-muted marker:text-danger">
                    {c.deviations.map((dev, dIdx) => (
                      <li key={dIdx}>{dev}</li>
                    ))}
                  </ul>
                </div>

                {/* Missing Protections */}
                <div className="p-3.5 rounded-xl bg-warn/10 border border-warn/20 space-y-2">
                  <div className="text-xs font-bold text-warn flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Missing Required Protections:
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-xs text-muted marker:text-warn">
                    {c.missingProtections.map((prot, pIdx) => (
                      <li key={pIdx}>{prot}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Recommendation */}
              <div className="p-3 rounded-xl bg-surface-solid border border-line flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-2" />
                  <span className="font-semibold text-white">Recommended Strategy:</span>
                  <span className="text-muted">{c.recommendation}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

