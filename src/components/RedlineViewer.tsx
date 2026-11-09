import React, { useState } from "react";
import { RedlineItem } from "../types";
import { generateReconciledDocument, downloadTextFile, downloadJsonFile } from "../utils/diffHelper";
import {
  FileEdit,
  Check,
  X,
  RotateCcw,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Sparkles,
  MessageSquare,
  Eye,
  CheckCircle2,
  FileCheck,
  FileDown,
  MapPin,
  SearchX,
} from "lucide-react";

interface RedlineViewerProps {
  originalText: string;
  redlines: RedlineItem[];
  onUpdateRedline: (id: string, accepted: boolean | null) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  contractTitle?: string;
  playbookName?: string;
  locatedIds?: Set<string>;
  onShowInContract?: (id: string) => void;
}

export const RedlineViewer: React.FC<RedlineViewerProps> = ({
  originalText,
  redlines,
  onUpdateRedline,
  onAcceptAll,
  onRejectAll,
  contractTitle = "Contract",
  playbookName,
  locatedIds,
  onShowInContract,
}) => {
  const [docxState, setDocxState] = useState<{ busy: boolean; msg: string; err?: boolean }>({ busy: false, msg: "" });

  const handleDownloadDocx = async () => {
    setDocxState({ busy: true, msg: "" });
    try {
      const { buildRedlinedDocx } = await import("../utils/redlineDocx");
      const { blob, placed, unplaced } = await buildRedlinedDocx({ contractText: originalText, redlines, title: contractTitle, playbook: playbookName });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contractTitle.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Contract"}_Redline.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDocxState({
        busy: false,
        msg: `Word redline downloaded: ${placed} change${placed === 1 ? "" : "s"} tracked in place` + (unplaced ? `, ${unplaced} in the appendix (wording not found verbatim).` : "."),
      });
    } catch (e: any) {
      setDocxState({ busy: false, msg: `Could not create the Word file: ${e?.message || e}`, err: true });
    }
  };
  const [viewMode, setViewMode] = useState<"redline" | "clean">("redline");
  const [expandedCot, setExpandedCot] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleCot = (id: string) => {
    setExpandedCot((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const acceptedCount = redlines.filter((r) => r.accepted === true).length;
  const rejectedCount = redlines.filter((r) => r.accepted === false).length;
  const pendingCount = redlines.filter((r) => r.accepted === null).length;

  const cleanDoc = generateReconciledDocument(originalText, redlines);

  const handleCopyProposed = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <FileEdit size={15} /> Automated Redline & Negotiation Studio
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">AI-Powered Clause Redlining</h2>
          <p className="text-muted text-sm mt-1">
            Every suggested modification includes chain-of-thought reasoning, adverse counsel stances, and commercial compromise language.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="seg">
            <button
              className={viewMode === "redline" ? "on" : ""}
              onClick={() => setViewMode("redline")}
            >
              <FileEdit size={14} className="inline mr-1.5" /> Redline Diff View
            </button>
            <button
              className={viewMode === "clean" ? "on" : ""}
              onClick={() => setViewMode("clean")}
            >
              <FileCheck size={14} className="inline mr-1.5" /> Clean Executable Version
            </button>
          </div>

          <button onClick={handleDownloadDocx} className="primary text-xs" disabled={docxState.busy || redlines.every((r) => r.accepted === false)} title="Word file with tracked changes and rationale comments">
            {docxState.busy ? <span className="spinner" /> : <FileDown size={14} />} Download Word redline
          </button>
          <button
            onClick={() => downloadTextFile(cleanDoc, "ContractMind_Reconciled_Clean.txt")}
            className="secondary text-xs"
          >
            <Download size={14} /> Clean text (.txt)
          </button>
        </div>
      </div>

      {docxState.msg && (
        <div className={`notice ${docxState.err ? "error" : "ok"}`}>
          {docxState.err ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
          <span>{docxState.msg}</span>
          <button onClick={() => setDocxState({ busy: false, msg: "" })} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {/* Tally & Batch Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-line flex items-center justify-between">
          <span className="text-xs text-muted font-medium">Total Redlines</span>
          <span className="font-bold text-white text-base">{redlines.length}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-between">
          <span className="text-xs text-brand font-medium">Accepted</span>
          <span className="font-bold text-brand text-base">{acceptedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-between">
          <span className="text-xs text-danger font-medium">Rejected</span>
          <span className="font-bold text-danger text-base">{rejectedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-warn/10 border border-warn/20 flex items-center justify-between">
          <span className="text-xs text-warn font-medium">Pending Review</span>
          <span className="font-bold text-warn text-base">{pendingCount}</span>
        </div>
      </div>

      {/* Batch Accept / Reject Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-solid border border-line">
        <div className="text-xs text-muted">
          Review individual clauses below or apply batch decisions across all suggested redlines:
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onAcceptAll} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 transition-all flex items-center gap-1">
            <Check size={13} /> Accept All
          </button>
          <button onClick={onRejectAll} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-all flex items-center gap-1">
            <X size={13} /> Reject All
          </button>
        </div>
      </div>

      {/* Clean Document View */}
      {viewMode === "clean" ? (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-brand" />
              <h3 className="font-bold text-white text-base">Reconciled Contract Preview</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-brand/15 text-brand font-medium">
                {acceptedCount} modifications incorporated
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cleanDoc);
                alert("Clean contract copied to clipboard!");
              }}
              className="text-xs text-brand hover:underline flex items-center gap-1"
            >
              <Copy size={13} /> Copy All
            </button>
          </div>
          <pre className="preview max-h-[600px] overflow-y-auto leading-relaxed text-xs">
            {cleanDoc}
          </pre>
        </div>
      ) : (
        /* Redline Clause Cards */
        <div className="space-y-4">
          {redlines.map((r, idx) => {
            const isExpanded = !!expandedCot[r.id];
            return (
              <div
                key={r.id}
                className={`p-5 rounded-2xl border transition-all ${
                  r.accepted === true
                    ? "bg-brand/5 border-brand/40 shadow-sm"
                    : r.accepted === false
                    ? "bg-danger/5 border-danger/30 opacity-70"
                    : "bg-surface border-line hover:border-line-strong"
                }`}
              >
                {/* Clause Title & Status Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-brand bg-brand/15 px-2.5 py-1 rounded-md">
                      {r.clauseId}
                    </span>
                    <h3 className="font-bold text-white text-sm">{r.sectionTitle}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.severity === "Critical"
                          ? "bg-danger/20 text-danger border border-danger/30"
                          : r.severity === "High"
                          ? "bg-warn/20 text-warn border border-warn/30"
                          : "bg-brand/20 text-brand border border-brand/30"
                      }`}
                    >
                      {r.severity} Severity
                    </span>
                    {locatedIds && onShowInContract && (
                      locatedIds.has(`red:${r.id}`) ? (
                        <button className="locBtn" onClick={() => onShowInContract(r.id)} title="Highlight this clause in the original contract">
                          <MapPin size={12} /> Show in contract
                        </button>
                      ) : (
                        <span className="locBtn missing" title="The quoted wording could not be found in the contract text">
                          <SearchX size={12} /> Not found in text
                        </span>
                      )
                    )}
                  </div>

                  {/* Accept / Reject Toggles */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => onUpdateRedline(r.id, true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        r.accepted === true
                          ? "bg-brand text-brand-ink shadow-sm"
                          : "bg-surface-solid text-muted hover:text-white border border-line"
                      }`}
                    >
                      <Check size={13} /> Accept
                    </button>
                    <button
                      onClick={() => onUpdateRedline(r.id, false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        r.accepted === false
                          ? "bg-danger text-brand-ink shadow-sm"
                          : "bg-surface-solid text-muted hover:text-white border border-line"
                      }`}
                    >
                      <X size={13} /> Reject
                    </button>
                    {r.accepted !== null && (
                      <button
                        onClick={() => onUpdateRedline(r.id, null)}
                        className="p-1.5 rounded-lg text-faint hover:text-white bg-surface-solid border border-line"
                        title="Reset decision"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Diff Side-by-Side / Comparison View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  {/* Original Text (Deletion) */}
                  <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-danger uppercase tracking-wider">
                      <span>Original Clause (To Delete)</span>
                      <span className="font-mono text-[10px]">[-]</span>
                    </div>
                    <div className="clauseText del">
                      {r.originalText}
                    </div>
                  </div>

                  {/* Proposed Text (Insertion) */}
                  <div className="p-3.5 rounded-xl insBox space-y-1.5 relative">
                    <div className="flex items-center justify-between text-[11px] font-bold insLabel uppercase tracking-wider">
                      <span>ContractMind Redline (To Insert)</span>
                      <button
                        onClick={() => handleCopyProposed(r.id, r.proposedText)}
                        className="text-[10px] text-brand hover:underline flex items-center gap-1 normal-case"
                      >
                        <Copy size={11} /> {copiedId === r.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div className="clauseText ins">
                      {r.proposedText}
                    </div>
                  </div>
                </div>

                {/* Chain-of-Thought Legal Rationale Toggle */}
                <div className="mt-3 pt-3 border-t border-line">
                  <button
                    onClick={() => toggleCot(r.id)}
                    className="flex items-center gap-1.5 text-xs text-brand-2 hover:text-white font-semibold transition-colors"
                  >
                    <Sparkles size={14} />
                    <span>
                      {isExpanded ? "Hide Chain-of-Thought Rationale" : "Inspect Legal Chain-of-Thought & Negotiation Script"}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-surface-solid border border-line space-y-3.5 animate-fadeIn">
                      {/* Opposing Counsel Stance */}
                      <div>
                        <div className="text-[11px] font-bold text-danger uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <ShieldAlert size={13} /> Opposing Counsel's Aggressive Stance
                        </div>
                        <p className="text-xs text-muted leading-relaxed pl-4 border-l-2 border-danger/40">
                          {r.chainOfThought.opposingCounselStance}
                        </p>
                      </div>

                      {/* Commercial Risk Assessment */}
                      <div>
                        <div className="text-[11px] font-bold text-warn uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <Eye size={13} /> Commercial Risk Assessment
                        </div>
                        <p className="text-xs text-muted leading-relaxed pl-4 border-l-2 border-warn/40">
                          {r.chainOfThought.commercialRiskAssessment}
                        </p>
                      </div>

                      {/* Legal Rationale */}
                      <div>
                        <div className="text-[11px] font-bold text-brand-2 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <Sparkles size={13} /> Legal Rationale & Doctrine
                        </div>
                        <p className="text-xs text-muted leading-relaxed pl-4 border-l-2 border-brand-2/40">
                          {r.chainOfThought.legalRationale}
                        </p>
                      </div>

                      {/* Negotiation Talking Point */}
                      <div className="p-3 rounded-lg bg-brand/10 border border-brand/20">
                        <div className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <MessageSquare size={13} /> Counsel Negotiation Script (What to say)
                        </div>
                        <p className="text-xs text-white/90 italic font-medium leading-relaxed">
                          "{r.chainOfThought.negotiationTalkingPoint}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

