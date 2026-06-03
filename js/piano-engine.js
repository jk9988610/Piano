/**
 * Piano engine facade — INS-008 Salamander sampler only (from Card-World HarmonyForge).
 */
import {
  getPianoPreset,
  pianoLiveVelocity,
  PIANO_DEFAULT_VELOCITY,
} from "./piano-instrument-registry.js";
import { createPianoInstrument, midiToNote } from "./piano-instrument-engine.js";

let instrument = null;
let loadPromise = null;
const activeNotes = new Map();

export function createEngine() {
  return {
    async ensureLoaded(onProgress) {
      if (instrument) return instrument;
      if (loadPromise) return loadPromise;
      onProgress?.("loading");

      loadPromise = (async () => {
        const preset = getPianoPreset();
        instrument = await createPianoInstrument(preset);
        onProgress?.("ready");
        return instrument;
      })().catch((err) => {
        loadPromise = null;
        throw err;
      });

      return loadPromise;
    },

    async unlock() {
      await Tone.start();
      await this.ensureLoaded();
    },

    noteOn(midi, velocity = Math.round(PIANO_DEFAULT_VELOCITY * 127), atTime = null) {
      if (!instrument?.synth) return;
      const t = atTime ?? Tone.now();
      const vel = pianoLiveVelocity(velocity / 127);
      const note = midiToNote(midi);
      if (activeNotes.has(midi)) {
        instrument.synth.triggerRelease(note, t);
      }
      instrument.synth.triggerAttack(note, t, vel);
      activeNotes.set(midi, note);
    },

    noteOff(midi, atTime = null) {
      if (!instrument?.synth) return;
      const t = atTime ?? Tone.now();
      const note = activeNotes.get(midi);
      if (!note) return;
      instrument.synth.triggerRelease(note, t);
      activeNotes.delete(midi);
    },

    stopAll(atTime = null) {
      if (!instrument?.synth) return;
      const t = atTime ?? Tone.now();
      activeNotes.forEach((note) => instrument.synth.triggerRelease(note, t));
      activeNotes.clear();
    },

    isLoaded() {
      return !!instrument;
    },

    getKind() {
      return instrument?.kind ?? "none";
    },
  };
}
