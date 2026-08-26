import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  buildEmptyMissions,
  validateSettings,
  normalizeMissions,
  resolveSavedStatus,
  SETUP_STATUS_VALUES,
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

// ---------- status 보존 (슬라이스 2) ----------
// WHY: updateChallengeRow_가 17열을 통째로 덮어쓰므로, status를 안 보낸 수정 저장이
// 기존 상태를 기본값으로 되돌리는 회귀가 있었다. 그 동작을 여기서 고정한다.

test('resolveSavedStatus: status 미지정 수정 저장은 기존 행 값을 보존한다', () => {
  assert.equal(resolveSavedStatus(undefined, '모집중'), '모집중');
  assert.equal(resolveSavedStatus(null, '모집중'), '모집중');
  assert.equal(resolveSavedStatus('', '모집중'), '모집중');
  assert.equal(resolveSavedStatus('   ', '완료'), '완료');
});

test('resolveSavedStatus: 신규 생성(기존값 없음)은 준비', () => {
  assert.equal(resolveSavedStatus(undefined, undefined), '준비');
  assert.equal(resolveSavedStatus('', ''), '준비');
  assert.equal(resolveSavedStatus(null, null), '준비');
});

test('resolveSavedStatus: 기존 행의 레거시 값도 정규화해서 보존', () => {
  assert.equal(resolveSavedStatus('', '진행중'), '모집중');
  assert.equal(resolveSavedStatus('', '선발중'), '모집중');
  assert.equal(resolveSavedStatus('', '종료'), '완료');
});

test('resolveSavedStatus: 저장 가능한 값을 명시하면 그 값으로 교체', () => {
  assert.equal(resolveSavedStatus('완료', '모집중'), '완료');
  assert.equal(resolveSavedStatus('준비', '모집중'), '준비');
  assert.equal(resolveSavedStatus('종료', '모집중'), '완료');
});

test('resolveSavedStatus: 파생값 운영중·알 수 없는 값은 저장하지 않고 기존값 유지', () => {
  assert.equal(resolveSavedStatus('운영중', '모집중'), '모집중');
  assert.equal(resolveSavedStatus('운영중', undefined), '준비');
  assert.equal(resolveSavedStatus('아무거나', '모집중'), '모집중');
});

// ---------- validateSettings: 저장 가능한 상태 3종 ----------

test('SETUP_STATUS_VALUES: 저장 대상은 준비/모집중/완료 3종 (운영중은 파생)', () => {
  assert.deepEqual(SETUP_STATUS_VALUES, ['준비', '모집중', '완료']);
});

test('validateSettings: 저장 가능한 상태와 레거시 별칭은 통과', () => {
  ['준비', '모집중', '완료', '진행중', '선발중', '종료'].forEach((s) => {
    const res = validateSettings({ name: 'x', totalRounds: 10, status: s });
    assert.equal(res.ok, true, s);
  });
});

test('validateSettings: 파생값 운영중은 설정 저장을 막지 않는다 (쓰기 단계에서 무시)', () => {
  // WHY: 허브가 화면에 보이는 파생 상태를 그대로 되돌려보내도 저장이 실패하면 안 된다.
  // 저장 대상 3종으로 좁히는 책임은 resolveSavedStatus에 있다.
  assert.equal(validateSettings({ name: 'x', totalRounds: 10, status: '운영중' }).ok, true);
  assert.equal(resolveSavedStatus('운영중', '모집중'), '모집중');
});
