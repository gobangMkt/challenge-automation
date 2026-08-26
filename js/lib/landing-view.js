// 참가자 랜딩의 상태 게이팅 (의존성 0)
// WHY: 판정은 status.js 하나가 정본이다. 여기서는 '어떤 화면을 그릴지'만 고르고
// 상태 문자열 해석은 전부 normalizeStatus에 위임한다(레거시 '종료'·빈값 포함).

import { normalizeStatus, isRecruiting, toYmd, STATUS } from './status.js';

export const VIEW = {
  PREPARING: 'preparing',
  LANDING: 'landing',
  SUBMIT: 'submit',
  WRAPUP: 'wrapup',
  WRAPUP_LOCKED: 'wrapupLocked',
  CLOSED: 'closed',
};

export function normalizeHash(hash) {
  return String(hash == null ? '' : hash).trim().replace(/^#\/?/, '');
}

// 신청폼 노출 = 모집중에만.
export function canApply(status) {
  return isRecruiting(status);
}

// 주차 제출 = 운영중에만. 모집중에는 아직 열린 회차가 없다.
export function canSubmitWeek(status) {
  return normalizeStatus(status) === STATUS.RUNNING;
}

// 마무리(리워드) 신청 = 완료에만.
export function canWrapup(status) {
  return normalizeStatus(status) === STATUS.DONE;
}

// 준비 화면에 띄울 모집 예정일. 아직 오지 않은 날짜만 돌려준다.
// WHY: 준비는 수동 상태라 모집시작일이 지나도 준비로 남을 수 있고,
// 그때 지난 날짜를 "언제부터 열립니다"로 안내하면 참가자에게 거짓말이 된다.
export function upcomingOpenDate(recruitStart, todayYmd) {
  const start = toYmd(recruitStart);
  const today = toYmd(todayYmd);
  if (!start || !today) return '';
  return start > today ? start : '';
}

export function landingView(status, hash) {
  const st = normalizeStatus(status);
  const h = normalizeHash(hash);

  if (st === STATUS.READY) return VIEW.PREPARING;
  if (h === 'wrapup') return canWrapup(st) ? VIEW.WRAPUP : VIEW.WRAPUP_LOCKED;
  if (st === STATUS.DONE) return VIEW.CLOSED;
  if (h === 'submit') return VIEW.SUBMIT;
  return VIEW.LANDING;
}
