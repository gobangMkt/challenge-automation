import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW,
  landingView,
  canApply,
  canSubmitWeek,
  canWrapup,
  upcomingOpenDate,
} from '../public/js/lib/landing-view.js';

// ---------- 화면 선택 ----------

test('준비: 해시와 무관하게 준비 안내 화면', () => {
  assert.equal(landingView('준비', ''), VIEW.PREPARING);
  assert.equal(landingView('준비', 'submit'), VIEW.PREPARING);
  assert.equal(landingView('준비', 'wrapup'), VIEW.PREPARING);
  assert.equal(landingView('', ''), VIEW.PREPARING); // 빈값 = 준비
});

test('모집중: 기본은 랜딩, 제출 해시는 제출 화면', () => {
  assert.equal(landingView('모집중', ''), VIEW.LANDING);
  assert.equal(landingView('모집중', 'submit'), VIEW.SUBMIT);
});

test('운영중: 랜딩은 열리고 주차 제출도 열린다', () => {
  assert.equal(landingView('운영중', ''), VIEW.LANDING);
  assert.equal(landingView('운영중', 'submit'), VIEW.SUBMIT);
});

test('완료: 신청·제출 진입은 종료 안내로 흡수', () => {
  assert.equal(landingView('완료', ''), VIEW.CLOSED);
  assert.equal(landingView('완료', 'submit'), VIEW.CLOSED);
  assert.equal(landingView('완료', 'wrapup'), VIEW.WRAPUP);
});

test('레거시 종료는 완료로 해석된다', () => {
  assert.equal(landingView('종료', ''), VIEW.CLOSED);
  assert.equal(landingView('종료', 'wrapup'), VIEW.WRAPUP);
});

test('레거시 진행중·선발중은 모집중으로 해석된다', () => {
  assert.equal(landingView('진행중', ''), VIEW.LANDING);
  assert.equal(landingView('선발중', 'submit'), VIEW.SUBMIT);
});

test('마무리 폼은 완료 전에는 잠금 안내', () => {
  assert.equal(landingView('모집중', 'wrapup'), VIEW.WRAPUP_LOCKED);
  assert.equal(landingView('운영중', 'wrapup'), VIEW.WRAPUP_LOCKED);
});

test('해시는 #/ 접두·공백을 무시한다', () => {
  assert.equal(landingView('모집중', '#submit'), VIEW.SUBMIT);
  assert.equal(landingView('모집중', '#/submit'), VIEW.SUBMIT);
  assert.equal(landingView('완료', ' #wrapup '), VIEW.WRAPUP);
  assert.equal(landingView('모집중', null), VIEW.LANDING);
});

// ---------- 기능 게이트 ----------

test('신청은 모집중에만 열린다', () => {
  assert.equal(canApply('모집중'), true);
  assert.equal(canApply('준비'), false);
  assert.equal(canApply('운영중'), false);
  assert.equal(canApply('완료'), false);
});

test('주차 제출은 운영중에만 열린다', () => {
  assert.equal(canSubmitWeek('운영중'), true);
  assert.equal(canSubmitWeek('준비'), false);
  assert.equal(canSubmitWeek('모집중'), false);
  assert.equal(canSubmitWeek('완료'), false);
});

test('마무리 리워드 폼은 완료에만 열린다', () => {
  assert.equal(canWrapup('완료'), true);
  assert.equal(canWrapup('종료'), true);
  assert.equal(canWrapup('준비'), false);
  assert.equal(canWrapup('모집중'), false);
  assert.equal(canWrapup('운영중'), false);
});

// ---------- 준비 화면의 모집 예정일 ----------

test('upcomingOpenDate: 아직 오지 않은 모집시작일만 안내한다', () => {
  assert.equal(upcomingOpenDate('2026-09-01', '2026-08-25'), '2026-09-01');
});

test('upcomingOpenDate: 이미 지난 모집시작일은 안내하지 않는다', () => {
  // 준비는 수동 상태라 모집시작일이 지나도 준비일 수 있다. 과거 날짜 안내 = 오정보.
  assert.equal(upcomingOpenDate('2026-08-01', '2026-08-25'), '');
  assert.equal(upcomingOpenDate('2026-08-25', '2026-08-25'), '');
});

test('upcomingOpenDate: 날짜 없음·판독 불가는 빈 문자열', () => {
  assert.equal(upcomingOpenDate('', '2026-08-25'), '');
  assert.equal(upcomingOpenDate(null, '2026-08-25'), '');
  assert.equal(upcomingOpenDate('2026-09-01', ''), '');
});

test('upcomingOpenDate: ISO 시각 포함 값도 날짜로 비교', () => {
  assert.equal(upcomingOpenDate('2026-09-01T00:00:00+09:00', '2026-08-25'), '2026-09-01');
});
