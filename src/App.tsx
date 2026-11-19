import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
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

import { AgentRun, ContractAnalysisResult, Playbook } from "./types";
import { DEFAULT_PLAYBOOKS } from "./data/playbooks";
import { REAL_SAMPLES, RealSample } from "./data/realSamples";
import { loadContractText } from "./repository/corpus";
import { runContractIntelligence, AgentKey, AgentState } from "./services/gemini";
import { RAG_CONFIG } from "./rag/config";
import { indexDocument } from "./rag";
import { analysisKey, getCachedAnalysis, saveAnalysis } from "./utils/analysisCache";
import { isCustom, loadCustomPlaybooks, playbookProblems, saveCustomPlaybooks } from "./utils/playbookStore";
import { openRiskReport } from "./utils/riskReport";
import { loadDemoRun, replayPipeline } from "./utils/demoRuns";
import { pageAt } from "./utils/obligationsExport";
import { Language } from "./i18n/translations";
import { LangProvider, toBnDigits } from "./i18n/lang";
import { playbookText, playbookLabel, TERMS_BN } from "./i18n/dataBn";
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
import { AgentPipeline, AgentRunsCard, PIPELINE_ORDER } from "./components/AgentPipeline";
import { HowItWorks } from "./components/HowItWorks";
import { GeminiStatusPill } from "./components/GeminiStatusPill";
import { buildFindings, findingId } from "./utils/findings";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Dev only: save the last live analysis of a sample as its demo run (see vite.config.ts).
if (import.meta.env.DEV) {
  (window as any).__cmSaveDemoRun = async () => {
    const run = (window as any).__cmLastRun;
    if (!run) throw new Error("Analyse a sample contract first (live, not a saved run).");
    const res = await fetch("/__demo/save", { method: "POST", body: JSON.stringify({ ...run, recordedAt: new Date().toISOString() }) });
    return res.json();
  };
}


type View = "review" | "playbooks" | "library" | "about";
type ResultTab = "Analysis" | "Contract" | "Redlines" | "Obligations" | "Gold Standard" | "AI Counsel Chat";
type Notice = { text: string; kind: "info" | "ok" | "warn" | "error" } | null;
type Progress = Record<AgentKey, AgentState | "waiting">;

