import React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLang } from "../i18n/lang";

// Accuracy results written by scripts/eval/cuad-eval.mjs (the AI run when it exists, else the baseline).
const EVALS = import.meta.glob("../../docs/eval/cuad-results*.json", { eager: true, import: "default" }) as Record<string, any>;
const aiEval = Object.entries(EVALS).find(([k]) => !k.includes("baseline"))?.[1];
const baseEval = Object.entries(EVALS).find(([k]) => k.includes("baseline"))?.[1];

type Row = { req: [string, string]; how: [string, string]; where: [string, string] };

const ROWS: Row[] = [
  { req: ["Ingest a raw contract PDF", "কাঁচা চুক্তির PDF গ্রহণ"], how: ["pdf.js converts pages to Markdown with headings, tables and page numbers; scanned or large PDFs are sent as page images", "pdf.js পৃষ্ঠাকে শিরোনাম, টেবিল ও পৃষ্ঠা নম্বরসহ Markdown করে; স্ক্যান করা বা বড় PDF পৃষ্ঠার ছবি হিসেবে যায়"], where: ["Review → Add your contract", "পর্যালোচনা → চুক্তি যোগ"] },
  { req: ["Risk scoring on custom playbooks", "কাস্টম প্লেবুকে ঝুঁকি স্কোর"], how: ["The AI judges every rule with a verbatim quote; the score is calculated in code from rule weights; playbooks can be created, edited and shared as JSON", "এআই প্রতিটি নিয়ম হুবহু উদ্ধৃতিসহ যাচাই করে; স্কোর কোডে ওজন থেকে হিসাব হয়; প্লেবুক তৈরি, সম্পাদনা ও JSON-এ শেয়ার করা যায়"], where: ["Playbooks; Overview → scorecard", "প্লেবুক; সারসংক্ষেপ → স্কোরকার্ড"] },
  { req: ["Structured JSON of obligations", "বাধ্যবাধকতার কাঠামোগত JSON"], how: ["Exported JSON is validated against a published JSON Schema (draft 2020-12) before download", "এক্সপোর্টের আগে প্রকাশিত JSON Schema (draft 2020-12) দিয়ে যাচাই"], where: ["Obligations → Structured JSON", "বাধ্যবাধকতা → JSON"] },
  { req: ["Redlined version of the document", "সংশোধিত (রেডলাইন) ডকুমেন্ট"], how: ["Word file with tracked changes and comments, a redlined PDF, and the full document with every change in place", "চিহ্নিত পরিবর্তনসহ Word ফাইল, রেডলাইন PDF, এবং জায়গামতো প্রতিটি পরিবর্তনসহ পুরো ডকুমেন্ট"], where: ["Redlines", "রেডলাইন"] },
  { req: ["Multi-agent system", "বহু-এজেন্ট ব্যবস্থা"], how: ["Six agents: Risk Auditor → Opposing Counsel → Commercial Dealmaker hand off to each other; Obligations, Table Vision and Benchmarks run in parallel", "ছয়টি এজেন্ট: ঝুঁকি নিরীক্ষক → প্রতিপক্ষ আইনজীবী → বাণিজ্যিক ডিলমেকার একে অপরকে কাজ দেয়; বাধ্যবাধকতা, টেবিল ভিশন ও বেঞ্চমার্ক একসাথে চলে"], where: ["Analysing screen; Overview → How this analysis ran", "বিশ্লেষণের পর্দা; সারসংক্ষেপ"] },
  { req: ["RAG architecture", "RAG কাঠামো"], how: ["The contract is chunked by heading, embedded and stored in IndexedDB; each agent reads only the sections it retrieves", "চুক্তি শিরোনাম ধরে ভাগ, এমবেড ও IndexedDB-তে রাখা হয়; প্রতিটি এজেন্ট শুধু প্রয়োজনীয় অংশ পড়ে"], where: ["Every analysis", "প্রতিটি বিশ্লেষণ"] },
  { req: ["Opposing counsel finds indemnity risks; another agent proposes counter-offers", "প্রতিপক্ষ আইনজীবী ক্ষতিপূরণের ঝুঁকি খোঁজে; আরেক এজেন্ট পাল্টা প্রস্তাব দেয়"], how: ["Opposing Counsel lists one-sided clauses (indemnity first); the Dealmaker answers each one, and every redline names the finding it answers", "প্রতিপক্ষ আইনজীবী একতরফা ধারা দেয় (আগে ক্ষতিপূরণ); ডিলমেকার প্রতিটির জবাব দেয়, প্রতিটি রেডলাইন কোন পর্যবেক্ষণের জবাব তা জানায়"], where: ["Redlines → Opposing Counsel findings", "রেডলাইন → প্রতিপক্ষের পর্যবেক্ষণ"] },
  { req: ["RAG against Gold Standard clauses: deviations and missing protections", "আদর্শ ধারার সাথে RAG: বিচ্যুতি ও অনুপস্থিত সুরক্ষা"], how: ["30 gold clauses are matched to contract sections by embedding similarity; required clauses with no similar section are flagged in code and confirmed by the agent", "৩০টি আদর্শ ধারা এমবেডিং সাদৃশ্যে চুক্তির অংশের সাথে মেলানো হয়; প্রয়োজনীয় ধারার মতো অংশ না থাকলে কোডে চিহ্নিত ও এজেন্ট দিয়ে নিশ্চিত হয়"], where: ["Benchmarks", "বেঞ্চমার্ক"] },
  { req: ["Vision agent parses hierarchical tables into a payment calendar", "ভিশন এজেন্ট জটিল টেবিল থেকে পেমেন্ট ক্যালেন্ডার তৈরি করে"], how: ["Pages with payment tables are read as images; rows keep their phase and page; dates are calculated and exported as .ics or CSV", "পেমেন্ট টেবিলের পৃষ্ঠা ছবি হিসেবে পড়া হয়; সারি তার ধাপ ও পৃষ্ঠা রাখে; তারিখ হিসাব করে .ics বা CSV-তে দেওয়া হয়"], where: ["Obligations → Milestones", "বাধ্যবাধকতা → মাইলস্টোন"] },
  { req: ["Chain-of-thought rationale for every redline", "প্রতিটি রেডলাইনের যুক্তি"], how: ["Each redline explains the other side's position, risk, legal rationale and what to say; incomplete ones are completed or removed", "প্রতিটি রেডলাইনে অপর পক্ষের অবস্থান, ঝুঁকি, আইনি যুক্তি ও কী বলবেন থাকে; অসম্পূর্ণগুলো পূরণ বা বাদ দেওয়া হয়"], where: ["Redlines", "রেডলাইন"] },
  { req: ["Natural-language search over a contract repository", "চুক্তি ভান্ডারে সহজ ভাষায় খোঁজ"], how: ["650 real CUAD and MAUD contracts; questions become filters (cap, law, clauses), ranked by meaning and keywords, with a cited answer", "CUAD ও MAUD-এর ৬৫০টি বাস্তব চুক্তি; প্রশ্ন ফিল্টারে রূপান্তর (দায়সীমা, আইন, ধারা), অর্থ ও কীওয়ার্ডে সাজানো, সূত্রসহ উত্তর"], where: ["Library", "লাইব্রেরি"] },
];

