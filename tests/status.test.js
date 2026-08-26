import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS,
  STATUS_VALUES,
  STORED_STATUS_VALUES,
  normalizeStatus,
  toYmd,
  lastDueDate,
  deriveStatus,
  canTransition,
  tabNotice,
  isRecruiting,
} from '../public/js/lib/status.js';

// ---------- 상수 ----------

test('상태는 4종, 저장되는 값은 3종(운영중은 파생)', () => {
  assert.deepEqual(STATUS_VALUES, ['준비', '모집중', '운영중', '완료']);
  assert.deepEqual(STORED_STATUS_VALUES, ['준비', '모집중', '완료']);
  assert.equal(STATUS.RUNNING, '운영중');
});

// ---------- normalizeStatus ----------

test('normalizeStatus: 빈값·null·공백은 준비', () => {
  assert.equal(normalizeStatus(''), '준비');
  assert.equal(normalizeStatus(null), '준비');
  assert.equal(normalizeStatus(undefined), '준비');
  assert.equal(normalizeStatus('   '), '준비');
});

test('normalizeStatus: 레거시 선발중·진행중은 모집중', () => {
  assert.equal(normalizeStatus('선발중'), '모집중');
  assert.equal(normalizeStatus('진행중'), '모집중');
});

test('normalizeStatus: 레거시 종료는 완료', () => {
  assert.equal(normalizeStatus('종료'), '완료');
});

test('normalizeStatus: 새 값 4종은 그대로 통과', () => {
  assert.equal(normalizeStatus('준비'), '준비');
  assert.equal(normalizeStatus('모집중'), '모집중');
  assert.equal(normalizeStatus('운영중'), '운영중');
  assert.equal(normalizeStatus('완료'), '완료');
  assert.equal(normalizeStatus(' 모집중 '), '모집중');
});

test('normalizeStatus: 미지원 문자열은 준비', () => {
  assert.equal(normalizeStatus('아무거나'), '준비');
  assert.equal(normalizeStatus('대기'), '준비');
  assert.equal(normalizeStatus(123), '준비');
});

// ---------- toYmd (타임존 정본: KST 고정 오프셋) ----------

test('toYmd: 문자열 날짜는 앞 10자리만, Date는 KST 캘린더 날짜', () => {
  assert.equal(toYmd('2026-08-25'), '2026-08-25');
  assert.equal(toYmd('2026-08-25 14:03:09'), '2026-08-25');
  assert.equal(toYmd(''), '');
  assert.equal(toYmd(null), '');
  assert.equal(toYmd('아무거나'), '');
  assert.equal(toYmd(new Date('2026-08-25T03:00:00Z')), '2026-08-25'); // KST 12:00
});

test('toYmd: UTC 15시 이후는 KST 기준 다음 날 (실행 환경 타임존 무관)', () => {
  assert.equal(toYmd(new Date('2026-08-25T15:00:00Z')), '2026-08-26');
  assert.equal(toYmd('2026-08-25T15:00:00Z'), '2026-08-26');
  assert.equal(toYmd('2026-08-25T15:00:00+00:00'), '2026-08-26');
  assert.equal(toYmd(new Date('2026-08-25T14:59:59Z')), '2026-08-25');
});

// ---------- lastDueDate ----------

test('lastDueDate: 회차 마감일 중 최대값, 공란·미설정은 빈 문자열', () => {
  const missions = [
    { round: 1, dueDate: '2026-09-06' },
    { round: 3, dueDate: '2026-09-20' },
    { round: 2, dueDate: '2026-09-13' },
  ];
  assert.equal(lastDueDate(missions), '2026-09-20');
  assert.equal(lastDueDate([{ round: 1, dueDate: '' }]), '');
  assert.equal(lastDueDate([]), '');
  assert.equal(lastDueDate(null), '');
});

// ---------- deriveStatus ----------

const CH = (over) => Object.assign({ status: '모집중', 모집마감: '2026-08-31', lastDueDate: '2026-11-01' }, over);

