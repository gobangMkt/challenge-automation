function normKey(raw) {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits;
}

export function buildMatrix(participants = [], submissions = [], totalWeeks = 0) {
  const weeks = Math.max(0, Number(totalWeeks) || 0);

  const submitted = new Map();
  for (const s of submissions || []) {
    const key = normKey(s && s.phone);
    if (!key) continue;
    const wk = Number(s && s.회차);
    if (!Number.isInteger(wk) || wk < 1 || wk > weeks) continue;
    if (!submitted.has(key)) submitted.set(key, new Set());
    submitted.get(key).add(wk);
  }

  const weekTotals = new Array(weeks).fill(0);
  const rows = (participants || []).map((p) => {
    const key = normKey(p && p.phone);
    const set = submitted.get(key) || new Set();
    const cells = [];
    let count = 0;
    for (let w = 1; w <= weeks; w++) {
      const has = set.has(w);
      cells.push(has);
      if (has) { weekTotals[w - 1] += 1; count += 1; }
    }
    return {
      phone: (p && p.phone) || '',
      name: (p && p.name) || '',
      cells,
      submitted: count,
      done: weeks > 0 && count === weeks,
    };
  });

  const doneCount = rows.filter((r) => r.done).length;
  const completionRate = rows.length ? doneCount / rows.length : 0;

  return { rows, weekTotals, completionRate };
}
