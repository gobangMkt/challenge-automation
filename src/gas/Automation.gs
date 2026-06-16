/**
 * S6 — 스케줄 자동화 + SOLAPI 알림톡 + 노션 아티클 read.
 * 순수로직 planDailyRun은 public/js/lib/schedule.js 미러(아래 인라인).
 * 공유 헬퍼(getSheet_/rowsAsObjects_/json_/operatorToken_/normalizePhone)는 Code.gs 재사용.
 *
 * 시트 헤더(표준=한글, spec.md / 소유 슬라이스 기준):
 *  WeekMissions: challengeId, 회차, 미션제목, 미션본문, articleName, articleUrl, 오픈일, 마감일, 상태
 *  NotifyLog:    challengeId, 회차, type, phone, 발송시각, 결과
 *  WEEKMISSION_HEADERS / NOTIFYLOG_HEADERS / findChallengeRow_ 는 공유 전역(Code/Setup/Submit/Select 정의) 재사용.
 * 시크릿(Script Properties): NOTION_TOKEN, SOLAPI_KEY/SECRET/SENDER, SOLAPI_TPL_OPEN/REMIND/SELECT/DONE
 */

var AUTO_SHEETS = {
  challenges: 'Challenges',
  weekMissions: 'WeekMissions',
  participants: 'Participants',
  submissions: 'Submissions',
  notifyLog: 'NotifyLog',
};
var TPL_PROP = {
  open: 'SOLAPI_TPL_OPEN',
  remind: 'SOLAPI_TPL_REMIND',
  select: 'SOLAPI_TPL_SELECT',
  done: 'SOLAPI_TPL_DONE',
};

// ---------- 순수 로직 (lib/schedule.js 미러) ----------
var DOW_ = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
var DAY_MS_ = 86400000;

function ymd_(d) {
  var y = d.getUTCFullYear();
  var m = ('0' + (d.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + d.getUTCDate()).slice(-2);
  return y + '-' + m + '-' + day;
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
function planDailyRun_(challenge, weekMissions, today) {
  var result = { openWeek: null, remindWeek: null, closeWeek: null };
  if (!challenge || String(challenge.status) !== '진행중') return result;
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

// ---------- 시트 접근 보조 ----------
function challengesRows_() {
  return rowsAsObjects_(getSheet_(AUTO_SHEETS.challenges, ['challengeId']));
}
function weekMissionRows_(challengeId) {
  var all = rowsAsObjects_(getSheet_(AUTO_SHEETS.weekMissions, WEEKMISSION_HEADERS));
  return all.filter(function (r) { return String(r.challengeId) === String(challengeId); });
}
function findWeekMissionRow_(sh, challengeId, week) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId) && Number(values[i][1]) === Number(week)) return i + 1;
  }
  return -1;
}
function selectedParticipants_(challengeId) {
  var all = rowsAsObjects_(getSheet_(AUTO_SHEETS.participants, ['challengeId', 'phone', 'name', 'status']));
  return all.filter(function (r) {
    return String(r.challengeId) === String(challengeId) &&
      (String(r.status) === 'selected' || String(r.status) === '선발');
  });
}
function submittedPhones_(challengeId, week) {
  var all = rowsAsObjects_(getSheet_(AUTO_SHEETS.submissions, SUBMISSION_HEADERS));
  var set = {};
  all.forEach(function (r) {
    if (String(r.challengeId) === String(challengeId) && Number(r['회차']) === Number(week)) {
      set[normalizePhone(r.phone) || String(r.phone)] = true;
    }
  });
  return set;
}

// ---------- 노션 아티클 read ----------
function notionArticles_(notionDbId, filterType) {
  var token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
  if (!token || !notionDbId) return [];
  var url = 'https://api.notion.com/v1/databases/' + notionDbId + '/query';
  var payload = {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 100,
  };
  if (filterType) {
    payload.filter = { property: 'type', multi_select: { contains: filterType } };
  }
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) return [];
  var data = JSON.parse(res.getContentText());
  return (data.results || []).map(function (pg) {
    var props = pg.properties || {};
    return {
      name: notionTitle_(props.Name),
      url: notionUrl_(props.URL),
      date: notionDate_(props.Date),
    };
  }).filter(function (a) { return a.name; });
}
function notionTitle_(p) {
  if (!p || !p.title || !p.title.length) return '';
  return p.title.map(function (t) { return t.plain_text || ''; }).join('');
}
function notionUrl_(p) {
  if (!p) return '';
  if (p.url) return p.url;
  if (p.rich_text && p.rich_text.length) return p.rich_text.map(function (t) { return t.plain_text; }).join('');
  return '';
}
function notionDate_(p) {
  if (p && p.date && p.date.start) return p.date.start;
  return '';
}

