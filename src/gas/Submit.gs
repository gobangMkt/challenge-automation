/**
 * S4 주차 제출 — GAS 어댑터
 * action: submit / myStatus
 * 공유 헬퍼(getSheet_/rowsAsObjects_/json_/normalizePhone)는 Code.gs 재사용.
 * 순수 로직(currentOpenWeek/buildProgress/validatePostUrl)은
 * public/js/lib/submission.js 와 미러.
 */

var SUBMISSION_HEADERS = [
  'challengeId', 'phone', '회차', 'postUrl', '제출일시', '검수상태',
];
var WEEKMISSION_HEADERS = [
  'challengeId', '회차', '미션제목', '미션본문', 'articleName', 'articleUrl',
  '오픈일', '마감일', '상태',
];

// ---------- 순수 로직 (submission.js 미러) ----------
function currentOpenWeek_(weekMissions) {
  if (!weekMissions || !weekMissions.length) return null;
  var open = [];
  weekMissions.forEach(function (w) {
    if (w && String(w['상태']) === '오픈') {
      var n = parseInt(w['회차'], 10);
      if (!isNaN(n)) open.push(n);
    }
  });
  if (!open.length) return null;
  return Math.min.apply(null, open);
}

function buildProgress_(totalWeeks, submissions) {
  var subs = submissions || [];
  var byWeek = {};
  subs.forEach(function (s) {
    var n = parseInt(s && s['회차'], 10);
    if (!isNaN(n)) byWeek[n] = true;
  });
  return { done: Object.keys(byWeek).length, total: totalWeeks, byWeek: byWeek };
}

function validatePostUrl_(url) {
  if (url == null) return false;
  return /^https?:\/\/.+/.test(String(url).trim());
}

// ---------- 도메인 조회 ----------
function weekMissionsFor_(challengeId) {
  var sh = getSheet_('WeekMissions', WEEKMISSION_HEADERS);
  return rowsAsObjects_(sh).filter(function (r) {
    return String(r.challengeId) === String(challengeId);
  });
}

function selectedParticipant_(challengeId, phone) {
  var sh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var rows = rowsAsObjects_(sh);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.challengeId) === String(challengeId) && String(r.phone) === String(phone)) {
      return r;
    }
  }
  return null;
}

function totalWeeks_(challengeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.challenges);
  if (!sh) return 10;
  var c = rowsAsObjects_(sh).filter(function (r) {
    return String(r.challengeId) === String(challengeId);
  })[0];
  var n = c ? parseInt(c['총회차'], 10) : NaN;
  return isNaN(n) ? 10 : n;
}

// ---------- 액션: 제출 ----------
function submit_(body) {
  var challengeId = body.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });
  var phone = normalizePhone(body.phone);
  if (!phone) return json_({ ok: false, error: 'invalid_phone' });

  var p = selectedParticipant_(challengeId, phone);
  if (!p) return json_({ ok: false, error: 'not_found' });
  if (String(p.status) !== 'selected' && String(p.status) !== '선발') {
    return json_({ ok: false, error: 'not_selected' });
  }

  var allWeeks = weekMissionsFor_(challengeId);
  var requested = parseInt(body.week != null ? body.week : body.round, 10);
  var week;
  if (!isNaN(requested)) {
    var wm = allWeeks.filter(function (w) { return parseInt(w['회차'], 10) === requested; })[0];
    if (!wm) return json_({ ok: false, error: 'invalid_week' });
    if (String(wm['상태']) !== '오픈') return json_({ ok: false, error: 'week_not_open' });
    week = requested;
  } else {
    week = currentOpenWeek_(allWeeks);
    if (week == null) return json_({ ok: false, error: 'no_open_week' });
  }

  if (!validatePostUrl_(body.postUrl)) {
    return json_({ ok: false, error: 'invalid_url' });
  }

  var sh = getSheet_('Submissions', SUBMISSION_HEADERS);
  var existing = findSubmissionRow_(sh, challengeId, phone, week);
  var record = [
    challengeId, phone, week, String(body.postUrl).trim(), new Date(), '',
  ];
  if (existing > 0) {
    var prev = sh.getRange(existing, 1, 1, SUBMISSION_HEADERS.length).getValues()[0];
    record[5] = prev[5] || '';
    sh.getRange(existing, 1, 1, SUBMISSION_HEADERS.length).setValues([record]);
  } else {
    sh.appendRow(record);
  }
  return json_({ ok: true, week: week, updated: existing > 0 });
}

function findSubmissionRow_(sh, challengeId, phone, week) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId) &&
        String(values[i][1]) === String(phone) &&
        String(values[i][2]) === String(week)) {
      return i + 1;
    }
  }
  return -1;
}

// ---------- 액션: 본인 진행현황 ----------
function myStatus_(challengeId, phone, blogUrl) {
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });
  var norm = normalizePhone(phone);
  if (!norm) return json_({ ok: false, error: 'invalid_phone' });

  var p = selectedParticipant_(challengeId, norm);
  if (!p) return json_({ ok: false, error: 'not_found' });
  if (blogUrl) {
    var nb = String(blogUrl).trim().replace(/\/+$/, '').toLowerCase();
    var pb = String(p.blogUrl || '').trim().replace(/\/+$/, '').toLowerCase();
    if (nb && pb && nb !== pb) return json_({ ok: false, error: 'blog_mismatch' });
  }
  var selected = String(p.status) === 'selected' || String(p.status) === '선발';

  var weeks = weekMissionsFor_(challengeId);
  var openWeek = currentOpenWeek_(weeks);

  var subSh = getSheet_('Submissions', SUBMISSION_HEADERS);
  var mySubs = rowsAsObjects_(subSh).filter(function (r) {
    return String(r.challengeId) === String(challengeId) && String(r.phone) === String(norm);
  });

  var total = totalWeeks_(challengeId);
  var progress = buildProgress_(total, mySubs);

  var current = null;
  if (openWeek != null) {
    var wm = weeks.filter(function (w) {
      return String(w['회차']) === String(openWeek);
    })[0] || {};
    var sub = mySubs.filter(function (s) {
      return String(s['회차']) === String(openWeek);
    })[0];
    current = {
      week: openWeek,
      title: wm['미션제목'] || '',
      body: wm['미션본문'] || '',
      articleName: wm['articleName'] || '',
      articleUrl: wm['articleUrl'] || '',
      마감일: wm['마감일'] || '',
      submitted: !!sub,
      submittedUrl: sub ? (sub['postUrl'] || '') : '',
    };
  }

  var weekList = weeks.map(function (wm) {
    var wk = wm['회차'];
    var sub = mySubs.filter(function (s) { return String(s['회차']) === String(wk); })[0];
    return {
      week: parseInt(wk, 10) || wk,
      status: wm['상태'] || '',
      마감일: wm['마감일'] || '',
      오픈일: wm['오픈일'] || '',
      articleName: wm['articleName'] || '',
      articleUrl: wm['articleUrl'] || '',
      body: wm['미션본문'] || '',
      submitted: !!sub,
      submittedUrl: sub ? (sub['postUrl'] || '') : '',
    };
  }).sort(function (a, b) { return (parseInt(a.week, 10) || 0) - (parseInt(b.week, 10) || 0); });

  return json_({
    ok: true,
    name: p.name || '',
    selected: selected,
    progress: progress,
    current: current,
    weeks: weekList,
  });
}
