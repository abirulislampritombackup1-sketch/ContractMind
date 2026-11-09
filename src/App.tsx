import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileCheck2,
  FileEdit,
  FileSearch,
  FileText,
  GitCompare,
  Info,
  LayoutDashboard,
  ListOrdered,
  Lock,
  MessageSquare,
  Moon,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  UploadCloud,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { ContractAnalysisResult, Playbook } from "./types";
import { DEFAULT_PLAYBOOKS } from "./data/playbooks";
import { SAMPLE_CONTRACTS, SampleContract } from "./data/sampleContracts";
import { runContractIntelligence, AgentKey, AgentState } from "./services/gemini";
import { Language } from "./i18n/translations";
import { PlaybookStudio } from "./components/PlaybookStudio";
import { AnalysisOverview } from "./components/AnalysisOverview";
import { RedlineViewer } from "./components/RedlineViewer";
import { ObligationsView } from "./components/ObligationsView";
import { GoldStandardRAG } from "./components/GoldStandardRAG";
import { RepositorySearch } from "./components/RepositorySearch";
import { CounselChat } from "./components/CounselChat";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PlaybookScorecard } from "./components/PlaybookScorecard";
import { applyScoring, rescore } from "./utils/scoring";
import { ContractView } from "./components/ContractView";
import { buildFindings, findingId } from "./utils/findings";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type View = "review" | "playbooks" | "library";
type ResultTab = "Analysis" | "Contract" | "Redlines" | "Obligations" | "Gold Standard" | "AI Counsel Chat";
type Notice = { text: string; kind: "info" | "ok" | "warn" | "error" } | null;
type Progress = Record<AgentKey, AgentState | "waiting">;

const AGENT_ORDER: AgentKey[] = ["risk", "redlines", "obligations", "benchmarks"];
const IDLE_PROGRESS: Progress = { risk: "waiting", redlines: "waiting", obligations: "waiting", benchmarks: "waiting" };

const store = {
  get(k: string) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch {}
  },
};

