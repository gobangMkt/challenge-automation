import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  buildEmptyMissions,
  validateSettings,
  normalizeMissions,
} from '../public/js/lib/setup.js';

test('slugify: 한글/공백/특수문자를 소문자-하이픈 슬러그로', () => {
  assert.equal(slugify('취준 블로그 마스터즈'), '취준-블로그-마스터즈');
  assert.equal(slugify('Blog Camp 4!!'), 'blog-camp-4');
  assert.equal(slugify('  여러   공백  '), '여러-공백');
});

test('slugify: 빈 입력이면 비어있지 않은 fallback 슬러그', () => {
  const s = slugify('');
  assert.ok(typeof s === 'string' && s.length > 0);
});

test('slugify: suffix로 충돌 회피용 접미 추가', () => {
  const s = slugify('블캠', 'x9');
  assert.equal(s, '블캠-x9');
});

test('buildEmptyMissions: 총회차 수만큼 빈 회차 행 생성', () => {
  const rows = buildEmptyMissions('blog-camp', 3);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.round), [1, 2, 3]);
  assert.equal(rows[0].challengeId, 'blog-camp');
  assert.equal(rows[0].title, '');
  assert.equal(rows[0].body, '');
  assert.equal(rows[0].articleName, '');
  assert.equal(rows[0].articleUrl, '');
  assert.equal(rows[0].status, '대기');
});

test('buildEmptyMissions: 잘못된 회차 수는 기본 10', () => {
  assert.equal(buildEmptyMissions('x', 0).length, 10);
  assert.equal(buildEmptyMissions('x', -3).length, 10);
  assert.equal(buildEmptyMissions('x', 'abc').length, 10);
});

test('validateSettings: 정상 입력은 ok=true', () => {
  const res = validateSettings({
    name: '취준 블로그 마스터즈',
    totalRounds: 10,
    rewardPerPost: 5000,
    excellentMultiplier: 2,
    status: '모집중',
  });
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, {});
});

test('validateSettings: 챌린지명 누락 시 name 오류', () => {
  const res = validateSettings({ name: '', totalRounds: 10 });
  assert.equal(res.ok, false);
  assert.ok(res.errors.name);
});

test('validateSettings: 총회차 1 미만이면 totalRounds 오류', () => {
  const res = validateSettings({ name: 'x', totalRounds: 0 });
  assert.equal(res.ok, false);
  assert.ok(res.errors.totalRounds);
});

test('validateSettings: rewardPerPost 음수면 오류', () => {
  const res = validateSettings({ name: 'x', totalRounds: 10, rewardPerPost: -100 });
  assert.equal(res.ok, false);
  assert.ok(res.errors.rewardPerPost);
});

test('validateSettings: status가 허용값 아니면 오류', () => {
  const res = validateSettings({ name: 'x', totalRounds: 10, status: '아무거나' });
  assert.equal(res.ok, false);
  assert.ok(res.errors.status);
});

test('normalizeMissions: 입력 미션 배열을 회차 1..N 행으로 정규화', () => {
  const out = normalizeMissions('cid', [
    { round: 1, title: '1주차', body: '본문1', articleName: 'A', articleUrl: 'https://a' },
    { round: 2, title: '2주차' },
  ], 3);
  assert.equal(out.length, 3);
  assert.equal(out[0].challengeId, 'cid');
  assert.equal(out[0].title, '1주차');
  assert.equal(out[0].body, '본문1');
  assert.equal(out[0].articleName, 'A');
  assert.equal(out[1].title, '2주차');
  assert.equal(out[1].articleName, '');
  assert.equal(out[2].title, '');
  assert.deepEqual(out.map((r) => r.round), [1, 2, 3]);
});

test('normalizeMissions: round 키 없이 순서대로 들어온 입력도 1..N 배정', () => {
  const out = normalizeMissions('cid', [{ title: 'a' }, { title: 'b' }], 2);
  assert.deepEqual(out.map((r) => r.round), [1, 2]);
  assert.equal(out[0].title, 'a');
  assert.equal(out[1].title, 'b');
});
