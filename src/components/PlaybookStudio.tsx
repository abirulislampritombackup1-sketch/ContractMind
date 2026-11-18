import React, { useRef, useState } from "react";
import { Playbook, PlaybookRule } from "../types";
import { DEFAULT_PLAYBOOKS } from "../data/playbooks";
import { BookOpen, Shield, Check, Sliders, Scale, Plus, Copy, Trash2, Download, Upload, AlertTriangle, FilePlus2 } from "lucide-react";
import { useLang } from "../i18n/lang";
import { playbookText, ruleText } from "../i18n/dataBn";
import {
  RULE_CATEGORIES,
  SEVERITIES,
  blankPlaybook,
  copyPlaybook,
  exportPlaybookJson,
  isCustom,
  newRule,
  parsePlaybook,
  playbookProblems,
} from "../utils/playbookStore";

interface PlaybookStudioProps {
  currentPlaybook: Playbook;
  onSelectPlaybook: (playbook: Playbook) => void;
  customPlaybooks: Playbook[];
  /** Replaces the saved list of custom playbooks (the App persists it). */
  onCustomChange: (list: Playbook[]) => void;
}

export const PlaybookStudio: React.FC<PlaybookStudioProps> = ({ currentPlaybook, onSelectPlaybook, customPlaybooks, onCustomChange }) => {
  const { L, bn, term } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const editable = isCustom(currentPlaybook);
  const pbView = playbookText(currentPlaybook, bn);
  const problems = editable ? playbookProblems(currentPlaybook) : [];

  // Every edit to a custom playbook is saved straight away and stays selected.
  const update = (next: Playbook) => {
    onCustomChange(customPlaybooks.map((p) => (p.id === next.id ? next : p)));
    onSelectPlaybook(next);
  };
  const addPlaybook = (pb: Playbook) => {
    onCustomChange([...customPlaybooks, pb]);
    onSelectPlaybook(pb);
  };
  const setTolerance = (field: keyof Playbook["tolerances"], value: any) =>
    editable && update({ ...currentPlaybook, tolerances: { ...currentPlaybook.tolerances, [field]: value } });
  const setRule = (id: string, patch: Partial<PlaybookRule>) =>
    update({ ...currentPlaybook, rules: currentPlaybook.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const duplicate = () => {
    const name = `${pbView.name} ${L("(copy)", "(কপি)")}`;
    addPlaybook(copyPlaybook(currentPlaybook, name));
    setMessage({ text: L("Copy created. You can now edit every rule and setting.", "কপি তৈরি হয়েছে। এখন প্রতিটি নিয়ম ও সেটিং বদলাতে পারবেন।") });
  };
  const remove = () => {
    if (!confirm(L(`Delete the playbook "${currentPlaybook.name}"?`, `"${currentPlaybook.name}" প্লেবুকটি মুছে ফেলবেন?`))) return;
    onCustomChange(customPlaybooks.filter((p) => p.id !== currentPlaybook.id));
    onSelectPlaybook(DEFAULT_PLAYBOOKS[0]);
  };
  const exportJson = () => {
    const blob = new Blob([exportPlaybookJson(currentPlaybook)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${currentPlaybook.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "playbook"}.playbook.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File) => {
    try {
      const pb = parsePlaybook(JSON.parse(await f.text()));
      if (!pb) throw new Error();
      // A re-imported file gets a fresh id so it never overwrites an existing playbook.
      const fresh = customPlaybooks.some((p) => p.id === pb.id) ? { ...pb, id: `custom-${Math.random().toString(36).slice(2, 8)}` } : pb;
      addPlaybook(fresh);
      setMessage({ text: L(`Imported "${pb.name}" with ${pb.rules.length} rules.`, `"${pb.name}" আমদানি হয়েছে, ${pb.rules.length}টি নিয়মসহ।`) });
    } catch {
      setMessage({ text: L("That file is not a ContractMind playbook.", "এই ফাইলটি ContractMind প্লেবুক নয়।"), error: true });
    }
  };

  const card = (pb: Playbook) => {
    const t = playbookText(pb, bn);
    const on = currentPlaybook.id === pb.id;
    return (
      <button
        key={pb.id}
        onClick={() => onSelectPlaybook(pb)}
        aria-pressed={on}
        className={`pbCard ${on ? "on" : ""} ${isCustom(pb) ? "custom" : ""}`}
      >
        <span className="pbCardTop">
          <span className={`tag ${isCustom(pb) ? "warn" : "brand"}`}>{isCustom(pb) ? L("Custom", "কাস্টম") : t.badge}</span>
          {on && <Check size={16} className="text-brand" />}
        </span>
        <b>{t.name}</b>
        <small>{t.description || L("No description", "বিবরণ নেই")}</small>
        <span className="pbCardFoot">
          <span>{pb.rules.length} {L("rules", "টি নিয়ম")}</span>
          <span>{L(`${pb.tolerances.maxLiabilityMultiplier}x cap`, `দায়সীমা ${pb.tolerances.maxLiabilityMultiplier} গুণ`)}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <BookOpen size={15} /> {L("Playbook & Policy Governance", "প্লেবুক ও নীতি ব্যবস্থাপনা")}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{L("Contract Review Playbooks", "চুক্তি পর্যালোচনার প্লেবুক")}</h2>
          <p className="text-muted text-sm mt-1">
            {L(
              "Pick a built-in playbook, or create your own: every rule, weight and tolerance is used to score the contract.",
              "তৈরি প্লেবুক বেছে নিন, অথবা নিজের প্লেবুক বানান: প্রতিটি নিয়ম, ওজন ও সহনসীমা দিয়েই চুক্তির স্কোর হিসাব হয়।"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="secondary text-xs" onClick={() => addPlaybook(blankPlaybook(L("My playbook", "আমার প্লেবুক")))}>
            <FilePlus2 size={14} /> {L("New playbook", "নতুন প্লেবুক")}
          </button>
          <button className="secondary text-xs" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {L("Import JSON", "JSON আমদানি")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {message && (
        <div className={`notice ${message.error ? "error" : "ok"}`} role="status">
          {message.error ? <AlertTriangle size={18} /> : <Check size={18} />}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label={L("Dismiss", "বন্ধ করুন")}>×</button>
        </div>
      )}

      {/* Playbook cards */}
      <div className="pbGrid">{[...DEFAULT_PLAYBOOKS, ...customPlaybooks].map(card)}</div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details and tolerances */}
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-brand" />
            <h3 className="text-base font-bold text-white">{editable ? L("Edit playbook", "প্লেবুক সম্পাদনা") : pbView.name}</h3>
          </div>

          {editable ? (
            <>
              <label className="pbLabel">
                {L("Name", "নাম")}
                <input className="pbField" value={currentPlaybook.name} onChange={(e) => update({ ...currentPlaybook, name: e.target.value })} />
              </label>
              <label className="pbLabel">
                {L("Description", "বিবরণ")}
                <textarea className="pbField" rows={3} value={currentPlaybook.description} onChange={(e) => update({ ...currentPlaybook, description: e.target.value })} />
              </label>
            </>
          ) : (
            <p className="text-xs text-muted leading-relaxed">{pbView.description}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Sliders size={16} className="text-brand" />
            <h4 className="text-sm font-bold text-white">{L("Risk tolerances", "ঝুঁকি সহনসীমা")}</h4>
          </div>
          {!editable && (
            <p className="text-[11px] text-faint">{L("Built-in playbooks are read-only. Duplicate one to change it.", "তৈরি প্লেবুক বদলানো যায় না। বদলাতে চাইলে কপি করুন।")}</p>
          )}

          <fieldset disabled={!editable} className="space-y-4" style={{ border: 0, padding: 0, margin: 0 }}>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted font-medium">{L("Max liability cap", "সর্বোচ্চ দায়সীমা")}</span>
                <span className="text-brand font-bold">{L(`${currentPlaybook.tolerances.maxLiabilityMultiplier}x annual fees`, `বার্ষিক ফি-র ${currentPlaybook.tolerances.maxLiabilityMultiplier} গুণ`)}</span>
              </div>
              <input type="range" min="0.5" max="3.0" step="0.5" className="w-full accent-brand"
                value={currentPlaybook.tolerances.maxLiabilityMultiplier}
                onChange={(e) => setTolerance("maxLiabilityMultiplier", parseFloat(e.target.value))} />
            </div>
            {([
              ["requireMutualIndemnity", L("Mutual indemnity required", "পারস্পরিক ক্ষতিপূরণ আবশ্যক")],
              ["requireTerminationForConvenience", L("Termination for convenience required", "ইচ্ছাধীন বাতিলের সুযোগ আবশ্যক")],
              ["disallowNonCompete", L("Reject non-compete clauses", "প্রতিযোগিতা-নিষেধ ধারা প্রত্যাখ্যান")],
            ] as const).map(([field, label]) => (
              <label key={field} className="pbToggle">
                <span>{label}</span>
                <input type="checkbox" checked={!!currentPlaybook.tolerances[field]} onChange={(e) => setTolerance(field, e.target.checked)} />
              </label>
            ))}
            {([
              ["convenienceNoticeDays", L("Convenience notice (days)", "ইচ্ছাধীন বাতিলের নোটিশ (দিন)"), 0, 365],
              ["requireDataBreachNoticeHours", L("Data breach notice (hours)", "ডেটা লঙ্ঘনের নোটিশ (ঘণ্টা)"), 1, 720],
              ["paymentTermsMaxDays", L("Maximum payment terms (days)", "পেমেন্টের সর্বোচ্চ সময় (দিন)"), 0, 365],
            ] as const).map(([field, label, min, max]) => (
              <label key={field} className="pbLabel row">
                {label}
                <input className="pbField num" type="number" min={min} max={max}
                  value={currentPlaybook.tolerances[field] as number}
                  onChange={(e) => setTolerance(field, Math.min(max, Math.max(min, Number(e.target.value) || 0)))} />
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
            <button className="secondary text-xs" onClick={duplicate}><Copy size={13} /> {L("Duplicate", "কপি করুন")}</button>
            <button className="secondary text-xs" onClick={exportJson}><Download size={13} /> {L("Export JSON", "JSON রপ্তানি")}</button>
            {editable && <button className="secondary text-xs danger" onClick={remove}><Trash2 size={13} /> {L("Delete", "মুছুন")}</button>}
          </div>
        </div>

        {/* Right: rules */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-line">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-brand" />
              <h3 className="text-base font-bold text-white">{L("Playbook rules", "প্লেবুকের নিয়ম")}</h3>
            </div>
            <span className="text-xs text-muted">
              {currentPlaybook.rules.length} {L("rules", "টি নিয়ম")} · {L("total weight", "মোট ওজন")} {currentPlaybook.rules.reduce((s, r) => s + r.weight, 0)}
            </span>
          </div>

          {problems.length > 0 && (
            <div className="notice warn" style={{ margin: "0 0 14px" }}>
              <AlertTriangle size={16} />
              <span>{L("Fill in every rule's title, target standard and weight before analysing.", "বিশ্লেষণের আগে প্রতিটি নিয়মের শিরোনাম, কাঙ্ক্ষিত মান ও ওজন দিন।")}</span>
            </div>
          )}

          <div className="space-y-3">
            {currentPlaybook.rules.map((rule) => {
              const rt = ruleText(rule, bn);
              return editable ? (
                <div key={rule.id} className="pbRule edit">
                  <div className="pbRuleRow">
                    <span className="scRuleId">{rule.id}</span>
                    <input className="pbField grow" placeholder={L("Rule title, e.g. Mutual liability cap", "নিয়মের শিরোনাম, যেমন পারস্পরিক দায়সীমা")}
                      value={rule.title} onChange={(e) => setRule(rule.id, { title: e.target.value })} />
                    <button className="iconBtn" title={L("Delete rule", "নিয়ম মুছুন")} aria-label={L("Delete rule", "নিয়ম মুছুন")}
                      onClick={() => update({ ...currentPlaybook, rules: currentPlaybook.rules.filter((r) => r.id !== rule.id) })}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="pbRuleRow">
                    <select className="pbField" value={rule.category} onChange={(e) => setRule(rule.id, { category: e.target.value as PlaybookRule["category"] })}>
                      {RULE_CATEGORIES.map((c) => <option key={c} value={c}>{term(c)}</option>)}
                    </select>
                    <select className="pbField" value={rule.severity} onChange={(e) => setRule(rule.id, { severity: e.target.value as PlaybookRule["severity"] })}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{term(s)}</option>)}
                    </select>
                    <label className="pbLabel row tight">
                      {L("Weight", "ওজন")}
                      <input className="pbField num" type="number" min={1} max={50} value={rule.weight}
                        onChange={(e) => setRule(rule.id, { weight: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
                    </label>
                  </div>
                  <textarea className="pbField" rows={2} placeholder={L("Target standard: what the contract should say", "কাঙ্ক্ষিত মান: চুক্তিতে কী থাকা উচিত")}
                    value={rule.targetStandard} onChange={(e) => setRule(rule.id, { targetStandard: e.target.value })} />
                  <textarea className="pbField" rows={1} placeholder={L("Acceptable fallback (optional)", "গ্রহণযোগ্য বিকল্প (ঐচ্ছিক)")}
                    value={rule.fallbackAllowed} onChange={(e) => setRule(rule.id, { fallbackAllowed: e.target.value })} />
                  <textarea className="pbField" rows={2} placeholder={L("Unacceptable terms, one per line", "অগ্রহণযোগ্য শর্ত, প্রতি লাইনে একটি")}
                    value={rule.unacceptableTerms.join("\n")}
                    onChange={(e) => setRule(rule.id, { unacceptableTerms: e.target.value.split("\n").map((x) => x.trimStart()).filter((x, i, a) => x || i === a.length - 1) })} />
                </div>
              ) : (
                <div key={rule.id} className="pbRule">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="scRuleId">{rule.id}</span>
                      <span className="text-xs font-bold text-white">{rt.title}</span>
                      <span className="tag neutral">{term(rule.category)}</span>
                    </div>
                    <span className={`tag ${rule.severity === "Critical" ? "danger" : rule.severity === "High" ? "warn" : "brand"}`}>
                      {L(`${rule.severity} · weight ${rule.weight}`, `${term(rule.severity)} · ওজন ${rule.weight}`)}
                    </span>
                  </div>
                  <div className="text-xs text-muted leading-relaxed mt-2">
                    <span className="text-brand font-semibold">{L("Target: ", "কাঙ্ক্ষিত মান: ")}</span>{rt.targetStandard}
                  </div>
                  <div className="text-xs text-faint mt-1">
                    <span className="text-danger font-semibold">{L("Unacceptable: ", "অগ্রহণযোগ্য: ")}</span>{rt.unacceptableTerms.join(" • ")}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">
            {editable ? (
              <button className="secondary text-xs" onClick={() => update({ ...currentPlaybook, rules: [...currentPlaybook.rules, newRule(currentPlaybook.rules)] })}>
                <Plus size={14} /> {L("Add rule", "নিয়ম যোগ করুন")}
              </button>
            ) : (
              <span className="text-xs text-muted">{L("Duplicate this playbook to add or change rules.", "নিয়ম যোগ বা বদলাতে এই প্লেবুকটি কপি করুন।")}</span>
            )}
            <span className="text-xs text-faint">{editable ? L("Changes are saved automatically in this browser.", "পরিবর্তন এই ব্রাউজারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।") : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
