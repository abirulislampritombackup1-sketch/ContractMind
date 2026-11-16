import Thinking from "./Thinking";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { askCase, explainCase, type ChatMsg } from "../../services/legalAssist";

const TODO = [
  "সমন, ওয়ারেন্ট বা নোটিশ পেলে অবহেলা করবেন না। তারিখ খেয়াল রাখুন এবং সব কাগজ আর খাম রেখে দিন।",
  "দেরি না করে আইনজীবীর সাথে কথা বলুন। খরচ জোগাড় করতে না পারলে জেলা লিগ্যাল এইড অফিসে যান।",
  "কেউ টাকা নিয়ে মামলা “মিটিয়ে দেওয়ার” প্রস্তাব দিলে আগে আইনজীবীকে জানান।",
  "ঘটনার সময়, স্থান, সাক্ষী, ছবি, মেসেজ আর রসিদ গুছিয়ে রাখুন। আইনজীবীর কাজে লাগবে।",
];

export default function CaseHelper() {
  const [text, setText] = useState(""), [file, setFile] = useState<File | null>(null), [out, setOut] = useState(""), [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]), [q, setQ] = useState(""), [asking, setAsking] = useState(false);

  async function explain() {
    if ((!file && !text.trim()) || busy) return; setBusy(true); setOut("");
    try { setOut(await explainCase(text, file || undefined)); }
    catch (e: any) { setOut("⚠ " + (e.message || "বোঝানো যায়নি।")); }
    finally { setBusy(false); }
  }
  async function ask() {
    const question = q.trim(); if (!question || asking) return;
    const h = chat; setChat([...h, { role: "user", text: question }, { role: "ai", text: "" }]); setQ(""); setAsking(true);
    const upd = (t: string) => setChat(c => c.map((m, i) => i === c.length - 1 ? { ...m, text: t } : m));
    try { upd(await askCase(h, question)); }
    catch (e: any) { upd("⚠ " + (e.message || "উত্তর আনা যায়নি।")); }
    finally { setAsking(false); }
  }

  return <div className="legalPage">
    <div className="notice warn"><AlertTriangle size={17} />এটি সাধারণ দিকনির্দেশনা, আইনি পরামর্শ নয়। কে ঠিক, প্রমাণ কেমন বা আদালত কী রায় দেবে, তা কোনো অ্যাপ বলতে পারে না। বড় সিদ্ধান্তের আগে আইনজীবীর সাথে কথা বলুন।</div>
    <section className="panel">
      <div className="panelHead"><div><h2>মামলা বা আদালতের কাগজ পেলে আগে যা করবেন</h2><p>ভয় না পেয়ে ঠান্ডা মাথায় এই ধাপগুলো।</p></div></div>
      {TODO.map((t, i) => <div className="lstep" key={i}><span className="n">{String(i + 1).padStart(2, "0")}</span><div><p>{t}</p></div></div>)}
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>বিনা খরচে আইনি সহায়তা</h2><p>সংবাদ প্রতিবেদন অনুযায়ী</p></div></div>
      <p className="disclaimer" style={{ marginTop: 0 }}>দেশের ৬৪টি জেলায় লিগ্যাল এইড অফিস আছে। সেখানে বিনামূল্যে আইনি পরামর্শ পাওয়া যায়। অসচ্ছল অভিযুক্তের জন্য সরকারি খরচে আইনজীবী দেওয়া হয়, আর আপস-মীমাংসায় বিনামূল্যে মধ্যস্থতাও হয়। সরকারি আইনি সহায়তার টোল-ফ্রি হেল্পলাইন হিসেবে একটা প্রতিবেদনে ১৬৬৯৯ নম্বর পেয়েছি, তবে ফোন করার আগে জেলা লিগ্যাল এইড অফিস বা সরকারি সাইট থেকে নম্বরটা মিলিয়ে নিন।</p>
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>আপনার আইনি বিষয়টা জানান</h2><p>কাগজের ছবি বা PDF দিন, অথবা যেকোনো আইনি সমস্যা লিখুন। AI বুঝিয়ে বিকল্প আর সবচেয়ে বিবেচ্য পথ বলবে।</p></div></div>
      <label className="drop" style={{ minHeight: 110 }}><input type="file" accept="image/*,.pdf,application/pdf" onChange={e => { setFile(e.target.files?.[0] || null); setOut(""); }} /><b>{file ? file.name : "কাগজের ছবি বা PDF দিন"}</b><span>ক্লিক করে বেছে নিন</span></label>
      <textarea className="caseText" placeholder="যেকোনো আইনি বিষয় লিখুন: জমি, পরিবার, টাকা-পয়সা, চাকরি, থানা-পুলিশ, মামলা, নোটিশ… কী হয়েছে, কে জড়িত, কবে, কী চান।" value={text} onChange={e => setText(e.target.value)} />
      <button className="primary" disabled={busy || (!file && !text.trim())} onClick={explain}>{busy ? "ভাবছি…" : "বুঝিয়ে দিন ও পরামর্শ নিন"}</button>
      {busy && !out && <Thinking big messages={["আপনার বিষয়টা পড়ছি…", "বিকল্পগুলো ভাবছি…", "সবচেয়ে বিবেচ্য পথ খুঁজছি…"]} />}{out && <div className={"msg ai" + (busy ? " streaming" : "")} style={{ maxWidth: "100%", marginTop: 14 }}>{out}</div>}
      <p className="disclaimer">AI ভুল পড়তে বা ভুল বুঝতে পারে। তারিখ, ধারা আর আদালতের নাম মূল কাগজ থেকে মিলিয়ে নিন। এটি বিকল্প আর সম্ভাব্য পথ দেখায়, চূড়ান্ত সিদ্ধান্ত নয়। সিদ্ধান্ত নেওয়ার আগে আইনজীবীর সাথে কথা বলুন।</p>
    </section>
    <section className="panel">
      <div className="panelHead"><div><h2>প্রশ্ন করুন</h2><p>যেকোনো আইনি প্রশ্ন, সিদ্ধান্তের বিকল্পসহ।</p></div></div>
      <div className="chat">{chat.map((m, i) => m.text ? <div key={i} className={"msg " + m.role + (asking && i === chat.length - 1 ? " streaming" : "")}>{m.text}</div> : null)}{asking && !chat[chat.length - 1]?.text && <Thinking compact messages={["ভাবছি…", "আইন মিলিয়ে দেখছি…", "উত্তর সাজাচ্ছি…"]} />}</div>
      <div className="chatInput"><input value={q} placeholder="যেমন: প্রতিবেশী জোর করে জমি দখল করেছে, কী করব?" onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") ask(); }} /><button className="primary" disabled={asking} onClick={ask}>জিজ্ঞেস করুন</button></div>
    </section>
  </div>;
}
