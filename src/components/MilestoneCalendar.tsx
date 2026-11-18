import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileSpreadsheet, ListTree, ScanEye } from "lucide-react";
import type { PaymentMilestone } from "../types";
import { useLang } from "../i18n/lang";
import { downloadText, resolveMilestoneDates, ResolvedMilestone, toCsv, toIcs } from "../utils/milestoneCalendar";

interface Props {
  milestones: PaymentMilestone[];
  contractTitle: string;
  effectiveDate?: string; // found in the contract
  tableVision?: { pages: number[]; rows: number };
}

const partyTone = (p: string) => (/customer|buyer|licensee|client/i.test(p) ? "warn" : /vendor|provider|seller|supplier|licensor/i.test(p) ? "brand" : "neutral");

export const MilestoneCalendar: React.FC<Props> = ({ milestones, contractTitle, effectiveDate, tableVision }) => {
  const { L, bn, num, term, sec } = useLang();
  const [effective, setEffective] = useState(effectiveDate || "");
  const [mode, setMode] = useState<"calendar" | "timeline">("timeline");
  const resolved = useMemo(() => resolveMilestoneDates(milestones, effective || undefined), [milestones, effective]);
  const dated = resolved.filter((r) => r.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = resolved.filter((r) => !r.date);
  const [month, setMonth] = useState(() => (dated[0]?.date || effective || new Date().toISOString().slice(0, 10)).slice(0, 7));

  const locale = bn ? "bn-BD" : "en-GB";
  const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const basisText = (r: ResolvedMilestone) => {
    if (r.how === "stated") return L("Date stated in the contract", "চুক্তিতে লেখা তারিখ");
    const m = r.basis.match(/^(effective|previous)\+(\d+)(b?)$/);
    if (!m) return r.basis;
    const days = num(m[2]);
    const unit = m[3] ? L("business days", "কর্মদিবস") : L("days", "দিন");
    return m[1] === "effective" ? L(`Effective date + ${days} ${unit}`, `কার্যকর তারিখ + ${days} ${unit}`) : L(`Previous milestone + ${days} ${unit}`, `আগের মাইলস্টোন + ${days} ${unit}`);
  };
  const slug = contractTitle.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Contract";

  // Month grid (weeks start on Monday)
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }));
  const monthLabel = first.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });

  const sourceTag = (m: PaymentMilestone) =>
    m.source === "table-image" || m.source === "both" ? (
      <span className="tag brand" title={L("Read from the table image", "টেবিলের ছবি থেকে পড়া")}>
        <ScanEye size={11} /> {L("table image", "টেবিলের ছবি")}
        {m.page ? ` · ${L("p.", "পৃ.")} ${num(m.page)}` : ""}
      </span>
    ) : null;

  const item = (r: ResolvedMilestone) => (
    <div key={r.m.id} className={`msItem ${partyTone(r.m.responsibleParty)}`}>
      <div className="msItemTop">
        <span className="scRuleId">{r.m.id}</span>
        <b>{r.m.milestone}</b>
        <span className="msAmount">{r.m.amount}</span>
      </div>
      {r.m.phase && <small className="text-faint">{r.m.phase}</small>}
      <small className="text-muted">{r.m.deliverable}</small>
      <div className="msItemFoot">
        <span className={`tag ${partyTone(r.m.responsibleParty)}`}>{term(r.m.responsibleParty)}</span>
        <span className="tag neutral">{term(r.m.status)}</span>
        {sourceTag(r.m)}
        <small className="text-faint">{r.date ? basisText(r) : `${L("Due when:", "কখন:")} ${sec(r.m.trigger)}`}</small>
      </div>
    </div>
  );

  return (
    <div className="bg-surface p-6 rounded-2xl border border-line space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b border-line">
        <div>
          <h3 className="font-bold text-white text-base">{L("Payment milestone calendar", "পেমেন্ট মাইলস্টোন ক্যালেন্ডার")}</h3>
          <p className="text-xs text-muted mt-0.5">
            {L(
              `${num(dated.length)} of ${num(resolved.length)} milestones have a date; the rest depend on an event such as acceptance.`,
              `${num(resolved.length)}টি মাইলস্টোনের মধ্যে ${num(dated.length)}টির তারিখ আছে; বাকিগুলো কোনো ঘটনার (যেমন গ্রহণ) উপর নির্ভর করে।`
            )}
          </p>
        </div>
        {tableVision && tableVision.pages.length > 0 && (
          <div className="text-xs px-3 py-1 rounded-full bg-brand/15 text-brand font-bold flex items-center gap-1.5">
            <ScanEye size={13} />
            {L(
              `Vision agent read ${tableVision.rows} table row(s) from page ${tableVision.pages.join(", ")}`,
              `ভিশন এজেন্ট পৃষ্ঠা ${num(tableVision.pages.join(", "))} থেকে ${num(tableVision.rows)}টি টেবিল সারি পড়েছে`
            )}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <label className="pbLabel">
          {L("Effective date (from the contract, or set it)", "কার্যকর তারিখ (চুক্তি থেকে, অথবা নিজে দিন)")}
          <input className="pbField" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} style={{ width: 190 }} />
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="seg">
            <button className={mode === "timeline" ? "on" : ""} onClick={() => setMode("timeline")}><ListTree size={14} className="inline mr-1.5" /> {L("Timeline", "সময়রেখা")}</button>
            <button className={mode === "calendar" ? "on" : ""} onClick={() => setMode("calendar")}><CalendarDays size={14} className="inline mr-1.5" /> {L("Calendar", "ক্যালেন্ডার")}</button>
          </div>
          <button className="secondary text-xs" disabled={!dated.length} onClick={() => downloadText(toIcs(resolved, contractTitle), `${slug}_Milestones.ics`, "text/calendar")}>
            <Download size={14} /> {L("Add to calendar (.ics)", "ক্যালেন্ডারে যোগ (.ics)")}
          </button>
          <button className="secondary text-xs" onClick={() => downloadText(toCsv(resolved), `${slug}_Milestones.csv`, "text/csv")}>
            <FileSpreadsheet size={14} /> CSV
          </button>
        </div>
      </div>

      {!effective && resolved.some((r) => r.how === "event" && /effective|commencement|execution|signing/i.test(r.m.trigger)) && (
        <div className="notice info" style={{ margin: 0 }}>
          <CalendarDays size={16} />
          <span>{L("Some milestones count from the effective date. Enter it above to place them on the calendar.", "কিছু মাইলস্টোন কার্যকর তারিখ থেকে গোনা হয়। ক্যালেন্ডারে দেখাতে উপরে তারিখটি দিন।")}</span>
        </div>
      )}

      {mode === "timeline" ? (
        <div className="msTimeline">
          {dated.map((r) => (
            <div key={r.m.id} className="msRow">
              <div className="msDate">
                <b>{fmtDate(r.date!)}</b>
                <small>{r.how === "computed" ? L("calculated", "হিসাব করা") : L("stated", "লেখা")}</small>
              </div>
              {item(r)}
            </div>
          ))}
          {undated.length > 0 && (
            <>
              <div className="apLaneLabel" style={{ marginTop: 6 }}>{L("Depends on an event", "কোনো ঘটনার উপর নির্ভরশীল")}</div>
              {undated.map((r) => (
                <div key={r.m.id} className="msRow">
                  <div className="msDate"><b>—</b></div>
                  {item(r)}
                </div>
              ))}
            </>
          )}
          {!resolved.length && <p className="text-xs text-muted">{L("No payment milestones were found.", "কোনো পেমেন্ট মাইলস্টোন পাওয়া যায়নি।")}</p>}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <button className="iconBtn" onClick={() => shift(-1)} aria-label={L("Previous month", "আগের মাস")}><ChevronLeft size={16} /></button>
            <b className="text-sm text-white">{monthLabel}</b>
            <button className="iconBtn" onClick={() => shift(1)} aria-label={L("Next month", "পরের মাস")}><ChevronRight size={16} /></button>
          </div>
          <div className="msGrid">
            {weekdays.map((w) => <span key={w} className="msWd">{w}</span>)}
            {cells.map((d, i) => {
              const iso = d ? `${month}-${String(d).padStart(2, "0")}` : "";
              const events = d ? dated.filter((r) => r.date === iso) : [];
              return (
                <div key={i} className={`msCell ${d ? "" : "empty"} ${events.length ? "has" : ""}`}>
                  {d && <span className="msDay">{num(d)}</span>}
                  {events.map((r) => (
                    <span key={r.m.id} className={`msEvent ${partyTone(r.m.responsibleParty)}`} title={`${r.m.milestone} · ${r.m.amount}`}>
                      {r.m.amount} · {r.m.milestone}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          {dated.length > 0 && (
            <p className="text-[11px] text-faint mt-2">
              {L("Months with milestones: ", "মাইলস্টোন আছে এমন মাস: ")}
              {[...new Set(dated.map((r) => r.date!.slice(0, 7)))].map((mm) => (
                <button key={mm} className="linkBtn" onClick={() => setMonth(mm)}>
                  {new Date(`${mm}-01T00:00:00Z`).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" })}
                </button>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
