import { renderKeyboard, highlightKeys } from "../piano-keyboard.js";
import { createEngine } from "../piano-engine.js";
import { createEmptyProject, createEventStore } from "./piano-event-store.js";
import { downloadProject, parseProject, readFileAsText, errorMessage } from "./piano-project-io.js";
import { createScheduler, formatTimeMs } from "./piano-scheduler.js";
import { createController } from "./piano-controller.js";
import { createI18n, resolveLang } from "./piano-i18n.js";

const APP_VERSION = document.querySelector('meta[name="piano-app-version"]')?.content || "0.1.0";

const els = {
  status: document.getElementById("statusText"),
  time: document.getElementById("timeDisplay"),
  loadHint: document.getElementById("loadHint"),
  keyboardHost: document.getElementById("keyboardHost"),
  fileInput: document.getElementById("fileInput"),
  btnNew: document.getElementById("btnNew"),
  btnOpen: document.getElementById("btnOpen"),
  btnSave: document.getElementById("btnSave"),
  btnRecord: document.getElementById("btnRecord"),
  btnStopRec: document.getElementById("btnStopRec"),
  btnPlay: document.getElementById("btnPlay"),
  btnStopPlay: document.getElementById("btnStopPlay"),
};

const i18n = createI18n(resolveLang());
i18n.apply();

const engine = createEngine();
const eventStore = createEventStore(createEmptyProject("新演奏", APP_VERSION));
const scheduler = createScheduler(engine, eventStore);
const controller = createController({ engine, eventStore, scheduler, onChange: refreshUI });

function refreshUI() {
  const transport = scheduler.getTransport();
  const dur = eventStore.getDurationMs();
  let pos = 0;
  if (transport === "recording") pos = scheduler.recordingNowMs();
  else if (transport === "playing") {
    /* position tracked visually via duration only in P0 */
  }
  els.time.textContent = `${formatTimeMs(pos)} / ${formatTimeMs(dur)}`;

  els.btnRecord.disabled = transport !== "idle";
  els.btnStopRec.disabled = transport !== "recording";
  els.btnPlay.disabled = transport !== "idle" || dur === 0;
  els.btnStopPlay.disabled = transport !== "playing";

  els.btnRecord.classList.toggle("active", transport === "recording");

  if (transport === "recording") els.status.textContent = i18n.t("status.recording");
  else if (transport === "playing") els.status.textContent = i18n.t("status.playing");
  else els.status.textContent = engine.isLoaded() ? i18n.t("status.ready") : i18n.t("status.loading");

  highlightKeys(els.keyboardHost, controller.getHeldKeys());
}

function noteLabel(midi) {
  return Tone.Frequency(midi, "midi").toNote();
}

renderKeyboard(els.keyboardHost, {
  onNoteDown: (midi, vel) => controller.handleNote(midi, vel, true),
  onNoteUp: (midi) => controller.handleNote(midi, 64, false),
  labelFor: noteLabel,
});

els.btnNew.addEventListener("click", () => {
  if (!confirm(i18n.t("confirm.new"))) return;
  scheduler.stopPlayback();
  eventStore.reset();
  refreshUI();
});

els.btnOpen.addEventListener("click", () => els.fileInput.click());

els.fileInput.addEventListener("change", async () => {
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
    scheduler.stopPlayback();
    eventStore.setProject(result.project);
    refreshUI();
  } catch (e) {
    alert(String(e.message || e));
  }
});

els.btnSave.addEventListener("click", () => {
  downloadProject(eventStore.getProject());
});

els.btnRecord.addEventListener("click", async () => {
  await engine.unlock();
  eventStore.reset(eventStore.getTitle());
  controller.startRecording();
});

els.btnStopRec.addEventListener("click", () => controller.stopRecording());

els.btnPlay.addEventListener("click", async () => {
  await engine.unlock();
  controller.startPlayback();
  refreshUI();
});

els.btnStopPlay.addEventListener("click", () => controller.stopPlayback());

document.body.addEventListener(
  "pointerdown",
  () => {
    engine.unlock().catch(() => {});
  },
  { once: false }
);

els.loadHint.hidden = false;
engine
  .ensureLoaded((state) => {
    if (state === "ready") els.loadHint.hidden = true;
  })
  .then(() => {
    controller.initMidi();
    refreshUI();
  })
  .catch((err) => {
    els.loadHint.textContent = String(err.message || err);
    console.error(err);
  });

setInterval(() => {
  if (scheduler.getTransport() === "recording") refreshUI();
}, 100);

refreshUI();
