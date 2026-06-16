/**
 * 블로그 챌린지 앱 — GAS 백엔드 (Web App)
 * 순수 로직(normalizePhone/validateApplication/upsertParticipant)은
 * public/js/lib/application.js 와 동기화 유지. GAS는 ES모듈 import 불가라 여기 인라인.
 *
 * 배포: 게시 > 웹 앱 > 실행=나, 액세스=모든 사용자.
 * 시크릿: Script Properties (OPERATOR_TOKEN 등). 코드/시트에 값 금지.
 */

var SHEETS = {
  participants: 'Participants',
  challenges: 'Challenges',
};
var PARTICIPANT_HEADERS = [
  'challengeId', 'phone', 'name', 'blogUrl', 'agree', 'status', 'appliedAt', 'note',
];

// ---------- 순수 로직 (src/lib/application.js 미러) ----------
function normalizePhone(raw) {
  if (raw == null) return null;
  var digits = String(raw).replace(/\D/g, '');
  if (!/^010\d{8}$/.test(digits)) return null;
  return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
}

function validateApplication(input, ctx) {
  input = input || {};
  ctx = ctx || {};
  var errors = {};
  if (!input.name || !String(input.name).trim()) errors.name = '성함을 입력하세요.';
  if (!input.phone || !String(input.phone).trim()) errors.phone = '휴대폰 번호를 입력하세요.';
  else if (!normalizePhone(input.phone)) errors.phone = '올바른 휴대폰 번호(010-0000-0000)를 입력하세요.';
  if (!input.blogUrl || !String(input.blogUrl).trim()) errors.blogUrl = '블로그 URL을 입력하세요.';
  else if (!/^https?:\/\/.+/.test(String(input.blogUrl).trim()))
    errors.blogUrl = 'http(s)로 시작하는 블로그 URL을 입력하세요.';
  if (!input.agree) errors.agree = '개인정보 수집·이용에 동의해 주세요.';
  if (ctx.recruiting === false) errors.recruiting = '모집 기간이 아닙니다.';
  return { ok: Object.keys(errors).length === 0, errors: errors };
}

