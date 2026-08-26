import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBlogUrl, NAVER_RESERVED_PATH } from '../public/js/lib/blog-url.js';

const ID = 'naver:backbaekseo';

test('핵심 버그: 모바일 도메인과 PC 도메인이 같은 키다', () => {
  assert.equal(normalizeBlogUrl('https://m.blog.naver.com/backbaekseo'), ID);
  assert.equal(normalizeBlogUrl('https://blog.naver.com/backbaekseo'), ID);
  assert.equal(
    normalizeBlogUrl('https://m.blog.naver.com/backbaekseo'),
    normalizeBlogUrl('https://blog.naver.com/backbaekseo'),
  );
});

test('대문자·앞뒤공백·프로토콜 유무가 키를 가르지 않는다', () => {
  [
    'HTTPS://BLOG.NAVER.COM/BackBaekseo',
    '  https://blog.naver.com/backbaekseo  ',
    'http://blog.naver.com/backbaekseo',
    'blog.naver.com/backbaekseo',
    '\thttps://M.Blog.Naver.Com/BACKBAEKSEO\n',
  ].forEach((u) => assert.equal(normalizeBlogUrl(u), ID, u));
});

test('트레일링 슬래시 1~3개가 키를 가르지 않는다', () => {
  ['/', '//', '///'].forEach((tail) => {
    assert.equal(normalizeBlogUrl('https://blog.naver.com/backbaekseo' + tail), ID, tail);
    assert.equal(normalizeBlogUrl('https://m.blog.naver.com/backbaekseo' + tail), ID, 'm' + tail);
  });
});

test('쿼리스트링·해시가 붙어도 같은 키다', () => {
  [
    'https://blog.naver.com/backbaekseo?Redirect=Log&logNo=223456',
    'https://m.blog.naver.com/backbaekseo?Redirect=Log&logNo=223456',
    'https://blog.naver.com/backbaekseo#해시',
    'https://blog.naver.com/backbaekseo/#top',
    'https://blog.naver.com/backbaekseo?referrerCode=0#comment',
  ].forEach((u) => assert.equal(normalizeBlogUrl(u), ID, u));
});

test('blogId 쿼리형 URL(PostList·모바일·section)이 모두 같은 키다', () => {
  [
    'https://blog.naver.com/PostList.naver?blogId=backbaekseo',
    'https://blog.naver.com/PostList.naver?blogId=backbaekseo&from=postList',
    'https://m.blog.naver.com/PostList.naver?blogId=backbaekseo',
    'https://section.blog.naver.com/BlogHome.naver?blogId=backbaekseo',
    'https://blog.naver.com/PostView.naver?blogId=backbaekseo&logNo=223456789',
  ].forEach((u) => assert.equal(normalizeBlogUrl(u), ID, u));
});

test('포스트 상세 경로도 블로그 아이디로 접힌다', () => {
  [
    'https://blog.naver.com/backbaekseo/223456789',
    'https://m.blog.naver.com/backbaekseo/223456789',
    'https://m.blog.naver.com/backbaekseo/223456789?referrerCode=0',
  ].forEach((u) => assert.equal(normalizeBlogUrl(u), ID, u));
});

// 회귀 방지 핵심: 예전 가드는 캡처에 '.'이 없어 죽은 코드였고,
// blogId 없는 PostList.naver가 전부 'naver:postlist' 한 키로 뭉개졌다(= 남남이 동일인 판정).
test('회귀 방지: blogId 없는 PostList.naver는 naver:postlist로 뭉개지지 않는다', () => {
  const got = normalizeBlogUrl('https://blog.naver.com/PostList.naver');
  assert.notEqual(got, 'naver:postlist');
  assert.equal(got, 'https://blog.naver.com/postlist.naver');
  assert.notEqual(got, normalizeBlogUrl('https://blog.naver.com/PostView.naver'));
});

test('회귀 방지: 시스템 경로끼리 서로 다른 키를 가진다', () => {
  const urls = [
    'https://blog.naver.com/PostList.naver',
    'https://blog.naver.com/PostView.naver',
    'https://blog.naver.com/BlogHome.naver',
    'https://m.blog.naver.com/PostList.naver',
    'https://blog.naver.com/prologue',
    'https://blog.naver.com/guestbook',
    // 예약목록에 없는 .naver 경로. 이것들이 접히지 않는 건 예약목록이 아니라
    // 캡처 그룹이 '.'을 품는 덕분이다 — 좁히면 서로 다른 사람이 같은 키가 된다.
    'https://blog.naver.com/PrologueList.naver',
    'https://blog.naver.com/GuestBookList.naver',
    'https://blog.naver.com/ThemePost.naver',
  ];
  const keys = urls.map(normalizeBlogUrl);
  assert.equal(new Set(keys).size, urls.length, keys.join(' | '));
  keys.forEach((k) => assert.equal(k.indexOf('naver:') === 0, false, k));
});

