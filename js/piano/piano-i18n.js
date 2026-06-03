const STRINGS = {
  "zh-Hans": {
    "app.title": "钢琴工作室",
    "file.new": "新建",
    "file.open": "打开",
    "file.save": "保存",
    "status.ready": "就绪",
    "status.loading": "加载中…",
    "status.recording": "录制中",
    "status.playing": "播放中",
    "transport.record": "● 录制",
    "transport.stop": "■ 停止",
    "transport.play": "▶ 播放",
    "transport.stopPlay": "⏹ 停止播放",
    "fullscreen.enter": "全屏",
    "fullscreen.exit": "退出全屏",
    "confirm.new": "新建将清空当前演奏，是否继续？",
    "error.invalid_json": "文件不是有效的 JSON。",
    "error.legacy_rhythm": "这是节奏编曲工程。请新建钢琴会话。",
    "error.bad_schema": "不是 piano-v1 钢琴会话文件。",
    "error.bad_session": "会话数据损坏。",
    "error.too_many_events": "事件数量超过上限（10000）。",
    "error.unknown": "无法打开此文件。",
  },
  en: {
    "app.title": "Piano Studio",
    "file.new": "New",
    "file.open": "Open",
    "file.save": "Save",
    "status.ready": "Ready",
    "status.loading": "Loading…",
    "status.recording": "Recording",
    "status.playing": "Playing",
    "transport.record": "● Record",
    "transport.stop": "■ Stop",
    "transport.play": "▶ Play",
    "transport.stopPlay": "⏹ Stop",
    "fullscreen.enter": "Fullscreen",
    "fullscreen.exit": "Exit fullscreen",
    "confirm.new": "Create a new session? Current performance will be cleared.",
    "error.invalid_json": "Invalid JSON file.",
    "error.legacy_rhythm": "This is a rhythm/step project. Please create a new piano session.",
    "error.bad_schema": "Not a piano-v1 session file.",
    "error.bad_session": "Corrupted session data.",
    "error.too_many_events": "Too many events (max 10000).",
    "error.unknown": "Cannot open this file.",
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
