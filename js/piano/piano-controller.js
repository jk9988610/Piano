import { createScheduler } from "./piano-scheduler.js";

export function createController({ engine, eventStore, scheduler, onChange }) {
  const heldKeys = new Set();
  let audioReady = false;
  let audioReadyPromise = null;

  function emit() {
    onChange?.();
  }

  function ensureAudioReady() {
    if (audioReady) return Promise.resolve();
    if (!audioReadyPromise) {
      audioReadyPromise = engine
        .unlock()
        .then(() => {
          audioReady = true;
        })
        .catch((err) => {
          audioReadyPromise = null;
          throw err;
        });
    }
    return audioReadyPromise;
  }

  function canPlayLive() {
    const t = scheduler.getTransport();
    return t === "idle" || t === "recording";
  }

  function playNote(midi, velocity) {
    engine.noteOn(midi, velocity);
    heldKeys.add(midi);
    if (scheduler.getTransport() === "recording") {
      eventStore.noteOn(midi, scheduler.recordingNowMs(), velocity);
    }
  }

  function stopNote(midi) {
    engine.noteOff(midi);
    heldKeys.delete(midi);
    if (scheduler.getTransport() === "recording") {
      eventStore.noteOff(midi, scheduler.recordingNowMs());
    }
  }

  function handleNote(midi, velocity, isOn) {
    if (!canPlayLive()) {
      if (isOn && scheduler.getTransport() === "playing") {
        ensureAudioReady()
          .then(() => playNote(midi, velocity))
          .catch(() => {});
      }
      return;
    }

    ensureAudioReady()
      .then(() => {
        if (isOn) playNote(midi, velocity);
        else stopNote(midi);
        emit();
      })
      .catch((err) => {
        console.error("Audio not ready", err);
      });
  }

  async function initMidi() {
    if (!navigator.requestMIDIAccess) return;
    try {
      const midiAccess = await navigator.requestMIDIAccess();
      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = (msg) => {
          const [status, note, vel] = msg.data;
          const cmd = status & 0xf0;
          if (cmd === 0x90 && vel > 0) handleNote(note, vel, true);
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) handleNote(note, vel || 64, false);
        };
      });
    } catch {
      /* MIDI optional */
    }
  }

  return {
    handleNote,
    ensureAudioReady,
    initMidi,

    startRecording() {
      if (!scheduler.startRecording()) return false;
      emit();
      return true;
    },

    stopRecording() {
      scheduler.stopRecording();
      heldKeys.forEach((m) => engine.noteOff(m));
      heldKeys.clear();
      emit();
    },

    startPlayback(hooks) {
      heldKeys.forEach((m) => engine.noteOff(m));
      heldKeys.clear();
      return scheduler.startPlayback(() => emit(), hooks);
    },

    stopPlayback() {
      scheduler.stopPlayback();
      heldKeys.clear();
      emit();
    },

    getHeldKeys() {
      return heldKeys;
    },
  };
}
