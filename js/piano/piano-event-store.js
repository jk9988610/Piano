export const MAX_EVENTS = 10_000;
export const INSTRUMENT_ID = "INS-008";

export function createEmptyProject(title = "新演奏", appVersion = "0.1.0") {
  const now = new Date().toISOString();
  return {
    schema: "piano-v1",
    formatVersion: 1,
    meta: {
      title,
      createdAt: now,
      modifiedAt: now,
      app: "piano-studio",
      appVersion,
    },
    session: {
      instrumentId: INSTRUMENT_ID,
      durationMs: 0,
      events: [],
    },
  };
}

export function computeDurationMs(events) {
  if (!events.length) return 0;
  let max = 0;
  for (const ev of events) {
    const end = ev.offMs ?? ev.onMs;
    if (end > max) max = end;
  }
  return max;
}

export function validateProject(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "invalid_json" };
  }
  if (data.schema !== "piano-v1") {
    if (data.patterns || data.trackLayout) {
      return { ok: false, error: "legacy_rhythm" };
    }
    return { ok: false, error: "bad_schema" };
  }
  if (!data.session || !Array.isArray(data.session.events)) {
    return { ok: false, error: "bad_session" };
  }
  if (data.session.events.length > MAX_EVENTS) {
    return { ok: false, error: "too_many_events" };
  }
  for (const ev of data.session.events) {
    if (ev.type !== "note") return { ok: false, error: "bad_event_type" };
    if (ev.midi < 21 || ev.midi > 108) return { ok: false, error: "bad_midi" };
    if (ev.onMs < 0 || !Number.isInteger(ev.onMs)) return { ok: false, error: "bad_onMs" };
    if (ev.offMs != null && (ev.offMs <= ev.onMs || !Number.isInteger(ev.offMs))) {
      return { ok: false, error: "bad_offMs" };
    }
    if (ev.velocity < 1 || ev.velocity > 127) return { ok: false, error: "bad_velocity" };
  }
  return { ok: true };
}

export function createEventStore(initialProject) {
  let project = structuredClone(initialProject);
  const openNotes = new Map();

  function touchMeta() {
    project.meta.modifiedAt = new Date().toISOString();
  }

  function sortedEvents() {
    return [...project.session.events].sort((a, b) => a.onMs - b.onMs || a.midi - b.midi);
  }

  function recomputeDuration() {
    project.session.durationMs = computeDurationMs(project.session.events);
  }

  return {
    getProject() {
      return structuredClone(project);
    },

    setProject(next) {
      const v = validateProject(next);
      if (!v.ok) throw new Error(v.error);
      project = structuredClone(next);
      project.session.events = sortedEvents();
      recomputeDuration();
      openNotes.clear();
    },

    reset(title = "新演奏") {
      project = createEmptyProject(title, project.meta.appVersion);
      openNotes.clear();
    },

    noteOn(midi, onMs, velocity = 96) {
      if (project.session.events.length >= MAX_EVENTS) {
        throw new Error("too_many_events");
      }
      if (openNotes.has(midi)) {
        this.noteOff(midi, onMs);
      }
      const ev = { type: "note", midi, onMs, offMs: null, velocity };
      project.session.events.push(ev);
      openNotes.set(midi, ev);
      touchMeta();
    },

    noteOff(midi, offMs) {
      const ev = openNotes.get(midi);
      if (!ev) return;
      ev.offMs = offMs;
      openNotes.delete(midi);
      recomputeDuration();
      touchMeta();
    },

    finalizeOpenNotes(nowMs) {
      openNotes.forEach((ev, midi) => {
        ev.offMs = nowMs;
        openNotes.delete(midi);
      });
      recomputeDuration();
      touchMeta();
    },

    getDurationMs() {
      return project.session.durationMs;
    },

    getTitle() {
      return project.meta.title;
    },

    setTitle(title) {
      project.meta.title = title;
      touchMeta();
    },
  };
}
