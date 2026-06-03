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
      return { score: Math.round(score * 10) / 10, total: 100, notes: count, results };
    },
  };
}

export function createJudgeHud(stageEl) {
  if (!stageEl) return { flash() {}, showTotal() {}, clear() {}, destroy() {} };

  const hud = document.createElement("div");
  hud.className = "practice-judge-hud";
  hud.setAttribute("aria-live", "polite");
  stageEl.prepend(hud);

  let hideTimer = 0;

  function show(text, kind) {
    window.clearTimeout(hideTimer);
    hud.textContent = text;
    hud.className = `practice-judge-hud practice-judge-hud--${kind} practice-judge-hud--show`;
    hideTimer = window.setTimeout(() => {
      hud.classList.remove("practice-judge-hud--show");
    }, 900);
  }

  return {
    flash(judge) {
      if (judge === JUDGE.PERFECT) show("Perfect !!!", "perfect");
      else if (judge === JUDGE.GOOD) show("Good !!", "good");
      else show("Miss !", "miss");
    },

    showTotal(score, max = 100, label = "总分") {
      window.clearTimeout(hideTimer);
      const rounded = Math.round(score * 10) / 10;
      hud.textContent = `${label} ${rounded} / ${max}`;
      hud.className = "practice-judge-hud practice-judge-hud--total practice-judge-hud--show";
    },

    clear() {
      window.clearTimeout(hideTimer);
      hud.classList.remove("practice-judge-hud--show");
      hud.textContent = "";
    },

    destroy() {
      window.clearTimeout(hideTimer);
      hud.remove();
    },
  };
}