// 미배정(articleUrl 빈) 회차를 노션 최신순으로 채운다. 이미 쓴 아티클 url은 중복 제외.
function assignFallbackArticles_(challengeId) {
  var c = challengesRows_().filter(function (r) { return String(r.challengeId) === String(challengeId); })[0];
  if (!c) return 0;
  var articles = notionArticles_(c.notionDbId, c.notionFilterType || c.notionFilter || '혼잘주거');
  if (!articles.length) return 0;
  var sh = getSheet_(AUTO_SHEETS.weekMissions, WEEKMISSION_HEADERS);
  var rows = weekMissionRows_(challengeId);
  var used = {};
  rows.forEach(function (r) { if (r.articleUrl) used[String(r.articleUrl)] = true; });
  var pool = articles.filter(function (a) { return a.url && !used[String(a.url)]; });
  var pi = 0, filled = 0;
  rows.sort(function (a, b) { return Number(a['회차']) - Number(b['회차']); }).forEach(function (r) {
    if (r.articleUrl || pi >= pool.length) return;
    var a = pool[pi++];
    var rowIdx = findWeekMissionRow_(sh, challengeId, r['회차']);
    if (rowIdx > 0) {
      sh.getRange(rowIdx, 5).setValue(a.name); // articleName
      sh.getRange(rowIdx, 6).setValue(a.url);  // articleUrl
      filled++;
    }
  });
  return filled;
}

// ---------- SOLAPI 알림톡 ----------
function sendAlimtalk_(templateKind, phone, vars, meta) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SOLAPI_KEY');
  var secret = props.getProperty('SOLAPI_SECRET');
  var sender = props.getProperty('SOLAPI_SENDER');
  var tplId = props.getProperty(TPL_PROP[templateKind]);
  var to = normalizePhone(phone);
  var result;
  if (!key || !secret || !sender || !tplId || !to) {
    result = '실패:설정누락';
  } else {
    try {
      var date = new Date().toISOString();
      var salt = Utilities.getUuid().replace(/-/g, '');
      var sig = Utilities.computeHmacSha256Signature(date + salt, secret);
      var signature = sig.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
      var auth = 'HMAC-SHA256 apiKey=' + key + ', date=' + date + ', salt=' + salt + ', signature=' + signature;
      var body = {
        message: {
          to: to.replace(/-/g, ''),
          from: sender.replace(/-/g, ''),
          kakaoOptions: { pfId: props.getProperty('SOLAPI_PFID') || '', templateId: tplId, variables: vars || {} },
        },
      };
      var res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: auth },
        payload: JSON.stringify(body), muteHttpExceptions: true,
      });
      result = res.getResponseCode() < 300 ? '성공' : ('실패:' + res.getResponseCode());
    } catch (err) {
      result = '실패:' + err;
    }
  }
  logNotify_((meta && meta.challengeId) || '', (meta && meta.week) || '', templateKind, to || phone, result);
  return result;
}

function logNotify_(challengeId, week, type, phone, result) {
  var sh = getSheet_(AUTO_SHEETS.notifyLog, NOTIFYLOG_HEADERS);
  sh.appendRow([challengeId, week, type, phone, new Date(), result]);
}

// ---------- 시간트리거 핸들러 ----------
function dailyTrigger() {
  var today = ymd_(new Date());
  challengesRows_().forEach(function (c) {
    if (String(c.status) !== '진행중') return;
    var ch = {
      status: c.status, startDate: c.startDate || c['시작일'], openDow: c.openDow || c['오픈요일'],
      closeDow: c.closeDow || c['마감요일'], closeOffset: c.closeOffset || c['마감오프셋'],
      totalWeeks: c.totalWeeks || c['총회차'],
    };
    var missions = weekMissionRows_(c.challengeId);
    var plan = planDailyRun_(ch, missions, today);
    if (plan.openWeek) openWeek_(c, plan.openWeek);
    if (plan.remindWeek) remindWeek_(c, plan.remindWeek);
    if (plan.closeWeek) closeWeek_(c, plan.closeWeek);
  });
}

function openWeek_(c, week) {
  assignFallbackArticles_(c.challengeId);
  var sh = getSheet_(AUTO_SHEETS.weekMissions, WEEKMISSION_HEADERS);
  var rowIdx = findWeekMissionRow_(sh, c.challengeId, week);
  var win = weekWindow_({
    startDate: c.startDate || c['시작일'], openDow: c.openDow || c['오픈요일'],
    closeDow: c.closeDow || c['마감요일'], closeOffset: c.closeOffset || c['마감오프셋'],
  }, week);
  var mission = weekMissionRows_(c.challengeId).filter(function (m) { return Number(m['회차']) === Number(week); })[0] || {};
  if (rowIdx > 0) {
    sh.getRange(rowIdx, 7).setValue(win.open);
    sh.getRange(rowIdx, 8).setValue(win.close);
    sh.getRange(rowIdx, 9).setValue('오픈');
  }
  var link = submitLink_(c);
  selectedParticipants_(c.challengeId).forEach(function (p) {
    sendAlimtalk_('open', p.phone, {
      '#{name}': p.name || '', '#{week}': String(week),
      '#{title}': mission['미션제목'] || '', '#{article}': mission.articleUrl || '', '#{link}': link,
    }, { challengeId: c.challengeId, week: week });
  });
}

