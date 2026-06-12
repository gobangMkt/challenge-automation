const DECISIONS = ['selected', 'rejected'];

export function validateSelection(input = {}, ctx = {}) {
  const errors = {};
  const phones = Array.isArray(input.phones) ? input.phones : [];
  if (!phones.length) errors.phones = '대상 신청자를 선택하세요.';
  if (!DECISIONS.includes(input.decision)) errors.decision = '선발/탈락 결정이 올바르지 않습니다.';
  if (ctx.afterAnnounce === true) errors.announce = '발표일이 지나 선발을 변경할 수 없습니다.';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function applySelection(rows, phones, decision) {
  const target = new Set((phones || []).map(String));
  let changed = 0;
  const next = (rows || []).map((r) => {
    if (target.has(String(r.phone)) && r.status !== decision) {
      changed += 1;
      return { ...r, status: decision };
    }
    return { ...r };
  });
  return { rows: next, changed };
}

export function countByStatus(rows = []) {
  const c = { applied: 0, selected: 0, rejected: 0 };
  for (const r of rows) {
    const s = r && r.status ? String(r.status) : 'applied';
    if (c[s] != null) c[s] += 1;
    else c.applied += 1;
  }
  return c;
}
