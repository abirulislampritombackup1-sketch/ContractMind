import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { REAL_SAMPLES } from "./realSamples";

const corpus = JSON.parse(fs.readFileSync(path.resolve("public/repository/corpus.json"), "utf8"));

describe("real sample contracts", () => {
  it("point at repository contracts whose text is the agreement named on the card", () => {
    expect(REAL_SAMPLES).toHaveLength(3);
    const expectInText: Record<string, RegExp> = {
      "CUAD-0242": /E\.?piphany/i,
      "CUAD-0501": /Cargill/i,
      "MAUD-0055": /Five Prime/i,
    };
    for (const s of REAL_SAMPLES) {
      const c = corpus.contracts.find((x: any) => x.id === s.id);
      expect(c, s.id).toBeTruthy();
      const text = zlib.gunzipSync(fs.readFileSync(path.resolve(`public/repository/texts/${s.id}.txt.gz`))).toString("utf8");
      expect(text.length).toBeGreaterThan(10000);
      expect(text.slice(0, 20000)).toMatch(expectInText[s.id]);
    }
  });
});