export function HowItWorks({ onOpen }: { onOpen: (view: "review" | "playbooks" | "library") => void }) {
  const { L, bn, num } = useLang();
  const pick = (pair: [string, string]) => (bn ? pair[1] : pair[0]);
  const ev = aiEval || baseEval;

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="stepHead">
          <div>
            <h2>{L("Hackathon requirements, and where to see them", "হ্যাকাথনের শর্ত, এবং কোথায় দেখবেন")}</h2>
            <p>{L("Every item in the ContractMind brief, how it is built, and where it is in the app.", "ContractMind ব্রিফের প্রতিটি শর্ত, কীভাবে তৈরি, এবং অ্যাপে কোথায়।")}</p>
          </div>
        </div>
        <div className="tableWrapPlain">
          <table className="hiwTable">
            <thead>
              <tr>
                <th>{L("Requirement", "শর্ত")}</th>
                <th>{L("How ContractMind does it", "ContractMind কীভাবে করে")}</th>
                <th>{L("Where", "কোথায়")}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.req[0]}>
                  <td><CheckCircle2 size={14} className="text-ok" style={{ verticalAlign: "-2px", marginRight: 6 }} /><b>{pick(r.req)}</b></td>
                  <td>{pick(r.how)}</td>
                  <td className="text-muted">{pick(r.where)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="stepHead">
          <div>
            <h2>{L("Accuracy on CUAD expert labels", "CUAD বিশেষজ্ঞ লেবেলে নির্ভুলতা")}</h2>
            <p>
              {L(
                "12 clause types on CUAD v1 contracts, compared with the labels written by lawyers (scripts/eval/cuad-eval.mjs).",
                "CUAD v1 চুক্তিতে ১২ ধরনের ধারা, আইনজীবীদের লেবেলের সাথে তুলনা (scripts/eval/cuad-eval.mjs)।"
              )}
            </p>
          </div>
        </div>
        {ev ? (
          <div className="hiwStats">
            {aiEval && <Stat label={L("AI F1 (micro)", "এআই F1")} value={`${num(aiEval.overall.f1)}%`} />}
            {aiEval && <Stat label={L("AI governing law", "এআই প্রযোজ্য আইন")} value={`${num(aiEval.governingLawAccuracy)}%`} />}
            {aiEval && <Stat label={L("AI quotes verbatim", "এআই হুবহু উদ্ধৃতি")} value={`${num(aiEval.quoteVerbatimRate)}%`} />}
            {baseEval && <Stat label={L("Keyword baseline F1", "কীওয়ার্ড বেসলাইন F1")} value={`${num(baseEval.overall.f1)}%`} muted />}
            {baseEval && <Stat label={L("Baseline governing law", "বেসলাইন প্রযোজ্য আইন")} value={`${num(baseEval.governingLawAccuracy)}%`} muted />}
            <p className="text-xs text-muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
              {aiEval
                ? L(`${aiEval.contracts} contracts, ${aiEval.method}, run ${aiEval.ranAt.slice(0, 10)}.`, `${num(aiEval.contracts)}টি চুক্তি, ${aiEval.method}, ${aiEval.ranAt.slice(0, 10)}।`)
                : L(
                    `Only the keyword baseline has been run so far (${baseEval.contracts} contracts). The AI result appears here after running the script with a Gemini key.`,
                    `এখন পর্যন্ত শুধু কীওয়ার্ড বেসলাইন চালানো হয়েছে (${num(baseEval.contracts)}টি চুক্তি)। Gemini কী দিয়ে স্ক্রিপ্ট চালালে এআই ফলাফল এখানে দেখা যাবে।`
                  )}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">{L("No evaluation has been run yet.", "এখনও কোনো মূল্যায়ন চালানো হয়নি।")}</p>
        )}
      </section>

      <section className="card">
        <div className="stepHead">
          <div>
            <h2>{L("Try it", "চেষ্টা করুন")}</h2>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="primary" onClick={() => onOpen("review")}>{L("Review a contract", "চুক্তি পর্যালোচনা")} <ArrowRight size={14} /></button>
          <button className="secondary" onClick={() => onOpen("playbooks")}>{L("Build a playbook", "প্লেবুক তৈরি")}</button>
          <button className="secondary" onClick={() => onOpen("library")}>{L("Search 650 contracts", "৬৫০টি চুক্তিতে খুঁজুন")}</button>
        </div>
        <p className="text-[11px] text-faint" style={{ margin: "12px 0 0" }}>
          {L("Contract data: CUAD v1 and MAUD by The Atticus Project (CC BY 4.0). AI-assisted review, not legal advice.", "চুক্তির ডেটা: The Atticus Project-এর CUAD v1 ও MAUD (CC BY 4.0)। এআই-সহায়িত পর্যালোচনা, আইনি পরামর্শ নয়।")}
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`hiwStat ${muted ? "muted" : ""}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
