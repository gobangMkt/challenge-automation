/**
 * Admin Hub 확장 액션 — 캠페인(상세랜딩)·관리·운영(주차).
 * 공유 헬퍼/상수(getSheet_/rowsAsObjects_/json_/operatorToken_/normalizePhone/
 * SHEETS/PARTICIPANT_HEADERS/CHALLENGE_HEADERS/WEEKMISSION_HEADERS/SUBMISSION_HEADERS/
 * uniqueChallengeId_/challengeIdExists_/challengeRecord_/setupValidateSettings_/
 * setupToRounds_/saveMissions_/weekMissionsFor_/WEEKMISSIONS_SHEET) 는 기존 파일 재사용.
 * 라우터 배선은 Code.gs doPost/doGet에 추가.
 */

var CAMPAIGN_HEADERS = ['challengeId', 'detailJson', 'updatedAt'];

// ---------- 공용 조회 ----------
function challengeById_(challengeId) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.challenges);
  if (!sh) return null;
  return rowsAsObjects_(sh).filter(function (r) {
    return String(r.challengeId) === String(challengeId);
  })[0] || null;
}

function updateChallengeRow_(challengeId, body, totalRounds) {
  var sh = getSheet_(SHEETS.challenges, CHALLENGE_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId)) {
      sh.getRange(i + 1, 1, 1, CHALLENGE_HEADERS.length)
        .setValues([challengeRecord_(challengeId, body, totalRounds)]);
      return true;
    }
  }
  return false;
}

// ---------- 캠페인 상세(랜딩 JSON) ----------
function saveCampaignDetail_(challengeId, detail) {
  var sh = getSheet_('Campaigns', CAMPAIGN_HEADERS);
  var values = sh.getDataRange().getValues();
  var rec = [challengeId, JSON.stringify(detail || {}), new Date()];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId)) {
      sh.getRange(i + 1, 1, 1, CAMPAIGN_HEADERS.length).setValues([rec]);
      return;
    }
  }
  sh.appendRow(rec);
}

function campaignDetailObj_(challengeId) {
  var sh = getSheet_('Campaigns', CAMPAIGN_HEADERS);
  var row = rowsAsObjects_(sh).filter(function (r) {
    return String(r.challengeId) === String(challengeId);
  })[0];
  if (row && row.detailJson) {
    try { return JSON.parse(row.detailJson); } catch (e) { return {}; }
  }
  return {};
}

// ---------- 액션: 캠페인 생성/수정 (상세+미션 통합) ----------
function saveCampaign_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var v = setupValidateSettings_(body);
  if (!v.ok) return json_({ ok: false, errors: v.errors });

  var totalRounds = setupToRounds_(body.totalRounds);
  var challengeId = body.challengeId;
  var chSh = getSheet_(SHEETS.challenges, CHALLENGE_HEADERS);

  if (!challengeId || !challengeIdExists_(challengeId)) {
    challengeId = uniqueChallengeId_(body.name);
    chSh.appendRow(challengeRecord_(challengeId, body, totalRounds));
    var wm = getSheet_(WEEKMISSIONS_SHEET, WEEKMISSION_HEADERS);
    var rows = [];
    for (var i = 1; i <= totalRounds; i++) {
      rows.push([challengeId, i, '', '', '', '', '', '', '대기']);
    }
    if (rows.length) {
      wm.getRange(wm.getLastRow() + 1, 1, rows.length, WEEKMISSION_HEADERS.length).setValues(rows);
    }
  } else {
    updateChallengeRow_(challengeId, body, totalRounds);
  }

  if (Array.isArray(body.missions) && body.missions.length) {
    saveMissions_({
      token: body.token, challengeId: challengeId,
      totalRounds: totalRounds, missions: body.missions,
    });
  }
  saveCampaignDetail_(challengeId, body.detail || {});
  return json_({ ok: true, challengeId: challengeId, totalRounds: totalRounds });
}

