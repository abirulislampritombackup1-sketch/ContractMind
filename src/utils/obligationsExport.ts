// The obligations JSON export: built in one place and validated against the published
// JSON Schema (src/schema/obligations.v1.json) before it is shown or downloaded.

import Ajv2020 from "ajv/dist/2020";
import schema from "../schema/obligations.v1.json";
import type { Obligation, PaymentMilestone } from "../types";
import { resolveMilestoneDates } from "./milestoneCalendar";

export const OBLIGATIONS_SCHEMA = schema;
export const SCHEMA_VERSION = "contractmind.obligations/1.0";

let validator: ReturnType<Ajv2020["compile"]> | null = null;
const getValidator = () => (validator ??= new Ajv2020({ allErrors: true, strict: false }).compile(schema));

export function buildObligationsExport(input: {
  contractTitle: string;
  playbook?: string;
  obligations: Obligation[];
  paymentMilestones: PaymentMilestone[];
  effectiveDate?: string;
  pages?: Record<string, number>; // obligation id → contract page
  now?: Date;
}) {
  const eff = input.effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) ? input.effectiveDate : null;
  const resolved = resolveMilestoneDates(input.paymentMilestones, eff || undefined);
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: "ContractMind",
    contractTitle: input.contractTitle || "Contract",
    ...(input.playbook ? { playbook: input.playbook } : {}),
    extractionDate: (input.now || new Date()).toISOString(),
    effectiveDate: eff,
    summary: {
      totalObligations: input.obligations.length,
      vendorObligations: input.obligations.filter((o) => o.obligor === "Vendor").length,
      customerObligations: input.obligations.filter((o) => o.obligor === "Customer").length,
      criticalObligations: input.obligations.filter((o) => o.status === "Critical").length,
      paymentMilestones: input.paymentMilestones.length,
      datedMilestones: resolved.filter((r) => r.date).length,
    },
    obligations: input.obligations.map((o) => ({
      id: o.id,
      clauseRef: o.clauseRef,
      page: input.pages?.[o.id] ?? null,
      category: o.category,
      obligor: o.obligor,
      beneficiary: o.beneficiary,
      requirement: o.requirement,
      triggerOrDeadline: o.triggerOrDeadline,
      recurrence: o.recurrence,
      breachConsequence: o.breachConsequence,
      financialImpact: o.financialImpact || "Not specified",
      status: o.status,
    })),
    paymentMilestones: resolved.map(({ m, date, how }) => ({
      id: m.id,
      phase: m.phase ?? null,
      milestone: m.milestone,
      deliverable: m.deliverable,
      amount: m.amount,
      trigger: m.trigger,
      dueDate: date ?? null,
      dateBasis: how,
      responsibleParty: m.responsibleParty,
      status: m.status,
      source: m.source || "text",
      page: m.page ?? null,
    })),
  };
}

export type ObligationsExport = ReturnType<typeof buildObligationsExport>;

/** Validates against the schema; returns readable error messages (empty when valid). */
export function validateObligationsExport(data: unknown): string[] {
  const validate = getValidator();
  if (validate(data)) return [];
  return (validate.errors || []).slice(0, 10).map((e) => `${e.instancePath || "(root)"} ${e.message}`);
}

/** Page of a character position, from the "[Page N]" markers in the extracted text. */
export function pageAt(text: string, index: number): number | undefined {
  const before = text.slice(0, index);
  const all = [...before.matchAll(/\[Page (\d+)\]/g)];
  return all.length ? Number(all[all.length - 1][1]) : undefined;
}