function remindWeek_(c, week) {
  var submitted = submittedPhones_(c.challengeId, week);
  var link = submitLink_(c);
  var mission = weekMissionRows_(c.challengeId).filter(function (m) { return Number(m['회차']) === Number(week); })[0] || {};
  selectedParticipants_(c.challengeId).forEach(function (p) {
    var norm = normalizePhone(p.phone) || String(p.phone);
    if (submitted[norm]) return;
    sendAlimtalk_('remind', p.phone, {
      '#{name}': p.name || '', '#{week}': String(week),
      '#{title}': mission['미션제목'] || '', '#{link}': link,
    }, { challengeId: c.challengeId, week: week });
  });
}

function closeWeek_(c, week) {
  var sh = getSheet_(AUTO_SHEETS.weekMissions, WEEKMISSION_HEADERS);
  var rowIdx = findWeekMissionRow_(sh, c.challengeId, week);
  if (rowIdx > 0) sh.getRange(rowIdx, 9).setValue('마감');
  var total = Number(c.totalWeeks || c['총회차']) || 10;
  if (Number(week) >= total) {
    var csh = getSheet_(AUTO_SHEETS.challenges, ['challengeId']);
    var cidx = findChallengeRow_(csh, c.challengeId);
    var statusCol = headerCol_(csh, 'status');
    if (cidx > 0 && statusCol > 0) csh.getRange(cidx, statusCol).setValue('종료');
    selectedParticipants_(c.challengeId).forEach(function (p) {
      sendAlimtalk_('done', p.phone, { '#{name}': p.name || '' }, { challengeId: c.challengeId, week: week });
    });
  }
}

// findChallengeRow_ 는 Setup.gs의 공유 전역 사용(중복 선언 제거).
function headerCol_(sh, name) {
  var headers = sh.getDataRange().getValues()[0] || [];
  for (var i = 0; i < headers.length; i++) if (String(headers[i]) === name) return i + 1;
  return -1;
}
function submitLink_(c) {
  var base = PropertiesService.getScriptProperties().getProperty('APP_BASE_URL') || '';
  // 쿼리(?c=)는 해시(#/submit) 앞에 와야 location.search에서 잡힌다.
  return base ? (base + '?c=' + encodeURIComponent(c.challengeId) + '#/submit') : '';
}

// ---------- 액션(doGet/doPost에서 분기 호출) ----------
function notifyLog_(p) {
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var all = rowsAsObjects_(getSheet_(AUTO_SHEETS.notifyLog, NOTIFYLOG_HEADERS));
  var rows = p.challengeId
    ? all.filter(function (r) { return String(r.challengeId) === String(p.challengeId); })
    : all;
  rows.reverse();
  return json_({ ok: true, rows: rows });
}

function resend_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var kind = body.type || 'open';
  if (!TPL_PROP[kind]) return json_({ ok: false, error: 'unknown_template' });
  var result = sendAlimtalk_(kind, body.phone, body.vars || {}, {
    challengeId: body.challengeId || '', week: body.week || '',
  });
  return json_({ ok: result === '성공', result: result });
}

// ---------- 액션: 주차 알림톡 일괄 발송 (선발자 전원, 날짜 변경 없음) ----------
function notifyWeek_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var cid = body.challengeId;
  var week = parseInt(body.round != null ? body.round : body.week, 10);
  if (!cid || isNaN(week)) return json_({ ok: false, error: 'bad_request' });
  var c = challengeById_(cid);
  if (!c) return json_({ ok: false, error: 'not_found' });
  var mission = weekMissionRows_(cid).filter(function (m) { return Number(m['회차']) === week; })[0] || {};
  var link = submitLink_(c);
  var sent = 0, fail = 0;
  selectedParticipants_(cid).forEach(function (p) {
    var r = sendAlimtalk_('open', p.phone, {
      '#{name}': p.name || '', '#{week}': String(week),
      '#{title}': mission['미션제목'] || '', '#{article}': mission.articleUrl || '', '#{link}': link,
    }, { challengeId: cid, week: week });
    if (r === '성공') sent += 1; else fail += 1;
  });
  return json_({ ok: true, sent: sent, fail: fail });
}
