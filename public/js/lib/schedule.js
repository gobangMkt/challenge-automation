// 스케줄 순수로직 — Date.now 직접 호출 금지(테스트 위해 today를 주입받는다).
// 날짜는 'YYYY-MM-DD' 문자열로 다룬다(UTC 자정 기준, 타임존 흔들림 차단).

const DOW = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function toUTC(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY = 86400000;

function addDays(ymd, n) {
  return fromUTC(toUTC(ymd) + n * DAY);
}

// 시작일을 오픈요일에 맞춰 정렬한 1회차 오픈일을 구한다(시작일이 이미 오픈요일이면 그대로).
function firstOpen(challenge) {
  const start = String(challenge.startDate).slice(0, 10);
  const want = DOW[challenge.openDow];
  if (want == null) return start;
  const cur = new Date(toUTC(start)).getUTCDay();
  const delta = (want - cur + 7) % 7;
  return addDays(start, delta);
}

// n회차(1-base)의 오픈/마감 날짜. 마감 = closeDow 기준 또는 closeOffset(일수).
export function weekWindow(challenge, week) {
  const open = addDays(firstOpen(challenge), (week - 1) * 7);
  let close;
  if (challenge.closeDow && DOW[challenge.closeDow] != null) {
    const openDay = new Date(toUTC(open)).getUTCDay();
    const closeDay = DOW[challenge.closeDow];
    const delta = (closeDay - openDay + 7) % 7;
    close = addDays(open, delta === 0 ? 7 : delta);
  } else {
    const offset = Number(challenge.closeOffset);
    close = addDays(open, Number.isFinite(offset) ? offset : 6);
  }
  return { open, close };
}

function missionStatus(weekMissions, week) {
  const m = (weekMissions || []).find((x) => Number(x.week) === Number(week));
  return m ? String(m.status || '') : '대기';
}

// 오늘 할 일 판정. status가 진행중이 아니면 아무 것도 안 함.
export function planDailyRun(challenge, weekMissions, today) {
  const result = { openWeek: null, remindWeek: null, closeWeek: null };
  if (!challenge || String(challenge.status) !== '진행중') return result;

  const total = Number(challenge.totalWeeks) || 10;
  const t = toUTC(today);

  for (let w = 1; w <= total; w++) {
    const { open, close } = weekWindow(challenge, w);
    const openMs = toUTC(open);
    const closeMs = toUTC(close);
    const st = missionStatus(weekMissions, w);

    // 오픈: 오늘이 오픈일 당일 + 아직 대기
    if (t === openMs && st !== '오픈' && st !== '마감' && result.openWeek == null) {
      result.openWeek = w;
    }
    // 오픈 상태인 회차에 대해 리마인드/마감 판정
    if (st === '오픈') {
      if (t >= closeMs && result.closeWeek == null) {
        result.closeWeek = w;
      } else if (t === closeMs - DAY && result.remindWeek == null) {
        result.remindWeek = w;
      }
    }
  }
  return result;
}