// ---------- 액션: 캠페인 삭제 (관련 전 시트 행 제거) ----------
function deleteCampaign_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var cid = body.challengeId;
  if (!cid) return json_({ ok: false, error: 'challenge_required' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ['Challenges', 'Participants', 'Submissions', 'WeekMissions', 'Wrapup', 'NotifyLog', 'Campaigns'];
  var removed = 0;
  names.forEach(function (nm) {
    var sh = ss.getSheetByName(nm);
    if (!sh) return;
    var values = sh.getDataRange().getValues();
    for (var i = values.length - 1; i >= 1; i--) {
      if (String(values[i][0]) === String(cid)) { sh.deleteRow(i + 1); removed += 1; }
    }
  });
  return json_({ ok: true, removed: removed });
}

// ---------- 액션: 캠페인 목록 (허브) ----------
function campaigns_(p) {
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var chs = rowsAsObjects_(getSheet_(SHEETS.challenges, CHALLENGE_HEADERS));
  var parts = rowsAsObjects_(getSheet_(SHEETS.participants, PARTICIPANT_HEADERS));
  var subs = rowsAsObjects_(getSheet_('Submissions', SUBMISSION_HEADERS));
  var list = chs.map(function (c) {
    var cid = String(c.challengeId);
    var applied = 0, selected = 0;
    parts.forEach(function (r) {
      if (String(r.challengeId) !== cid) return;
      applied += 1;
      if (String(r.status) === 'selected' || String(r.status) === '선발') selected += 1;
    });
    var subCount = subs.filter(function (s) { return String(s.challengeId) === cid; }).length;
    return {
      challengeId: c.challengeId, name: c.name, status: c.status,
      totalRounds: c['총회차'], rewardPerPost: c.rewardPerPost, openchatUrl: c.openchatUrl,
      applied: applied, selected: selected, submissions: subCount,
    };
  });
  return json_({ ok: true, rows: list });
}

// ---------- 액션: 캠페인 상세 (공개 — 랜딩용, 토큰 불필요) ----------
function campaignDetail_(p) {
  var challengeId = p.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });
  var ch = challengeById_(challengeId);
  if (!ch) return json_({ ok: false, error: 'not_found' });
  return json_({
    ok: true,
    challenge: {
      challengeId: ch.challengeId, name: ch.name, status: ch.status,
      totalRounds: ch['총회차'], rewardPerPost: ch.rewardPerPost, openchatUrl: ch.openchatUrl,
      모집시작: fmtDate_(ch['모집시작']), 모집마감: fmtDate_(ch['모집마감']),
      발표일: fmtDate_(ch['발표일']), 시작일: fmtDate_(ch['시작일']),
    },
    detail: campaignDetailObj_(challengeId),
  });
}

function fmtDate_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  return String(v);
}

// ---------- 액션: 우수선정자 토글 ----------
function setExcellent_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var sh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var values = sh.getDataRange().getValues();
  var h = values[0];
  var idC = h.indexOf('challengeId'), phC = h.indexOf('phone'), nC = h.indexOf('note');
  var phone = normalizePhone(body.phone) || String(body.phone);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idC]) === String(body.challengeId) && String(values[i][phC]) === String(phone)) {
      var note = String(values[i][nC] || '');
      var has = note.indexOf('excellent') >= 0;
      var want = (body.excellent === undefined) ? !has : !!body.excellent;
      var newNote = want
        ? (has ? note : (note ? note + ';excellent' : 'excellent'))
        : note.replace(/;?excellent/g, '');
      sh.getRange(i + 1, nC + 1).setValue(newNote);
      return json_({ ok: true, excellent: want });
    }
  }
  return json_({ ok: false, error: 'not_found' });
}

// ---------- 액션: 주차 미션 목록 (운영) ----------
function missions_(p) {
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!p.challengeId) return json_({ ok: false, error: 'challenge_required' });
  var wm = weekMissionsFor_(p.challengeId).sort(function (a, b) {
    return (parseInt(a['회차'], 10) || 0) - (parseInt(b['회차'], 10) || 0);
  });
  return json_({ ok: true, rows: wm });
}

// ---------- 액션: 주차 오픈/마감/대기 (운영 — 주단위 페이지 생성) ----------
// 주의: Automation.gs에 동명 openWeek_(c,week)가 있어 hub 접두사로 분리.
function hubOpenWeek_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!body.challengeId) return json_({ ok: false, error: 'challenge_required' });
  var round = parseInt(body.round, 10);
  var status = body.status;
  if (['오픈', '마감', '대기'].indexOf(status) === -1) return json_({ ok: false, error: 'bad_status' });
  var sh = getSheet_(WEEKMISSIONS_SHEET, WEEKMISSION_HEADERS);
  var values = sh.getDataRange().getValues();
  var h = values[0];
  var idC = h.indexOf('challengeId'), rC = h.indexOf('회차'),
    stC = h.indexOf('상태'), opC = h.indexOf('오픈일');
  var changed = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idC]) === String(body.challengeId) && parseInt(values[i][rC], 10) === round) {
      sh.getRange(i + 1, stC + 1).setValue(status);
      if (status === '오픈' && !values[i][opC]) sh.getRange(i + 1, opC + 1).setValue(new Date());
      changed += 1;
    }
  }
  return json_({ ok: true, changed: changed, round: round, status: status });
}

