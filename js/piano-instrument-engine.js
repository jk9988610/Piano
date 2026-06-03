/**
 * Piano sampler engine — migrated from Card-World HarmonyForge
 * `embedded/harmonyforge/js/instrument-engine.js` (sampler + piano_eq path only).
 *
 * Uses Tone.Sampler with bundled Salamander MP3s. No synth fallback.
 */

const loadCache = new Map();

function midiToNote(midi) {
  return Tone.Frequency(midi, "midi").toNote();
}

function createSamplerAsync(preset) {
  const { urls, baseUrl = "" } = preset.sampler || {};
  if (!urls || !Object.keys(urls).length) {
    return Promise.reject(new Error("Piano sampler preset has no urls"));
  }
  const cacheKey = `${preset.id}::${baseUrl}`;
  if (loadCache.has(cacheKey)) return loadCache.get(cacheKey);

  const promise = new Promise((resolve, reject) => {
    const sampler = new Tone.Sampler({
      urls,
      baseUrl,
      onload: () => resolve(sampler),
      onerror: (err) => reject(err || new Error("Salamander sampler load failed")),
    });
  });
  loadCache.set(cacheKey, promise);
  return promise;
}

/** piano_eq post-chain — same as Card-World InstrumentEngine.connect for postChain piano_eq */
export function connectPianoEqChain(synth, destination = Tone.getDestination()) {
  const mudCut = new Tone.Filter(140, "highpass", -12);
  const bright = new Tone.EQ3({
    low: -3.5,
    mid: 1,
    high: 5,
    lowFrequency: 200,
    highFrequency: 3600,
  });
  const gain = new Tone.Volume(5);
  synth.connect(mudCut);
  mudCut.connect(bright);
  bright.connect(gain);
  gain.connect(destination);
  return [mudCut, bright, gain];
}

/**
 * Load INS-008 Salamander sampler and connect piano EQ chain.
 * @param {object} preset from getPianoPreset()
 */
export async function createPianoInstrument(preset) {
  const synth = await createSamplerAsync(preset);
  const chain = connectPianoEqChain(synth);
  return { preset, synth, kind: "sampler", chain };
}

export { midiToNote, createSamplerAsync };
