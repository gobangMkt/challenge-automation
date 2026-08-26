// 챌린지 상태 판정 순수로직 (의존성 0, GAS Status.gs와 미러)
// WHY: 상태값이 spec/Setup.gs/AdminHub.gs 3곳으로 갈라져 자동화가 조용히 멈췄다.
// 판정 규칙을 여기 한 곳에 모으고, 시트 접근·Date.now는 호출부가 책임진다.

export const STATUS = {
  READY: '준비',
  RECRUITING: '모집중',
  RUNNING: '운영중',
  DONE: '완료',
};

export const STATUS_VALUES = ['준비', '모집중', '운영중', '완료'];

// 시트에 저장되는 값. 운영중은 저장하지 않고 날짜로 파생한다.
export const STORED_STATUS_VALUES = ['준비', '모집중', '완료'];

// 준비 단계에서 안내 배너를 띄울 탭(잠금 아님 — 미리 설정은 가능하다).
export const NOTICE_TABS = ['manage', 'ops', 'reward'];

const NOTICE_MESSAGE = '아직 준비가 완료되지 않았습니다. 미리 설정해 두실 수 있지만 참가자에게는 공개되지 않습니다.';

const LEGACY = {
  '': '준비',
  대기: '준비',
  준비: '준비',
  모집중: '모집중',
  선발중: '모집중',
  진행중: '모집중',
  운영중: '운영중',
  완료: '완료',
  종료: '완료',
};

export function normalizeStatus(raw) {
  const key = String(raw == null ? '' : raw).trim();
  return isKnownStatus(key) ? LEGACY[key] : '준비';
}

// 레거시 별칭까지 포함해 '해석 가능한 상태 문자열'인지. 빈값은 준비로 해석되므로 참.
export function isKnownStatus(raw) {
  const key = String(raw == null ? '' : raw).trim();
  return Object.prototype.hasOwnProperty.call(LEGACY, key);
}

// KST(+09:00) 고정 오프셋이 이 프로젝트의 날짜 정본.
// WHY: Automation.gs의 ymd_는 UTC 기준이라 KST 00:00~09:00에 하루 전으로 밀리고,
// fmtDate_(스크립트 타임존)는 GAS에선 맞지만 node 테스트/CI 타임존에 따라 흔들린다.
// 고정 오프셋은 두 런타임에서 같은 답을 준다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ISO_ZONED = /^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/;

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function ymdFromInstant(ms) {
  const k = new Date(ms + KST_OFFSET_MS);
  return k.getUTCFullYear() + '-' + pad2(k.getUTCMonth() + 1) + '-' + pad2(k.getUTCDate());
}

// 날짜 입력을 'YYYY-MM-DD'(KST)로 정규화. 판정 불가면 빈 문자열.
export function toYmd(value) {
  if (value instanceof Date) {
    const t = value.getTime();
    return isNaN(t) ? '' : ymdFromInstant(t);
  }
  const s = String(value == null ? '' : value).trim();
  if (ISO_ZONED.test(s)) {
    const t = new Date(s).getTime();
    return isNaN(t) ? '' : ymdFromInstant(t);
  }
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

function pick(obj, a, b) {
  if (!obj) return '';
  const v = obj[a];
  if (v != null && v !== '') return v;
  const w = obj[b];
  return w != null && w !== '' ? w : '';
}

// 운영종료일 = 회차 마감일 중 최대값. 회차 미설정이면 빈 문자열.
export function lastDueDate(missions) {
  const list = Array.isArray(missions) ? missions : [];
  let max = '';
  for (let i = 0; i < list.length; i += 1) {
    const d = toYmd(pick(list[i], 'dueDate', '마감일'));
    if (d && d > max) max = d;
  }
  return max;
}

// 저장값 + 모집마감 + 마지막 회차 마감일 → 실효 상태.
// 날짜는 'YYYY-MM-DD' 문자열이라 사전순 비교 = 시간순 비교.
export function deriveStatus(challenge, todayYmd) {
  const stored = normalizeStatus(challenge && challenge.status);
  if (stored === '준비' || stored === '완료') return stored;

  const today = toYmd(todayYmd);
  if (!today) return stored;

  const due = toYmd(pick(challenge, 'lastDueDate', '마지막회차마감일'));
  if (due && today > due) return '완료';
  if (stored === '운영중') return '운영중';

  const recruitEnd = toYmd(pick(challenge, '모집마감', 'recruitEnd'));
  if (recruitEnd && today > recruitEnd) return '운영중';
  return '모집중';
}

// 수동 전이 허용 여부. 막는 것은 세 가지뿐 —
// (1) 목적지 운영중: 파생값이라 저장할 수 없다(저장하면 파생 규칙과 어긋난다)
// (2) 같은 상태로의 전이: 무의미
// (3) 운영중→모집중: 저장값이 이미 모집중이라 눌러도 화면이 그대로인 무효과 전이
// 그 밖의 역방향·조기종료(모집중→준비, 완료→모집중 등)는 모두 허용한다.
export function canTransition(from, to) {
  if (!isKnownStatus(from) || !isKnownStatus(to)) return false;

  const cur = normalizeStatus(from);
  const next = normalizeStatus(to);
  if (STORED_STATUS_VALUES.indexOf(next) === -1) return false;
  if (cur === next) return false;
  if (cur === '운영중' && next === '모집중') return false;
  return true;
}

// 잠금이 아니라 안내다. 모든 탭은 준비 단계에서도 열려 있다.
export function tabNotice(status) {
  const show = normalizeStatus(status) === '준비';
  return {
    show,
    tabs: show ? NOTICE_TABS.slice() : [],
    message: show ? NOTICE_MESSAGE : '',
  };
}

export function isRecruiting(status) {
  return normalizeStatus(status) === '모집중';
}
