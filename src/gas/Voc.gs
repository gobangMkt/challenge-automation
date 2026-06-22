/**
 * VoC 수집 어댑터. 순수 로직은 public/js/lib/voc.js 미러(ES import 불가라 인라인).
 * 시트 'VoC' 탭에 적재하고, voc-router 에이전트가 getVoc로 읽는다.
 */

var VOC_HEADERS = [
  'id', 'ts', 'project', 'category', 'channel', 'phone', 'message',
  'status', 'assignee', 'resolution', 'commit',
];

// ---------- 순수 로직 (voc.js 미러) ----------
function validateVoc_(input) {
  input = input || {};
  var errors = {};
  if (!input.project || !String(input.project).trim()) errors.project = 'project 필요';
  if (!input.message || !String(input.message).trim()) errors.message = '내용을 입력하세요.';
  return { ok: Object.keys(errors).length === 0, errors: errors };
}

function dedupKey_(rec) {
  return rec.project + '::' + String(rec.message).trim().toLowerCase();
}

function vocHash_(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

function buildVocRecord_(input, now) {
  var message = String(input.message).trim();
  var id = 'voc_' + now + '_' + Math.abs(vocHash_(dedupKey_({ project: input.project, message: message })));
  return {
    id: id,
    ts: new Date(now).toISOString(),
    project: input.project,
    category: input.category || '기타',
    channel: input.channel || 'app',
    phone: input.phone || '',
    message: message,
    status: 'new', assignee: '', resolution: '', commit: '',
  };
}

// 기존 VoC 시트가 옛 헤더(category 없음)로 만들어졌을 수 있어 매번 헤더를 동기화.
// 데이터 행이 없을 때만 안전하게 재작성한다.
function ensureVocHeader_(sh) {
  var lastCol = sh.getLastColumn();
  var cur = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (cur.join('') === VOC_HEADERS.join('')) return;
  if (sh.getLastRow() <= 1) {
    if (lastCol > VOC_HEADERS.length) sh.getRange(1, 1, 1, lastCol).clearContent();
    sh.getRange(1, 1, 1, VOC_HEADERS.length).setValues([VOC_HEADERS]);
  }
}

// ---------- 어댑터 ----------
function submitVoc_(body) {
  var v = validateVoc_(body);
  if (!v.ok) return json_({ ok: false, error: 'invalid', errors: v.errors });

  var sh = getSheet_('VoC', VOC_HEADERS);
  ensureVocHeader_(sh);
  var rec = buildVocRecord_(body, new Date().getTime());
  var key = dedupKey_(rec);

  var existing = rowsAsObjects_(sh).filter(function (r) {
    return dedupKey_(r) === key && String(r.status) !== 'committed';
  })[0];
  if (existing) return json_({ ok: true, id: existing.id, deduped: true });

  sh.appendRow(VOC_HEADERS.map(function (h) { return rec[h]; }));
  return json_({ ok: true, id: rec.id });
}

function getVoc_(p) {
  var sh = getSheet_('VoC', VOC_HEADERS);
  ensureVocHeader_(sh);
  var items = rowsAsObjects_(sh);
  if (p && p.status) {
    items = items.filter(function (r) { return String(r.status) === String(p.status); });
  }
  return json_({ ok: true, items: items });
}
