// 허브 화면(AdminHub.gs)·신청 게이팅(Code.gs)·일일 자동화(Automation.gs)가 같은 상태를 말하는지 검증.
// WHY: 화면은 시트 마감일 최대값만, 자동화는 운영종료일(= 시트값과 일정상 마지막 회차 마감일 중
// 늦은 쪽)을 썼다. 회차 마감일을 아직 안 채운 캠페인이 화면엔 '완료', 자동화엔 '운영중'으로 갈렸다.
// 판정 입력을 Schedule.gs의 statusInput_ 하나로 모았고, 그게 다시 갈라지지 않도록 여기서 고정한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/gas/${name}`, import.meta.url), 'utf8');
const statusSrc = read('Status.gs');
const scheduleSrc = read('Schedule.gs');
const adminSrc = read('AdminHub.gs');
const codeSrc = read('Code.gs');

const gas = new Function(
  `${statusSrc}\n${scheduleSrc}\nreturn {
    statusInput_, scheduleStatusInput_, scheduleChallengeInput_,
    operationEndDate_, planDailyRun_, deriveStatus, lastDueDate,
  };`,
)();

// Challenges 시트 행 모양(한글 헤더 + rowsAsObjects_가 텍스트로 정규화한 날짜).
const ROWS = [
  { challengeId: 'a', status: '모집중', 모집마감: '2026-01-20', 시작일: '2026-01-27', 오픈요일: '화', 마감요일: '월', 총회차: 10 },
  { challengeId: 'b', status: '모집중', 모집마감: '2026-03-01', 시작일: '2026-01-27', 오픈요일: '화', 마감요일: '월', 총회차: 10 },
  { challengeId: 'c', status: '준비', 모집마감: '2026-01-20', 시작일: '2026-01-27', 오픈요일: '화', 마감요일: '월', 총회차: 10 },
  { challengeId: 'd', status: '완료', 모집마감: '2026-01-20', 시작일: '2026-01-27', 오픈요일: '화', 마감요일: '월', 총회차: 10 },
  { challengeId: 'e', status: '진행중', 모집마감: '2026-01-20', 시작일: '2026-01-27', 오픈요일: '화', 마감요일: '월', 총회차: 2 },
  { challengeId: 'f', status: '', 모집마감: '', 시작일: '2026-01-27', 오픈요일: '화', 마감요일: '월', 총회차: 10 },
  { challengeId: 'g', status: '모집중', 모집마감: '2026-01-20', 시작일: '', 오픈요일: '화', 마감요일: '월', 총회차: 10 },
];

const mission = (round, status, due) => ({ challengeId: 'x', 회차: round, 상태: status, 마감일: due || '' });

const MISSION_SETS = [
  [],
  [mission(1, '대기')],
  [mission(1, '마감', '2026-02-02')],
  [mission(1, '마감', '2026-02-02'), mission(2, '오픈', '2026-02-09')],
  [mission(10, '마감', '2026-06-30')],
];

const DAYS = ['2026-01-19', '2026-02-03', '2026-02-10', '2026-04-07', '2026-07-01'];

test('허브 판정 입력 = 자동화 판정 입력 (전수)', () => {
  ROWS.forEach((row) => {
    MISSION_SETS.forEach((ms, mi) => {
      const hub = gas.statusInput_(row, ms);
      const auto = gas.scheduleStatusInput_(gas.scheduleChallengeInput_(row), ms);
      assert.deepEqual(hub, auto, `${row.challengeId} / missions ${mi}`);
    });
  });
});

test('허브가 운영중이 아니라고 하면 자동화도 아무 것도 하지 않는다', () => {
  ROWS.forEach((row) => {
    MISSION_SETS.forEach((ms, mi) => {
      DAYS.forEach((today) => {
        const status = gas.deriveStatus(gas.statusInput_(row, ms), today);
        if (status === '운영중') return;
        assert.deepEqual(
          gas.planDailyRun_(gas.scheduleChallengeInput_(row), ms, today),
          { openWeek: null, remindWeek: null, closeWeek: null },
          `${row.challengeId} / missions ${mi} / ${today} → ${status}`,
        );
      });
    });
  });
});

// 슬라이스 5가 보고한 실제 불일치 케이스를 그대로 고정한다.
test('회차 마감일을 안 채운 캠페인을 화면이 완료로 오판하지 않는다', () => {
  const row = ROWS[0]; // 10회차, 일정상 마지막 마감 2026-04-06
  const ms = [mission(1, '마감', '2026-02-02')];
  const today = '2026-02-10';

  // 옛 규칙(시트 마감일 최대값만) — 화면은 완료라고 말했다
  const old = gas.deriveStatus(
    { status: row.status, 모집마감: row['모집마감'], lastDueDate: gas.lastDueDate(ms) },
    today,
  );
  assert.equal(old, '완료');

  // 통일 후 — 화면도 자동화와 같이 운영중
  assert.equal(gas.deriveStatus(gas.statusInput_(row, ms), today), '운영중');
  assert.equal(gas.operationEndDate_(gas.scheduleChallengeInput_(row), ms), '2026-04-06');
  assert.deepEqual(
    gas.planDailyRun_(gas.scheduleChallengeInput_(row), ms, '2026-02-05'), // 오픈일도 마감일도 아닌 날
    { openWeek: null, remindWeek: null, closeWeek: null },
  );
  // 2회차 오픈일에는 자동화가 실제로 돈다(옛 규칙이면 완료라 영영 안 열렸다)
  assert.equal(
    gas.planDailyRun_(gas.scheduleChallengeInput_(row), ms, '2026-02-03').openWeek,
    2,
  );
});

test('시작일이 비어 있으면 옛 동작(시트 마감일 최대값)으로 안전하게 내려앉는다', () => {
  const row = ROWS[6];
  const ms = [mission(1, '마감', '2026-02-02')];
  assert.equal(gas.operationEndDate_(gas.scheduleChallengeInput_(row), ms), '2026-02-02');
  assert.equal(gas.statusInput_(row, []).lastDueDate, '');
});

test('statusInput_은 Schedule.gs에만 정의된다 (호출부 재구현 금지)', () => {
  assert.notEqual(scheduleSrc.indexOf('function statusInput_'), -1);
  [['AdminHub.gs', adminSrc], ['Code.gs', codeSrc]].forEach(([name, src]) => {
    assert.equal(src.indexOf('function statusInput_'), -1, `${name}이 statusInput_을 재정의했다`);
  });
});

test('허브·게이팅이 시트 마감일 최대값만으로 판정하지 않는다', () => {
  [['AdminHub.gs', adminSrc], ['Code.gs', codeSrc]].forEach(([name, src]) => {
    assert.equal(
      /lastDueDate\(weekMissionsFor_/.test(src), false,
      `${name}에 시트 마감일만 쓰는 판정 경로가 남아 있다`,
    );
  });
});
