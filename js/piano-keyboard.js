/**
 * 88 键钢琴键盘（MIDI 21–108）
 * 几何 hit-test + pointer 滑音；视觉状态由本模块独占管理
 */
const BLACK_SEMIS = new Set([1, 3, 6, 8, 10]);
const DEFAULT_VEL = 121;

export function isBlackKey(midi) {
  return BLACK_SEMIS.has(midi % 12);
}

function whiteMidisInRange(minMidi, maxMidi) {
  const keys = [];
  for (let m = minMidi; m <= maxMidi; m++) {
    if (!isBlackKey(m)) keys.push(m);
  }
  return keys;
}

function blackAnchorIndex(blackMidi, whiteMidis) {
  let anchor = blackMidi - 1;
  while (anchor >= whiteMidis[0] && isBlackKey(anchor)) anchor -= 1;
  const idx = whiteMidis.indexOf(anchor);
  return idx >= 0 ? idx : 0;
}

function readKeyMetrics(board) {
  const cs = getComputedStyle(board);
  return {
    whiteW: parseFloat(cs.getPropertyValue("--pk-white-w")) || 18,
    whiteH: parseFloat(cs.getPropertyValue("--pk-white-h")) || 120,
    blackW: parseFloat(cs.getPropertyValue("--pk-black-w")) || 11,
    blackH: parseFloat(cs.getPropertyValue("--pk-black-h")) || 72,
  };
}

/** @returns {{ midi: number, x: number, y: number, w: number, h: number, isBlack: boolean }[]} */
function buildKeyLayout(board, minMidi, maxMidi) {
  const { whiteW, whiteH, blackW, blackH } = readKeyMetrics(board);
  const whiteMidis = whiteMidisInRange(minMidi, maxMidi);
  const layout = [];

  whiteMidis.forEach((midi, i) => {
    layout.push({ midi, x: i * whiteW, y: 0, w: whiteW, h: whiteH, isBlack: false });
  });

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (!isBlackKey(midi)) continue;
    const idx = blackAnchorIndex(midi, whiteMidis);
    const x = (idx + 0.68) * whiteW - blackW / 2;
    layout.push({ midi, x, y: 0, w: blackW, h: blackH, isBlack: true });
  }

  return layout;
}

function hitTest(layout, board, clientX, clientY) {
  const rect = board.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

  const blacks = layout.filter((k) => k.isBlack);
  for (const k of blacks) {
    if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) return k.midi;
  }
  for (const k of layout) {
    if (k.isBlack) continue;
    if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) return k.midi;
  }
  return null;
}

function createKeyboardView(board) {
  const pressed = new Set();

  function syncDom() {
    board.querySelectorAll(".piano-key").forEach((el) => {
      const m = Number(el.dataset.midi);
      el.classList.toggle("pressed", pressed.has(m));
      el.setAttribute("aria-pressed", pressed.has(m) ? "true" : "false");
    });
  }

  return {
    press(midi) {
      if (midi == null || pressed.has(midi)) return;
      pressed.add(midi);
      syncDom();
    },
    release(midi) {
      if (midi == null || !pressed.has(midi)) return;
      pressed.delete(midi);
      syncDom();
    },
    releaseAll() {
      pressed.clear();
      syncDom();
    },
    getPressed() {
      return new Set(pressed);
    },
  };
}

