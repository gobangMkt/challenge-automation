import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentOpenWeek, buildProgress, validatePostUrl } from '../public/js/lib/submission.js';

test('currentOpenWeek: 상태가 오픈인 회차 번호를 반환', () => {
  const weeks = [
    { 회차: 1, 상태: '마감' },
    { 회차: 2, 상태: '오픈' },
    { 회차: 3, 상태: '대기' },
  ];
  assert.equal(currentOpenWeek(weeks), 2);
});

test('currentOpenWeek: 오픈 회차가 없으면 null', () => {
  const weeks = [
    { 회차: 1, 상태: '마감' },
    { 회차: 2, 상태: '대기' },
  ];
  assert.equal(currentOpenWeek(weeks), null);
});

test('currentOpenWeek: 오픈이 여러 개면 가장 낮은 회차', () => {
  const weeks = [
    { 회차: 3, 상태: '오픈' },
    { 회차: 2, 상태: '오픈' },
  ];
  assert.equal(currentOpenWeek(weeks), 2);
});

test('currentOpenWeek: 빈 배열/누락은 null', () => {
  assert.equal(currentOpenWeek([]), null);
  assert.equal(currentOpenWeek(), null);
  assert.equal(currentOpenWeek(null), null);
});

test('buildProgress: 제출 회차를 byWeek로 매핑하고 done 집계', () => {
  const subs = [{ 회차: 1 }, { 회차: 3 }];
  const p = buildProgress(10, subs);
  assert.equal(p.total, 10);
  assert.equal(p.done, 2);
  assert.equal(p.byWeek[1], true);
  assert.equal(p.byWeek[3], true);
  assert.equal(p.byWeek[2], undefined);
});

test('buildProgress: 제출 없으면 done=0, byWeek 빈 객체', () => {
  const p = buildProgress(10, []);
  assert.equal(p.done, 0);
  assert.deepEqual(p.byWeek, {});
});

test('buildProgress: 같은 회차 중복 제출은 한 번만 카운트', () => {
  const p = buildProgress(10, [{ 회차: 2 }, { 회차: 2 }]);
  assert.equal(p.done, 1);
  assert.equal(p.byWeek[2], true);
});

test('buildProgress: 문자열 회차도 정수로 처리', () => {
  const p = buildProgress(10, [{ 회차: '4' }]);
  assert.equal(p.done, 1);
  assert.equal(p.byWeek[4], true);
});

test('buildProgress: submissions 누락은 done=0', () => {
  const p = buildProgress(10);
  assert.equal(p.done, 0);
  assert.equal(p.total, 10);
});

test('validatePostUrl: http(s) URL은 통과', () => {
  assert.equal(validatePostUrl('https://blog.naver.com/x/123'), true);
  assert.equal(validatePostUrl('http://blog.naver.com/x/123'), true);
});

test('validatePostUrl: 비URL/빈값은 실패', () => {
  assert.equal(validatePostUrl('blog.naver.com'), false);
  assert.equal(validatePostUrl(''), false);
  assert.equal(validatePostUrl(undefined), false);
  assert.equal(validatePostUrl('   '), false);
});
