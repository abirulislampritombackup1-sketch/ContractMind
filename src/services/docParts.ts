// Builds the Gemini "parts" that carry the contract itself.
//
// Vercel functions reject request bodies over 4.5 MB, and inline files are sent base64
// encoded (+33%). So a PDF is only sent as-is when it is small; larger scanned PDFs are
// rendered page by page to JPEG with pdf.js and shrunk until the pages fit the budget.

import { toBase64 } from "./gemini";

/** Bytes of base64 data allowed in one request (leaves room for prompt and JSON). */
export const INLINE_BUDGET = 3.3 * 1024 * 1024;
const MAX_PAGES = 60;
// Rendering attempts per page, largest first: [width in px, JPEG quality].
const STEPS: [number, number][] = [
  [1400, 0.75],
  [1100, 0.65],
  [850, 0.55],
  [650, 0.5],
  [520, 0.45],
];

const uiBn = () => {
  try { return localStorage.getItem("cm-lang") === "bn"; } catch { return false; }
};

const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
const isImage = (f: File) => /^image\/(png|jpe?g|webp)$/.test(f.type);
const base64Bytes = (dataUrl: string) => dataUrl.length - dataUrl.indexOf(",") - 1;

export type PageImages = { parts: any[]; pagesSent: number; totalPages: number };

/** Renders PDF pages to JPEG parts that together stay under `budget` bytes. */
export async function pdfPagesToImages(file: File, budget = INLINE_BUDGET): Promise<PageImages> {
  const pdfjs = await import("pdfjs-dist");
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const totalPages = pdf.numPages;
  const pages = Math.min(totalPages, MAX_PAGES);
  const perPage = budget / pages;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const parts: any[] = [];
  let used = 0;
  let pagesSent = 0;

  for (let n = 1; n <= pages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    let dataUrl = "";
    for (const [width, quality] of STEPS) {
      const viewport = page.getViewport({ scale: width / base.width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (base64Bytes(dataUrl) <= perPage) break;
    }
    const size = base64Bytes(dataUrl);
    if (used + size > budget) break; // even the smallest rendering does not fit
    used += size;
    pagesSent++;
    parts.push({ text: `[Page ${n}]` }, { inline_data: { mime_type: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) } });
    page.cleanup();
  }
  canvas.width = canvas.height = 0;
  await pdf.destroy();
  return { parts, pagesSent, totalPages };
}

/**
 * The parts that carry the document: extracted text when there is some, otherwise the
 * file itself (small PDF or image) or rendered page images (large PDF).
 */
export async function documentParts(opts: { file?: File | null; text: string; hasText: boolean; label?: string }): Promise<any[]> {
  const { file, text, hasText, label = "CONTRACT DOCUMENT TEXT" } = opts;
  const textPart = [{ text: `=== ${label} ===\n${text}` }];
  if (hasText || !file) return textPart;

  if ((isPdf(file) || isImage(file)) && (file.size * 4) / 3 <= INLINE_BUDGET) {
    return [{ inline_data: { mime_type: file.type || "application/pdf", data: await toBase64(file) } }];
  }
  if (isPdf(file)) {
    const { parts, pagesSent, totalPages } = await pdfPagesToImages(file);
    if (!pagesSent) {
      throw new Error(uiBn() ? "এই PDF-এর পৃষ্ঠাগুলো পাঠানোর জন্য খুব বড়। ছোট ফাইল দিয়ে চেষ্টা করুন।" : "This PDF's pages are too large to send. Try a smaller file.");
    }
    const note =
      pagesSent < totalPages
        ? `The contract has ${totalPages} pages; only pages 1-${pagesSent} fit in this request. Say so if the answer may be on a later page.`
        : `The contract has ${totalPages} pages, shown as images below.`;
    return [{ text: `=== CONTRACT DOCUMENT (page images) ===\n${note}` }, ...parts];
  }
  return textPart;
}
