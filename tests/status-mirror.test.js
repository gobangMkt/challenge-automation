// src/gas/Status.gs 가 public/js/lib/status.js 의 정확한 미러인지 자동 검증.
// WHY: GAS는 로컬 실행이 불가해 미러 드리프트가 배포 후에야 드러난다.
// Status.gs는 시트·서비스 의존이 0이라 소스를 그대로 평가해 두 구현의 출력을 대조할 수 있다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lib from '../public/js/lib/status.js';

const src = readFileSync(new URL('../src/gas/Status.gs', import.meta.url), 'utf8');

const EXPORTED = [
  'normalizeStatus', 'isKnownStatus', 'toYmd',
  'lastDueDate', 'deriveStatus', 'canTransition', 'tabNotice', 'isRecruiting',
];
const CONSTS = ['STATUS', 'STATUS_VALUES', 'STORED_STATUS_VALUES', 'NOTICE_TABS'];

const gas = new Function(
  `${src}\nreturn { ${EXPORTED.concat(CONSTS).join(', ')} };`,
)();

const STATUSES = ['', '   ', '준비', '모집중', '운영중', '완료', '선발중', '진행중', '종료', '대기', '아무거나', null, undefined, 123];
const DATES = [
  '', null, '아무거나', '2026-08-25', '2026-08-25 14:03:09',
  '2026-08-31T15:00:00Z', '2026-08-31T14:59:59Z', '2026-08-25T15:00:00+00:00',
];
const DAYS = ['2026-07-01', '2026-08-30', '2026-08-31', '2026-09-01', '2026-11-01', '2026-11-02', ''];

test('미러: 상수 4종이 동일하다', () => {
  CONSTS.forEach((k) => assert.deepEqual(gas[k], lib[k], k));
});

test('미러: Status.gs에 ES모듈 문법이 남아있지 않다', () => {
  assert.equal(/^\s*(export|import)\s/m.test(src), false);
  assert.equal(/=>/.test(src), false, 'GAS(Rhino 호환)에서 화살표 함수 지양');
});

test('미러: normalizeStatus / isKnownStatus / isRecruiting 전수 일치', () => {
  STATUSES.forEach((s) => {
    assert.equal(gas.normalizeStatus(s), lib.normalizeStatus(s), `normalizeStatus(${s})`);
    assert.equal(gas.isKnownStatus(s), lib.isKnownStatus(s), `isKnownStatus(${s})`);
    assert.equal(gas.isRecruiting(s), lib.isRecruiting(s), `isRecruiting(${s})`);
  });
});

test('미러: toYmd 전수 일치 (Date 객체 포함)', () => {
  DATES.forEach((d) => assert.equal(gas.toYmd(d), lib.toYmd(d), `toYmd(${d})`));
  ['2026-08-25T03:00:00Z', '2026-08-25T15:00:00Z', '2026-08-25T14:59:59Z'].forEach((iso) => {
    assert.equal(gas.toYmd(new Date(iso)), lib.toYmd(new Date(iso)), iso);
  });
  assert.equal(gas.toYmd(new Date('없는날짜')), lib.toYmd(new Date('없는날짜')));
});

test('미러: lastDueDate 일치 (dueDate·마감일 두 키)', () => {
  const cases = [
    null, [], [{ dueDate: '' }],
    [{ round: 1, dueDate: '2026-09-06' }, { round: 3, dueDate: '2026-09-20' }, { round: 2, dueDate: '2026-09-13' }],
    [{ 회차: 1, 마감일: '2026-09-06' }, { 회차: 2, 마감일: '2026-10-20' }],
    [{ 마감일: new Date('2026-09-20T03:00:00Z') }, { 마감일: '2026-09-06' }],
  ];
  cases.forEach((c, i) => assert.equal(gas.lastDueDate(c), lib.lastDueDate(c), `case ${i}`));
});

test('미러: deriveStatus 전수 일치 (상태 × 오늘 × 날짜 필드)', () => {
  STATUSES.forEach((s) => {
    DAYS.forEach((today) => {
      const ch = { status: s, 모집마감: '2026-08-31', lastDueDate: '2026-11-01' };
      assert.equal(gas.deriveStatus(ch, today), lib.deriveStatus(ch, today), `${s} / ${today}`);
      const blank = { status: s, 모집마감: '', lastDueDate: '' };
      assert.equal(gas.deriveStatus(blank, today), lib.deriveStatus(blank, today), `blank ${s} / ${today}`);
      const en = { status: s, recruitEnd: '2026-08-31', 마지막회차마감일: '2026-11-01' };
      assert.equal(gas.deriveStatus(en, today), lib.deriveStatus(en, today), `en ${s} / ${today}`);
    });
  });
  assert.equal(gas.deriveStatus(null, '2026-09-01'), lib.deriveStatus(null, '2026-09-01'));
});

test('미러: canTransition 전수 일치', () => {
  STATUSES.forEach((from) => {
    STATUSES.forEach((to) => {
      assert.equal(gas.canTransition(from, to), lib.canTransition(from, to), `${from}→${to}`);
    });
  });
});

test('미러: tabNotice 전수 일치', () => {
  STATUSES.forEach((s) => assert.deepEqual(gas.tabNotice(s), lib.tabNotice(s), `tabNotice(${s})`));
});

// ---------- Setup.gs 순수 헬퍼 미러 ----------
// Setup.gs도 최상위에 시트 호출이 없어 그대로 평가할 수 있다(함수 본문만 SpreadsheetApp에 의존).
import { resolveSavedStatus, validateSettings, SETUP_STATUS_VALUES } from '../public/js/lib/setup.js';

const setupSrc = readFileSync(new URL('../src/gas/Setup.gs', import.meta.url), 'utf8');
const gasSetup = new Function(
  `${src}\n${setupSrc}\nreturn { setupResolveStatus_, setupValidateSettings_, setupIsStorableStatus_ };`,
)();

test('미러: setupResolveStatus_ ↔ resolveSavedStatus 전수 일치', () => {
  STATUSES.forEach((input) => {
    STATUSES.forEach((prev) => {
      assert.equal(
        gasSetup.setupResolveStatus_(input, prev),
        resolveSavedStatus(input, prev),
        `resolveSavedStatus(${input}, ${prev})`,
      );
    });
  });
});

test('미러: setupValidateSettings_ ↔ validateSettings status 판정 일치', () => {
  STATUSES.forEach((s) => {
    const input = { name: 'x', totalRounds: 10, status: s };
    assert.deepEqual(gasSetup.setupValidateSettings_(input), validateSettings(input), `status=${s}`);
  });
});

test('Setup.gs: 저장 가능한 상태 3종이 lib과 같다', () => {
  assert.deepEqual(SETUP_STATUS_VALUES, gas.STORED_STATUS_VALUES);
  ['준비', '모집중', '완료', '진행중', '종료'].forEach((s) => {
    assert.equal(gasSetup.setupIsStorableStatus_(s), true, s);
  });
  ['운영중', '아무거나'].forEach((s) => {
    assert.equal(gasSetup.setupIsStorableStatus_(s), false, s);
  });
});
