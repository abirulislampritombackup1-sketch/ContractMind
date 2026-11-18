import React, { useState } from "react";
import { OpposingFinding, RedlineItem } from "../types";
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
  FileText,
  MapPin,
  SearchX,
} from "lucide-react";
import { useLang } from "../i18n/lang";
import { buildRedlinedDocument, redlinedHtml } from "../utils/redlineDocument";
import { printHtml } from "../utils/printHtml";

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
  /** Opposing Counsel findings the Dealmaker answered with these redlines. */
  findings?: OpposingFinding[];
  rationaleCheck?: { repaired: number; dropped: number };
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
  findings,
  rationaleCheck,
}) => {
  const { L, term, bn, sec, num } = useLang();
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
        msg: L(
          `Word redline downloaded: ${placed} change${placed === 1 ? "" : "s"} tracked in place` + (unplaced ? `, ${unplaced} in the appendix (wording not found verbatim).` : "."),
          `Word রেডলাইন ডাউনলোড হয়েছে: ${placed}টি পরিবর্তন জায়গামতো চিহ্নিত` + (unplaced ? `, ${unplaced}টি পরিশিষ্টে (হুবহু শব্দ পাওয়া যায়নি)।` : "।")
        ),
      });
    } catch (e: any) {
      setDocxState({ busy: false, msg: L(`Could not create the Word file: ${e?.message || e}`, `Word ফাইল তৈরি করা যায়নি: ${e?.message || e}`), err: true });
    }
  };
  const [viewMode, setViewMode] = useState<"redline" | "document" | "clean">("redline");
  const [docSel, setDocSel] = useState<string | null>(null);
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
            <FileEdit size={15} /> {L("Automated Redline & Negotiation Studio", "স্বয়ংক্রিয় রেডলাইন ও আলোচনা")}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{L("AI-Powered Clause Redlining", "এআই দিয়ে ধারা সংশোধন")}</h2>
          <p className="text-muted text-sm mt-1">
            {L("Every suggested modification includes chain-of-thought reasoning, adverse counsel stances, and commercial compromise language.", "প্রতিটি প্রস্তাবিত সংশোধনের সাথে যুক্তি, প্রতিপক্ষের অবস্থান এবং আপসের ভাষা দেওয়া আছে।")}
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="seg">
            <button
              className={viewMode === "redline" ? "on" : ""}
              onClick={() => setViewMode("redline")}
            >
              <FileEdit size={14} className="inline mr-1.5" /> {L("Redline Diff View", "পরিবর্তন দেখুন")}
            </button>
            <button className={viewMode === "document" ? "on" : ""} onClick={() => setViewMode("document")}>
              <FileText size={14} className="inline mr-1.5" /> {L("Full document", "পুরো ডকুমেন্ট")}
            </button>
            <button
              className={viewMode === "clean" ? "on" : ""}
              onClick={() => setViewMode("clean")}
            >
              <FileCheck size={14} className="inline mr-1.5" /> {L("Clean Executable Version", "চূড়ান্ত পরিষ্কার সংস্করণ")}
            </button>
          </div>

          <button onClick={handleDownloadDocx} className="primary text-xs" disabled={docxState.busy || redlines.every((r) => r.accepted === false)} title={L("Word file with tracked changes and rationale comments", "চিহ্নিত পরিবর্তন ও ব্যাখ্যাসহ Word ফাইল")}>
            {docxState.busy ? <span className="spinner" /> : <FileDown size={14} />} {L("Download Word redline", "Word রেডলাইন ডাউনলোড")}
          </button>
          <button
            className="secondary text-xs"
            disabled={!redlines.some((r) => r.accepted !== false)}
            title={L("Opens the print dialog; choose Save as PDF", "প্রিন্ট ডায়ালগ খোলে; Save as PDF বেছে নিন")}
            onClick={() => printHtml(redlinedHtml({ title: contractTitle, playbook: playbookName, text: originalText, redlines, lang: bn ? "bn" : "en" }), "cm-redline-frame")}
          >
            <FileDown size={14} /> {L("Redlined PDF", "রেডলাইন PDF")}
          </button>
          <button
            onClick={() => downloadTextFile(cleanDoc, "ContractMind_Reconciled_Clean.txt")}
            className="secondary text-xs"
          >
            <Download size={14} /> {L("Clean text (.txt)", "পরিষ্কার টেক্সট (.txt)")}
          </button>
        </div>
      </div>

      {docxState.msg && (
        <div className={`notice ${docxState.err ? "error" : "ok"}`}>
          {docxState.err ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
          <span>{docxState.msg}</span>
          <button onClick={() => setDocxState({ busy: false, msg: "" })} aria-label={L("Dismiss", "বন্ধ করুন")}><X size={16} /></button>
        </div>
      )}

      {rationaleCheck && (
        <div className="notice info">
          <Sparkles size={16} />
          <span>
            {L(
              `Every redline must explain its reasoning. ${rationaleCheck.repaired ? `${rationaleCheck.repaired} redline(s) came back without full reasoning and were completed by a second AI pass.` : ""} ${rationaleCheck.dropped ? `${rationaleCheck.dropped} redline(s) were removed because their reasoning could not be completed.` : ""}`,
              `প্রতিটি রেডলাইনের যুক্তি থাকতে হবে। ${rationaleCheck.repaired ? `${num(rationaleCheck.repaired)}টি রেডলাইনের যুক্তি অসম্পূর্ণ ছিল, দ্বিতীয়বার এআই দিয়ে পূরণ করা হয়েছে।` : ""} ${rationaleCheck.dropped ? `${num(rationaleCheck.dropped)}টি রেডলাইন বাদ দেওয়া হয়েছে কারণ যুক্তি পূরণ করা যায়নি।` : ""}`
            )}
          </span>
        </div>
      )}

      {findings && findings.length > 0 && (
        <div className="bg-surface p-5 rounded-2xl border border-line space-y-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldAlert size={16} className="text-danger" /> {L("Opposing Counsel findings", "প্রতিপক্ষ আইনজীবীর পর্যবেক্ষণ")}
            </h3>
            <p className="text-xs text-muted mt-1">
              {L(
                "One agent reviewed the contract as the other side's lawyer. A second agent (Commercial Dealmaker) answered each finding with the counter-offers below.",
                "একটি এজেন্ট অপর পক্ষের আইনজীবী হিসেবে চুক্তিটি দেখেছে। দ্বিতীয় এজেন্ট (বাণিজ্যিক ডিলমেকার) প্রতিটি পর্যবেক্ষণের জবাবে নিচের পাল্টা প্রস্তাব দিয়েছে।"
              )}
            </p>
          </div>
          <div className="ocList">
            {findings.map((f) => {
              const answered = redlines.filter((r) => r.answersFinding?.toUpperCase() === f.id.toUpperCase()).map((r) => r.id);
              return (
                <div key={f.id} className="ocItem">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="answersChip">{f.id}</span>
                    <span className={`tag ${f.severity === "Critical" ? "danger" : f.severity === "High" ? "warn" : "brand"}`}>{term(f.severity)}</span>
                    <span className="text-faint">{sec(f.clauseRef)}</span>
                  </div>
                  <b className="text-white">{f.issue}</b>
                  {f.quote && <q>{f.quote}</q>}
                  {f.leverage && <span className="text-muted"><b>{L("Their argument: ", "তাদের যুক্তি: ")}</b>{f.leverage}</span>}
                  <span className="text-faint">
                    {answered.length ? L(`Answered by ${answered.join(", ")}`, `জবাব: ${answered.join(", ")}`) : L("No counter-offer yet", "এখনও পাল্টা প্রস্তাব নেই")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tally & Batch Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-line flex items-center justify-between">
          <span className="text-xs text-muted font-medium">{L("Total Redlines", "মোট রেডলাইন")}</span>
          <span className="font-bold text-white text-base">{redlines.length}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-between">
          <span className="text-xs text-brand font-medium">{L("Accepted", "গৃহীত")}</span>
          <span className="font-bold text-brand text-base">{acceptedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-between">
          <span className="text-xs text-danger font-medium">{L("Rejected", "প্রত্যাখ্যাত")}</span>
          <span className="font-bold text-danger text-base">{rejectedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-warn/10 border border-warn/20 flex items-center justify-between">
          <span className="text-xs text-warn font-medium">{L("Pending Review", "পর্যালোচনা বাকি")}</span>
          <span className="font-bold text-warn text-base">{pendingCount}</span>
        </div>
      </div>

      {/* Batch Accept / Reject Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-solid border border-line">
        <div className="text-xs text-muted">
          {L("Review individual clauses below or apply batch decisions across all suggested redlines:", "নিচে প্রতিটি ধারা আলাদাভাবে দেখুন, অথবা সব রেডলাইনে একসাথে সিদ্ধান্ত নিন:")}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onAcceptAll} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 transition-all flex items-center gap-1">
            <Check size={13} /> {L("Accept All", "সব গ্রহণ")}
          </button>
          <button onClick={onRejectAll} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-all flex items-center gap-1">
            <X size={13} /> {L("Reject All", "সব প্রত্যাখ্যান")}
          </button>
        </div>
      </div>

      {/* Clean Document View */}
      {viewMode === "document" ? (
        <FullDocument text={originalText} redlines={redlines} selected={docSel} onSelect={setDocSel} onUpdateRedline={onUpdateRedline} />
      ) : viewMode === "clean" ? (
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-brand" />
              <h3 className="font-bold text-white text-base">{L("Reconciled Contract Preview", "সংশোধিত চুক্তির প্রিভিউ")}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-brand/15 text-brand font-medium">
                {acceptedCount} {L("modifications incorporated", "টি সংশোধন যুক্ত")}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cleanDoc);
                alert(L("Clean contract copied to clipboard!", "পরিষ্কার চুক্তি কপি হয়েছে!"));
              }}
              className="text-xs text-brand hover:underline flex items-center gap-1"
            >
              <Copy size={13} /> {L("Copy All", "সব কপি")}
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
                      {sec(r.clauseId)}
                    </span>
                    <h3 className="font-bold text-white text-sm">{(bn && r.sectionTitleBn) || r.sectionTitle}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.severity === "Critical"
                          ? "bg-danger/20 text-danger border border-danger/30"
                          : r.severity === "High"
                          ? "bg-warn/20 text-warn border border-warn/30"
                          : "bg-brand/20 text-brand border border-brand/30"
                      }`}
                    >
                      {L(`${r.severity} Severity`, `${term(r.severity)} গুরুত্ব`)}
                    </span>
                    {locatedIds && onShowInContract && (
                      locatedIds.has(`red:${r.id}`) ? (
                        <button className="locBtn" onClick={() => onShowInContract(r.id)} title={L("Highlight this clause in the original contract", "মূল চুক্তিতে এই ধারাটি দেখান")}>
                          <MapPin size={12} /> {L("Show in contract", "চুক্তিতে দেখুন")}
                        </button>
                      ) : (
                        <span className="locBtn missing" title={L("The quoted wording could not be found in the contract text", "উদ্ধৃত শব্দগুলো চুক্তির টেক্সটে পাওয়া যায়নি")}>
                          <SearchX size={12} /> {L("Not found in text", "টেক্সটে পাওয়া যায়নি")}
                        </span>
                      )
                    )}
                    {r.answersFinding && (
                      <span className="answersChip" title={findings?.find((f) => f.id === r.answersFinding)?.issue}>
                        <ShieldAlert size={11} /> {L(`Answers ${r.answersFinding}`, `${r.answersFinding}-এর জবাব`)}
                      </span>
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
                      <Check size={13} /> {L("Accept", "গ্রহণ")}
                    </button>
                    <button
                      onClick={() => onUpdateRedline(r.id, false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        r.accepted === false
                          ? "bg-danger text-brand-ink shadow-sm"
                          : "bg-surface-solid text-muted hover:text-white border border-line"
                      }`}
                    >
                      <X size={13} /> {L("Reject", "প্রত্যাখ্যান")}
                    </button>
                    {r.accepted !== null && (
                      <button
                        onClick={() => onUpdateRedline(r.id, null)}
                        className="p-1.5 rounded-lg text-faint hover:text-white bg-surface-solid border border-line"
                        title={L("Reset decision", "সিদ্ধান্ত মুছুন")}
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
                      <span>{L("Original Clause (To Delete)", "মূল ধারা (বাদ যাবে)")}</span>
                      <span className="font-mono text-[10px]">[-]</span>
                    </div>
                    <div className="clauseText del">
                      {r.originalText}
                    </div>
                    {bn && r.originalTextBn && (
                      <p className="clauseMeaning"><b>সহজ বাংলায়: </b>{r.originalTextBn}</p>
                    )}
                  </div>

                  {/* Proposed Text (Insertion) */}
                  <div className="p-3.5 rounded-xl insBox space-y-1.5 relative">
                    <div className="flex items-center justify-between text-[11px] font-bold insLabel uppercase tracking-wider">
                      <span>{L("ContractMind Redline (To Insert)", "প্রস্তাবিত ধারা (যোগ হবে)")}</span>
                      <button
                        onClick={() => handleCopyProposed(r.id, r.proposedText)}
                        className="text-[10px] text-brand hover:underline flex items-center gap-1 normal-case"
                      >
                        <Copy size={11} /> {copiedId === r.id ? L("Copied!", "কপি হয়েছে!") : L("Copy", "কপি")}
                      </button>
                    </div>
                    <div className="clauseText ins">
                      {r.proposedText}
                    </div>
                    {bn && r.proposedTextBn && (
                      <p className="clauseMeaning"><b>সহজ বাংলায়: </b>{r.proposedTextBn}</p>
                    )}
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
                      {isExpanded ? L("Hide Chain-of-Thought Rationale", "যুক্তি লুকান") : L("Inspect Legal Chain-of-Thought & Negotiation Script", "আইনি যুক্তি ও আলোচনার কথা দেখুন")}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-surface-solid border border-line space-y-3.5 animate-fadeIn">
                      {/* Opposing Counsel Stance */}
                      <div>
                        <div className="text-[11px] font-bold text-danger uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <ShieldAlert size={13} /> {L("Opposing Counsel's Aggressive Stance", "প্রতিপক্ষ আইনজীবীর কঠোর অবস্থান")}
                        </div>
                        <p className="text-xs text-muted leading-relaxed pl-4 border-l-2 border-danger/40">
                          {r.chainOfThought.opposingCounselStance}
                        </p>
                      </div>

                      {/* Commercial Risk Assessment */}
                      <div>
                        <div className="text-[11px] font-bold text-warn uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <Eye size={13} /> {L("Commercial Risk Assessment", "বাণিজ্যিক ঝুঁকি মূল্যায়ন")}
                        </div>
                        <p className="text-xs text-muted leading-relaxed pl-4 border-l-2 border-warn/40">
                          {r.chainOfThought.commercialRiskAssessment}
                        </p>
                      </div>

                      {/* Legal Rationale */}
                      <div>
                        <div className="text-[11px] font-bold text-brand-2 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <Sparkles size={13} /> {L("Legal Rationale & Doctrine", "আইনি যুক্তি ও নীতি")}
                        </div>
                        <p className="text-xs text-muted leading-relaxed pl-4 border-l-2 border-brand-2/40">
                          {r.chainOfThought.legalRationale}
                        </p>
                      </div>

                      {/* Negotiation Talking Point */}
                      <div className="p-3 rounded-lg bg-brand/10 border border-brand/20">
                        <div className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <MessageSquare size={13} /> {L("Counsel Negotiation Script (What to say)", "আলোচনায় কী বলবেন")}
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


/** The whole contract with every change in place; clicking a change shows its reasoning. */
function FullDocument({
  text,
  redlines,
  selected,
  onSelect,
  onUpdateRedline,
}: {
  text: string;
  redlines: RedlineItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onUpdateRedline: (id: string, accepted: boolean | null) => void;
}) {
  const { L, bn, sec, num } = useLang();
  const doc = React.useMemo(() => buildRedlinedDocument(text, redlines, (r) => r.accepted !== false), [text, redlines]);
  const sel = redlines.find((r) => r.id === selected);
  const placedCount = doc.segments.filter((s) => s.kind === "change").length;

  if (!text.trim() || text.startsWith("[Scanned PDF")) {
    return (
      <div className="notice info">
        <FileText size={18} />
        <span>{L("This is a scanned PDF, so there is no text to show the changes in. Use the Word or PDF download instead.", "এটি স্ক্যান করা PDF, তাই পরিবর্তন দেখানোর মতো টেক্সট নেই। Word বা PDF ডাউনলোড ব্যবহার করুন।")}</span>
      </div>
    );
  }

  const renderText = (t: string, key: string) =>
    t.split(/(\n?\[Page \d+\]\n?)/).map((part, i) => {
      const m = part.match(/\[Page (\d+)\]/);
      return m ? <span key={`${key}-${i}`} className="pageMark">{L("Page", "পৃষ্ঠা")} {num(m[1])}</span> : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>;
    });

  return (
    <div className="fdWrap">
      <div className="fdDoc card">
        <div className="cvLegend">
          <span><del className="fdDel">{L("deleted", "বাদ")}</del></span>
          <span><ins className="fdIns">{L("inserted", "যোগ")}</ins></span>
          <span className="text-faint">{L("dotted = proposed, not yet accepted · click a change for its reasoning", "ডটেড = প্রস্তাবিত, এখনও গৃহীত নয় · যুক্তি দেখতে পরিবর্তনে ক্লিক করুন")}</span>
        </div>
        <div className="fdText">
          {doc.segments.map((s, i) =>
            s.kind === "text" ? (
              <React.Fragment key={i}>{renderText(s.text, String(i))}</React.Fragment>
            ) : (
              <button
                key={i}
                className={`fdChange ${s.redline.accepted === true ? "accepted" : "pending"} ${selected === s.redline.id ? "sel" : ""}`}
                onClick={() => onSelect(selected === s.redline.id ? null : s.redline.id)}
                title={s.redline.chainOfThought.legalRationale}
              >
                <del className="fdDel">{s.original}</del>
                {s.redline.action !== "delete" && <ins className="fdIns">{s.redline.proposedText}</ins>}
                <sup>{s.redline.id}</sup>
              </button>
            )
          )}
        </div>
        {(doc.inserts.length > 0 || doc.unplaced.length > 0) && (
          <div className="fdExtra">
            <b>{L("Changes not placed in the text", "টেক্সটে বসানো যায়নি এমন পরিবর্তন")}</b>
            <p className="text-xs text-muted">{L("New clauses, or changes whose quoted wording was not found verbatim:", "নতুন ধারা, অথবা যেসব পরিবর্তনের উদ্ধৃতি হুবহু পাওয়া যায়নি:")}</p>
            {[...doc.inserts, ...doc.unplaced].map((r) => (
              <button key={r.id} className={`fdChange block pending ${selected === r.id ? "sel" : ""}`} onClick={() => onSelect(r.id)}>
                <sup>{r.id}</sup> {sec(r.clauseId)}: <ins className="fdIns">{r.proposedText}</ins>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="fdSide card">
        {sel ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="scRuleId">{sel.id}</span>
              <b className="text-white text-sm">{sec(sel.clauseId)} — {(bn && sel.sectionTitleBn) || sel.sectionTitle}</b>
            </div>
            <div className="fdReason"><span>{L("Other side's position", "অপর পক্ষের অবস্থান")}</span>{sel.chainOfThought.opposingCounselStance}</div>
            <div className="fdReason"><span>{L("Business risk", "ব্যবসায়িক ঝুঁকি")}</span>{sel.chainOfThought.commercialRiskAssessment}</div>
            <div className="fdReason"><span>{L("Legal rationale", "আইনি যুক্তি")}</span>{sel.chainOfThought.legalRationale}</div>
            <div className="fdReason"><span>{L("What to say", "কী বলবেন")}</span>"{sel.chainOfThought.negotiationTalkingPoint}"</div>
            <div className="flex gap-2 pt-1">
              <button className={sel.accepted === true ? "primary text-xs" : "secondary text-xs"} onClick={() => onUpdateRedline(sel.id, sel.accepted === true ? null : true)}>
                <Check size={13} /> {sel.accepted === true ? L("Accepted", "গৃহীত") : L("Accept", "গ্রহণ")}
              </button>
              <button className="secondary text-xs" onClick={() => { onUpdateRedline(sel.id, false); onSelect(null); }}>
                <X size={13} /> {L("Reject", "প্রত্যাখ্যান")}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">
            {L(
              `${placedCount} of ${redlines.filter((r) => r.accepted !== false).length} changes are shown in place. Click one to see why it is proposed. Rejected changes are hidden.`,
              `${num(redlines.filter((r) => r.accepted !== false).length)}টি পরিবর্তনের মধ্যে ${num(placedCount)}টি জায়গামতো দেখানো হয়েছে। কেন প্রস্তাব করা হয়েছে দেখতে একটিতে ক্লিক করুন। প্রত্যাখ্যাত পরিবর্তন লুকানো থাকে।`
            )}
          </p>
        )}
      </aside>
    </div>
  );
}
