import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcSettlement, toCsv } from '../public/js/lib/settlement.js';

const POLICY = { rewardPerPost: 5000, excellentMultiplier: 2 };

test('제출수 × 단가로 활동비를 계산한다', () => {
  const participants = [{ phone: '010-1111-2222', name: '김고방' }];
  const submissions = [
    { phone: '010-1111-2222', round: 1 },
    { phone: '010-1111-2222', round: 2 },
    { phone: '010-1111-2222', round: 3 },
  ];
  const rows = calcSettlement(participants, submissions, [], POLICY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].submitCount, 3);
  assert.equal(rows[0].excellent, false);
  assert.equal(rows[0].amount, 15000);
});

test('우수활동자는 활동비가 2배', () => {
  const participants = [{ phone: '010-1111-2222', name: '김고방' }];
  const submissions = [
    { phone: '010-1111-2222', round: 1 },
    { phone: '010-1111-2222', round: 2 },
  ];
  const wrapups = [{ phone: '010-1111-2222', excellent: 'Y' }];
  const rows = calcSettlement(participants, submissions, wrapups, POLICY);
  assert.equal(rows[0].excellent, true);
  assert.equal(rows[0].amount, 20000);
});

test('우수활동자 N은 배수 적용 안 함', () => {
  const participants = [{ phone: '010-1111-2222', name: '김고방' }];
  const submissions = [{ phone: '010-1111-2222', round: 1 }];
  const wrapups = [{ phone: '010-1111-2222', excellent: 'N' }];
  const rows = calcSettlement(participants, submissions, wrapups, POLICY);
  assert.equal(rows[0].excellent, false);
  assert.equal(rows[0].amount, 5000);
});

test('제출이 없는 참가자는 0건 0원', () => {
  const participants = [{ phone: '010-9999-0000', name: '박개방' }];
  const rows = calcSettlement(participants, [], [], POLICY);
  assert.equal(rows[0].submitCount, 0);
  assert.equal(rows[0].amount, 0);
});

test('여러 참가자를 각각 집계한다', () => {
  const participants = [
    { phone: '010-1111-1111', name: 'A' },
    { phone: '010-2222-2222', name: 'B' },
  ];
  const submissions = [
    { phone: '010-1111-1111', round: 1 },
    { phone: '010-2222-2222', round: 1 },
    { phone: '010-2222-2222', round: 2 },
  ];
  const wrapups = [{ phone: '010-2222-2222', excellent: 'Y' }];
  const rows = calcSettlement(participants, submissions, wrapups, POLICY);
  const a = rows.find((r) => r.phone === '010-1111-1111');
  const b = rows.find((r) => r.phone === '010-2222-2222');
  assert.equal(a.amount, 5000);
  assert.equal(b.submitCount, 2);
  assert.equal(b.amount, 20000);
});

test('기본 단가·배수가 없으면 기본값(0단가, 2배)으로 동작', () => {
  const participants = [{ phone: '010-1111-2222', name: '김고방' }];
  const submissions = [{ phone: '010-1111-2222', round: 1 }];
  const rows = calcSettlement(participants, submissions, [], {});
  assert.equal(rows[0].amount, 0);
});

test('phone 정규화로 매칭(하이픈 차이 무시)', () => {
  const participants = [{ phone: '010-1111-2222', name: '김고방' }];
  const submissions = [{ phone: '01011112222', round: 1 }];
  const wrapups = [{ phone: '010 1111 2222', excellent: 'Y' }];
  const rows = calcSettlement(participants, submissions, wrapups, POLICY);
  assert.equal(rows[0].submitCount, 1);
  assert.equal(rows[0].excellent, true);
  assert.equal(rows[0].amount, 10000);
});

test('toCsv: 헤더+행을 CSV 문자열로', () => {
  const rows = [
    { phone: '010-1111-2222', name: '김고방', submitCount: 3, excellent: true, amount: 30000 },
  ];
  const csv = toCsv(rows);
  const lines = csv.split('\n');
  assert.equal(lines[0], '휴대폰,성함,제출수,우수활동자,활동비');
  assert.equal(lines[1], '010-1111-2222,김고방,3,Y,30000');
});

test('toCsv: 콤마·따옴표 포함 값은 따옴표로 감싸고 이스케이프', () => {
  const rows = [
    { phone: '010-1111-2222', name: '김, "고방"', submitCount: 0, excellent: false, amount: 0 },
  ];
  const csv = toCsv(rows);
  const lines = csv.split('\n');
  assert.equal(lines[1], '010-1111-2222,"김, ""고방""",0,N,0');
});

test('toCsv: 빈 배열이면 헤더만', () => {
  const csv = toCsv([]);
  assert.equal(csv, '휴대폰,성함,제출수,우수활동자,활동비');
});
