// Saved runs for the three sample contracts. A real analysis of each sample with each
// built-in playbook (English and Bangla) is recorded once and shipped in public/demo/, so demos don't
// spend API quota. The analysing screen replays the recorded agent pipeline with its real
// timings (shortened), and the result is marked as a saved run. "Re-run" always calls the AI.

import type { AgentKey, AgentState } from "../services/gemini";
import type { AgentRun, ContractAnalysisResult } from "../types";
import { DEFAULT_PLAYBOOKS } from "../data/playbooks";

export type DemoRun = { sampleId: string; lang: "en" | "bn"; playbookId: string; recordedAt: string; result: ContractAnalysisResult };

/** File name of a saved run: public/demo/<sample>.<playbook>.<lang>.json */
export const demoFileName = (sampleId: string, playbookId: string, lang: string) => `${sampleId}.${playbookId}.${lang}.json`;

/** The saved run for a sample, or null (custom playbook, missing file, or offline). */
export async function loadDemoRun(sampleId: string, playbookId: string, lang: "en" | "bn"): Promise<DemoRun | null> {
  if (!DEFAULT_PLAYBOOKS.some((p) => p.id === playbookId)) return null; // custom playbooks always run live
  try {
    const res = await fetch(`/demo/${encodeURIComponent(demoFileName(sampleId, playbookId, lang))}`);
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    const run: DemoRun = await res.json();
    return run?.result?.contractTitle ? run : null;
  } catch {
    return null;
  }
}

// Agents that wait for another agent's output (the hand-off chain).
const AFTER: Partial<Record<AgentKey, AgentKey>> = { opposing: "risk", redlines: "opposing" };

/**
 * When each agent starts and ends in the replay, from its recorded duration, keeping the
 * pipeline shape (Opposing Counsel after the Risk Auditor, the Dealmaker after Opposing
 * Counsel). Durations are scaled so the whole replay takes between minMs and maxMs.
 */
export function replaySchedule(runs: AgentRun[], opts: { minMs?: number; maxMs?: number } = {}) {
  const minMs = opts.minMs ?? 6000;
  const maxMs = opts.maxMs ?? 14000;
  const byKey = new Map(runs.map((r) => [r.key as AgentKey, r]));
  const end = new Map<AgentKey, number>();
  const start = new Map<AgentKey, number>();
  const endOf = (k: AgentKey): number => {
    if (end.has(k)) return end.get(k)!;
    const r = byKey.get(k);
    const before = AFTER[k];
    const s = before && byKey.has(before) ? endOf(before) : 0;
    start.set(k, s);
    end.set(k, s + (r?.skipped ? 0 : Math.max(800, r?.ms || 0)));
    return end.get(k)!;
  };
  for (const k of byKey.keys()) endOf(k);
  const total = Math.max(1, ...end.values());
  const scale = Math.min(Math.max(total, minMs), maxMs) / total;
  return [...byKey.keys()].map((k) => ({ key: k, startMs: Math.round(start.get(k)! * scale), endMs: Math.round(end.get(k)! * scale), run: byKey.get(k)! }));
}

/** Plays the recorded pipeline through the same progress callback a live analysis uses. */
export async function replayPipeline(
  runs: AgentRun[] | undefined,
  onProgress: (agent: AgentKey, state: AgentState, run?: AgentRun) => void,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<void> {
  if (!runs?.length) return sleep(1500);
  const events = replaySchedule(runs)
    .flatMap((s) => [
      { at: s.startMs, fire: () => !s.run.skipped && onProgress(s.key, "running") },
      { at: s.endMs, fire: () => onProgress(s.key, s.run.ok ? "done" : "failed", s.run) },
    ])
    .sort((a, b) => a.at - b.at);
  let now = 0;
  for (const e of events) {
    if (e.at > now) await sleep(e.at - now);
    now = Math.max(now, e.at);
    e.fire();
  }
}
