import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrix } from '../public/js/lib/matrix.js';

const P = (phone, name) => ({ phone, name });
const S = (phone, week) => ({ phone, 회차: week });

test('참가자별 회차 제출 셀을 bool로 채운다', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방'), P('010-2222-2222', '박개방')],
    [S('010-1111-1111', 1), S('010-1111-1111', 2), S('010-2222-2222', 1)],
    3,
  );
  assert.equal(m.rows.length, 2);
  assert.deepEqual(m.rows[0].cells, [true, true, false]);
  assert.deepEqual(m.rows[1].cells, [true, false, false]);
});

test('done = 전 회차 제출 여부', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방'), P('010-2222-2222', '박개방')],
    [S('010-1111-1111', 1), S('010-1111-1111', 2), S('010-2222-2222', 1)],
    2,
  );
  assert.equal(m.rows[0].done, true);
  assert.equal(m.rows[1].done, false);
});

test('weekTotals = 회차별 제출 인원 합계', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방'), P('010-2222-2222', '박개방')],
    [S('010-1111-1111', 1), S('010-2222-2222', 1), S('010-1111-1111', 2)],
    3,
  );
  assert.deepEqual(m.weekTotals, [2, 1, 0]);
});

test('completionRate = 완주자 비율(0~1)', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방'), P('010-2222-2222', '박개방')],
    [S('010-1111-1111', 1), S('010-1111-1111', 2), S('010-2222-2222', 1)],
    2,
  );
  assert.equal(m.completionRate, 0.5);
});

test('참가자 0명이면 rows 비고 completionRate=0', () => {
  const m = buildMatrix([], [], 3);
  assert.deepEqual(m.rows, []);
  assert.deepEqual(m.weekTotals, [0, 0, 0]);
  assert.equal(m.completionRate, 0);
});

test('회차 범위 밖/중복 제출은 무시하고 중복은 1회로 센다', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방')],
    [S('010-1111-1111', 1), S('010-1111-1111', 1), S('010-1111-1111', 5), S('010-1111-1111', 0)],
    3,
  );
  assert.deepEqual(m.rows[0].cells, [true, false, false]);
  assert.deepEqual(m.weekTotals, [1, 0, 0]);
});

test('휴대폰은 정규화하여 매칭(하이픈/공백 차이 무시)', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방')],
    [{ phone: '01011111111', 회차: 1 }, { phone: '010 1111 1111', 회차: 2 }],
    2,
  );
  assert.deepEqual(m.rows[0].cells, [true, true]);
});

test('submissions의 회차가 문자열이어도 처리한다', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방')],
    [{ phone: '010-1111-1111', 회차: '2' }],
    2,
  );
  assert.deepEqual(m.rows[0].cells, [false, true]);
});

test('done 카운트(submitted) 제공', () => {
  const m = buildMatrix(
    [P('010-1111-1111', '김고방')],
    [S('010-1111-1111', 1), S('010-1111-1111', 3)],
    3,
  );
  assert.equal(m.rows[0].submitted, 2);
});
