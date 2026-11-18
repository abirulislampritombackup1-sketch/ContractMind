import { describe, expect, it } from "vitest";
import { addDays, parseRelativeTrigger, resolveMilestoneDates, toCsv, toIcs } from "./milestoneCalendar";
import { findTablePages, mergeMilestones } from "../services/tableVision";
import { sanitizeMilestone } from "../services/gemini";
import type { PaymentMilestone } from "../types";

const ms = (over: Partial<PaymentMilestone>): PaymentMilestone => ({
  id: "M-1",
  milestone: "Kickoff",
  trigger: "On signing",
  amount: "$10,000",
  deliverable: "Plan",
  responsibleParty: "Customer",
  status: "Scheduled",
  ...over,
});

describe("milestone dates", () => {
  it("adds calendar and business days", () => {
    expect(addDays("2025-01-30", 30)).toBe("2025-03-01");
    expect(addDays("2025-01-03", 1, true)).toBe("2025-01-06"); // Friday + 1 business day = Monday
  });

  it("reads relative triggers from text", () => {
    expect(parseRelativeTrigger("within thirty (30) days of the Effective Date")).toEqual({ days: 30, business: false, from: "effective_date" });
    expect(parseRelativeTrigger("10 business days after execution")).toEqual({ days: 10, business: true, from: "effective_date" });
    expect(parseRelativeTrigger("2 months following the Commencement Date")?.days).toBe(60);
    expect(parseRelativeTrigger("15 days from invoice receipt")?.from).toBe("other");
    expect(parseRelativeTrigger("upon final acceptance")).toBeNull();
  });

  it("uses stated dates, offsets, previous milestones and trigger text, and leaves events undated", () => {
    const r = resolveMilestoneDates(
      [
        ms({ id: "A", dueDate: "2025-02-01" }),
        ms({ id: "B", offsetDays: 30, offsetFrom: "effective_date" }),
        ms({ id: "C", offsetDays: 10, offsetFrom: "previous_milestone" }),
        ms({ id: "D", trigger: "60 days post-Effective Date" }),
        ms({ id: "E", trigger: "Upon written acceptance" }),
      ],
      "2025-01-01"
    );
    expect(r.map((x) => [x.m.id, x.date, x.how])).toEqual([
      ["A", "2025-02-01", "stated"],
      ["B", "2025-01-31", "computed"],
      ["C", "2025-02-10", "computed"],
      ["D", "2025-03-02", "computed"],
      ["E", undefined, "event"],
    ]);
  });

  it("cannot date relative milestones without an effective date", () => {
    const r = resolveMilestoneDates([ms({ offsetDays: 30, offsetFrom: "effective_date" })]);
    expect(r[0].how).toBe("event");
  });
});

describe("exports", () => {
  const items = resolveMilestoneDates([ms({ milestone: "Go-live, phase 1; final", dueDate: "2025-05-10", deliverable: "x".repeat(120) }), ms({ id: "M-2", trigger: "On acceptance" })]);

  it("writes a valid all-day .ics event only for dated milestones", () => {
    const ics = toIcs(items, "Cloud MSA", new Date("2025-01-01T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART;VALUE=DATE:20250510");
    expect(ics).toContain("DTEND;VALUE=DATE:20250511");
    expect(ics).toContain("SUMMARY:Go-live\\, phase 1\\; final ($10\\,000)");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("writes CSV with quoting and a UTF-8 BOM", () => {
    const csv = toCsv(items);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Go-live, phase 1; final"');
    expect(csv).toContain("Depends on an event");
  });
});

describe("table vision helpers", () => {
  const chunk = (page: number, text: string) => ({ id: `C${page}`, index: 0, headingPath: "", page, text, overlapChars: 0, embedText: text }) as any;

  it("finds pages that hold payment tables and ignores ordinary text", () => {
    const pages = findTablePages([
      chunk(1, "This Agreement is made between the parties. Definitions follow."),
      chunk(4, "Schedule B - Payment Schedule\n| Milestone | Deliverable | Amount |\n| M-1 | Design | $35,000 |\n| M-2 | Migration | $55,000 |"),
      // A nested table that lost its column markup in text extraction.
      chunk(7, "Phase 2 - Rollout\nMilestone 2.1 Training USD 20,000 20%\nMilestone 2.2 Go-live USD 30,000 30%\nTotal USD 50,000"),
      chunk(9, "Phase 2 milestone payment of USD 20,000 (20%) due on acceptance."), // prose, not a table
    ]);
    expect(pages).toEqual([4, 7]);
    expect(findTablePages([chunk(0, "| a | b |\n| 1 | 2 | $5 milestone payment")])).toEqual([]); // no pages for DOCX/TXT
  });

  it("merges table-image rows with text milestones without duplicates", () => {
    const text = [ms({ id: "M-1", milestone: "Architecture design", amount: "$35,000.00" }), ms({ id: "M-2", milestone: "Data migration", amount: "$55,000" })];
    const images = [
      ms({ id: "T-1", milestone: "Architecture Design blueprint", amount: "$35,000", phase: "Phase 1", page: 4, offsetDays: 30, offsetFrom: "effective_date" }),
      ms({ id: "T-2", milestone: "Training workshop", amount: "$5,000", phase: "Phase 2", page: 4 }),
    ];
    const merged = mergeMilestones(text, images);
    expect(merged.map((m) => [m.id, m.source])).toEqual([["M-1", "both"], ["M-2", "text"], ["T-2", "table-image"]]);
    expect(merged[0]).toMatchObject({ phase: "Phase 1", page: 4, offsetDays: 30 });
  });

  it("cleans milestone rows from the AI", () => {
    const m = sanitizeMilestone({ milestone: "Go-live", dueDate: "May 5", offsetDays: -1, offsetFrom: "nonsense", page: "3" }, 0, "T");
    expect(m).toMatchObject({ id: "T-1", milestone: "Go-live", dueDate: undefined, offsetDays: undefined, offsetFrom: undefined, page: 3, source: "table-image" });
  });
});
