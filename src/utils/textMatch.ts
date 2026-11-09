// Locating AI-quoted wording inside the contract text.
// The AI's quotes rarely match byte-for-byte (PDF extraction joins lines with
// spaces, quotes become curly, casing differs), so we compare on a normalised
// copy and map any hit back to original character offsets.

export type NormalizedText = { norm: string; map: number[] };

export function normalizeWithMap(text: string): NormalizedText {
  let norm = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      ch = " ";
      prevSpace = true;
    } else {
      prevSpace = false;
      if (/[‘’‛′]/.test(ch)) ch = "'";
      else if (/[“”‟″]/.test(ch)) ch = '"';
      else if (/[‐-―]/.test(ch)) ch = "-";
      else ch = ch.toLowerCase();
    }
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

const normalizeQuote = (s: string) =>
  normalizeWithMap(s.trim()).norm.replace(/^["'.…\s]+|["'.…\s]+$/g, "").trim();

/** Character range of `quote` inside the (pre-normalised) haystack, or null. */
export function locateQuote(haystack: NormalizedText, quote: string): { start: number; end: number } | null {
  const needle = normalizeQuote(quote);
  if (needle.length < 8) return null;
  const toRange = (ns: number, ne: number) => ({ start: haystack.map[ns], end: haystack.map[ne - 1] + 1 });

  const exact = haystack.norm.indexOf(needle);
  if (exact >= 0) return toRange(exact, exact + needle.length);

  // Long quotes the AI shortened or slightly altered in the middle:
  // anchor on the first and last 50 characters.
  if (needle.length >= 90) {
    const head = needle.slice(0, 50);
    const tail = needle.slice(-50);
    const hs = haystack.norm.indexOf(head);
    if (hs >= 0) {
      const te = haystack.norm.indexOf(tail, hs + head.length);
      if (te >= 0 && te + tail.length - hs <= needle.length * 1.6) return toRange(hs, te + tail.length);
    }
  }
  return null;
}
