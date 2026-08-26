import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statusBadgeClass,
  campaignPhaseLabel,
  weekState,
  noticeRouteTabs,
  stageActions,
  stageTransitionFailed,
  validateCampaignForm,
  recruitEndNotice,
} from '../public/js/lib/statusui.js';
import { canTransition, STATUS_VALUES } from '../public/js/lib/status.js';

// ---------- statusBadgeClass ----------

test('statusBadgeClass: 4상태는 색이 아니라 상태명 클래스를 준다', () => {
  assert.equal(statusBadgeClass('준비'), 'badge--ready');
  assert.equal(statusBadgeClass('모집중'), 'badge--recruiting');
  assert.equal(statusBadgeClass('운영중'), 'badge--running');
  assert.equal(statusBadgeClass('완료'), 'badge--done');
});

test('statusBadgeClass: 레거시·빈값·미지의 값도 준비로 떨어진다(폴백 하드코딩 금지)', () => {
  assert.equal(statusBadgeClass('종료'), 'badge--done');
  assert.equal(statusBadgeClass('진행중'), 'badge--recruiting');
  assert.equal(statusBadgeClass('선발중'), 'badge--recruiting');
  assert.equal(statusBadgeClass(''), 'badge--ready');
  assert.equal(statusBadgeClass(null), 'badge--ready');
  assert.equal(statusBadgeClass('아무거나'), 'badge--ready');
});

test('statusBadgeClass: 색 이름 클래스는 쓰지 않는다', () => {
  STATUS_VALUES.forEach((s) => {
    const cls = statusBadgeClass(s);
    assert.ok(!/primary|success|warning|danger/.test(cls), `${s} → ${cls}`);
  });
});

// ---------- campaignPhaseLabel ----------

test('campaignPhaseLabel: 홈 카드 진행 라벨은 실제 상태를 따른다', () => {
  assert.equal(campaignPhaseLabel('준비'), '준비 단계');
  assert.equal(campaignPhaseLabel('모집중'), '모집 단계');
  assert.equal(campaignPhaseLabel('운영중'), '운영 단계');
  assert.equal(campaignPhaseLabel('완료'), '완료');
  assert.equal(campaignPhaseLabel(''), '준비 단계');
});

// ---------- weekState (회차 상태: 배지·칩 공용) ----------

test('weekState: 마감은 종료로 표기하고 같은 클래스를 준다', () => {
  assert.deepEqual(weekState('오픈'), { cls: 's-open', label: '오픈' });
  assert.deepEqual(weekState('마감'), { cls: 's-done', label: '종료' });
  assert.deepEqual(weekState('종료'), { cls: 's-done', label: '종료' });
  assert.deepEqual(weekState('대기'), { cls: 's-wait', label: '대기' });
});

test('weekState: 빈값·미지의 값은 대기', () => {
  assert.deepEqual(weekState(''), { cls: 's-wait', label: '대기' });
  assert.deepEqual(weekState(null), { cls: 's-wait', label: '대기' });
  assert.deepEqual(weekState('아무거나'), { cls: 's-wait', label: '대기' });
});

test('weekState: 배지와 칩이 같은 클래스를 공유한다(색 체계 분기 금지)', () => {
  const seen = ['대기', '오픈', '마감'].map((s) => weekState(s).cls);
  assert.deepEqual(seen, ['s-wait', 's-open', 's-done']);
});

// ---------- noticeRouteTabs ----------

test('noticeRouteTabs: 준비 상태에서만 관리·운영·리워드 라우트 키를 준다', () => {
  assert.deepEqual(noticeRouteTabs('준비'), ['manage', 'operate', 'reward']);
  assert.deepEqual(noticeRouteTabs('모집중'), []);
  assert.deepEqual(noticeRouteTabs('운영중'), []);
  assert.deepEqual(noticeRouteTabs('완료'), []);
});

test('noticeRouteTabs: status.js의 ops 키를 허브 라우트 키 operate로 옮긴다', () => {
  assert.ok(noticeRouteTabs('준비').indexOf('ops') === -1);
  assert.ok(noticeRouteTabs('준비').indexOf('mkt') === -1);
});

// ---------- stageActions ----------

