// AI helpers for the Land Guide and Case Helper pages (Bangladesh land inheritance and
// general legal guidance). All calls go through the existing /api/gemini proxy via
// callGemini, so the API key stays server-side and the primary/fallback model logic applies.

import { callGemini, geminiErrorMessage, toBase64 } from "./gemini";
import { logUsage } from "../rag/tokenLog";

export type ChatMsg = { role: "user" | "ai"; text: string };

/** Largest upload sent to Gemini inline. Vercel functions accept request bodies up to
 *  4.5 MB, and base64 encoding adds about a third, so 3 MB files are the safe limit. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const TOO_LARGE = "ফাইল ৩ MB-র বেশি। ছবি ছোট করে বা কম পৃষ্ঠার PDF দিয়ে আবার চেষ্টা করুন।";

const LAND_SYSTEM = `You help ordinary people in Bangladesh get inherited (ওয়ারিশ) land recorded in their own names without using brokers (dalal).
Facts you may rely on:
- Inheritance mutation (namjari) is applied for online through the government e-mutation service (mutation.land.gov.bd) to the Assistant Commissioner (Land). Fees are paid online.
- Usually needed: ওয়ারিশ সনদ (from the Union Parishad chairman, municipality mayor or city corporation ward councillor), death certificate where applicable, copy of the previous khatian, and details of ALL heirs (name, NID, relation). A missing heir can cause rejection.
- Reports say joint mutation in all heirs' names can go ahead without a separate partition deed (bonton-nama), based on each heir's share.
- The usual target time for e-mutation is 28 working days.
- The ওয়ারিশ সনদ only shows who the heirs are. Shares are set by the applicable inheritance law, which differs by religion.
Rules: Reply in the user's language, default simple Bangla. Be short and practical. Never guess shares or fee amounts; say where to confirm (Union Parishad, upazila land office / AC Land office, mutation.land.gov.bd). For disputes, forged documents, missing heirs, someone else occupying the land, or court cases, advise a lawyer or the district legal aid office. Never suggest paying a broker or an unofficial payment. This is not legal advice.`;

const KHATIAN_SYSTEM = `You read Bangladeshi land records (khatian / porcha / RS, CS, SA, BS or mutation khatian) from a photo, screenshot or PDF.
Write in simple Bangla with these short sections:
১. জরিপের ধরন ও তথ্য (খতিয়ান নম্বর, মৌজা, দাগ নম্বর, তফসিল, যা পড়া যায়)
২. মালিক ও অংশ (প্রতিটি নাম, পিতা/স্বামীর নাম, অংশ)
৩. জমির পরিমাণ
৪. লক্ষণীয় বিষয় (যেমন পুরনো জরিপ হলে নামজারি হয়েছে কিনা মিলিয়ে দেখা, অংশ যোগফল না মিললে, অস্পষ্ট জায়গা)
Rules: Only report what is visible. If something is unreadable write "পড়া যায়নি" and never guess names, numbers or shares. Remind briefly that this shows the recorded owner, not who physically holds the land, and that the user must compare with the original document. This is not legal advice.`;

const CASE_RULES = `You may weigh options and recommend a sensible next step using only the facts the user gave. State your assumptions, how sure you are, and what extra facts would change the advice. Do not declare who is right or wrong, or that a case is true or false: you cannot judge evidence or credibility. Never guess law sections, penalties, fees or deadlines; if unsure, say to confirm with a lawyer. Never recommend anything illegal, such as running away, hiding, destroying evidence, threats, bribes or pressuring the other side. If there is an arrest, a warrant, violence, threats or a near deadline, put the urgent steps first (contact a lawyer or the district legal aid office, and the police or local authorities if someone is in danger). Always say that a lawyer should confirm before a major decision. This is not legal advice. Write in simple Bangla.`;

const CASE_SYSTEM = `You help ordinary people in Bangladesh with any legal matter: court cases, police complaints, summons, warrants, FIRs, legal notices, and disputes over land, family, money, jobs, contracts, online or other issues. The input may be a photo, a PDF or a typed description. Use these short Bangla sections, skipping any that do not apply:
১. বিষয়টা কী (what the paper or situation is; criminal or civil if clear; court or office if shown)
২. কে কার বিরুদ্ধে কী অভিযোগ বা দাবি (plain words)
৩. গুরুত্বপূর্ণ তারিখ ও সময়সীমা (write "দেখা যায়নি" if missing)
৪. জরুরি অবস্থা (জরুরি / শীঘ্র / সময় আছে) এবং এখনই কী করবেন
৫. আপনার সামনে কী কী পথ আছে (2 to 4 options, each with a benefit and a risk)
৬. কোন পথ বেছে নেওয়া সবচেয়ে বিবেচ্য, কেন (one recommended next step, your assumptions, and how sure you are)
৭. আরও যে তথ্য বা কাগজ লাগবে (what would change the advice)
৮. আইনজীবীকে যে প্রশ্নগুলো করবেন (3 to 6 questions)
৯. কাগজ বা বিবরণে যা অস্পষ্ট বা প্রশ্নসাপেক্ষ (for example missing dates, vague claims, mismatched names; only as questions for a lawyer)
${CASE_RULES}`;

const CASE_CHAT_SYSTEM = `You answer legal questions from ordinary people in Bangladesh on any issue (cases, police, land, family, money, jobs, contracts). Give the main options with a benefit and a risk, then say which next step looks most sensible and why. Be short and practical. ${CASE_RULES}`;

async function gen(label: string, system: string, contents: any[], temperature: number): Promise<string> {
  const { res, model } = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature, thinkingConfig: { thinkingLevel: "low" } },
  });
  if (!res.ok) throw new Error(await geminiErrorMessage(res, model));
  const data = await res.json();
  logUsage(label, model, data?.usageMetadata, { mode: "full" });
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  return text || "কিছু পাওয়া যায়নি।";
}

const toContents = (history: ChatMsg[], question: string) => [
  ...history.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
  { role: "user", parts: [{ text: question }] },
];

const filePart = async (file: File) => {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(TOO_LARGE);
  return { inline_data: { mime_type: file.type || "application/pdf", data: await toBase64(file) } };
};

export function askLand(history: ChatMsg[], question: string): Promise<string> {
  return gen("land-chat", LAND_SYSTEM, toContents(history, question), 0.3);
}

export async function readKhatian(file: File): Promise<string> {
  const contents = [{ role: "user", parts: [await filePart(file), { text: "এই খতিয়ানটা পড়ে ব্যাখ্যা করুন।" }] }];
  return gen("khatian", KHATIAN_SYSTEM, contents, 0.1);
}

export async function explainCase(text: string, file?: File): Promise<string> {
  const parts: any[] = [];
  if (file) parts.push(await filePart(file));
  parts.push({ text: text.trim() ? "আমার বিবরণ:\n" + text.trim().slice(0, 20000) : "এই কাগজটা বুঝিয়ে দিন।" });
  return gen("case-explain", CASE_SYSTEM, [{ role: "user", parts }], 0.2);
}

export function askCase(history: ChatMsg[], question: string): Promise<string> {
  return gen("case-chat", CASE_CHAT_SYSTEM, toContents(history, question), 0.3);
}
