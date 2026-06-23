/**
 * VoC 수집 어댑터. 순수 로직은 public/js/lib/voc.js 미러(ES import 불가라 인라인).
 *
 * 저장소: 이 서비스의 바운드 시트가 아니라 **전 서비스 공통 중앙 통합 시트**.
 * Script Property `VOC_SHEET_ID`가 가리키며, 없으면 최초 1회 생성하고
 * 옛 바운드 'VoC' 탭의 데이터를 이관한 뒤 바운드 탭을 제거한다.
 * project 컬럼이 출처(서비스) 태그. voc-router가 getVoc로 전 서비스 VoC를 한곳에서 읽는다.
 * 다른 서비스도 자신의 GAS Script Property VOC_SHEET_ID에 같은 시트 ID를 넣으면 한곳에 모인다.
 */

// category는 맨 끝 — 기존 10컬럼 시트에 끝 컬럼만 추가하면 데이터 정렬이 안 깨진다.
var VOC_HEADERS = [
  'id', 'ts', 'project', 'channel', 'phone', 'message',
  'status', 'assignee', 'resolution', 'commit', 'category',
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

// 기존 VoC 시트가 옛 헤더(category 없음)로 만들어졌을 수 있어 헤더를 동기화.
// 현재 헤더가 VOC_HEADERS 앞부분과 같으면(끝 컬럼만 빠짐) 데이터가 있어도 안전하게 확장.
// 순서 자체가 다르면 손상 방지 위해 빈 시트일 때만 재작성.
function ensureVocHeader_(sh) {
  var lastCol = sh.getLastColumn();
  var cur = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (cur.join('') === VOC_HEADERS.join('')) return;
  var isPrefix = cur.length <= VOC_HEADERS.length &&
    cur.every(function (h, i) { return String(h) === VOC_HEADERS[i]; });
  if (isPrefix || sh.getLastRow() <= 1) {
    sh.getRange(1, 1, 1, VOC_HEADERS.length).setValues([VOC_HEADERS]);
  }
}

// 전 서비스 공통 중앙 VoC 시트(탭 'VoC'). VOC_SHEET_ID 없으면 최초 생성 + 바운드 이관.
function vocSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('VOC_SHEET_ID');
  if (id) {
    var ss = SpreadsheetApp.openById(id);
    var sh = ss.getSheetByName('VoC') || ss.insertSheet('VoC');
    ensureVocHeader_(sh);
    return sh;
  }
  var created = SpreadsheetApp.create('VoC 통합 인박스 — 전 서비스');
  props.setProperty('VOC_SHEET_ID', created.getId());
  var dst = created.getSheets()[0];
  dst.setName('VoC');
  dst.getRange(1, 1, 1, VOC_HEADERS.length).setValues([VOC_HEADERS]);
  migrateBoundVoc_(dst);
  return dst;
}

// 옛 바운드 'VoC' 탭 → 중앙 시트로 1회 이관 후 바운드 탭 제거(청소).
function migrateBoundVoc_(dst) {
  try {
    var bound = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VoC');
    if (!bound || bound.getLastRow() < 2) { if (bound) bound.getParent().deleteSheet(bound); return; }
    rowsAsObjects_(bound).forEach(function (r) {
      dst.appendRow(VOC_HEADERS.map(function (h) { return r[h] != null ? r[h] : ''; }));
    });
    bound.getParent().deleteSheet(bound);
  } catch (e) { /* 이관 실패해도 신규 수집은 계속 */ }
}

// ---------- 어댑터 ----------
function submitVoc_(body) {
  var v = validateVoc_(body);
  if (!v.ok) return json_({ ok: false, error: 'invalid', errors: v.errors });

  var sh = vocSheet_();
  var rec = buildVocRecord_(body, new Date().getTime());
  var key = dedupKey_(rec);

  var existing = rowsAsObjects_(sh).filter(function (r) {
    return dedupKey_(r) === key && String(r.status) !== 'committed';
  })[0];
  if (existing) return json_({ ok: true, id: existing.id, deduped: true });

  sh.appendRow(VOC_HEADERS.map(function (h) { return rec[h]; }));
  notifyTelegramVoc_(rec);
  return json_({ ok: true, id: rec.id });
}

function notifyTelegramVoc_(rec) {
  var props = PropertiesService.getScriptProperties();
  var botToken = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chatId = props.getProperty('TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) return;
  var text = '🚨 새 VoC 접수\n──────────────\n' +
    '카테고리: ' + (rec.category || '기타') + '\n' +
    '내용: ' + rec.message + '\n' +
    'ID: ' + rec.id + '\n──────────────\n' +
    '처리하려면: "처리" 또는 "' + rec.id + ' 처리"';
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* 알림 실패해도 VoC 저장은 완료 */ }
}

function getVoc_(p) {
  p = p || {};
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var sh = vocSheet_();
  var items = rowsAsObjects_(sh);
  if (p.status) {
    items = items.filter(function (r) { return String(r.status) === String(p.status); });
  }
  return json_({ ok: true, sheetUrl: sh.getParent().getUrl(), items: items });
}
