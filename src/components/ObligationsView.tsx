import React, { useState } from "react";
import { Obligation, PaymentMilestone } from "../types";
import { downloadJsonFile } from "../utils/diffHelper";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  DollarSign,
  Download,
  Filter,
  Layers,
  ListOrdered,
  ShieldAlert,
  Sparkles,
  Table,
} from "lucide-react";

interface ObligationsViewProps {
  obligations: Obligation[];
  paymentMilestones: PaymentMilestone[];
  contractTitle: string;
  locatedIds?: Set<string>;
  onShowInContract?: (id: string) => void;
}

export const ObligationsView: React.FC<ObligationsViewProps> = ({
  obligations,
  paymentMilestones,
  contractTitle,
  locatedIds,
  onShowInContract,
}) => {
  const [viewMode, setViewMode] = useState<"matrix" | "milestones" | "json">("matrix");
  const [filterObligor, setFilterObligor] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [copied, setCopied] = useState<boolean>(false);

  const filteredObligations = obligations.filter((o) => {
    if (filterObligor !== "All" && o.obligor !== filterObligor) return false;
    if (filterCategory !== "All" && o.category !== filterCategory) return false;
    return true;
  });

  const structuredExportPayload = {
    contractTitle,
    extractionDate: new Date().toISOString(),
    obligationsSummary: {
      totalCount: obligations.length,
      customerCount: obligations.filter((o) => o.obligor === "Customer").length,
      vendorCount: obligations.filter((o) => o.obligor === "Vendor").length,
      criticalCount: obligations.filter((o) => o.status === "Critical").length,
    },
    paymentMilestones,
    obligations,
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(structuredExportPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    downloadJsonFile(structuredExportPayload, `${contractTitle.replace(/\s+/g, "_")}_Obligations.json`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <ListOrdered size={15} /> Automated Obligation & Milestone Extraction
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Contractual Obligations & Schedule</h2>
          <p className="text-muted text-sm mt-1">
            Transform unstructured legal language and complex financial tables into a machine-readable structured JSON format.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="seg">
            <button
              className={viewMode === "matrix" ? "on" : ""}
              onClick={() => setViewMode("matrix")}
            >
              <Table size={14} className="inline mr-1.5" /> Obligations ({obligations.length})
            </button>
            <button
              className={viewMode === "milestones" ? "on" : ""}
              onClick={() => setViewMode("milestones")}
            >
              <Calendar size={14} className="inline mr-1.5" /> Milestones ({paymentMilestones.length})
            </button>
            <button
              className={viewMode === "json" ? "on" : ""}
              onClick={() => setViewMode("json")}
            >
              <Code size={14} className="inline mr-1.5" /> Structured JSON
            </button>
          </div>

          <button onClick={handleDownloadJson} className="secondary text-xs">
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>Total Obligations</span>
            <Layers size={14} className="text-brand" />
          </div>
          <div className="text-xl font-extrabold text-white">{obligations.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>Vendor Duties</span>
            <CheckCircle2 size={14} className="text-brand-2" />
          </div>
          <div className="text-xl font-extrabold text-brand-2">
            {obligations.filter((o) => o.obligor === "Vendor").length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>Customer Duties</span>
            <Clock size={14} className="text-warn" />
          </div>
          <div className="text-xl font-extrabold text-warn">
            {obligations.filter((o) => o.obligor === "Customer").length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>Payment Milestones</span>
            <DollarSign size={14} className="text-brand" />
          </div>
          <div className="text-xl font-extrabold text-brand">{paymentMilestones.length}</div>
        </div>
      </div>

      {/* MODE 1: Obligations Matrix */}
      {viewMode === "matrix" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-solid border border-line">
            <div className="flex items-center gap-2 text-xs text-muted font-medium">
              <Filter size={14} className="text-brand" /> Filter by:
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterObligor}
                onChange={(e) => setFilterObligor(e.target.value)}
                className="bg-surface border border-line rounded-lg px-2.5 py-1 text-xs text-white"
              >
                <option value="All">All Obligors</option>
                <option value="Vendor">Vendor Only</option>
                <option value="Customer">Customer Only</option>
                <option value="Mutual">Mutual</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-surface border border-line rounded-lg px-2.5 py-1 text-xs text-white"
              >
                <option value="All">All Categories</option>
                <option value="Delivery & Milestones">Delivery & Milestones</option>
                <option value="Payment & Financial">Payment & Financial</option>
                <option value="Reporting & Notice">Reporting & Notice</option>
                <option value="Compliance & Security">Compliance & Security</option>
                <option value="Termination & Transition">Termination & Transition</option>
              </select>
            </div>
          </div>

          {/* Obligations Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredObligations.map((o) => (
              <div
                key={o.id}
                className="p-5 rounded-2xl bg-surface border border-line hover:border-line-strong transition-all space-y-3"
              >
                {/* Top Badge & Obligor */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand/15 text-brand">
                      {o.id}
                    </span>
                    <span className="text-xs text-faint">{o.clauseRef}</span>
                    {onShowInContract && locatedIds?.has(`obl:${o.id}`) && (
                      <button className="locBtn" onClick={() => onShowInContract(o.id)} title="Highlight this clause in the original contract">
                        Show in contract
                      </button>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      o.status === "Critical"
                        ? "bg-danger/20 text-danger"
                        : o.status === "Active"
                        ? "bg-brand/20 text-brand"
                        : "bg-line text-muted"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>

                {/* Duty Requirement */}
                <div>
                  <h4 className="font-semibold text-white text-sm leading-snug">{o.requirement}</h4>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="font-bold text-white/80">Obligor:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        o.obligor === "Customer"
                          ? "bg-warn/20 text-warn"
                          : o.obligor === "Vendor"
                          ? "bg-brand-2/20 text-brand-2"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {o.obligor}
                    </span>
                    <span className="text-faint">→</span>
                    <span className="text-muted">Beneficiary: {o.beneficiary}</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="pt-2 border-t border-line/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-faint block">Deadline / Trigger:</span>
                    <span className="text-white font-medium">{o.triggerOrDeadline}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-faint block">Recurrence:</span>
                    <span className="text-muted">{o.recurrence}</span>
                  </div>
                </div>

                {/* Breach Consequence & Financial Impact */}
                <div className="p-2.5 rounded-lg bg-surface-solid/80 border border-line text-xs space-y-1">
                  <div className="text-[11px] text-danger font-semibold flex items-center gap-1">
                    <ShieldAlert size={12} /> Breach Consequence:
                  </div>
                  <div className="text-muted text-[11px]">{o.breachConsequence}</div>
                  {o.financialImpact && (
                    <div className="text-brand text-[11px] font-medium pt-1">
                      Financial Impact: {o.financialImpact}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 2: Financial & Payment Milestone Calendar */}
      {viewMode === "milestones" && (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h3 className="font-bold text-white text-base">Payment & Deliverable Milestone Schedule</h3>
              <p className="text-xs text-muted mt-0.5">
                Automatically extracted from contract payment schedules and hierarchical milestone tables.
              </p>
            </div>
            <div className="text-xs px-3 py-1 rounded-full bg-brand/15 text-brand font-bold">
              Vision-Enhanced Table Parser
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-faint font-semibold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pl-2">Milestone ID</th>
                  <th className="pb-3">Phase / Deliverable</th>
                  <th className="pb-3">Target Date / Trigger</th>
                  <th className="pb-3">Milestone Payment</th>
                  <th className="pb-3">Responsible</th>
                  <th className="pb-3 pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {paymentMilestones.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pl-2 font-mono font-bold text-brand">{m.id}</td>
                    <td className="py-3.5">
                      <div className="font-semibold text-white">{m.milestone}</div>
                      <div className="text-muted text-[11px] mt-0.5">{m.deliverable}</div>
                    </td>
                    <td className="py-3.5 text-white/90 font-medium">{m.trigger}</td>
                    <td className="py-3.5 font-bold text-brand text-sm">{m.amount}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-solid border border-line text-muted">
                        {m.responsibleParty}
                      </span>
                    </td>
                    <td className="py-3.5 pr-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          m.status === "Scheduled"
                            ? "bg-brand/20 text-brand"
                            : m.status === "Conditional"
                            ? "bg-warn/20 text-warn"
                            : "bg-line text-muted"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 3: Raw Structured JSON */}
      {viewMode === "json" && (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <Code size={18} className="text-brand" />
              <h3 className="font-bold text-white text-base">Validated Structured Output Schema</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopyJson} className="secondary text-xs">
                <Copy size={13} /> {copied ? "Copied!" : "Copy JSON"}
              </button>
              <button onClick={handleDownloadJson} className="primary text-xs">
                <Download size={13} /> Download .json
              </button>
            </div>
          </div>
          <pre className="preview max-h-[550px] overflow-y-auto font-mono text-xs text-brand/90 bg-[#060b16] p-4 rounded-xl border border-line">
            {JSON.stringify(structuredExportPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

