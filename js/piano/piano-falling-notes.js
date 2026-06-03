/**
 * 落块视觉：判定线对齐琴键顶缘；滚轴逐块平滑跟随
 */
import { isBlackKey, KEY_SIZE_PRESETS } from "../piano-keyboard.js";

const FALL_LEAD_MS = 2400;
const MIN_LANE_H = 48;
const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;
const BLOCK_SCALE = 1.2;
const SCROLL_LERP = 0.055;

export function createFallingNotesLane(keyboard) {
  if (!keyboard?.scrollEl || !keyboard?.boardEl) return null;

  const scroll = keyboard.scrollEl;
  const board = keyboard.boardEl;
  const host = scroll.parentElement;
  if (!host) return null;

  host.classList.add("piano-keyboard-host--with-fall");
  host.style.position = "relative";

  const overlay = document.createElement("div");
  overlay.className = "fall-notes-overlay";

  const track = document.createElement("div");
  track.className = "fall-notes-track";

  const inner = document.createElement("div");
  inner.className = "fall-notes-inner";

  const hitLine = document.createElement("div");
  hitLine.className = "piano-note-hit-line";

  track.appendChild(inner);
  overlay.appendChild(track);
  host.insertBefore(overlay, scroll);
  host.appendChild(hitLine);

  let rafId = 0;
  let playing = false;
  let startAt = 0;
  let blocks = [];
  const releaseTimers = [];
  let followMidi = null;

  function syncTrackAlign() {
    const boardRect = board.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const w = board.offsetWidth || 1;
    track.style.width = `${w}px`;
    track.style.transform = `translateX(${boardRect.left - overlayRect.left}px)`;
  }

  /** 判定线 Y：落块道内，落点 = 琴键顶缘 */
  function syncLayout() {
    syncTrackAlign();
    const boardRect = board.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();

    const laneH = Math.max(MIN_LANE_H, Math.round(boardRect.top - overlayRect.top));
    overlay.style.height = `${laneH}px`;

    const lineTop = boardRect.top - hostRect.top - 1;
    hitLine.style.top = `${lineTop}px`;

    return Math.max(8, laneH - 2);
  }

  function targetScrollForMidi(midi) {
    const geom = keyboard.getKeyGeometry?.(midi);
    if (!geom) return scroll.scrollLeft;
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    return Math.max(0, Math.min(max, geom.centerX - scroll.clientWidth * 0.5));
  }

  /** 逐块跟随：当前块命中前不换目标；平滑滚动 */
  function updateScrollFollow(elapsed) {
    const active = blocks.find((b) => !b.removed && !b.hit && elapsed >= b.spawnMs);
    if (!active) return;

    if (followMidi !== active.midi) {
      followMidi = active.midi;
    }

    const target = targetScrollForMidi(followMidi);
    const cur = scroll.scrollLeft;
    const diff = target - cur;

    if (Math.abs(diff) < 1.5) {
      scroll.scrollLeft = target;
      return;
    }
    scroll.scrollLeft = cur + diff * SCROLL_LERP;
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

    if (!block.hit && (progress >= 1 || y >= lineY - 0.5)) {
      block.hit = true;
      if (followMidi === block.midi) followMidi = null;
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
      layoutBlock(block, elapsed, lineY);
    }

    rafId = requestAnimationFrame(tick);
  }

  function clearAll() {
    playing = false;
    followMidi = null;
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

  const onScroll = () => syncLayout();
  scroll.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncLayout);

  const ro = new ResizeObserver(syncLayout);
  ro.observe(board);
  ro.observe(overlay);
  ro.observe(host);
  syncLayout();

  return {
    start(events, playbackStartAt) {
      clearAll();
      if (!events?.length) return;

      playing = true;
      startAt = playbackStartAt;
      followMidi = null;
      syncLayout();

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
      syncLayout();
    },

    destroy() {
      clearAll();
      scroll.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncLayout);
      ro.disconnect();
      hitLine.remove();
      overlay.remove();
      host.classList.remove("piano-keyboard-host--with-fall");
      host.style.position = "";
    },
  };
}
