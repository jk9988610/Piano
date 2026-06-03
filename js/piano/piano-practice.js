/** Practice mode scoring — 100 pts split across notes */

export const JUDGE = {
  PERFECT: "perfect",
  GOOD: "good",
  MISS: "miss",
};

export function createPracticeSession(noteCount) {
  const count = Math.max(1, noteCount);
  const pointsPerNote = 100 / count;
  let score = 0;
  let judgedCount = 0;
  const results = [];

  function addResult(judge, points) {
    judgedCount += 1;
    score += points;
    results.push({ judge, points });
    return { judge, points, score, judgedCount, total: count };
  }

  /** topY = block top edge; lineY = judgment line; size = block height */
  function judgeByPosition(topY, lineY, size) {
    const bottom = topY + size;

    if (topY <= lineY && bottom >= lineY) {
      return { judge: JUDGE.PERFECT, points: pointsPerNote };
    }

    const half = size / 2;
    const goodEarlyLo = lineY - size - half;
    const goodLateHi = lineY + half;

    if (topY >= goodEarlyLo && bottom < lineY) {
      return { judge: JUDGE.GOOD, points: pointsPerNote / 2 };
    }
    if (topY > lineY && topY <= goodLateHi) {
      return { judge: JUDGE.GOOD, points: pointsPerNote / 2 };
    }

    return { judge: JUDGE.MISS, points: 0 };
  }

  function getStats() {
    let perfect = 0;
    let good = 0;
    let miss = 0;
    for (const r of results) {
      if (r.judge === JUDGE.PERFECT) perfect += 1;
      else if (r.judge === JUDGE.GOOD) good += 1;
      else miss += 1;
    }
    return {
      score: Math.round(score * 10) / 10,
      judgedCount,
      total: count,
      perfect,
      good,
      miss,
    };
  }

  return {
    getScore() {
      return score;
    },

    getTotalNotes() {
      return count;
    },

    isComplete() {
      return judgedCount >= count;
    },

    judgeHit(topY, lineY, size) {
      const { judge, points } = judgeByPosition(topY, lineY, size);
      return addResult(judge, points);
    },

    recordMiss() {
      return addResult(JUDGE.MISS, 0);
    },

    getSummary() {
      return { ...getStats(), notes: count, results };
    },

    getStats,
  };
}

export function createJudgeHud(stageEl) {
  const noop = {
    flash() {},
    showTotal() {},
    updateRunning() {},
    clear() {},
    destroy() {},
  };
  if (!stageEl) return noop;

  const scoreBar = document.createElement("div");
  scoreBar.className = "practice-score-bar";
  scoreBar.setAttribute("aria-live", "polite");

  const hud = document.createElement("div");
  hud.className = "practice-judge-hud";
  hud.setAttribute("aria-live", "polite");

  stageEl.prepend(hud);
  stageEl.prepend(scoreBar);

  let hideTimer = 0;

  function show(text, kind) {
    window.clearTimeout(hideTimer);
    hud.textContent = text;
    hud.className = `practice-judge-hud practice-judge-hud--${kind} practice-judge-hud--show`;
    hideTimer = window.setTimeout(() => {
      hud.classList.remove("practice-judge-hud--show");
    }, 900);
  }

  function formatRunning(stats, lang) {
    const label = lang === "en" ? "Score" : "得分";
    return `${label} ${stats.score} / 100 · ${stats.judgedCount}/${stats.total} · P${stats.perfect} G${stats.good} M${stats.miss}`;
  }

  return {
    flash(judge) {
      if (judge === JUDGE.PERFECT) show("Perfect !!!", "perfect");
      else if (judge === JUDGE.GOOD) show("Good !!", "good");
      else show("Miss !", "miss");
    },

    updateRunning(stats, lang = "zh") {
      if (!stats) return;
      scoreBar.textContent = formatRunning(stats, lang);
      scoreBar.classList.add("practice-score-bar--show");
    },

    showTotal(score, max = 100, label = "总分", stats = null) {
      window.clearTimeout(hideTimer);
      const rounded = Math.round(score * 10) / 10;
      let text = `${label} ${rounded} / ${max}`;
      if (stats) {
        text += ` · Perfect ${stats.perfect} · Good ${stats.good} · Miss ${stats.miss}`;
      }
      hud.textContent = text;
      hud.className = "practice-judge-hud practice-judge-hud--total practice-judge-hud--show";
      if (stats) {
        scoreBar.textContent = formatRunning(stats, label === "Score" ? "en" : "zh");
        scoreBar.classList.add("practice-score-bar--show");
      }
    },

    clear() {
      window.clearTimeout(hideTimer);
      hud.classList.remove("practice-judge-hud--show");
      hud.textContent = "";
      scoreBar.classList.remove("practice-score-bar--show");
      scoreBar.textContent = "";
    },

    destroy() {
      window.clearTimeout(hideTimer);
      hud.remove();
      scoreBar.remove();
    },
  };
}