// ---------- 액션: 단일 회차 미션 저장 (운영 — 발송 전 입력) ----------
function saveMission_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!body.challengeId) return json_({ ok: false, error: 'challenge_required' });
  var round = parseInt(body.round, 10);
  var sh = getSheet_(WEEKMISSIONS_SHEET, WEEKMISSION_HEADERS);
  var values = sh.getDataRange().getValues();
  var h = values[0];
  var idC = h.indexOf('challengeId'), rC = h.indexOf('회차'),
    tC = h.indexOf('미션제목'), bC = h.indexOf('미션본문'),
    anC = h.indexOf('articleName'), auC = h.indexOf('articleUrl');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idC]) === String(body.challengeId) && parseInt(values[i][rC], 10) === round) {
      if (body.title != null) sh.getRange(i + 1, tC + 1).setValue(String(body.title));
      if (body.body != null) sh.getRange(i + 1, bC + 1).setValue(String(body.body));
      var articleName = null;
      if (body.articleUrl != null) {
        var url = String(body.articleUrl).trim();
        sh.getRange(i + 1, auC + 1).setValue(url);
        // 아티클명은 URL에서 자동 추출 (og:title > <title>)
        articleName = url ? fetchPageTitle_(url) : '';
        if (articleName) sh.getRange(i + 1, anC + 1).setValue(articleName);
      }
      return json_({ ok: true, round: round, articleName: articleName || '' });
    }
  }
  return json_({ ok: false, error: 'not_found' });
}

// ---------- 액션: 캠페인 전역 보조필드 저장 (운영 — 교육자료·유의사항) ----------
function saveCampaignMeta_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!body.challengeId) return json_({ ok: false, error: 'challenge_required' });
  var d = campaignDetailObj_(body.challengeId) || {};
  var eduName = null;
  if (body.eduUrl != null) {
    d.eduUrl = String(body.eduUrl).trim();
    eduName = d.eduUrl ? fetchPageTitle_(d.eduUrl) : '';
    d.eduName = eduName || d.eduName || '';
  }
  if (body.guide != null) d.guide = String(body.guide);
  if (body.notice != null) d.notice = String(body.notice);
  saveCampaignDetail_(body.challengeId, d);
  return json_({ ok: true, eduName: d.eduName || '' });
}

// URL 페이지 제목 추출 (서버 측 fetch, CORS 무관)
function fetchPageTitle_(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return '';
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.getResponseCode() >= 400) return '';
    var html = res.getContentText();
    var m = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
      || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!m) return '';
    return m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, 120);
  } catch (e) { return ''; }
}

// ---------- 액션: 그 주 제출현황 (운영 — 검수 대상) ----------
function weekSubmissions_(p) {
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!p.challengeId) return json_({ ok: false, error: 'challenge_required' });
  var round = parseInt(p.round, 10);
  var subs = rowsAsObjects_(getSheet_('Submissions', SUBMISSION_HEADERS)).filter(function (s) {
    return String(s.challengeId) === String(p.challengeId) && parseInt(s['회차'], 10) === round;
  });
  var parts = rowsAsObjects_(getSheet_(SHEETS.participants, PARTICIPANT_HEADERS));
  var byPhone = {};
  parts.forEach(function (r) {
    if (String(r.challengeId) === String(p.challengeId)) byPhone[String(r.phone)] = r;
  });
  var submitted = subs.map(function (s) {
    var pp = byPhone[String(s.phone)] || {};
    return {
      phone: s.phone, name: pp.name || '', blogUrl: pp.blogUrl || '',
      postUrl: s.postUrl, 제출일시: fmtDate_(s['제출일시']), 검수상태: s['검수상태'] || '',
      excellent: String(pp.note || '').indexOf('excellent') >= 0,
    };
  });
  var done = {};
  subs.forEach(function (s) { done[String(s.phone)] = true; });
  var missing = parts.filter(function (r) {
    return String(r.challengeId) === String(p.challengeId) &&
      (String(r.status) === 'selected' || String(r.status) === '선발') && !done[String(r.phone)];
  }).map(function (r) {
    return { phone: r.phone, name: r.name, blogUrl: r.blogUrl, excellent: String(r.note || '').indexOf('excellent') >= 0 };
  });
  return json_({ ok: true, submitted: submitted, missing: missing, round: round });
}

// ---------- 액션: 제출 검수 (승인/반려) ----------
function reviewSubmission_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var sh = getSheet_('Submissions', SUBMISSION_HEADERS);
  var values = sh.getDataRange().getValues();
  var h = values[0];
  var idC = h.indexOf('challengeId'), phC = h.indexOf('phone'),
    rC = h.indexOf('회차'), stC = h.indexOf('검수상태');
  var round = parseInt(body.round, 10);
  var phone = normalizePhone(body.phone) || String(body.phone);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idC]) === String(body.challengeId) &&
      String(values[i][phC]) === String(phone) && parseInt(values[i][rC], 10) === round) {
      sh.getRange(i + 1, stC + 1).setValue(body.status || '승인');
      return json_({ ok: true, status: body.status || '승인' });
    }
  }
  return json_({ ok: false, error: 'not_found' });
}
