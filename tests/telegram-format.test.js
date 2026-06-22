import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatVocApproval, formatDone } from '../scripts/lib/telegram-format.js';

test('formatVocApproval: voc.id·voc.message·plan을 포함하고 답장 안내를 붙인다', () => {
  const voc = { id: 'voc-123', message: '버튼이 안 눌려요' };
  const plan = '드래그 시 setPointerCapture 제거';
  const out = formatVocApproval({ voc, plan });
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('voc-123'), 'voc.id 포함');
  assert.ok(out.includes('버튼이 안 눌려요'), 'voc.message 원문 포함');
  assert.ok(out.includes('드래그 시 setPointerCapture 제거'), 'plan 포함');
  assert.ok(out.includes('승인') && out.includes('반려'), '승인/반려 안내 포함');
});

test('formatDone: voc.id·summary·검증결과를 포함한다', () => {
  const voc = { id: 'voc-999', message: '무관한 원문' };
  const summary = '주차 칩 클릭 복구';
  const checks = { test: 'PASS', qa: 'PASS', ui: 'OK' };
  const out = formatDone({ voc, summary, checks });
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('voc-999'), 'voc.id 포함');
  assert.ok(out.includes('주차 칩 클릭 복구'), 'summary 포함');
  assert.ok(out.includes('PASS'), 'checks 값 포함');
});

test('formatDone: checks가 문자열이어도 포함된다', () => {
  const out = formatDone({ voc: { id: 'x' }, summary: 's', checks: '모두 통과' });
  assert.ok(out.includes('모두 통과'));
});
