/**
 * 落块视觉：琴键正上方固定落块道（不随滚动裁切），播放时自动滚到音符
 */
import { isBlackKey, KEY_SIZE_PRESETS } from "../piano-keyboard.js";

const FALL_LEAD_MS = 2400;
const LANE_HEIGHT_PX = 88;
const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;
const BLOCK_SCALE = 1.2;

export function createFallingNotesLane(keyboard) {
  if (!keyboard?.scrollEl || !keyboard?.boardEl) return null;

  const scroll = keyboard.scrollEl;
  const board = keyboard.boardEl;
  const host = scroll.parentElement;
  if (!host) return null;

  host.classList.add("piano-keyboard-host--with-fall");

  const overlay = document.createElement("div");
  overlay.className = "fall-notes-overlay";

  const track = document.createElement("div");
  track.className = "fall-notes-track";

  const inner = document.createElement("div");
  inner.className = "fall-notes-inner";

  const hitLine = document.createElement("div");
  hitLine.className = "piano-note-hit-line";
  inner.appendChild(hitLine);

  track.appendChild(inner);
  overlay.appendChild(track);
  host.insertBefore(overlay, scroll);

  let rafId = 0;
  let playing = false;
  let startAt = 0;
  let blocks = [];
  const releaseTimers = [];

  function hitLineY() {
    return LANE_HEIGHT_PX - 2;
  }

  function syncTrackAlign() {
    const boardRect = board.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const w = board.offsetWidth || 1;
    track.style.width = `${w}px`;
    track.style.transform = `translateX(${boardRect.left - overlayRect.left}px)`;
  }

  function scrollKeyIntoView(midi) {
    const geom = keyboard.getKeyGeometry?.(midi);
    if (!geom) return;
    const pad = 48;
    const keyLeft = geom.centerX - geom.width / 2;
    const keyRight = geom.centerX + geom.width / 2;
    const viewLeft = scroll.scrollLeft;
    const viewRight = scroll.scrollLeft + scroll.clientWidth;
    if (keyLeft < viewLeft + pad) {
      scroll.scrollLeft = Math.max(0, keyLeft - pad);
    } else if (keyRight > viewRight - pad) {
      scroll.scrollLeft = Math.min(scroll.scrollWidth - scroll.clientWidth, keyRight - scroll.clientWidth + pad);
    }
  }

  function blockSize(keyWidth) {
    return Math.max(MIN_KEY_W, Math.round(keyWidth * BLOCK_SCALE));
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
      }, 180);
    }
  }

  function scrollToUpcoming(elapsed) {
    const next = blocks.find((b) => !b.hit && !b.removed && elapsed >= b.spawnMs - 200);
    if (next) scrollKeyIntoView(next.midi);
  }

  function tick() {
    if (!playing) return;
    syncTrackAlign();
    const elapsed = Math.max(0, performance.now() - startAt);
    scrollToUpcoming(elapsed);

    for (const block of blocks) {
      if (block.removed) continue;
      if (elapsed < block.spawnMs) {
        block.el.style.opacity = "0";
        continue;
      }
      block.el.style.opacity = "1";
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

  const onScroll = () => syncTrackAlign();
  scroll.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncTrackAlign);

  const ro = new ResizeObserver(syncTrackAlign);
  ro.observe(board);
  ro.observe(overlay);
  syncTrackAlign();

  return {
    start(events, playbackStartAt) {
      clearAll();
      if (!events?.length) return;

      playing = true;
      startAt = playbackStartAt;
      syncTrackAlign();

      if (events[0]?.midi != null) scrollKeyIntoView(events[0].midi);

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
      syncTrackAlign();
    },

    destroy() {
      clearAll();
      scroll.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncTrackAlign);
      ro.disconnect();
      overlay.remove();
      host.classList.remove("piano-keyboard-host--with-fall");
    },
  };
}
