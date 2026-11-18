#!/usr/bin/env node
// Builds the contract repository from the public CUAD v1 and MAUD datasets
// (The Atticus Project, CC BY 4.0).
//
//   node scripts/repository/build-corpus.mjs --cuad <CUAD_v1 folder> --maud <MAUD data folder> [--cuad-zip <CUAD_v1.zip>]
//
//   --cuad      folder containing master_clauses.csv and full_contract_txt/
//   --cuad-zip  optional: the original CUAD_v1.zip, used only to read each PDF's folder (contract type)
//   --maud      folder containing contracts/*.txt and MAUD_train/dev/test.csv
//
// Writes:
//   public/repository/corpus.json        one record per contract (metadata + key-terms summary)
//   public/repository/texts/<id>.txt.gz  full contract text, gzip-compressed
//
// No API calls and no dependencies: metadata comes from the datasets' expert labels, plus
// simple pattern matching for amounts, dates and governing law.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const OUT = path.resolve("public/repository");
const TEXTS = path.join(OUT, "texts");

// ── CSV (RFC 4180: quotes, commas and newlines inside fields) ──────────────────
function parseCsv(src) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// ── Normalisers ──────────────────────────────────────────────────────────────
const US_STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const COUNTRIES = ["England and Wales","England","United Kingdom","Scotland","Ireland","Germany","France","Netherlands","Switzerland","Sweden","Denmark","Spain","Italy","Belgium","Luxembourg","Austria","Finland","Norway","Canada","Ontario","British Columbia","Quebec","Hong Kong","Singapore","China","Japan","Korea","India","Israel","Australia","Brazil","Mexico","Cayman Islands","Bermuda"];
const EU = new Set(["Ireland","Germany","France","Netherlands","Sweden","Denmark","Spain","Italy","Belgium","Luxembourg","Austria","Finland"]);

function normalizeLaw(text) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ");
  // Prefer "laws of the State of X" / "laws of X"
  const m = t.match(/laws? of (?:the )?(?:State|Commonwealth|Province) of ([A-Z][A-Za-z ]+?)(?:[,.;)]| without| and| applicable| excluding| \(|$)/);
  const cand = m ? m[1].trim() : t;
  for (const s of US_STATES) if (new RegExp(`\\b${s}\\b`).test(cand)) return s === "Washington" && /D\.?C\.?|District/.test(cand) ? "District of Columbia" : s;
  for (const c of COUNTRIES) if (new RegExp(`\\b${c}\\b`, "i").test(cand)) return c === "England" ? "England and Wales" : c;
  for (const s of US_STATES) if (new RegExp(`\\b${s}\\b`).test(t)) return s;
  for (const c of COUNTRIES) if (new RegExp(`\\b${c}\\b`, "i").test(t)) return c === "England" ? "England and Wales" : c;
  return "";
}

function lawFromText(text) {
  const m = text.slice(0, 400000).match(/governed by[^.]{0,200}?laws? of[^.]{0,120}/i);
  return m ? normalizeLaw(m[0]) : "";
}

function isoDate(s) {
  if (!s) return "";
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? (Number(m[3]) > 40 ? 1900 : 2000) + Number(m[3]) : Number(m[3]);
    return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d) || d.getFullYear() < 1950 ? "" : d.toISOString().slice(0, 10);
}

const MULT = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, mm: 1e6, billion: 1e9, bn: 1e9, b: 1e9 };
/** Dollar amounts in a text, in USD. */
function dollarAmounts(text) {
  const out = [];
  const re = /(?:US\$|USD\s?|\$)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(thousand|million|billion|mm|bn|k|m|b)?\b/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : ""));
    const mult = m[3] ? MULT[m[3].toLowerCase()] || 1 : 1;
    if (Number.isFinite(n)) out.push(n * mult);
  }
  return out;
}

/** Liability cap: fixed amount, a multiple/period of fees, or unclear. */
function parseCap(capText, uncapped) {
  const t = capText.replace(/\s+/g, " ");
  if (!t) return { text: "", type: uncapped ? "uncapped" : "none", amountUSD: null };
  const amounts = dollarAmounts(t).filter((n) => n >= 100);
  const feesBased = /(fees|amounts?|sums?|charges|consideration|price)[^.]{0,80}(paid|payable|received)|(\d+|twelve|six|three|one)\s*\(?\d*\)?\s*months?/i.test(t);
  return {
    text: t.slice(0, 600),
    // CUAD's "Cap On Liability" label also covers clauses that only exclude indirect damages.
    type: amounts.length ? "amount" : feesBased ? "fees" : /consequential|indirect|incidental|punitive|special damages/i.test(t) ? "exclusion" : "other",
    amountUSD: amounts.length ? Math.max(...amounts) : null,
  };
}

