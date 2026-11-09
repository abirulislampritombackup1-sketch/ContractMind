export type Finding = {
  level: "High" | "Medium" | "Review";
  title: string;
  detail: string;
  evidence: string;
  page: string;
  confidence: string;
  suggestion: string;
  verified?: boolean;
};
export type Analysis = { summary: string; riskScore: number; keyFacts: { label: string; value: string }[]; findings: Finding[] };

const KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-2.5-flash";
export type Lang = string; // "auto" or any language name, e.g. "Hindi"
const langRule = (lang: Lang) => {
  const name = lang.replace(/[^\p{L}\p{M} ()\-]/gu, "").trim().slice(0, 40);
  if (!name || name === "auto") return "Write in the same language as the contract.";
  return `Write summary, title, detail and suggestion in ${name}. Keep "evidence" verbatim in the contract's original language.`;
};
const MAX_CHARS = 600000;

async function toBase64(f: File) {
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const system = (lang: Lang) => `You are a careful contract-review assistant. Read the contract text and flag clauses that are risky, one-sided, unclear or missing (e.g. termination, payment terms, liability caps, indemnity, confidentiality, IP ownership, auto-renewal, dispute resolution, governing law).
Rules:
- Only use what is in the text. Never invent clauses or facts.
- "evidence" must be an exact, verbatim quote copied from the contract (max 200 characters). If a clause is missing, use "Not found in the document".
- "page" comes from the [Page N] markers, formatted like "Page 4". Use "Not specified" if unknown.
- "level" is High, Medium or Review. "confidence" is High, Medium or Low.
- "suggestion" is one or two sentences with concrete, safer wording or what to ask the other party to change. For a missing clause, suggest adding it.
- ${langRule(lang)}
- Be concise and neutral, using simple everyday words. This is not legal advice.
- If there are no issues, return an empty findings array.
- "riskScore" is an integer 0-100 for overall contract risk to the signing party (higher = riskier).
- "keyFacts" has up to 8 items such as parties, term, amounts, key dates, notice period, governing law. Use "Not found" when absent. Labels follow the report language.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    riskScore: { type: "INTEGER" },
    keyFacts: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, value: { type: "STRING" } }, required: ["label", "value"] } },
    findings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          level: { type: "STRING", enum: ["High", "Medium", "Review"] },
          title: { type: "STRING" },
          detail: { type: "STRING" },
          suggestion: { type: "STRING" },
          evidence: { type: "STRING" },
          page: { type: "STRING" },
          confidence: { type: "STRING" },
        },
        required: ["level", "title", "detail", "suggestion", "evidence", "page", "confidence"],
      },
    },
  },
  required: ["summary", "riskScore", "keyFacts", "findings"],
};

export async function analyzeContract(text: string, lang: Lang = "auto", file?: File): Promise<Analysis> {
  if (!KEY) throw new Error("Gemini API key missing. Add VITE_GEMINI_API_KEY to a .env file, then restart npm run dev.");
  const doc = text.slice(0, MAX_CHARS);
  const parts: any[] = file
    ? [{ inline_data: { mime_type: file.type || "application/pdf", data: await toBase64(file) } }, { text: "Analyze this contract document." }]
    : [{ text: doc }];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system(lang) }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json())?.error?.message || ""; } catch {}
    throw new Error(`Gemini request failed (${res.status}). ${msg}`.trim());
  }
  const data = await res.json();
  const raw: string = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  let parsed: Analysis;
  try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { throw new Error("The AI returned an unreadable response. Please try again."); }

  const haystack = norm(doc);
  const findings = (parsed.findings || []).map((f) => ({
    ...f,
    verified: file ? undefined : f.evidence.length > 3 && haystack.includes(norm(f.evidence)),
  }));
  const note = !file && text.length > MAX_CHARS ? ` (Only the first ${MAX_CHARS.toLocaleString()} characters were analyzed.)` : "";
  return {
    summary: (parsed.summary || "") + note,
    riskScore: Math.min(100, Math.max(0, Math.round(Number(parsed.riskScore) || 0))),
    keyFacts: parsed.keyFacts || [],
    findings,
  };
}

export type ChatMsg = { role: "user" | "ai"; text: string };

export async function askContract(text: string, file: File | undefined, history: ChatMsg[], question: string): Promise<string> {
  if (!KEY) throw new Error("Gemini API key missing. Add VITE_GEMINI_API_KEY to .env and restart.");
  const docPart = file
    ? { inline_data: { mime_type: file.type || "application/pdf", data: await toBase64(file) } }
    : { text: text.slice(0, MAX_CHARS) };
  const contents = [
    { role: "user", parts: [docPart, { text: "This is the contract. Answer my questions about it." }] },
    { role: "model", parts: [{ text: "Understood. Ask your questions." }] },
    ...history.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: question }] },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "Answer only from the contract provided. Quote the relevant wording briefly and say which part it comes from. If the contract does not say, say so plainly and do not guess. Reply in the language of the user's question, in simple words, short. This is not legal advice." }] },
      contents,
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json())?.error?.message || ""; } catch {}
    throw new Error(`Gemini request failed (${res.status}). ${msg}`.trim());
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("") || "No answer received.";
}
