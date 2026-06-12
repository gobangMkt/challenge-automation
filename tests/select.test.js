import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSelection,
  applySelection,
  countByStatus,
} from '../public/js/lib/select.js';

test('validateSelection: 유효한 결정과 휴대폰 배열이면 ok', () => {
  const res = validateSelection(
    { phones: ['010-1111-2222'], decision: 'selected' },
    { afterAnnounce: false },
  );
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, {});
});

test('validateSelection: 휴대폰 배열 비면 phones 오류', () => {
  const res = validateSelection({ phones: [], decision: 'selected' }, {});
  assert.equal(res.ok, false);
  assert.ok(res.errors.phones);
});

test('validateSelection: 잘못된 decision이면 decision 오류', () => {
  const res = validateSelection({ phones: ['010-1111-2222'], decision: 'done' }, {});
  assert.equal(res.ok, false);
  assert.ok(res.errors.decision);
});

test('validateSelection: selected/rejected 둘 다 허용', () => {
  assert.equal(
    validateSelection({ phones: ['010-1111-2222'], decision: 'rejected' }, {}).ok,
    true,
  );
});

test('validateSelection: 발표일 경과 후면 announce 오류(선발 불가)', () => {
  const res = validateSelection(
    { phones: ['010-1111-2222'], decision: 'selected' },
    { afterAnnounce: true },
  );
  assert.equal(res.ok, false);
  assert.ok(res.errors.announce);
});

test('applySelection: applied 신청자를 selected로 전환', () => {
  const rows = [
    { phone: '010-1111-2222', status: 'applied' },
    { phone: '010-3333-4444', status: 'applied' },
  ];
  const out = applySelection(rows, ['010-1111-2222'], 'selected');
  assert.equal(out.changed, 1);
  assert.equal(out.rows[0].status, 'selected');
  assert.equal(out.rows[1].status, 'applied');
});

test('applySelection: applied 신청자를 rejected로 전환', () => {
  const rows = [{ phone: '010-1111-2222', status: 'applied' }];
  const out = applySelection(rows, ['010-1111-2222'], 'rejected');
  assert.equal(out.rows[0].status, 'rejected');
  assert.equal(out.changed, 1);
});

test('applySelection: 명단에 없는 휴대폰은 무시(changed 미포함)', () => {
  const rows = [{ phone: '010-1111-2222', status: 'applied' }];
  const out = applySelection(rows, ['010-9999-0000'], 'selected');
  assert.equal(out.changed, 0);
  assert.equal(out.rows[0].status, 'applied');
});

test('applySelection: 이미 같은 상태면 changed에 안 셈', () => {
  const rows = [{ phone: '010-1111-2222', status: 'selected' }];
  const out = applySelection(rows, ['010-1111-2222'], 'selected');
  assert.equal(out.changed, 0);
  assert.equal(out.rows[0].status, 'selected');
});

test('applySelection: 원본 배열을 변형하지 않는다', () => {
  const rows = [{ phone: '010-1111-2222', status: 'applied' }];
  applySelection(rows, ['010-1111-2222'], 'selected');
  assert.equal(rows[0].status, 'applied');
});

test('applySelection: 여러 휴대폰 일괄 전환', () => {
  const rows = [
    { phone: '010-1111-2222', status: 'applied' },
    { phone: '010-3333-4444', status: 'applied' },
    { phone: '010-5555-6666', status: 'applied' },
  ];
  const out = applySelection(rows, ['010-1111-2222', '010-5555-6666'], 'selected');
  assert.equal(out.changed, 2);
  assert.equal(out.rows[0].status, 'selected');
  assert.equal(out.rows[1].status, 'applied');
  assert.equal(out.rows[2].status, 'selected');
});

test('countByStatus: 상태별 집계', () => {
  const rows = [
    { status: 'applied' },
    { status: 'applied' },
    { status: 'selected' },
    { status: 'rejected' },
  ];
  const c = countByStatus(rows);
  assert.equal(c.applied, 2);
  assert.equal(c.selected, 1);
  assert.equal(c.rejected, 1);
});

test('countByStatus: 빈 상태는 applied로 간주', () => {
  const c = countByStatus([{ status: '' }, {}]);
  assert.equal(c.applied, 2);
});
