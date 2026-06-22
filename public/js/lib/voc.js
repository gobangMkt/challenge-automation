// VoC 순수 로직 (프론트·GAS 공용). 사이드이펙트 없음 — node --test 대상.
// GAS는 ES import 불가라 src/gas/Voc.gs 에 동일 로직을 미러한다.

export function validateVoc(input) {
  input = input || {};
  const errors = {};
  if (!input.project || !String(input.project).trim()) errors.project = 'project 필요';
  if (!input.message || !String(input.message).trim()) errors.message = '내용을 입력하세요.';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function dedupKey(rec) {
  return `${rec.project}::${String(rec.message).trim().toLowerCase()}`;
}

export function buildVocRecord(input, now) {
  const ts = new Date(now).toISOString();
  const message = String(input.message).trim();
  const id = `voc_${now}_${Math.abs(hash_(dedupKey({ project: input.project, message })))}`;
  return {
    id, ts,
    project: input.project,
    channel: input.channel || 'app',
    phone: input.phone || '',
    message,
    status: 'new', assignee: '', resolution: '', commit: '',
  };
}

function hash_(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}
