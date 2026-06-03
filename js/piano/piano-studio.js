import { renderKeyboard } from "../piano-keyboard.js";
import { createEngine } from "../piano-engine.js";
import { createEmptyProject, createEventStore } from "./piano-event-store.js";
import { downloadProject, parseProject, readFileAsText, errorMessage } from "./piano-project-io.js";
import { parseScoreToProject, scoreErrorMessage } from "./piano-score-io.js";
import { createScheduler, formatTimeMs } from "./piano-scheduler.js";
import { createController } from "./piano-controller.js";
import { createI18n, resolveLang } from "./piano-i18n.js";
import { createKeyboardNav } from "./piano-keyboard-nav.js";
import { installAppGuards, registerServiceWorker } from "./piano-app-guard.js";
import { createFallingNotesLane } from "./piano-falling-notes.js";

const APP_VERSION = document.querySelector('meta[name="piano-app-version"]')?.content || "0.1.0";

const els = {
  status: document.getElementById("statusText"),
  time: document.getElementById("timeDisplay"),
  version: document.getElementById("versionBadge"),
  keyboardHost: document.getElementById("keyboardHost"),
  fileInput: document.getElementById("fileInput"),
  scoreFileInput: document.getElementById("scoreFileInput"),
  btnNew: document.getElementById("btnNew"),
  btnOpen: document.getElementById("btnOpen"),
  btnSave: document.getElementById("btnSave"),
  btnRecord: document.getElementById("btnRecord"),
  btnStopRec: document.getElementById("btnStopRec"),
  btnPlay: document.getElementById("btnPlay"),
  btnStopPlay: document.getElementById("btnStopPlay"),
  btnOpenScore: document.getElementById("btnOpenScore"),
  btnDemoScore: document.getElementById("btnDemoScore"),
  btnFullscreen: document.getElementById("btnFullscreen"),
  btnKeyZoomOut: document.getElementById("btnKeyZoomOut"),
  btnKeyZoomIn: document.getElementById("btnKeyZoomIn"),
  keyboardNavTrack: document.getElementById("keyboardNavTrack"),
  keyboardMiniMap: document.getElementById("keyboardMiniMap"),
  keyboardNavViewport: document.getElementById("keyboardNavViewport"),
  fallNotesStage: document.getElementById("fallNotesStage"),
};

const i18n = createI18n(resolveLang());
i18n.apply();

installAppGuards(document.querySelector(".keyboard-area"));
installAppGuards(document.querySelector(".fall-notes-stage"));
registerServiceWorker(APP_VERSION);

const engine = createEngine();
const samplesLoadPromise = engine.ensureLoaded();
const eventStore = createEventStore(createEmptyProject("新演奏", APP_VERSION));
const scheduler = createScheduler(engine, eventStore);
const controller = createController({ engine, eventStore, scheduler, onChange: refreshUI });

let scoreLoadedHint = false;
let keyboardNav = null;
let fallingNotes = null;
let keyboard = null;

function formatVersionLabel(manifest) {
  const ver = manifest?.version || APP_VERSION;
  const build = manifest?.build;
  if (build && build !== "dev") return `v${ver} · ${build}`;
  return `v${ver}`;
}

async function loadVersionBadge() {
  if (!els.version) return;
  els.version.textContent = `v${APP_VERSION}`;
  try {
    const res = await fetch(`version.json?v=${encodeURIComponent(APP_VERSION)}`, { cache: "no-store" });
    if (!res.ok) return;
    const manifest = await res.json();
    els.version.textContent = formatVersionLabel(manifest);
    if (manifest.version) {
      document.querySelector('meta[name="piano-app-version"]')?.setAttribute("content", manifest.version);
    }
  } catch {
    /* offline / file:// */
  }
}

function initFullscreen() {
  if (!els.btnFullscreen) return;
  const root = document.documentElement;

  const syncLabel = () => {
    const on = !!document.fullscreenElement;
    els.btnFullscreen.textContent = on ? "⤡" : "⛶";
    const key = on ? "fullscreen.exit" : "fullscreen.enter";
    const label = i18n.t(key);
    els.btnFullscreen.title = label;
    els.btnFullscreen.setAttribute("aria-label", label);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (root.requestFullscreen) {
        await root.requestFullscreen();
        return;
      }
      els.status.textContent = i18n.t("fullscreen.unavailable");
    } catch (err) {
      console.warn("Fullscreen unavailable", err);
      els.status.textContent = i18n.t("fullscreen.unavailable");
    }
  };

  bindPress(els.btnFullscreen, toggleFullscreen);
  document.addEventListener("fullscreenchange", syncLabel);
  syncLabel();
}

function refreshUI() {
  const transport = scheduler.getTransport();
  const dur = eventStore.getDurationMs();
  let pos = 0;
  if (transport === "recording") pos = scheduler.recordingNowMs();
  if (els.time) els.time.textContent = `${formatTimeMs(pos)} / ${formatTimeMs(dur)}`;

  if (els.btnRecord) els.btnRecord.disabled = transport !== "idle";
  if (els.btnStopRec) els.btnStopRec.disabled = transport !== "recording";
  if (els.btnPlay) els.btnPlay.disabled = transport !== "idle" || dur === 0;
  if (els.btnStopPlay) els.btnStopPlay.disabled = transport !== "playing";
  const idle = transport === "idle";
  if (els.btnOpenScore) els.btnOpenScore.disabled = !idle;
  if (els.btnDemoScore) els.btnDemoScore.disabled = !idle;

  els.btnRecord?.classList.toggle("active", transport === "recording");

  if (!els.status) return;
  if (transport === "recording") els.status.textContent = i18n.t("status.recording");
  else if (transport === "playing") els.status.textContent = i18n.t("status.playing");
  else if (scoreLoadedHint) els.status.textContent = i18n.t("status.scoreLoaded");
  else els.status.textContent = engine.isLoaded() ? i18n.t("status.ready") : i18n.t("status.loadingSamples");
}

