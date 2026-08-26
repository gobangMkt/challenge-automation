// src/gas/Init.gs의 1회성 migrateStatus()를 시트/로거 스텁으로 검증.
// WHY: GAS는 로컬 실행이 불가한데 이 함수는 시트를 통째로 덮어쓴다. dry-run이 기본이라는 것과
// 적용이 setValues 1회로 끝난다는 것은 눈으로 대조할 게 아니라 테스트로 못박는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/gas/${name}`, import.meta.url), 'utf8');
const src = `${read('Status.gs')}\n${read('Init.gs')}`;

// 시트 스텁 — getRange(row, col, n, 1) 단위 읽기/쓰기만 흉내낸다.
function makeSheet(header, rows) {
  const calls = { setValues: [] };
  const grid = [header].concat(rows);
  const sheet = {
    getLastRow: () => grid.length,
    getLastColumn: () => header.length,
    getRange(r, c, n, w) {
      const height = n == null ? 1 : n;
      const width = w == null ? 1 : w;
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < height; i += 1) out.push(grid[r - 1 + i].slice(c - 1, c - 1 + width));
          return out;
        },
        setValues(vals) {
          calls.setValues.push({ r, c, vals });
          vals.forEach((row, i) => row.forEach((v, j) => { grid[r - 1 + i][c - 1 + j] = v; }));
        },
      };
    },
  };
  return { sheet, calls, grid };
}

function run(header, rows, apply, sheetName) {
  const { sheet, calls, grid } = makeSheet(header, rows);
  const logs = [];
  const fn = new Function(
    'SpreadsheetApp', 'Logger',
    `${src}\nreturn migrateStatus;`,
  )(
    { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === (sheetName || 'Challenges') ? sheet : null) }) },
    { log: (m) => logs.push(String(m)) },
  );
  const ret = fn(apply);
  return { ret, logs, calls, grid, text: logs.join('\n') };
}

const HEADER = ['challengeId', 'name', 'status', '모집마감'];
const ROWS = [
  ['a', 'A', '', '2026-01-01'],
  ['b', 'B', '진행중', '2026-01-01'],
  ['c', 'C', '종료', '2026-01-01'],
  ['d', 'D', '모집중', '2026-01-01'],
  ['e', 'E', '선발중', '2026-01-01'],
];

test('migrateStatus: 인자 없이 부르면 dry-run — 시트를 건드리지 않는다', () => {
  const r = run(HEADER, ROWS.map((x) => x.slice()));
  assert.equal(r.calls.setValues.length, 0);
  assert.deepEqual(r.grid.slice(1).map((x) => x[2]), ['', '진행중', '종료', '모집중', '선발중']);
  assert.match(r.text, /\[dry-run\]/);
  assert.match(r.text, /migrateStatus\(true\)/);
});

test('migrateStatus: dry-run이 무엇을 어떻게 바꿀지 행마다 로깅한다', () => {
  const r = run(HEADER, ROWS.map((x) => x.slice()));
  assert.match(r.text, /대상 5행 \/ 변경 4건/);
  assert.match(r.text, /a: "" → "준비"/);
  assert.match(r.text, /b: "진행중" → "모집중"/);
  assert.match(r.text, /c: "종료" → "완료"/);
  assert.match(r.text, /e: "선발중" → "모집중"/);
  assert.equal(/d: /.test(r.text), false, '바뀌지 않는 행은 로그에 남기지 않는다');
});

test('migrateStatus(true): setValues 배치 1회로 status 열만 갱신한다', () => {
  const r = run(HEADER, ROWS.map((x) => x.slice()), true);
  assert.equal(r.calls.setValues.length, 1);
  const call = r.calls.setValues[0];
  assert.equal(call.r, 2, '헤더 다음 행부터');
  assert.equal(call.c, 3, 'status 열만');
  assert.deepEqual(call.vals, [['준비'], ['모집중'], ['완료'], ['모집중'], ['모집중']]);
  assert.deepEqual(r.grid.slice(1).map((x) => x[2]), ['준비', '모집중', '완료', '모집중', '모집중']);
  assert.match(r.text, /\[적용\]/);
});

test('migrateStatus(true): 바꿀 값이 없으면 쓰지 않는다', () => {
  const r = run(HEADER, [['a', 'A', '준비', ''], ['b', 'B', '완료', '']], true);
  assert.equal(r.calls.setValues.length, 0);
  assert.match(r.text, /변경 0건/);
});

test('migrateStatus: 변환 규칙은 normalizeStatus 그대로 (자체 매핑표 없음)', () => {
  const initSrc = read('Init.gs');
  const body = initSrc.slice(initSrc.indexOf('function migrateStatus'));
  assert.notEqual(body.indexOf('normalizeStatus('), -1);
  ['선발중', '진행중', '종료', '대기'].forEach((legacy) => {
    assert.equal(body.indexOf(`'${legacy}'`), -1, `migrateStatus 안에 ${legacy} 매핑이 하드코딩됐다`);
  });
});

test('migrateStatus: 저장 대상이 아닌 값(운영중)은 눈에 띄게 알린다', () => {
  const r = run(HEADER, [['a', 'A', '운영중', '']]);
  assert.match(r.text, /주의/);
  assert.equal(r.calls.setValues.length, 0);
});

test('migrateStatus: 시트·행·열이 없으면 아무 것도 하지 않고 이유를 남긴다', () => {
  assert.match(run(HEADER, ROWS, false, '없는시트').text, /Challenges 시트가 없습니다/);
  assert.match(run(HEADER, []).text, /대상 행이 없습니다/);
  assert.match(run(['challengeId', 'name'], [['a', 'A']]).text, /status 열이 없습니다/);
});
