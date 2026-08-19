import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  csvCell, buildCsv, selectionLabel, formatPhone, csvFileName, rosterCsv, payoutCsv,
} from '../public/js/lib/csv.js';

test('csvCell: 콤마·따옴표·개행 포함 값만 따옴표로 감싸고 이스케이프', () => {
  assert.equal(csvCell('김고방'), '김고방');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell('김, 고방'), '"김, 고방"');
  assert.equal(csvCell('김"고방"'), '"김""고방"""');
  assert.equal(csvCell('두\n줄'), '"두\n줄"');
});

test('buildCsv: 컬럼 정의대로 헤더+행 생성', () => {
  const cols = [{ header: '성함', value: (r) => r.name }, { header: '수', value: (r) => r.n }];
  const csv = buildCsv(cols, [{ name: 'A', n: 1 }, { name: 'B', n: 2 }]);
  assert.deepEqual(csv.split('\r\n'), ['성함,수', 'A,1', 'B,2']);
});

test('buildCsv: 행이 없으면 헤더만', () => {
  assert.equal(buildCsv([{ header: '성함', value: (r) => r.name }], []), '성함');
});

test('formatPhone: 하이픈 없는 번호도 하이픈을 넣어 엑셀에서 앞 0이 살아남게', () => {
  assert.equal(formatPhone('01012345678'), '010-1234-5678');
  assert.equal(formatPhone('010-1234-5678'), '010-1234-5678');
  assert.equal(formatPhone('010 1234 5678'), '010-1234-5678');
  assert.equal(formatPhone('0212345678'), '02-1234-5678');
});

test('formatPhone: 자릿수가 규칙에 안 맞으면 원본 그대로', () => {
  assert.equal(formatPhone('12345'), '12345');
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone(null), '');
});

test('selectionLabel: 영문·한글 상태를 한글 라벨로', () => {
  assert.equal(selectionLabel('selected'), '선발');
  assert.equal(selectionLabel('선발'), '선발');
  assert.equal(selectionLabel('rejected'), '탈락');
  assert.equal(selectionLabel('탈락'), '탈락');
  assert.equal(selectionLabel(''), '미정');
  assert.equal(selectionLabel(null), '미정');
  assert.equal(selectionLabel('applied'), '미정');
});

test('csvFileName: 캠페인명_종류_날짜.csv', () => {
  assert.equal(csvFileName('블챌 3기', '명단', new Date('2026-08-19T10:00:00+09:00')), '블챌 3기_명단_2026-08-19.csv');
});

test('csvFileName: 파일명 금지문자는 _로 치환, 빈 이름은 challenge', () => {
  assert.equal(csvFileName('a/b:c*?"<>|d', '정산', new Date('2026-08-19T10:00:00+09:00')), 'a_b_c____' + '__d_정산_2026-08-19.csv');
  assert.equal(csvFileName('', '명단', new Date('2026-08-19T10:00:00+09:00')), 'challenge_명단_2026-08-19.csv');
});

test('rosterCsv: 성함·휴대폰·블로그·선발상태 (표 순서 유지)', () => {
  const rows = [
    { name: '김고방', phone: '01012345678', blogUrl: 'https://blog.naver.com/kim', status: 'selected' },
    { name: '박개방', phone: '010-2222-3333', blogUrl: '', status: '' },
  ];
  const lines = rosterCsv(rows).split('\r\n');
  assert.equal(lines[0], '성함,휴대폰,블로그,선발상태');
  assert.equal(lines[1], '김고방,010-1234-5678,https://blog.naver.com/kim,선발');
  assert.equal(lines[2], '박개방,010-2222-3333,,미정');
});

test('payoutCsv: 성함·휴대폰·제출수·우수활동자·지급액, 지급액 내림차순', () => {
  const people = [
    { name: '박개방', phone: '01022223333', count: 2, excellent: false, amount: 10000 },
    { name: '김고방', phone: '01012345678', count: 8, excellent: true, amount: 80000 },
  ];
  const lines = payoutCsv(people).split('\r\n');
  assert.equal(lines[0], '성함,휴대폰,제출수,우수활동자,지급액');
  assert.equal(lines[1], '김고방,010-1234-5678,8,Y,80000');
  assert.equal(lines[2], '박개방,010-2222-3333,2,N,10000');
});

test('payoutCsv: 지급액이 같으면 제출수 많은 순', () => {
  const people = [
    { name: 'A', phone: '01000000001', count: 1, excellent: false, amount: 5000 },
    { name: 'B', phone: '01000000002', count: 3, excellent: false, amount: 5000 },
  ];
  const lines = payoutCsv(people).split('\r\n');
  assert.equal(lines[1].split(',')[0], 'B');
  assert.equal(lines[2].split(',')[0], 'A');
});

test('payoutCsv: 원화기호·콤마 없는 순수 숫자 (엑셀 합계 가능)', () => {
  const csv = payoutCsv([{ name: 'A', phone: '01000000001', count: 1, excellent: false, amount: 1234500 }]);
  assert.match(csv.split('\r\n')[1], /,1234500$/);
});
