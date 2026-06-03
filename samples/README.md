# Offline piano samples (INS-008)

Piano Studio uses the **same bundled sampler** as [Card-World HarmonyForge](https://github.com/jk9988610/Card-World) `embedded/harmonyforge/samples/INS-008/`.

| ID | Role | Source |
|----|------|--------|
| INS-008 | Piano multisample | [Salamander Grand Piano](https://github.com/Tonejs/audio/tree/master/salamander) (Tone.js offline audio) |

- **Engine**: `Tone.Sampler` — not FM / not synthesized piano.
- **Files**: 30 MP3 multisamples (A0–C8 sparse map, same filenames as Card-World).
- **Signal chain**: `piano_eq` post-chain (high-pass + EQ3 + gain), migrated from HarmonyForge `instrument-engine.js`.

Paths are relative to `index.html` (e.g. `samples/INS-008/C4.mp3`).
