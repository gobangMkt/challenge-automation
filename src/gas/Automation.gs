/**
 * S6 — 스케줄 자동화 + SOLAPI 알림톡 + 노션 아티클 read.
 * 순수로직(planDailyRun_/weekWindow_/operationEndDate_/scheduleChallengeInput_)은 Schedule.gs
 * (= public/js/lib/schedule.js 미러) 재사용 — 여기서 재구현 금지.
 * 공유 헬퍼(getSheet_/rowsAsObjects_/json_/operatorToken_/normalizePhone/missionsByChallenge_)는
 * Code.gs·Submit.gs 재사용.
 * 상태 판정(deriveStatus/normalizeStatus/lastDueDate/toYmd/statusTodayYmd_)은 Status.gs 재사용 —
 * 여기서 재구현 금지. 자동화 진입조건은 시트 저장값이 아니라 파생 상태 '운영중'이다.
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
  // 회차→행번호 인덱스를 루프 밖에서 1회만 만든다 (기존: 회차마다 시트 풀리드 = N+1)
  var values = sh.getDataRange().getValues();
  var rowByRound = {};
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== String(challengeId)) continue;
    var w = Number(values[i][1]);
    if (!isNaN(w) && rowByRound[w] == null) rowByRound[w] = i + 1; // 첫 매칭 행 = findWeekMissionRow_ 동작
  }
  var pending = {}; // 행번호 → [articleName, articleUrl]
  var pi = 0, filled = 0;
  rows.sort(function (a, b) { return Number(a['회차']) - Number(b['회차']); }).forEach(function (r) {
    if (r.articleUrl || pi >= pool.length) return;
    var a = pool[pi++];
    var rw = Number(r['회차']);
    var rowIdx = isNaN(rw) ? -1 : (rowByRound[rw] || -1);
    if (rowIdx > 0) { pending[rowIdx] = [a.name, a.url]; filled++; }
  });
  // articleName·articleUrl(5~6열) — 연속 행은 setValues 1회로 묶는다
  var targets = Object.keys(pending).map(Number).sort(function (x, y) { return x - y; });
  for (var t = 0; t < targets.length;) {
    var e = t;
    while (e + 1 < targets.length && targets[e + 1] === targets[e] + 1) e++;
    var block = [];
    for (var k = t; k <= e; k++) block.push(pending[targets[k]]);
    sh.getRange(targets[t], 5, block.length, 2).setValues(block);
    t = e + 1;
  }
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
  var today = statusTodayYmd_();
  var missionsById = missionsByChallenge_();
  challengesRows_().forEach(function (c) {
    var missions = missionsById[String(c.challengeId)] || [];
    var plan = planDailyRun_(scheduleChallengeInput_(c), missions, today);
    if (plan.openWeek) openWeek_(c, plan.openWeek);
    if (plan.remindWeek) remindWeek_(c, plan.remindWeek);
    if (plan.closeWeek) closeWeek_(c, plan.closeWeek);
  });
}

// ---------- 드라이런 (발송·시트쓰기 없음) ----------
// "오늘(또는 지정일) 트리거가 돌면 누구에게 무엇이 나가는가"를 계산만 해서 보여준다.
// Apps Script 편집기에서 dryRunDaily() 또는 dryRunDaily('2026-09-01') 실행 → 실행로그 확인.
// 배포 직후 자동화를 되살리기 전에 반드시 한 번 돌려볼 것.
function dryRunDaily(todayYmd) {
  var today = toYmd(todayYmd) || statusTodayYmd_();
  var missionsById = missionsByChallenge_();
  var out = [];
  challengesRows_().forEach(function (c) {
    var missions = missionsById[String(c.challengeId)] || [];
    var ch = scheduleChallengeInput_(c);
    var plan = planDailyRun_(ch, missions, today);
    var total = Number(ch.totalWeeks) || 10;
    var acts = [];
    if (plan.openWeek || plan.remindWeek || plan.closeWeek) {
      var selected = selectedParticipants_(c.challengeId).length;
      if (plan.openWeek) acts.push('오픈 ' + plan.openWeek + '회차 → open 알림톡 ' + selected + '명');
      if (plan.remindWeek) {
        var done = submittedPhones_(c.challengeId, plan.remindWeek);
        var left = selectedParticipants_(c.challengeId).filter(function (p) {
          return !done[normalizePhone(p.phone) || String(p.phone)];
        }).length;
        acts.push('리마인드 ' + plan.remindWeek + '회차 → remind 알림톡 ' + left + '명(미제출)');
      }
      if (plan.closeWeek) {
        acts.push('마감 ' + plan.closeWeek + '회차' +
          (Number(plan.closeWeek) >= total ? ' → done 알림톡 ' + selected + '명(최종회차)' : ' → 발송없음'));
      }
    }
    out.push({
      challengeId: c.challengeId,
      name: c.name || '',
      storedStatus: normalizeStatus(c.status),
      status: deriveStatus(scheduleStatusInput_(ch, missions), today),
      recruitEnd: toYmd(ch['모집마감']),
      operationEnd: operationEndDate_(ch, missions),
      actions: acts,
    });
  });
  Logger.log('[dryRunDaily] 기준일 ' + today + ' / 캠페인 ' + out.length + '건');
  out.forEach(function (r) {
    Logger.log([
      r.challengeId, r.name || '(무명)',
      '저장:' + r.storedStatus + ' → 파생:' + r.status,
      '모집마감 ' + (r.recruitEnd || '-'), '운영종료 ' + (r.operationEnd || '-'),
      r.actions.length ? r.actions.join(' / ') : '할 일 없음',
    ].join(' | '));
  });
  return out;
}

function openWeek_(c, week) {
  assignFallbackArticles_(c.challengeId);
  var sh = getSheet_(AUTO_SHEETS.weekMissions, WEEKMISSION_HEADERS);
  var rowIdx = findWeekMissionRow_(sh, c.challengeId, week);
  var win = weekWindow_(scheduleChallengeInput_(c), week);
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
  // WHY: 완료는 deriveStatus가 마지막 회차 마감일로 파생한다. 여기서 시트 status에 쓰면
  // 파생 규칙과 어긋나고(저장 불가값), 운영자가 재개해도 다음 마감에 다시 덮인다.
  if (Number(week) >= total) {
    selectedParticipants_(c.challengeId).forEach(function (p) {
      sendAlimtalk_('done', p.phone, { '#{name}': p.name || '' }, { challengeId: c.challengeId, week: week });
    });
  }
}

function submitLink_(c) {
  var base = PropertiesService.getScriptProperties().getProperty('APP_BASE_URL') || '';
  // 쿼리(?c=)는 해시 앞에 와야 location.search에서 잡힌다.
  return base ? (base + '?c=' + encodeURIComponent(c.challengeId) + '#submit') : '';
}
function wrapupLink_(c) {
  var base = PropertiesService.getScriptProperties().getProperty('APP_BASE_URL') || '';
  return base ? (base + '?c=' + encodeURIComponent(c.challengeId) + '#wrapup') : '';
}

// ---------- 액션: 리워드 신청(마무리 폼) 안내 일괄 발송 (선발자 전원) ----------
function notifyWrapup_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var cid = body.challengeId;
  if (!cid) return json_({ ok: false, error: 'bad_request' });
  var c = challengeById_(cid);
  if (!c) return json_({ ok: false, error: 'not_found' });
  var link = wrapupLink_(c);
  var sent = 0, fail = 0;
  selectedParticipants_(cid).forEach(function (p) {
    var r = sendAlimtalk_('done', p.phone, {
      '#{name}': p.name || '', '#{link}': link,
    }, { challengeId: cid, week: 'wrapup' });
    if (r === '성공') sent += 1; else fail += 1;
  });
  return json_({ ok: true, sent: sent, fail: fail });
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
