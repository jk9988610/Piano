/**
 * 88 键钢琴键盘 UI（MIDI 21–108，A0–C8）
 * Live play: pointer down/up → onNoteDown / onNoteUp
 */
const BLACK_SEMIS = new Set([1, 3, 6, 8, 10]);

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

function setPressed(container, midi, pressed) {
  const el = container.querySelector(`[data-midi="${midi}"]`);
  if (el) el.classList.toggle("pressed", pressed);
}

function bindLiveKey(btn, midi, handlers) {
  const down = (e) => {
    e.preventDefault();
    if (btn.dataset.held === "1") return;
    btn.dataset.held = "1";
    setPressed(btn.closest(".piano-keyboard-host"), midi, true);
    handlers.onNoteDown?.(midi, 121);
  };
  const up = (e) => {
    e.preventDefault();
    if (btn.dataset.held !== "1") return;
    btn.dataset.held = "0";
    setPressed(btn.closest(".piano-keyboard-host"), midi, false);
    handlers.onNoteUp?.(midi);
  };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", (e) => {
    if (btn.dataset.held === "1" && e.buttons === 0) up(e);
  });
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
  board.setAttribute("role", "listbox");
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
    bindLiveKey(btn, midi, handlers);
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
    bindLiveKey(btn, midi, handlers);
    board.appendChild(btn);
  }

  scroll.appendChild(board);
  container.appendChild(scroll);
}

export function highlightKeys(container, activeMidis) {
  if (!container) return;
  const set = activeMidis instanceof Set ? activeMidis : new Set(activeMidis);
  container.querySelectorAll(".piano-key").forEach((el) => {
    const m = Number(el.dataset.midi);
    el.classList.toggle("pressed", set.has(m));
  });
}