export default function App() {
  const [lang, setLang] = useState<Language>(() => (store.get("cm-lang") === "bn" ? "bn" : "en"));
  const [theme, setTheme] = useState<"light" | "dark">(() => (store.get("cm-theme") === "dark" ? "dark" : "light"));
  const L = (en: string, bn: string) => (lang === "bn" ? bn : en);

  const [view, setView] = useState<View>("review");
  const [resultTab, setResultTab] = useState<ResultTab>("Analysis");
  const [showResults, setShowResults] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [contractText, setContractText] = useState<string>("");
  const [busyExtracting, setBusyExtracting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [currentPlaybook, setCurrentPlaybook] = useState<Playbook>(DEFAULT_PLAYBOOKS[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysisResult | null>(null);
  // The exact text/file the current results came from (kept even after "New review" clears the input).
  const [analyzed, setAnalyzed] = useState<{ text: string; file: File | null; name: string }>({ text: "", file: null, name: "" });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.set("cm-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    store.set("cm-lang", lang);
  }, [lang]);

  const hasDoc = !!contractText.trim() || !!file;

  // ── Ingest a file (PDF / DOCX / TXT) ───────────────────────────────────────
  const handleExtractFile = async (f: File) => {
    setBusyExtracting(true);
    setNotice(null);
    setFile(f);
    setDocName(f.name);
    setContractText("");
    try {
      if (f.size > 50 * 1024 * 1024) throw new Error(L("File exceeds the 50 MB limit.", "ফাইলের আকার ৫০ মেগাবাইটের বেশি।"));
      const name = f.name.toLowerCase();
      if (f.type === "application/pdf" || name.endsWith(".pdf")) {
        const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
        let extracted = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const content = await (await pdf.getPage(i)).getTextContent();
          extracted += `\n[Page ${i}]\n` + content.items.map((x: any) => x.str || "").join(" ") + "\n";
        }
        const hasText = extracted.replace(/\[Page \d+\]/g, "").trim().length > 0;
        setContractText(hasText ? extracted : "[Scanned PDF - Visual Processing Active]");
        if (!hasText) {
          setNotice({ kind: "info", text: L("Scanned PDF detected — the AI will read the page images directly.", "স্ক্যান করা PDF — এআই সরাসরি পৃষ্ঠার ছবি পড়বে।") });
        }
      } else if (name.endsWith(".docx")) {
        setContractText((await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value);
      } else if (f.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
        setContractText(await f.text());
      } else {
        throw new Error(L("Unsupported file type. Please use PDF, DOCX or TXT.", "এই ফাইল সমর্থিত নয়। PDF, DOCX বা TXT ব্যবহার করুন।"));
      }
    } catch (err: any) {
      setFile(null);
      setDocName("");
      setNotice({ kind: "error", text: err.message || L("Could not read this document.", "ডকুমেন্ট পড়া যায়নি।") });
    } finally {
      setBusyExtracting(false);
    }
  };

  const handleLoadSample = (sample: SampleContract) => {
    setFile(null);
    setDocName(sample.name);
    setContractText(sample.text);
    setNotice(null);
  };

  const clearDoc = () => {
    setFile(null);
    setDocName("");
    setContractText("");
  };

  // ── Run the multi-agent analysis ───────────────────────────────────────────
  const handleRunAnalysis = async () => {
    if (!hasDoc) {
      setNotice({ kind: "warn", text: L("Add a contract first — upload a file or pick a sample.", "প্রথমে একটি চুক্তি যোগ করুন — ফাইল আপলোড করুন বা স্যাম্পল বেছে নিন।") });
      return;
    }
    setView("review");
    setIsAnalyzing(true);
    setNotice(null);
    setProgress(IDLE_PROGRESS);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const result = await runContractIntelligence(contractText, currentPlaybook, file || undefined, lang, (agent, state) =>
        setProgress((p) => ({ ...p, [agent]: state }))
      );
      setAnalysisResult(result);
      setAnalyzed({ text: contractText, file, name: docName });
      setShowResults(true);
      setResultTab("Analysis");
      if (result.isDemo) {
        setNotice({ kind: "warn", text: L("Demo mode: the AI service could not be reached, so this is a pre-built offline analysis of the sample — not a live result.", "ডেমো মোড: এআই সার্ভিসে পৌঁছানো যায়নি, তাই স্যাম্পলের পূর্বনির্ধারিত অফলাইন বিশ্লেষণ দেখানো হচ্ছে।") });
      } else if (result.incompleteSections?.length) {
        setNotice({ kind: "warn", text: L(`Some sections could not be generated: ${result.incompleteSections.join(", ")}. Run the analysis again to retry.`, `কিছু অংশ তৈরি করা যায়নি: ${result.incompleteSections.join(", ")}। আবার চালিয়ে দেখুন।`) });
      }
    } catch (err: any) {
      setNotice({ kind: "error", text: err.message || L("The analysis failed. Please try again.", "বিশ্লেষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।") });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startNewReview = () => {
    clearDoc();
    setShowResults(false);
    setNotice(null);
    setView("review");
  };

  const updateRedlines = (fn: (r: ContractAnalysisResult["redlines"][number]) => ContractAnalysisResult["redlines"][number]) =>
    analysisResult && setAnalysisResult({ ...analysisResult, redlines: analysisResult.redlines.map(fn) });

  const goHome = () => {
    setView("review");
    if (!isAnalyzing) setShowResults(!!analysisResult && showResults);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbarInner">
          <button className="logo" onClick={goHome} aria-label="ContractMind home">
            <span className="logoMark"><Scale size={19} /></span>
            <span>
              <b>ContractMind</b>
              <small>{L("AI contract review", "এআই চুক্তি পর্যালোচনা")}</small>
            </span>
          </button>

          <nav className="mainNav" aria-label="Main">
            <button className={view === "review" ? "on" : ""} onClick={goHome}>
              <FileSearch size={15} /> <span className="lbl">{L("Review", "পর্যালোচনা")}</span>
            </button>
            <button className={view === "playbooks" ? "on" : ""} onClick={() => setView("playbooks")}>
              <Sliders size={15} /> <span className="lbl">{L("Playbooks", "প্লেবুক")}</span>
            </button>
            <button className={view === "library" ? "on" : ""} onClick={() => setView("library")}>
              <Database size={15} /> <span className="lbl">{L("Library", "লাইব্রেরি")}</span>
            </button>
          </nav>

          <div className="topActions">
            <div className="pillToggle" role="group" aria-label="Language">
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "bn" ? "on" : ""} onClick={() => setLang("bn")}>বাংলা</button>
            </div>
            <button
              className="iconBtn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? L("Light mode", "লাইট মোড") : L("Dark mode", "ডার্ক মোড")}
              aria-label="Toggle colour theme"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        {notice && (
          <div className={`notice ${notice.kind}`} role="status">
            {notice.kind === "error" ? <XCircle size={18} /> : notice.kind === "ok" ? <CheckCircle2 size={18} /> : notice.kind === "warn" ? <AlertTriangle size={18} /> : <Info size={18} />}
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}

        {/* ───────────── REVIEW ───────────── */}
        {view === "review" && isAnalyzing && (
          <AnalyzingScreen L={L} lang={lang} progress={progress} docName={docName} playbook={currentPlaybook.name} />
        )}

        {view === "review" && !isAnalyzing && showResults && analysisResult && (
          <ResultsWorkspace
            L={L}
            lang={lang}
            result={analysisResult}
            tab={resultTab}
            setTab={setResultTab}
            contractText={analyzed.text}
            file={analyzed.file}
            docName={analyzed.name}
            onNew={startNewReview}
            onRerun={handleRunAnalysis}
            canRerun={hasDoc}
            onUpdateRedline={(id, accepted) => updateRedlines((r) => (r.id === id ? { ...r, accepted } : r))}
            onAcceptAll={() => updateRedlines((r) => ({ ...r, accepted: true }))}
            onRejectAll={() => updateRedlines((r) => ({ ...r, accepted: false }))}
            onWeightsChange={(w) =>
              analysisResult.scoring && setAnalysisResult(applyScoring(analysisResult, rescore(analysisResult.scoring, w)))
            }
          />
        )}

        {view === "review" && !isAnalyzing && !(showResults && analysisResult) && (
          <>
            <section className="hero">
              <div className="heroBadge"><span>{L("4 AI agents", "৪টি এআই এজেন্ট")}</span> <span className="hbText">{L("Risk · Redlines · Obligations · Benchmarks", "ঝুঁকি · রেডলাইন · বাধ্যবাধকতা · বেঞ্চমার্ক")}</span></div>
              <h1>
                {L("Review any contract", "যেকোনো চুক্তি পর্যালোচনা করুন")} <em>{L("in seconds", "মুহূর্তেই")}</em>
              </h1>
              <p>
                {L(
                  "Upload a contract, choose your negotiation playbook, and get a risk score, suggested redlines with reasoning, and a structured list of obligations.",
                  "চুক্তি আপলোড করুন, আপনার প্লেবুক বেছে নিন — পেয়ে যান ঝুঁকি স্কোর, যুক্তিসহ রেডলাইন এবং বাধ্যবাধকতার কাঠামোগত তালিকা।"
                )}
              </p>
              <div className="heroChips">
                <span><CheckCircle2 size={15} /> {L("PDF, Word or text", "PDF, Word বা টেক্সট")}</span>
                <span><CheckCircle2 size={15} /> {L("Explained redlines", "ব্যাখ্যাসহ রেডলাইন")}</span>
                <span><CheckCircle2 size={15} /> {L("JSON export", "JSON এক্সপোর্ট")}</span>
              </div>
            </section>

            {analysisResult && (
              <div className="notice ok">
                <CheckCircle2 size={18} />
                <span>
                  {L("Your last review is ready:", "আপনার শেষ পর্যালোচনা প্রস্তুত:")} <b>{analysisResult.contractTitle}</b>
                </span>
                <button className="linkBtn" style={{ marginLeft: "auto" }} onClick={() => setShowResults(true)}>
                  {L("Open results", "ফলাফল দেখুন")} <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div className="steps">
              {/* Step 1 */}
              <section className="card">
                <div className="stepHead">
                  <span className={`stepNum ${hasDoc ? "done" : ""}`}>{hasDoc ? <CheckCircle2 size={16} /> : 1}</span>
                  <div>
                    <h2>{L("Add your contract", "আপনার চুক্তি যোগ করুন")}</h2>
                    <p>{L("Upload a file, or try one of our sample contracts.", "ফাইল আপলোড করুন অথবা একটি স্যাম্পল চুক্তি ব্যবহার করুন।")}</p>
                  </div>
                </div>

                {hasDoc && !busyExtracting ? (
                  <div className="fileChip">
                    <span className="fi"><FileCheck2 size={20} /></span>
                    <div className="grow">
                      <b title={docName}>{docName || L("Contract text", "চুক্তির টেক্সট")}</b>
                      <small>
                        {contractText.startsWith("[Scanned PDF")
                          ? L("Scanned PDF · read visually by AI", "স্ক্যান করা PDF · এআই ছবি থেকে পড়বে")
                          : `${contractText.length.toLocaleString()} ${L("characters ready", "অক্ষর প্রস্তুত")}`}
                      </small>
                    </div>
                    <button className="secondary" onClick={clearDoc}>
                      <RotateCcw size={14} /> {L("Change", "পরিবর্তন")}
                    </button>
                  </div>
                ) : (
                  <Drop busy={busyExtracting} onFile={handleExtractFile} L={L} />
                )}

                <div className="divider">{L("or try a sample", "অথবা স্যাম্পল ব্যবহার করুন")}</div>
                <div className="samples">
                  {SAMPLE_CONTRACTS.map((s) => (
                    <button
                      key={s.id}
                      className={`sample ${!file && contractText === s.text ? "on" : ""}`}
                      onClick={() => handleLoadSample(s)}
                    >
                      <span className="tag brand">{s.badge}</span>
                      <b>{s.name}</b>
                      <small>{s.type}</small>
                    </button>
                  ))}
                </div>
              </section>

              {/* Step 2 + 3 */}
              <section className="card">
                <div className="stepHead">
                  <span className="stepNum">2</span>
                  <div>
                    <h2>{L("Choose a playbook", "একটি প্লেবুক বেছে নিন")}</h2>
                    <p>{L("The rules your contract is scored against.", "যে নিয়মে চুক্তিটি মূল্যায়ন হবে।")}</p>
                  </div>
                  <button className="linkBtn right" onClick={() => setView("playbooks")}>
                    <Sliders size={13} /> {L("Customize", "কাস্টমাইজ")}
                  </button>
                </div>

                <div className="pbList">
                  {[...DEFAULT_PLAYBOOKS, ...(DEFAULT_PLAYBOOKS.some((p) => p.id === currentPlaybook.id) ? [] : [currentPlaybook])].map((pb) => (
                    <button
                      key={pb.id}
                      className={`pbOpt ${currentPlaybook.id === pb.id ? "on" : ""}`}
                      onClick={() => setCurrentPlaybook(pb)}
                      aria-pressed={currentPlaybook.id === pb.id}
                    >
                      <span className="radio" />
                      <span>
                        <b>{pb.badge}</b>
                        <small>{pb.name}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="runBox">
                  <div className="stepHead" style={{ marginBottom: 12 }}>
                    <span className="stepNum">3</span>
                    <div>
                      <h2>{L("Analyze", "বিশ্লেষণ করুন")}</h2>
                    </div>
                  </div>
                  <button className="primary bigBtn" disabled={!hasDoc || busyExtracting} onClick={handleRunAnalysis}>
                    <Sparkles size={18} /> {L("Analyze contract", "চুক্তি বিশ্লেষণ করুন")}
                  </button>
                  <div className="runHint">
                    {hasDoc
                      ? L("4 AI agents work in parallel · usually 5–30 seconds", "৪টি এআই এজেন্ট একসাথে কাজ করে · সাধারণত ৫–৩০ সেকেন্ড")
                      : L("Add a contract in step 1 to continue", "চালিয়ে যেতে ধাপ ১-এ একটি চুক্তি যোগ করুন")}
                  </div>
                </div>
              </section>
            </div>
          </>
        )}

        {/* ───────────── PLAYBOOKS ───────────── */}
        {view === "playbooks" && (
          <>
            <PageIntro
              title={L("Negotiation playbooks", "নেগোসিয়েশন প্লেবুক")}
              desc={L("Pick a ready-made policy or tune your own tolerances. The selected playbook is used for the next analysis.", "তৈরি নীতি বেছে নিন অথবা নিজের মতো সাজান। নির্বাচিত প্লেবুক পরবর্তী বিশ্লেষণে ব্যবহৃত হবে।")}
              action={
                <button className="primary" onClick={() => setView("review")}>
                  {L("Use & continue", "ব্যবহার করে এগিয়ে যান")} <ArrowRight size={15} />
                </button>
              }
            />
            <PlaybookStudio
              currentPlaybook={currentPlaybook}
              onSelectPlaybook={(pb: Playbook) => {
                setCurrentPlaybook(pb);
                setNotice({ kind: "ok", text: L(`Playbook selected: ${pb.name}`, `প্লেবুক নির্বাচিত: ${pb.name}`) });
              }}
            />
          </>
        )}

        {/* ───────────── LIBRARY ───────────── */}
        {view === "library" && (
          <>
            <PageIntro
              title={L("Contract library", "চুক্তি লাইব্রেরি")}
              desc={L("Search benchmark contracts by liability cap, indemnity type or governing law, and load any of them for review.", "দায়সীমা, ক্ষতিপূরণের ধরন বা প্রযোজ্য আইন দিয়ে চুক্তি খুঁজুন এবং পর্যালোচনার জন্য লোড করুন।")}
            />
            <RepositorySearch
              onLoadContractSnippet={(title: string, text: string) => {
                setContractText(`[REPOSITORY CONTRACT - ${title}]\n\n${text}`);
                setFile(null);
                setDocName(title);
                setShowResults(false);
                setView("review");
                setNotice({ kind: "ok", text: L(`Loaded "${title}". Choose a playbook and click Analyze.`, `"${title}" লোড হয়েছে। প্লেবুক বেছে বিশ্লেষণ করুন।`) });
              }}
            />
          </>
        )}
      </main>

      <footer>
        <Lock size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} />
        {L("ContractMind · AI-assisted review, not legal advice", "কন্ট্রাক্টমাইন্ড · এআই-সহায়িত পর্যালোচনা, আইনি পরামর্শ নয়")}
      </footer>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

type LFn = (en: string, bn: string) => string;

function PageIntro({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap" style={{ margin: "6px 0 22px" }}>
      <div>
        <h1 style={{ font: "800 28px/1.2 'Plus Jakarta Sans', 'Noto Sans Bengali', sans-serif", letterSpacing: "-0.7px", margin: "0 0 6px" }}>{title}</h1>
        <p className="text-muted" style={{ margin: 0, maxWidth: 640 }}>{desc}</p>
      </div>
      {action}
    </div>
  );
}

function Drop({ busy, onFile, L }: { busy: boolean; onFile: (f: File) => void; L: LFn }) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`drop ${over ? "over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="dropIcon">{busy ? <span className="spinner" /> : <UploadCloud size={26} />}</div>
      <b>{busy ? L("Reading your document…", "ডকুমেন্ট পড়া হচ্ছে…") : L("Drag & drop your contract here", "আপনার চুক্তি এখানে টেনে আনুন")}</b>
      <span>
        {L("or ", "অথবা ")}<u>{L("browse your files", "ফাইল নির্বাচন করুন")}</u>
      </span>
      <small>{L("PDF, DOCX or TXT · up to 50 MB", "PDF, DOCX বা TXT · সর্বোচ্চ ৫০ MB")}</small>
    </label>
  );
}

const AGENT_INFO: Record<AgentKey, { icon: React.ReactNode; en: [string, string]; bn: [string, string] }> = {
  risk: { icon: <ShieldCheck size={19} />, en: ["Risk Auditor", "Scores the contract against your playbook"], bn: ["ঝুঁকি নিরীক্ষক", "প্লেবুক অনুযায়ী ঝুঁকি স্কোর করে"] },
  redlines: { icon: <FileEdit size={19} />, en: ["Opposing Counsel", "Finds one-sided clauses and drafts redlines"], bn: ["প্রতিপক্ষ আইনজীবী", "একতরফা ধারা খুঁজে রেডলাইন তৈরি করে"] },
  obligations: { icon: <ListOrdered size={19} />, en: ["Obligation Extractor", "Lists duties, deadlines and payments"], bn: ["বাধ্যবাধকতা সংগ্রাহক", "দায়িত্ব, সময়সীমা ও পেমেন্ট তালিকা করে"] },
  benchmarks: { icon: <GitCompare size={19} />, en: ["Benchmark Agent", "Compares clauses to gold standards"], bn: ["বেঞ্চমার্ক এজেন্ট", "আদর্শ ধারার সাথে তুলনা করে"] },
};

function AnalyzingScreen({ L, lang, progress, docName, playbook }: { L: LFn; lang: Language; progress: Progress; docName: string; playbook: string }) {
  const done = AGENT_ORDER.filter((k) => progress[k] === "done").length;
  return (
    <section style={{ maxWidth: 980, margin: "10px auto 0" }}>
      <div className="text-center" style={{ marginBottom: 26 }}>
        <div className="heroBadge" style={{ marginBottom: 14 }}>
          <span>{done}/4</span> {L("agents finished", "এজেন্ট সম্পন্ন")}
        </div>
        <h1 style={{ font: "800 30px/1.2 'Plus Jakarta Sans', 'Noto Sans Bengali', sans-serif", letterSpacing: "-0.8px", margin: "0 0 8px" }}>
          {L("Analyzing your contract…", "আপনার চুক্তি বিশ্লেষণ করা হচ্ছে…")}
        </h1>
        <p className="text-muted" style={{ margin: 0 }}>
          <b className="text-white">{docName || L("Contract", "চুক্তি")}</b> · {playbook}
        </p>
      </div>
      <div className="agents">
        {AGENT_ORDER.map((k) => {
          const st = progress[k];
          const info = AGENT_INFO[k];
          const [name, desc] = lang === "bn" ? info.bn : info.en;
          return (
            <div key={k} className={`agent ${st}`}>
              <div className="agentIcon">{info.icon}</div>
              <div>
                <b>{name}</b>
                <p>{desc}</p>
              </div>
              <div className="bar"><i /></div>
              <div className="agentState" style={{ color: st === "done" ? "var(--ok)" : st === "failed" ? "var(--danger)" : "var(--muted)" }}>
                {st === "done" ? <CheckCircle2 size={14} /> : st === "failed" ? <XCircle size={14} /> : <span className="spinner dark" style={{ width: 13, height: 13, borderWidth: 2 }} />}
                {st === "done" ? L("Done", "সম্পন্ন") : st === "failed" ? L("Failed", "ব্যর্থ") : st === "running" ? L("Working…", "কাজ চলছে…") : L("Starting…", "শুরু হচ্ছে…")}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RiskGauge({ score, label }: { score: number; label: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="gauge" aria-label={`Risk score ${score} of 100`}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="8" />
        <circle cx="46" cy="46" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="val">
        <span>
          <b>{score}</b>
          <small>{label}</small>
        </span>
      </div>
    </div>
  );
}

function ResultsWorkspace(props: {
  L: LFn;
  lang: Language;
  result: ContractAnalysisResult;
  tab: ResultTab;
  setTab: (t: ResultTab) => void;
  contractText: string;
  file: File | null;
  docName: string;
  onNew: () => void;
  onRerun: () => void;
  canRerun: boolean;
  onUpdateRedline: (id: string, accepted: boolean | null) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onWeightsChange: (weights: Record<string, number>) => void;
}) {
  const { L, lang, result, tab, setTab } = props;
  const findings = useMemo(() => buildFindings(result, props.contractText), [result, props.contractText]);
  const locatedIds = useMemo(() => new Set(findings.filter((f) => f.start !== undefined).map((f) => f.id)), [findings]);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const showInContract = (id: string) => {
    setSelectedFinding(id);
    setTab("Contract");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const riskWord: Record<string, string> = { Critical: L("Critical risk", "গুরুতর ঝুঁকি"), High: L("High risk", "উচ্চ ঝুঁকি"), Medium: L("Medium risk", "মাঝারি ঝুঁকি"), Low: L("Low risk", "কম ঝুঁকি") };

  const tabs: { id: ResultTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "Analysis", label: L("Overview", "সারসংক্ষেপ"), icon: <LayoutDashboard size={15} /> },
    { id: "Contract", label: L("Contract", "চুক্তি"), icon: <FileText size={15} /> },
    { id: "Redlines", label: L("Redlines", "রেডলাইন"), icon: <FileEdit size={15} />, count: result.redlines.length },
    { id: "Obligations", label: L("Obligations", "বাধ্যবাধকতা"), icon: <ListOrdered size={15} />, count: result.obligations.length },
    { id: "Gold Standard", label: L("Benchmarks", "বেঞ্চমার্ক"), icon: <GitCompare size={15} />, count: result.benchmarkComparisons.length },
    { id: "AI Counsel Chat", label: L("Ask AI", "এআই-কে জিজ্ঞাসা"), icon: <MessageSquare size={15} /> },
  ];

  return (
    <>
      <section className="resultHead">
        <RiskGauge score={result.overallRiskScore} label={L("RISK", "ঝুঁকি")} />
        <div className="grow">
          <div className="eyebrowW">{riskWord[result.riskLevel] || result.riskLevel}{result.isDemo ? ` · ${L("Demo data", "ডেমো ডেটা")}` : ""}</div>
          <h1>{result.contractTitle}</h1>
          <div className="meta">
            {result.parties.slice(0, 3).map((p, i) => (
              <span key={i}><Users size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{p.name} · {p.role}</span>
            ))}
            <span><BookOpen size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{result.playbookUsed}</span>
            {result.modelsUsed?.length ? <span><Zap size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{result.modelsUsed.join(", ")}</span> : null}
          </div>
        </div>
        <div className="actions">
          <button className="ghostW" onClick={props.onRerun} disabled={!props.canRerun}>
            <RotateCcw size={14} /> {L("Re-run", "আবার চালান")}
          </button>
          <button className="ghostW" onClick={props.onNew}>
            <Plus size={15} /> {L("New review", "নতুন পর্যালোচনা")}
          </button>
        </div>
      </section>

      <nav className="tabs" aria-label="Result sections">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </nav>

      <ErrorBoundary fallbackPage={() => setTab("Analysis")}>
        {tab === "Analysis" && (
          <AnalysisOverview
            analysis={result}
            onNavigateTab={(t: string) => setTab(t as ResultTab)}
            scorecard={
              result.scoring ? (
                <PlaybookScorecard
                  scoring={result.scoring}
                  playbookName={result.playbookUsed}
                  onWeightsChange={props.onWeightsChange}
                  lang={lang}
                  locatedIds={locatedIds}
                  onShowInContract={(ruleId) => showInContract(findingId.rule(ruleId))}
                />
              ) : null
            }
          />
        )}
        {tab === "Contract" && (
          <ContractView text={props.contractText} findings={findings} selectedId={selectedFinding} onSelect={setSelectedFinding} lang={lang} />
        )}
        {tab === "Redlines" && (
          props.contractText.startsWith("[Scanned PDF") ? (
            <>
              <div className="notice info"><FileText size={18} /><span>{L("This PDF is scanned, so the clean document export is based on the AI's quotes only.", "এই PDF স্ক্যান করা, তাই ক্লিন ডকুমেন্ট এক্সপোর্ট শুধুমাত্র এআই-এর উদ্ধৃতির উপর ভিত্তি করে।")}</span></div>
              <RedlineViewer originalText={props.contractText} redlines={result.redlines} onUpdateRedline={props.onUpdateRedline} onAcceptAll={props.onAcceptAll} onRejectAll={props.onRejectAll} contractTitle={result.contractTitle} playbookName={result.playbookUsed} locatedIds={locatedIds} onShowInContract={(id) => showInContract(findingId.redline(id))} />
            </>
          ) : (
            <RedlineViewer originalText={props.contractText} redlines={result.redlines} onUpdateRedline={props.onUpdateRedline} onAcceptAll={props.onAcceptAll} onRejectAll={props.onRejectAll} contractTitle={result.contractTitle} playbookName={result.playbookUsed} locatedIds={locatedIds} onShowInContract={(id) => showInContract(findingId.redline(id))} />
          )
        )}
        {tab === "Obligations" && (
          <ObligationsView obligations={result.obligations} paymentMilestones={result.paymentMilestones} contractTitle={result.contractTitle} locatedIds={locatedIds} onShowInContract={(id) => showInContract(findingId.obligation(id))} />
        )}
        {tab === "Gold Standard" && <GoldStandardRAG comparisons={result.benchmarkComparisons} />}
        {tab === "AI Counsel Chat" && (
          <CounselChat contractText={props.contractText || result.summary} file={props.file || undefined} lang={lang} />
        )}
      </ErrorBoundary>
    </>
  );
}