test('deriveStatus: 저장 준비는 날짜 무관 항상 준비', () => {
  assert.equal(deriveStatus(CH({ status: '준비' }), '2026-08-01'), '준비');
  assert.equal(deriveStatus(CH({ status: '준비' }), '2026-09-30'), '준비'); // 모집마감 경과
  assert.equal(deriveStatus(CH({ status: '준비' }), '2026-12-31'), '준비'); // 마지막 마감 경과
  assert.equal(deriveStatus(CH({ status: '' }), '2026-12-31'), '준비');
});

test('deriveStatus: 모집중 + 오늘 <= 모집마감 → 모집중', () => {
  assert.equal(deriveStatus(CH(), '2026-08-01'), '모집중');
  assert.equal(deriveStatus(CH(), '2026-08-30'), '모집중');
});

test('deriveStatus: 모집중 + 오늘 > 모집마감 → 운영중', () => {
  assert.equal(deriveStatus(CH(), '2026-09-01'), '운영중');
  assert.equal(deriveStatus(CH(), '2026-10-31'), '운영중');
});

test('deriveStatus: 모집마감 당일 경계는 모집중(마감일 포함)', () => {
  assert.equal(deriveStatus(CH(), '2026-08-31'), '모집중');
});

test('deriveStatus: 마지막 회차 마감일 경과 → 완료', () => {
  assert.equal(deriveStatus(CH(), '2026-11-02'), '완료');
  assert.equal(deriveStatus(CH({ status: '운영중' }), '2026-11-02'), '완료');
});

test('deriveStatus: 마지막 회차 마감일 당일 경계는 운영중', () => {
  assert.equal(deriveStatus(CH(), '2026-11-01'), '운영중');
});

test('deriveStatus: 저장 완료는 날짜 무관 완료', () => {
  assert.equal(deriveStatus(CH({ status: '완료' }), '2026-08-01'), '완료');
  assert.equal(deriveStatus(CH({ status: '종료' }), '2026-08-01'), '완료'); // 레거시
});

test('deriveStatus: 모집마감 공란이면 모집중 유지', () => {
  assert.equal(deriveStatus(CH({ 모집마감: '' }), '2026-10-01'), '모집중');
  assert.equal(deriveStatus(CH({ 모집마감: null }), '2026-10-01'), '모집중');
});

test('deriveStatus: 마지막 회차 마감일 공란(회차 미설정)이면 운영중 유지', () => {
  assert.equal(deriveStatus(CH({ lastDueDate: '' }), '2026-12-31'), '운영중');
  assert.equal(deriveStatus(CH({ status: '운영중', lastDueDate: '' }), '2026-12-31'), '운영중');
});

test('deriveStatus: 레거시 진행중은 모집중으로 정규화 후 파생 판정', () => {
  assert.equal(deriveStatus(CH({ status: '진행중' }), '2026-08-01'), '모집중');
  assert.equal(deriveStatus(CH({ status: '진행중' }), '2026-09-01'), '운영중');
  assert.equal(deriveStatus(CH({ status: '선발중' }), '2026-11-02'), '완료');
});

test('deriveStatus: 날짜가 문자열이든 Date 객체든 동일 판정', () => {
  const asText = CH();
  const asDate = CH({ 모집마감: new Date('2026-08-31T03:00:00Z'), lastDueDate: new Date('2026-11-01T03:00:00Z') });
  const days = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-11-01', '2026-11-02'];
  days.forEach((d) => {
    assert.equal(deriveStatus(asDate, d), deriveStatus(asText, d), d);
    assert.equal(deriveStatus(asDate, new Date(`${d}T03:00:00Z`)), deriveStatus(asText, d), d);
  });
});

test('deriveStatus: 타임존 — UTC 15시는 KST 다음 날로 판정한다', () => {
  // 2026-08-31T15:00:00Z = KST 2026-09-01 00:00 → 모집마감(08-31) 경과 → 운영중
  assert.equal(deriveStatus(CH(), new Date('2026-08-31T15:00:00Z')), '운영중');
  assert.equal(deriveStatus(CH(), new Date('2026-08-31T14:59:59Z')), '모집중');
  assert.equal(deriveStatus(CH(), '2026-08-31T15:00:00Z'), '운영중');
});

