import { RedlineItem } from "../types";

export function generateReconciledDocument(originalText: string, redlines: RedlineItem[]): string {
  let result = originalText;
  
  // Sort redlines by appearance in text if possible or apply accepted ones
  for (const redline of redlines) {
    if (redline.accepted === true) {
      if (redline.action === "replace" || redline.action === "delete") {
        if (result.includes(redline.originalText)) {
          const replacement = redline.action === "delete" ? "" : redline.proposedText;
          result = result.replace(redline.originalText, replacement);
        }
      } else if (redline.action === "insert") {
        // Appends or inserts near clause
        result += `\n\n[Inserted under ${redline.clauseId}]:\n${redline.proposedText}\n`;
      }
    }
  }

  return result;
}

export function downloadJsonFile(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTextFile(content: string, filename: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

