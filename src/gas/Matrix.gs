/**
 * S5 운영 대시보드 — 제출현황 매트릭스.
 * action: matrix(challengeId, token)
 * Participants(선발/완주 등) × Submissions(회차별)를 읽어
 * buildMatrix 결과(rows/weekTotals/completionRate)를 반환.
 *
 * 배선: Code.gs doGet 에서 p.action === 'matrix' → matrix_(p) 분기 (메인 담당).
 * 헬퍼(getSheet_/rowsAsObjects_/json_/operatorToken_/normalizePhone)는 Code.gs 재사용.
 */

var MATRIX_SUBMISSION_HEADERS = [
  'challengeId', 'phone', '회차', 'postUrl', 'submittedAt', '검수상태',
];
var MATRIX_CHALLENGE_HEADERS = [
  'challengeId', 'name', 'status', '모집시작', '모집마감', '발표일', '시작일',
  '총회차', '오픈요일', '마감요일', '마감오프셋', 'rewardPerPost',
  'excellentMultiplier', 'notionDbId', 'notionFilterType', 'operatorToken',
  'openchatUrl',
];

function matrix_(p) {
  if (!p || p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var challengeId = p.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });

  var totalWeeks = matrixTotalWeeks_(challengeId);

  var partSh = getSheet_('Participants', [
    'challengeId', 'phone', 'name', 'blogUrl', 'agree', 'status', 'appliedAt', 'note',
  ]);
  var participants = rowsAsObjects_(partSh).filter(function (r) {
    return String(r.challengeId) === String(challengeId) && matrixIsActive_(r.status);
  });

  var subSh = getSheet_('Submissions', MATRIX_SUBMISSION_HEADERS);
  var submissions = rowsAsObjects_(subSh).filter(function (r) {
    return String(r.challengeId) === String(challengeId);
  });

  var m = matrixBuild_(participants, submissions, totalWeeks);
  return json_({ ok: true, totalWeeks: totalWeeks, matrix: m });
}

// 선발 이후 운영 대상만(신청만 한 사람 제외). status 비면 포함.
function matrixIsActive_(status) {
  var s = status == null ? '' : String(status).trim();
  if (!s) return true;
  return s !== '탈락' && s !== '신청' && s !== 'applied';
}

function matrixTotalWeeks_(challengeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Challenges');
  if (sh) {
    var c = rowsAsObjects_(sh).filter(function (r) {
      return String(r.challengeId) === String(challengeId);
    })[0];
    if (c && Number(c['총회차']) > 0) return Number(c['총회차']);
  }
  return 10;
}

// public/js/lib/matrix.js buildMatrix 미러 (GAS는 ES import 불가).
function matrixBuild_(participants, submissions, totalWeeks) {
  var weeks = Math.max(0, Number(totalWeeks) || 0);
  function key(raw) { return raw == null ? '' : String(raw).replace(/\D/g, ''); }

  var submitted = {};
  (submissions || []).forEach(function (s) {
    var k = key(s && s.phone);
    if (!k) return;
    var wk = Number(s && s['회차']);
    if (!(wk >= 1 && wk <= weeks) || Math.floor(wk) !== wk) return;
    if (!submitted[k]) submitted[k] = {};
    submitted[k][wk] = true;
  });

  var weekTotals = [];
  for (var i = 0; i < weeks; i++) weekTotals.push(0);

  var rows = (participants || []).map(function (pp) {
    var set = submitted[key(pp && pp.phone)] || {};
    var cells = [];
    var count = 0;
    for (var w = 1; w <= weeks; w++) {
      var has = !!set[w];
      cells.push(has);
      if (has) { weekTotals[w - 1] += 1; count += 1; }
    }
    return {
      phone: (pp && pp.phone) || '',
      name: (pp && pp.name) || '',
      cells: cells,
      submitted: count,
      done: weeks > 0 && count === weeks,
    };
  });

  var doneCount = rows.filter(function (r) { return r.done; }).length;
  var completionRate = rows.length ? doneCount / rows.length : 0;
  return { rows: rows, weekTotals: weekTotals, completionRate: completionRate };
}