const yes = (v) => /^yes$/i.test((v || "").trim());
const clean = (v) => (v || "").replace(/^\[|\]$/g, "").replace(/^'|'$/g, "").replace(/', '/g, " … ").replace(/\s+/g, " ").trim();

function noticeDays(s) {
  const m = (s || "").match(/(\d+)\s*(day|month|year)/i);
  if (!m) return null;
  return Number(m[1]) * ({ day: 1, month: 30, year: 365 }[m[2].toLowerCase()]);
}

// CUAD clause labels we keep as yes/no flags (label → short key)
const FLAGS = {
  "Termination For Convenience": "terminationForConvenience",
  "Non-Compete": "nonCompete",
  "Exclusivity": "exclusivity",
  "Change Of Control": "changeOfControl",
  "Anti-Assignment": "antiAssignment",
  "Audit Rights": "auditRights",
  "Most Favored Nation": "mostFavoredNation",
  "Ip Ownership Assignment": "ipAssignment",
  "Source Code Escrow": "sourceCodeEscrow",
  "Insurance": "insurance",
  "Liquidated Damages": "liquidatedDamages",
  "Warranty Duration": "warranty",
  "Minimum Commitment": "minimumCommitment",
  "Revenue/Profit Sharing": "revenueSharing",
  "No-Solicit Of Employees": "noSolicitEmployees",
  "Covenant Not To Sue": "covenantNotToSue",
  "Post-Termination Services": "postTerminationServices",
  "Uncapped Liability": "uncappedLiability",
  "Cap On Liability": "capOnLiability",
};
const answerOf = (row, label) => row[`${label}-Answer`] ?? row[`${label}- Answer`] ?? "";

function writeText(id, text) {
  fs.writeFileSync(path.join(TEXTS, `${id}.txt.gz`), zlib.gzipSync(Buffer.from(text, "utf8"), { level: 9 }));
}

