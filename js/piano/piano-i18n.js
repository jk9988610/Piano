const STRINGS = {
  "zh-Hans": {
    "app.title": "钢琴工作室",
    "file.new": "新建",
    "file.open": "打开",
    "file.save": "保存",
    "status.ready": "就绪",
    "status.loading": "加载中…",
    "status.loadingSamples": "正在加载钢琴采样（首次较慢，之后会从缓存读取）…",
    "status.recording": "录制中",
    "status.playing": "播放中",
    "status.scoreLoaded": "乐谱已就绪 — 点「播放」，在琴键上方看粉/蓝落块",
    "transport.record": "● 录制",
    "transport.stop": "■ 停止",
    "transport.play": "▶ 播放",
    "transport.stopPlay": "⏹ 停止播放",
    "score.open": "♫ 打开乐谱",
    "score.demo": "示例：小星星",
    "fullscreen.enter": "全屏",
    "fullscreen.exit": "退出全屏",
    "fullscreen.unavailable": "此浏览器不支持全屏",
    "confirm.new": "新建将清空当前演奏，是否继续？",
    "error.invalid_json": "文件不是有效的 JSON。",
    "error.legacy_rhythm": "这是节奏编曲工程。请新建钢琴会话。",
    "error.bad_schema": "不是 piano-v1 钢琴会话文件。",
    "error.bad_session": "会话数据损坏。",
    "error.too_many_events": "事件数量超过上限（10000）。",
    "error.unknown": "无法打开此文件。",
    "score.error.invalid_json": "乐谱文件不是有效的 JSON。",
    "score.error.bad_schema": "不是 piano-score-v1 乐谱文件。",
    "score.error.bad_score": "乐谱数据无效。",
    "score.error.bad_bpm": "BPM 无效（20–300）。",
    "score.error.empty_notes": "乐谱没有音符。",
    "score.error.bad_note": "乐谱音符格式错误。",
    "score.error.bad_midi": "MIDI 音高无效（21–108）。",
    "score.error.bad_beat": "节拍位置无效。",
    "score.error.bad_dur": "音符时值无效。",
    "score.error.is_session_file": "这是演奏会话文件，请用「打开」加载。",
    "score.error.unknown": "无法打开此乐谱。",
        "score.error.load_failed": "无法加载示例乐谱。",
    "mode.enjoy": "欣赏模式",
    "mode.practice": "练习模式",
    "mode.enjoyHint": "欣赏模式：方块中心过线时自动击键",
    "mode.practiceHint": "练习模式：跟随落块手动击键并评分",
    "status.scorePractice": "乐谱已就绪 — 练习模式，点「播放」开始",
    "status.practicePlaying": "练习进行中 — 方块过线时击键",
    "status.practiceDone": "练习完成 — 查看总分",
  },
  en: {
    "app.title": "Piano Studio",
    "file.new": "New",
    "file.open": "Open",
    "file.save": "Save",
    "status.ready": "Ready",
    "status.loading": "Loading…",
    "status.loadingSamples": "Loading piano samples (first visit is slower; later visits use cache)…",
    "status.recording": "Recording",
    "status.playing": "Playing",
    "status.scoreLoaded": "Score ready — press Play to see pink/blue falling blocks",
    "transport.record": "● Record",
    "transport.stop": "■ Stop",
    "transport.play": "▶ Play",
    "transport.stopPlay": "⏹ Stop",
    "score.open": "♫ Open score",
    "score.demo": "Demo: Twinkle",
    "fullscreen.enter": "Fullscreen",
    "fullscreen.exit": "Exit fullscreen",
    "fullscreen.unavailable": "Fullscreen is not supported in this browser",
    "confirm.new": "Create a new session? Current performance will be cleared.",
    "error.invalid_json": "Invalid JSON file.",
    "error.legacy_rhythm": "This is a rhythm/step project. Please create a new piano session.",
    "error.bad_schema": "Not a piano-v1 session file.",
    "error.bad_session": "Corrupted session data.",
    "error.too_many_events": "Too many events (max 10000).",
    "error.unknown": "Cannot open this file.",
    "score.error.invalid_json": "Score file is not valid JSON.",
    "score.error.bad_schema": "Not a piano-score-v1 score file.",
    "score.error.bad_score": "Invalid score data.",
    "score.error.bad_bpm": "Invalid BPM (20–300).",
    "score.error.empty_notes": "Score has no notes.",
    "score.error.bad_note": "Invalid note in score.",
    "score.error.bad_midi": "Invalid MIDI pitch (21–108).",
    "score.error.bad_beat": "Invalid beat position.",
    "score.error.bad_dur": "Invalid note duration.",
    "score.error.is_session_file": "This is a session file — use Open instead.",
    "score.error.unknown": "Cannot open this score.",
        "score.error.load_failed": "Could not load demo score.",
    "mode.enjoy": "Enjoy mode",
    "mode.practice": "Practice mode",
    "mode.enjoyHint": "Enjoy: keys press when block center crosses the line",
    "mode.practiceHint": "Practice: play along and get Perfect/Good/Miss",
    "status.scorePractice": "Score ready — Practice mode, press Play",
    "status.practicePlaying": "Practicing — hit keys as blocks cross the line",
    "status.practiceDone": "Practice complete — see total score",
  },
};

export function resolveLang() {
  const p = new URLSearchParams(location.search);
  const q = p.get("lang");
  if (q === "en") return "en";
  if (q === "zh-Hans" || q === "zh" || q === "zh-CN") return "zh-Hans";
  return navigator.language.startsWith("zh") ? "zh-Hans" : "en";
}

export function createI18n(lang) {
  const table = STRINGS[lang] || STRINGS["zh-Hans"];
  return {
    lang,
    t(key) {
      return table[key] ?? STRINGS.en[key] ?? key;
    },
    apply(root = document) {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key) el.textContent = this.t(key);
      });
      document.documentElement.lang = lang === "en" ? "en" : "zh-Hans";
    },
  };
}