test('deriveStatus: 오늘이 없거나 챌린지가 없으면 저장값(정규화)만 반환', () => {
  assert.equal(deriveStatus(CH(), ''), '모집중');
  assert.equal(deriveStatus(CH({ status: '진행중' }), null), '모집중');
  assert.equal(deriveStatus(null, '2026-09-01'), '준비');
});

test('deriveStatus: 필드명은 모집마감/recruitEnd, lastDueDate/마지막회차마감일 둘 다 받는다', () => {
  const en = { status: '모집중', recruitEnd: '2026-08-31', 마지막회차마감일: '2026-11-01' };
  assert.equal(deriveStatus(en, '2026-08-31'), '모집중');
  assert.equal(deriveStatus(en, '2026-09-01'), '운영중');
  assert.equal(deriveStatus(en, '2026-11-02'), '완료');
});

// ---------- canTransition ----------

test('canTransition: 준비→모집중은 허용, 준비→운영중은 불가(파생값)', () => {
  assert.equal(canTransition('준비', '모집중'), true);
  assert.equal(canTransition('준비', '운영중'), false);
});

test('canTransition: 운영중은 어떤 전이의 목적지도 될 수 없다', () => {
  assert.equal(canTransition('모집중', '운영중'), false);
  assert.equal(canTransition('완료', '운영중'), false);
  assert.equal(canTransition('운영중', '운영중'), false);
});

test('canTransition: 역방향·조기종료 등 저장 3종으로의 수동 override는 허용', () => {
  assert.equal(canTransition('모집중', '준비'), true);
  assert.equal(canTransition('모집중', '완료'), true);
  assert.equal(canTransition('운영중', '완료'), true);
  assert.equal(canTransition('운영중', '준비'), true);
  assert.equal(canTransition('완료', '모집중'), true);
  assert.equal(canTransition('완료', '준비'), true);
  assert.equal(canTransition('준비', '완료'), true);
});

test('canTransition: 같은 상태로의 전이와 실효 변화 없는 전이는 막는다', () => {
  assert.equal(canTransition('준비', '준비'), false);
  assert.equal(canTransition('모집중', '모집중'), false);
  assert.equal(canTransition('완료', '완료'), false);
  assert.equal(canTransition('운영중', '모집중'), false); // 저장값이 이미 모집중 — 무효과
});

test('canTransition: 알 수 없는 값은 거부, 레거시 값은 정규화 후 판정', () => {
  assert.equal(canTransition('아무거나', '모집중'), false);
  assert.equal(canTransition('준비', '아무거나'), false);
  assert.equal(canTransition('', '모집중'), true); // 빈값=준비
  assert.equal(canTransition('진행중', '완료'), true); // 레거시=모집중
});

// ---------- tabNotice ----------

test('tabNotice: 준비 상태에서만 안내가 필요하다', () => {
  assert.equal(tabNotice('준비').show, true);
  assert.equal(tabNotice('').show, true);
  assert.equal(tabNotice('모집중').show, false);
  assert.equal(tabNotice('운영중').show, false);
  assert.equal(tabNotice('완료').show, false);
});

test('tabNotice: 안내 대상 탭과 문구를 함께 준다(잠금 아님)', () => {
  const n = tabNotice('준비');
  assert.deepEqual(n.tabs, ['manage', 'ops', 'reward']);
  assert.ok(n.message.length > 0);
  assert.equal(tabNotice('모집중').tabs.length, 0);
  assert.equal(tabNotice('모집중').message, '');
});

// ---------- isRecruiting ----------

test('isRecruiting: 모집중만 true', () => {
  assert.equal(isRecruiting('모집중'), true);
  assert.equal(isRecruiting('준비'), false);
  assert.equal(isRecruiting('운영중'), false);
  assert.equal(isRecruiting('완료'), false);
  assert.equal(isRecruiting(''), false);
});

test('isRecruiting: 레거시 값도 정규화해서 판정', () => {
  assert.equal(isRecruiting('진행중'), true);
  assert.equal(isRecruiting('선발중'), true);
  assert.equal(isRecruiting('종료'), false);
});
