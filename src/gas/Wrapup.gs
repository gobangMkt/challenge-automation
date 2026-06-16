/**
 * S7 — 마무리 + 정산.
 * 액션:
 *  - wrapup  (POST): 참가자 마무리폼 저장 → Wrapup 시트
 *  - settlement (GET): 운영자 토큰 검증 후 참가자별 정산표 반환
 *
 * 헬퍼(getSheet_/rowsAsObjects_/json_/operatorToken_/normalizePhone)는 Code.gs 재사용.
 * 순수 로직(calcSettlement/toCsv)은 public/js/lib/settlement.js 와 미러. GAS는 import 불가라 인라인.
 */

var WRAPUP_SHEET = 'Wrapup';
// name은 기존 시트 호환 위해 맨 끝에 추가(앞 6열 위치 불변).
var WRAPUP_HEADERS = [
  'challengeId', 'phone', 'blogUrl', 'postCount', 'excellent', 'submittedAt', 'name',
];
var SUBMISSION_SHEET = 'Submissions';

// 기존 시트에 누락된 후행 헤더(name 등)를 보강 — 열 위치 정합 유지.
function ensureHeaders_(sh, headers) {
  var lastCol = sh.getLastColumn();
  var cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  for (var i = 0; i < headers.length; i++) {
    if (String(cur[i] || '') !== headers[i]) sh.getRange(1, i + 1).setValue(headers[i]);
  }
}

// ---------- 순수 로직 미러 (settlement.js) ----------
function phoneKey_(raw) {
  if (raw == null) return '';
  return String(raw).replace(/\D/g, '');
}

function calcSettlement_(participants, submissions, wrapups, policy) {
  participants = participants || [];
  submissions = submissions || [];
  wrapups = wrapups || [];
  policy = policy || {};
  var rewardPerPost = Number(policy.rewardPerPost) || 0;
  var excellentMultiplier = Number(policy.excellentMultiplier) || 2;

  var countByPhone = {};
  submissions.forEach(function (s) {
    var k = phoneKey_(s.phone);
    if (!k) return;
    countByPhone[k] = (countByPhone[k] || 0) + 1;
  });
  var excellentByPhone = {};
  wrapups.forEach(function (w) {
    var k = phoneKey_(w.phone);
    if (!k) return;
    excellentByPhone[k] = String(w.excellent == null ? '' : w.excellent).trim().toUpperCase() === 'Y';
  });

  return participants.map(function (p) {
    var k = phoneKey_(p.phone);
    var submitCount = countByPhone[k] || 0;
    var excellent = excellentByPhone[k] || false;
    var base = submitCount * rewardPerPost;
    var amount = excellent ? base * excellentMultiplier : base;
    return { phone: p.phone, name: p.name, submitCount: submitCount, excellent: excellent, amount: amount };
  });
}

// ---------- 액션 ----------
function wrapup_(body) {
  var challengeId = body.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });
  var phone = normalizePhone(body.phone);
  if (!phone) return json_({ ok: false, errors: { phone: '올바른 휴대폰 번호를 입력하세요.' } });

  var errors = {};
  var name = body.name ? String(body.name).trim() : '';
  if (!name) errors.name = '성함을 입력하세요.';
  var postCount = Number(body.postCount);
  if (!(postCount >= 0)) errors.postCount = '작성 갯수를 선택하세요.';
  var excellent = String(body.excellent || '').toUpperCase() === 'Y' ? 'Y' : 'N';
  if (body.excellent == null || String(body.excellent).trim() === '') {
    errors.excellent = '우수활동자 여부를 선택하세요.';
  }
  if (!body.agree) errors.agree = '개인정보 수집·이용에 동의해 주세요.';
  if (Object.keys(errors).length) return json_({ ok: false, errors: errors });

  var sh = getSheet_(WRAPUP_SHEET, WRAPUP_HEADERS);
  ensureHeaders_(sh, WRAPUP_HEADERS);
  var blogUrl = body.blogUrl ? String(body.blogUrl).trim() : '';
  var record = [challengeId, phone, blogUrl, postCount, excellent, new Date(), name];

  var existing = findWrapupRow_(sh, challengeId, phone);
  if (existing > 0) {
    sh.getRange(existing, 1, 1, WRAPUP_HEADERS.length).setValues([record]);
  } else {
    sh.appendRow(record);
  }
  return json_({ ok: true, phone: phone });
}

function settlement_(p) {
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var challengeId = p.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });

  var match = function (r) { return String(r.challengeId) === String(challengeId); };

  var pSh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var participants = rowsAsObjects_(pSh).filter(match).filter(function (r) {
    var st = String(r.status || '');
    return st !== 'dropped' && st !== '탈락' && st !== 'rejected';
  });

  var subSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBMISSION_SHEET);
  var submissions = subSh ? rowsAsObjects_(subSh).filter(match) : [];

  var wSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WRAPUP_SHEET);
  var wrapups = wSh ? rowsAsObjects_(wSh).filter(match) : [];

  var policy = settlementPolicy_(challengeId);
  var rows = calcSettlement_(participants, submissions, wrapups, policy);
  var total = rows.reduce(function (sum, r) { return sum + r.amount; }, 0);
  return json_({ ok: true, rows: rows, policy: policy, total: total });
}

function settlementPolicy_(challengeId) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.challenges);
  var policy = { rewardPerPost: 0, excellentMultiplier: 2 };
  if (!sh) return policy;
  var c = rowsAsObjects_(sh).filter(function (r) {
    return String(r.challengeId) === String(challengeId);
  })[0];
  if (!c) return policy;
  if (c.rewardPerPost !== '' && c.rewardPerPost != null) policy.rewardPerPost = Number(c.rewardPerPost) || 0;
  if (c.excellentMultiplier !== '' && c.excellentMultiplier != null) {
    policy.excellentMultiplier = Number(c.excellentMultiplier) || 2;
  }
  return policy;
}

function findWrapupRow_(sh, challengeId, phone) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId) && String(values[i][1]) === String(phone)) {
      return i + 1;
    }
  }
  return -1;
}
