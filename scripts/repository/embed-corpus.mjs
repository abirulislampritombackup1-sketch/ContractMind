#!/usr/bin/env node
// Embeds every contract's key-terms summary so the Library can search by meaning.
// Run once after build-corpus.mjs, with your own Gemini key (never committed):
//
//   GEMINI_API_KEY=... node scripts/repository/embed-corpus.mjs
//   (PowerShell:  $env:GEMINI_API_KEY="..."; node scripts/repository/embed-corpus.mjs)
//
// Writes public/repository/vectors.bin (int8, DIM values per contract, in corpus order)
// and public/repository/vectors.json (model, dimension, scale, ids). Without these files
// the Library still works, using keyword ranking plus filters.

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const DIM = Number(process.env.REPO_EMBEDDING_DIM || 256);
const BATCH = 100;
const OUT = path.resolve("public/repository");

if (!KEY) {
  console.error("Set GEMINI_API_KEY first (it is only used for this run and is not saved).");
  process.exit(1);
}
const corpus = JSON.parse(fs.readFileSync(path.join(OUT, "corpus.json"), "utf8"));
const items = corpus.contracts;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(texts) {
  const body = JSON.stringify({
    requests: texts.map((text) => ({ model: `models/${MODEL}`, content: { parts: [{ text }] }, taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: DIM })),
  });
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt) await sleep(Math.min(60000, 2000 * 2 ** attempt));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.embeddings?.length !== texts.length) throw new Error("Wrong number of vectors returned.");
      return data.embeddings.map((e) => e.values);
    }
    const detail = await res.text();
    if (![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`Embedding failed (${res.status}): ${detail.slice(0, 300)}`);
    console.warn(`  ${res.status}, retrying…`);
  }
  throw new Error("Embedding kept failing; try again later.");
}

const vectors = [];
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  vectors.push(...(await embedBatch(batch.map((c) => c.summary))));
  console.log(`Embedded ${Math.min(i + BATCH, items.length)} / ${items.length}`);
  await sleep(1500); // stay well inside free-tier per-minute limits
}

// L2-normalise, then quantise to int8 with one shared scale (cosine is preserved up to rounding).
const norm = vectors.map((v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
});
const maxAbs = Math.max(...norm.flat().map(Math.abs)) || 1;
const scale = 127 / maxAbs;
const bin = new Int8Array(items.length * DIM);
norm.forEach((v, i) => v.forEach((x, j) => (bin[i * DIM + j] = Math.max(-127, Math.min(127, Math.round(x * scale))))));
fs.writeFileSync(path.join(OUT, "vectors.bin"), Buffer.from(bin.buffer));
fs.writeFileSync(
  path.join(OUT, "vectors.json"),
  JSON.stringify({ model: MODEL, dim: DIM, scale, count: items.length, builtAt: new Date().toISOString(), ids: items.map((c) => c.id) })
);
console.log(`Wrote vectors for ${items.length} contracts (${(bin.byteLength / 1024).toFixed(0)} KB).`);
