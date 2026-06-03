/** Piano sampler engine — INS-008 Salamander, noteOn / noteOff */

const PIANO_URLS = {
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

function midiToNote(midi) {
  return Tone.Frequency(midi, "midi").toNote();
}

let sampler = null;
let loadPromise = null;
const activeNotes = new Map();

export function createEngine() {
  return {
    async ensureLoaded(onProgress) {
      if (sampler) return sampler;
      if (loadPromise) return loadPromise;
      onProgress?.("loading");
      loadPromise = new Promise((resolve, reject) => {
        const s = new Tone.Sampler({
          urls: PIANO_URLS,
          baseUrl: "samples/INS-008/",
          onload: () => {
            sampler = s;
            onProgress?.("ready");
            resolve(s);
          },
          onerror: (err) => reject(err || new Error("Sampler load failed")),
        });
        const mudCut = new Tone.Filter(140, "highpass", -12);
        const bright = new Tone.EQ3({
          low: -3.5,
          mid: 1,
          high: 5,
          lowFrequency: 200,
          highFrequency: 3600,
        });
        const gain = new Tone.Volume(5);
        s.connect(mudCut);
        mudCut.connect(bright);
        bright.connect(gain);
        gain.toDestination();
      });
      return loadPromise;
    },

    async unlock() {
      await Tone.start();
      await this.ensureLoaded();
    },

    noteOn(midi, velocity = 96, atTime = null) {
      if (!sampler) return;
      const t = atTime ?? Tone.now();
      const vel = Math.min(1, (velocity / 127) * 1.02);
      const note = midiToNote(midi);
      if (activeNotes.has(midi)) {
        sampler.triggerRelease(note, t);
      }
      sampler.triggerAttack(note, t, vel);
      activeNotes.set(midi, note);
    },

    noteOff(midi, atTime = null) {
      if (!sampler) return;
      const t = atTime ?? Tone.now();
      const note = activeNotes.get(midi);
      if (!note) return;
      sampler.triggerRelease(note, t);
      activeNotes.delete(midi);
    },

    stopAll(atTime = null) {
      if (!sampler) return;
      const t = atTime ?? Tone.now();
      activeNotes.forEach((note) => sampler.triggerRelease(note, t));
      activeNotes.clear();
    },

    isLoaded() {
      return !!sampler;
    },
  };
}
