import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthExpired, gateErrorMessage } from '../public/js/lib/session.js';

/* WHY: 인증 실패(forbidden)를 빈 데이터로 삼키면 "캠페인 0개"인 정상 화면으로 위장돼
   운영자가 배포 사고로 오인한다(2026-09-03 실제 발생). 판정은 순수 함수로 고정한다. */

test('저장된 토큰이 있는데 forbidden이면 세션 만료', () => {
  assert.equal(isAuthExpired({ ok: false, error: 'forbidden' }, true), true);
});

test('로그인 전(저장 토큰 없음) forbidden은 만료가 아니라 입력 실패', () => {
  assert.equal(isAuthExpired({ ok: false, error: 'forbidden' }, false), false);
});

test('네트워크 오류는 세션 만료로 보지 않는다 — 토큰을 지우면 안 된다', () => {
  assert.equal(isAuthExpired({ ok: false, netError: true }, true), false);
});

test('정상 응답·빈 응답은 만료 아님', () => {
  assert.equal(isAuthExpired({ ok: true, rows: [] }, true), false);
  assert.equal(isAuthExpired(null, true), false);
  assert.equal(isAuthExpired(undefined, true), false);
});

test('forbidden 외의 서버 오류는 만료가 아니다', () => {
  assert.equal(isAuthExpired({ ok: false, error: 'sheet not found' }, true), false);
});

test('게이트 메시지: 네트워크 오류와 토큰 오류를 구분한다', () => {
  assert.match(gateErrorMessage({ ok: false, netError: true }), /연결/);
  assert.equal(gateErrorMessage({ ok: false, error: 'forbidden' }), '토큰이 올바르지 않습니다.');
});

test('게이트 메시지: 알 수 없는 서버 오류는 원인을 그대로 보여준다', () => {
  assert.match(gateErrorMessage({ ok: false, error: 'sheet not found' }), /sheet not found/);
});
