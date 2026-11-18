import React from "react";
import { ArrowRight, CheckCircle2, FileEdit, GitCompare, ListOrdered, MinusCircle, ScanEye, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import type { AgentKey, AgentState } from "../services/gemini";
import type { AgentRun } from "../types";
import { toBnDigits, useLang } from "../i18n/lang";

type State = AgentState | "waiting";

const INFO: Record<AgentKey, { icon: React.ReactNode; en: [string, string]; bn: [string, string] }> = {
  risk: { icon: <ShieldCheck size={18} />, en: ["Risk Auditor", "Scores every playbook rule"], bn: ["ঝুঁকি নিরীক্ষক", "প্লেবুকের প্রতিটি নিয়ম যাচাই করে"] },
  opposing: { icon: <ShieldAlert size={18} />, en: ["Opposing Counsel", "Finds one-sided clauses, indemnities first"], bn: ["প্রতিপক্ষ আইনজীবী", "একতরফা ধারা খোঁজে, আগে ক্ষতিপূরণ"] },
  redlines: { icon: <FileEdit size={18} />, en: ["Commercial Dealmaker", "Writes counter-offers as redlines"], bn: ["বাণিজ্যিক ডিলমেকার", "পাল্টা প্রস্তাব রেডলাইন হিসেবে লেখে"] },
  tables: { icon: <ScanEye size={18} />, en: ["Table Vision", "Reads payment tables from page images"], bn: ["টেবিল ভিশন", "পৃষ্ঠার ছবি থেকে পেমেন্ট টেবিল পড়ে"] },
  obligations: { icon: <ListOrdered size={18} />, en: ["Obligation Extractor", "Duties, deadlines and payments"], bn: ["বাধ্যবাধকতা সংগ্রাহক", "দায়িত্ব, সময়সীমা ও পেমেন্ট"] },
  benchmarks: { icon: <GitCompare size={18} />, en: ["Benchmark Agent", "Gold Standard search and comparison"], bn: ["বেঞ্চমার্ক এজেন্ট", "আদর্শ ধারা খোঁজা ও তুলনা"] },
};

const HANDOFF: Partial<Record<AgentKey, { from: AgentKey; en: string; bn: string }>> = {
  opposing: { from: "risk", en: "receives the failed rules", bn: "ব্যর্থ নিয়মগুলো পায়" },
  redlines: { from: "opposing", en: "receives the one-sided clauses", bn: "একতরফা ধারাগুলো পায়" },
};

export const PIPELINE_ORDER: AgentKey[] = ["risk", "opposing", "redlines", "obligations", "tables", "benchmarks"];

/** The agent pipeline: a hand-off chain plus two parallel agents, with live state and metrics. */
export function AgentPipeline({ states, runs, compact }: { states: Partial<Record<AgentKey, State>>; runs: Partial<Record<AgentKey, AgentRun>>; compact?: boolean }) {
  const { L, bn, num } = useLang();

  const metrics = (r?: AgentRun) => {
    if (!r) return null;
    const bits = [
      r.model,
      `${num((r.ms / 1000).toFixed(1))}${L("s", " সে.")}`,
      r.tokens ? `${num(r.tokens.toLocaleString("en-US"))} ${L("tokens", "টোকেন")}` : "",
      r.chunksSent !== undefined && r.chunksTotal ? `${num(r.chunksSent)}/${num(r.chunksTotal)} ${L("sections", "অংশ")}` : r.mode === "full" ? L("whole document", "পুরো ডকুমেন্ট") : "",
      r.note
        ? bn
          ? num(r.note.replace(/ rule\(s\)/, "টি নিয়ম").replace(/ finding\(s\)/, "টি পর্যবেক্ষণ").replace(/ matched/, "টি মিলেছে").replace(/ possibly missing/, "টি সম্ভাব্য অনুপস্থিত").replace(/^pages /, "পৃষ্ঠা ").replace("no table pages found", "টেবিলের পৃষ্ঠা পাওয়া যায়নি").replace("no PDF pages", "PDF পৃষ্ঠা নেই").replace("scanned pages are already read as images", "স্ক্যান করা পৃষ্ঠা আগেই ছবি হিসেবে পড়া হয়েছে").replace("table pages too large to send", "টেবিলের পৃষ্ঠা পাঠানোর জন্য খুব বড়"))
          : r.note
        : "",
    ].filter(Boolean);
    return <small className="apMetrics">{bits.join(" · ")}</small>;
  };

  const card = (k: AgentKey) => {
    const st = states[k] || "waiting";
    const run = runs[k];
    const skipped = !!run?.skipped;
    const [name, desc] = bn ? INFO[k].bn : INFO[k].en;
    const h = HANDOFF[k];
    return (
      <div key={k} className={`agent ${st}${skipped ? " skipped" : ""}`}>
        <div className="apTop">
          <div className="agentIcon">{INFO[k].icon}</div>
          <div>
            <b>{name}</b>
            <p>{desc}</p>
          </div>
        </div>
        {h && (
          <span className="apHandoff">
            <ArrowRight size={11} /> {L(`${INFO[h.from].en[0]} → ${h.en}`, `${INFO[h.from].bn[0]} থেকে ${h.bn}`)}
          </span>
        )}
        {!compact && <div className="bar"><i /></div>}
        <div className="agentState" style={{ color: skipped ? "var(--muted)" : st === "done" ? "var(--ok)" : st === "failed" ? "var(--danger)" : "var(--muted)" }}>
          {skipped ? <MinusCircle size={14} /> : st === "done" ? <CheckCircle2 size={14} /> : st === "failed" ? <XCircle size={14} /> : st === "running" ? <span className="spinner dark" style={{ width: 13, height: 13, borderWidth: 2 }} /> : null}
          {skipped ? L("Not needed", "প্রয়োজন হয়নি") : st === "done" ? L("Done", "সম্পন্ন") : st === "failed" ? L("Failed", "ব্যর্থ") : st === "running" ? L("Working…", "কাজ চলছে…") : h ? L("Waiting for hand-off", "হস্তান্তরের অপেক্ষায়") : L("Starting…", "শুরু হচ্ছে…")}
        </div>
        {metrics(run)}
      </div>
    );
  };

  return (
    <div className="pipeline">
      <div className="apLane">
        <span className="apLaneLabel">{L("Negotiation chain (each agent hands its output to the next)", "আলোচনার ধারা (প্রতিটি এজেন্ট তার ফলাফল পরেরটিকে দেয়)")}</span>
        <div className="apChain">
          {card("risk")}
          <ArrowRight className="apArrow" size={18} />
          {card("opposing")}
          <ArrowRight className="apArrow" size={18} />
          {card("redlines")}
        </div>
      </div>
      <div className="apLane">
        <span className="apLaneLabel">{L("In parallel", "একই সময়ে")}</span>
        <div className="apParallel">
          {card("obligations")}
          {card("tables")}
          {card("benchmarks")}
        </div>
      </div>
    </div>
  );
}

/** Pipeline summary for a finished result (from result.agentRuns). */
export function AgentRunsCard({ runs }: { runs?: AgentRun[] }) {
  const { L } = useLang();
  if (!runs?.length) return null;
  const byKey = Object.fromEntries(runs.map((r) => [r.key, r])) as Partial<Record<AgentKey, AgentRun>>;
  const states = Object.fromEntries(runs.map((r) => [r.key, r.ok ? "done" : "failed"])) as Partial<Record<AgentKey, State>>;
  const total = runs.reduce((s, r) => s + (r.tokens || 0), 0);
  return (
    <section className="card">
      <div className="stepHead" style={{ marginBottom: 14 }}>
        <div>
          <h2>{L("How this analysis ran", "বিশ্লেষণ কীভাবে হয়েছে")}</h2>
          <p>
            {L(
              `${runs.length} agents · ${total.toLocaleString("en-US")} tokens in total. Each agent read only the contract sections it retrieved.`,
              toBnDigits(`${runs.length}টি এজেন্ট · মোট ${total.toLocaleString("en-US")} টোকেন। প্রতিটি এজেন্ট শুধু নিজের খুঁজে পাওয়া অংশগুলো পড়েছে।`)
            )}
          </p>
        </div>
      </div>
      <AgentPipeline states={states} runs={byKey} compact />
    </section>
  );
}
