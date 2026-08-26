// src/gas/Schedule.gs가 public/js/lib/schedule.js의 정확한 미러인지 자동 검증.
// WHY: GAS는 로컬 실행이 불가하다. 자동화 진입조건이 어긋나면 과거 캠페인에 알림톡이 나가는
// 사고로 드러나므로, 눈으로 대조하지 말고 두 구현의 출력을 전수 비교한다.
// Schedule.gs는 시트·서비스 의존이 0이라 소스를 그대로 평가할 수 있다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planDailyRun, weekWindow, operationEndDate } from '../public/js/lib/schedule.js';

const statusSrc = readFileSync(new URL('../src/gas/Status.gs', import.meta.url), 'utf8');
const scheduleSrc = readFileSync(new URL('../src/gas/Schedule.gs', import.meta.url), 'utf8');
const autoSrc = readFileSync(new URL('../src/gas/Automation.gs', import.meta.url), 'utf8');

const gas = new Function(
  `${statusSrc}\n${scheduleSrc}\nreturn { planDailyRun_, weekWindow_, operationEndDate_ };`,
)();

// 두 구현은 회차 필드명이 다르다(lib: week/status/dueDate, GAS: 회차/상태/마감일).
// 양쪽 키를 모두 심어 각자 자기 키를 읽게 한다.
function mission(week, status, dueDate) {
  return {
    week, 회차: week, status, 상태: status,
    dueDate: dueDate || '', 마감일: dueDate || '',
  };
}

const CHALLENGES = [
  { status: '모집중', 모집마감: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '모집중', 모집마감: '2026-03-01', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '준비', 모집마감: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '완료', 모집마감: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '진행중', 모집마감: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '종료', 모집마감: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '', 모집마감: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '모집중', recruitEnd: '2026-01-20', startDate: '2026-01-27', openDow: '화', closeOffset: 4, totalWeeks: 3 },
  { status: '모집중', 모집마감: '2026-01-20', startDate: '2026-01-27', totalWeeks: 2 },
  { status: '모집중', 모집마감: '2026-01-20', startDate: '', openDow: '화', closeDow: '월', totalWeeks: 10 },
  { status: '모집중', 모집마감: '', startDate: '2026-01-27', openDow: '화', closeDow: '월', totalWeeks: 10 },
];

const MISSION_SETS = [
  [],
  [mission(1, '대기')],
  [mission(1, '오픈')],
  [mission(1, '마감'), mission(2, '오픈')],
  [mission(10, '오픈')],
  [mission(1, '오픈', '2026-02-02')],
  [mission(10, '대기', '2026-06-30')],
  [mission(1, '마감', '2026-02-02'), mission(2, '오픈', '2026-02-09')],
];

const DAYS = [
  '2026-01-19', '2026-01-26', '2026-01-27', '2026-02-01', '2026-02-02',
  '2026-02-03', '2026-02-09', '2026-04-06', '2026-04-07', '2026-07-01', '',
];

test('미러: Schedule.gs·Automation.gs에 ES모듈 문법·화살표 함수가 없다', () => {
  [scheduleSrc, autoSrc].forEach(function (src) {
    assert.equal(/^\s*(export|import)\s/m.test(src), false);
    assert.equal(/=>/.test(src), false, 'GAS(Rhino 호환)에서 화살표 함수 지양');
  });
});

// 순수 스케줄 로직이 자동화 어댑터 안으로 되돌아가면 허브·자동화가 다시 갈라진다.
test('미러: 순수 스케줄 로직은 Schedule.gs에만 있다', () => {
  ['weekWindow_', 'operationEndDate_', 'planDailyRun_', 'firstOpen_', 'missionStatus_'].forEach((fn) => {
    assert.equal(autoSrc.indexOf('function ' + fn), -1, `Automation.gs에 ${fn} 재정의`);
    assert.notEqual(scheduleSrc.indexOf('function ' + fn), -1, `Schedule.gs에 ${fn} 없음`);
  });
});

test('미러: weekWindow 전수 일치', () => {
  CHALLENGES.forEach((c, ci) => {
    for (let w = 1; w <= 11; w += 1) {
      assert.deepEqual(gas.weekWindow_(c, w), weekWindow(c, w), `challenge ${ci} / week ${w}`);
    }
  });
});

test('미러: operationEndDate 전수 일치', () => {
  CHALLENGES.forEach((c, ci) => {
    MISSION_SETS.forEach((ms, mi) => {
      assert.equal(gas.operationEndDate_(c, ms), operationEndDate(c, ms), `challenge ${ci} / missions ${mi}`);
    });
  });
});

test('미러: planDailyRun 전수 일치 (캠페인 × 회차상태 × 날짜)', () => {
  CHALLENGES.forEach((c, ci) => {
    MISSION_SETS.forEach((ms, mi) => {
      DAYS.forEach((today) => {
        assert.deepEqual(
          gas.planDailyRun_(c, ms, today),
          planDailyRun(c, ms, today),
          `challenge ${ci} / missions ${mi} / ${today}`,
        );
      });
    });
  });
  assert.deepEqual(gas.planDailyRun_(null, [], '2026-02-02'), planDailyRun(null, [], '2026-02-02'));
});

test('미러: 자동화 진입조건이 저장값 비교로 되돌아가지 않았다', () => {
  assert.equal(/'진행중'/.test(autoSrc), false, "Automation.gs에 '진행중' 리터럴이 남아 있다");
  assert.equal(/'진행중'/.test(scheduleSrc), false, "Schedule.gs에 '진행중' 리터럴이 남아 있다");
  assert.match(scheduleSrc, /deriveStatus\(scheduleStatusInput_\(challenge, weekMissions\), today\) !== '운영중'/);
});

test('미러: closeWeek_가 Challenges의 status를 쓰지 않는다', () => {
  const closeWeek = autoSrc.slice(autoSrc.indexOf('function closeWeek_'));
  const body = closeWeek.slice(0, closeWeek.indexOf('\n}'));
  assert.equal(/AUTO_SHEETS\.challenges/.test(body), false, '완료 판정은 파생 계산 몫이다');
  assert.equal(/'종료'/.test(body), false);
});

test('미러: 오늘 날짜는 UTC ymd_가 아니라 KST statusTodayYmd_로 읽는다', () => {
  assert.equal(/ymd_\(new Date\(\)\)/.test(autoSrc), false, 'ymd_는 UTC 기준이라 KST 00~09시에 하루 밀린다');
  assert.match(autoSrc, /var today = statusTodayYmd_\(\);/);
});
