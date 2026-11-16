import { describe, expect, it } from "vitest";
import { christianShares, faraid, Fr, hinduShares, Result } from "./faraid";

const val = (f: Fr) => f.n / f.d;
const sum = (r: Result) => r.rows.reduce((s, row) => s + val(row.total), 0);
const share = (r: Result, who: string) => r.rows.find((x) => x.who === who)!;
const base = { deceasedMale: true, spouses: 0, sons: 0, daughters: 0, father: false, mother: false, siblings: 0 };

describe("faraid (Muslim inheritance)", () => {
  it("wife + son + daughter: wife 1/8, rest split 2:1", () => {
    const r = faraid({ ...base, spouses: 1, sons: 1, daughters: 1 });
    expect(r.ok).toBe(true);
    expect(share(r, "স্ত্রী").total).toEqual({ n: 1, d: 8 });
    expect(share(r, "ছেলে").total).toEqual({ n: 7, d: 12 });
    expect(share(r, "মেয়ে").total).toEqual({ n: 7, d: 24 });
    expect(sum(r)).toBeCloseTo(1);
  });

  it("husband + father + mother, no children: mother gets a third of the remainder", () => {
    const r = faraid({ ...base, deceasedMale: false, spouses: 1, father: true, mother: true });
    expect(share(r, "স্বামী").total).toEqual({ n: 1, d: 2 });
    expect(share(r, "মা").total).toEqual({ n: 1, d: 6 });
    expect(share(r, "পিতা").total).toEqual({ n: 1, d: 3 });
    expect(sum(r)).toBeCloseTo(1);
  });

  it("applies awl when fixed shares exceed the estate", () => {
    const r = faraid({ ...base, deceasedMale: false, spouses: 1, daughters: 2, father: true, mother: true });
    expect(r.notes.some((n) => n.includes("আউল"))).toBe(true);
    expect(sum(r)).toBeCloseTo(1);
  });

  it("shows a remainder row when only daughters inherit and there is no father", () => {
    const r = faraid({ ...base, spouses: 1, daughters: 1 });
    expect(sum(r)).toBeCloseTo(1);
    expect(r.rows.some((x) => x.who.startsWith("অবশিষ্ট"))).toBe(true);
  });

  it("splits each heir's share by head count", () => {
    const r = faraid({ ...base, spouses: 2, sons: 3 });
    const wives = share(r, "স্ত্রী");
    expect(val(wives.each) * 2).toBeCloseTo(val(wives.total));
    expect(sum(r)).toBeCloseTo(1);
  });

  it("refuses cases it does not cover", () => {
    expect(faraid({ ...base, spouses: 1 }).ok).toBe(false); // no children, no father
    expect(faraid({ ...base, spouses: 5, sons: 1 }).ok).toBe(false);
    expect(faraid({ ...base, deceasedMale: false, spouses: 2, sons: 1 }).ok).toBe(false);
  });

  it("totals 1 across many common families", () => {
    for (const spouses of [0, 1, 2])
      for (const sons of [0, 1, 3])
        for (const daughters of [0, 1, 2])
          for (const father of [false, true])
            for (const mother of [false, true]) {
              const r = faraid({ ...base, spouses, sons, daughters, father, mother });
              if (r.ok) expect(sum(r)).toBeCloseTo(1);
            }
  });
});

describe("Hindu and Christian shares", () => {
  it("Hindu: widow takes one son's share; daughters take none when sons exist", () => {
    const r = hinduShares({ spouses: 1, sons: 2, daughters: 1 });
    expect(r.ok).toBe(true);
    expect(sum(r)).toBeCloseTo(1);
    expect(share(r, "বিধবা স্ত্রী").total).toEqual({ n: 1, d: 3 });
    expect(hinduShares({ spouses: 1, sons: 0, daughters: 2 }).ok).toBe(false);
  });

  it("Christian: widow 1/3, children share the rest equally", () => {
    const r = christianShares({ spouses: 1, sons: 1, daughters: 1 });
    expect(share(r, "বিধবা স্ত্রী").total).toEqual({ n: 1, d: 3 });
    expect(share(r, "ছেলে").each).toEqual(share(r, "মেয়ে").each);
    expect(sum(r)).toBeCloseTo(1);
  });
});
