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

interface RepositorySearchProps {
  onLoadContractSnippet: (title: string, text: string) => void;
}

export const RepositorySearch: React.FC<RepositorySearchProps> = ({ onLoadContractSnippet }) => {
  const [query, setQuery] = useState<string>("");
  const [datasetFilter, setDatasetFilter] = useState<string>("All");
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("All");

  const promptSuggestions = [
    "Find contracts with liability caps below $1M",
    "Show agreements with uncapped indemnification",
    "Filter contracts requiring 90+ days notice for termination",
    "Search M&A agreements with earnout milestone tables",
    "Cross-border contracts under Delaware or NY law",
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
            <Database size={15} /> EDGAR • CUAD • MAUD • Open Legal Data
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Enterprise Repository Semantic Search</h2>
          <p className="text-muted text-sm mt-1">
            Query 5,000+ benchmark corporate contracts for specific liability caps, indemnification terms, and milestone clauses.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted bg-surface-solid px-4 py-2 rounded-xl border border-line">
          <Database size={14} className="text-brand" />
          <span><b>5,420</b> Annotated Benchmark Contracts</span>
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
            placeholder="Ask anything (e.g. 'Find contracts with liability caps below $1M' or 'Show uncapped indemnity')..."
            className="w-full bg-[#060b16] border border-line-strong rounded-xl pl-11 pr-24 py-3.5 text-sm text-white focus:outline-none focus:border-brand"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-faint flex items-center gap-1">
            <Sparkles size={12} className="text-brand" /> Examples:
          </span>
          {promptSuggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(s)}
              className="text-xs px-3 py-1 rounded-full bg-surface-solid border border-line text-muted hover:text-white hover:border-brand transition-all"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-line/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted font-medium">Dataset:</span>
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
                {ds}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium">Type:</span>
            <select
              value={contractTypeFilter}
              onChange={(e) => setContractTypeFilter(e.target.value)}
              className="bg-surface-solid border border-line rounded-lg px-2.5 py-1 text-xs text-white"
            >
              <option value="All">All Types</option>
              <option value="SaaS & Cloud Agreement">SaaS & Cloud</option>
              <option value="Master Services Agreement (MSA)">MSA</option>
              <option value="Asset Purchase (M&A)">M&A Asset Purchase</option>
              <option value="Software License">Software License</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contract Results List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <span>Showing {filteredContracts.length} matching contracts</span>
          <span>Semantic search ranked by relevance</span>
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
                  {c.dataset}
                </span>
                <h3 className="font-bold text-white text-base">{c.title}</h3>
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
                  Risk Score: {c.riskScore}/100
                </span>
              </div>
            </div>

            {/* Parties & Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1.5 text-white/90">
                <Building2 size={13} className="text-brand" /> {c.parties}
              </span>
              <span>•</span>
              <span>{c.contractType}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-faint" /> {c.date}
              </span>
              <span>•</span>
              <span>Law: <b>{c.governingLaw}</b></span>
            </div>

            {/* Snippet */}
            <div className="p-3 rounded-xl bg-surface-solid/70 border border-line text-xs text-muted font-mono leading-relaxed">
              "{c.snippet}"
            </div>

            {/* Liability Cap & Key Obligations Tag */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <span className="text-faint text-[11px]">Liability Cap: </span>
                  <span className="text-brand font-bold">{c.liabilityCap}</span>
                </div>
                <div>
                  <span className="text-faint text-[11px]">Indemnity: </span>
                  <span className="text-white font-medium">{c.indemnityType}</span>
                </div>
                <div>
                  <span className="text-faint text-[11px]">Obligations: </span>
                  <span className="text-muted">{c.keyObligationsCount} annotated</span>
                </div>
              </div>

              <button
                onClick={() => onLoadContractSnippet(c.title, c.snippet)}
                className="secondary text-xs flex items-center gap-1 self-end sm:self-auto"
              >
                Inspect in Review Workspace <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

