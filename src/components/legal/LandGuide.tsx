import Thinking from "./Thinking";
import { useState } from "react";
import { AlertTriangle, Copy, Plus, Trash2 } from "lucide-react";
import { faraid, hinduShares, christianShares, fmt } from "../../legal/faraid";
import { askLand, readKhatian, type ChatMsg } from "../../services/legalAssist";

const STEPS = [
  { t: "ওয়ারিশদের তথ্য সাজান", w: "নিজের ঘরে", d: "মৃত ব্যক্তির সব ওয়ারিশের নাম, জাতীয় পরিচয়পত্র নম্বর, ঠিকানা আর সম্পর্ক লিখে রাখুন। একজন বাদ পড়লে আবেদন নামঞ্জুর হতে পারে।" },
  { t: "মৃত্যুসনদ নিন", w: "সাধারণত ইউনিয়ন পরিষদ / পৌরসভা / সিটি করপোরেশন", d: "মৃত্যুসনদ না থাকলে আগে সেটা করিয়ে নিন।" },
  { t: "ওয়ারিশ সনদ নিন", w: "ইউনিয়ন পরিষদের চেয়ারম্যান / পৌর মেয়র / ওয়ার্ড কাউন্সিলর", d: "এই সনদ শুধু বলে কে কে ওয়ারিশ। কে কতটুকু পাবেন তা উত্তরাধিকার আইন ঠিক করে। চেয়ারম্যান না থাকলে দেরি হতে পারে, তাই আগে খোঁজ নিন।" },
  { t: "আগের খতিয়ান ও দাগের তথ্য জোগাড় করুন", w: "পুরনো কাগজ থেকে", d: "মৃত ব্যক্তির নামের খতিয়ানের কপি, মৌজা আর দাগ নম্বর হাতে রাখুন।" },
  { t: "অনলাইনে ই-নামজারির আবেদন করুন", w: "mutation.land.gov.bd (সহকারী কমিশনার ভূমি-র কাছে)", d: "কাগজের ছবি বা PDF যুক্ত করুন। সরকারি ফি অনলাইনে দিতে হয়, কাউকে আলাদা টাকা দেওয়ার নিয়ম নেই। সাধারণত ২৮ কর্মদিবসে নিষ্পত্তির বিধান আছে।" },
  { t: "আবেদনের অবস্থা অনুসরণ করুন", w: "অনলাইনে, প্রয়োজনে উপজেলা ভূমি অফিস", d: "আবেদনের নম্বর সংরক্ষণ করুন। কাগজ চাইলে বা সংশোধন বললে ঠিকমতো জমা দিন।" },
];
const LAW: Record<string, string> = { muslim: "মুসলিম উত্তরাধিকার আইন (ফারায়েজ)", hindu: "হিন্দু দায়ভাগ আইন ও ১৯৩৭ সালের হিন্দু নারীর সম্পত্তির অধিকার আইন", christian: "উত্তরাধিকার আইন, ১৯২৫", other: "আলাদা বা প্রচলিত নিয়ম থাকতে পারে" };
type Heir = { name: string; nid: string; rel: string };

