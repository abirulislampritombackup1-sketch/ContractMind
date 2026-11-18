// The contract repository shipped with the site (built by scripts/repository/*.mjs from
// CUAD v1 and MAUD, and optionally SEC EDGAR). Files are loaded on first use.

export type CapType = "amount" | "fees" | "exclusion" | "none" | "other" | "uncapped";

export type CorpusContract = {
  id: string;
  dataset: "CUAD v1" | "MAUD" | "EDGAR (SEC)";
  title: string;
  contractType: string;
  parties: string[];
  date: string; // YYYY-MM-DD or ""
  governingLaw: string;
  cap: { text: string; type: CapType; amountUSD: number | null };
  renewal: string;
  noticeToEndRenewalDays: number | null;
  flags: Record<string, boolean>;
  terminationFeeUSD?: number | null;
  dealPoints?: string;
  source: string;
  sourceFile: string;
  chars: number;
  summary: string;
};

export type CorpusSource = { dataset: string; count: number; license: string; by: string; url: string };
export type Corpus = { version: number; builtAt: string; sources: CorpusSource[]; contracts: CorpusContract[] };
export type CorpusVectors = { dim: number; model: string; vectors: Int8Array; index: Map<string, number> };

const BASE = "/repository";
let corpusP: Promise<Corpus> | null = null;
let vectorsP: Promise<CorpusVectors | null> | null = null;

export function loadCorpus(): Promise<Corpus> {
  corpusP ??= fetch(`${BASE}/corpus.json`).then((r) => {
    if (!r.ok) throw new Error(`The contract repository could not be loaded (${r.status}).`);
    return r.json();
  });
  corpusP.catch(() => (corpusP = null));
  return corpusP;
}

/** Semantic vectors, if embed-corpus.mjs has been run; null means keyword search only. */
export function loadVectors(): Promise<CorpusVectors | null> {
  vectorsP ??= (async () => {
    try {
      const meta = await fetch(`${BASE}/vectors.json`);
      if (!meta.ok || !(meta.headers.get("content-type") || "").includes("json")) return null;
      const m = await meta.json();
      const bin = await fetch(`${BASE}/vectors.bin`);
      if (!bin.ok) return null;
      const vectors = new Int8Array(await bin.arrayBuffer());
      if (vectors.length !== m.count * m.dim) return null;
      return { dim: m.dim, model: m.model, vectors, index: new Map<string, number>(m.ids.map((id: string, i: number) => [id, i])) };
    } catch {
      return null;
    }
  })();
  return vectorsP;
}

/** Full contract text (stored gzip-compressed). */
export async function loadContractText(id: string): Promise<string> {
  const res = await fetch(`${BASE}/texts/${encodeURIComponent(id)}.txt.gz`);
  if (!res.ok) throw new Error(`Contract text not found (${res.status}).`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // Some servers decompress .gz on the fly; only gunzip when the gzip magic bytes are there.
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return new TextDecoder().decode(buf);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/** Cosine similarity between a query vector and contract i (vectors are normalised before quantising). */
export function cosineAt(v: CorpusVectors, i: number, q: Float32Array): number {
  const off = i * v.dim;
  let dot = 0, nn = 0;
  for (let j = 0; j < v.dim; j++) {
    const x = v.vectors[off + j];
    dot += x * q[j];
    nn += x * x;
  }
  return nn ? dot / Math.sqrt(nn) : 0;
}
