/**
 * 88 键钢琴键盘 UI（MIDI 21–108，A0–C8）
 * 支持 pointer 滑音：按住并滑过琴键连续发声
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

function midiFromElement(el) {
  if (!el?.classList?.contains("piano-key")) return null;
  const midi = Number(el.dataset.midi);
  return Number.isFinite(midi) ? midi : null;
}

function midiAtPoint(board, clientX, clientY) {
  board.style.pointerEvents = "none";
  const hit = document.elementFromPoint(clientX, clientY);
  board.style.pointerEvents = "";
  if (!hit) return null;
  const key = hit.closest?.(".piano-key");
  if (!key || !board.contains(key)) return null;
  return midiFromElement(key);
}

function setPressed(board, midi, pressed) {
  if (midi == null) return;
  const el = board.querySelector(`[data-midi="${midi}"]`);
  if (el) el.classList.toggle("pressed", pressed);
}

function bindGlideKeyboard(board, handlers) {
  /** @type {Map<number, number>} pointerId → active midi */
  const active = new Map();

  function press(pointerId, midi) {
    const prev = active.get(pointerId);
    if (prev === midi) return;
    if (prev != null) {
      setPressed(board, prev, false);
      handlers.onNoteUp?.(prev);
    }
    if (midi != null) {
      active.set(pointerId, midi);
      setPressed(board, midi, true);
      handlers.onNoteDown?.(midi, DEFAULT_VEL);
    } else {
      active.delete(pointerId);
    }
  }

  function releasePointer(pointerId) {
    const midi = active.get(pointerId);
    if (midi == null) return;
    active.delete(pointerId);
    setPressed(board, midi, false);
    handlers.onNoteUp?.(midi);
  }

  board.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    const midi = midiAtPoint(board, e.clientX, e.clientY);
    if (midi != null) press(e.pointerId, midi);
  });

  board.addEventListener("pointermove", (e) => {
    if (!board.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();
    const midi = midiAtPoint(board, e.clientX, e.clientY);
    if (midi != null) press(e.pointerId, midi);
  });

  const end = (e) => {
    if (board.hasPointerCapture(e.pointerId)) {
      try {
        board.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    releasePointer(e.pointerId);
  };

  board.addEventListener("pointerup", end);
  board.addEventListener("pointercancel", end);
  board.addEventListener("lostpointercapture", (e) => releasePointer(e.pointerId));
}

/**
 * @param {HTMLElement} container
 * @param {{ minMidi?: number, maxMidi?: number, onNoteDown?: (midi:number, vel:number)=>void, onNoteUp?: (midi:number)=>void, labelFor?: (m:number)=>string }} opts
 */
export function renderKeyboard(container, opts = {}) {
  if (!container) return;
  const {
    minMidi = 21,
    maxMidi = 108,
    onNoteDown = () => {},
    onNoteUp = () => {},
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

  const handlers = { onNoteDown, onNoteUp };
  const whitesRow = document.createElement("div");
  whitesRow.className = "piano-whites";

  whiteMidis.forEach((midi) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piano-key piano-key-white";
    btn.dataset.midi = String(midi);
    btn.title = labelFor(midi);
    btn.setAttribute("aria-label", labelFor(midi));
    if (midi % 12 === 0) {
      const oct = document.createElement("span");
      oct.className = "piano-key-oct";
      oct.textContent = String(Math.floor(midi / 12) - 1);
      btn.appendChild(oct);
    }
    whitesRow.appendChild(btn);
  });
  board.appendChild(whitesRow);

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (!isBlackKey(midi)) continue;
    const idx = blackAnchorIndex(midi, whiteMidis);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piano-key piano-key-black";
    btn.dataset.midi = String(midi);
    btn.style.setProperty("--piano-black-at", String(idx + 0.68));
    btn.title = labelFor(midi);
    btn.setAttribute("aria-label", labelFor(midi));
    board.appendChild(btn);
  }

  bindGlideKeyboard(board, handlers);

  scroll.appendChild(board);
  container.appendChild(scroll);
}

export function highlightKeys(container, activeMidis) {
  if (!container) return;
  const board = container.querySelector(".piano-keyboard");
  if (!board) return;
  const set = activeMidis instanceof Set ? activeMidis : new Set(activeMidis);
  board.querySelectorAll(".piano-key").forEach((el) => {
    const m = Number(el.dataset.midi);
    el.classList.toggle("pressed", set.has(m));
  });
}
