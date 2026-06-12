export function upsertParticipant(rows, participant) {
  const idx = rows.findIndex((r) => r.phone === participant.phone);
  if (idx === -1) return [...rows, participant];
  const next = rows.slice();
  next[idx] = { ...rows[idx], ...participant };
  return next;
}

export function normalizePhone(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!/^010\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function validateApplication(input = {}, ctx = {}) {
  const errors = {};
  if (!input.name || !String(input.name).trim()) errors.name = '성함을 입력하세요.';
  if (!input.phone || !String(input.phone).trim()) errors.phone = '휴대폰 번호를 입력하세요.';
  else if (!normalizePhone(input.phone)) errors.phone = '올바른 휴대폰 번호(010-0000-0000)를 입력하세요.';
  if (!input.blogUrl || !String(input.blogUrl).trim()) errors.blogUrl = '블로그 URL을 입력하세요.';
  else if (!/^https?:\/\/.+/.test(String(input.blogUrl).trim()))
    errors.blogUrl = 'http(s)로 시작하는 블로그 URL을 입력하세요.';
  if (!input.agree) errors.agree = '개인정보 수집·이용에 동의해 주세요.';
  if (ctx.recruiting === false) errors.recruiting = '모집 기간이 아닙니다.';
  return { ok: Object.keys(errors).length === 0, errors };
}