const IDLE_PROGRESS: Progress = { risk: "waiting", opposing: "waiting", redlines: "waiting", obligations: "waiting", tables: "waiting", benchmarks: "waiting" };

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
  const pbName = (pb: Playbook) => playbookText(pb, lang === "bn").name;

  const [view, setView] = useState<View>("review");
  const [resultTab, setResultTab] = useState<ResultTab>("Analysis");
  const [showResults, setShowResults] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [contractText, setContractText] = useState<string>("");
  const [busyExtracting, setBusyExtracting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [customPlaybooks, setCustomPlaybooks] = useState<Playbook[]>(loadCustomPlaybooks);
  const [currentPlaybook, setCurrentPlaybook] = useState<Playbook>(
    () => [...DEFAULT_PLAYBOOKS, ...customPlaybooks].find((p) => p.id === store.get("cm-playbook")) || DEFAULT_PLAYBOOKS[0]
  );
  useEffect(() => saveCustomPlaybooks(customPlaybooks), [customPlaybooks]);
  useEffect(() => store.set("cm-playbook", currentPlaybook.id), [currentPlaybook.id]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);
  const [runs, setRuns] = useState<Partial<Record<AgentKey, AgentRun>>>({});
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

  // Background indexing for retrieval. Failures are harmless: the analysis falls back to
  // sending the whole document.
  const prepareIndex = (f: File, text: string) => {
    if (!RAG_CONFIG.enabled) return;
    indexDocument({ file: f, text, name: f.name }).catch((e) =>
      console.warn("[ContractMind] Could not index the document for retrieval:", e?.message || e)
    );
  };

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
        // Index once on upload (convert → chunk → embed → store); analysis and chat reuse it.
        if (hasText) prepareIndex(f, extracted);
        if (!hasText) {
          setNotice({ kind: "info", text: L("Scanned PDF detected — the AI will read the page images directly.", "স্ক্যান করা PDF — এআই সরাসরি পৃষ্ঠার ছবি পড়বে।") });
        }
      } else if (name.endsWith(".docx")) {
        const docxText = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
        setContractText(docxText);
        prepareIndex(f, docxText);
      } else if (f.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
        const plain = await f.text();
        setContractText(plain);
        prepareIndex(f, plain);
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

  // Samples are real contracts from the repository; their text is fetched on click.
  const [sampleId, setSampleId] = useState<string | null>(null);
  const handleLoadSample = async (sample: RealSample) => {
    setBusyExtracting(true);
    setNotice(null);
    setFile(null);
    try {
      const text = await loadContractText(sample.id);
      setDocName(sample.name);
      setContractText(text);
      setSampleId(sample.id);
    } catch (e: any) {
      setNotice({ kind: "error", text: L(`Could not load the sample: ${e?.message || e}`, `স্যাম্পল লোড করা যায়নি: ${e?.message || e}`) });
    } finally {
      setBusyExtracting(false);
    }
  };

  const clearDoc = () => {
    setSampleId(null);
    setFile(null);
    setDocName("");
    setContractText("");
  };

  // ── Run the multi-agent analysis ───────────────────────────────────────────
  // force = true skips the saved result (the Re-run button).
  const handleRunAnalysis = async (force = false) => {
    if (!hasDoc) {
      setNotice({ kind: "warn", text: L("Add a contract first — upload a file or pick a sample.", "প্রথমে একটি চুক্তি যোগ করুন — ফাইল আপলোড করুন বা স্যাম্পল বেছে নিন।") });
      return;
    }
    if (isCustom(currentPlaybook) && playbookProblems(currentPlaybook).length) {
      setNotice({ kind: "warn", text: L("Your custom playbook is incomplete: give every rule a title, target standard and weight.", "আপনার কাস্টম প্লেবুক অসম্পূর্ণ: প্রতিটি নিয়মের শিরোনাম, কাঙ্ক্ষিত মান ও ওজন দিন।") });
      setView("playbooks");
      return;
    }
    setView("review");
    setIsAnalyzing(true);
    setNotice(null);
    setProgress(IDLE_PROGRESS);
    setRuns({});
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const onProgress = (agent: AgentKey, state: AgentState, run?: AgentRun) => {
        setProgress((p) => ({ ...p, [agent]: state }));
        if (run) setRuns((r) => ({ ...r, [agent]: run }));
      };
      // Sample contracts with the default playbook replay a saved real run (no API calls).
      const demo = !force && sampleId && !file ? await loadDemoRun(sampleId, currentPlaybook.id, lang) : null;
      if (demo) await replayPipeline(demo.result.agentRuns, onProgress);
      const key = demo ? "" : await analysisKey({ file, text: contractText, playbook: currentPlaybook, lang }).catch(() => "");
      const cached = !demo && !force && key ? await getCachedAnalysis(key) : null;
      const result = demo
        ? { ...demo.result, demoReplay: { recordedAt: demo.recordedAt } }
        : cached ?? (await runContractIntelligence(contractText, currentPlaybook, file || undefined, lang, onProgress));
      if (!demo && !cached && key) saveAnalysis(key, result);
      if (import.meta.env.DEV && sampleId && !file && !demo) {
        // Dev only: lets a maintainer save this live run as the sample's demo (window.__cmSaveDemoRun()).
        (window as any).__cmLastRun = { sampleId, lang, playbookId: currentPlaybook.id, result };
      }
      setAnalysisResult(result);
      setAnalyzed({ text: contractText, file, name: docName });
      setShowResults(true);
      setResultTab("Analysis");
      if (cached) {
        setNotice({ kind: "info", text: L("Showing your saved result for this contract and playbook. Click Re-run for a fresh analysis.", "এই চুক্তি ও প্লেবুকের সংরক্ষিত ফলাফল দেখানো হচ্ছে। নতুন বিশ্লেষণের জন্য আবার চালান চাপুন।") });
      } else if (result.isDemo) {
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

  // Logo → landing page. The last result stays reachable via the "Open results" banner.
  const goHome = () => {
    setView("review");
    setShowResults(false);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LangProvider lang={lang}>
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
            <button className={view === "review" ? "on" : ""} onClick={() => setView("review")}>
              <FileSearch size={15} /> <span className="lbl">{L("Review", "পর্যালোচনা")}</span>
            </button>
            <button className={view === "playbooks" ? "on" : ""} onClick={() => setView("playbooks")}>
              <Sliders size={15} /> <span className="lbl">{L("Playbooks", "প্লেবুক")}</span>
            </button>
            <button className={view === "library" ? "on" : ""} onClick={() => setView("library")}>
              <Database size={15} /> <span className="lbl">{L("Library", "লাইব্রেরি")}</span>
            </button>
            <button className={view === "about" ? "on" : ""} onClick={() => setView("about")}>
              <Info size={15} /> <span className="lbl">{L("How it works", "কীভাবে কাজ করে")}</span>
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
          <AnalyzingScreen L={L} lang={lang} progress={progress} runs={runs} docName={docName} playbook={pbName(currentPlaybook)} />
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
            onRerun={() => handleRunAnalysis(true)}
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
                  {REAL_SAMPLES.map((s) => (
                    <button
                      key={s.id}
                      className={`sample ${!file && sampleId === s.id && docName === s.name ? "on" : ""}`}
                      onClick={() => handleLoadSample(s)}
                      disabled={busyExtracting}
                      title={s.source}
                    >
                      <span className="tag brand">{s.badge}</span>
                      <b>{lang === "bn" ? s.nameBn : s.name}</b>
                      <small>{lang === "bn" ? s.typeBn : s.type}</small>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-faint" style={{ margin: "8px 2px 0" }}>
                  {L("Samples are real public contracts filed with the SEC, from the CUAD v1 and MAUD datasets (The Atticus Project, CC BY 4.0).", "স্যাম্পলগুলো SEC-এ দাখিল করা বাস্তব পাবলিক চুক্তি, CUAD v1 ও MAUD ডেটাসেট থেকে (The Atticus Project, CC BY 4.0)।")}
                </p>
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
                  {[...DEFAULT_PLAYBOOKS, ...customPlaybooks].map((pb) => (
                    <button
                      key={pb.id}
                      className={`pbOpt ${currentPlaybook.id === pb.id ? "on" : ""}`}
                      onClick={() => setCurrentPlaybook(pb)}
                      aria-pressed={currentPlaybook.id === pb.id}
                    >
                      <span className="radio" />
                      <span>
                        <b>{playbookText(pb, lang === "bn").badge}</b>
                        <small>{pbName(pb)}</small>
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
                  <button className="primary bigBtn" disabled={!hasDoc || busyExtracting} onClick={() => handleRunAnalysis()}>
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
              desc={L("Pick a ready-made playbook or build your own. The selected playbook is used for the next analysis.", "তৈরি প্লেবুক বেছে নিন অথবা নিজের প্লেবুক বানান। নির্বাচিত প্লেবুক পরবর্তী বিশ্লেষণে ব্যবহৃত হবে।")}
              action={
                <button className="primary" onClick={() => setView("review")}>
                  {L("Use & continue", "ব্যবহার করে এগিয়ে যান")} <ArrowRight size={15} />
                </button>
              }
            />
            <PlaybookStudio
              currentPlaybook={currentPlaybook}
              onSelectPlaybook={setCurrentPlaybook}
              customPlaybooks={customPlaybooks}
              onCustomChange={setCustomPlaybooks}
            />
          </>
        )}

        {/* ───────────── LIBRARY ───────────── */}
        {view === "library" && (
          <>
            <PageIntro
              title={L("Contract library", "চুক্তি লাইব্রেরি")}
              desc={L("Search real contracts from CUAD v1 and MAUD in plain words, by liability cap, governing law or clause, and open any of them for review.", "CUAD v1 ও MAUD-এর বাস্তব চুক্তি সহজ ভাষায় খুঁজুন: দায়সীমা, প্রযোজ্য আইন বা ধারা দিয়ে, এবং যেকোনোটি পর্যালোচনার জন্য খুলুন।")}
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

        {/* ───────────── HOW IT WORKS ───────────── */}
        {view === "about" && (
          <>
            <PageIntro
              title={L("How ContractMind works", "ContractMind কীভাবে কাজ করে")}
              desc={L("Contract review with six AI agents, retrieval over your contract and a 650-contract repository, and outputs you can export.", "ছয়টি এআই এজেন্ট, আপনার চুক্তি ও ৬৫০টি চুক্তির ভান্ডারে খোঁজ, এবং এক্সপোর্টযোগ্য ফলাফল দিয়ে চুক্তি পর্যালোচনা।")}
            />
            <HowItWorks onOpen={(v) => { setView(v); window.scrollTo({ top: 0 }); }} />
          </>
        )}

      </main>

      <GeminiStatusPill />
      <footer>
        <Lock size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} />
        {L("ContractMind · AI-assisted review, not legal advice", "কন্ট্রাক্টমাইন্ড · এআই-সহায়িত পর্যালোচনা, আইনি পরামর্শ নয়")}
      </footer>
    </div>
    </LangProvider>
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

function AnalyzingScreen({ L, lang, progress, runs, docName, playbook }: { L: LFn; lang: Language; progress: Progress; runs: Partial<Record<AgentKey, AgentRun>>; docName: string; playbook: string }) {
  const done = PIPELINE_ORDER.filter((k) => progress[k] === "done").length;
  return (
    <section style={{ maxWidth: 1080, margin: "10px auto 0" }}>
      <div className="text-center" style={{ marginBottom: 26 }}>
        <div className="heroBadge" style={{ marginBottom: 14 }}>
          <span>{lang === "bn" ? toBnDigits(`${done}/${PIPELINE_ORDER.length}`) : `${done}/${PIPELINE_ORDER.length}`}</span> {L("agents finished", "এজেন্ট সম্পন্ন")}
        </div>
        <h1 style={{ font: "800 30px/1.2 'Plus Jakarta Sans', 'Noto Sans Bengali', sans-serif", letterSpacing: "-0.8px", margin: "0 0 8px" }}>
          {L("Analyzing your contract…", "আপনার চুক্তি বিশ্লেষণ করা হচ্ছে…")}
        </h1>
        <p className="text-muted" style={{ margin: 0 }}>
          <b className="text-white">{docName || L("Contract", "চুক্তি")}</b> · {playbook}
        </p>
      </div>
      <AgentPipeline states={progress} runs={runs} />
    </section>
  );
}

function RiskGauge({ score, label, lang }: { score: number; label: string; lang: Language }) {
  const toBnDigitsIf = (n: number) => (lang === "bn" ? toBnDigits(String(n)) : String(n));
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="gauge" aria-label={`${label} ${score}/100`}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="8" />
        <circle cx="46" cy="46" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="val">
        <span>
          <b>{toBnDigitsIf(score)}</b>
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
  const obligationPages = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of findings) {
      if (f.kind !== "obligation" || f.start === undefined) continue;
      const page = pageAt(props.contractText, f.start);
      if (page) out[f.id.replace(/^obl:/, "")] = page;
    }
    return out;
  }, [findings, props.contractText]);
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
        <RiskGauge score={result.overallRiskScore} label={L("RISK", "ঝুঁকি")} lang={lang} />
        <div className="grow">
          <div className="eyebrowW">
            {riskWord[result.riskLevel] || result.riskLevel}
            {result.isDemo ? ` · ${L("Demo data", "ডেমো ডেটা")}` : ""}
            {result.demoReplay && (
              <span className="savedRun" title={L("A real analysis of this sample, saved so the demo needs no API calls. Re-run asks the AI again.", "এই স্যাম্পলের একটি আসল বিশ্লেষণ, সংরক্ষিত যাতে ডেমোতে API কল না লাগে। আবার চালান চাপলে এআই নতুন করে বিশ্লেষণ করে।")}>
                {L("Saved run", "সংরক্ষিত বিশ্লেষণ")} · {result.demoReplay.recordedAt.slice(0, 10)}
              </span>
            )}
          </div>
          <h1>{result.contractTitle}</h1>
          <div className="meta">
            {result.parties.slice(0, 3).map((p, i) => (
              <span key={i}><Users size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{p.name} · {lang === "bn" ? TERMS_BN[p.role] ?? p.role : p.role}</span>
            ))}
            <span><BookOpen size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{playbookLabel(result.playbookUsed, lang === "bn")}</span>
            {result.modelsUsed?.length ? <span><Zap size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{result.modelsUsed.join(", ")}</span> : null}
          </div>
        </div>
        <div className="actions">
          <button
            className="ghostW"
            onClick={() => openRiskReport(result, playbookLabel(result.playbookUsed, lang === "bn"), lang)}
            title={L("Opens the print dialog; choose Save as PDF", "প্রিন্ট ডায়ালগ খোলে; Save as PDF বেছে নিন")}
          >
            <Download size={14} /> {L("Risk report (PDF)", "ঝুঁকি প্রতিবেদন (PDF)")}
          </button>
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
            {t.count !== undefined && <span className="count">{lang === "bn" ? toBnDigits(String(t.count)) : t.count}</span>}
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
                  playbookName={playbookLabel(result.playbookUsed, lang === "bn")}
                  onWeightsChange={props.onWeightsChange}
                  lang={lang}
                  locatedIds={locatedIds}
                  onShowInContract={(ruleId) => showInContract(findingId.rule(ruleId))}
                />
              ) : null
            }
          />
        )}
        {tab === "Analysis" && <AgentRunsCard runs={result.agentRuns} />}
        {tab === "Contract" && (
          <ContractView text={props.contractText} findings={findings} selectedId={selectedFinding} onSelect={setSelectedFinding} lang={lang} />
        )}
        {tab === "Redlines" && (
          props.contractText.startsWith("[Scanned PDF") ? (
            <>
              <div className="notice info"><FileText size={18} /><span>{L("This PDF is scanned, so the clean document export is based on the AI's quotes only.", "এই PDF স্ক্যান করা, তাই ক্লিন ডকুমেন্ট এক্সপোর্ট শুধুমাত্র এআই-এর উদ্ধৃতির উপর ভিত্তি করে।")}</span></div>
              <RedlineViewer originalText={props.contractText} redlines={result.redlines} onUpdateRedline={props.onUpdateRedline} onAcceptAll={props.onAcceptAll} onRejectAll={props.onRejectAll} contractTitle={result.contractTitle} playbookName={result.playbookUsed} locatedIds={locatedIds} onShowInContract={(id) => showInContract(findingId.redline(id))} findings={result.opposingFindings} rationaleCheck={result.rationaleCheck} />
            </>
          ) : (
            <RedlineViewer originalText={props.contractText} redlines={result.redlines} onUpdateRedline={props.onUpdateRedline} onAcceptAll={props.onAcceptAll} onRejectAll={props.onRejectAll} contractTitle={result.contractTitle} playbookName={result.playbookUsed} locatedIds={locatedIds} onShowInContract={(id) => showInContract(findingId.redline(id))} findings={result.opposingFindings} rationaleCheck={result.rationaleCheck} />
          )
        )}
        {tab === "Obligations" && (
          <ObligationsView obligations={result.obligations} paymentMilestones={result.paymentMilestones} contractTitle={result.contractTitle} effectiveDate={result.effectiveDate} tableVision={result.tableVision} pages={obligationPages} playbook={result.playbookUsed} locatedIds={locatedIds} onShowInContract={(id) => showInContract(findingId.obligation(id))} />
        )}
        {tab === "Gold Standard" && <GoldStandardRAG comparisons={result.benchmarkComparisons} missing={result.missingProtections} search={result.goldSearch} />}
        {tab === "AI Counsel Chat" && (
          <CounselChat contractText={props.contractText || result.summary} file={props.file || undefined} lang={lang} />
        )}
      </ErrorBoundary>
    </>
  );
}
