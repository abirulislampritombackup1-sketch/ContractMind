import { describe, expect, it } from "vitest";
import { buildRedlinedDocument, reconciledText, redlinedHtml } from "./redlineDocument";
import { buildObligationsExport, pageAt, validateObligationsExport } from "./obligationsExport";
import { ensureRationales, hasRationale } from "../services/gemini";
import type { Obligation, RedlineItem } from "../types";

const cot = { opposingCounselStance: "a", commercialRiskAssessment: "b", legalRationale: "c", negotiationTalkingPoint: "d" };
const red = (over: Partial<RedlineItem>): RedlineItem => ({
  id: "RED-01",
  clauseId: "Section 1",
  sectionTitle: "Cap",
  originalText: "",
  proposedText: "",
  action: "replace",
  severity: "High",
  chainOfThought: cot,
  accepted: null,
  ...over,
});

const TEXT = "[Page 1]\n1. Liability. Provider’s liability shall not exceed ONE THOUSAND DOLLARS.\n[Page 2]\n2. Payment. Invoices are due Net 15.\n3. Audit. Customer shall have no audit rights.";

describe("redlined document", () => {
  const r1 = red({ id: "RED-01", originalText: "Provider's liability shall not exceed one thousand dollars", proposedText: "Liability is capped at 12 months of fees" });
  const r2 = red({ id: "RED-02", originalText: "Invoices are due Net 15.", proposedText: "Invoices are due Net 45.", accepted: true });
  const r3 = red({ id: "RED-03", originalText: "This sentence is not in the contract", proposedText: "x" });
  const r4 = red({ id: "RED-04", originalText: "Customer shall have no audit rights.", action: "delete", accepted: true });
  const r5 = red({ id: "RED-05", action: "insert", proposedText: "New clause", accepted: true });

  it("places changes in document order with tolerant matching and lists the rest", () => {
    const doc = buildRedlinedDocument(TEXT, [r2, r1, r3, r4, r5]);
    const changes = doc.segments.filter((s) => s.kind === "change").map((s: any) => s.redline.id);
    expect(changes).toEqual(["RED-01", "RED-02", "RED-04"]); // curly quote and case did not matter
    expect(doc.unplaced.map((r) => r.id)).toEqual(["RED-03"]);
    expect(doc.inserts.map((r) => r.id)).toEqual(["RED-05"]);
    // Nothing is lost: the plain text plus the original wording rebuilds the contract.
    expect(doc.segments.map((s: any) => (s.kind === "text" ? s.text : s.original)).join("")).toBe(TEXT);
  });

  it("moves overlapping changes to the unplaced list", () => {
    const a = red({ id: "A", originalText: "Invoices are due Net 15." });
    const b = red({ id: "B", originalText: "due Net 15. 3. Audit" });
    expect(buildRedlinedDocument(TEXT, [a, b]).unplaced.map((r) => r.id)).toEqual(["B"]);
  });

  it("applies only accepted changes to the clean text", () => {
    const clean = reconciledText(TEXT, [r1, r2, r4, r5]);
    expect(clean).toContain("Invoices are due Net 45.");
    expect(clean).toContain("ONE THOUSAND DOLLARS"); // RED-01 still pending
    expect(clean).not.toContain("no audit rights"); // accepted deletion
    expect(clean).toContain("[Inserted under Section 1]\nNew clause");
  });

  it("escapes contract text in the printable version and numbers the notes", () => {
    const html = redlinedHtml({ title: "T <script>", text: "Fee <b>x</b> is due Net 15 days.", redlines: [red({ originalText: "is due Net 15 days", proposedText: "is due Net 45 days" })], lang: "en" });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<del>is due Net 15 days</del><ins>is due Net 45 days</ins><sup>1</sup>");
  });
});

describe("redline rationale check", () => {
  const empty = { ...cot, legalRationale: "", negotiationTalkingPoint: "Not provided by analysis engine." };

  it("keeps complete redlines without calling the AI", async () => {
    let called = false;
    const out = await ensureRationales([red({})], "", async () => ((called = true), { res: new Response("{}"), model: "m" }));
    expect(called).toBe(false);
    expect(out).toMatchObject({ repaired: 0, dropped: 0 });
  });

  it("fills in missing reasoning once and drops what is still missing", async () => {
    const reply = { rationales: [{ id: "RED-01", opposingCounselStance: "", commercialRiskAssessment: "", legalRationale: "Market standard", negotiationTalkingPoint: "Ask for 45 days" }] };
    const body = JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] });
    const out = await ensureRationales(
      [red({ id: "RED-01", chainOfThought: empty }), red({ id: "RED-02", chainOfThought: empty }), red({ id: "RED-03" })],
      "",
      async () => ({ res: new Response(body, { status: 200 }), model: "m" })
    );
    expect(out.redlines.map((r) => r.id)).toEqual(["RED-01", "RED-03"]);
    expect(out).toMatchObject({ repaired: 1, dropped: 1 });
    expect(out.redlines.every(hasRationale)).toBe(true);
  });
});

describe("obligations JSON export", () => {
  const ob: Obligation = {
    id: "OBL-001",
    clauseRef: "Section 2",
    category: "Payment & Financial",
    obligor: "Customer",
    beneficiary: "Vendor",
    requirement: "Pay invoices",
    triggerOrDeadline: "Net 15",
    recurrence: "Monthly",
    breachConsequence: "Late fee",
    financialImpact: "",
    status: "Active",
  };
  const ms = [{ id: "M-1", milestone: "Kickoff", trigger: "30 days after the Effective Date", amount: "$10", deliverable: "Plan", responsibleParty: "Customer", status: "Scheduled" as const }];

  it("produces an export that passes the published schema, with dates and pages", () => {
    const data = buildObligationsExport({ contractTitle: "MSA", obligations: [ob], paymentMilestones: ms, effectiveDate: "2025-01-01", pages: { "OBL-001": 2 }, now: new Date("2025-02-01T10:00:00Z") });
    expect(validateObligationsExport(data)).toEqual([]);
    expect(data.obligations[0]).toMatchObject({ page: 2, financialImpact: "Not specified" });
    expect(data.paymentMilestones[0]).toMatchObject({ dueDate: "2025-01-31", dateBasis: "computed", phase: null, source: "text" });
    expect(data.summary.datedMilestones).toBe(1);
  });

  it("reports schema violations", () => {
    const data: any = buildObligationsExport({ contractTitle: "MSA", obligations: [ob], paymentMilestones: [] });
    data.obligations[0].status = "Unknown";
    data.extra = 1;
    const errors = validateObligationsExport(data);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.join(" ")).toMatch(/obligations\/0\/status/);
  });

  it("finds the page of a position from the page markers", () => {
    expect(pageAt(TEXT, TEXT.indexOf("Invoices"))).toBe(2);
    expect(pageAt(TEXT, 3)).toBeUndefined();
  });
});
