import { describe, expect, it } from "vitest";
import { matchGold } from "./goldIndex";
import { Chunk } from "./chunker";
import { GoldStandardClause } from "../types";
import { GOLD_STANDARD_CLAUSES } from "../data/goldStandards";
import { enrichComparisons, missingFrom } from "../services/gemini";

// Tiny 3-dimensional "embeddings": axis 0 = indemnity, 1 = liability cap, 2 = payment.
const unit = (v: number[]) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const chunk = (id: string, text: string, page = 1): Chunk => ({ id, index: 0, headingPath: [id], page, text, overlapChars: 0, embedText: text } as any);
const gold = (id: string, category: string, required: boolean): GoldStandardClause => ({
  id,
  category,
  title: `${category} gold`,
  standardText: `${category} text`,
  rationale: "",
  marketSource: "test",
  required,
});

const GOLD = [gold("G-IND", "Indemnification", true), gold("G-CAP", "Liability Cap", true), gold("G-PAY", "Payment", false)];
const GOLD_VECS = [unit([1, 0, 0]), unit([0, 1, 0]), unit([0, 0, 1])];

describe("Gold Standard retrieval", () => {
  it("matches each gold clause to its most similar contract sections", () => {
    const chunks = [chunk("C1", "indemnity"), chunk("C2", "cap", 3), chunk("C3", "payment")];
    const vecs = [unit([0.95, 0.1, 0.05]), unit([0.1, 0.9, 0.1]), unit([0.05, 0.1, 0.95])];
    const r = matchGold(chunks, vecs, GOLD, GOLD_VECS, { threshold: 0.6 });
    expect(r.matched.map((m) => m.gold.id).sort()).toEqual(["G-CAP", "G-IND", "G-PAY"]);
    expect(r.matched.find((m) => m.gold.id === "G-CAP")!.hits[0].chunk.id).toBe("C2");
    expect(r.possiblyMissing).toEqual([]);
  });

  it("reports a required protection as possibly missing when the contract has no similar section", () => {
    // The same contract with its indemnity section removed.
    const chunks = [chunk("C2", "cap"), chunk("C3", "payment")];
    const vecs = [unit([0.1, 0.9, 0.1]), unit([0.05, 0.1, 0.95])];
    const r = matchGold(chunks, vecs, GOLD, GOLD_VECS, { threshold: 0.6 });
    expect(r.possiblyMissing.map((m) => m.gold.id)).toEqual(["G-IND"]);
    expect(r.matched.map((m) => m.gold.id)).not.toContain("G-IND");
  });

  it("never reports optional clauses as missing", () => {
    const chunks = [chunk("C1", "indemnity"), chunk("C2", "cap")];
    const vecs = [unit([1, 0, 0]), unit([0, 1, 0])];
    const r = matchGold(chunks, vecs, GOLD, GOLD_VECS, { threshold: 0.6 });
    expect(r.possiblyMissing).toEqual([]);
  });

  it("turns the agent's confirmation into missing protections, defaulting to missing", () => {
    const chunks = [chunk("C2", "cap")];
    const r = matchGold(chunks, [unit([0, 1, 0])], GOLD, GOLD_VECS, { threshold: 0.6 });
    const out = missingFrom(r, [{ goldId: "g-ind", status: "not_applicable", evidence: "NDA only" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ goldId: "G-IND", status: "not_applicable", confirmedByAI: true });
    expect(missingFrom(r, undefined)[0]).toMatchObject({ status: "missing", confirmedByAI: false });
  });

  it("adds similarity, section and page to the agent's comparisons", () => {
    const chunks = [chunk("C2", "cap", 4)];
    const r = matchGold(chunks, [unit([0, 1, 0])], GOLD, GOLD_VECS, { threshold: 0.6 });
    const [c] = enrichComparisons([{ goldId: "G-CAP", clauseCategory: "", contractClauseTitle: "", contractClauseText: "", goldStandardTitle: "", goldStandardText: "", matchScore: 50, deviations: [], missingProtections: [], recommendation: "" }], r);
    expect(c.similarity).toBeCloseTo(1);
    expect(c.page).toBe(4);
    expect(c.contractRef).toContain("C2");
  });

  it("ships a library of about 30 gold clauses with unique ids and required core protections", () => {
    expect(GOLD_STANDARD_CLAUSES.length).toBeGreaterThanOrEqual(28);
    expect(new Set(GOLD_STANDARD_CLAUSES.map((g) => g.id)).size).toBe(GOLD_STANDARD_CLAUSES.length);
    const required = GOLD_STANDARD_CLAUSES.filter((g) => g.required).map((g) => g.category);
    expect(required).toEqual(expect.arrayContaining(["Indemnification", "Limitation of Liability", "Termination", "Confidentiality", "Governing Law"]));
  });
});
