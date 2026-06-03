import { createScheduler } from "./piano-scheduler.js";

export function createController({ engine, eventStore, scheduler, onChange }) {
  const heldKeys = new Set();
  let midiAccess = null;

  function emit() {
    onChange?.();
  }

  function canPlayLive() {
    const t = scheduler.getTransport();
    return t === "idle" || t === "recording";
  }

  async function handleNote(midi, velocity, isOn) {
    if (!canPlayLive()) {
      if (isOn && scheduler.getTransport() === "playing") {
        await engine.unlock();
        if (isOn) {
          engine.noteOn(midi, velocity);
          heldKeys.add(midi);
        }
      }
      return;
    }

    await engine.unlock();

    if (isOn) {
      engine.noteOn(midi, velocity);
      heldKeys.add(midi);
      if (scheduler.getTransport() === "recording") {
        eventStore.noteOn(midi, scheduler.recordingNowMs(), velocity);
      }
    } else {
      engine.noteOff(midi);
      heldKeys.delete(midi);
      if (scheduler.getTransport() === "recording") {
        eventStore.noteOff(midi, scheduler.recordingNowMs());
      }
    }
    emit();
  }

  async function initMidi() {
    if (!navigator.requestMIDIAccess) return;
    try {
      midiAccess = await navigator.requestMIDIAccess();
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

    startPlayback() {
      heldKeys.forEach((m) => engine.noteOff(m));
      heldKeys.clear();
      return scheduler.startPlayback(() => emit());
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

export function createSchedulerPair(engine, eventStore) {
  return createScheduler(engine, eventStore);
}
