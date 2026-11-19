import { describe, expect, it } from "vitest";
import { replayPipeline, replaySchedule } from "./demoRuns";
import type { AgentRun } from "../types";

const run = (key: string, ms: number, extra: Partial<AgentRun> = {}): AgentRun => ({ key, ok: true, ms, mode: "rag", ...extra });
const RUNS = [run("risk", 20000), run("obligations", 15000), run("benchmarks", 18000), run("tables", 0, { skipped: true }), run("opposing", 16000), run("redlines", 24000)];

describe("saved demo replay", () => {
  it("keeps the hand-off order and fits the replay into 6-14 seconds", () => {
    const s = Object.fromEntries(replaySchedule(RUNS).map((x) => [x.key, x]));
    expect(s.opposing.startMs).toBe(s.risk.endMs);
    expect(s.redlines.startMs).toBe(s.opposing.endMs);
    expect(s.obligations.startMs).toBe(0);
    expect(s.tables.endMs).toBe(s.tables.startMs); // skipped agents finish at once
    expect(Math.max(...Object.values(s).map((x) => x.endMs))).toBeLessThanOrEqual(14000);
    expect(Math.max(...Object.values(s).map((x) => x.endMs))).toBeGreaterThanOrEqual(6000);
  });

  it("reports every agent as running and then done, like a live analysis", async () => {
    const seen: string[] = [];
    await replayPipeline(RUNS, (agent, state) => seen.push(`${agent}:${state}`), async () => {});
    for (const k of ["risk", "obligations", "benchmarks", "opposing", "redlines"]) {
      expect(seen.indexOf(`${k}:running`)).toBeLessThan(seen.indexOf(`${k}:done`));
    }
    expect(seen).toContain("tables:done");
    expect(seen).not.toContain("tables:running");
    expect(seen.indexOf("risk:done")).toBeLessThan(seen.indexOf("opposing:running"));
  });
});
