/**
 * Block browser defaults that interfere with piano playing
 * (text selection, context menu, drag, callout).
 * Interactive controls (buttons, inputs) are excluded so taps stay reliable.
 */
export function installAppGuards(root = document.getElementById("app")) {
  if (!root) return;

  const isInteractive = (target) => {
    if (!target || !(target instanceof Element)) return false;
    return !!target.closest("button, a, input, select, textarea, label, [role='button']");
  };

  const block = (e) => {
    if (isInteractive(e.target)) return;
    e.preventDefault();
  };

  root.addEventListener("contextmenu", block);
  root.addEventListener("selectstart", block);
  root.addEventListener("dragstart", block);

  document.addEventListener("selectionchange", () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !sel.anchorNode) return;
    if (root.contains(sel.anchorNode)) sel.removeAllRanges();
  });
}

export function registerServiceWorker(version) {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `./sw.js?v=${encodeURIComponent(version)}`;
  navigator.serviceWorker.register(swUrl, { scope: "./" }).catch((err) => {
    console.warn("Service worker registration failed", err);
  });
}
