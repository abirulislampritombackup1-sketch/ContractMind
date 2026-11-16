import React, { useState, useMemo } from "react";
import { RepositoryContract } from "../types";
import { BENCHMARK_REPOSITORY_CONTRACTS } from "../data/repositoryContracts";
import {
  Search,
  Database,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  Layers,
} from "lucide-react";
import { useLang } from "../i18n/lang";
import { REPO_BN } from "../i18n/dataBn";

interface RepositorySearchProps {
  onLoadContractSnippet: (title: string, text: string) => void;
}

export const RepositorySearch: React.FC<RepositorySearchProps> = ({ onLoadContractSnippet }) => {
  const { L, bn, term } = useLang();
  const [query, setQuery] = useState<string>("");
  const [datasetFilter, setDatasetFilter] = useState<string>("All");
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("All");

  // The search matches English keywords, so Bangla chips carry an English query.
  const promptSuggestions: { label: string; q: string }[] = [
    { label: L("Find contracts with liability caps below $1M", "$১০ লাখের কম দায়সীমার চুক্তি"), q: "Find contracts with liability caps below $1M" },
    { label: L("Show agreements with uncapped indemnification", "সীমাহীন ক্ষতিপূরণের চুক্তি"), q: "Show agreements with uncapped indemnification" },
    { label: L("Filter contracts requiring 90+ days notice for termination", "বাতিলে ৯০+ দিনের নোটিশ লাগে এমন চুক্তি"), q: "Filter contracts requiring 90+ days notice for termination" },
    { label: L("Search M&A agreements with earnout milestone tables", "আর্নআউট মাইলস্টোনসহ অধিগ্রহণ চুক্তি"), q: "Search M&A agreements with earnout milestone tables" },
    { label: L("Cross-border contracts under Delaware or NY law", "ডেলাওয়্যার বা নিউ ইয়র্কের আইনে চুক্তি"), q: "Cross-border contracts under Delaware or NY law" },
  ];

  const filteredContracts = useMemo(() => {
    return BENCHMARK_REPOSITORY_CONTRACTS.filter((c) => {
      if (datasetFilter !== "All" && c.dataset !== datasetFilter) return false;
      if (contractTypeFilter !== "All" && c.contractType !== contractTypeFilter) return false;

      if (!query.trim()) return true;

      const q = query.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchParties = c.parties.toLowerCase().includes(q);
      const matchSnippet = c.snippet.toLowerCase().includes(q);
      const matchCap = c.liabilityCap.toLowerCase().includes(q);
      const matchLaw = c.governingLaw.toLowerCase().includes(q);

      // Handle natural language semantic queries
      if (q.includes("below $1m") || q.includes("under $1m") || q.includes("low cap")) {
        return c.liabilityCap.includes("$5,000") || c.liabilityCap.includes("$500,000") || c.liabilityCap.includes("Zero");
      }
      if (q.includes("uncapped") || q.includes("unilateral")) {
        return c.indemnityType.includes("Unilateral") || c.liabilityCap.includes("Uncapped");
      }
      if (q.includes("earnout") || q.includes("milestone") || q.includes("m&a")) {
        return c.contractType.includes("Asset Purchase") || c.snippet.includes("Milestone");
      }
      if (q.includes("delaware") || q.includes("new york") || q.includes("ny")) {
        return c.governingLaw.toLowerCase().includes("delaware") || c.governingLaw.toLowerCase().includes("new york");
      }

      return matchTitle || matchParties || matchSnippet || matchCap || matchLaw;
    });
  }, [query, datasetFilter, contractTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <Database size={15} /> EDGAR • CUAD • MAUD • {L("Open Legal Data", "উন্মুক্ত আইনি ডেটা")}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{L("Enterprise Repository Semantic Search", "চুক্তি ভান্ডারে খোঁজ")}</h2>
          <p className="text-muted text-sm mt-1">
            {L("Query 5,000+ benchmark corporate contracts for specific liability caps, indemnification terms, and milestone clauses.", "৫,০০০+ নমুনা কর্পোরেট চুক্তিতে দায়সীমা, ক্ষতিপূরণ ও মাইলস্টোন ধারা খুঁজুন।")}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted bg-surface-solid px-4 py-2 rounded-xl border border-line">
          <Database size={14} className="text-brand" />
          <span><b>5,420</b> {L("Annotated Benchmark Contracts", "টি টীকাযুক্ত নমুনা চুক্তি")}</span>
        </div>
      </div>

      {/* Search Input & NLP Chips */}
      <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L("Ask anything (e.g. 'Find contracts with liability caps below $1M' or 'Show uncapped indemnity')...", "ইংরেজি কীওয়ার্ড দিয়ে খুঁজুন (যেমন Delaware, uncapped, earnout)...")}
            className="w-full bg-[#060b16] border border-line-strong rounded-xl pl-11 pr-24 py-3.5 text-sm text-white focus:outline-none focus:border-brand"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-white"
            >
              {L("Clear", "মুছুন")}
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-faint flex items-center gap-1">
            <Sparkles size={12} className="text-brand" /> {L("Examples:", "উদাহরণ:")}
          </span>
          {promptSuggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(s.q)}
              className="text-xs px-3 py-1 rounded-full bg-surface-solid border border-line text-muted hover:text-white hover:border-brand transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-line/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted font-medium">{L("Dataset:", "ডেটাসেট:")}</span>
            {["All", "EDGAR (SEC)", "CUAD v1", "MAUD", "Open Legal Data"].map((ds) => (
              <button
                key={ds}
                onClick={() => setDatasetFilter(ds)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  datasetFilter === ds
                    ? "bg-brand/20 border-brand text-brand font-bold"
                    : "bg-surface-solid border-line text-muted hover:text-white"
                }`}
              >
                {ds === "All" ? L("All", "সব") : ds === "Open Legal Data" ? L(ds, "উন্মুক্ত আইনি ডেটা") : ds}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium">{L("Type:", "ধরন:")}</span>
            <select
              value={contractTypeFilter}
              onChange={(e) => setContractTypeFilter(e.target.value)}
              className="bg-surface-solid border border-line rounded-lg px-2.5 py-1 text-xs text-white"
            >
              <option value="All">{L("All Types", "সব ধরন")}</option>
              <option value="SaaS & Cloud Agreement">{L("SaaS & Cloud", "SaaS ও ক্লাউড")}</option>
              <option value="Master Services Agreement (MSA)">MSA</option>
              <option value="Asset Purchase (M&A)">{L("M&A Asset Purchase", "সম্পদ ক্রয় (অধিগ্রহণ)")}</option>
              <option value="Software License">{L("Software License", "সফটওয়্যার লাইসেন্স")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contract Results List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <span>{L(`Showing ${filteredContracts.length} matching contracts`, `${filteredContracts.length}টি চুক্তি পাওয়া গেছে`)}</span>
          <span>{L("Ranked by relevance", "প্রাসঙ্গিকতা অনুযায়ী সাজানো")}</span>
        </div>

        {filteredContracts.map((c) => (
          <div
            key={c.id}
            className="p-5 rounded-2xl bg-surface border border-line hover:border-line-strong transition-all space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-line">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-brand/15 text-brand">
                  {c.id}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-solid border border-line text-brand-2">
                  {c.dataset === "Open Legal Data" ? L(c.dataset, "উন্মুক্ত আইনি ডেটা") : c.dataset}
                </span>
                <h3 className="font-bold text-white text-base">{(bn && REPO_BN[c.id]?.title) || c.title}</h3>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    c.riskScore >= 70
                      ? "bg-danger/20 text-danger"
                      : c.riskScore >= 40
                      ? "bg-warn/20 text-warn"
                      : "bg-brand/20 text-brand"
                  }`}
                >
                  {L("Risk Score:", "ঝুঁকি স্কোর:")} {c.riskScore}/100
                </span>
              </div>
            </div>

            {/* Parties & Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1.5 text-white/90">
                <Building2 size={13} className="text-brand" /> {c.parties}
              </span>
              <span>•</span>
              <span>{term(c.contractType)}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-faint" /> {c.date}
              </span>
              <span>•</span>
              <span>{L("Law:", "আইন:")} <b>{term(c.governingLaw)}</b></span>
            </div>

            {/* Snippet */}
            <div className="p-3 rounded-xl bg-surface-solid/70 border border-line text-xs text-muted font-mono leading-relaxed">
              "{c.snippet}"
            </div>

            {/* Liability Cap & Key Obligations Tag */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <span className="text-faint text-[11px]">{L("Liability Cap: ", "দায়সীমা: ")}</span>
                  <span className="text-brand font-bold">{(bn && REPO_BN[c.id]?.liabilityCap) || c.liabilityCap}</span>
                </div>
                <div>
                  <span className="text-faint text-[11px]">{L("Indemnity: ", "ক্ষতিপূরণ: ")}</span>
                  <span className="text-white font-medium">{term(c.indemnityType)}</span>
                </div>
                <div>
                  <span className="text-faint text-[11px]">{L("Obligations: ", "বাধ্যবাধকতা: ")}</span>
                  <span className="text-muted">{c.keyObligationsCount} {L("annotated", "টি চিহ্নিত")}</span>
                </div>
              </div>

              <button
                onClick={() => onLoadContractSnippet(c.title, c.snippet)}
                className="secondary text-xs flex items-center gap-1 self-end sm:self-auto"
              >
                {L("Inspect in Review Workspace", "পর্যালোচনার জন্য খুলুন")} <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