function bindPointerInteraction(board, layout, view, handlers) {
  /** pointerId → midi */
  const pointers = new Map();

  function setKey(pointerId, midi) {
    const prev = pointers.get(pointerId);
    if (prev === midi) return;

    if (prev != null) {
      view.release(prev);
      handlers.onNoteUp?.(prev);
      pointers.delete(pointerId);
    }

    if (midi != null) {
      pointers.set(pointerId, midi);
      view.press(midi);
      handlers.onNoteDown?.(midi, DEFAULT_VEL);
    }
  }

  function releasePointer(pointerId) {
    const midi = pointers.get(pointerId);
    if (midi == null) return;
    pointers.delete(pointerId);
    view.release(midi);
    handlers.onNoteUp?.(midi);
  }

  board.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      board.setPointerCapture(e.pointerId);
      const midi = hitTest(layout, board, e.clientX, e.clientY);
      setKey(e.pointerId, midi);
    },
    { passive: false }
  );

  board.addEventListener(
    "pointermove",
    (e) => {
      if (!board.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      const midi = hitTest(layout, board, e.clientX, e.clientY);
      if (midi != null) setKey(e.pointerId, midi);
      else if (pointers.has(e.pointerId)) releasePointer(e.pointerId);
    },
    { passive: false }
  );

  const end = (e) => {
    if (board.hasPointerCapture(e.pointerId)) {
      try {
        board.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    releasePointer(e.pointerId);
  };

  board.addEventListener("pointerup", end);
  board.addEventListener("pointercancel", end);
  board.addEventListener("lostpointercapture", (e) => releasePointer(e.pointerId));

  return {
    releaseAllPointers() {
      [...pointers.keys()].forEach(releasePointer);
    },
  };
}

/**
 * @param {HTMLElement} container
 * @param {{ minMidi?: number, maxMidi?: number, onNoteDown?: (midi:number, vel:number)=>void, onNoteUp?: (midi:number)=>void, onFirstInteraction?: ()=>void, labelFor?: (m:number)=>string }} opts
 */
export function renderKeyboard(container, opts = {}) {
  if (!container) return null;
  const {
    minMidi = 21,
    maxMidi = 108,
    onNoteDown = () => {},
    onNoteUp = () => {},
    onFirstInteraction = () => {},
    labelFor = (m) => String(m),
  } = opts;

  container.innerHTML = "";
  container.className = "piano-keyboard-host";

  const scroll = document.createElement("div");
  scroll.className = "piano-keyboard-scroll";

  const board = document.createElement("div");
  board.className = "piano-keyboard";
  board.setAttribute("role", "application");
  board.setAttribute("aria-label", "钢琴键盘");

  const whiteMidis = whiteMidisInRange(minMidi, maxMidi);
  board.style.setProperty("--piano-white-count", String(whiteMidis.length));

  const whitesRow = document.createElement("div");
  whitesRow.className = "piano-whites";

  whiteMidis.forEach((midi) => {
    const key = document.createElement("div");
    key.className = "piano-key piano-key-white";
    key.dataset.midi = String(midi);
    key.title = labelFor(midi);
    key.setAttribute("role", "button");
    key.setAttribute("aria-label", labelFor(midi));
    key.setAttribute("aria-pressed", "false");
    if (midi % 12 === 0) {
      const oct = document.createElement("span");
      oct.className = "piano-key-oct";
      oct.textContent = String(Math.floor(midi / 12) - 1);
      key.appendChild(oct);
    }
    whitesRow.appendChild(key);
  });
  board.appendChild(whitesRow);

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (!isBlackKey(midi)) continue;
    const idx = blackAnchorIndex(midi, whiteMidis);
    const key = document.createElement("div");
    key.className = "piano-key piano-key-black";
    key.dataset.midi = String(midi);
    key.style.setProperty("--piano-black-at", String(idx + 0.68));
    key.title = labelFor(midi);
    key.setAttribute("role", "button");
    key.setAttribute("aria-label", labelFor(midi));
    key.setAttribute("aria-pressed", "false");
    board.appendChild(key);
  }

  scroll.appendChild(board);
  container.appendChild(scroll);

  const view = createKeyboardView(board);
  let layout = buildKeyLayout(board, minMidi, maxMidi);
  let interaction = null;
  let touched = false;

  const handlers = {
    onNoteDown: (midi, vel) => {
      if (!touched) {
        touched = true;
        onFirstInteraction?.();
      }
      onNoteDown(midi, vel);
    },
    onNoteUp,
  };

  interaction = bindPointerInteraction(board, layout, view, handlers);

  const ro = new ResizeObserver(() => {
    layout = buildKeyLayout(board, minMidi, maxMidi);
  });
  ro.observe(board);

  return {
    releaseAll() {
      interaction?.releaseAllPointers();
      view.releaseAll();
    },
  };
}

/** @deprecated 视觉状态由键盘内部管理，外部勿再调用 */
export function highlightKeys() {
  /* noop — 避免 refreshUI 覆盖按键高亮 */
}
