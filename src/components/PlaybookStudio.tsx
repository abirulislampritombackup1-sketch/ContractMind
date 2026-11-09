import React, { useState } from "react";
import { Playbook, PlaybookRule } from "../types";
import { DEFAULT_PLAYBOOKS } from "../data/playbooks";
import { BookOpen, Shield, Check, Sliders, AlertTriangle, Scale, Plus, Sparkles } from "lucide-react";

interface PlaybookStudioProps {
  currentPlaybook: Playbook;
  onSelectPlaybook: (playbook: Playbook) => void;
}

export const PlaybookStudio: React.FC<PlaybookStudioProps> = ({ currentPlaybook, onSelectPlaybook }) => {
  const [activeTab, setActiveTab] = useState<string>(currentPlaybook.id);
  const [customPlaybook, setCustomPlaybook] = useState<Playbook>({
    ...currentPlaybook,
    id: "custom-playbook",
    name: "Custom Enterprise Negotiating Policy",
    stance: "Custom",
    badge: "Custom Policy",
    description: "Fine-tune risk tolerances, liability ceilings, and compliance guardrails tailored to your organization.",
  });

  const handleSelectPreset = (pb: Playbook) => {
    setActiveTab(pb.id);
    onSelectPlaybook(pb);
  };

  const handleUpdateCustomTolerance = (field: keyof Playbook["tolerances"], value: any) => {
    const updated: Playbook = {
      ...customPlaybook,
      tolerances: {
        ...customPlaybook.tolerances,
        [field]: value,
      },
    };
    setCustomPlaybook(updated);
    if (activeTab === "custom-playbook") {
      onSelectPlaybook(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Playbook Presets Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <BookOpen size={15} /> Playbook & Policy Governance
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Contract Review Playbooks</h2>
          <p className="text-muted text-sm mt-1">
            ContractMind calibrates risk discovery, agent perspectives, and redline recommendations based on your selected negotiating stance.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted font-medium">Active Policy:</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand/15 text-brand border border-brand/30 flex items-center gap-1.5">
            <Shield size={13} /> {currentPlaybook.name}
          </span>
        </div>
      </div>

      {/* Preset Cards Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEFAULT_PLAYBOOKS.map((pb) => {
          const isSelected = activeTab === pb.id;
          return (
            <div
              key={pb.id}
              onClick={() => handleSelectPreset(pb)}
              className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-brand bg-brand/10 shadow-lg shadow-brand/10 ring-1 ring-brand/40"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-solid"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isSelected ? "bg-brand text-brand-ink" : "bg-white/10 text-muted"
                    }`}
                  >
                    {pb.badge}
                  </span>
                  {isSelected && <Check size={16} className="text-brand font-bold" />}
                </div>
                <h3 className="font-bold text-white text-base mb-1.5">{pb.name}</h3>
                <p className="text-xs text-muted line-clamp-3 leading-relaxed">{pb.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[11px] text-faint">
                <span>{pb.rules.length} Rule Modules</span>
                <span className="text-brand font-semibold">{pb.tolerances.maxLiabilityMultiplier}x Cap Limit</span>
              </div>
            </div>
          );
        })}

        {/* Custom Playbook Builder Card */}
        <div
          onClick={() => {
            setActiveTab("custom-playbook");
            onSelectPlaybook(customPlaybook);
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === "custom-playbook"
              ? "border-brand-2 bg-brand-2/10 shadow-lg shadow-brand-2/10 ring-1 ring-brand-2/40"
              : "border-line border-dashed bg-surface hover:border-line-strong hover:bg-surface-solid"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-2/20 text-brand-2">
                Custom Policy
              </span>
              <Sliders size={16} className="text-brand-2" />
            </div>
            <h3 className="font-bold text-white text-base mb-1.5">Interactive Custom Playbook</h3>
            <p className="text-xs text-muted leading-relaxed">
              Create a custom compliance threshold with specific liability caps, notice windows, and AI training restrictions.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[11px] text-brand-2 font-semibold">
            <span>Configure Parameters</span>
            <Sparkles size={13} />
          </div>
        </div>
      </div>

      {/* Selected Playbook Parameter Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tolerance Knobs */}
        <div className="bg-surface p-6 rounded-2xl border border-line space-y-5">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-brand" />
            <h3 className="text-base font-bold text-white">Risk Tolerances & Guardrails</h3>
          </div>
          <p className="text-xs text-muted">
            The scoring engine checks ingested clauses against these strict parameter boundaries.
          </p>

          <div className="space-y-4 pt-2">
            {/* Max Liability Multiplier */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted font-medium">Max Liability Cap Multiplier</span>
                <span className="text-brand font-bold">
                  {currentPlaybook.tolerances.maxLiabilityMultiplier}x Annual Fees
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.5"
                value={currentPlaybook.tolerances.maxLiabilityMultiplier}
                onChange={(e) => handleUpdateCustomTolerance("maxLiabilityMultiplier", parseFloat(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-faint mt-1">
                <span>0.5x (Strict)</span>
                <span>1.0x (Market)</span>
                <span>3.0x (Lenient)</span>
              </div>
            </div>

            {/* Mutual Indemnity Requirement */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-solid border border-line">
              <div>
                <div className="text-xs font-semibold text-white">Mandatory Mutual Indemnity</div>
                <div className="text-[11px] text-muted">Flag unilateral clauses as critical risk</div>
              </div>
              <input
                type="checkbox"
                checked={currentPlaybook.tolerances.requireMutualIndemnity}
                onChange={(e) => handleUpdateCustomTolerance("requireMutualIndemnity", e.target.checked)}
                className="w-4 h-4 accent-brand cursor-pointer"
              />
            </div>

            {/* Termination for Convenience */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-solid border border-line">
              <div>
                <div className="text-xs font-semibold text-white">Require Convenience Termination</div>
                <div className="text-[11px] text-muted">Reject non-cancelable multi-year lock-ins</div>
              </div>
              <input
                type="checkbox"
                checked={currentPlaybook.tolerances.requireTerminationForConvenience}
                onChange={(e) => handleUpdateCustomTolerance("requireTerminationForConvenience", e.target.checked)}
                className="w-4 h-4 accent-brand cursor-pointer"
              />
            </div>

            {/* Convenience Notice Days */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted font-medium">Convenience Notice Window</span>
                <span className="text-brand-2 font-bold">{currentPlaybook.tolerances.convenienceNoticeDays} Days</span>
              </div>
              <input
                type="range"
                min="15"
                max="90"
                step="15"
                value={currentPlaybook.tolerances.convenienceNoticeDays}
                onChange={(e) => handleUpdateCustomTolerance("convenienceNoticeDays", parseInt(e.target.value))}
                className="w-full accent-brand-2 cursor-pointer"
              />
            </div>

            {/* Data Breach Notice Hours */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted font-medium">Data Breach Notification SLA</span>
                <span className="text-danger font-bold">{currentPlaybook.tolerances.requireDataBreachNoticeHours} Hours</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[24, 48, 72].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => handleUpdateCustomTolerance("requireDataBreachNoticeHours", hours)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      currentPlaybook.tolerances.requireDataBreachNoticeHours === hours
                        ? "bg-danger/20 border-danger text-danger"
                        : "bg-surface-solid border-line text-muted hover:text-white"
                    }`}
                  >
                    {hours} Hours
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Terms Max Days */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted font-medium">Maximum Payment Window</span>
                <span className="text-white font-bold">Net {currentPlaybook.tolerances.paymentTermsMaxDays}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleUpdateCustomTolerance("paymentTermsMaxDays", days)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      currentPlaybook.tolerances.paymentTermsMaxDays === days
                        ? "bg-brand/20 border-brand text-brand"
                        : "bg-surface-solid border-line text-muted hover:text-white"
                    }`}
                  >
                    Net {days}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns (2-wide): Rules & Enforced Clauses */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-line flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-brand" />
                <h3 className="text-base font-bold text-white">Active Playbook Rules & Standards</h3>
              </div>
              <span className="text-xs text-muted">{currentPlaybook.rules.length} Active Rules</span>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {currentPlaybook.rules.map((rule: PlaybookRule) => (
                <div key={rule.id} className="p-4 rounded-xl bg-surface-solid/70 border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{rule.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-line text-muted">
                        {rule.category}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rule.severity === "Critical"
                          ? "bg-danger/20 text-danger"
                          : rule.severity === "High"
                          ? "bg-warn/20 text-warn"
                          : "bg-brand/20 text-brand"
                      }`}
                    >
                      {rule.severity} (Weight {rule.weight}%)
                    </span>
                  </div>

                  <div className="text-xs text-muted leading-relaxed">
                    <span className="text-brand font-semibold">Target Standard: </span>
                    {rule.targetStandard}
                  </div>

                  <div className="text-xs text-faint">
                    <span className="text-danger font-semibold">Unacceptable: </span>
                    {rule.unacceptableTerms.join(" • ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
            <span className="text-xs text-muted">
              Scoring algorithms automatically compute compliance deviations against these benchmarks.
            </span>
            <button
              onClick={() => onSelectPlaybook(currentPlaybook)}
              className="primary"
            >
              <Check size={16} /> Apply Playbook to Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