function noteLabel(midi) {
  return Tone.Frequency(midi, "midi").toNote();
}

function importScoreProject(project) {
  fallingNotes?.stop();
  scheduler.stopPlayback();
  keyboard?.releaseAll();
  eventStore.setProject(project);
  scoreLoadedHint = true;
  refreshUI();
}

async function loadScoreText(text) {
  const result = parseScoreToProject(text, APP_VERSION);
  if (!result.ok) {
    alert(scoreErrorMessage(result.error, i18n.t.bind(i18n)));
    return;
  }
  importScoreProject(result.project);
}

/** click + pointerup so taps work on mobile even when click synthesis is flaky */
function bindPress(el, handler) {
  if (!el) return;
  let lastFire = 0;
  const fire = (e) => {
    if (el.disabled) return;
    if (e.type === "pointerup" && e.pointerType === "mouse" && e.button !== 0) return;
    const now = performance.now();
    if (now - lastFire < 400) return;
    lastFire = now;
    handler(e);
  };
  el.addEventListener("click", fire);
  el.addEventListener("pointerup", fire);
}

let playbackVisualHooks = null;

function bindUi() {
  bindPress(els.btnNew, () => {
    if (!confirm(i18n.t("confirm.new"))) return;
    fallingNotes?.stop();
    scheduler.stopPlayback();
    keyboard?.releaseAll();
    eventStore.reset();
    scoreLoadedHint = false;
    refreshUI();
  });

  bindPress(els.btnOpen, () => els.fileInput?.click());

  els.fileInput?.addEventListener("change", async () => {
    const file = els.fileInput.files?.[0];
    els.fileInput.value = "";
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const result = parseProject(text);
      if (!result.ok) {
        alert(errorMessage(result.error, i18n.t.bind(i18n)));
        return;
      }
      fallingNotes?.stop();
      scheduler.stopPlayback();
      keyboard?.releaseAll();
      eventStore.setProject(result.project);
      scoreLoadedHint = false;
      refreshUI();
    } catch (e) {
      alert(String(e.message || e));
    }
  });

  bindPress(els.btnSave, () => {
    downloadProject(eventStore.getProject());
  });

  bindPress(els.btnOpenScore, () => els.scoreFileInput?.click());

  els.scoreFileInput?.addEventListener("change", async () => {
    const file = els.scoreFileInput.files?.[0];
    els.scoreFileInput.value = "";
    if (!file) return;
    try {
      await loadScoreText(await readFileAsText(file));
    } catch (e) {
      alert(String(e.message || e));
    }
  });

  bindPress(els.btnDemoScore, async () => {
    try {
      const url = new URL("scores/twinkle.json", window.location.href).href;
      const res = await fetch(`${url}?v=${encodeURIComponent(APP_VERSION)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      await loadScoreText(await res.text());
    } catch {
      alert(i18n.t("score.error.load_failed"));
    }
  });

  bindPress(els.btnRecord, async () => {
    await controller.ensureAudioReady();
    eventStore.reset(eventStore.getTitle());
    scoreLoadedHint = false;
    controller.startRecording();
  });

  bindPress(els.btnStopRec, () => {
    keyboard?.releaseAll();
    controller.stopRecording();
  });

  bindPress(els.btnPlay, async () => {
    fallingNotes?.stop();
    keyboard?.releaseAll();
    await controller.ensureAudioReady();
    scoreLoadedHint = false;
    controller.startPlayback(playbackVisualHooks);
    refreshUI();
  });

  bindPress(els.btnStopPlay, () => controller.stopPlayback());

  initFullscreen();
}

bindUi();

keyboard = renderKeyboard(els.keyboardHost, {
  onNoteDown: (midi, vel) => controller.handleNote(midi, vel, true),
  onNoteUp: (midi) => controller.handleNote(midi, 64, false),
  onFirstInteraction: () => controller.ensureAudioReady().catch(() => {}),
  onLayoutChange: () => {
    keyboardNav?.refresh();
    fallingNotes?.refresh();
  },
  labelFor: noteLabel,
});

playbackVisualHooks = {
  onPlaybackStart: (events, startAt) => fallingNotes?.start(events, startAt),
  onPlaybackStop: () => {
    fallingNotes?.stop();
    keyboard?.releaseAllVisual();
  },
  onNoteOn: (midi) => keyboard?.pressVisual(midi),
  onNoteOff: (midi) => keyboard?.releaseVisual(midi),
};

try {
  if (keyboard && els.fallNotesStage) {
    fallingNotes = createFallingNotesLane(keyboard, els.fallNotesStage);
  }
} catch (err) {
  console.error("Falling notes init failed", err);
}

try {
  if (keyboard && els.keyboardNavTrack) {
    keyboardNav = createKeyboardNav({
      trackEl: els.keyboardNavTrack,
      viewportEl: els.keyboardNavViewport,
      miniEl: els.keyboardMiniMap,
      btnZoomOut: els.btnKeyZoomOut,
      btnZoomIn: els.btnKeyZoomIn,
      keyboard,
    });
  }
} catch (err) {
  console.error("Keyboard nav init failed", err);
}

loadVersionBadge();

samplesLoadPromise
  .then(() => {
    controller.initMidi();
    refreshUI();
    keyboardNav?.refresh();
  })
  .catch((err) => {
    if (els.status) els.status.textContent = String(err.message || err);
    console.error(err);
  });

setInterval(() => {
  if (scheduler.getTransport() === "recording") refreshUI();
}, 100);

refreshUI();
