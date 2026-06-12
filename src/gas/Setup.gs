/**
 * S2 챌린지 생성·설정 — GAS 액션
 * action: createChallenge / saveSettings / saveMissions
 * doPost/doGet 분기는 Code.gs(메인)에서 배선. 헬퍼(getSheet_/rowsAsObjects_/json_/
 * operatorToken_)는 Code.gs 전역 재사용 — 여기서 재정의 금지.
 * 순수 로직은 public/js/lib/setup.js 미러.
 */

var CHALLENGE_HEADERS = [
  'challengeId', 'name', 'status',
  '모집시작', '모집마감', '발표일', '시작일',
  '총회차', '오픈요일', '마감요일', '마감오프셋',
  'rewardPerPost', 'excellentMultiplier',
  'notionDbId', 'notionFilterType', 'operatorToken', 'openchatUrl',
];
var WEEKMISSION_HEADERS = [
  'challengeId', '회차', '미션제목', '미션본문',
  'articleName', 'articleUrl', '오픈일', '마감일', '상태',
];
var SETUP_STATUS_VALUES_GAS = ['모집중', '선발중', '진행중', '종료'];
var SETUP_DEFAULT_ROUNDS = 10;
// SHEETS(Code.gs)에 weekMissions 키가 없을 수 있어 슬라이스 로컬로 시트명 고정.
var WEEKMISSIONS_SHEET = 'WeekMissions';

// ---------- 순수 로직 미러 (lib/setup.js) ----------
function setupSlugify_(raw, suffix) {
  var base = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  var core = base || ('challenge-' + Date.now().toString(36));
  return suffix ? (core + '-' + suffix) : core;
}

function setupToRounds_(n) {
  var r = Math.floor(Number(n));
  return (isFinite(r) && r >= 1) ? r : SETUP_DEFAULT_ROUNDS;
}

function setupValidateSettings_(input) {
  input = input || {};
  var errors = {};
  if (!input.name || !String(input.name).trim()) errors.name = '챌린지명을 입력하세요.';
  var rounds = Math.floor(Number(input.totalRounds));
  if (!isFinite(rounds) || rounds < 1) errors.totalRounds = '총회차는 1 이상이어야 합니다.';
  if (input.rewardPerPost != null && String(input.rewardPerPost) !== '') {
    var reward = Number(input.rewardPerPost);
    if (!isFinite(reward) || reward < 0) errors.rewardPerPost = '활동비는 0 이상이어야 합니다.';
  }
  if (input.excellentMultiplier != null && String(input.excellentMultiplier) !== '') {
    var mult = Number(input.excellentMultiplier);
    if (!isFinite(mult) || mult < 1) errors.excellentMultiplier = '우수 배수는 1 이상이어야 합니다.';
  }
  if (input.status != null && String(input.status) !== '' &&
      SETUP_STATUS_VALUES_GAS.indexOf(String(input.status)) === -1) {
    errors.status = '상태 값이 올바르지 않습니다.';
  }
  var ok = true;
  for (var k in errors) { if (errors.hasOwnProperty(k)) { ok = false; break; } }
  return { ok: ok, errors: errors };
}

// ---------- 시트 조회 헬퍼 ----------
function findChallengeRow_(sh, challengeId) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId)) return i + 1; // 1-based
  }
  return -1;
}

function challengeIdExists_(challengeId) {
  var sh = getSheet_(SHEETS.challenges, CHALLENGE_HEADERS);
  return findChallengeRow_(sh, challengeId) > 0;
}

function uniqueChallengeId_(name) {
  var id = setupSlugify_(name);
  if (!challengeIdExists_(id)) return id;
  for (var i = 2; i < 1000; i++) {
    var cand = setupSlugify_(name, String(i));
    if (!challengeIdExists_(cand)) return cand;
  }
  return setupSlugify_(name, Date.now().toString(36));
}

// ---------- 액션: createChallenge ----------
function createChallenge_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var v = setupValidateSettings_(body);
  if (!v.ok) return json_({ ok: false, errors: v.errors });

  var challengeId = uniqueChallengeId_(body.name);
  var totalRounds = setupToRounds_(body.totalRounds);
  var sh = getSheet_(SHEETS.challenges, CHALLENGE_HEADERS);
  var record = challengeRecord_(challengeId, body, totalRounds);
  sh.appendRow(record);

  // 총회차 수만큼 WeekMissions 빈 행 생성
  var wm = getSheet_(WEEKMISSIONS_SHEET, WEEKMISSION_HEADERS);
  var rows = [];
  for (var i = 1; i <= totalRounds; i++) {
    rows.push([challengeId, i, '', '', '', '', '', '', '대기']);
  }
  if (rows.length) {
    wm.getRange(wm.getLastRow() + 1, 1, rows.length, WEEKMISSION_HEADERS.length).setValues(rows);
  }
  return json_({ ok: true, challengeId: challengeId, totalRounds: totalRounds });
}

