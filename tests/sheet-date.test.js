import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetDateToText, dateOnlyText } from '../src/lib/sheet-date.js';

test('자정 날짜 셀은 같은 캘린더 날짜의 YYYY-MM-DD로 나온다', () => {
  assert.equal(sheetDateToText(new Date(2026, 7, 25)), '2026-08-25'); // 화요일
  assert.equal(sheetDateToText(new Date(2026, 0, 1)), '2026-01-01');
});

test('시각이 있는 셀은 날짜+시각 텍스트로 나온다', () => {
  assert.equal(sheetDateToText(new Date(2026, 7, 25, 14, 3, 9)), '2026-08-25 14:03:09');
});

test('Date가 아닌 값은 그대로 통과한다', () => {
  assert.equal(sheetDateToText('2026-08-25'), '2026-08-25');
  assert.equal(sheetDateToText(''), '');
  assert.equal(sheetDateToText(10), 10);
  assert.equal(sheetDateToText(null), null);
});

test('회귀: raw Date는 JSON 직렬화에서 하루 전으로 밀린다(UTC+ 타임존)', () => {
  const d = new Date(2026, 7, 25); // 화요일 자정
  if (d.getTimezoneOffset() >= 0) return; // UTC 이하 환경엔 해당 없음
  assert.equal(JSON.parse(JSON.stringify(d)).slice(0, 10), '2026-08-24'); // 월요일 — 버그
  assert.equal(dateOnlyText(sheetDateToText(d)), '2026-08-25'); // 정규화하면 화요일 유지
});

test('dateOnlyText는 시각을 잘라내고 멱등하다', () => {
  assert.equal(dateOnlyText(new Date(2026, 7, 25, 14, 3, 9)), '2026-08-25');
  assert.equal(dateOnlyText('2026-08-25 14:03:09'), '2026-08-25');
  assert.equal(dateOnlyText('2026-08-25'), '2026-08-25');
  assert.equal(dateOnlyText(''), '');
});
