// 최초 1회 실행용. 에디터에서 setup() Run → 권한 승인 + 시트 6탭 생성 + 운영자 토큰 발급.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('이 스크립트가 스프레드시트에 바인딩되지 않음. 시트에서 확장프로그램>Apps Script로 열어야 함.');
  }
  getSheet_('Participants', PARTICIPANT_HEADERS);
  getSheet_('Challenges', CHALLENGE_HEADERS);
  getSheet_('WeekMissions', WEEKMISSION_HEADERS);
  getSheet_('Submissions', SUBMISSION_HEADERS);
  getSheet_('Wrapup', WRAPUP_HEADERS);
  getSheet_('NotifyLog', NOTIFYLOG_HEADERS);

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('OPERATOR_TOKEN');
  if (!token) {
    token = Utilities.getUuid();
    props.setProperty('OPERATOR_TOKEN', token);
  }
  var msg = 'SETUP OK · 시트 6탭 생성 · OPERATOR_TOKEN = ' + token;
  Logger.log(msg);
  return msg;
}

// ---------- 1회성: Challenges.status 값 정리 ----------
// 읽기 경로는 전부 normalizeStatus를 통과하므로 이 마이그레이션은 필수가 아니다.
// 시트를 직접 보는 운영자를 위해 옛 값(빈값/선발중/진행중/종료)을 새 체계로 맞춰줄 뿐이다.
// 변환 규칙은 Status.gs의 normalizeStatus 하나 — 여기에 매핑표를 따로 두지 않는다(드리프트의 시작).
//
// 실행 (Apps Script 편집기):
//   migrateStatus()      → dry-run. 무엇이 어떻게 바뀌는지 로그만, 시트는 안 건드린다.
//   migrateStatus(true)  → 실제 적용. status 열을 setValues 1회로 일괄 기록한다.
function migrateStatus(apply) {
  var mode = apply === true ? '[적용]' : '[dry-run]';
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Challenges');
  if (!sh) return migrateLog_('MIGRATE status ' + mode + ' — Challenges 시트가 없습니다.');

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return migrateLog_('MIGRATE status ' + mode + ' — 대상 행이 없습니다.');

  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var stC = header.indexOf('status');
  if (stC < 0) return migrateLog_('MIGRATE status ' + mode + ' — status 열이 없습니다.');
  var idC = header.indexOf('challengeId');

  var n = lastRow - 1;
  var range = sh.getRange(2, stC + 1, n, 1);
  var cur = range.getValues();
  var ids = idC >= 0 ? sh.getRange(2, idC + 1, n, 1).getValues() : null;

  var next = [];
  var lines = [];
  var changed = 0;
  for (var i = 0; i < n; i++) {
    var before = cur[i][0];
    var after = normalizeStatus(before);
    next.push([after]);
    var who = ids ? String(ids[i][0]) : '';
    var label = who || ('행 ' + (i + 2));
    if (String(before) !== after) {
      changed += 1;
      lines.push('  ' + label + ': "' + String(before) + '" → "' + after + '"');
    }
    // 파생값은 저장 대상이 아니다. normalizeStatus가 그대로 두는 값이라 마이그레이션으로 못 고친다.
    if (STORED_STATUS_VALUES.indexOf(after) === -1) {
      lines.push('  ' + label + ': 주의 — "' + after + '"는 저장 대상 상태가 아닙니다. 허브에서 상태를 직접 바꿔주세요.');
    }
  }

  var head = 'MIGRATE status ' + mode + ' — 대상 ' + n + '행 / 변경 ' + changed + '건';
  Logger.log(head);
  for (var j = 0; j < lines.length; j++) Logger.log(lines[j]);
  if (!changed) Logger.log('  바꿀 값이 없습니다.');

  if (apply !== true) {
    Logger.log('  (dry-run — 시트를 변경하지 않았습니다. 적용하려면 migrateStatus(true))');
    return head;
  }
  if (changed) range.setValues(next); // 행마다 setValue 금지 — 배치 1회
  Logger.log('  적용 완료.');
  return head;
}

function migrateLog_(msg) {
  Logger.log(msg);
  return msg;
}
