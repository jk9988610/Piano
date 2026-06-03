import { validateProject } from "./piano-event-store.js";

export function serializeProject(project) {
  return JSON.stringify(project, null, 2);
}

export function parseProject(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const v = validateProject(data);
  if (!v.ok) return v;
  data.session.events.sort((a, b) => a.onMs - b.onMs || a.midi - b.midi);
  return { ok: true, project: data };
}

export function downloadProject(project) {
  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  const name = `${sanitizeFilename(project.meta.title || "演奏")}.hfproj`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function sanitizeFilename(s) {
  return s.replace(/[^\w\u4e00-\u9fff\- ]+/g, "_").trim() || "演奏";
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function errorMessage(code, t) {
  const map = {
    invalid_json: t("error.invalid_json"),
    legacy_rhythm: t("error.legacy_rhythm"),
    bad_schema: t("error.bad_schema"),
    bad_session: t("error.bad_session"),
    too_many_events: t("error.too_many_events"),
  };
  return map[code] || t("error.unknown");
}
