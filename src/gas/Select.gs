/**
 * S3 선발 — 운영자가 신청자(applied)를 selected/rejected로 전환.
 * 순수 로직(validateSelection/applySelection)은 public/js/lib/select.js 미러.
 * 공유 헬퍼(getSheet_/rowsAsObjects_/json_/operatorToken_/normalizePhone) 재사용.
 * 분기 배선은 메인이 Code.gs doPost에 select 추가.
 */

var SELECT_DECISIONS = ['selected', 'rejected'];
var NOTIFYLOG_SHEET = 'NotifyLog';
var NOTIFYLOG_HEADERS = [
  'challengeId', '회차', 'type', 'phone', '발송시각', '결과',
];

// ---------- 순수 로직 (lib/select.js 미러) ----------
function validateSelection_(input, ctx) {
  input = input || {};
  ctx = ctx || {};
  var errors = {};
  var phones = Array.isArray(input.phones) ? input.phones : [];
  if (!phones.length) errors.phones = '대상 신청자를 선택하세요.';
  if (SELECT_DECISIONS.indexOf(input.decision) === -1) {
    errors.decision = '선발/탈락 결정이 올바르지 않습니다.';
  }
  if (ctx.afterAnnounce === true) errors.announce = '발표일이 지나 선발을 변경할 수 없습니다.';
  return { ok: Object.keys(errors).length === 0, errors: errors };
}

// ---------- 액션 핸들러 (doPost에서 호출) ----------
function select_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var challengeId = body.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });

  var phones = (Array.isArray(body.phones) ? body.phones : [])
    .map(function (p) { return normalizePhone(p) || String(p); });
  // 기본 전체 선발 모델: 발표일 이후에도 운영자가 상시 탈락/선발 변경 가능(잠금 해제)
  var v = validateSelection_(
    { phones: phones, decision: body.decision },
    { afterAnnounce: false },
  );
  if (!v.ok) return json_({ ok: false, errors: v.errors });

  var sh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var phoneCol = headers.indexOf('phone');
  var statusCol = headers.indexOf('status');
  var idCol = headers.indexOf('challengeId');
  var target = {};
  phones.forEach(function (p) { target[p] = true; });

  var changed = 0;
  var selectedPhones = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[idCol]) !== String(challengeId)) continue;
    var ph = String(row[phoneCol]);
    if (!target[ph]) continue;
    // applied 신청자만 전환 (이미 결과 상태면 건너뜀)
    if (String(row[statusCol]) === body.decision) continue;
    sh.getRange(i + 1, statusCol + 1).setValue(body.decision);
    changed += 1;
    if (body.decision === 'selected') selectedPhones.push(ph);
  }

  // S6 알림톡 연동 전 — NotifyLog에 stub 기록만(type=select).
  if (selectedPhones.length) logSelectStub_(challengeId, selectedPhones);

  return json_({ ok: true, changed: changed, decision: body.decision });
}

function logSelectStub_(challengeId, phones) {
  var sh = getSheet_(NOTIFYLOG_SHEET, NOTIFYLOG_HEADERS);
  var now = new Date();
  var rows = phones.map(function (p) {
    return [challengeId, '', 'select', p, now, 'stub(미발송 — S6 연동 전)'];
  });
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIFYLOG_HEADERS.length).setValues(rows);
  }
}

function isAfterAnnounce_(challengeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.challenges);
  if (!sh) return false;
  var all = rowsAsObjects_(sh);
  var c = all.filter(function (r) { return String(r.challengeId) === String(challengeId); })[0];
  if (!c) return false;
  var raw = c['발표일'];
  if (!raw) return false;
  var d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return false;
  // 발표일 당일 자정 이후(다음날)부터 변경 잠금.
  var lock = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return new Date() >= lock;
}
