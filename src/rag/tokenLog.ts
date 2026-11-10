// Per-request token accounting, so RAG can be compared against full-document sends.
// Entries are logged to the console and kept in memory; in the browser console run
//   __contractmindTokens.table()   or   __contractmindTokens.totals()

export interface UsageEntry {
  time: number;
  label: string;
  model: string;
  mode: "rag" | "full";
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  chunksSent?: number;
  chunksTotal?: number;
}

const entries: UsageEntry[] = [];

export function logUsage(
  label: string,
  model: string,
  usageMetadata: any,
  info: { mode: "rag" | "full"; chunksSent?: number; chunksTotal?: number }
): UsageEntry {
  const u = usageMetadata ?? {};
  const entry: UsageEntry = {
    time: Date.now(),
    label,
    model,
    mode: info.mode,
    promptTokens: Number(u.promptTokenCount) || 0,
    outputTokens: Number(u.candidatesTokenCount) || 0,
    thoughtsTokens: Number(u.thoughtsTokenCount) || 0,
    totalTokens: Number(u.totalTokenCount) || 0,
    chunksSent: info.chunksSent,
    chunksTotal: info.chunksTotal,
  };
  entries.push(entry);
  console.info(
    `[ContractMind tokens] ${label} (${info.mode}${info.chunksSent != null ? `, ${info.chunksSent}/${info.chunksTotal} chunks` : ""}) ` +
      `prompt=${entry.promptTokens} output=${entry.outputTokens} thoughts=${entry.thoughtsTokens} total=${entry.totalTokens} [${model}]`
  );
  return entry;
}

export const getUsageLog = () => entries.slice();
export const clearUsageLog = () => {
  entries.length = 0;
};

export function totals(list: UsageEntry[] = entries) {
  return list.reduce(
    (t, e) => ({
      requests: t.requests + 1,
      promptTokens: t.promptTokens + e.promptTokens,
      outputTokens: t.outputTokens + e.outputTokens,
      totalTokens: t.totalTokens + e.totalTokens,
    }),
    { requests: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
}

if (typeof window !== "undefined") {
  (window as any).__contractmindTokens = {
    log: getUsageLog,
    clear: clearUsageLog,
    totals: () => totals(),
    table: () => console.table(entries),
  };
}
