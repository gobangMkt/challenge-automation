// src/gas/AdminHub.gs의 saveCampaign_이 detail을 '병합'하는지 실제 소스로 검증한다.
// WHY: 캠페인 수정 폼은 guide·notice·eduUrl을 보내지 않는다(운영 탭에서 따로 저장하는 필드다).
// detail을 통째로 덮어쓰면 저장 버튼 한 번에 작성가이드가 조용히 사라진다 — 2026-06-14 cfa2b55에서
// guide를 같은 detail 객체에 넣으면서 실제로 발생했고, 데이터가 지워진 뒤에야 드러난다.
// GAS는 로컬 실행이 불가하므로 saveCampaign_ 본문을 잘라내 병합 부분만 평가한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/gas/AdminHub.gs', import.meta.url), 'utf8');

function extractFn(source, header) {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `소스에서 ${header} 를 찾지 못했다`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') { depth += 1; opened = true; }
    else if (ch === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${header} 선언의 끝을 찾지 못했다`);
}

const fnSrc = extractFn(src, 'function saveCampaign_(');

test('추출: saveCampaign_ 본문을 실제로 잘라냈다', () => {
  assert.ok(fnSrc.length > 400, '본문이 통째로 추출되지 않았다');
  assert.ok(fnSrc.includes('saveCampaignDetail_'), 'detail 저장 호출이 본문에 없다');
});

test('detail을 통째로 덮어쓰지 않는다 (덮어쓰면 작성가이드가 지워진다)', () => {
  assert.ok(
    !/saveCampaignDetail_\(\s*challengeId\s*,\s*body\.detail\s*\|\|\s*\{\}\s*\)/.test(fnSrc),
    'saveCampaignDetail_(challengeId, body.detail || {}) — 기존 detail을 통째로 교체하고 있다',
  );
  assert.ok(fnSrc.includes('campaignDetailObj_('), '저장 전에 기존 detail을 읽지 않는다');
});

// 병합 규칙 자체를 소스에서 잘라내 실행한다(로직 복제가 아니라 실제 코드 검증).
const mergeSrc = fnSrc.slice(fnSrc.indexOf('var prevDetail'), fnSrc.indexOf('saveCampaignDetail_(challengeId, nextDetail)'));
const runMerge = (prev, form) => {
  const fn = new Function('prevDetail', 'body', `
    ${mergeSrc.replace('var prevDetail = campaignDetailObj_(challengeId) || {};', 'prevDetail = prevDetail || {};')}
    return nextDetail;
  `);
  return fn(prev, { detail: form });
};

test('추출: 병합 블록을 실제로 잘라냈다', () => {
  assert.ok(mergeSrc.includes('hasOwnProperty'), '병합 블록이 추출되지 않았다');
});

test('폼이 안 보낸 키(guide·notice·eduUrl)는 보존된다', () => {
  const out = runMerge(
    { tagline: '옛', concept: '옛', guide: '작성가이드 본문', notice: '유의사항', eduUrl: 'https://edu' },
    { tagline: '새', concept: '새' },
  );
  assert.equal(out.guide, '작성가이드 본문');
  assert.equal(out.notice, '유의사항');
  assert.equal(out.eduUrl, 'https://edu');
});

test('폼이 보낸 키는 새 값으로 갱신된다', () => {
  const out = runMerge({ tagline: '옛', guide: 'G' }, { tagline: '새' });
  assert.equal(out.tagline, '새');
  assert.equal(out.guide, 'G');
});

test('폼이 빈 문자열을 보내면 비운다 (보존이 아니라 갱신)', () => {
  const out = runMerge({ tagline: '옛', guide: 'G' }, { tagline: '', concept: '' });
  assert.equal(out.tagline, '');
  assert.equal(out.concept, '');
  assert.equal(out.guide, 'G');
});

test('theme·cautions 등 다른 미전송 필드도 보존된다', () => {
  const out = runMerge({ theme: 'indigo', cautions: ['a', 'b'] }, { tagline: 'x' });
  assert.equal(out.theme, 'indigo');
  assert.deepEqual(out.cautions, ['a', 'b']);
});

test('기존 detail이 없어도 폼 값만으로 만들어진다', () => {
  assert.deepEqual(runMerge(null, { tagline: 'x' }), { tagline: 'x' });
  assert.deepEqual(runMerge({}, { tagline: 'x' }), { tagline: 'x' });
});
