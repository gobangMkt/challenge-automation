/* 운영 허브 내보내기용 CSV 조립 (순수 로직 — DOM·네트워크 없음) */

export function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// 엑셀은 CRLF를 안전하게 읽는다
export function buildCsv(columns = [], rows = []) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(c.value(r))).join(','));
  return lines.join('\r\n');
}

// 하이픈을 넣어야 엑셀이 텍스트로 읽고 앞자리 0이 살아남는다
export function formatPhone(raw) {
  const s = String(raw == null ? '' : raw).trim();
  const d = s.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith('02') ? `02-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return s;
}

export function selectionLabel(status) {
  const s = String(status == null ? '' : status).trim();
  if (s === 'selected' || s === '선발') return '선발';
  if (s === 'rejected' || s === '탈락') return '탈락';
  return '미정';
}

export function csvFileName(campaignName, kind, date) {
  const name = String(campaignName == null ? '' : campaignName).trim().replace(/[\/:*?"<>|]/g, '_') || 'challenge';
  const d = new Date(date);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${name}_${kind}_${ymd}.csv`;
}

const ROSTER_COLUMNS = [
  { header: '성함', value: (r) => r.name },
  { header: '휴대폰', value: (r) => formatPhone(r.phone) },
  { header: '블로그', value: (r) => r.blogUrl },
  { header: '선발상태', value: (r) => selectionLabel(r.status) },
];

const PAYOUT_COLUMNS = [
  { header: '성함', value: (r) => r.name },
  { header: '휴대폰', value: (r) => formatPhone(r.phone) },
  { header: '제출수', value: (r) => Number(r.count) || 0 },
  { header: '우수활동자', value: (r) => (r.excellent ? 'Y' : 'N') },
  { header: '지급액', value: (r) => Number(r.amount) || 0 },
];

export function rosterCsv(rows = []) {
  return buildCsv(ROSTER_COLUMNS, rows);
}

// 지급액 큰 순 → 리워드 탭의 금액별 그룹 순서와 같게
export function payoutCsv(people = []) {
  const sorted = people.slice().sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) || (Number(b.count) || 0) - (Number(a.count) || 0));
  return buildCsv(PAYOUT_COLUMNS, sorted);
}
