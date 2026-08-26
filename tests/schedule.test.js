import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDailyRun, weekWindow, operationEndDate } from '../public/js/lib/schedule.js';

// 시작일 2026-01-27(화). 오픈요일=화, 마감요일=월(=오픈+6일). 총회차 10.
// 모집마감 2026-01-20 → 시작일 시점엔 이미 지나 파생 상태가 운영중이다.
const baseChallenge = {
  status: '모집중',
  모집마감: '2026-01-20',
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

test('시작 전(오픈일 이전)에는 openWeek 없음', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '대기' }), '2026-01-26');
  assert.equal(r.openWeek, null);
});

test('총회차를 넘는 회차는 열지 않는다', () => {
  // 11주차 오픈일(2026-04-07)인데 totalWeeks=10. 운영종료일을 연장해 운영중은 유지시킨다.
  const c = { ...baseChallenge, totalWeeks: 10 };
  const ms = [{ week: 10, status: '마감', dueDate: '2026-05-01' }];
  assert.equal(operationEndDate(c, ms), '2026-05-01');
  const r = planDailyRun(c, ms, '2026-04-07');
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
  const r = planDailyRun(baseChallenge, missions({ 1: '오픈', 2: '대기' }), '2026-02-03');
  assert.equal(r.openWeek, 2);
  assert.equal(r.closeWeek, 1);
});

test('마감요일 대신 마감오프셋(일수)로도 계산 가능', () => {
  const c = { ...baseChallenge, closeDow: '', closeOffset: 6 };
  const w = weekWindow(c, 1);
  assert.equal(w.close, '2026-02-02');
});

// ---------- 진입조건: 파생 상태 운영중만 ----------

test('진입조건은 저장값이 아니라 파생 상태다 — 모집마감 경과 = 운영중', () => {
  const r = planDailyRun(baseChallenge, missions({ 1: '대기' }), '2026-01-27');
  assert.equal(r.openWeek, 1);
});

test('모집 기간 중(모집마감 이전)에는 회차 자동화 안 함', () => {
  const c = { ...baseChallenge, 모집마감: '2026-02-28' };
  const r = planDailyRun(c, missions({ 1: '대기' }), '2026-01-27');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('준비 상태 캠페인은 아무 일도 안 한다', () => {
  const c = { ...baseChallenge, status: '준비' };
  const r = planDailyRun(c, missions({ 1: '대기' }), '2026-01-27');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('완료(수동 종료) 캠페인은 아무 일도 안 한다 — 알림톡 발송 금지', () => {
  const c = { ...baseChallenge, status: '완료' };
  const r = planDailyRun(c, missions({ 1: '오픈' }), '2026-02-02');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('운영종료일이 지난 과거 캠페인은 아무 일도 안 한다 — 미마감 회차가 남아 있어도', () => {
  // 운영종료일 2026-04-06. 그 다음날 이후로는 파생 완료.
  const r = planDailyRun(baseChallenge, missions({ 10: '오픈' }), '2026-04-07');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('레거시 저장값 종료는 완료로 해석되어 자동화 제외', () => {
  const c = { ...baseChallenge, status: '종료' };
  const r = planDailyRun(c, missions({ 1: '대기' }), '2026-01-27');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

test('레거시 저장값 진행중은 모집중으로 해석 — 모집마감 경과 시 운영중', () => {
  const c = { ...baseChallenge, status: '진행중' };
  assert.equal(planDailyRun(c, missions({ 1: '대기' }), '2026-01-27').openWeek, 1);
  const before = { ...c, 모집마감: '2026-02-28' };
  assert.equal(planDailyRun(before, missions({ 1: '대기' }), '2026-01-27').openWeek, null);
});

test('모집마감 미설정이면 운영중으로 승격되지 않는다(자동화 대상 아님)', () => {
  const c = { ...baseChallenge, 모집마감: '' };
  const r = planDailyRun(c, missions({ 1: '대기' }), '2026-01-27');
  assert.deepEqual(r, { openWeek: null, remindWeek: null, closeWeek: null });
});

// ---------- 운영종료일 ----------

test('operationEndDate: 마감일 미기입이면 일정상 마지막 회차 마감일', () => {
  assert.equal(operationEndDate(baseChallenge, missions({ 1: '오픈' })), '2026-04-06');
});

test('operationEndDate: 시트 마감일이 더 늦으면(운영자 연장) 그 값을 쓴다', () => {
  const ms = [{ week: 10, status: '대기', dueDate: '2026-05-20' }];
  assert.equal(operationEndDate(baseChallenge, ms), '2026-05-20');
});

test('operationEndDate: 시트 마감일이 이르면 일정값이 이긴다', () => {
  // 회차가 열릴 때마다 마감일이 채워지는 구조라, 시트값만 믿으면 1회차 마감 다음날
  // 운영종료일=1회차 마감이 되어 파생 완료로 자동화가 멈춘다(회귀 방지).
  const ms = [{ week: 1, status: '오픈', dueDate: '2026-02-02' }];
  assert.equal(operationEndDate(baseChallenge, ms), '2026-04-06');
  const r = planDailyRun(baseChallenge, ms, '2026-02-03');
  assert.equal(r.closeWeek, 1);
});

test('operationEndDate: 시작일이 없으면 빈 문자열(판정 불가)', () => {
  assert.equal(operationEndDate({ totalWeeks: 10 }, []), '');
});
