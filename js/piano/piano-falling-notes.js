/**
 * 落块视觉：卷轴下方大落块区 → 判定线（距琴键约一块高）→ 琴键
 * 方块落点与琴键按下由 scheduler 统一计时，此处只做动画
 */
import { isBlackKey, KEY_SIZE_PRESETS, DEFAULT_KEY_SIZE_INDEX } from "../piano-keyboard.js";

const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;
const BLOCK_SCALE = 1.2;
const SCROLL_LERP = 0.055;
const DEFAULT_BLOCK_GAP = Math.round(KEY_SIZE_PRESETS[DEFAULT_KEY_SIZE_INDEX].w * BLOCK_SCALE);

export function createFallingNotesLane(keyboard, stageEl) {
  if (!keyboard?.scrollEl || !keyboard?.boardEl || !stageEl) return null;

  const scroll = keyboard.scrollEl;
  const board = keyboard.boardEl;

  stageEl.innerHTML = "";
  stageEl.classList.add("fall-notes-stage--active");

  const track = document.createElement("div");
  track.className = "fall-notes-track";

  const inner = document.createElement("div");
  inner.className = "fall-notes-inner";

  const hitLine = document.createElement("div");
  hitLine.className = "piano-note-hit-line";
  stageEl.appendChild(hitLine);

  track.appendChild(inner);
  stageEl.appendChild(track);

  let rafId = 0;
  let playing = false;
  let startAt = 0;
  let blocks = [];
  const hitTimers = [];
  let followMidi = null;

  function blockSize(keyWidth) {
    return Math.max(MIN_KEY_W, Math.round(keyWidth * BLOCK_SCALE));
  }

  function gapAboveKeys() {
    const geom = keyboard.getKeyGeometry?.(60) || keyboard.getKeyGeometry?.(21);
    return geom ? blockSize(geom.width) : DEFAULT_BLOCK_GAP;
  }

  function syncTrackAlign() {
    const boardRect = board.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const w = board.offsetWidth || 1;
    track.style.width = `${w}px`;
    track.style.transform = `translateX(${boardRect.left - stageRect.left}px)`;
  }

  /** 判定线：琴键顶缘上方约一块高度；落块道顶 = 卷轴下缘 */
  function syncLayout() {
    syncTrackAlign();
    const boardRect = board.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const gap = gapAboveKeys();

    const lineTopInStage = boardRect.top - stageRect.top - gap;
    hitLine.style.top = `${Math.max(8, lineTopInStage)}px`;

    return Math.max(16, lineTopInStage - 2);
  }

  function targetScrollForMidi(midi) {
    const geom = keyboard.getKeyGeometry?.(midi);
    if (!geom) return scroll.scrollLeft;
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    return Math.max(0, Math.min(max, geom.centerX - scroll.clientWidth * 0.5));
  }

  function updateScrollFollow(elapsed) {
    const active = blocks.find((b) => !b.removed && !b.hit && elapsed >= b.spawnMs);
    if (!active) return;

    if (followMidi !== active.midi) followMidi = active.midi;

    const target = targetScrollForMidi(followMidi);
    const cur = scroll.scrollLeft;
    const diff = target - cur;
    if (Math.abs(diff) < 1.5) {
      scroll.scrollLeft = target;
      return;
    }
    scroll.scrollLeft = cur + diff * SCROLL_LERP;
  }

  function createBlockEl(isBlack) {
    const el = document.createElement("div");
    el.className = `fall-note ${isBlack ? "fall-note-black" : "fall-note-white"}`;
    inner.appendChild(el);
    return el;
  }

  function triggerBlockHit(block) {
    if (block.removed || block.hit) return;
    block.hit = true;
    if (followMidi === block.midi) followMidi = null;

    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (geom) {
      const size = blockSize(geom.width);
      const x = geom.centerX - size / 2;
      const lineY = syncLayout();
      block.el.style.setProperty("--fx", `${x}px`);
      block.el.style.setProperty("--fy", `${lineY}px`);
    }
    block.el.classList.add("fall-note-flash");
    window.setTimeout(() => {
      block.el.remove();
      block.removed = true;
    }, 180);
  }

  function layoutBlock(block, elapsed, lineY) {
    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (!geom) return;

    const size = blockSize(geom.width);
    const fallDuration = Math.max(1, block.onMs - block.spawnMs);
    const progress = Math.max(0, Math.min(1, (elapsed - block.spawnMs) / fallDuration));
    const y = progress * lineY;
    const x = geom.centerX - size / 2;

    block.el.style.width = `${size}px`;
    block.el.style.height = `${size}px`;
    block.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    block.el.style.zIndex = geom.isBlack ? "3" : "2";
  }

  function tick() {
    if (!playing) return;
    const lineY = syncLayout();
    const elapsed = Math.max(0, performance.now() - startAt);
    updateScrollFollow(elapsed);

    for (const block of blocks) {
      if (block.removed) continue;
      if (elapsed < block.spawnMs) {
        block.el.style.opacity = "0";
        continue;
      }
      block.el.style.opacity = "1";
      if (!block.hit) layoutBlock(block, elapsed, lineY);
    }

    rafId = requestAnimationFrame(tick);
  }

  function clearAll() {
    playing = false;
    followMidi = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    hitTimers.forEach((id) => clearTimeout(id));
    hitTimers.length = 0;
    blocks.forEach((b) => b.el.remove());
    blocks = [];
  }

  function scheduleHits(playbackStartAt) {
    for (const block of blocks) {
      const delay = Math.max(0, playbackStartAt + block.onMs - performance.now());
      hitTimers.push(window.setTimeout(() => triggerBlockHit(block), delay));
    }
  }

  const onScroll = () => syncLayout();
  scroll.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncLayout);

  const ro = new ResizeObserver(syncLayout);
  ro.observe(board);
  ro.observe(stageEl);
  syncLayout();

  return {
    start(events, playbackStartAt) {
      clearAll();
      if (!events?.length) return;

      playing = true;
      startAt = playbackStartAt;
      followMidi = null;
      syncLayout();

      const leadMs = Math.max(1200, syncLayout() * 8);

      blocks = events.map((ev) => ({
        midi: ev.midi,
        onMs: ev.onMs,
        spawnMs: Math.max(0, ev.onMs - leadMs),
        el: createBlockEl(isBlackKey(ev.midi)),
        hit: false,
        removed: false,
      }));

      scheduleHits(playbackStartAt);
      rafId = requestAnimationFrame(tick);
    },

    stop() {
      clearAll();
    },

    refresh() {
      syncLayout();
    },

    destroy() {
      clearAll();
      scroll.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncLayout);
      ro.disconnect();
      stageEl.innerHTML = "";
      stageEl.classList.remove("fall-notes-stage--active");
    },
  };
}
