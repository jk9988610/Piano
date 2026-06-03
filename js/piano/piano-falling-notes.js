/**
 * 落块矩形：恒定下落速度，矩形中心过判定线时击键（欣赏模式）
 * 练习模式：手动卷轴、宽度随琴键缩放、判定后消失 / 未判定则落至琴键后
 */
import { isBlackKey, KEY_SIZE_PRESETS, getKeyMetrics } from "../piano-keyboard.js";

const SPAWN_TOP = 8;
const SCROLL_LERP = 0.055;
/** 每块从顶缘到中心过线的固定下落时长（ms）；播放开始后先经历此预备段再进入曲谱时间 */
export const FALL_LEAD_MS = 2400;

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

  const spawnLine = document.createElement("div");
  spawnLine.className = "piano-note-spawn-line";
  stageEl.appendChild(spawnLine);

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

  function boardMetrics() {
    return getKeyMetrics(keyboard.boardEl);
  }

  function whiteKeyWidth() {
    return boardMetrics().whiteW;
  }

  function rectHeight() {
    return whiteKeyWidth();
  }

  /** 宽度随琴键 CSS 变量与布局同步，黑键窄、白键宽 */
  function currentRectDims(block) {
    const geom = keyboard.getKeyGeometry?.(block.midi);
    const { whiteW, blackW } = boardMetrics();
    const height = whiteW;
    const width = geom?.width ?? (isBlackKey(block.midi) ? blackW : whiteW);
    return { width, height };
  }

  function gapAboveKeys() {
    return rectHeight();
  }

  function syncTrackAlign() {
    const boardRect = board.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const w = board.offsetWidth || 1;
    track.style.width = `${w}px`;
    track.style.transform = `translateX(${boardRect.left - stageRect.left}px)`;
  }

  function syncLayout() {
    syncTrackAlign();
    const stageH = Math.max(stageEl.clientHeight || 0, 80);
    const gap = gapAboveKeys();
    lineY = Math.max(40, stageH - gap - 16);
    spawnLine.style.top = `${SPAWN_TOP}px`;
    hitLine.style.top = `${lineY}px`;
    return lineY;
  }

  function targetTopFor() {
    return lineY - rectHeight() / 2;
  }

  function fallDistance() {
    return Math.max(1, targetTopFor() - SPAWN_TOP);
  }

  function fallSpeedPxPerMs() {
    return fallDistance() / FALL_LEAD_MS;
  }

  /** 未判定矩形完全落入琴键后的移除阈值（stage 坐标） */
  function hideThresholdY() {
    const stageH = Math.max(stageEl.clientHeight || 0, 80);
    const keyH = board.offsetHeight || 86;
    return stageH + keyH - rectHeight();
  }

  function computeBlockMeta(ev, width) {
    const onMs = ev.onMs;

    return {
      id: ev.id ?? `${ev.midi}-${onMs}`,
      midi: ev.midi,
      velocity: ev.velocity ?? 96,
      onMs,
      offMs: ev.offMs ?? onMs + 80,
      spawnMs: onMs,
      hitMs: onMs + FALL_LEAD_MS,
      fallDuration: FALL_LEAD_MS,
      width,
    };
  }

  function blockProgress(block, elapsed) {
    const t = elapsed - block.spawnMs;
    if (t <= 0) return 0;
    if (t >= block.fallDuration) return 1;
    return t / block.fallDuration;
  }

  function blockTopY(block, elapsed) {
    const targetAtLine = targetTopFor();

    if (mode === "practice" && elapsed > block.hitMs) {
      const postMs = elapsed - block.hitMs;
      return targetAtLine + postMs * fallSpeedPxPerMs();
    }

    return blockProgress(block, elapsed) * targetAtLine;
  }

  function blockCenterY(block, elapsed) {
    const { height } = currentRectDims(block);
    return blockTopY(block, elapsed) + height / 2;
  }

  function targetScrollForMidi(midi) {
    const geom = keyboard.getKeyGeometry?.(midi);
    if (!geom) return scroll.scrollLeft;
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    return Math.max(0, Math.min(max, geom.centerX - scroll.clientWidth * 0.5));
  }

  function updateScrollFollow(elapsed) {
    if (mode === "practice") return;

    const active = blocks.find((b) => !b.removed && !b.resolved && elapsed >= b.spawnMs);
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
    const { width } = currentRectDims(block);
    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (geom) {
      const x = geom.centerX - width / 2;
      block.el.style.setProperty("--fx", `${x}px`);
      block.el.style.setProperty("--fy", `${lineY}px`);
    }
    block.el.classList.add("fall-note-flash");
    window.setTimeout(() => {
      block.el.remove();
      block.removed = true;
    }, 180);
  }

  function removeBlockImmediate(block) {
    if (block.removed) return;
    block.resolved = true;
    block.el.remove();
    block.removed = true;
    if (followMidi === block.midi) followMidi = null;
  }

  function resolveBlockEnjoy(block) {
    if (block.resolved) return;
    block.resolved = true;
    flashBlock(block);
    if (followMidi === block.midi) followMidi = null;
  }

  function layoutBlock(block, elapsed) {
    const geom = keyboard.getKeyGeometry?.(block.midi);
    if (!geom) return;

    const { width, height } = currentRectDims(block);
    const topY = blockTopY(block, elapsed);
    const x = geom.centerX - width / 2;

    block.el.style.width = `${width}px`;
    block.el.style.height = `${height}px`;
    block.el.style.transform = `translate3d(${x}px, ${topY}px, 0)`;

    if (mode === "practice" && topY > lineY - height / 2) {
      block.el.classList.add("fall-note--fallthrough");
      block.el.style.zIndex = "1";
    } else {
      block.el.classList.remove("fall-note--fallthrough");
      block.el.style.zIndex = geom.isBlack ? "5" : "4";
    }

    block.topY = topY;
    block.width = width;
  }

  function tick() {
    if (!playing) return;
    syncLayout();
    const elapsed = Math.max(0, performance.now() - startAt);
    updateScrollFollow(elapsed);

    for (const block of blocks) {
      if (block.removed) continue;

      if (elapsed < block.spawnMs) {
        block.el.style.opacity = "0";
        continue;
      }

      block.el.style.opacity = "1";
      if (block.resolved) continue;

      layoutBlock(block, elapsed);
      const { height } = currentRectDims(block);

      if (mode === "enjoy" && !block.centerHit && elapsed >= block.hitMs) {
        block.centerHit = true;
        onCenterHit?.(block.midi, block.velocity, block);
        resolveBlockEnjoy(block);
        continue;
      }

      if (mode === "practice") {
        if (!block.judged && block.topY > lineY + height / 2) {
          block.judged = true;
          block.missed = true;
          block.onMiss?.(block);
        }

        if (block.topY > hideThresholdY()) {
          removeBlockImmediate(block);
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
      if (block.removed) continue;
      if (!block.judged) {
        block.judged = true;
        block.onMiss?.(block);
      }
      if (mode === "enjoy" && !block.resolved) {
        resolveBlockEnjoy(block);
      } else if (!block.removed) {
        removeBlockImmediate(block);
      }
    }
  }

  function clearAll() {
    playing = false;
    followMidi = null;
    stageEl.classList.remove("fall-notes-stage--playing", "fall-notes-stage--practice");
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
      const width = geom?.width ?? whiteKeyWidth();
      const meta = computeBlockMeta({ ...ev, id: ev.id ?? `n${i}` }, width);
      return {
        ...meta,
        el: createBlockEl(isBlackKey(ev.midi)),
        centerHit: false,
        resolved: false,
        judged: false,
        missed: false,
        onMiss: null,
      };
    });
  }

  function applyModeClass() {
    stageEl.classList.toggle("fall-notes-stage--practice", mode === "practice");
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
      applyModeClass();
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

    /** 绝对距离：返回中心最接近判定线的未判定矩形（与按键音高无关） */
    findNearestBlock() {
      if (!playing) return null;
      const elapsed = Math.max(0, performance.now() - startAt);
      const candidates = blocks.filter(
        (b) => !b.judged && !b.removed && !b.resolved && elapsed >= b.spawnMs
      );
      if (!candidates.length) return null;

      let nearest = candidates[0];
      let bestDist = Math.abs(blockCenterY(nearest, elapsed) - lineY);
      for (let i = 1; i < candidates.length; i += 1) {
        const d = Math.abs(blockCenterY(candidates[i], elapsed) - lineY);
        if (d < bestDist) {
          nearest = candidates[i];
          bestDist = d;
        }
      }

      const { width, height } = currentRectDims(nearest);
      return {
        block: nearest,
        topY: blockTopY(nearest, elapsed),
        lineY,
        width,
        height,
        size: height,
        elapsed,
      };
    },

    markJudged(block) {
      block.judged = true;
      removeBlockImmediate(block);
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
      applyModeClass();

      blocks = buildBlocks(events);
      playbackEndMs = Math.max(...blocks.map((b) => b.offMs)) + FALL_LEAD_MS + 400;

      for (const block of blocks) {
        block.onMiss = options.onBlockMiss ?? null;
      }

      syncLayout();
      for (const block of blocks) {
        layoutBlock(block, block.spawnMs);
        block.el.style.opacity = block.spawnMs <= 0 ? "1" : "0";
      }

      rafId = requestAnimationFrame(tick);
    },

    stop() {
      clearAll();
    },

    refresh() {
      keyboard.refreshLayout?.();
      syncLayout();
      if (!playing) return;
      const elapsed = Math.max(0, performance.now() - startAt);
      for (const block of blocks) {
        if (block.removed || elapsed < block.spawnMs) continue;
        layoutBlock(block, elapsed);
      }
    },

    destroy() {
      clearAll();
      scroll.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncLayout);
      ro.disconnect();
      stageEl.innerHTML = "";
      stageEl.classList.remove("fall-notes-stage--active", "fall-notes-stage--playing", "fall-notes-stage--practice");
      stageEl.setAttribute("aria-hidden", "true");
    },
  };
}
