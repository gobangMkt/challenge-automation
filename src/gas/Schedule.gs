/**
 * 회차 일정·운영종료일·일일 자동화 계획 — public/js/lib/schedule.js 의 GAS 미러(ES모듈 문법만 제거).
 * 정본은 schedule.js 다. 여기를 먼저 고치지 말 것 — 드리프트는 tests/schedule-mirror.test.js가 잡는다.
 *
 * WHY 별도 파일: 운영종료일은 자동화 전용 값이 아니다. 허브 화면(AdminHub.gs)과 신청 게이팅(Code.gs)이
 * 자동화(Automation.gs)와 다른 종료일을 쓰면 "화면엔 완료, 자동화는 운영중"으로 갈린다.
 * Automation.gs 안에 두면 UI 어댑터가 자동화 어댑터를 호출하는 역방향 의존이 되므로 밖으로 뺐다.
 *
 * 이 파일은 시트·서비스 의존이 0이어야 한다(미러 테스트가 소스를 그대로 평가한다).
 * 상태 판정(deriveStatus/lastDueDate/toYmd)은 Status.gs 재사용 — 여기서 재구현 금지.
 */

var DOW_ = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
var DAY_MS_ = 86400000;

// UTC 자정 기준 날짜 산술 전용(addDaysYmd_ 왕복). 시계를 읽는 용도로 쓰지 말 것 —
// 오늘 날짜는 KST 고정 오프셋인 Status.gs의 statusTodayYmd_()가 정본이다.
function ymd_(d) {
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}
// slice(-2)가 아니라 길이 검사 — 잘못된 날짜에서 'NaN'이 'aN'으로 잘리면 lib과 미러가 깨진다.
function pad2_(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}
function toUtcMs_(ymd) {
  var p = String(ymd).slice(0, 10).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function addDaysYmd_(ymd, n) {
  return ymd_(new Date(toUtcMs_(ymd) + n * DAY_MS_));
}
function firstOpen_(challenge) {
  var start = String(challenge.startDate).slice(0, 10);
  var want = DOW_[challenge.openDow];
  if (want == null) return start;
  var cur = new Date(toUtcMs_(start)).getUTCDay();
  return addDaysYmd_(start, (want - cur + 7) % 7);
}
function weekWindow_(challenge, week) {
  var open = addDaysYmd_(firstOpen_(challenge), (week - 1) * 7);
  var close;
  if (challenge.closeDow && DOW_[challenge.closeDow] != null) {
    var openDay = new Date(toUtcMs_(open)).getUTCDay();
    var delta = (DOW_[challenge.closeDow] - openDay + 7) % 7;
    close = addDaysYmd_(open, delta === 0 ? 7 : delta);
  } else {
    var off = Number(challenge.closeOffset);
    close = addDaysYmd_(open, isFinite(off) ? off : 6);
  }
  return { open: open, close: close };
}
function missionStatus_(weekMissions, week) {
  for (var i = 0; i < weekMissions.length; i++) {
    if (Number(weekMissions[i]['회차']) === Number(week)) return String(weekMissions[i]['상태'] || '');
  }
  return '대기';
}
// 운영종료일 = 시트 마감일 최대값과 '일정상' 마지막 회차 마감일 중 늦은 쪽.
// WHY: WeekMissions의 마감일은 회차가 열릴 때 비로소 채워진다. 시트값만 쓰면 1회차가
// 닫히는 순간 운영종료일=1회차 마감이 되어 파생 상태가 완료로 떨어지고 2회차가 영영 안 열린다.
// 운영자가 마감일을 뒤로 늘린 경우(재개)는 시트값이 이긴다.
function operationEndDate_(challenge, weekMissions) {
  if (!challenge) return '';
  var total = Number(challenge.totalWeeks) || 10;
  var scheduled = toYmd(weekWindow_(challenge, total).close);
  var filled = lastDueDate(weekMissions);
  return filled > scheduled ? filled : scheduled;
}
function scheduleStatusInput_(challenge, weekMissions) {
  return {
    status: challenge.status,
    모집마감: challenge['모집마감'],
    recruitEnd: challenge.recruitEnd,
    lastDueDate: operationEndDate_(challenge, weekMissions),
  };
}
// 파생 상태가 운영중이 아니면 아무 것도 안 한다
// (준비·모집중은 아직, 완료는 이미 끝난 캠페인 — 알림톡이 나가면 사고다).
function planDailyRun_(challenge, weekMissions, today) {
  var result = { openWeek: null, remindWeek: null, closeWeek: null };
  if (!challenge) return result;
  if (deriveStatus(scheduleStatusInput_(challenge, weekMissions), today) !== '운영중') return result;
  var total = Number(challenge.totalWeeks) || 10;
  var t = toUtcMs_(today);
  for (var w = 1; w <= total; w++) {
    var win = weekWindow_(challenge, w);
    var openMs = toUtcMs_(win.open);
    var closeMs = toUtcMs_(win.close);
    var st = missionStatus_(weekMissions, w);
    if (t === openMs && st !== '오픈' && st !== '마감' && result.openWeek == null) result.openWeek = w;
    if (st === '오픈') {
      if (t >= closeMs && result.closeWeek == null) result.closeWeek = w;
      else if (t === closeMs - DAY_MS_ && result.remindWeek == null) result.remindWeek = w;
    }
  }
  return result;
}

// ---------- GAS 전용 (schedule.js에는 없음 — 미러 대상 아님) ----------
// Challenges 시트 행 → 순수로직 입력. 헤더 표기 차이 흡수 + 날짜 셀(Date)을 YYYY-MM-DD로 정규화.
function scheduleChallengeInput_(c) {
  var start = c.startDate || c['시작일'];
  return {
    status: c.status,
    모집마감: c['모집마감'] || c.recruitEnd,
    startDate: toYmd(start) || start,
    openDow: c.openDow || c['오픈요일'],
    closeDow: c.closeDow || c['마감요일'],
    closeOffset: c.closeOffset || c['마감오프셋'],
    totalWeeks: c.totalWeeks || c['총회차'],
  };
}

// 시트 행 + 그 캠페인의 회차 목록 → deriveStatus 입력.
// 화면(AdminHub)·신청 게이팅(Code)·자동화(Automation)가 같은 운영종료일을 보게 하는 단일 진입점.
// 여기 말고 다른 곳에서 lastDueDate만으로 입력을 만들면 화면과 자동화가 갈린다.
function statusInput_(ch, weekMissions) {
  return scheduleStatusInput_(scheduleChallengeInput_(ch || {}), weekMissions || []);
}
