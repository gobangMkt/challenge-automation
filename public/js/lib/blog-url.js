// 블로그 URL 정규화 순수로직 (의존성 0, GAS Code.gs의 normBlog_와 미러)
// WHY: 신청 중복판정(apply_)과 본인확인(myStatus_)이 서로 다른 잣대를 쓰면
// m.blog.naver.com으로 신청한 사람이 blog.naver.com으로는 본인확인에 실패한다.
// 비교 기준을 여기 한 곳에 모으고, 시트 접근은 호출부가 책임진다.

// 블로그 아이디 자리에 올 수 있는 네이버 시스템 경로.
// 아이디로 오인하면 서로 다른 사람이 같은 키를 갖는다.
export const NAVER_RESERVED_PATH = ['prologue', 'postlist', 'postview', 'bloghome', 'guestbook'];

export function normalizeBlogUrl(u) {
  var s = String(u == null ? '' : u).trim().toLowerCase();
  if (!s) return '';
  var mid = s.match(/blogid=([a-z0-9_-]+)/);
  if (mid) return 'naver:' + mid[1];
  // 캡처에 점을 포함해야 PostList.naver 같은 시스템 경로가 통째로 잡힌다.
  // 점 없이 잡으면 'postlist'만 캡처돼 아래 가드를 못 넘고, 서로 다른 사람이 같은 키를 갖는다.
  var mp = s.match(/(?:m\.)?blog\.naver\.com\/([a-z0-9_.-]+)/);
  if (mp && mp[1].indexOf('.') === -1 && NAVER_RESERVED_PATH.indexOf(mp[1]) === -1) return 'naver:' + mp[1];
  return s.replace(/[?#].*$/, '').replace(/\/+$/, '');
}