test('stageActions: 준비는 모집 시작하기 하나만, 되돌리기 없음', () => {
  const a = stageActions('준비');
  assert.equal(a.primary.label, '모집 시작하기');
  assert.equal(a.primary.to, '모집중');
  assert.equal(a.primary.danger, false);
  assert.equal(a.secondary, null);
  assert.ok(a.primary.confirmMessage.includes('참가자에게 신청 페이지가 즉시 공개됩니다'));
});

test('stageActions: 모집중·운영중은 종료(주) + 준비로 되돌리기(보조)', () => {
  ['모집중', '운영중'].forEach((s) => {
    const a = stageActions(s);
    assert.equal(a.primary.to, '완료');
    assert.equal(a.primary.danger, true);
    assert.equal(a.secondary.to, '준비');
  });
});

test('stageActions: 완료는 전진 버튼 없이 재개(보조)만, 마감일 연장을 요구한다', () => {
  const a = stageActions('완료');
  assert.equal(a.primary, null);
  assert.equal(a.secondary.to, '모집중');
  assert.equal(a.secondary.needsDueDate, true);
});

test('stageActions: 마감일 연장은 재개에서만 요구한다', () => {
  const needs = [];
  STATUS_VALUES.forEach((s) => {
    const a = stageActions(s);
    [a.primary, a.secondary].forEach((x) => { if (x && x.needsDueDate) needs.push(s + '→' + x.to); });
  });
  assert.deepEqual(needs, ['완료→모집중']);
});

test('stageActions: 노출하는 전이는 전부 canTransition을 통과한다', () => {
  STATUS_VALUES.forEach((s) => {
    const a = stageActions(s);
    [a.primary, a.secondary].forEach((x) => {
      if (!x) return;
      assert.ok(canTransition(s, x.to), `${s} → ${x.to}`);
    });
  });
});

test('stageActions: 모든 상태가 설명문과 확인창 문구를 갖는다', () => {
  STATUS_VALUES.forEach((s) => {
    const a = stageActions(s);
    assert.ok(a.desc && a.desc.length > 0, s);
    [a.primary, a.secondary].forEach((x) => {
      if (!x) return;
      assert.ok(x.label && x.confirmTitle && x.confirmMessage, `${s} ${x.to}`);
    });
  });
});

test('stageActions: 알 수 없는 값은 준비와 같게 다룬다(폴백 하드코딩 금지)', () => {
  assert.deepEqual(stageActions('아무거나'), stageActions('준비'));
  assert.deepEqual(stageActions(''), stageActions('준비'));
});

// ---------- stageTransitionFailed ----------
// 저장값과 파생값이 다른 것 자체는 정상이다(모집중 저장 → 모집마감 경과 → 운영중 파생).
// 재개 실패는 '파생 상태가 원래 자리에서 못 벗어났다'는 뜻이다.

const RESUME = stageActions('완료').secondary;
const CLOSE = stageActions('운영중').primary;
const START = stageActions('준비').primary;

test('stageTransitionFailed: 재개했는데 여전히 완료면 실패(마감일 미연장)', () => {
  assert.equal(
    stageTransitionFailed(RESUME, { from: '완료', status: '모집중', effectiveStatus: '완료' }),
    true,
  );
});

test('stageTransitionFailed: 재개 후 운영중·모집중으로 벗어났으면 성공', () => {
  assert.equal(stageTransitionFailed(RESUME, { from: '완료', status: '모집중', effectiveStatus: '운영중' }), false);
  assert.equal(stageTransitionFailed(RESUME, { from: '완료', status: '모집중', effectiveStatus: '모집중' }), false);
});

test('stageTransitionFailed: 저장값≠파생값은 그 자체로 실패가 아니다', () => {
  assert.equal(stageTransitionFailed(START, { from: '준비', status: '모집중', effectiveStatus: '운영중' }), false);
});

test('stageTransitionFailed: 마감일 연장이 필요없는 전이는 판정하지 않는다', () => {
  assert.equal(stageTransitionFailed(CLOSE, { from: '운영중', status: '완료', effectiveStatus: '완료' }), false);
  assert.equal(stageTransitionFailed(CLOSE, { from: '운영중', status: '완료', effectiveStatus: '운영중' }), false);
});

