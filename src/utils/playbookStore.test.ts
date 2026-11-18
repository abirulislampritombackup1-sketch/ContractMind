import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBOOKS } from "../data/playbooks";
import { blankPlaybook, copyPlaybook, exportPlaybookJson, isCustom, newRule, parsePlaybook, playbookProblems } from "./playbookStore";
import { buildScoring } from "./scoring";
import { scoreSummary } from "./riskReport";

describe("custom playbooks", () => {
  it("copies a built-in playbook as an editable custom one without changing the original", () => {
    const src = DEFAULT_PLAYBOOKS[0];
    const copy = copyPlaybook(src, "Mine");
    expect(isCustom(copy)).toBe(true);
    expect(isCustom(src)).toBe(false);
    copy.rules[0].title = "changed";
    expect(src.rules[0].title).not.toBe("changed");
    expect(copy.rules).toHaveLength(src.rules.length);
  });

  it("reports what is missing before a blank playbook can be used", () => {
    const pb = blankPlaybook();
    expect(playbookProblems(pb)).toEqual(expect.arrayContaining(["rule 1 title", "rule 1 target"]));
    pb.rules[0].title = "Cap";
    pb.rules[0].targetStandard = "12 months of fees";
    expect(playbookProblems(pb)).toEqual([]);
  });

  it("gives new rules unique ids", () => {
    const pb = blankPlaybook();
    pb.rules.push(newRule(pb.rules));
    pb.rules.push(newRule(pb.rules));
    expect(new Set(pb.rules.map((r) => r.id)).size).toBe(3);
  });

  it("round-trips through the JSON export", () => {
    const pb = copyPlaybook(DEFAULT_PLAYBOOKS[2], "Shared");
    const back = parsePlaybook(JSON.parse(exportPlaybookJson(pb)))!;
    expect(back.name).toBe("Shared");
    expect(back.rules.map((r) => r.id)).toEqual(pb.rules.map((r) => r.id));
    expect(back.tolerances).toEqual(pb.tolerances);
  });

  it("cleans up untrusted imports and rejects non-playbooks", () => {
    expect(parsePlaybook({ hello: 1 })).toBeNull();
    expect(parsePlaybook({ rules: [] })).toBeNull();
    const pb = parsePlaybook({ id: "buyer-defense", name: "X", rules: [{ title: "T", targetStandard: "S", category: "Nope", severity: "Huge", weight: 900 }] })!;
    expect(isCustom(pb)).toBe(true); // never takes over a built-in id
    expect(pb.rules[0].category).toBe("Compliance & Security");
    expect(pb.rules[0].severity).toBe("Medium");
    expect(pb.rules[0].weight).toBe(50);
  });

  it("scores a contract against custom rules and explains the score", () => {
    const pb = blankPlaybook();
    pb.rules = [
      { ...newRule([]), id: "C-01", title: "Cap", targetStandard: "12 months", weight: 30 },
      { ...newRule([]), id: "C-02", title: "Notice", targetStandard: "30 days", weight: 10 },
    ];
    const scoring = buildScoring(
      [
        { ruleId: "C-01", status: "Fail", clauseRef: "Section 6", evidence: "Not found", explanation: "x" },
        { ruleId: "c-02", status: "Pass", clauseRef: "Section 3", evidence: "Not found", explanation: "y" },
      ],
      pb,
      ""
    );
    expect(scoring.pointsLost).toBe(30);
    expect(scoring.totalWeight).toBe(40);
    expect(scoreSummary(scoring, "en")).toMatch(/1 rule failed \(30 points\), 1 passed/);
  });
});
