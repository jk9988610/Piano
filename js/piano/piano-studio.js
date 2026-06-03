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
import { createPracticeSession, createJudgeHud, JUDGE } from "./piano-practice.js";

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
  btnPlayMode: document.getElementById("btnPlayMode"),
  btnOpenScore: document.getElementById("btnOpenScore"),
  btnDemoTwinkle: document.getElementById("btnDemoTwinkle"),
  btnDemoBirthday: document.getElementById("btnDemoBirthday"),
  btnDemoTwoTigers: document.getElementById("btnDemoTwoTigers"),
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

/** enjoy = 欣赏（自动击键）；practice = 练习（手动击键 + 评分） */
let playMode = "enjoy";
let practiceSession = null;
let judgeHud = null;
let practiceResultShown = false;

const controller = createController({
  engine,
  eventStore,
  scheduler,
  onChange: refreshUI,
  getPlayMode: () => playMode,
  onPracticeHit: (midi, velocity) => handlePracticeHit(midi, velocity),
});

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
  els.version.textContent = formatVersionLabel({ version: APP_VERSION });
  try {
    const res = await fetch(`version.json?v=${encodeURIComponent(APP_VERSION)}`, { cache: "no-store" });
    if (!res.ok) return;
    const manifest = await res.json();
    if (manifest.version !== APP_VERSION) return;
    els.version.textContent = formatVersionLabel(manifest);
  } catch {
    /* offline / file:// */
  }
}

function syncPlayModeButton() {
  if (!els.btnPlayMode) return;
  const labelKey = playMode === "practice" ? "mode.practice" : "mode.enjoy";
  const hintKey = playMode === "practice" ? "mode.practiceHint" : "mode.enjoyHint";
  const label = i18n.t(labelKey);
  els.btnPlayMode.textContent = label;
  els.btnPlayMode.title = i18n.t(hintKey);
  els.btnPlayMode.setAttribute("aria-label", label);
}

function resetPracticeSession() {
  const events = eventStore.getProject().session.events;
  practiceSession = events.length ? createPracticeSession(events.length) : null;
  practiceResultShown = false;
  judgeHud?.clear();
}

function updatePracticeHud() {
  if (!practiceSession) return;
  judgeHud?.updateRunning(practiceSession.getStats(), i18n.lang);
}

function showPracticeResult() {
  if (playMode !== "practice" || !practiceSession || practiceResultShown) return;
  practiceResultShown = true;
  const stats = practiceSession.getStats();
  const label = i18n.lang === "en" ? "Score" : "总分";
  judgeHud?.showTotal(stats.score, 100, label, stats);
  if (els.status) els.status.textContent = i18n.t("status.practiceDone");
}

async function handlePracticeHit(midi, velocity = 96) {
  if (playMode !== "practice" || scheduler.getTransport() !== "playing") return;

  try {
    await controller.ensureAudioReady();
  } catch {
    return;
  }

  const active = fallingNotes?.findNearestBlock();
  if (!active || !practiceSession) {
    judgeHud?.flash(JUDGE.MISS);
    engine.noteOn(midi, velocity);
    return;
  }

  const { block, topY, lineY, size } = active;
  if (block.judged) return;

  const result = practiceSession.judgeHit(topY, lineY, size);
  block.judged = true;
  fallingNotes.markJudged(block);
  judgeHud?.flash(result.judge);
  updatePracticeHud();
  engine.noteOn(midi, velocity);
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
  if (els.btnDemoTwinkle) els.btnDemoTwinkle.disabled = !idle;
  if (els.btnDemoBirthday) els.btnDemoBirthday.disabled = !idle;
  if (els.btnDemoTwoTigers) els.btnDemoTwoTigers.disabled = !idle;
  if (els.btnPlayMode) els.btnPlayMode.disabled = !idle;

  els.btnRecord?.classList.toggle("active", transport === "recording");

  if (!els.status) return;
  if (transport === "recording") els.status.textContent = i18n.t("status.recording");
  else if (transport === "playing") {
    els.status.textContent =
      playMode === "practice" ? i18n.t("status.practicePlaying") : i18n.t("status.playing");
  } else if (scoreLoadedHint) {
    els.status.textContent =
      playMode === "practice" ? i18n.t("status.scorePractice") : i18n.t("status.scoreLoaded");
  } else els.status.textContent = engine.isLoaded() ? i18n.t("status.ready") : i18n.t("status.loadingSamples");
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
  resetPracticeSession();
  refreshUI();
}

