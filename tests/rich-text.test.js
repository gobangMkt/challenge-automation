import { test } from 'node:test';
import assert from 'node:assert/strict';
import { richText, stripMarker, BULLET_CHARS } from '../public/js/lib/rich-text.js';

test('줄머리 마커 16종 전부 목록으로 인식한다', () => {
  assert.equal(BULLET_CHARS.length, 16);
  for (const ch of BULLET_CHARS) {
    const html = richText(`${ch} 항목`);
    assert.ok(html.includes('<ul class="rich-list">'), `${ch} 가 목록으로 인식되지 않음`);
    assert.ok(html.includes('<li>항목</li>'), `${ch} 마커가 제거되지 않음`);
  }
});

test('stripMarker는 불렛·번호 마커를 지운다', () => {
  assert.equal(stripMarker('★ 항목'), '항목');
  assert.equal(stripMarker('- 항목'), '항목');
  assert.equal(stripMarker('1. 항목'), '항목');
  assert.equal(stripMarker('마커 없음'), '마커 없음');
});

test('줄 끝 느낌표는 그 줄 전체를 강조한다', () => {
  const html = richText('보통 줄\n강조돼요!');
  assert.ok(html.includes('<strong class="hl-line">강조돼요!</strong>'));
  assert.ok(!html.includes('<strong class="hl-line">보통 줄'));
});

test('빈 줄=문단 분리, 단일 줄바꿈=<br>', () => {
  const html = richText('A\nB\n\nC');
  assert.ok(html.includes('<p class="rich-p">A<br>B</p>'));
  assert.ok(html.includes('<div class="rich-blank"></div>'));
  assert.ok(html.includes('<p class="rich-p">C</p>'));
});

test('**굵게** · ## 소제목 · --- 구분선', () => {
  assert.ok(richText('앞 **굵게** 뒤').includes('<strong>굵게</strong>'));
  assert.ok(richText('## 제목').includes('<div class="rich-h">제목</div>'));
  assert.ok(richText('---').includes('<hr class="rich-hr">'));
});

test('HTML은 이스케이프된다', () => {
  assert.ok(richText('<script>x</script>').includes('&lt;script&gt;'));
  assert.ok(!richText('<script>x</script>').includes('<script>'));
});

// 실제 운영 캠페인(취준 블로그 마스터즈 3기) 시트 원문. 운영자가 서식을 "안 썼다"고 인지한
// 텍스트가 실제로는 4개 규칙에 걸린다 — 이 대응이 깨지면 서식 안내 표도 거짓이 된다.
test('운영 원문 회귀: 첫문단 리드 · ★목록 · 끝 느낌표', () => {
  const src = [
    '방학마다 스펙을 쌓고 있는데,',
    '왜 취준은 늘 제자리일까요?',
    '',
    "기업은 '얼마나 많이 했는지'보다 ",
    "'무엇을 직접 해봤는지'를 봅니다.",
    '중요한 건 경험의 양보다 경험의 질.',
    '',
    '★ 스스로 결과를 만들어본 경험',
    '★ 과정을 기록하고 설명할 수 있는 능력',
    '★ 포트폴리오로 정리 가능한 결과물',
    '',
    '실무 경험의 시작은 어렵지 않습니다.',
    '잘 쓴 블로그 하나면 충분합니다.',
    '',
    '이번 방학은 취준 블로그 마스터즈와 함께',
    '결과물을 만드는 방학을 보내보세요!',
  ].join('\n');
  const html = richText(src);
  // 첫 문단(=CSS가 리드로 키우는 자리)이 실제로 첫 <p>여야 한다
  assert.ok(html.startsWith('<p class="rich-p">방학마다 스펙을 쌓고 있는데,<br>왜 취준은 늘 제자리일까요?</p>'));
  // ★ 3줄이 목록 하나로 묶이고 마커는 제거된다
  assert.ok(html.includes('<ul class="rich-list"><li>스스로 결과를 만들어본 경험</li>'
    + '<li>과정을 기록하고 설명할 수 있는 능력</li><li>포트폴리오로 정리 가능한 결과물</li></ul>'));
  // 느낌표로 끝나는 마지막 줄만 강조
  assert.ok(html.includes('<strong class="hl-line">결과물을 만드는 방학을 보내보세요!</strong>'));
  assert.ok(!html.includes('<strong class="hl-line">이번 방학은'));
  assert.equal((html.match(/hl-line/g) || []).length, 1);
});
