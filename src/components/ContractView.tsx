import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileEdit, FileText, ListOrdered, MapPin, Scale, SearchX } from "lucide-react";
import { Finding, FindingKind, Tone } from "../utils/findings";

interface Props {
  text: string;
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  lang?: "en" | "bn";
}

type Filter = "all" | FindingKind;
const TONE_RANK: Record<Tone, number> = { danger: 3, warn: 2, info: 1, ok: 0 };
const KIND_META: Record<FindingKind, { icon: React.ReactNode; en: string; bn: string }> = {
  redline: { icon: <FileEdit size={13} />, en: "Redline", bn: "রেডলাইন" },
  rule: { icon: <Scale size={13} />, en: "Playbook rule", bn: "প্লেবুক নিয়ম" },
  obligation: { icon: <ListOrdered size={13} />, en: "Obligation", bn: "বাধ্যবাধকতা" },
};

/**
 * The contract itself, with every finding highlighted where it comes from.
 * Clicking a finding scrolls to it; clicking a highlight selects its finding.
 */
export const ContractView: React.FC<Props> = ({ text, findings, selectedId, onSelect, lang = "en" }) => {
  const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const [filter, setFilter] = useState<Filter>("all");
  const docRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(0);
  const fromDoc = useRef(false); // selection made by clicking inside the document

  const visible = findings.filter((f) => filter === "all" || f.kind === filter);
  const located = visible.filter((f) => f.start !== undefined);
  const counts = {
    all: findings.length,
    redline: findings.filter((f) => f.kind === "redline").length,
    rule: findings.filter((f) => f.kind === "rule").length,
    obligation: findings.filter((f) => f.kind === "obligation").length,
  };
  const foundCount = findings.filter((f) => f.start !== undefined).length;

  // Split the text at every highlight boundary; each piece knows which findings cover it.
  const pieces = useMemo(() => {
    const cuts = new Set<number>([0, text.length]);
    for (const f of located) {
      cuts.add(f.start!);
      cuts.add(f.end!);
    }
    const sorted = [...cuts].sort((a, b) => a - b);
    const out: { s: number; e: number; ids: Finding[] }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i];
      const e = sorted[i + 1];
      if (e <= s) continue;
      out.push({ s, e, ids: located.filter((f) => f.start! <= s && f.end! >= e) });
    }
    return out;
  }, [text, located]);

  // Scroll the document (and the list) to the selected finding.
  useEffect(() => {
    if (!selectedId) return;
    const mark = docRef.current?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(selectedId)}"]`);
    if (mark && docRef.current) {
      const pane = docRef.current;
      pane.scrollTo({ top: mark.offsetTop - pane.clientHeight / 3, behavior: "smooth" });
      setFlash((n) => n + 1);
      // On narrow screens the document sits below the list — bring it into view.
      if (!fromDoc.current && window.matchMedia("(max-width: 900px)").matches) {
        pane.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    fromDoc.current = false;
    // Keep the selected item visible in the list without scrolling the whole page.
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-item="${CSS.escape(selectedId)}"]`);
    if (list && item) {
      const top = item.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTo({ top: top - 8, behavior: "smooth" });
      }
    }
  }, [selectedId]);

  const anchorsDone = new Set<string>();
  const renderPlain = (chunk: string, key: string) =>
    chunk.split(/(\n?\[Page \d+\]\n?)/).map((part, i) => {
      const m = part.match(/\[Page (\d+)\]/);
      return m ? (
        <span key={`${key}-${i}`} className="pageMark">{L("Page", "পৃষ্ঠা")} {m[1]}</span>
      ) : (
        <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
      );
    });

  if (!text.trim() || text.startsWith("[Scanned PDF")) {
    return (
      <div className="card empty">
        <FileText size={32} />
        <h3>{L("Document text not available", "ডকুমেন্টের টেক্সট পাওয়া যায়নি")}</h3>
        <p>{L("This was a scanned PDF read visually by the AI, so there is no text layer to highlight.", "এটি স্ক্যান করা PDF, এআই ছবি থেকে পড়েছে — তাই হাইলাইট করার মতো টেক্সট নেই।")}</p>
      </div>
    );
  }

  return (
    <div className="cv">
      <aside className="cvSide card">
        <div className="cvSideHead">
          <h3>{L("Findings", "ফলাফল")}</h3>
          <span className="tag ok"><MapPin size={11} /> {foundCount}/{findings.length} {L("located", "চিহ্নিত")}</span>
        </div>
        <div className="cvFilters">
          {(["all", "redline", "rule", "obligation"] as Filter[]).map((k) =>
            counts[k] > 0 || k === "all" ? (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                {k === "all" ? L("All", "সব") : L(KIND_META[k].en + "s", KIND_META[k].bn)} <span>{counts[k]}</span>
              </button>
            ) : null
          )}
        </div>
        <div className="cvList" ref={listRef}>
          {visible.map((f) => {
            const sel = f.id === selectedId;
            return (
              <button key={f.id} data-item={f.id} className={`cvItem ${f.tone} ${sel ? "sel" : ""}`} onClick={() => onSelect(sel ? null : f.id)}>
                <div className="cvItemTop">
                  <span className="cvKind">{KIND_META[f.kind].icon} {L(KIND_META[f.kind].en, KIND_META[f.kind].bn)}</span>
                  <span className="cvRef">{f.ref}</span>
                  {f.start === undefined ? (
                    <span className="tag neutral"><SearchX size={11} /> {f.ref === "Missing" ? L("Missing", "অনুপস্থিত") : L("Not located", "পাওয়া যায়নি")}</span>
                  ) : (
                    <span className="tag ok"><MapPin size={11} /> {f.how === "quote" ? L("Exact quote", "হুবহু উদ্ধৃতি") : L("Section", "ধারা")}</span>
                  )}
                </div>
                <b>{f.title}</b>
                {sel && <p>{f.detail}</p>}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="cvDocWrap card">
        <div className="cvLegend">
          <span><i className="hl danger" /> {L("High risk", "উচ্চ ঝুঁকি")}</span>
          <span><i className="hl warn" /> {L("Needs attention", "মনোযোগ প্রয়োজন")}</span>
          <span><i className="hl info" /> {L("Obligation", "বাধ্যবাধকতা")}</span>
          <span><i className="hl ok" /> {L("Meets playbook", "প্লেবুক অনুযায়ী")}</span>
        </div>
        <div className="cvDoc" ref={docRef}>
          {pieces.map((p, i) => {
            const chunk = text.slice(p.s, p.e);
            if (!p.ids.length) return <React.Fragment key={i}>{renderPlain(chunk, String(i))}</React.Fragment>;
            const top = [...p.ids].sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone])[0];
            const selHere = p.ids.find((f) => f.id === selectedId);
            const anchors = p.ids.filter((f) => !anchorsDone.has(f.id));
            anchors.forEach((f) => anchorsDone.add(f.id));
            return (
              <mark
                key={selHere ? `${i}-${flash}` : i}
                className={`hl ${(selHere || top).tone} ${selHere ? "sel" : ""}`}
                data-anchor={anchors[0]?.id}
                title={p.ids.map((f) => `${L(KIND_META[f.kind].en, KIND_META[f.kind].bn)} · ${f.title}`).join("\n")}
                onClick={() => {
                  // Pick the most specific finding here; repeat clicks cycle through overlaps.
                  const ordered = [...p.ids].sort((a, b) => a.end! - a.start! - (b.end! - b.start!));
                  const idx = ordered.findIndex((f) => f.id === selectedId);
                  fromDoc.current = true;
                  onSelect(ordered[(idx + 1) % ordered.length].id);
                }}
              >
                {anchors.slice(1).map((f) => <span key={f.id} data-anchor={f.id} />)}
                {renderPlain(chunk, `m${i}`)}
              </mark>
            );
          })}
        </div>
      </div>
    </div>
  );
};