function challengeRecord_(challengeId, body, totalRounds) {
  return [
    challengeId,
    String(body.name).trim(),
    body.status && SETUP_STATUS_VALUES_GAS.indexOf(String(body.status)) !== -1
      ? String(body.status) : '모집중',
    body.모집시작 || body.recruitStart || '',
    body.모집마감 || body.recruitEnd || '',
    body.발표일 || body.announceDate || '',
    body.시작일 || body.startDate || '',
    totalRounds,
    body.오픈요일 || body.openWeekday || '',
    body.마감요일 || body.dueWeekday || '',
    body.마감오프셋 || body.dueOffset || '',
    body.rewardPerPost === '' || body.rewardPerPost == null ? '' : Number(body.rewardPerPost),
    body.excellentMultiplier === '' || body.excellentMultiplier == null ? 2 : Number(body.excellentMultiplier),
    body.notionDbId || '',
    body.notionFilterType || '',
    operatorToken_(),
    body.openchatUrl || '',
  ];
}

// ---------- 액션: saveSettings ----------
function saveSettings_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!body.challengeId) return json_({ ok: false, error: 'challenge_required' });
  var v = setupValidateSettings_(body);
  if (!v.ok) return json_({ ok: false, errors: v.errors });

  var sh = getSheet_(SHEETS.challenges, CHALLENGE_HEADERS);
  var rowIdx = findChallengeRow_(sh, body.challengeId);
  if (rowIdx < 0) return json_({ ok: false, error: 'not_found' });

  var totalRounds = setupToRounds_(body.totalRounds);
  var record = challengeRecord_(body.challengeId, body, totalRounds);
  sh.getRange(rowIdx, 1, 1, CHALLENGE_HEADERS.length).setValues([record]);
  return json_({ ok: true, challengeId: body.challengeId, totalRounds: totalRounds });
}

// ---------- 액션: saveMissions ----------
function saveMissions_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  if (!body.challengeId) return json_({ ok: false, error: 'challenge_required' });
  if (!challengeIdExists_(body.challengeId)) return json_({ ok: false, error: 'not_found' });

  var totalRounds = setupToRounds_(body.totalRounds);
  var input = Array.isArray(body.missions) ? body.missions : [];
  // 회차→입력 맵
  var byRound = {};
  for (var i = 0; i < input.length; i++) {
    var m = input[i] || {};
    var round = Number(m.round) >= 1 ? Math.floor(Number(m.round)) : (i + 1);
    if (round >= 1 && round <= totalRounds) byRound[round] = m;
  }

  var wm = getSheet_(WEEKMISSIONS_SHEET, WEEKMISSION_HEADERS);
  var existing = wm.getDataRange().getValues(); // [0]=header
  // 챌린지의 기존 회차 행 인덱스(1-based) 맵
  var rowByRound = {};
  for (var r = 1; r < existing.length; r++) {
    if (String(existing[r][0]) === String(body.challengeId)) {
      rowByRound[Number(existing[r][1])] = r + 1;
    }
  }

  var appended = [];
  for (var round = 1; round <= totalRounds; round++) {
    var src = byRound[round] || {};
    var title = src.title != null ? String(src.title) : '';
    var bodyText = src.body != null ? String(src.body) : '';
    var articleName = src.articleName != null ? String(src.articleName) : '';
    var articleUrl = src.articleUrl != null ? String(src.articleUrl) : '';
    var existRow = rowByRound[round];
    if (existRow) {
      // 미션 4필드만 갱신, 오픈일/마감일/상태는 보존
      wm.getRange(existRow, 3, 1, 4).setValues([[title, bodyText, articleName, articleUrl]]);
    } else {
      appended.push([body.challengeId, round, title, bodyText, articleName, articleUrl, '', '', '대기']);
    }
  }
  if (appended.length) {
    wm.getRange(wm.getLastRow() + 1, 1, appended.length, WEEKMISSION_HEADERS.length).setValues(appended);
  }
  return json_({ ok: true, challengeId: body.challengeId, rounds: totalRounds });
}
