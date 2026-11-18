#!/usr/bin/env node
// Adds material contracts (Exhibit 10 filings) from SEC EDGAR to the repository.
// NOT YET RUN: it needs your contact details for the SEC and a Gemini key.
//
//   GEMINI_API_KEY=... node scripts/repository/fetch-edgar.mjs --user-agent "Your Name your@email" [--count 4500] [--query "limitation of liability"]
//
// SEC rules (https://www.sec.gov/os/accessing-edgar-data): every request must send a
// User-Agent with a real contact, and stay under 10 requests per second. This script
// waits 150 ms between requests.
//
// Steps: 1) EDGAR full-text search for EX-10 exhibits, 2) download each exhibit and
// strip HTML, 3) Gemini Flash-Lite extracts the same metadata the CUAD records have,
// 4) records are appended to public/repository/corpus.json (re-runs skip known ids).
// Afterwards run embed-corpus.mjs again.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const UA = args["user-agent"];
const COUNT = Number(args.count || 4500);
const QUERY = args.query || '"limitation of liability"';
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_EXTRACT_MODEL || "gemini-3.5-flash-lite";
const OUT = path.resolve("public/repository");

if (!UA || !/@/.test(UA)) {
  console.error('The SEC requires a contact: --user-agent "Your Name your@email"');
  process.exit(1);
}
if (!KEY) {
  console.error("Set GEMINI_API_KEY (used to extract metadata; not saved).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sec = async (url) => {
  await sleep(150);
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,text/html,*/*" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
};
const htmlToText = (h) =>
  h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|tr|li|h\d|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

const EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" }, contractType: { type: "STRING" }, parties: { type: "ARRAY", items: { type: "STRING" } },
    date: { type: "STRING" }, governingLaw: { type: "STRING" }, capText: { type: "STRING" }, capAmountUSD: { type: "NUMBER" },
    capType: { type: "STRING", enum: ["amount", "fees", "exclusion", "none", "other"] }, uncapped: { type: "BOOLEAN" },
    terminationForConvenience: { type: "BOOLEAN" }, nonCompete: { type: "BOOLEAN" }, exclusivity: { type: "BOOLEAN" },
    changeOfControl: { type: "BOOLEAN" }, auditRights: { type: "BOOLEAN" }, noticeToEndRenewalDays: { type: "INTEGER" },
  },
  required: ["title", "contractType", "parties", "date", "governingLaw", "capText", "capAmountUSD", "capType", "uncapped", "terminationForConvenience", "nonCompete", "exclusivity", "changeOfControl", "auditRights", "noticeToEndRenewalDays"],
};

async function extract(text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Extract metadata from this contract. date = YYYY-MM-DD or "". governingLaw = the state or country only. capText = the limitation-of-liability sentence (max 400 chars) or "". capAmountUSD = the fixed dollar cap or 0. noticeToEndRenewalDays = days or -1.\n\n${text.slice(0, 60000)}` }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: EXTRACT_SCHEMA, temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts.map((p) => p.text).join(""));
}

const corpusPath = path.join(OUT, "corpus.json");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const known = new Set(corpus.contracts.map((c) => c.id));
let added = 0;

for (let from = 0; added < COUNT; from += 100) {
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(QUERY)}&forms=8-K,10-K,10-Q,S-1&from=${from}`;
  const hits = (await (await sec(url)).json())?.hits?.hits || [];
  if (!hits.length) break;
  for (const h of hits) {
    if (added >= COUNT) break;
    const [adsh, file] = String(h._id).split(":");
    const type = h._source?.file_type || "";
    if (!file || !/^EX-10/i.test(type)) continue;
    const id = `EDGAR-${adsh}-${file.replace(/\W+/g, "").slice(0, 20)}`;
    if (known.has(id)) continue;
    const cik = String(h._source?.ciks?.[0] || "").replace(/^0+/, "");
    try {
      const text = htmlToText(await (await sec(`https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, "")}/${file}`)).text());
      if (text.length < 2000) continue;
      const m = await extract(text);
      const rec = {
        id, dataset: "EDGAR (SEC)", title: m.title || h._source?.display_names?.[0] || file, contractType: m.contractType || "Material Contract",
        parties: (m.parties || []).slice(0, 6), date: /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : (h._source?.file_date || ""),
        governingLaw: m.governingLaw || "", cap: { text: m.capText || "", type: m.capType || "none", amountUSD: m.capAmountUSD > 0 ? m.capAmountUSD : null },
        renewal: "", noticeToEndRenewalDays: m.noticeToEndRenewalDays >= 0 ? m.noticeToEndRenewalDays : null,
        flags: { uncappedLiability: !!m.uncapped, capOnLiability: !!m.capText, terminationForConvenience: !!m.terminationForConvenience, nonCompete: !!m.nonCompete, exclusivity: !!m.exclusivity, changeOfControl: !!m.changeOfControl, auditRights: !!m.auditRights },
        source: `SEC EDGAR · ${adsh} · ${file}`, sourceFile: `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, "")}/${file}`, chars: text.length,
      };
      rec.summary = [`${rec.title}.`, `${rec.contractType}.`, rec.parties.length ? `Parties: ${rec.parties.join("; ")}.` : "", rec.governingLaw ? `Governing law: ${rec.governingLaw}.` : "", rec.cap.text ? `Liability cap: ${rec.cap.text.slice(0, 300)}` : ""].filter(Boolean).join(" ");
      fs.writeFileSync(path.join(OUT, "texts", `${id}.txt.gz`), zlib.gzipSync(Buffer.from(text, "utf8"), { level: 9 }));
      corpus.contracts.push(rec);
      known.add(id);
      added++;
      if (added % 25 === 0) {
        fs.writeFileSync(corpusPath, JSON.stringify(corpus)); // save progress
        console.log(`Added ${added} EDGAR contracts`);
      }
      await sleep(4000); // free-tier generation limits
    } catch (e) {
      console.warn(`Skipped ${adsh}/${file}: ${e.message}`);
    }
  }
}
const edgarCount = corpus.contracts.filter((c) => c.dataset === "EDGAR (SEC)").length;
corpus.sources = corpus.sources.filter((s) => s.dataset !== "EDGAR (SEC)");
corpus.sources.push({ dataset: "EDGAR (SEC)", count: edgarCount, license: "Public SEC filings", by: "U.S. Securities and Exchange Commission", url: "https://www.sec.gov/edgar" });
fs.writeFileSync(corpusPath, JSON.stringify(corpus));
console.log(`Done: ${added} added, ${corpus.contracts.length} contracts in total. Now run embed-corpus.mjs.`);
