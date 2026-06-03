/**
 * 播放落块视觉：卷轴下方 → 判定线 → 琴键按下
 */
import { isBlackKey, KEY_SIZE_PRESETS } from "../piano-keyboard.js";

const FALL_LEAD_MS = 2200;
const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;

export function createFallingNotesLane(keyboard) {
  if (!keyboard?.scrollEl || !keyboard.boardEl) return null;

  const scroll = keyboard.scrollEl;
  const board = keyboard.boardEl;

  const lane = document.createElement("div");
  lane.className = "piano-play-lane";
  lane.setAttribute("aria-hidden", "true");

  const inner = document.createElement("div");
  inner.className = "piano-play-lane-inner";

  const hitLine = document.createElement("div");
  hitLine.className = "piano-note-hit-line";
  inner.appendChild(hitLine);

  lane.appendChild(inner);
  scroll.insertBefore(lane, board);

  let rafId = 0;
  let playing = false;
  let startAt = 0;
  /** @type {{ midi: number; onMs: number; offMs: number; spawnMs: number; el: HTMLElement; hit: boolean; removed: boolean; releaseTimer?: number }[]} */
  let blocks = [];
  const releaseTimers = [];

  function syncLaneWidth() {
    const w = board.offsetWidth;
    lane.style.width = `${w}px`;
    inner.style.width = `${w}px`;
  }

  function hitLineY() {
    return inner.clientHeight - 2;
  }

  function blockSize(keyWidth) {
    const w = Math.max(MIN_KEY_W, keyWidth);
    return w;
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
    block.el.style.transform = `translate(${x}px, ${y}px)`;
    block.el.style.zIndex = geom.isBlack ? "3" : "2";

    const crossed =
      fallDuration <= 1 ? elapsed >= block.onMs : progress >= 1 || y >= lineY - 0.5;

    if (!block.hit && crossed) {
      block.hit = true;
      block.el.style.setProperty("--fx", `${x}px`);
      block.el.style.setProperty("--fy", `${y}px`);
      block.el.classList.add("fall-note-flash");
      keyboard.pressVisual?.(block.midi);
      window.setTimeout(() => {
        if (block.el.parentNode) block.el.remove();
        block.removed = true;
      }, 140);
    }
  }

  function tick() {
    if (!playing) return;
    const elapsed = performance.now() - startAt;

    blocks.forEach((block) => {
      if (block.removed) return;
      if (elapsed < block.spawnMs) {
        block.el.style.visibility = "hidden";
        return;
      }
      block.el.style.visibility = "visible";
      layoutBlock(block, elapsed);
    });

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
    events.forEach((ev) => {
      const offMs = ev.offMs ?? ev.onMs + 80;
      const delay = Math.max(0, baseStart + offMs - performance.now());
      const id = window.setTimeout(() => {
        keyboard.releaseVisual?.(ev.midi);
      }, delay);
      releaseTimers.push(id);
    });
  }

  const ro = new ResizeObserver(syncLaneWidth);
  ro.observe(board);

  syncLaneWidth();

  return {
    fallLeadMs: FALL_LEAD_MS,

    start(events, playbackStartAt) {
      clearAll();
      if (!events?.length) return;

      playing = true;
      startAt = playbackStartAt;
      syncLaneWidth();

      blocks = events.map((ev) => ({
        midi: ev.midi,
        onMs: ev.onMs,
        offMs: ev.offMs ?? ev.onMs + 80,
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
  };
}
