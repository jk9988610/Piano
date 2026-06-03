/** Recording clock + playback scheduler */

export function createScheduler(engine, eventStore) {
  let transport = "idle";
  let recordStartPerf = 0;
  let playbackEndTimer = null;
  let onPlaybackEnd = null;

  function clearPlaybackTimers() {
    if (playbackEndTimer) {
      clearTimeout(playbackEndTimer);
      playbackEndTimer = null;
    }
  }

  function nowRecordingMs() {
    return Math.max(0, Math.round(performance.now() - recordStartPerf));
  }

  return {
    getTransport() {
      return transport;
    },

    startRecording() {
      if (transport !== "idle") return false;
      transport = "recording";
      recordStartPerf = performance.now();
      return true;
    },

    stopRecording() {
      if (transport !== "recording") return 0;
      const endMs = nowRecordingMs();
      eventStore.finalizeOpenNotes(endMs);
      transport = "idle";
      return endMs;
    },

    recordingNowMs() {
      return transport === "recording" ? nowRecordingMs() : 0;
    },

    async startPlayback(onEnd) {
      if (transport !== "idle") return false;
      await engine.unlock();
      transport = "playing";
      onPlaybackEnd = onEnd;
      clearPlaybackTimers();

      const events = eventStore.getProject().session.events;
      const durationMs = eventStore.getDurationMs();
      if (!events.length) {
        transport = "idle";
        onEnd?.();
        return true;
      }

      const baseAudio = Tone.now() + 0.08;
      events.forEach((ev) => {
        const offMs = ev.offMs ?? ev.onMs + 80;
        engine.noteOn(ev.midi, ev.velocity, baseAudio + ev.onMs / 1000);
        engine.noteOff(ev.midi, baseAudio + offMs / 1000);
      });

      playbackEndTimer = setTimeout(() => {
        if (transport !== "playing") return;
        engine.stopAll();
        transport = "idle";
        onPlaybackEnd?.();
        onPlaybackEnd = null;
      }, durationMs + 120);

      return true;
    },

    stopPlayback() {
      if (transport !== "playing") return;
      clearPlaybackTimers();
      engine.stopAll();
      transport = "idle";
      onPlaybackEnd?.();
      onPlaybackEnd = null;
    },
  };
}

export function formatTimeMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
