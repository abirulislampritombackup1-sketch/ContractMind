import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, Info, MapPin, MinusCircle, RotateCcw, Scale, SlidersHorizontal, XCircle } from "lucide-react";
import { PlaybookScoring, RuleStatus } from "../types";
import { STATUS_FACTOR, scoreOf } from "../utils/scoring";

interface Props {
  scoring: PlaybookScoring;
  playbookName: string;
  onWeightsChange: (weights: Record<string, number>) => void;
  lang?: "en" | "bn";
  locatedIds?: Set<string>;
  onShowInContract?: (ruleId: string) => void;
}

const STATUS_META: Record<RuleStatus, { cls: string; icon: React.ReactNode; en: string; bn: string }> = {
  Fail: { cls: "danger", icon: <XCircle size={13} />, en: "Fail", bn: "ব্যর্থ" },
  "Not Addressed": { cls: "warn", icon: <CircleSlash size={13} />, en: "Not addressed", bn: "উল্লেখ নেই" },
  Partial: { cls: "warn", icon: <MinusCircle size={13} />, en: "Partial", bn: "আংশিক" },
  Pass: { cls: "ok", icon: <CheckCircle2 size={13} />, en: "Pass", bn: "উত্তীর্ণ" },
  "Not Assessed": { cls: "neutral", icon: <Info size={13} />, en: "Not assessed", bn: "মূল্যায়িত হয়নি" },
};
const ORDER: RuleStatus[] = ["Fail", "Not Addressed", "Partial", "Pass", "Not Assessed"];

export const PlaybookScorecard: React.FC<Props> = ({ scoring, playbookName, onWeightsChange, lang = "en", locatedIds, onShowInContract }) => {
  const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const [editing, setEditing] = useState(false);
  const score = scoreOf(scoring);
  const changed = scoring.rules.some((r) => r.weight !== r.baseWeight);
  const weights = Object.fromEntries(scoring.rules.map((r) => [r.ruleId, r.weight]));
  const counts = ORDER.map((s) => [s, scoring.rules.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0);
  const rules = [...scoring.rules].sort((a, b) => b.pointsLost - a.pointsLost || ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const maxLost = Math.max(1, ...rules.map((r) => r.pointsLost));

  return (
    <section className="card scorecard">
      <div className="scHead">
        <div className="scTitle">
          <span className="scIcon"><Scale size={18} /></span>
          <div>
            <h3>{L("Playbook scorecard", "প্লেবুক স্কোরকার্ড")}</h3>
            <p>
              {L("The risk score is calculated from the rules of ", "ঝুঁকি স্কোর হিসাব করা হয়েছে এই প্লেবুকের নিয়ম থেকে: ")}
              <b>{playbookName}</b>
              {L(" — the AI judges each rule, the maths is fixed.", " — এআই প্রতিটি নিয়ম যাচাই করে, হিসাব নির্দিষ্ট।")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {changed && (
            <button className="secondary" onClick={() => onWeightsChange(Object.fromEntries(scoring.rules.map((r) => [r.ruleId, r.baseWeight])))}>
              <RotateCcw size={14} /> {L("Reset weights", "ওজন রিসেট")}
            </button>
          )}
          <button className={editing ? "primary" : "secondary"} onClick={() => setEditing(!editing)} aria-pressed={editing}>
            <SlidersHorizontal size={14} /> {editing ? L("Done", "সম্পন্ন") : L("Adjust weights", "ওজন পরিবর্তন")}
          </button>
        </div>
      </div>

      <div className="scFormula">
        <div className="scBig">
          <b>{score}</b>
          <span>/100</span>
        </div>
        <div className="scEq">
          <div>
            <b>{scoring.pointsLost.toFixed(1).replace(/\.0$/, "")}</b> {L("risk points of", "ঝুঁকি পয়েন্ট, মোট")} <b>{scoring.totalWeight}</b>{" "}
            {L("possible", "সম্ভাব্য")}
          </div>
          <small>
            {L("Each rule adds weight × ", "প্রতিটি নিয়ম যোগ করে ওজন × ")}
            <span className="tag danger">Fail 1</span> <span className="tag warn">{L("Not addressed", "উল্লেখ নেই")} {STATUS_FACTOR["Not Addressed"]}</span>{" "}
            <span className="tag warn">Partial {STATUS_FACTOR.Partial}</span> <span className="tag ok">Pass 0</span>
          </small>
        </div>
        <div className="scCounts">
          {counts.map(([s, n]) => (
            <span key={s} className={`tag ${STATUS_META[s].cls}`}>
              {STATUS_META[s].icon} {n} {L(STATUS_META[s].en, STATUS_META[s].bn)}
            </span>
          ))}
        </div>
      </div>

      {changed && (
        <div className="notice info" style={{ margin: "0 0 14px" }}>
          <Info size={16} />
          <span>{L("Weights adjusted — the score was recalculated instantly from the same rule results, no new AI call.", "ওজন পরিবর্তিত — একই নিয়মের ফলাফল থেকে স্কোর তাৎক্ষণিক পুনরায় হিসাব হয়েছে, নতুন এআই কল ছাড়াই।")}</span>
        </div>
      )}

      <div className="scRules">
        {rules.map((r) => {
          const meta = STATUS_META[r.status];
          return (
            <div key={r.ruleId} className={`scRule ${meta.cls}`}>
              <div className="scRuleTop">
                <span className={`tag ${meta.cls}`}>{meta.icon} {L(meta.en, meta.bn)}</span>
                <span className="scRuleId">{r.ruleId}</span>
                <b className="scRuleTitle">{r.ruleTitle}</b>
                {onShowInContract && locatedIds?.has(`rule:${r.ruleId}`) && (
                  <button className="locBtn" onClick={() => onShowInContract(r.ruleId)}>
                    <MapPin size={12} /> {L("Show in contract", "চুক্তিতে দেখুন")}
                  </button>
                )}
                <span className="scPts" title={`${r.weight} × ${r.status === "Not Assessed" ? "—" : STATUS_FACTOR[r.status]}`}>
                  {r.status === "Not Assessed" ? "—" : `+${r.pointsLost.toFixed(1).replace(/\.0$/, "")}`} <small>/ {r.weight}</small>
                </span>
              </div>
              <div className="scBar"><i style={{ width: `${(100 * r.pointsLost) / maxLost}%` }} /></div>
              <p className="scWhy">
                <span className="text-faint">{r.category} · {r.clauseRef}</span> — {r.explanation}
              </p>
              {r.evidence && (
                <blockquote className="scQuote">
                  “{r.evidence}”
                  {r.verified === true && <span className="tag ok"><CheckCircle2 size={11} /> {L("Verified in contract", "চুক্তিতে যাচাইকৃত")}</span>}
                  {r.verified === false && <span className="tag warn"><AlertTriangle size={11} /> {L("Quote not found verbatim", "হুবহু উদ্ধৃতি পাওয়া যায়নি")}</span>}
                </blockquote>
              )}
              {editing && (
                <label className="scSlider">
                  <span>{L("Weight", "ওজন")}</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={r.weight}
                    onChange={(e) => onWeightsChange({ ...weights, [r.ruleId]: Number(e.target.value) })}
                    aria-label={`Weight for ${r.ruleId}`}
                  />
                  <b>{r.weight}</b>
                  {r.weight !== r.baseWeight && <small className="text-faint">({L("playbook", "প্লেবুক")}: {r.baseWeight})</small>}
                </label>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
