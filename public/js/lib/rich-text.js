// 상세페이지 본문 평문 → HTML 변환. 랜딩 렌더와 관리자 미리보기가 이 한 벌을 공유한다.
// WHY: 두 벌로 두면 미리보기가 실제 화면과 어긋나는 순간 가이드 전체가 거짓말이 된다.

// 줄머리 목록 마커. 이 목록을 고치면 admin의 서식 안내 표(FMT_ROWS)도 같이 고칠 것.
export const BULLET_CHARS = ['-', '•', '*', '·', '–', '—', '▪', '◦', '‣', '★', '☆', '◆', '▶', '▷', '✓', '✔'];
const BULLET = `[${BULLET_CHARS.join('')}]`;

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 줄머리 불렛/번호 마커 제거
export const stripMarker = (s) =>
  String(s || '').replace(new RegExp('^\\s*(?:' + BULLET + '|\\d+[.)])\\s+'), '').trim();

// 빈 줄=문단, 단일 줄바꿈=<br>, 줄머리 마커=리스트(연속 묶음),
// ★★…★★·##=소제목, ---=구분선, **굵게**·느낌표로 끝나는 줄=강조.
export function richText(str) {
  const lines = String(str == null ? '' : str).replace(/\r/g, '').split('\n');
  const ulRe = new RegExp('^' + BULLET + '\\s+');
  const olRe = /^\d+[.)]\s+/;
  const hrRe = /^[-–—_▬=]{3,}$/;
  const hdRe = /^[★☆]{1,3}\s*(.+?)\s*[★☆]{1,3}$/;
  const mdHdRe = /^#{1,6}\s*(.+?)\s*#*$/;
  const line = (l) => {
    let h = esc(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/[!！]\s*$/.test(l)) h = `<strong class="hl-line">${h}</strong>`;
    return h;
  };
  let html = '', pbuf = [], lbuf = [], lt = null, olCount = 0, blanked = false;
  const flushP = () => { if (pbuf.length) { html += `<p class="rich-p">${pbuf.join('<br>')}</p>`; pbuf = []; } };
  const flushL = () => {
    if (!lbuf.length) return;
    const attr = lt === 'ol' ? ` style="counter-reset:ri ${olCount}"` : '';
    html += `<${lt} class="rich-list"${attr}>${lbuf.map((x) => `<li>${x}</li>`).join('')}</${lt}>`;
    if (lt === 'ol') olCount += lbuf.length;
    lbuf = []; lt = null;
  };
  const flush = () => { flushP(); flushL(); };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flush(); blanked = true; continue; }
    if (blanked) { if (html) html += '<div class="rich-blank"></div>'; blanked = false; }
    if (hrRe.test(l)) { flush(); html += '<hr class="rich-hr">'; continue; }
    const hd = l.match(hdRe);
    if (hd) { flush(); html += `<div class="rich-h">${line(hd[1])}</div>`; continue; }
    const mhd = l.match(mdHdRe);
    if (mhd) { flush(); html += `<div class="rich-h">${line(mhd[1])}</div>`; continue; }
    if (ulRe.test(l)) { flushP(); if (lt !== 'ul') flushL(), (lt = 'ul'); lbuf.push(line(l.replace(ulRe, ''))); continue; }
    if (olRe.test(l)) { flushP(); if (lt !== 'ol') flushL(), (lt = 'ol'); lbuf.push(line(l.replace(olRe, ''))); continue; }
    flushL(); pbuf.push(line(l));
  }
  flush();
  return html;
}
