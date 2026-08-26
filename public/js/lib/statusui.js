// 상태 → 화면 표현 매핑 (순수, 의존성은 status.js 하나).
// WHY: status.js는 '무슨 상태인가'만 답한다. '어떤 클래스·라벨·전이 버튼을 내보이나'가
// admin.js 곳곳에 삼항연산자로 흩어져 있었고(모집중 하드코딩·주차 배지 의미 역전) 그래서 갈라졌다.
// 색 이름은 여기서도 정하지 않는다 — 상태명 클래스만 주고 상태→색은 CSS가 소유한다.

import { normalizeStatus, tabNotice } from './status.js';

const BADGE_CLASS = {
  준비: 'badge--ready',
  모집중: 'badge--recruiting',
  운영중: 'badge--running',
  완료: 'badge--done',
};

export function statusBadgeClass(status) {
  return BADGE_CLASS[normalizeStatus(status)];
}

// 홈 카드 진행 라벨 — 제출이 시작되기 전 자리에 들어간다.
const PHASE_LABEL = {
  준비: '준비 단계',
  모집중: '모집 단계',
  운영중: '운영 단계',
  완료: '완료',
};

export function campaignPhaseLabel(status) {
  return PHASE_LABEL[normalizeStatus(status)];
}

// 회차 상태(WeekMissions '상태') — 배지와 회차 칩이 같은 클래스를 쓴다.
// 아무 일도 일어나지 않은 '대기'가 가장 약한 표현이어야 한다(색 강도는 CSS 소유).
const WEEK_STATE = {
  오픈: { cls: 's-open', label: '오픈' },
  마감: { cls: 's-done', label: '종료' },
  종료: { cls: 's-done', label: '종료' },
  대기: { cls: 's-wait', label: '대기' },
};

export function weekState(raw) {
  const key = String(raw == null ? '' : raw).trim();
  const hit = Object.prototype.hasOwnProperty.call(WEEK_STATE, key) ? WEEK_STATE[key] : WEEK_STATE['대기'];
  return { cls: hit.cls, label: hit.label };
}

// status.js의 NOTICE_TABS는 도메인 키('ops'), 허브 라우트는 'operate'다.
const ROUTE_KEY = { manage: 'manage', ops: 'operate', reward: 'reward' };

export function noticeRouteTabs(status) {
  return tabNotice(status).tabs.map((t) => ROUTE_KEY[t] || t);
}

// stagebox가 내보일 전이. 전진 1개(주) + 되돌리기 1개(보조)를 넘지 않는다.
// 노출하는 전이는 전부 canTransition을 통과해야 한다(tests/statusui.test.js가 감시).
const START = {
  label: '모집 시작하기', to: '모집중', danger: false,
  confirmTitle: '모집을 시작할까요?',
  confirmMessage: '참가자에게 신청 페이지가 즉시 공개됩니다.\n준비 탭에 입력한 내용이 그대로 공개돼요.',
  confirmLabel: '모집 시작',
};
const CLOSE = {
  label: '챌린지 종료하기', to: '완료', danger: true,
  confirmTitle: '챌린지를 종료할까요?',
  confirmMessage: '신청·주차 제출 페이지가 모두 “종료되었습니다” 안내로 바뀝니다.\n리워드 신청 폼은 계속 열려 있습니다.',
  confirmLabel: '종료',
};
const BACK_TO_READY = {
  label: '준비로 되돌리기', to: '준비', danger: false,
  confirmTitle: '준비 상태로 되돌릴까요?',
  confirmMessage: '참가자에게 신청 페이지가 보이지 않게 됩니다.\n이미 접수된 신청·제출 기록은 그대로 남습니다.',
  confirmLabel: '되돌리기',
};
const RESUME = {
  label: '챌린지 재개하기', to: '모집중', danger: false, needsDueDate: true,
  confirmTitle: '챌린지를 재개할까요?',
  confirmMessage: '신청·주차 제출 페이지가 다시 열리고, 마지막 회차 마감일이 입력한 날짜로 연장됩니다.',
  confirmLabel: '재개',
};

