// Prints an HTML document from a hidden frame on the current page, so pop-up blockers
// do not interfere. The user picks "Save as PDF" in the browser's print dialog.

export function printHtml(html: string, frameId = "cm-print-frame") {
  document.getElementById(frameId)?.remove();
  const frame = document.createElement("iframe");
  frame.id = frameId;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = html;
  frame.onload = () => {
    const w = frame.contentWindow;
    if (!w) return;
    // Give the web fonts a moment so Bangla text prints in the right font.
    const go = () => {
      w.focus();
      w.print();
    };
    const fonts = (w.document as any).fonts;
    fonts?.ready ? fonts.ready.then(() => setTimeout(go, 100)) : setTimeout(go, 400);
  };
  document.body.appendChild(frame);
}

export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