function summaryOf(r) {
  const flags = Object.entries(r.flags).filter(([, v]) => v).map(([k]) => k);
  return [
    `${r.title}.`,
    `${r.contractType}.`,
    r.parties.length ? `Parties: ${r.parties.join("; ")}.` : "",
    r.governingLaw ? `Governing law: ${r.governingLaw}.` : "",
    r.cap.text ? `Liability cap: ${r.cap.text.slice(0, 300)}` : r.flags.uncappedLiability ? "Liability: uncapped." : "",
    r.renewal ? `Renewal: ${r.renewal}.` : "",
    flags.length ? `Clauses: ${flags.join(", ")}.` : "",
    r.dealPoints ? `Deal: ${r.dealPoints}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1400);
}

// ── CUAD ─────────────────────────────────────────────────────────────────────
function folderTypes(zipPath) {
  // Reads file names from the zip's central directory (no extraction needed).
  const map = new Map();
  if (!zipPath || !fs.existsSync(zipPath)) return map;
  const buf = fs.readFileSync(zipPath);
  let eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let off = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(off + 28), extra = buf.readUInt16LE(off + 30), comment = buf.readUInt16LE(off + 32);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString("utf8");
    const m = name.match(/full_contract_pdf\/Part_[^/]+\/([^/]+)\/(.+)\.pdf$/i);
    if (m) map.set(m[2], m[1].replace(/_/g, " ").replace(/\bAgreements\b/, "Agreement").trim());
    off += 46 + nameLen + extra + comment;
  }
  return map;
}

function buildCuad(dir, zip) {
  const csvPath = path.join(dir, "master_clauses.csv");
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const types = folderTypes(zip);
  const txtDir = path.join(dir, "full_contract_txt");
  const txtFiles = new Map(fs.readdirSync(txtDir).map((f) => [f.replace(/\.txt$/i, ""), f]));
  const out = [];
  rows.forEach((row, i) => {
    const base = row.Filename.replace(/\.pdf$/i, "");
    const txt = txtFiles.get(base);
    if (!txt) return;
    const text = fs.readFileSync(path.join(txtDir, txt), "utf8");
    const id = `CUAD-${String(i + 1).padStart(4, "0")}`;
    const flags = Object.fromEntries(Object.entries(FLAGS).map(([label, key]) => [key, yes(answerOf(row, label))]));
    const lawAnswer = answerOf(row, "Governing Law");
    const rec = {
      id,
      dataset: "CUAD v1",
      title: clean(answerOf(row, "Document Name")) || base.split("_").pop(),
      contractType: types.get(base) || base.split("_").pop().replace(/\s+/g, " "),
      parties: clean(answerOf(row, "Parties")).split(/;\s*/).map((p) => p.replace(/\s*\([^)]*\)/g, "").trim()).filter(Boolean).slice(0, 6),
      date: isoDate(answerOf(row, "Agreement Date")) || isoDate(answerOf(row, "Effective Date")),
      governingLaw: normalizeLaw(lawAnswer) || normalizeLaw(clean(row["Governing Law"])) || lawFromText(text),
      cap: parseCap(clean(row["Cap On Liability"]), flags.uncappedLiability),
      renewal: clean(answerOf(row, "Renewal Term")).slice(0, 160),
      noticeToEndRenewalDays: noticeDays(answerOf(row, "Notice Period To Terminate Renewal")),
      flags,
      source: `CUAD v1 · ${row.Filename}`,
      sourceFile: row.Filename,
      chars: text.length,
    };
    rec.summary = summaryOf(rec);
    writeText(id, text);
    out.push(rec);
  });
  return out;
}

// ── MAUD ─────────────────────────────────────────────────────────────────────
// MAUD's raw/main.csv names the deals, but its anonymised numbering does not match the
// contracts/*.txt files. So parties and date are read from each agreement's own preamble,
// and deal points come from the train/dev/test files, which use the same numbering as the texts.
// "by and among Microsoft Corporation, a Washington corporation ("Parent"), Big Sky Merger
// Sub Inc., ... ("Merger Sub"), and Nuance Communications, Inc., ... (the "Company")"
const PARTY = /(?:^|,\s*|\band\s+|\bamong\s+|\bbetween\s+)([A-Z][A-Za-z0-9&.'’\- ]{1,80}?(?:,\s*(?:Inc|Ltd|L\.?L\.?C|Corp|N\.V|S\.A|plc|L\.P)\.?)?),\s+(?:an?\s+|a\s+)[^()]{3,160}?\((?:the\s+|together[^“"]*)?[“"]([A-Za-z ]{2,30})[”"]/g;

function preamble(text) {
  const flat = text.slice(0, 40000).replace(/\s+/g, " ");
  // Skip the cover page and table of contents: anchor on the first defined role, e.g. ("Parent").
  const roleAt = flat.search(/\((?:the\s+)?[“"](?:Parent|Company|Buyer|Purchaser|Merger Sub)[”"]\)/);
  const intro = roleAt >= 0 ? flat.lastIndexOf(" among ", roleAt) : -1;
  const from = intro >= 0 && roleAt - intro < 1500 ? intro : roleAt >= 0 ? Math.max(0, roleAt - 600) : 0;
  const seg = flat.slice(from, from + 2200);
  // Each party is followed by its defined role in quotes; the name is the text just before
  // ", a <jurisdiction> corporation ...". Walk the role markers in order.
  const ROLE = /\((?:the\s+|together with[^“"]*|collectively[^“"]*)?[“"](Parent|Company|Merger Sub|Merger Subsidiary|Sub|Buyer|Purchaser|Acquiror|Acquirer|Holdings|Merger Sub I|Merger Sub II|Guarantor|Seller)[”"]/g;
  const parties = [];
  let prev = 0;
  for (const m of seg.matchAll(ROLE)) {
    const window = seg.slice(prev, m.index);
    prev = m.index + m[0].length;
    const last = window.split(/\),?\s*(?:and\s+)?/).pop() || window;
    const name = last
      .replace(/^.*?\b(?:by and among|among|between)\s+/i, "")
      .replace(/^[\s,;]*(?:and\s+)?/i, "")
      .split(/,\s+(?:an?|the)\s+/i)[0]
      .replace(/[,\s]+$/, "")
      .trim();
    const junk = /\b(is|are|made|entered|into|dated|this|hereto|agreement|plan of merger)\b/i.test(name);
    if (!junk && name.length > 2 && name.length < 90 && !parties.some((x) => x.name === name)) parties.push({ name, role: m[1] });
    if (parties.length >= 5) break;
  }
  const dateM = seg.match(/(?:dated|entered into|made)(?: and entered into)? as of ([A-Z][a-z]+ \d{1,2}, \d{4})/i) || flat.slice(0, 6000).match(/Dated as of ([A-Z][a-z]+ \d{1,2}, \d{4})/i);
  const d = dateM ? new Date(`${dateM[1]} UTC`) : null;
  const role = (re) => parties.find((p) => re.test(p.role))?.name;
  const target = role(/^company$/i);
  const buyer = role(/^(parent|buyer|purchaser|acquiror|acquirer)$/i);
  return {
    names: parties.map((p) => p.name),
    target,
    buyer,
    date: d && !isNaN(d) ? d.toISOString().slice(0, 10) : "",
  };
}

function maudAnswers(dir) {
  const byContract = new Map();
  for (const f of ["MAUD_train.csv", "MAUD_dev.csv", "MAUD_test.csv"]) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    for (const r of parseCsv(fs.readFileSync(p, "utf8"))) {
      if (r.data_type !== "main" || !r.answer) continue;
      const m = byContract.get(r.contract_name) || {};
      if (r.question && r.answer && !m[r.question]) m[r.question] = r.answer;
      byContract.set(r.contract_name, m);
    }
  }
  return byContract;
}

function buildMaud(dir) {
  const answers = maudAnswers(dir);
  const files = fs.readdirSync(path.join(dir, "contracts")).filter((f) => /^contract_\d+\.txt$/.test(f));
  const out = [];
  for (const f of files) {
    const name = f.replace(/\.txt$/, "");
    const text = fs.readFileSync(path.join(dir, "contracts", f), "utf8");
    const n = Number(name.replace(/\D/g, ""));
    const id = `MAUD-${String(n).padStart(4, "0")}`;
    const pre = preamble(text);
    const a = answers.get(name) || {};
    const fee = text.match(/Termination Fee[^.]{0,300}?\$\s?[\d,.]+\s*(?:million|billion)?/i);
    const feeUSD = fee ? Math.max(0, ...dollarAmounts(fee[0])) || null : null;
    const consideration = clean(a["Type of Consideration-Answer"] || "");
    const tail = clean(a["Tail Period Length-Answer"] || "");
    const rec = {
      id,
      dataset: "MAUD",
      title: pre.target && pre.buyer ? `Merger Agreement — ${pre.target} acquired by ${pre.buyer}` : pre.names.length >= 2 ? `Merger Agreement — ${pre.names.join(" / ")}` : `Merger Agreement (MAUD ${name})`,
      contractType: "Merger Agreement",
      parties: pre.names,
      date: pre.date,
      governingLaw: lawFromText(text),
      cap: { text: "", type: "none", amountUSD: null },
      renewal: "",
      noticeToEndRenewalDays: null,
      flags: { changeOfControl: true, terminationFee: !!fee },
      terminationFeeUSD: feeUSD,
      dealPoints: [consideration && `consideration: ${consideration}`, tail && `tail period: ${tail}`, feeUSD && `termination fee about $${Math.round(feeUSD).toLocaleString("en-US")}`]
        .filter(Boolean)
        .join("; "),
      source: `MAUD · ${name}`,
      sourceFile: `${name}.txt`,
      chars: text.length,
    };
    rec.summary = summaryOf(rec);
    writeText(id, text);
    out.push(rec);
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────
if (!args.cuad && !args.maud) {
  console.error("Usage: node scripts/repository/build-corpus.mjs --cuad <CUAD_v1 folder> --maud <MAUD data folder> [--cuad-zip <CUAD_v1.zip>]");
  process.exit(1);
}
fs.mkdirSync(TEXTS, { recursive: true });
const contracts = [...(args.cuad ? buildCuad(args.cuad, args["cuad-zip"]) : []), ...(args.maud ? buildMaud(args.maud) : [])];
const corpus = {
  version: 1,
  builtAt: new Date().toISOString(),
  sources: [
    { dataset: "CUAD v1", count: contracts.filter((c) => c.dataset === "CUAD v1").length, license: "CC BY 4.0", by: "The Atticus Project", url: "https://www.atticusprojectai.org/cuad" },
    { dataset: "MAUD", count: contracts.filter((c) => c.dataset === "MAUD").length, license: "CC BY 4.0", by: "The Atticus Project", url: "https://github.com/TheAtticusProject/maud" },
  ],
  contracts,
};
fs.writeFileSync(path.join(OUT, "corpus.json"), JSON.stringify(corpus));
const capped = contracts.filter((c) => c.cap.amountUSD).length;
const laws = contracts.filter((c) => c.governingLaw).length;
console.log(`Wrote ${contracts.length} contracts (${capped} with a dollar liability cap, ${laws} with governing law) to ${OUT}`);
