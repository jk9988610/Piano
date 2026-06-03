/**
 * 键盘导航条：缩影全键盘 + 视口指示 + 横向滚动；两侧 ± 缩放
 */
import {
  isBlackKey,
  whiteMidisInRange,
  whiteIndexLeftOfBlack,
  BLACK_W_RATIO,
  BLACK_H_RATIO,
} from "../piano-keyboard.js";

export function createKeyboardNav({ trackEl, viewportEl, miniEl, btnZoomOut, btnZoomIn, keyboard }) {
  const { scrollEl, minMidi, maxMidi, whiteCount } = keyboard;

  function renderMinimap() {
    miniEl.innerHTML = "";
    const trackW = trackEl.clientWidth || 300;
    const miniH = miniEl.clientHeight || 24;
    const whiteW = trackW / whiteCount;
    const blackW = whiteW * BLACK_W_RATIO;
    const blackH = miniH * BLACK_H_RATIO;

    const whiteMidis = whiteMidisInRange(minMidi, maxMidi);
    const board = document.createElement("div");
    board.className = "nav-minimap-board";
    board.style.width = `${trackW}px`;
    board.style.height = `${miniH}px`;

    const whites = document.createElement("div");
    whites.className = "nav-minimap-whites";
    whites.style.width = `${trackW}px`;

    whiteMidis.forEach((midi, i) => {
      const w = document.createElement("div");
      w.className = "nav-minimap-white";
      w.style.left = `${i * whiteW}px`;
      w.style.width = `${whiteW}px`;
      w.style.height = `${miniH}px`;
      if (midi % 12 === 0) w.dataset.oct = String(Math.floor(midi / 12) - 1);
      whites.appendChild(w);
    });
    board.appendChild(whites);

    for (let midi = minMidi; midi <= maxMidi; midi++) {
      if (!isBlackKey(midi)) continue;
      const idx = whiteIndexLeftOfBlack(midi, whiteMidis);
      const b = document.createElement("div");
      b.className = "nav-minimap-black";
      b.style.left = `${(idx + 1) * whiteW - blackW / 2}px`;
      b.style.width = `${blackW}px`;
      b.style.height = `${blackH}px`;
      board.appendChild(b);
    }

    miniEl.appendChild(board);
  }

  function syncViewport() {
    const sw = scrollEl.scrollWidth;
    const cw = scrollEl.clientWidth;
    const tw = trackEl.clientWidth;
    if (sw <= cw + 1) {
      viewportEl.style.display = "none";
      return;
    }
    viewportEl.style.display = "block";
    const sl = scrollEl.scrollLeft;
    viewportEl.style.width = `${Math.max(20, (cw / sw) * tw)}px`;
    viewportEl.style.left = `${(sl / sw) * tw}px`;
  }

  function scrollToRatio(ratio) {
    const max = scrollEl.scrollWidth - scrollEl.clientWidth;
    scrollEl.scrollLeft = Math.max(0, Math.min(max, ratio * max));
    syncViewport();
  }

  function scrollFromClientX(clientX) {
    const rect = trackEl.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    scrollToRatio(Math.max(0, Math.min(1, ratio)));
  }

  function updateZoomButtons() {
    if (btnZoomOut) btnZoomOut.disabled = !keyboard.canZoomOut();
    if (btnZoomIn) btnZoomIn.disabled = !keyboard.canZoomIn();
  }

  function refresh() {
    renderMinimap();
    syncViewport();
    updateZoomButtons();
  }

  scrollEl.addEventListener("scroll", syncViewport, { passive: true });
  window.addEventListener("resize", refresh);

  trackEl.addEventListener(
    "wheel",
    (e) => {
      if (scrollEl.scrollWidth <= scrollEl.clientWidth) return;
      e.preventDefault();
      scrollEl.scrollLeft += e.deltaY + e.deltaX;
    },
    { passive: false }
  );

  trackEl.addEventListener("click", (e) => {
    if (e.target === viewportEl) return;
    scrollFromClientX(e.clientX);
  });

  let dragPointer = null;
  let dragStartX = 0;
  let dragStartScroll = 0;

  viewportEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragPointer = e.pointerId;
    dragStartX = e.clientX;
    dragStartScroll = scrollEl.scrollLeft;
    viewportEl.setPointerCapture(e.pointerId);
  });

  viewportEl.addEventListener("pointermove", (e) => {
    if (dragPointer !== e.pointerId) return;
    e.preventDefault();
    const tw = trackEl.clientWidth;
    const max = scrollEl.scrollWidth - scrollEl.clientWidth;
    const dx = e.clientX - dragStartX;
    scrollEl.scrollLeft = Math.max(0, Math.min(max, dragStartScroll + (dx / tw) * max));
    syncViewport();
  });

  const endDrag = (e) => {
    if (dragPointer !== e.pointerId) return;
    dragPointer = null;
    try {
      viewportEl.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };
  viewportEl.addEventListener("pointerup", endDrag);
  viewportEl.addEventListener("pointercancel", endDrag);

  btnZoomOut?.addEventListener("click", () => {
    keyboard.zoomOut();
    updateZoomButtons();
  });

  btnZoomIn?.addEventListener("click", () => {
    keyboard.zoomIn();
    updateZoomButtons();
  });

  refresh();

  return { refresh, syncViewport, updateZoomButtons };
}
