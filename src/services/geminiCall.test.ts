import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setSleepForTests, callGemini, GeminiStatus, onGeminiStatus, retryDelayMs } from "./gemini";
import { __clearQueryCache, embedQueriesCached } from "../rag/embedder";

const ok = () => new Response(JSON.stringify({ candidates: [] }), { status: 200 });
const busy = () => new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 503 });
const limited = (s: string) =>
  new Response(JSON.stringify({ error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: s }] } }), { status: 429 });

let waits: number[];
let calls: string[];
const realFetch = globalThis.fetch;

function stubFetch(responses: (() => Response)[]) {
  globalThis.fetch = vi.fn(async (url: any) => {
    calls.push(String(url).match(/models\/([^:]+):/)?.[1] || String(url));
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next();
  }) as any;
}

beforeEach(() => {
  waits = [];
  calls = [];
  __setSleepForTests(async (ms) => {
    waits.push(ms);
  });
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Gemini retries", () => {
  it("retries an overloaded (503) model before falling back, and reports the wait", async () => {
    const seen: GeminiStatus[] = [];
    const off = onGeminiStatus((s) => seen.push(s));
    stubFetch([busy, busy, ok]);
    const { res, model } = await callGemini({ contents: [] });
    off();
    expect(res.status).toBe(200);
    expect(model).toBe("gemini-3.5-flash");
    expect(calls).toEqual(["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash"]);
    expect(waits).toHaveLength(2);
    expect(waits[1]).toBeGreaterThan(waits[0]); // exponential backoff
    expect(seen.map((s) => s.state)).toEqual(["waiting", "ok", "waiting", "ok", "ok"]); // notice hides during each retry
  });

  it("moves to the backup model after three overloaded answers", async () => {
    stubFetch([busy, busy, busy, ok]);
    const { model } = await callGemini({ contents: [] });
    expect(model).toBe("gemini-3.5-flash-lite");
    expect(calls).toEqual(["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]);
  });

  it("waits as long as Google asks on a 429, then retries the same model", async () => {
    stubFetch([() => limited("3s"), ok]);
    const { model } = await callGemini({ contents: [] });
    expect(model).toBe("gemini-3.5-flash");
    expect(waits[0]).toBeGreaterThanOrEqual(3000);
    expect(waits[0]).toBeLessThan(3600);
  });

  it("does not wait out a long rate limit; it uses the backup model instead", async () => {
    stubFetch([() => limited("90s"), ok]);
    const { model } = await callGemini({ contents: [] });
    expect(waits).toEqual([]);
    expect(model).toBe("gemini-3.5-flash-lite");
  });

  it("sends light tasks to the lite model first", async () => {
    stubFetch([ok]);
    const { model } = await callGemini({ contents: [] }, { lite: true });
    expect(model).toBe("gemini-3.5-flash-lite");
  });

  it("returns non-retryable errors straight away", async () => {
    stubFetch([() => new Response("{}", { status: 400 })]);
    const { res } = await callGemini({ contents: [] });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it("reads the wait from Retry-After or the error body", async () => {
    expect(await retryDelayMs(new Response("{}", { status: 429, headers: { "Retry-After": "12" } }))).toBe(12000);
    expect(await retryDelayMs(limited("7.5s"))).toBe(7500);
    expect(await retryDelayMs(new Response("{}", { status: 429 }))).toBeNull();
  });
});

describe("query embedding cache", () => {
  it("embeds a query once and reuses it", async () => {
    __clearQueryCache();
    let requests = 0;
    const fetchImpl = (async (_url: any, init: any) => {
      requests++;
      const n = JSON.parse(init.body).requests.length;
      return new Response(JSON.stringify({ embeddings: Array.from({ length: n }, (_, i) => ({ values: [1, i + 1, 0] })) }), { status: 200 });
    }) as any;
    const a = await embedQueriesCached(["liability cap", "termination"], { fetchImpl });
    const b = await embedQueriesCached(["termination", "liability cap"], { fetchImpl });
    expect(requests).toBe(1);
    expect([...b[1]]).toEqual([...a[0]]);
    await embedQueriesCached(["liability cap", "audit rights"], { fetchImpl });
    expect(requests).toBe(2); // only the new query was embedded
  });
});

describe("embedding batches and rate limits", () => {
  it("keeps each embedding request under the per-minute token limit", async () => {
    const { batchesOf } = await import("../rag/embedder");
    const long = Array.from({ length: 100 }, () => "x".repeat(2000)); // ~50K tokens in one batch
    const b = batchesOf(long, 100);
    expect(b.length).toBeGreaterThan(1);
    expect(b.every((x) => x.reduce((s, t) => s + t.length, 0) <= 60000)).toBe(true);
    expect(b.flat()).toHaveLength(100);
  });

  it("waits as long as the 429 says before retrying an embedding", async () => {
    const { embedTexts } = await import("../rag/embedder");
    const slept: number[] = [];
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      if (n === 1) return new Response(JSON.stringify({ error: { message: "Quota exceeded. Please retry in 35.7s." } }), { status: 429 });
      return new Response(JSON.stringify({ embeddings: [{ values: [1, 0] }] }), { status: 200 });
    }) as any;
    const v = await embedTexts(["a"], "RETRIEVAL_DOCUMENT", { fetchImpl, sleep: async (ms) => void slept.push(ms) });
    expect(v).toHaveLength(1);
    expect(slept[0]).toBeGreaterThanOrEqual(35700);
  });
});
