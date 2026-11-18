import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Calendar, Database, Scale, Search, Sparkles, X } from "lucide-react";
import { useLang } from "../i18n/lang";
import { Corpus, CorpusContract, loadContractText, loadCorpus, loadVectors } from "../repository/corpus";
import { CLAUSE_KEYS, describeFilters, ParsedQuery, RepoFilters } from "../repository/query";
import { answerQuestion, searchRepository, SearchResult } from "../repository/search";

interface RepositorySearchProps {
  onLoadContractSnippet: (title: string, text: string) => void;
}

const PAGE = 20;
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// Example questions. The Bangla chips search with their English meaning (contracts and filters are in English).
const EXAMPLES: [string, string][] = [
  ["Contracts with liability caps below $1M", "$১০ লাখের কম দায়সীমার চুক্তি"],
  ["Uncapped liability under Delaware law", "ডেলাওয়্যার আইনে সীমাহীন দায়"],
  ["License agreements with termination for convenience", "ইচ্ছাধীন বাতিলসহ লাইসেন্স চুক্তি"],
  ["Merger agreements with a termination fee", "টার্মিনেশন ফিসহ একীভূতকরণ চুক্তি"],
  ["Distributor agreements with a non-compete under New York law", "নিউ ইয়র্ক আইনে প্রতিযোগিতা-নিষেধসহ ডিস্ট্রিবিউটর চুক্তি"],
];

