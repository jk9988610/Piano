/**
 * 播放落块视觉：导航条下方独立落块区，与琴键横向同步
 */
import { isBlackKey, KEY_SIZE_PRESETS } from "../piano-keyboard.js";

const FALL_LEAD_MS = 2200;
const LANE_HEIGHT = 120;
const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;

export function createFallingNotesLane(keyboard, stageEl) {
  if (!keyboard?.boardEl || !keyboard?.scrollEl || !stageEl) return null;

  const board = keyboard.boardEl;
  const scroll = keyboard.scrollEl;

  stageEl.innerHTML = "";
  stageEl.classList.add("fall-notes-stage--ready");

  const track = document.createElement("div");
  track.className = "fall-notes-track";

  const inner = document.createElement("div");
  inner.className = "fall-notes-inner";

  const hitLine = document.createElement("div");
  hitLine.className = "piano-note-hit-line";
  inner.appendChild(hitLine);

  track.appendChild(inner);
  stageEl.appendChild(track);

  let rafId = 0;
  let playing = false;
  let startAt = 0;
  let blocks = [];
  const releaseTimers = [];

  function hitLineY() {
    return LANE_HEIGHT - 2;
  }

  function syncTrackPosition() {
    const boardRect = board.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const w = board.offsetWidth || 1;
    track.style.width = `${w}px`;
    track.style.transform = `translateX(${boardRect.left - stageRect.left}px)`;
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
    block.el.style.transform = `translate(${x}px, ${y}px)`;
    block.el.style.zIndex = geom.isBlack ? "3" : "2";

    const crossed = progress >= 1 || y >= lineY - 0.5;

    if (!block.hit && crossed) {
      block.hit = true;
      block.el.style.setProperty("--fx", `${x}px`);
      block.el.style.setProperty("--fy", `${y}px`);
      block.el.classList.add("fall-note-flash");
      keyboard.pressVisual?.(block.midi);
      window.setTimeout(() => {
        if (block.el.parentNode) block.el.remove();
        block.removed = true;
      }, 160);
    }
  }

  function tick() {
    if (!playing) return;
    syncTrackPosition();
    const elapsed = Math.max(0, performance.now() - startAt);

    blocks.forEach((block) => {
      if (block.removed) return;
      if (elapsed < block.spawnMs) {
        block.el.style.opacity = "0";
        return;
      }
      block.el.style.opacity = "1";
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
      releaseTimers.push(
        window.setTimeout(() => {
          keyboard.releaseVisual?.(ev.midi);
        }, delay)
      );
    });
  }

  const onScroll = () => syncTrackPosition();
  scroll.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncTrackPosition);

  const ro = new ResizeObserver(syncTrackPosition);
  ro.observe(board);
  ro.observe(stageEl);

  syncTrackPosition();

  return {
    start(events, playbackStartAt) {
      clearAll();
      if (!events?.length) return;

      playing = true;
      startAt = playbackStartAt;
      syncTrackPosition();

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
      syncTrackPosition();
    },

    destroy() {
      clearAll();
      scroll.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncTrackPosition);
      ro.disconnect();
      stageEl.innerHTML = "";
      stageEl.classList.remove("fall-notes-stage--ready");
    },
  };
}
