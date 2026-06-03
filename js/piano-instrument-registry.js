/**
 * INS-008 piano preset — migrated from Card-World HarmonyForge
 * `embedded/harmonyforge/js/instrument-registry.js`
 *
 * Sampler: offline Salamander Grand Piano multisamples (Tone.js audio repo).
 * NOT synthesis — no FM / synth fallback in Piano Studio.
 */
export const PIANO_INSTRUMENT_ID = "INS-008";

/** Same PIANO_URLS map as Card-World instrument-registry.js */
export const PIANO_URLS = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

/**
 * Resolve sample base URL (works on GitHub Pages subpaths e.g. /Piano/).
 */
export function pianoSampleBaseUrl() {
  return new URL("samples/INS-008/", window.location.href).href;
}

/** Card-World INS-008 preset (sampler only). */
export function getPianoPreset() {
  return {
    id: PIANO_INSTRUMENT_ID,
    kind: "sampler",
    type: "melodic",
    toneClass: "Sampler",
    trigger: "sampler_melodic",
    postChain: "piano_eq",
    sampler: {
      baseUrl: pianoSampleBaseUrl(),
      urls: PIANO_URLS,
    },
    duration: { melodicMin: 0.2, preview: 0.5 },
    synthesis:
      "Sampler: offline Salamander piano multisamples in samples/INS-008/ (from Card-World HarmonyForge).",
  };
}

/** Live / preview velocity scale — matches Card-World instrument-engine INS-008 branch. */
export function pianoLiveVelocity(normalizedVel) {
  return Math.min(1, normalizedVel * 1.02);
}

/** Step / default playback velocity — matches Card-World audio-engine playVelocityFor(INS-008). */
export const PIANO_DEFAULT_VELOCITY = 0.95;
