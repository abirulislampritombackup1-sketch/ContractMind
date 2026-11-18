import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Bm25, describeFilters, matches, parseQueryRules, rank } from "./query";
import type { Corpus } from "./corpus";
import { goldForJurisdiction, isEuContract } from "../services/gemini";

const corpus: Corpus = JSON.parse(fs.readFileSync(path.resolve("public/repository/corpus.json"), "utf8"));
const all = corpus.contracts;
const bm25 = new Bm25(all.map((c) => `${c.title} ${c.contractType} ${c.summary}`));
const search = (q: string) => rank(all, parseQueryRules(q), bm25);

describe("repository corpus", () => {
  it("contains the real CUAD and MAUD contracts with full texts and sources", () => {
    expect(all.length).toBeGreaterThan(600);
    expect(corpus.sources.map((s) => s.dataset)).toEqual(expect.arrayContaining(["CUAD v1", "MAUD"]));
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const c of all.slice(0, 50).concat(all.slice(-20))) {
      expect(fs.existsSync(path.resolve(`public/repository/texts/${c.id}.txt.gz`))).toBe(true);
      expect(c.summary.length).toBeGreaterThan(20);
      expect(c.source).toMatch(/CUAD|MAUD|EDGAR/);
    }
  });
});

describe("natural-language queries (rule parser)", () => {
  it("understands liability cap amounts", () => {
    expect(parseQueryRules("contracts with liability caps below $1M").filters).toMatchObject({ capMaxUSD: 1_000_000, hasDollarCap: true });
    expect(parseQueryRules("caps over $500k").filters.capMinUSD).toBe(500_000);
    expect(parseQueryRules("liability capped under $2,500,000").filters.capMaxUSD).toBe(2_500_000);
  });

  it("understands governing law, clauses, datasets, types and notice periods", () => {
    const f = parseQueryRules("Distributor agreements with a non-compete under New York law").filters;
    expect(f).toMatchObject({ governingLaw: ["New York"], clauses: ["nonCompete"], contractType: ["Distributor"] });
    expect(parseQueryRules("uncapped indemnification").filters.uncapped).toBe(true);
    expect(parseQueryRules("merger agreements with a termination fee").filters).toMatchObject({ dataset: ["MAUD"], clauses: ["terminationFee"] });
    expect(parseQueryRules("contracts requiring 90+ days notice for termination").filters.noticeDaysMin).toBe(90);
    expect(parseQueryRules("English law outsourcing").filters).toMatchObject({ governingLaw: ["England and Wales"], contractType: ["Outsourcing"] });
  });

  it("answers the example questions with results that really satisfy the filters", () => {
    const caps = search("Contracts with liability caps below $1M");
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((r) => r.c.cap.amountUSD! <= 1_000_000)).toBe(true);
    expect(caps.map((r) => r.c.cap.amountUSD)).toEqual([...caps.map((r) => r.c.cap.amountUSD)].sort((a, b) => a! - b!)); // smallest first

    const del = search("Uncapped liability under Delaware law");
    expect(del.length).toBeGreaterThan(0);
    expect(del.every((r) => r.c.flags.uncappedLiability && r.c.governingLaw === "Delaware")).toBe(true);

    const lic = search("License agreements with termination for convenience");
    expect(lic.length).toBeGreaterThan(0);
    expect(lic.every((r) => r.c.flags.terminationForConvenience && /license/i.test(r.c.contractType))).toBe(true);

    const nyDist = search("Distributor agreements with a non-compete under New York law");
    expect(nyDist.every((r) => r.c.governingLaw === "New York" && r.c.flags.nonCompete)).toBe(true);
  });

  it("ranks keyword matches first and shows readable filter chips", () => {
    const r = search("source code escrow");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].c.flags.sourceCodeEscrow).toBe(true);
    expect(describeFilters({ capMaxUSD: 1e6, governingLaw: ["Delaware"] }).map((c) => c.label)).toEqual(["Liability cap ≤ $1M", "Governing law: Delaware"]);
  });

  it("matches nothing it should not", () => {
    const c = all.find((x) => x.cap.amountUSD && x.cap.amountUSD > 1e6)!;
    expect(matches(c, { capMaxUSD: 1e6 })).toBe(false);
    expect(matches(c, { capMinUSD: 1e6 })).toBe(true);
  });
});

describe("jurisdiction-aware Gold Standard", () => {
  it("requires GDPR clauses only for EU/UK contracts", () => {
    expect(isEuContract("This Agreement is governed by the laws of the Republic of Ireland.")).toBe(true);
    expect(isEuContract("Processing under the GDPR.")).toBe(true);
    expect(isEuContract("governed by the laws of the State of Delaware")).toBe(false);
    const dpa = (t: string) => goldForJurisdiction(t).find((g) => g.id === "GS-DPA-01")!.required;
    expect(dpa("governed by the laws of France")).toBe(true);
    expect(dpa("governed by the laws of the State of Texas")).toBe(false);
  });
});
