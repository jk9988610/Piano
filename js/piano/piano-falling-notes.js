/**
 * 落块视觉：恒定下落速度，方块中心过判定线时击键（欣赏模式）
 * 练习模式：仅落块 + 位置查询，供玩家手动击键评分
 */
import { isBlackKey, KEY_SIZE_PRESETS, DEFAULT_KEY_SIZE_INDEX } from "../piano-keyboard.js";

const MIN_KEY_W = KEY_SIZE_PRESETS[0].w;
const BLOCK_SCALE = 1.35;
const SCROLL_LERP = 0.055;
const DEFAULT_BLOCK_GAP = Math.round(KEY_SIZE_PRESETS[DEFAULT_KEY_SIZE_INDEX].w * BLOCK_SCALE);
/** 每块从顶缘到中心过线的固定下落时长（ms） */
const FALL_LEAD_MS = 2400;

export function createFallingNotesLane(keyboard, stageEl, opts = {}) {
  if (!keyboard?.scrollEl || !keyboard?.boardEl || !stageEl) return null;

  const scroll = keyboard.scrollEl;
  const board = keyboard.boardEl;
  let mode = "enjoy";
  let onCenterHit = opts.onCenterHit ?? null;
  let onPlaybackComplete = opts.onPlaybackComplete ?? null;

  stageEl.innerHTML = "";
  stageEl.classList.add("fall-notes-stage--active");
  stageEl.setAttribute("aria-hidden", "false");

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
  let followMidi = null;
  let lineY = 0;
  let playbackEndMs = 0;

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

  /** 判定线固定在落块区内部底缘上方，避免溢出被裁切 */
  function syncLayout() {
    syncTrackAlign();
    const stageH = Math.max(stageEl.clientHeight || 0, 80);
    const gap = gapAboveKeys();
    lineY = Math.max(40, stageH - gap - 16);
    hitLine.style.top = `${lineY}px`;
    return lineY;
  }

  function targetTopFor(size) {
    return Math.max(8, lineY - size / 2);
  }

  function computeBlockMeta(ev, size) {
    const onMs = ev.onMs;
    const virtualSpawnMs = onMs - FALL_LEAD_MS;
    const spawnMs = Math.max(0, virtualSpawnMs);

    return {
      id: ev.id ?? `${ev.midi}-${onMs}`,
      midi: ev.midi,
      velocity: ev.velocity ?? 96,
      onMs,
      offMs: ev.offMs ?? onMs + 80,
      virtualSpawnMs,
      spawnMs,
      fallDuration: FALL_LEAD_MS,
      size,
    };
  }

  /** 恒定下落：virtualSpawn 可为负，开头音符视为已在途中 */
  function blockProgress(block, elapsed) {
    const t = elapsed - block.virtualSpawnMs;
    if (t <= 0) return 0;
    if (t >= block.fallDuration) return 1;
    return t / block.fallDuration;
  }

  function blockTopY(block, elapsed) {
    const progress = blockProgress(block, elapsed);
    return progress * targetTopFor(block.size);
  }

  function blockCenterY(block, elapsed) {
    return blockTopY(block, elapsed) + block.size / 2;
  }

  function targetScrollForMidi(midi) {
    const geom = keyboard.getKeyGeometry?.(midi);
    if (!geom) return scroll.scrollLeft;
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    return Math.max(0, Math.min(max, geom.centerX - scroll.clientWidth * 0.5));
  }

  function updateScrollFollow(elapsed) {
    const active = blocks.find((b) => !b.removed && !b.resolved && elapsed >= b.virtualSpawnMs);
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

  function flashBlock(block) {
    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (geom) {
      const x = geom.centerX - block.size / 2;
      block.el.style.setProperty("--fx", `${x}px`);
      block.el.style.setProperty("--fy", `${lineY}px`);
    }
    block.el.classList.add("fall-note-flash");
    window.setTimeout(() => {
      block.el.remove();
      block.removed = true;
    }, 180);
  }

  function resolveBlock(block) {
    if (block.resolved) return;
    block.resolved = true;
    flashBlock(block);
    if (followMidi === block.midi) followMidi = null;
  }

  function layoutBlock(block, elapsed, progress = blockProgress(block, elapsed)) {
    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (!geom) return;

    const topY = progress * targetTopFor(block.size);
    const x = geom.centerX - block.size / 2;

    block.el.style.width = `${block.size}px`;
    block.el.style.height = `${block.size}px`;
    block.el.style.transform = `translate3d(${x}px, ${topY}px, 0)`;
    block.el.style.zIndex = geom.isBlack ? "5" : "4";
    block.topY = topY;
  }

  function tick() {
    if (!playing) return;
    syncLayout();
    const elapsed = Math.max(0, performance.now() - startAt);
    updateScrollFollow(elapsed);

    for (const block of blocks) {
      if (block.removed) continue;

      const progress = blockProgress(block, elapsed);
      if (progress <= 0) {
        block.el.style.opacity = "0";
        continue;
      }

      block.el.style.opacity = "1";
      if (block.resolved) continue;

      layoutBlock(block, elapsed, progress);
      block.topY = blockTopY(block, elapsed);

      if (mode === "enjoy" && !block.centerHit && elapsed >= block.onMs) {
        block.centerHit = true;
        onCenterHit?.(block.midi, block.velocity, block);
        resolveBlock(block);
      } else if (mode === "practice" && !block.judged && !block.resolved) {
        if (block.topY > lineY + block.size / 2) {
          block.judged = true;
          block.onMiss?.(block);
          resolveBlock(block);
        }
      }
    }

    if (elapsed >= playbackEndMs && playing) {
      playing = false;
      stageEl.classList.remove("fall-notes-stage--playing");
      finalizeUnjudged();
      onPlaybackComplete?.();
    }

    if (playing) rafId = requestAnimationFrame(tick);
  }

  function finalizeUnjudged() {
    for (const block of blocks) {
      if (block.judged || block.removed) continue;
      block.judged = true;
      block.onMiss?.(block);
      if (!block.resolved) resolveBlock(block);
    }
  }

  function clearAll() {
    playing = false;
    followMidi = null;
    stageEl.classList.remove("fall-notes-stage--playing");
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    blocks.forEach((b) => b.el.remove());
    blocks = [];
    playbackEndMs = 0;
  }

  function buildBlocks(events) {
    syncLayout();
    return events.map((ev, i) => {
      const geom = keyboard.getKeyGeometry?.(ev.midi);
      const size = geom ? blockSize(geom.width) : blockSize(DEFAULT_BLOCK_GAP);
      const meta = computeBlockMeta({ ...ev, id: ev.id ?? `n${i}` }, size);
      return {
        ...meta,
        el: createBlockEl(isBlackKey(ev.midi)),
        centerHit: false,
        resolved: false,
        judged: false,
        onMiss: null,
      };
    });
  }

  const onScroll = () => syncLayout();
  scroll.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncLayout);

  const ro = new ResizeObserver(syncLayout);
  ro.observe(board);
  ro.observe(stageEl);
  syncLayout();

  return {
    setMode(next) {
      mode = next === "practice" ? "practice" : "enjoy";
    },

    getMode() {
      return mode;
    },

    setCallbacks(cbs = {}) {
      onCenterHit = cbs.onCenterHit ?? onCenterHit;
      onPlaybackComplete = cbs.onPlaybackComplete ?? onPlaybackComplete;
    },

    getLineY() {
      return syncLayout();
    },

    findActiveBlock(midi) {
      if (!playing) return null;
      const elapsed = Math.max(0, performance.now() - startAt);
      const candidates = blocks.filter(
        (b) =>
          b.midi === midi &&
          !b.judged &&
          !b.removed &&
          !b.resolved &&
          elapsed >= b.virtualSpawnMs
      );
      if (!candidates.length) return null;

      let best = candidates[0];
      let bestDist = Math.abs(blockCenterY(best, elapsed) - lineY);
      for (let i = 1; i < candidates.length; i += 1) {
        const d = Math.abs(blockCenterY(candidates[i], elapsed) - lineY);
        if (d < bestDist) {
          best = candidates[i];
          bestDist = d;
        }
      }
      return { block: best, topY: blockTopY(best, elapsed), lineY, size: best.size, elapsed };
    },

    markJudged(block) {
      block.judged = true;
      resolveBlock(block);
    },

    start(events, playbackStartAt, options = {}) {
      clearAll();
      if (!events?.length) return;

      mode = options.mode === "practice" ? "practice" : "enjoy";
      playing = true;
      startAt = playbackStartAt;
      followMidi = null;
      stageEl.classList.add("fall-notes-stage--playing");
      stageEl.setAttribute("aria-hidden", "false");

      blocks = buildBlocks(events);
      playbackEndMs = Math.max(...blocks.map((b) => b.offMs)) + 400;

      for (const block of blocks) {
        block.onMiss = options.onBlockMiss ?? null;
      }

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
      stageEl.classList.remove("fall-notes-stage--active", "fall-notes-stage--playing");
      stageEl.setAttribute("aria-hidden", "true");
    },
  };
}