// ---------- 시트 헬퍼 ----------
function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function rowsAsObjects_(sh) {
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function operatorToken_() {
  return PropertiesService.getScriptProperties().getProperty('OPERATOR_TOKEN');
}

// ---------- 응답 캐싱 (CacheService) — 읽기 응답 캐시 + 쓰기 시 무효화 ----------
// 캠페인별 rev를 키에 포함 → 쓰기 시 bumpRev_로 rev 변경하면 옛 캐시는 자동 무용지물.
function challengeRev_(scope) {
  var c = CacheService.getScriptCache();
  var k = 'rev:' + (scope || '_all');
  var v = c.get(k);
  if (!v) { v = '1'; c.put(k, v, 21600); }
  return v;
}
function bumpRev_(cid) {
  var c = CacheService.getScriptCache();
  var t = String(new Date().getTime());
  c.put('rev:_all', t, 21600);          // 목록(campaigns) 등 전역 캐시 무효화
  if (cid) c.put('rev:' + cid, t, 21600); // 해당 캠페인 캐시 무효화
}
function cachedGet_(p, ttl, producer, revScope) {
  var cache = CacheService.getScriptCache();
  var scope = revScope || p.challengeId || '_all';
  var key = 'g:' + p.action + ':' + (p.challengeId || '') + ':' + (p.round || '') + ':' + challengeRev_(scope);
  var hit; try { hit = cache.get(key); } catch (e) { hit = null; }
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  var out = producer();
  try { cache.put(key, out.getContent(), ttl); } catch (e) {}
  return out;
}

// ---------- 엔드포인트 ----------
function doPost(e) {
  try { return doPostInner_(e); }
  catch (err) { return json_({ ok: false, error: 'exception', message: String(err && err.message || err) }); }
}

function doPostInner_(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  var res = dispatchPost_(body);
  if (body.action) bumpRev_(body.challengeId); // 쓰기 후 관련 캐시 무효화(다음 조회 최신)
  return res;
}

function dispatchPost_(body) {
  switch (body.action) {
    case 'apply': return apply_(body);                  // S1 신청
    case 'createChallenge': return createChallenge_(body); // S2
    case 'saveSettings': return saveSettings_(body);    // S2
    case 'saveMissions': return saveMissions_(body);    // S2
    case 'select': return select_(body);                // S3 선발
    case 'deleteParticipant': return deleteParticipant_(body); // 신청자 삭제
    case 'submit': return submit_(body);                // S4 주차제출
    case 'wrapup': return wrapup_(body);                // S7 마무리(리워드 신청)
    case 'resend': return resend_(body);                // S6 수동 재발송
    case 'notifyWeek': return notifyWeek_(body);        // Hub 주차 알림톡 일괄 발송
    case 'notifyWrapup': return notifyWrapup_(body);    // Hub 리워드 신청(마무리 폼) 안내 일괄 발송
    case 'saveCampaign': return saveCampaign_(body);    // Hub 캠페인 생성/수정
    case 'deleteCampaign': return deleteCampaign_(body); // Hub 캠페인 삭제
    case 'setExcellent': return setExcellent_(body);    // Hub 우수선정 토글(전역·리워드)
    case 'setWeekExcellent': return setWeekExcellent_(body); // Hub 주차별 우수(표시)
    case 'openWeek': return hubOpenWeek_(body);         // Hub 주차 오픈/마감
    case 'saveMission': return saveMission_(body);      // Hub 단일 회차 미션 저장
    case 'saveCampaignMeta': return saveCampaignMeta_(body); // Hub 전역 교육자료·유의사항
    case 'reviewSubmission': return reviewSubmission_(body); // Hub 제출 검수
    default: return json_({ ok: false, error: 'unknown_action' });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  switch (p.action) {
    case 'participants': return participants_(p);       // S1 명단
    case 'myStatus': return myStatus_(p.challengeId, p.phone, p.blogUrl); // S4 본인현황(블로그 검증 — 캐시 제외)
    case 'matrix': return cachedGet_(p, 30, function () { return matrix_(p); }); // S5
    case 'boardData': return cachedGet_(p, 30, function () { return boardData_(p); }); // Hub 관리/리워드
    case 'notifyLog': return notifyLog_(p);             // S6 알림로그
    case 'settlement': return settlement_(p);           // S7 정산
    case 'campaigns': return cachedGet_(p, 30, function () { return campaigns_(p); }, '_all'); // Hub 목록
    case 'campaignDetail': return cachedGet_(p, 120, function () { return campaignDetail_(p); }); // 공개 상세(거의 불변)
    case 'blogInfo': return blogInfo_(p);               // 신청 블로그 URL 미리보기(공개)
    case 'missions': return cachedGet_(p, 60, function () { return missions_(p); }); // Hub 주차 미션
    case 'weekSubmissions': return cachedGet_(p, 20, function () { return weekSubmissions_(p); }); // Hub 그 주 제출
    default: return json_({ ok: false, error: 'unknown_action' });
  }
}

function apply_(body) {
  var challengeId = body.challengeId;
  if (!challengeId) return json_({ ok: false, error: 'challenge_required' });
  var recruiting = isRecruiting_(challengeId);
  var v = validateApplication(body, { recruiting: recruiting });
  if (!v.ok) return json_({ ok: false, errors: v.errors });

  var sh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var phone = normalizePhone(body.phone);
  // 블로그 URL 중복 차단(다른 사람이 같은 블로그로 신청 불가, 네이버 변형 URL 정규화)
  var blogKey = normBlog_(body.blogUrl);
  if (blogKey) {
    var dup = rowsAsObjects_(sh).some(function (r) {
      return String(r.challengeId) === String(challengeId)
        && normBlog_(r.blogUrl) === blogKey
        && String(r.phone) !== String(phone);
    });
    if (dup) return json_({ ok: false, error: 'blog_taken', errors: { blogUrl: '이미 다른 참가자가 등록한 블로그입니다.' } });
  }
  var existing = findRowIndexByPhone_(sh, challengeId, phone);
  var record = [
    challengeId, phone, String(body.name).trim(), String(body.blogUrl).trim(),
    'Y', 'selected', new Date(), '',
  ]; // 기본 전체 선발(알림톡 미발송), 특이 경우만 운영자가 탈락 처리
  if (existing > 0) {
    // 기존 신청일/상태 보존하며 갱신
    var prev = sh.getRange(existing, 1, 1, PARTICIPANT_HEADERS.length).getValues()[0];
    record[5] = prev[5] || 'selected';
    record[6] = prev[6] || new Date();
    sh.getRange(existing, 1, 1, PARTICIPANT_HEADERS.length).setValues([record]);
  } else {
    sh.appendRow(record);
  }
  return json_({ ok: true, phone: phone });
}

function deleteParticipant_(body) {
  if (body.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var challengeId = String(body.challengeId || '');
  var phone = normalizePhone(body.phone);
  if (!challengeId || !phone) return json_({ ok: false, error: 'bad_request' });
  var sh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var idx = findRowIndexByPhone_(sh, challengeId, phone);
  if (idx < 1) return json_({ ok: false, error: 'not_found' });
  sh.deleteRow(idx);
  // 관련 제출 행도 정리
  var subSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
  if (subSh && subSh.getLastRow() > 1) {
    var vals = subSh.getDataRange().getValues();
    var ci = vals[0].indexOf('challengeId'), pi = vals[0].indexOf('phone');
    if (ci >= 0 && pi >= 0) {
      for (var i = vals.length - 1; i >= 1; i--) {
        if (String(vals[i][ci]) === challengeId && String(vals[i][pi]) === String(phone)) subSh.deleteRow(i + 1);
      }
    }
  }
  return json_({ ok: true });
}

function participants_(p) {
  if (p.token !== operatorToken_()) return json_({ ok: false, error: 'forbidden' });
  var sh = getSheet_(SHEETS.participants, PARTICIPANT_HEADERS);
  var all = rowsAsObjects_(sh);
  var rows = p.challengeId
    ? all.filter(function (r) { return String(r.challengeId) === String(p.challengeId); })
    : all;
  return json_({ ok: true, rows: rows });
}

function findRowIndexByPhone_(sh, challengeId, phone) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(challengeId) && String(values[i][1]) === String(phone)) {
      return i + 1; // 1-based row
    }
  }
  return -1;
}

// 블로그 URL 정규화(중복 비교용). 네이버 변형(m./PostList?blogId=)은 blogId로 통일.
function normBlog_(u) {
  var s = String(u == null ? '' : u).trim().toLowerCase();
  if (!s) return '';
  var mid = s.match(/blogid=([a-z0-9_-]+)/);
  if (mid) return 'naver:' + mid[1];
  var mp = s.match(/(?:m\.)?blog\.naver\.com\/([a-z0-9_-]+)/);
  if (mp && mp[1] !== 'postlist.naver') return 'naver:' + mp[1];
  return s.replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function isRecruiting_(challengeId) {
  // Challenges 시트가 없으면 기본 모집중(true). S2에서 일정 기반으로 확장.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.challenges);
  if (!sh) return true;
  var all = rowsAsObjects_(sh);
  var c = all.filter(function (r) { return String(r.challengeId) === String(challengeId); })[0];
  if (!c) return true;
  if (c.status && String(c.status) !== '모집중') return false;
  return true;
}
