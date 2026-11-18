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
import { useLang } from "../i18n/lang";
import { MilestoneCalendar } from "./MilestoneCalendar";

interface ObligationsViewProps {
  obligations: Obligation[];
  paymentMilestones: PaymentMilestone[];
  contractTitle: string;
  locatedIds?: Set<string>;
  onShowInContract?: (id: string) => void;
  effectiveDate?: string;
  tableVision?: { pages: number[]; rows: number };
}

export const ObligationsView: React.FC<ObligationsViewProps> = ({
  obligations,
  paymentMilestones,
  contractTitle,
  locatedIds,
  onShowInContract,
  effectiveDate,
  tableVision,
}) => {
  const { L, term, sec } = useLang();
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
            <ListOrdered size={15} /> {L("Automated Obligation & Milestone Extraction", "বাধ্যবাধকতা ও মাইলস্টোন")}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{L("Contractual Obligations & Schedule", "চুক্তির দায়িত্ব ও সময়সূচি")}</h2>
          <p className="text-muted text-sm mt-1">
            {L("Transform unstructured legal language and complex financial tables into a machine-readable structured JSON format.", "চুক্তির জটিল ভাষা ও আর্থিক টেবিল থেকে দায়িত্বগুলো গুছিয়ে তালিকা ও JSON আকারে দেখানো হয়।")}
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="seg">
            <button
              className={viewMode === "matrix" ? "on" : ""}
              onClick={() => setViewMode("matrix")}
            >
              <Table size={14} className="inline mr-1.5" /> {L("Obligations", "বাধ্যবাধকতা")} ({obligations.length})
            </button>
            <button
              className={viewMode === "milestones" ? "on" : ""}
              onClick={() => setViewMode("milestones")}
            >
              <Calendar size={14} className="inline mr-1.5" /> {L("Milestones", "মাইলস্টোন")} ({paymentMilestones.length})
            </button>
            <button
              className={viewMode === "json" ? "on" : ""}
              onClick={() => setViewMode("json")}
            >
              <Code size={14} className="inline mr-1.5" /> {L("Structured JSON", "JSON ডেটা")}
            </button>
          </div>

          <button onClick={handleDownloadJson} className="secondary text-xs">
            <Download size={14} /> {L("Export JSON", "JSON এক্সপোর্ট")}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>{L("Total Obligations", "মোট বাধ্যবাধকতা")}</span>
            <Layers size={14} className="text-brand" />
          </div>
          <div className="text-xl font-extrabold text-white">{obligations.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>{L("Vendor Duties", "ভেন্ডরের দায়িত্ব")}</span>
            <CheckCircle2 size={14} className="text-brand-2" />
          </div>
          <div className="text-xl font-extrabold text-brand-2">
            {obligations.filter((o) => o.obligor === "Vendor").length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>{L("Customer Duties", "গ্রাহকের দায়িত্ব")}</span>
            <Clock size={14} className="text-warn" />
          </div>
          <div className="text-xl font-extrabold text-warn">
            {obligations.filter((o) => o.obligor === "Customer").length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-line">
          <div className="text-xs text-muted font-medium mb-1 flex items-center justify-between">
            <span>{L("Payment Milestones", "পেমেন্ট মাইলস্টোন")}</span>
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
              <Filter size={14} className="text-brand" /> {L("Filter by:", "ফিল্টার:")}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterObligor}
                onChange={(e) => setFilterObligor(e.target.value)}
                className="bg-surface border border-line rounded-lg px-2.5 py-1 text-xs text-white"
              >
                <option value="All">{L("All Obligors", "সব পক্ষ")}</option>
                <option value="Vendor">{L("Vendor Only", "শুধু ভেন্ডর")}</option>
                <option value="Customer">{L("Customer Only", "শুধু গ্রাহক")}</option>
                <option value="Mutual">{L("Mutual", "উভয় পক্ষ")}</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-surface border border-line rounded-lg px-2.5 py-1 text-xs text-white"
              >
                <option value="All">{L("All Categories", "সব বিভাগ")}</option>
                <option value="Delivery & Milestones">{term("Delivery & Milestones")}</option>
                <option value="Payment & Financial">{term("Payment & Financial")}</option>
                <option value="Reporting & Notice">{term("Reporting & Notice")}</option>
                <option value="Compliance & Security">{term("Compliance & Security")}</option>
                <option value="Termination & Transition">{term("Termination & Transition")}</option>
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
                    <span className="text-xs text-faint">{sec(o.clauseRef)}</span>
                    {onShowInContract && locatedIds?.has(`obl:${o.id}`) && (
                      <button className="locBtn" onClick={() => onShowInContract(o.id)} title={L("Highlight this clause in the original contract", "মূল চুক্তিতে এই ধারাটি দেখান")}>
                        {L("Show in contract", "চুক্তিতে দেখুন")}
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
                    {term(o.status)}
                  </span>
                </div>

                {/* Duty Requirement */}
                <div>
                  <h4 className="font-semibold text-white text-sm leading-snug">{o.requirement}</h4>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="font-bold text-white/80">{L("Obligor:", "দায়িত্বপ্রাপ্ত:")}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        o.obligor === "Customer"
                          ? "bg-warn/20 text-warn"
                          : o.obligor === "Vendor"
                          ? "bg-brand-2/20 text-brand-2"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {term(o.obligor)}
                    </span>
                    <span className="text-faint">→</span>
                    <span className="text-muted">{L("Beneficiary:", "সুবিধাভোগী:")} {term(o.beneficiary)}</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="pt-2 border-t border-line/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-faint block">{L("Deadline / Trigger:", "সময়সীমা / কখন:")}</span>
                    <span className="text-white font-medium">{o.triggerOrDeadline}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-faint block">{L("Recurrence:", "পুনরাবৃত্তি:")}</span>
                    <span className="text-muted">{term(o.recurrence)}</span>
                  </div>
                </div>

                {/* Breach Consequence & Financial Impact */}
                <div className="p-2.5 rounded-lg bg-surface-solid/80 border border-line text-xs space-y-1">
                  <div className="text-[11px] text-danger font-semibold flex items-center gap-1">
                    <ShieldAlert size={12} /> {L("Breach Consequence:", "লঙ্ঘনের পরিণতি:")}
                  </div>
                  <div className="text-muted text-[11px]">{o.breachConsequence}</div>
                  {o.financialImpact && (
                    <div className="text-brand text-[11px] font-medium pt-1">
                      {L("Financial Impact:", "আর্থিক প্রভাব:")} {o.financialImpact}
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
        <MilestoneCalendar milestones={paymentMilestones} contractTitle={contractTitle} effectiveDate={effectiveDate} tableVision={tableVision} />
      )}

      {viewMode === "milestones" && paymentMilestones.length > 0 && (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h3 className="font-bold text-white text-base">{L("Payment & Deliverable Milestone Schedule", "পেমেন্ট ও ডেলিভারির সময়সূচি")}</h3>
              <p className="text-xs text-muted mt-0.5">
                {L("Automatically extracted from contract payment schedules and hierarchical milestone tables.", "চুক্তির পেমেন্ট সূচি ও মাইলস্টোন টেবিল থেকে স্বয়ংক্রিয়ভাবে নেওয়া।")}
              </p>
            </div>
            {tableVision && tableVision.pages.length > 0 && (
              <div className="text-xs px-3 py-1 rounded-full bg-brand/15 text-brand font-bold">
                {L("Includes rows read from table images", "টেবিলের ছবি থেকে পড়া সারিসহ")}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-faint font-semibold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pl-2">{L("Milestone ID", "মাইলস্টোন আইডি")}</th>
                  <th className="pb-3">{L("Phase / Deliverable", "ধাপ / ডেলিভারি")}</th>
                  <th className="pb-3">{L("Target Date / Trigger", "লক্ষ্য তারিখ / কখন")}</th>
                  <th className="pb-3">{L("Milestone Payment", "পেমেন্ট")}</th>
                  <th className="pb-3">{L("Responsible", "দায়িত্বপ্রাপ্ত")}</th>
                  <th className="pb-3 pr-2">{L("Status", "অবস্থা")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {paymentMilestones.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pl-2 font-mono font-bold text-brand">
                      {m.id}
                      {(m.source === "table-image" || m.source === "both") && (
                        <div className="text-[10px] font-sans font-semibold text-faint" title={L("Read from the table image", "টেবিলের ছবি থেকে পড়া")}>
                          {L("table image", "টেবিলের ছবি")}{m.page ? ` · p.${m.page}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5">
                      {m.phase && <div className="text-[11px] text-faint">{m.phase}</div>}
                      <div className="font-semibold text-white">{m.milestone}</div>
                      <div className="text-muted text-[11px] mt-0.5">{m.deliverable}</div>
                    </td>
                    <td className="py-3.5 text-white/90 font-medium">{m.trigger}</td>
                    <td className="py-3.5 font-bold text-brand text-sm">{m.amount}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-solid border border-line text-muted">
                        {term(m.responsibleParty)}
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
                        {term(m.status)}
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
              <h3 className="font-bold text-white text-base">{L("Validated Structured Output Schema", "যাচাইকৃত JSON ডেটা")}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopyJson} className="secondary text-xs">
                <Copy size={13} /> {copied ? L("Copied!", "কপি হয়েছে!") : L("Copy JSON", "JSON কপি")}
              </button>
              <button onClick={handleDownloadJson} className="primary text-xs">
                <Download size={13} /> {L("Download .json", ".json ডাউনলোড")}
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

