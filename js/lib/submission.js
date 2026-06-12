// S4 주차 제출 순수 로직 (의존성 0, GAS Submit.gs 와 미러)

export function currentOpenWeek(weekMissions) {
  if (!Array.isArray(weekMissions)) return null;
  const open = weekMissions
    .filter((w) => w && String(w.상태) === '오픈')
    .map((w) => parseInt(w.회차, 10))
    .filter((n) => Number.isFinite(n));
  if (!open.length) return null;
  return Math.min(...open);
}

export function buildProgress(totalWeeks, submissions) {
  const subs = Array.isArray(submissions) ? submissions : [];
  const byWeek = {};
  subs.forEach((s) => {
    const n = parseInt(s && s.회차, 10);
    if (Number.isFinite(n)) byWeek[n] = true;
  });
  return { done: Object.keys(byWeek).length, total: totalWeeks, byWeek };
}

export function validatePostUrl(url) {
  if (url == null) return false;
  return /^https?:\/\/.+/.test(String(url).trim());
}