async function loadDemoScore(filename) {
  try {
    const url = new URL(`scores/${filename}`, window.location.href).href;
    const res = await fetch(`${url}?v=${encodeURIComponent(APP_VERSION)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    await loadScoreText(await res.text());
  } catch {
    alert(i18n.t("score.error.load_failed"));
  }
}

async function loadScoreText(text) {
  const result = parseScoreToProject(text, APP_VERSION);
  if (!result.ok) {
    alert(scoreErrorMessage(result.error, i18n.t.bind(i18n)));
    return;
  }
  importScoreProject(result.project);
}

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

function onBlockMiss() {
  if (!practiceSession) return;
  practiceSession.recordMiss();
  judgeHud?.flash(JUDGE.MISS);
  updatePracticeHud();
}

function startFallingNotes(events, startAt, practice) {
  fallingNotes?.setMode(practice ? "practice" : "enjoy");
  fallingNotes?.start(events, startAt, {
    mode: practice ? "practice" : "enjoy",
    onBlockMiss: practice ? onBlockMiss : null,
  });
  if (practice) updatePracticeHud();
}

function onEnjoyCenterHit(midi, velocity) {
  engine.noteOn(midi, velocity ?? 96);
  keyboard?.pressVisual(midi);
  window.setTimeout(() => keyboard?.releaseVisual(midi), 100);
}

function onPlaybackFinished() {
  showPracticeResult();
  refreshUI();
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
    resetPracticeSession();
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
      resetPracticeSession();
      refreshUI();
    } catch (e) {
      alert(String(e.message || e));
    }
  });

  bindPress(els.btnSave, () => {
    downloadProject(eventStore.getProject());
  });

  bindPress(els.btnPlayMode, () => {
    playMode = playMode === "practice" ? "enjoy" : "practice";
    fallingNotes?.setMode(playMode);
    syncPlayModeButton();
    refreshUI();
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

  bindPress(els.btnDemoTwinkle, () => loadDemoScore("twinkle.json"));
  bindPress(els.btnDemoBirthday, () => loadDemoScore("happy-birthday.json"));
  bindPress(els.btnDemoTwoTigers, () => loadDemoScore("two-tigers.json"));

  bindPress(els.btnRecord, async () => {
    await controller.ensureAudioReady();
    eventStore.reset(eventStore.getTitle());
    scoreLoadedHint = false;
    resetPracticeSession();
    controller.startRecording();
  });

  bindPress(els.btnStopRec, () => {
    keyboard?.releaseAll();
    controller.stopRecording();
  });

  bindPress(els.btnPlay, async () => {
    fallingNotes?.stop();
    keyboard?.releaseAll();
    judgeHud?.clear();
    await controller.ensureAudioReady();
    resetPracticeSession();
    const practice = playMode === "practice";
    controller.startPlayback(playbackVisualHooks, { practice });
    refreshUI();
  });

  bindPress(els.btnStopPlay, () => {
    controller.stopPlayback();
  });

  initFullscreen();
  syncPlayModeButton();
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
  onPlaybackStart: (events, startAt, meta) => {
    practiceResultShown = false;
    startFallingNotes(events, startAt, meta?.practice === true);
  },
  onPlaybackStop: () => {
    showPracticeResult();
    fallingNotes?.stop();
    keyboard?.releaseAllVisual();
  },
  onNoteOff: (midi) => keyboard?.releaseVisual(midi),
};

try {
  if (keyboard && els.fallNotesStage) {
    fallingNotes = createFallingNotesLane(keyboard, els.fallNotesStage, {
      onCenterHit: onEnjoyCenterHit,
      onPlaybackComplete: onPlaybackFinished,
    });
    judgeHud = createJudgeHud(els.fallNotesStage);
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