test('예약 경로는 블로그 아이디로 오인되지 않는다', () => {
  NAVER_RESERVED_PATH.forEach((p) => {
    const got = normalizeBlogUrl('https://blog.naver.com/' + p);
    assert.equal(got, 'https://blog.naver.com/' + p, p);
    assert.equal(got.indexOf('naver:') === 0, false, p);
  });
});

test('예약 경로여도 blogId 쿼리가 있으면 그 아이디를 쓴다', () => {
  assert.equal(normalizeBlogUrl('https://blog.naver.com/prologue/PrologueList.naver?blogId=backbaekseo'), ID);
});

test('밑줄·하이픈·숫자 아이디를 그대로 살린다', () => {
  assert.equal(normalizeBlogUrl('https://blog.naver.com/my_blog-01'), 'naver:my_blog-01');
  assert.equal(normalizeBlogUrl('https://blog.naver.com/PostList.naver?blogId=my_blog-01'), 'naver:my_blog-01');
});

test('서로 다른 네이버 아이디는 서로 다른 키다', () => {
  assert.notEqual(normalizeBlogUrl('https://blog.naver.com/aaa'), normalizeBlogUrl('https://blog.naver.com/bbb'));
  assert.notEqual(normalizeBlogUrl('https://m.blog.naver.com/aaa'), normalizeBlogUrl('https://blog.naver.com/bbb'));
});

test('비네이버 블로그는 정규화 규칙이 적용되지 않고 회귀도 없다', () => {
  const cases = [
    ['https://someone.tistory.com/123', 'https://someone.tistory.com/123'],
    ['https://someone.tistory.com/123/', 'https://someone.tistory.com/123'],
    ['  HTTPS://Someone.Tistory.com/123//  ', 'https://someone.tistory.com/123'],
    ['https://someone.tistory.com/123?category=1', 'https://someone.tistory.com/123'],
    ['https://brunch.co.kr/@user', 'https://brunch.co.kr/@user'],
    ['https://brunch.co.kr/@user/10#top', 'https://brunch.co.kr/@user/10'],
    ['https://velog.io/@user/post?x=1', 'https://velog.io/@user/post'],
    ['https://velog.io/@user/post/', 'https://velog.io/@user/post'],
  ];
  cases.forEach((c) => assert.equal(normalizeBlogUrl(c[0]), c[1], c[0]));
});

test('비네이버끼리 서로 다른 주소는 서로 다른 키다', () => {
  assert.notEqual(
    normalizeBlogUrl('https://a.tistory.com/1'),
    normalizeBlogUrl('https://b.tistory.com/1'),
  );
  assert.notEqual(
    normalizeBlogUrl('https://velog.io/@a/post'),
    normalizeBlogUrl('https://velog.io/@b/post'),
  );
});

test('빈값·공백·null·undefined는 빈 문자열이다', () => {
  ['', '   ', '\t\n', null, undefined].forEach((v) => assert.equal(normalizeBlogUrl(v), '', String(v)));
});

test('비문자 입력도 던지지 않고 문자열을 돌려준다', () => {
  [0, 123, false, true, {}, []].forEach((v) => assert.equal(typeof normalizeBlogUrl(v), 'string', String(v)));
});

// 정규화의 목적은 "같은 사람 = 같은 키". 신청↔본인확인 양쪽에서 이 성질이 유지되는지 고정한다.
test('한 사람이 쓰는 URL 변형 전체가 단일 키로 수렴한다', () => {
  const variants = [
    'https://blog.naver.com/backbaekseo',
    'http://blog.naver.com/backbaekseo/',
    'https://m.blog.naver.com/backbaekseo',
    ' M.BLOG.NAVER.COM/BackBaekseo// ',
    'https://blog.naver.com/backbaekseo/223456789',
    'https://blog.naver.com/PostList.naver?blogId=backbaekseo',
    'https://section.blog.naver.com/BlogHome.naver?blogId=backbaekseo',
  ];
  const keys = new Set(variants.map(normalizeBlogUrl));
  assert.deepEqual([...keys], [ID]);
});
