import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDailyRun, weekWindow } from '../public/js/lib/schedule.js';

// 시작일 2026-01-27(화). 오픈요일=화, 마감요일=월(=오픈+6일). 총회차 10.
const baseChallenge = {
  status: '진행중',
  startDate: '2026-01-27',
  openDow: '화',
  closeDow: '월',
  totalWeeks: 10,
};

function missions(states) {
  // states: { 1:'대기', 2:'오픈', ... } → WeekMissions 배열
  return Object.entries(states).map(([week, status]) => ({
    week: Number(week),
    status,
  }));
}

test('weekWindow: 1회차 오픈/마감 날짜 계산(화 시작, 6일 후 월 마감)', () => {
  const w = weekWindow(baseChallenge, 1);
  assert.equal(w.open, '2026-01-27');
  assert.equal(w.close, '2026-02-02');
});

test('weekWindow: 3회차는 2주 뒤', () => {
  const w = weekWindow(baseChallenge, 3);
  assert.equal(w.open, '2026-02-10');
  assert.equal(w.close, '2026-02-16');
});

test('오픈일 당일 + 미션 대기 → openWeek', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '대기' }), '2026-01-27');
  assert.equal(r.openWeek, 1);
  assert.equal(r.remindWeek, null);
  assert.equal(r.closeWeek, null);
});

test('이미 오픈된 회차는 다시 열지 않는다', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '오픈' }), '2026-01-27');
  assert.equal(r.openWeek, null);
});

test('마감 D-1 + 오픈 상태 → remindWeek', () => {
  // 1회차 마감 2026-02-02, D-1 = 2026-02-01
  const r = planDailyRun(baseChallenge, missions({ 1: '오픈' }), '2026-02-01');
  assert.equal(r.remindWeek, 1);
  assert.equal(r.openWeek, null);
  assert.equal(r.closeWeek, null);
});

test('마감일 경과 + 오픈 상태 → closeWeek', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '오픈' }), '2026-02-02');
  assert.equal(r.closeWeek, 1);
});

test('마감 다음날도 미마감이면 closeWeek로 잡힌다', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '오픈' }), '2026-02-05');
  assert.equal(r.closeWeek, 1);
});

test('종료된 챌린지는 아무 일도 안 한다', () => {
  const c = { ...baseChallenge, status: '종료' };
  const r = planDailyRun(c, missions({ 1: '대기' }), '2026-01-27');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('모집중 챌린지는 회차 자동화 안 함', () => {
  const c = { ...baseChallenge, status: '모집중' };
  const r = planDailyRun(c, missions({ 1: '대기' }), '2026-01-27');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('시작 전(오픈일 이전)에는 openWeek 없음', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '대기' }), '2026-01-26');
  assert.equal(r.openWeek, null);
});

test('총회차를 넘는 회차는 열지 않는다', () => {
  // 11주차에 해당하는 날(2026-04-07)인데 totalWeeks=10
  const r = planDailyRun(baseChallenge, missions({}), '2026-04-07');
  assert.equal(r.openWeek, null);
});

test('마지막 회차 마감 → closeWeek=10(메인이 종료 처리)', () => {
  // 10회차 오픈 2026-03-31, 마감 2026-04-06
  const w = weekWindow(baseChallenge, 10);
  assert.equal(w.open, '2026-03-31');
  assert.equal(w.close, '2026-04-06');
  const r = planDailyRun(baseChallenge, missions({ 10: '오픈' }), '2026-04-06');
  assert.equal(r.closeWeek, 10);
});

test('한 날에 오픈과 직전 회차 마감이 겹치면 둘 다 반환', () => {
  // 2회차 오픈일 2026-02-03(화). 1회차 마감 2026-02-02(월)이므로 겹치지 않음.
  // 마감요일=일로 바꿔 1회차 마감을 2회차 오픈 전날이 아니라 같은 흐름으로 본다.
  // 여기선 단순히 오픈+이전회차 close 동시 케이스: 2회차 오픈 당일 1회차가 아직 오픈상태면 close도.
  const r = planDailyRun(baseChallenge, missions({ 1: '오픈', 2: '대기' }), '2026-02-03');
  assert.equal(r.openWeek, 2);
  assert.equal(r.closeWeek, 1);
});

test('마감요일 대신 마감오프셋(일수)로도 계산 가능', () => {
  const c = { ...baseChallenge, closeDow: '', closeOffset: 6 };
  const w = weekWindow(c, 1);
  assert.equal(w.close, '2026-02-02');
});
