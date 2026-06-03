/**
 * Block browser defaults that interfere with piano playing
 * (text selection, context menu, drag) — only on play surfaces, not toolbar buttons.
 */
export function installAppGuards(root) {
  if (!root) return;

  const block = (e) => {
    e.preventDefault();
  };

  root.addEventListener("contextmenu", block);
  root.addEventListener("dragstart", block);
}

export function registerServiceWorker(version) {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `./sw.js?v=${encodeURIComponent(version)}`;
  navigator.serviceWorker
    .register(swUrl, { scope: "./" })
    .then((reg) => {
      if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");

      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage("SKIP_WAITING");
          }
        });
      });

      reg.update().catch(() => {});
    })
    .catch((err) => {
      console.warn("Service worker registration failed", err);
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (window.__pianoSwReloaded) return;
    window.__pianoSwReloaded = true;
    window.location.reload();
  });
}
