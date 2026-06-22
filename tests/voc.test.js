import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVocRecord, validateVoc, dedupKey } from '../public/js/lib/voc.js';

test('VoC 레코드를 생성한다', () => {
  const rec = buildVocRecord({ project: 'blog-challenge', message: '버튼이 안 눌려요' }, 1750000000000);
  assert.equal(rec.project, 'blog-challenge');
  assert.equal(rec.status, 'new');
  assert.equal(rec.message, '버튼이 안 눌려요');
  assert.equal(rec.channel, 'app');
  assert.ok(rec.id && rec.ts);
});

test('빈 메시지는 거부한다', () => {
  assert.equal(validateVoc({ project: 'x', message: '' }).ok, false);
  assert.equal(validateVoc({ project: 'x', message: '정상' }).ok, true);
});

test('project 누락은 거부한다', () => {
  assert.equal(validateVoc({ message: '내용' }).ok, false);
});

test('같은 프로젝트+메시지는 같은 dedup 키', () => {
  const a = buildVocRecord({ project: 'p', message: '동일' }, 1);
  const b = buildVocRecord({ project: 'p', message: '동일' }, 2);
  assert.equal(dedupKey(a), dedupKey(b));
});

test('메시지 앞뒤 공백은 트림된다', () => {
  const rec = buildVocRecord({ project: 'p', message: '  hi  ' }, 1);
  assert.equal(rec.message, 'hi');
});

test('category를 기록한다', () => {
  const rec = buildVocRecord({ project: 'p', message: 'x', category: '버그' }, 1);
  assert.equal(rec.category, '버그');
});

test('category 미지정 시 기타로 기본값', () => {
  const rec = buildVocRecord({ project: 'p', message: 'x' }, 1);
  assert.equal(rec.category, '기타');
});
