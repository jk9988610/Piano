/**
 * 落块视觉：紧挨琴键上方，与键盘共用横向滚动
 */
import { isBlackKey, KEY_SIZE_PRESETS } from "../piano-keyboard.js";

const FALL_LEAD_MS = 2000;
/** 落块道高度；判定线在底部，紧贴琴键顶缘 */
const LANE_HEIGHT_PX = 64;
const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;

export function createFallingNotesLane(keyboard) {
  if (!keyboard?.scrollEl || !keyboard?.boardEl) return null;

  const scroll = keyboard.scrollEl;
  const board = keyboard.boardEl;

  const lane = document.createElement("div");
  lane.className = "fall-notes-lane";

  const inner = document.createElement("div");
  inner.className = "fall-notes-inner";

  const hitLine = document.createElement("div");
  hitLine.className = "piano-note-hit-line";
  inner.appendChild(hitLine);

  lane.appendChild(inner);
  scroll.insertBefore(lane, board);

  scroll.classList.add("piano-keyboard-scroll--with-lane");

  let rafId = 0;
  let playing = false;
  let startAt = 0;
  let blocks = [];
  const releaseTimers = [];

  function hitLineY() {
    return LANE_HEIGHT_PX - 1;
  }

  function syncLaneWidth() {
    const w = board.offsetWidth || 1;
    lane.style.width = `${w}px`;
  }

  function blockSize(keyWidth) {
    return Math.max(MIN_KEY_W, keyWidth);
  }

  function createBlockEl(isBlack) {
    const el = document.createElement("div");
    el.className = `fall-note ${isBlack ? "fall-note-black" : "fall-note-white"}`;
    inner.appendChild(el);
    return el;
  }

  function layoutBlock(block, elapsed) {
    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (!geom) return;

    const size = blockSize(geom.width);
    const lineY = hitLineY();
    const fallDuration = Math.max(1, block.onMs - block.spawnMs);
    const progress = Math.max(0, Math.min(1, (elapsed - block.spawnMs) / fallDuration));
    const y = progress * lineY;
    const x = geom.centerX - size / 2;

    block.el.style.width = `${size}px`;
    block.el.style.height = `${size}px`;
    block.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    block.el.style.zIndex = geom.isBlack ? "3" : "2";

    if (!block.hit && (progress >= 1 || y >= lineY - 0.5)) {
      block.hit = true;
      block.el.style.setProperty("--fx", `${x}px`);
      block.el.style.setProperty("--fy", `${y}px`);
      block.el.classList.add("fall-note-flash");
      keyboard.pressVisual?.(block.midi);
      window.setTimeout(() => {
        block.el.remove();
        block.removed = true;
      }, 160);
    }
  }

  function tick() {
    if (!playing) return;
    syncLaneWidth();
    const elapsed = Math.max(0, performance.now() - startAt);

    for (const block of blocks) {
      if (block.removed) continue;
      if (elapsed < block.spawnMs) {
        block.el.style.visibility = "hidden";
        continue;
      }
      block.el.style.visibility = "visible";
      layoutBlock(block, elapsed);
    }

    rafId = requestAnimationFrame(tick);
  }

  function clearAll() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    releaseTimers.forEach((id) => clearTimeout(id));
    releaseTimers.length = 0;
    blocks.forEach((b) => b.el.remove());
    blocks = [];
    keyboard.releaseAllVisual?.();
  }

  function scheduleReleases(events, baseStart) {
    for (const ev of events) {
      const offMs = ev.offMs ?? ev.onMs + 80;
      const delay = Math.max(0, baseStart + offMs - performance.now());
      releaseTimers.push(
        window.setTimeout(() => keyboard.releaseVisual?.(ev.midi), delay)
      );
    }
  }

  const ro = new ResizeObserver(syncLaneWidth);
  ro.observe(board);
  syncLaneWidth();

  return {
    start(events, playbackStartAt) {
      clearAll();
      if (!events?.length) return;

      playing = true;
      startAt = playbackStartAt;
      syncLaneWidth();

      blocks = events.map((ev) => ({
        midi: ev.midi,
        onMs: ev.onMs,
        spawnMs: Math.max(0, ev.onMs - FALL_LEAD_MS),
        el: createBlockEl(isBlackKey(ev.midi)),
        hit: false,
        removed: false,
      }));

      scheduleReleases(events, playbackStartAt);
      rafId = requestAnimationFrame(tick);
    },

    stop() {
      clearAll();
    },

    refresh() {
      syncLaneWidth();
    },

    destroy() {
      clearAll();
      ro.disconnect();
      lane.remove();
      scroll.classList.remove("piano-keyboard-scroll--with-lane");
    },
  };
}
