import React, { useState } from "react";
import { BenchmarkComparison, MissingProtection } from "../types";
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
import { useLang } from "../i18n/lang";

interface GoldStandardRAGProps {
  comparisons: BenchmarkComparison[];
  missing?: MissingProtection[];
  search?: { clauses: number; matched: number; threshold: number };
}

export const GoldStandardRAG: React.FC<GoldStandardRAGProps> = ({ comparisons, missing, search }) => {
  const { L, num, sec } = useLang();
  const pct = (n: number) => `${num(Math.round(n * 100))}%`;
  const gaps = (missing || []).filter((m) => m.status === "missing");
  const cleared = (missing || []).filter((m) => m.status !== "missing");
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
            <GitCompare size={15} /> {L("Benchmark Cross-Referencing", "আদর্শ ধারার সাথে তুলনা")}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{L("Gold Standard Clause Alignment", "আদর্শ ধারার সাথে মিল")}</h2>
          <p className="text-muted text-sm mt-1">
            {L('Cross-references incoming contract clauses against company historical "Gold Standard" templates to identify missing protections and structural deviations.', "চুক্তির ধারাগুলো প্রতিষ্ঠানের আদর্শ (গোল্ড স্ট্যান্ডার্ড) ধারার সাথে মিলিয়ে অনুপস্থিত সুরক্ষা ও বিচ্যুতি খুঁজে বের করে।")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted font-medium">{L("Average Benchmark Fit", "গড় মিল")}</div>
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
            {avgMatch >= 70 ? L("HIGH", "বেশি") : avgMatch >= 40 ? L("FAIR", "মাঝারি") : L("LOW", "কম")}
          </div>
        </div>
      </div>

      {search && (
        <div className="notice info">
          <Sparkles size={16} />
          <span>
            {L(
              `Embedding search compared every contract section with ${search.clauses} Gold Standard clauses: ${search.matched} matched (similarity of at least ${Math.round(search.threshold * 100)}%), ${(missing || []).length} required clause(s) had no similar section and were checked for gaps.`,
              num(`এমবেডিং সার্চ চুক্তির প্রতিটি অংশকে ${search.clauses}টি আদর্শ ধারার সাথে মিলিয়েছে: ${search.matched}টি মিলেছে (অন্তত ${Math.round(search.threshold * 100)}% সাদৃশ্য), ${(missing || []).length}টি প্রয়োজনীয় ধারার মতো কোনো অংশ পাওয়া যায়নি, সেগুলো ঘাটতি হিসেবে যাচাই করা হয়েছে।`)
            )}
          </span>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <AlertTriangle size={16} className="text-danger" /> {L("Missing protections", "অনুপস্থিত সুরক্ষা")} ({num(gaps.length)})
            </h3>
            <p className="text-xs text-muted mt-1">
              {L("No contract section was similar to these Gold Standard clauses, and the benchmark agent confirmed they are missing. Suggested wording to add:", "এই আদর্শ ধারাগুলোর মতো কোনো অংশ চুক্তিতে নেই, এবং বেঞ্চমার্ক এজেন্ট তা নিশ্চিত করেছে। যোগ করার প্রস্তাবিত লেখা:")}
            </p>
          </div>
          {gaps.map((m) => (
            <div key={m.goldId} className="missItem">
              <div className="flex items-center gap-2 flex-wrap justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tag danger">{m.category}</span>
                  <b className="text-white text-sm">{m.title}</b>
                  <span className="simBadge" title={L("Closest contract section", "সবচেয়ে কাছের অংশ")}>{L("closest", "সর্বোচ্চ মিল")} {pct(m.bestSimilarity)}</span>
                  {!m.confirmedByAI && <span className="tag neutral">{L("search only", "শুধু সার্চ")}</span>}
                </div>
                <button onClick={() => handleCopyClause(m.goldId, m.standardText)} className="text-[11px] text-brand hover:underline flex items-center gap-1">
                  <Copy size={11} /> {copiedId === m.goldId ? L("Copied!", "কপি হয়েছে!") : L("Copy clause", "ধারা কপি")}
                </button>
              </div>
              {m.evidence && <span className="text-xs text-muted">{m.evidence}</span>}
              <pre>{m.standardText}</pre>
            </div>
          ))}
        </div>
      )}

      {cleared.length > 0 && (
        <div className="text-xs text-muted px-1">
          {L("Checked and not missing: ", "যাচাই করা হয়েছে, অনুপস্থিত নয়: ")}
          {cleared.map((m) => `${m.title} (${m.status === "present" ? L("present", "আছে") : L("not needed for this contract", "এই চুক্তিতে প্রযোজ্য নয়")})`).join(" · ")}
        </div>
      )}

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
                  {c.similarity !== undefined && (
                    <span className="simBadge" title={L("Embedding similarity between this section and the gold clause", "এই অংশ ও আদর্শ ধারার এমবেডিং সাদৃশ্য")}>
                      {L("similarity", "সাদৃশ্য")} {pct(c.similarity)}
                    </span>
                  )}
                  {c.contractRef && (
                    <span className="text-[11px] text-faint">
                      {sec(c.contractRef)}
                      {c.page ? ` · ${L("p.", "পৃ.")} ${num(c.page)}` : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{L("Benchmark Match:", "মিল:")}</span>
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
                    <span>{L("Ingested Contract Clause", "চুক্তির ধারা")}</span>
                    <span className="text-danger font-mono text-[10px]">{L("Current Exposure", "বর্তমান ঝুঁকি")}</span>
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
                      <Copy size={11} /> {copiedId === String(idx) ? L("Copied!", "কপি হয়েছে!") : L("Copy", "কপি")}
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
                    <AlertTriangle size={14} /> {L("Identified Deviations from Gold Standard:", "আদর্শ থেকে বিচ্যুতি:")}
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
                    <ShieldCheck size={14} /> {L("Missing Required Protections:", "অনুপস্থিত প্রয়োজনীয় সুরক্ষা:")}
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
                  <span className="font-semibold text-white">{L("Recommended Strategy:", "পরামর্শকৃত কৌশল:")}</span>
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