test('stageTransitionFailed: 레거시 값도 정규화해서 비교한다', () => {
  assert.equal(stageTransitionFailed(RESUME, { from: '종료', status: '모집중', effectiveStatus: '완료' }), true);
});


// ---------- validateCampaignForm ----------
// 모집마감이 비면 파생 규칙상 영원히 모집중에 머물러 자동화가 시작되지 않는다.
// 코드로는 못 고치는 성질이라 입력 단계에서 막는다.

test('validateCampaignForm: 캠페인명·모집마감이 모두 있으면 통과', () => {
  const v = validateCampaignForm({ name: '취준 블로그', 모집마감: '2026-09-01' });
  assert.equal(v.ok, true);
  assert.deepEqual(v.errors, {});
});

test('validateCampaignForm: 모집마감이 비면 실패한다', () => {
  ['', '   ', null, undefined].forEach((v) => {
    const r = validateCampaignForm({ name: '취준 블로그', 모집마감: v });
    assert.equal(r.ok, false, String(v));
    assert.equal(r.errors['모집마감'], '모집 마감일을 입력하세요.');
  });
});

test('validateCampaignForm: 캠페인명이 비면 기존 문구 그대로 실패한다', () => {
  const v = validateCampaignForm({ name: '  ', 모집마감: '2026-09-01' });
  assert.equal(v.ok, false);
  assert.equal(v.errors.name, '캠페인명을 입력하세요.');
});

test('validateCampaignForm: 둘 다 비면 둘 다 보고한다', () => {
  const v = validateCampaignForm({});
  assert.equal(v.ok, false);
  assert.deepEqual(Object.keys(v.errors).sort(), ['name', '모집마감']);
});

test('validateCampaignForm: recruitEnd 영문 키도 같은 값으로 받는다', () => {
  assert.equal(validateCampaignForm({ name: 'x', recruitEnd: '2026-09-01' }).ok, true);
});

// ---------- recruitEndNotice ----------

test('recruitEndNotice: 모집마감이 모두 채워져 있으면 배너를 띄우지 않는다', () => {
  const n = recruitEndNotice([
    { challengeId: 'a', name: 'A', status: '모집중', 모집마감: '2026-09-01' },
    { challengeId: 'b', name: 'B', status: '준비', 모집마감: '2026-10-01' },
  ]);
  assert.equal(n.show, false);
  assert.deepEqual(n.ids, []);
  assert.equal(n.message, '');
  assert.equal(n.goId, '');
});

test('recruitEndNotice: 빈 모집마감 1건이면 그 캠페인으로 갈 링크를 준다', () => {
  const n = recruitEndNotice([
    { challengeId: 'a', name: 'A', status: '모집중', 모집마감: '' },
    { challengeId: 'b', name: 'B', status: '준비', 모집마감: '2026-10-01' },
  ]);
  assert.equal(n.show, true);
  assert.deepEqual(n.ids, ['a']);
  assert.equal(n.goId, 'a');
  assert.match(n.message, /A/);
});

test('recruitEndNotice: 2건 이상이면 이름을 모두 알리되 링크는 주지 않는다', () => {
  const n = recruitEndNotice([
    { challengeId: 'a', name: 'A', status: '모집중', 모집마감: '' },
    { challengeId: 'b', name: 'B', status: '준비' },
  ]);
  assert.equal(n.show, true);
  assert.deepEqual(n.ids, ['a', 'b']);
  assert.equal(n.goId, '');
  assert.match(n.message, /A/);
  assert.match(n.message, /B/);
});

test('recruitEndNotice: 완료된 캠페인은 모집마감이 없어도 알리지 않는다', () => {
  const n = recruitEndNotice([
    { challengeId: 'a', name: 'A', status: '완료', 모집마감: '' },
    { challengeId: 'b', name: 'B', status: '종료', 모집마감: '' },
  ]);
  assert.equal(n.show, false);
});

test('recruitEndNotice: 입력이 배열이 아니어도 터지지 않는다', () => {
  [null, undefined, 0, {}].forEach((bad) => {
    assert.equal(recruitEndNotice(bad).show, false, String(bad));
  });
});

test('recruitEndNotice: 이름이 없으면 challengeId로 부른다', () => {
  const n = recruitEndNotice([{ challengeId: 'no-name', status: '준비' }]);
  assert.match(n.message, /no-name/);
});
