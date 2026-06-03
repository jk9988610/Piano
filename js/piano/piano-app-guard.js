/**
 * Block browser defaults that interfere with piano playing
 * (text selection, context menu, drag, callout).
 */
export function installAppGuards(root = document.getElementById("app")) {
  if (!root) return;

  const block = (e) => {
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
