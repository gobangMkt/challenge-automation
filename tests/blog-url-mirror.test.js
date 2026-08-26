// src/gas/Code.gs의 normBlog_가 public/js/lib/blog-url.js의 정확한 미러인지 자동 검증하고,
// 신청(apply_)·본인확인(myStatus_) 두 호출부가 그 함수를 계속 쓰는지 고정한다.
// WHY: GAS는 로컬 실행이 불가해 미러 드리프트가 배포 후에야 드러난다. 그리고 이 정규화는
// 한쪽만 바뀌면 "같은 사람이 남남으로 판정"되는 형태로 조용히 깨진다.
// Status.gs와 달리 Code.gs는 시트 의존 함수가 섞여 있어 통째 평가 대신
// normBlog_ 함수와 NAVER_RESERVED_PATH_ 상수만 소스에서 잘라내 평가한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeBlogUrl, NAVER_RESERVED_PATH } from '../public/js/lib/blog-url.js';

const codeSrc = readFileSync(new URL('../src/gas/Code.gs', import.meta.url), 'utf8');
const submitSrc = readFileSync(new URL('../src/gas/Submit.gs', import.meta.url), 'utf8');

// 최상위 선언 하나를 소스에서 잘라낸다. 중괄호/대괄호 깊이를 세어 끝을 찾는다.
function extractDecl(src, header) {
  const start = src.indexOf(header);
  assert.notEqual(start, -1, `소스에서 ${header} 를 찾지 못했다`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{' || ch === '[') {
      depth += 1;
      opened = true;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (opened && depth === 0) {
        const end = src[i + 1] === ';' ? i + 2 : i + 1;
        return src.slice(start, end);
      }
    } else if (ch === ';' && opened && depth === 0) {
      return src.slice(start, i + 1);
    }
  }
  throw new Error(`${header} 선언의 끝을 찾지 못했다`);
}

const constSrc = extractDecl(codeSrc, 'var NAVER_RESERVED_PATH_ =');
const fnSrc = extractDecl(codeSrc, 'function normBlog_(');

const gas = new Function(`${constSrc}\n${fnSrc}\nreturn { normBlog_, NAVER_RESERVED_PATH_ };`)();

// 추출이 조용히 빈 껍데기를 집어오면 미러 검증이 통과해도 의미가 없다.
test('추출: normBlog_ 본문과 상수를 실제로 잘라냈다', () => {
  assert.equal(typeof gas.normBlog_, 'function');
  assert.equal(Array.isArray(gas.NAVER_RESERVED_PATH_), true);
  assert.equal(fnSrc.indexOf('blogid=') !== -1, true, '정규화 본문이 통째로 추출되지 않았다');
  assert.equal(constSrc.trim().endsWith(';'), true);
});

test('미러: NAVER_RESERVED_PATH_ 상수가 lib과 동일하다', () => {
  assert.deepEqual(gas.NAVER_RESERVED_PATH_, NAVER_RESERVED_PATH);
});

test('미러: Code.gs 정규화 코드에 ES모듈 문법·화살표 함수가 없다', () => {
  [constSrc, fnSrc].forEach((s) => {
    assert.equal(/^\s*(export|import)\s/m.test(s), false);
    assert.equal(/=>/.test(s), false, 'GAS(Rhino 호환)에서 화살표 함수 지양');
    assert.equal(/\?\./.test(s), false, 'GAS(Rhino 호환)에서 옵셔널 체이닝 지양');
    assert.equal(/\.\.\./.test(s), false, 'GAS(Rhino 호환)에서 스프레드 지양');
  });
});

const INPUTS = [
  '', '   ', '\t\n', null, undefined, 0, 123, false, true, {}, [],
  'https://blog.naver.com/backbaekseo',
  'https://m.blog.naver.com/backbaekseo',
  'HTTPS://BLOG.NAVER.COM/BackBaekseo',
  '  https://blog.naver.com/backbaekseo  ',
  'http://blog.naver.com/backbaekseo',
  'blog.naver.com/backbaekseo',
  'https://blog.naver.com/backbaekseo/',
  'https://blog.naver.com/backbaekseo//',
  'https://blog.naver.com/backbaekseo///',
  'https://m.blog.naver.com/backbaekseo///',
  'https://blog.naver.com/backbaekseo?Redirect=Log&logNo=223456',
  'https://blog.naver.com/backbaekseo#해시',
  'https://blog.naver.com/backbaekseo/#top',
  'https://blog.naver.com/PostList.naver?blogId=backbaekseo',
  'https://m.blog.naver.com/PostList.naver?blogId=backbaekseo',
  'https://section.blog.naver.com/BlogHome.naver?blogId=backbaekseo',
  'https://blog.naver.com/PostView.naver?blogId=backbaekseo&logNo=223456789',
  'https://blog.naver.com/backbaekseo/223456789',
  'https://m.blog.naver.com/backbaekseo/223456789?referrerCode=0',
  'https://blog.naver.com/PostList.naver',
  'https://m.blog.naver.com/PostList.naver',
  'https://blog.naver.com/PostView.naver',
  'https://blog.naver.com/BlogHome.naver',
  'https://blog.naver.com/prologue',
  'https://blog.naver.com/postlist',
  'https://blog.naver.com/postview',
  'https://blog.naver.com/bloghome',
  'https://blog.naver.com/guestbook',
  'https://blog.naver.com/prologue/PrologueList.naver?blogId=backbaekseo',
  // 예약목록에 없는 .naver 시스템 경로 — 캡처 그룹이 '.'을 잃으면 여기서 갈린다.
  'https://blog.naver.com/PrologueList.naver',
  'https://blog.naver.com/GuestBookList.naver',
  'https://m.blog.naver.com/ThemePost.naver',
  'https://blog.naver.com/some.thing',
  'https://blog.naver.com/my_blog-01',
  'https://blog.naver.com/PostList.naver?blogId=my_blog-01',
  'https://someone.tistory.com/123',
  'https://someone.tistory.com/123/',
  '  HTTPS://Someone.Tistory.com/123//  ',
  'https://someone.tistory.com/123?category=1',
  'https://brunch.co.kr/@user',
  'https://brunch.co.kr/@user/10#top',
  'https://velog.io/@user/post?x=1',
  'https://velog.io/@user/post/',
  'https://blog.naver.com/',
  'https://blog.naver.com',
  'blog.naver.com/aaa?blogid=bbb',
  '아무거나',
];

test('미러: normBlog_ ↔ normalizeBlogUrl 전수 일치', () => {
  INPUTS.forEach((u) => {
    assert.equal(gas.normBlog_(u), normalizeBlogUrl(u), `normBlog_(${String(u)})`);
  });
});

// ---------- 호출부 고정 ----------
// 누가 다시 "자체 trim/소문자/슬래시 비교"로 되돌리면 여기서 실패해야 한다.

function extractFn(src, name) {
  return extractDecl(src, `function ${name}(`);
}

test('호출부: myStatus_는 자체 비교가 아니라 normBlog_로 블로그를 대조한다', () => {
  const fn = extractFn(submitSrc, 'myStatus_');
  const calls = fn.match(/normBlog_\(/g) || [];
  assert.equal(calls.length >= 2, true, `normBlog_ 호출이 ${calls.length}회 — 입력·저장값 양쪽에 써야 한다`);
  assert.equal(/blog_mismatch/.test(fn), true, '불일치 응답 코드가 사라졌다');
  // 자체 정규화 흔적이 있으면 두 잣대가 갈린다.
  assert.equal(/toLowerCase\(\)/.test(fn), false, 'myStatus_ 안에서 직접 소문자 변환 금지');
  assert.equal(/replace\(\/\\\/\+\$\//.test(fn), false, 'myStatus_ 안에서 직접 슬래시 정리 금지');
});

test('호출부: apply_ 중복판정도 같은 normBlog_를 쓴다', () => {
  const fn = extractFn(codeSrc, 'apply_');
  const calls = fn.match(/normBlog_\(/g) || [];
  assert.equal(calls.length >= 2, true, `normBlog_ 호출이 ${calls.length}회 — 입력·기존행 양쪽에 써야 한다`);
  assert.equal(/blog_taken/.test(fn), true, '중복 차단 응답 코드가 사라졌다');
});

test('호출부: 신청과 본인확인이 같은 키로 판정한다', () => {
  const applied = 'https://m.blog.naver.com/backbaekseo';
  const checked = 'https://blog.naver.com/BackBaekseo/';
  assert.equal(gas.normBlog_(applied), gas.normBlog_(checked));
  assert.equal(normalizeBlogUrl(applied), gas.normBlog_(checked));
});