export const RepositorySearch: React.FC<RepositorySearchProps> = ({ onLoadContractSnippet }) => {
  const { L, bn, num } = useLang();
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [hasVectors, setHasVectors] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [answer, setAnswer] = useState<{ text: string; busy: boolean } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    loadCorpus().then(setCorpus).catch((e) => setError(e.message));
    loadVectors().then((v) => setHasVectors(!!v));
  }, []);
  useEffect(() => {
    if (corpus && !result) run("", { text: "", filters: {}, by: "rules" });
  }, [corpus]);

  async function run(q: string, parsed?: ParsedQuery) {
    setBusy(true);
    setAnswer(null);
    setShown(PAGE);
    try {
      const r = await searchRepository(q, { parsed });
      setResult(r);
      if (q.trim() && !parsed && r.results.length) {
        setAnswer({ text: "", busy: true });
        answerQuestion(q, r.results, bn ? "bn" : "en")
          .then((text) => setAnswer({ text, busy: false }))
          .catch(() => setAnswer(null)); // no AI available: the filtered results still answer the question
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const removeFilter = (key: keyof RepoFilters) => {
    if (!result) return;
    const filters = { ...result.parsed.filters };
    delete filters[key];
    if ((key === "capMaxUSD" || key === "capMinUSD") && filters.capMaxUSD === undefined && filters.capMinUSD === undefined) delete filters.hasDollarCap;
    run(query, { ...result.parsed, filters });
  };

  const open = async (c: CorpusContract) => {
    setOpening(c.id);
    try {
      onLoadContractSnippet(c.title, await loadContractText(c.id));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setOpening(null);
    }
  };

  const total = corpus?.contracts.length || 0;
  const chips = result ? describeFilters(result.parsed.filters) : [];
  const ids = useMemo(() => new Set(result?.results.map((r) => r.c.id)), [result]);
  const withCitations = (text: string) =>
    text.split(/(\[[A-Z]+-[\w-]+\])/g).map((part, i) => {
      const m = part.match(/^\[([A-Z]+-[\w-]+)\]$/);
      return m && ids.has(m[1]) ? (
        <a key={i} href={`#${m[1]}`} className="text-brand font-semibold" onClick={(e) => { e.preventDefault(); document.getElementById(m[1])?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
          {part}
        </a>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
    });

  const liability = (c: CorpusContract) =>
    c.cap.amountUSD
      ? L(`capped at ${usd(c.cap.amountUSD)}`, `সর্বোচ্চ ${usd(c.cap.amountUSD)}`)
      : c.flags.uncappedLiability
      ? L("uncapped for some claims", "কিছু দাবিতে সীমাহীন")
      : c.cap.type === "fees"
      ? L("capped by fees paid", "পরিশোধিত ফি পর্যন্ত সীমিত")
      : c.cap.type === "exclusion"
      ? L("indirect damages excluded, no dollar cap", "পরোক্ষ ক্ষতি বাদ, নির্দিষ্ট অঙ্কের সীমা নেই")
      : c.dataset === "MAUD"
      ? c.terminationFeeUSD
        ? L(`termination fee about ${usd(c.terminationFeeUSD)}`, `টার্মিনেশন ফি প্রায় ${usd(c.terminationFeeUSD)}`)
        : L("merger agreement (no liability cap)", "একীভূতকরণ চুক্তি (দায়সীমা নেই)")
      : L("no cap clause labelled", "দায়সীমার ধারা চিহ্নিত নেই");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2 text-brand text-xs font-bold tracking-wider uppercase mb-1">
            <Database size={15} /> {corpus?.sources.filter((s) => s.count).map((s) => s.dataset).join(" • ") || "CUAD • MAUD"}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{L("Contract repository search", "চুক্তি ভান্ডারে খোঁজ")}</h2>
          <p className="text-muted text-sm mt-1">
            {L(
              "Ask in plain words, e.g. about liability caps, governing law or clauses. The question is turned into filters, then results are ranked by meaning.",
              "সহজ ভাষায় জিজ্ঞাসা করুন, যেমন দায়সীমা, প্রযোজ্য আইন বা ধারা নিয়ে। প্রশ্নটি ফিল্টারে রূপান্তরিত হয়, তারপর অর্থ অনুযায়ী ফলাফল সাজানো হয়।"
            )}
          </p>
        </div>
        <div className="text-xs text-muted bg-surface-solid px-4 py-2 rounded-xl border border-line space-y-0.5">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-brand" />
            <span><b className="text-white">{num(total.toLocaleString("en-US"))}</b> {L("real contracts", "টি বাস্তব চুক্তি")}</span>
          </div>
          <div className="text-[11px] text-faint">
            {hasVectors === null ? "…" : hasVectors ? L("Semantic + keyword search", "অর্থভিত্তিক + কীওয়ার্ড সার্চ") : L("Keyword search (semantic index not built yet)", "কীওয়ার্ড সার্চ (অর্থভিত্তিক ইনডেক্স এখনও তৈরি হয়নি)")}
          </div>
        </div>
      </div>

      {error && (
        <div className="notice error" role="status">
          <X size={16} />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label={L("Dismiss", "বন্ধ করুন")}><X size={14} /></button>
        </div>
      )}

      <div className="bg-surface p-6 rounded-2xl border border-line space-y-4">
        <form className="repoSearch" onSubmit={(e) => { e.preventDefault(); run(query); }}>
          <Search size={18} className="text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L("e.g. liability caps below $1M under Delaware law", "যেমন: liability caps below $1M under Delaware law")}
          />
          <button type="submit" className="primary text-xs" disabled={busy || !corpus}>
            {busy ? <span className="spinner" /> : <Search size={14} />} {L("Search", "খুঁজুন")}
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-faint flex items-center gap-1"><Sparkles size={12} className="text-brand" /> {L("Try:", "চেষ্টা করুন:")}</span>
          {EXAMPLES.map(([en, bnText]) => (
            <button
              key={en}
              onClick={() => { setQuery(en); run(en); }}
              className="text-xs px-3 py-1 rounded-full bg-surface-solid border border-line text-muted hover:text-white hover:border-brand transition-all"
            >
              {L(en, bnText)}
            </button>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-line/60">
            <span className="text-xs text-muted">{result?.parsed.by === "ai" ? L("Filters understood by AI:", "এআই যে ফিল্টার বুঝেছে:") : L("Filters:", "ফিল্টার:")}</span>
            {chips.map((ch) => (
              <button key={ch.key} className="tag brand" onClick={() => removeFilter(ch.key)} title={L("Remove filter", "ফিল্টার সরান")}>
                {ch.label} <X size={11} />
              </button>
            ))}
            {result?.parsed.text && <span className="text-[11px] text-faint">{L("ranked by:", "সাজানোর ভিত্তি:")} “{result.parsed.text}”</span>}
          </div>
        )}
      </div>

      {answer && (
        <div className="bg-surface p-5 rounded-2xl border border-brand/30 space-y-2">
          <div className="text-xs font-bold text-brand flex items-center gap-1.5"><Sparkles size={13} /> {L("Answer", "উত্তর")}</div>
          {answer.busy ? <p className="text-sm text-muted m-0">{L("Reading the matches…", "ফলাফল পড়া হচ্ছে…")}</p> : <p className="text-sm text-white leading-relaxed m-0">{withCitations(answer.text)}</p>}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted px-1 flex-wrap gap-2">
          <span>
            {result
              ? L(`${result.results.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} contracts match`, `${num(total)}টির মধ্যে ${num(result.results.length)}টি চুক্তি মিলেছে`)
              : L("Loading the repository…", "ভান্ডার লোড হচ্ছে…")}
          </span>
          {result && (
            <span>
              {result.semantic ? L("Ranked by meaning and keywords", "অর্থ ও কীওয়ার্ড অনুযায়ী সাজানো") : result.parsed.text ? L("Ranked by keywords", "কীওয়ার্ড অনুযায়ী সাজানো") : L("Sorted by the filter", "ফিল্টার অনুযায়ী সাজানো")}
            </span>
          )}
        </div>

        {result?.results.slice(0, shown).map(({ c, semantic }) => (
          <div key={c.id} id={c.id} className="p-5 rounded-2xl bg-surface border border-line hover:border-line-strong transition-all space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-brand/15 text-brand">{c.id}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-solid border border-line text-brand-2">{c.dataset}</span>
                <h3 className="font-bold text-white text-base" style={{ overflowWrap: "anywhere" }}>{c.title}</h3>
              </div>
              {semantic !== undefined && <span className="simBadge">{L("match", "মিল")} {num(Math.round(semantic * 100))}%</span>}
            </div>

            <div className="flex items-center gap-x-4 gap-y-1 text-xs text-muted flex-wrap">
              {c.parties.length > 0 && (
                <span className="flex items-center gap-1.5 text-white/90" style={{ overflowWrap: "anywhere" }}>
                  <Building2 size={13} className="text-brand" /> {c.parties.slice(0, 3).join(" / ")}
                </span>
              )}
              <span>{c.contractType}</span>
              {c.date && <span className="flex items-center gap-1"><Calendar size={13} className="text-faint" /> {c.date}</span>}
              <span className="flex items-center gap-1"><Scale size={13} className="text-faint" /> {L("Law:", "আইন:")} <b>{c.governingLaw || L("not found", "পাওয়া যায়নি")}</b></span>
            </div>

            <div className="p-3 rounded-xl bg-surface-solid/70 border border-line text-xs leading-relaxed">
              <span className="text-faint">{L("Liability: ", "দায়: ")}</span>
              <b className="text-brand">{liability(c)}</b>
              {c.cap.text && <div className="text-muted font-mono mt-1" style={{ overflowWrap: "anywhere" }}>“{c.cap.text.slice(0, 280)}{c.cap.text.length > 280 ? "…" : ""}”</div>}
              {c.dealPoints && <div className="text-muted mt-1">{c.dealPoints}</div>}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(c.flags)
                  .filter(([k, v]) => v && CLAUSE_KEYS[k] && k !== "capOnLiability")
                  .slice(0, 6)
                  .map(([k]) => <span key={k} className="tag neutral">{CLAUSE_KEYS[k]}</span>)}
              </div>
              <button onClick={() => open(c)} className="secondary text-xs flex items-center gap-1 self-end sm:self-auto" disabled={opening === c.id}>
                {opening === c.id ? <span className="spinner dark" /> : null} {L("Open in review", "পর্যালোচনায় খুলুন")} <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="text-[10.5px] text-faint" style={{ overflowWrap: "anywhere" }}>{L("Source:", "উৎস:")} {c.source}</div>
          </div>
        ))}

        {result && result.results.length > shown && (
          <button className="secondary w-full justify-center" onClick={() => setShown(shown + PAGE)}>
            {L(`Show more (${result.results.length - shown} left)`, `আরও দেখুন (${num(result.results.length - shown)}টি বাকি)`)}
          </button>
        )}
        {result && !result.results.length && (
          <p className="text-sm text-muted px-1">{L("No contracts match. Remove a filter above or rephrase.", "কোনো চুক্তি মেলেনি। উপরের একটি ফিল্টার সরান বা অন্যভাবে লিখুন।")}</p>
        )}
      </div>

      {corpus && (
        <p className="text-[11px] text-faint px-1">
          {L("Data: ", "ডেটা: ")}
          {corpus.sources.filter((s) => s.count).map((s, i) => (
            <span key={s.dataset}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.dataset}</a> ({num(s.count)}, {s.by}, {s.license})
            </span>
          ))}
          . {L("Metadata comes from the datasets' expert labels plus pattern matching, and may be incomplete.", "মেটাডেটা ডেটাসেটের বিশেষজ্ঞ লেবেল ও প্যাটার্ন মিলিয়ে নেওয়া, অসম্পূর্ণ হতে পারে।")}
        </p>
      )}
    </div>
  );
};