const STAGE = {
  준비: {
    desc: '지금은 참가자에게 신청 페이지가 보이지 않습니다. 모집을 시작하면 즉시 공개됩니다.',
    primary: START, secondary: null,
  },
  모집중: {
    desc: '신청 페이지가 공개 중입니다. 모집 마감일이 지나면 자동으로 운영중이 됩니다.',
    primary: CLOSE, secondary: BACK_TO_READY,
  },
  운영중: {
    desc: '주차 미션을 운영 중입니다. 마지막 회차 마감일이 지나면 자동으로 완료됩니다.',
    primary: CLOSE, secondary: BACK_TO_READY,
  },
  완료: {
    desc: '신청·주차 제출이 마감 상태입니다. 리워드 신청(마무리 폼)은 계속 열려 있어요.',
    primary: null, secondary: RESUME,
  },
};

export function stageActions(status) {
  return STAGE[normalizeStatus(status)];
}

// 재개가 실제로 먹었는지. setCampaignStatus 응답의 status(저장값) ≠ effectiveStatus(파생값)는
// 그 자체로 실패가 아니다 — 모집중을 저장해도 모집마감이 지났으면 운영중으로 파생되는 게 정상이다.
// 실패는 '파생 상태가 원래 자리(from)에서 못 벗어났다'는 뜻이고, 원인은 마감일 미연장뿐이다.
export function stageTransitionFailed(action, res) {
  if (!action || !action.needsDueDate || !res) return false;
  return normalizeStatus(res.effectiveStatus) === normalizeStatus(res.from);
}


// ---------- 모집마감 미입력 함정 ----------
// WHY: 모집마감이 비면 deriveStatus가 영원히 '모집중'을 돌려주고(파생 전이의 유일한 기준이다)
// 자동화 진입조건 '운영중'에 절대 닿지 않는다. 파생 규칙 자체의 성질이라 판정 로직으로는 못 고친다.
// 그래서 입력 단계에서 막고(validateCampaignForm), 이미 저장된 것은 허브에서 알린다(recruitEndNotice).
// 서버는 일부러 느슨하게 둔다 — 모집마감 없는 레거시 행의 저장까지 막으면 수정 자체가 불가능해진다.

function trimmed(v) {
  return String(v == null ? '' : v).trim();
}

function recruitEndOf(c) {
  return trimmed(c && (c['모집마감'] || c.recruitEnd));
}

export function validateCampaignForm(input) {
  const src = input || {};
  const errors = {};
  if (!trimmed(src.name)) errors.name = '캠페인명을 입력하세요.';
  if (!recruitEndOf(src)) errors['모집마감'] = '모집 마감일을 입력하세요.';
  return { ok: Object.keys(errors).length === 0, errors };
}

const RECRUIT_END_TAIL =
  '모집 마감일이 지나야 운영중으로 넘어가 회차 자동 오픈·알림톡이 시작됩니다.';

export function recruitEndNotice(campaigns) {
  const list = Array.isArray(campaigns) ? campaigns : [];
  const missing = list.filter((c) => c && normalizeStatus(c.status) !== '완료' && !recruitEndOf(c));
  if (!missing.length) return { show: false, ids: [], goId: '', message: '' };

  const names = missing.map((c) => `'${trimmed(c.name) || trimmed(c.challengeId)}'`).join(' · ');
  const head = missing.length === 1
    ? `${names} 캠페인에 모집 마감일이 없습니다.`
    : `모집 마감일이 비어 있는 캠페인이 ${missing.length}개 있습니다 — ${names}.`;
  const tail = missing.length === 1 ? RECRUIT_END_TAIL : `${RECRUIT_END_TAIL} 각 캠페인의 '수정'에서 채워주세요.`;
  return {
    show: true,
    ids: missing.map((c) => String(c.challengeId)),
    goId: missing.length === 1 ? String(missing[0].challengeId) : '',
    message: `${head} ${tail}`,
  };
}
