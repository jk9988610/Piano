/**
 * JSON 乐谱 → piano-v1 events
 * 格式：schema "piano-score-v1"，bpm 仅用于节拍→毫秒换算
 */
import { createEmptyProject, computeDurationMs, MAX_EVENTS, INSTRUMENT_ID } from "./piano-event-store.js";

const SCORE_SCHEMA = "piano-score-v1";
const MIN_BPM = 20;
const MAX_BPM = 300;
const MIN_MIDI = 21;
const MAX_MIDI = 108;

function msPerBeat(bpm) {
  return 60000 / bpm;
}

function validateNote(note, index) {
  if (!note || typeof note !== "object") return { ok: false, error: "bad_note", index };
  const { midi, beat, durBeats } = note;
  if (!Number.isFinite(midi) || midi < MIN_MIDI || midi > MAX_MIDI) {
    return { ok: false, error: "bad_midi", index };
  }
  if (!Number.isFinite(beat) || beat < 0) return { ok: false, error: "bad_beat", index };
  if (!Number.isFinite(durBeats) || durBeats <= 0) return { ok: false, error: "bad_dur", index };
  return { ok: true };
}

export function scoreToEvents(score) {
  const bpm = score.bpm;
  const velocity = Number.isFinite(score.velocity) ? Math.round(score.velocity) : 96;
  const vel = Math.max(1, Math.min(127, velocity));
  const mpb = msPerBeat(bpm);

  const events = score.notes.map((n) => {
    const onMs = Math.round(n.beat * mpb);
    const offMs = Math.round((n.beat + n.durBeats) * mpb);
    return {
      type: "note",
      midi: Math.round(n.midi),
      onMs,
      offMs: Math.max(onMs + 1, offMs),
      velocity: vel,
    };
  });

  events.sort((a, b) => a.onMs - b.onMs || a.midi - b.midi);
  return events;
}

export function projectFromScore(score, appVersion = "0.3.0") {
  const events = scoreToEvents(score);
  const title = String(score.title || "乐谱").trim() || "乐谱";
  const project = createEmptyProject(title, appVersion);
  project.session.events = events;
  project.session.durationMs = computeDurationMs(events);
  return project;
}

export function parseScore(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "bad_score" };
  }

  if (data.schema !== SCORE_SCHEMA) {
    if (data.schema === "piano-v1") {
      return { ok: false, error: "is_session_file" };
    }
    return { ok: false, error: "bad_schema" };
  }

  if (!Number.isFinite(data.bpm) || data.bpm < MIN_BPM || data.bpm > MAX_BPM) {
    return { ok: false, error: "bad_bpm" };
  }

  if (!Array.isArray(data.notes) || data.notes.length === 0) {
    return { ok: false, error: "empty_notes" };
  }

  if (data.notes.length > MAX_EVENTS) {
    return { ok: false, error: "too_many_events" };
  }

  for (let i = 0; i < data.notes.length; i++) {
    const v = validateNote(data.notes[i], i);
    if (!v.ok) return v;
  }

  return { ok: true, score: data };
}

export function parseScoreToProject(text, appVersion) {
  const result = parseScore(text);
  if (!result.ok) return result;
  return { ok: true, project: projectFromScore(result.score, appVersion) };
}

export function scoreErrorMessage(code, t) {
  const map = {
    invalid_json: t("score.error.invalid_json"),
    bad_schema: t("score.error.bad_schema"),
    bad_score: t("score.error.bad_score"),
    bad_bpm: t("score.error.bad_bpm"),
    empty_notes: t("score.error.empty_notes"),
    bad_note: t("score.error.bad_note"),
    bad_midi: t("score.error.bad_midi"),
    bad_beat: t("score.error.bad_beat"),
    bad_dur: t("score.error.bad_dur"),
    is_session_file: t("score.error.is_session_file"),
    too_many_events: t("error.too_many_events"),
  };
  return map[code] || t("score.error.unknown");
}

export { SCORE_SCHEMA };