export default function LandGuide() {
  const [deceased, setDeceased] = useState(""), [land, setLand] = useState("");
  const [heirs, setHeirs] = useState<Heir[]>([{ name: "", nid: "", rel: "" }, { name: "", nid: "", rel: "" }]);
  const [copied, setCopied] = useState(false);
  const [rel, setRel] = useState("muslim"), [male, setMale] = useState(true), [sp, setSp] = useState(1), [sons, setSons] = useState(0), [dau, setDau] = useState(0);
  const [fa, setFa] = useState(false), [mo, setMo] = useState(false), [sib, setSib] = useState(0), [qty, setQty] = useState(""), [unit, setUnit] = useState("শতক");
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const notMale = { ok: false, message: "এই ধর্মের জন্য এই ক্যালকুলেটর শুধু পুরুষ মৃত ব্যক্তির ক্ষেত্রে কাজ করে। আইনজীবীর সাথে কথা বলুন।", rows: [], notes: [] };
  const calc = rel === "muslim" ? faraid({ deceasedMale: male, spouses: sp, sons, daughters: dau, father: fa, mother: mo, siblings: sib })
    : rel === "hindu" ? (male ? hinduShares({ spouses: sp, sons, daughters: dau }) : notMale)
    : rel === "christian" ? (male ? christianShares({ spouses: sp, sons, daughters: dau }) : notMale) : null;
  const total = Number(qty) > 0 ? Number(qty) : 0;
  const hue = (i: number) => `hsl(${(i * 67 + 150) % 360} 60% 55%)`;
  const [kFile, setKFile] = useState<File | null>(null), [kOut, setKOut] = useState(""), [kBusy, setKBusy] = useState(false);
  async function readK() {
    if (!kFile || kBusy) return; setKBusy(true); setKOut("");
    try { setKOut(await readKhatian(kFile)); }
    catch (e: any) { setKOut("⚠ " + (e.message || "পড়া যায়নি।")); }
    finally { setKBusy(false); }
  }
  const [chat, setChat] = useState<ChatMsg[]>([]), [q, setQ] = useState(""), [asking, setAsking] = useState(false);

  const setHeir = (i: number, k: keyof Heir, v: string) => setHeirs(h => h.map((x, j) => j === i ? { ...x, [k]: v } : x));
  async function copy() {
    const rows = heirs.filter(h => h.name.trim()).map((h, i) => `${i + 1}. ${h.name} | সম্পর্ক: ${h.rel || "—"} | NID: ${h.nid || "—"}`).join("\n");
    const out = `মৃত ব্যক্তি: ${deceased || "—"}\nজমির বিবরণ (মৌজা/দাগ/খতিয়ান): ${land || "—"}\nওয়ারিশগণ:\n${rows || "—"}`;
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  async function ask() {
    const question = q.trim(); if (!question || asking) return;
    const h = chat; setChat([...h, { role: "user", text: question }, { role: "ai", text: "" }]); setQ(""); setAsking(true);
    const upd = (t: string) => setChat(c => c.map((m, i) => i === c.length - 1 ? { ...m, text: t } : m));
    try { upd(await askLand(h, question)); }
    catch (e: any) { upd("⚠ " + (e.message || "উত্তর আনা যায়নি।")); }
    finally { setAsking(false); }
  }

  return <div className="legalPage">
    <div className="notice warn"><AlertTriangle size={17} />এটি সাধারণ তথ্য, আইনি পরামর্শ নয়। নিয়ম ও ফি বদলাতে পারে, তাই আবেদনের আগে সরকারি সাইট বা ভূমি অফিস থেকে মিলিয়ে নিন।</div>
    <section className="panel">
      <div className="panelHead"><div><h2>বাবা বা পূর্বপুরুষের জমি ওয়ারিশদের নামে নিন</h2><p>ওয়ারিশ সূত্রে নামজারির ধাপগুলো, দালাল ছাড়া।</p></div></div>
      {STEPS.map((s, i) => <div className="lstep" key={i}><span className="n">{String(i + 1).padStart(2, "0")}</span><div><b>{s.t}</b><small>কোথায়: {s.w}</small><p>{s.d}</p></div></div>)}
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>জমির রেকর্ডে এখন কার নাম, দেখুন</h2><p>মৌজা আর দাগ নম্বর দিয়ে সরকারি পোর্টালে খতিয়ান খুঁজুন, তারপর এখানে পড়ান।</p></div></div>
      <div className="lstep"><span className="n">১</span><div><b>সরকারি পোর্টাল খুলুন</b><p>dlrms.land.gov.bd বা eporcha.gov.bd (বিকল্প: settlement.gov.bd/Khatian)। টাকা বা তথ্য দেওয়ার আগে ঠিকানায় শুধু .gov.bd আছে কিনা দেখুন, ই-পর্চার নামে ভুয়া সাইট আছে।</p></div></div>
      <div className="lstep"><span className="n">২</span><div><b>জমি খুঁজুন</b><p>বিভাগ, জেলা, উপজেলা, মৌজা বেছে দাগ নম্বর বা খতিয়ান নম্বর দিন। পুরনো জরিপের (সিএস, এসএ, আরএস) খতিয়ান ছাড়াও সাম্প্রতিক নামজারির খতিয়ান আছে কিনা দেখুন।</p></div></div>
      <div className="lstep"><span className="n">৩</span><div><b>খতিয়ানের স্ক্রিনশট বা PDF নিয়ে এখানে দিন</b></div></div>
      <label className="drop" style={{ minHeight: 120, marginTop: 10 }}><input type="file" accept="image/*,.pdf,application/pdf" onChange={e => { setKFile(e.target.files?.[0] || null); setKOut(""); }} /><b>{kFile ? kFile.name : "খতিয়ানের ছবি বা PDF দিন"}</b><span>ক্লিক করে বেছে নিন</span></label>
      <div style={{ marginTop: 12 }}><button className="primary" disabled={!kFile || kBusy} onClick={readK}>{kBusy ? "পড়ছি…" : "খতিয়ান পড়ুন"}</button></div>
      {kBusy && !kOut && <Thinking big messages={["খতিয়ান পড়ছি…", "নাম আর অংশ খুঁজছি…", "দাগ ও পরিমাণ মিলিয়ে দেখছি…"]} />}{kOut && <div className={"msg ai" + (kBusy ? " streaming" : "")} style={{ maxWidth: "100%", marginTop: 14 }}>{kOut}</div>}
      <p className="disclaimer">রেকর্ড মানে সরকারি খাতায় নাম, জমি এখন কে ভোগ করছে তা নয়। AI ভুল পড়তে পারে, তাই মূল কাগজের সাথে মিলিয়ে নিন।</p>
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>আইনজীবী লাগতে পারে যেখানে</h2><p>নিচের কোনোটা থাকলে সাধারণ আবেদনে নাও হতে পারে।</p></div></div>
      <p className="disclaimer" style={{ marginTop: 0 }}>ওয়ারিশদের মধ্যে মতভেদ, কোনো ওয়ারিশ নিখোঁজ বা অজানা, জাল বা সন্দেহজনক দলিল, জমি অন্য কারও দখলে, অথবা চলমান মামলা। তখন আইনজীবী বা জেলা লিগ্যাল এইড অফিসের পরামর্শ নিন।</p>
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>কে কত ভাগ পাবেন, বুঝে নিন</h2><p>ধর্ম বেছে নিলে সেই ধর্মের আইন অনুযায়ী সাধারণ হিসাব। কে কতটুকু পাবেন।</p></div></div>
      <div className="calcGrid">
        <label>ধর্ম<select className="langSelect" value={rel} onChange={e => setRel(e.target.value)}><option value="muslim">মুসলিম</option><option value="hindu">হিন্দু</option><option value="christian">খ্রিস্টান</option><option value="other">বৌদ্ধ / অন্য</option></select></label>
        <label>মৃত ব্যক্তি<select className="langSelect" value={male ? "m" : "f"} onChange={e => { setMale(e.target.value === "m"); setSp(0); }}><option value="m">পুরুষ (বাবা, দাদা)</option><option value="f">নারী (মা, দাদি)</option></select></label>
        <label>{male ? "জীবিত স্ত্রী (সংখ্যা)" : "স্বামী জীবিত? (০ বা ১)"}<input className="langSelect" type="number" min={0} max={male ? 4 : 1} value={sp} onChange={e => setSp(num(e.target.value))} /></label>
        <label>জীবিত ছেলে<input className="langSelect" type="number" min={0} value={sons} onChange={e => setSons(num(e.target.value))} /></label>
        <label>জীবিত মেয়ে<input className="langSelect" type="number" min={0} value={dau} onChange={e => setDau(num(e.target.value))} /></label>
        {rel === "muslim" && <>
        <label>পিতা জীবিত?<select className="langSelect" value={fa ? "y" : "n"} onChange={e => setFa(e.target.value === "y")}><option value="n">না</option><option value="y">হ্যাঁ</option></select></label>
        <label>মাতা জীবিত?<select className="langSelect" value={mo ? "y" : "n"} onChange={e => setMo(e.target.value === "y")}><option value="n">না</option><option value="y">হ্যাঁ</option></select></label>
        <label>জীবিত ভাই-বোন<input className="langSelect" type="number" min={0} value={sib} onChange={e => setSib(num(e.target.value))} /></label>
        </>}
        <label>মোট জমি (ঐচ্ছিক)<input className="langSelect" type="number" min={0} step="any" placeholder="যেমন 60" value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label>একক<input className="langSelect" value={unit} onChange={e => setUnit(e.target.value)} /></label>
      </div>
      <p className="disclaimer" style={{ marginTop: 0 }}>প্রযোজ্য আইন: {LAW[rel]}</p>
      {rel === "other" && <div className="notice warn"><AlertTriangle size={17} />বৌদ্ধ ও অন্য ধর্মের জন্য আমি নির্ভরযোগ্য হিসাবের নিয়ম যাচাই করতে পারিনি, তাই সংখ্যা দেখাচ্ছি না। আইনজীবী বা স্থানীয় ভূমি অফিসের সাথে কথা বলুন। সরকারের a2i প্রকল্পের “উত্তরাধিকার” অ্যাপ দিয়েও মিলিয়ে দেখতে পারেন।</div>}
      {calc && !calc.ok && <div className="notice warn"><AlertTriangle size={17} />{calc.message}</div>}
      {calc && calc.ok && <>
        <div className="shareBar">{calc.rows.map((r, i) => <div key={i} title={r.who} style={{ flex: r.total.n / r.total.d, background: hue(i) }} />)}</div>
        <div className="tableWrap"><table className="shareTable"><thead><tr><th>ওয়ারিশ</th><th>সংখ্যা</th><th>মোট অংশ</th><th>জনপ্রতি</th><th>জনপ্রতি %</th>{total > 0 && <th>জনপ্রতি জমি</th>}<th>কেন</th></tr></thead>
          <tbody>{calc.rows.map((r, i) => { const v = r.each.n / r.each.d; return <tr key={i}><td><i className="dotc" style={{ background: hue(i) }} />{r.who}</td><td>{r.count}</td><td>{fmt(r.total)}</td><td>{fmt(r.each)}</td><td>{(v * 100).toFixed(2)}%</td>{total > 0 && <td>{(v * total).toFixed(4)} {unit}</td>}<td className="why">{r.why}</td></tr>; })}</tbody></table></div>
        {calc.notes.map((n, i) => <p className="disclaimer" key={i}>{n}</p>)}
      </>}
      <ul className="calcNotes">
        <li>ঋণ, দাফনের খরচ ও বৈধ অসিয়ত (সাধারণ নিয়মে সর্বোচ্চ এক-তৃতীয়াংশ) বাদ দিয়ে তারপর ভাগ হয়।</li>
        <li>মৃত ছেলে বা মেয়ের সন্তান, দাদা-দাদি, ভাই-বোন বা অন্য আত্মীয় থাকলে ভাগ বদলাতে পারে। এই হিসাব সেগুলো ধরে না, তাই আইনজীবীর সাথে মিলিয়ে নিন।</li>
        <li>ওয়ারিশ সনদে শুধু কারা ওয়ারিশ তা লেখা থাকে। ভাগের পরিমাণ আইন ঠিক করে। সবাই রাজি থাকলে নিজেরা ভাগ করা যায়, না হলে আদালতে বণ্টন মামলা হয়।</li>
        <li>এটি আনুমানিক শিক্ষামূলক হিসাব, আইনি পরামর্শ বা চূড়ান্ত রায় নয়।</li>
      </ul>
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>আবেদনের তথ্য সাজান</h2><p>ওয়ারিশ সনদ ও আবেদনে এই তথ্য লাগবে। কপি করে নিজের কাছে রাখুন।</p></div></div>
      <div className="heirRow two"><input className="langSelect" placeholder="মৃত ব্যক্তির নাম" value={deceased} onChange={e => setDeceased(e.target.value)} /><input className="langSelect" placeholder="মৌজা, দাগ নং, খতিয়ান নং" value={land} onChange={e => setLand(e.target.value)} /></div>
      {heirs.map((h, i) => <div className="heirRow" key={i}>
        <input className="langSelect" placeholder="ওয়ারিশের নাম" value={h.name} onChange={e => setHeir(i, "name", e.target.value)} />
        <input className="langSelect" placeholder="সম্পর্ক (যেমন: ছেলে)" value={h.rel} onChange={e => setHeir(i, "rel", e.target.value)} />
        <input className="langSelect" placeholder="NID নম্বর" value={h.nid} onChange={e => setHeir(i, "nid", e.target.value)} />
        <button className="iconBtn" aria-label="মুছুন" onClick={() => setHeirs(x => x.filter((_, j) => j !== i))}><Trash2 size={17} /></button>
      </div>)}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        <button className="secondary" onClick={() => setHeirs(h => [...h, { name: "", nid: "", rel: "" }])}><Plus size={16} />ওয়ারিশ যোগ করুন</button>
        <button className="primary" onClick={copy}><Copy size={16} />{copied ? "কপি হয়েছে" : "তথ্য কপি করুন"}</button>
      </div>
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>প্রশ্ন করুন</h2><p>বাংলায় লিখুন, সহজ ভাষায় উত্তর পাবেন।</p></div></div>
      <div className="chat">{chat.map((m, i) => m.text ? <div key={i} className={"msg " + m.role + (asking && i === chat.length - 1 ? " streaming" : "")}>{m.text}</div> : null)}{asking && !chat[chat.length - 1]?.text && <Thinking compact messages={["ভাবছি…", "আইন মিলিয়ে দেখছি…", "উত্তর সাজাচ্ছি…"]} />}</div>
      <div className="chatInput"><input value={q} placeholder="যেমন: একজন ভাই বিদেশে থাকলে কী করব?" onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") ask(); }} /><button className="primary" disabled={asking} onClick={ask}>জিজ্ঞেস করুন</button></div>
    </section>
  </div>;
}
