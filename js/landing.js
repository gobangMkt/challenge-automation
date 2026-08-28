import { apiGet, apiPost } from './api.js';
import { pickTheme, DISPLAY_FONTS } from './themes.js';
import { VIEW, landingView, canApply, upcomingOpenDate } from './lib/landing-view.js';
import { toYmd } from './lib/status.js';
import { richText, stripMarker } from './lib/rich-text.js';

const $ = (s, r = document) => r.querySelector(s);
const app = document.getElementById('app');
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const params = new URLSearchParams(location.search);
const cid = params.get('c') || '';
function toast(msg, err) {
  const t = document.getElementById('toast'); t.textContent = msg;
  t.className = 'toast is-show' + (err ? ' toast--err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = 'toast'; }, 3000);
}
const normPhone = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  return /^010\d{8}$/.test(d) ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : null;
};
// 입력 중 자동 하이픈 (010-0000-0000)
const maskPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};
const bindPhone = (input) => { if (input) input.addEventListener('input', () => { input.value = maskPhone(input.value); }); };
// 키워드 문자열 → 칩 (쉼표/줄 구분, # 자동)
const kwChips = (s) => String(s || '').split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
  .map((k) => `<span class="wk-kw__chip">${esc(k[0] === '#' ? k : '#' + k)}</span>`).join('');

/* 섹션 헤더 아이콘 — 테마 단색 2톤(duotone). 색은 CSS가 currentColor로 주므로
   캠페인 배색이 바뀌면 아이콘도 같이 바뀐다. 다색 고채도는 테마와 충돌해 폐기(2026-08-27).
   main = 불투명 / accent = opacity .32, 겹치지 않게 배치(겹치면 톤이 3개로 번진다). */
const SVG = (b) => `<svg class="sec__ic" viewBox="0 0 20 20" fill="none" aria-hidden="true">${b}</svg>`;
const ICON = {
  who: SVG(`<circle cx="10" cy="5.9" r="3.5" fill="currentColor" opacity=".32"/>
    <path d="M3.3 17.1c0-3.5 3-5.7 6.7-5.7s6.7 2.2 6.7 5.7c0 .6-.4 1-1 1H4.3c-.6 0-1-.4-1-1Z" fill="currentColor"/>`),
  gift: SVG(`<rect x="2.8" y="9.4" width="14.4" height="8.4" rx="2" fill="currentColor" opacity=".32"/>
    <rect x="2" y="5.4" width="16" height="3.8" rx="1.5" fill="currentColor"/>
    <path d="M10 5.4C8.4 5.4 6.1 5 6.1 3.5c0-.9.8-1.6 1.8-1.6 1.4 0 2.1 1.5 2.1 3.5Z" fill="currentColor"/>
    <path d="M10 5.4c1.6 0 3.9-.4 3.9-1.9 0-.9-.8-1.6-1.8-1.6-1.4 0-2.1 1.5-2.1 3.5Z" fill="currentColor"/>
    <rect x="8.8" y="9.4" width="2.4" height="8.4" fill="currentColor"/>`),
  coin: SVG(`<circle cx="10" cy="10" r="8" fill="currentColor" opacity=".32"/>
    <path d="m10 5.4 1.4 2.85 3.15.46-2.28 2.21.54 3.14L10 12.58l-2.81 1.48.54-3.14-2.28-2.21 3.15-.46L10 5.4Z" fill="currentColor"/>`),
  cal: SVG(`<rect x="2.4" y="4" width="15.2" height="14" rx="2.6" fill="currentColor" opacity=".32"/>
    <path d="M2.4 6.6a2.6 2.6 0 0 1 2.6-2.6h10a2.6 2.6 0 0 1 2.6 2.6v1.9H2.4V6.6Z" fill="currentColor"/>
    <rect x="5.5" y="2" width="2.2" height="4.2" rx="1.1" fill="currentColor"/>
    <rect x="12.3" y="2" width="2.2" height="4.2" rx="1.1" fill="currentColor"/>
    <circle cx="6.9" cy="12" r="1.25" fill="currentColor"/><circle cx="10" cy="12" r="1.25" fill="currentColor"/>
    <circle cx="13.1" cy="12" r="1.25" fill="currentColor"/><circle cx="6.9" cy="15.1" r="1.25" fill="currentColor"/>
    <circle cx="10" cy="15.1" r="1.25" fill="currentColor"/>`),
  warn: SVG(`<path d="M8.62 2.98a1.6 1.6 0 0 1 2.76 0l7.09 12.4c.62 1.07-.16 2.4-1.38 2.4H2.91c-1.22 0-2-1.33-1.38-2.4l7.09-12.4Z" fill="currentColor" opacity=".32"/>
    <rect x="9" y="6.9" width="2" height="5.5" rx="1" fill="currentColor"/><circle cx="10" cy="14.6" r="1.2" fill="currentColor"/>`),
  pen: SVG(`<path d="M3.4 14.1 13.05 4.45l2.5 2.5L5.9 16.6l-3.2.7.7-3.2Z" fill="currentColor" opacity=".32"/>
    <path d="m13.05 4.45 1.35-1.35a1.77 1.77 0 0 1 2.5 2.5L15.55 6.95l-2.5-2.5Z" fill="currentColor"/>
    <path d="m2.7 16.6.7-3.2 2.5 2.5-3.2.7Z" fill="currentColor"/>`),
};
// 공용 체크 글리프 — 글자 ✓는 기기·폰트마다 두께·위치가 달라진다. 색은 자리마다 다르므로 currentColor.
const CHECK = (cls) => `<svg class="${cls}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8.05 14.6 3.9 10.45l1.45-1.45 2.7 2.7 6.6-6.6 1.45 1.45L8.05 14.6Z" fill="currentColor"/></svg>`;
const secTitle = (ic, text, extra) => `<h2 class="sec__title">${ICON[ic]}<span>${esc(text)}</span>${extra || ''}</h2>`;

// 태그라인 자동: 입력값 우선 → 소개 첫 문장(짧으면) → 회차 템플릿
function autoTagline(c, d) {
  if (d.tagline) return d.tagline;
  const first = stripMarker(String(d.concept || '').split(/[\n.·]/)[0]);
  if (first && [...first].length <= 22) return first;
  const rounds = c.totalRounds || d.totalRounds;
  return rounds ? `${rounds}주 블로그 챌린지` : '블로그 챌린지 모집 중';
}

let DATA = null;

async function boot() {
  if (!cid) { app.innerHTML = `<div class="wrap"><p class="center muted" style="padding:80px 0">잘못된 접근입니다. 신청 링크를 확인해 주세요.</p></div>`; return; }
  const r = await apiGet({ action: 'campaignDetail', challengeId: cid }).catch(() => ({ ok: false }));
  if (!r.ok) { app.innerHTML = `<div class="wrap"><p class="center muted" style="padding:80px 0">캠페인을 찾을 수 없습니다.</p></div>`; return; }
  DATA = r;
  applyTheme();
  route();
  window.addEventListener('hashchange', route);
}

function applyTheme() {
  const d = DATA.detail || {};
  const t = pickTheme(DATA.challenge.name, d.theme);
  const s = document.documentElement.style;
  s.setProperty('--lp-hero-bg', t.heroBg); s.setProperty('--lp-hero-bg2', t.heroBg2);
  s.setProperty('--lp-primary', t.primary); s.setProperty('--lp-pop', t.pop); s.setProperty('--lp-pop-ink', t.popInk);
  s.setProperty('--lp-ink', t.ink); s.setProperty('--lp-surface2', t.surface2);
  s.setProperty('--lp-display', DISPLAY_FONTS[t.display] || DISPLAY_FONTS.jalnan);
}

/* 날짜 유틸 */
const fmtMD = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[2]}.${+m[3]}` : ''; };
const addDays = (iso, n) => { const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; const dt = new Date(+m[1], +m[2] - 1, +m[3] + n); return `${dt.getMonth() + 1}.${dt.getDate()}`; };
const dday = (due) => { const m = String(due || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; const t = new Date(); t.setHours(0, 0, 0, 0); const dd = new Date(+m[1], +m[2] - 1, +m[3]); const diff = Math.round((dd - t) / 86400000); return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY' : '마감'; };

/* 참여 방법 Step (공통 동선) */
function stepsSection(c) {
  const steps = [
    { t: '참가 신청', d: `모집 기간에 신청서를 작성하세요.${c['모집마감'] ? ` (~${fmtMD(c['모집마감'])} 마감)` : ''}` },
    { t: '참가자 선발', d: `발표일에 선발 결과를 개별 안내드려요.${c['발표일'] ? ` (${fmtMD(c['발표일'])} 발표)` : ''}` },
    { t: '주차별 실습', d: `시작일부터 ${c.totalRounds || 10}주간 미션을 수행합니다.${c['시작일'] ? ` (${fmtMD(c['시작일'])} 시작)` : ''}` },
  ];
  return `<div class="steps">
    ${steps.map((s, i) => `<div class="step"><div class="step__n">${i + 1}</div>
      <div><div class="step__t">${esc(s.t)}</div><div class="step__d">${esc(s.d)}</div></div></div>`).join('')}
  </div>`;
}

/* 일정 — 시작일 있으면 주차별 표, 없으면 scheduleText 프로즈 */
function scheduleBlock(c, d) {
  const rounds = Number(c.totalRounds) || 0;
  if (c['시작일'] && rounds) {
    const rows = Array.from({ length: rounds }, (_, i) =>
      `<tr><td>${i + 1}주차</td><td>${addDays(c['시작일'], i * 7)} 시작</td></tr>`).join('');
    return `<table class="sched"><thead><tr><th>회차</th><th>시작일</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (d.scheduleText) return `<div class="prose">${richText(d.scheduleText)}</div>`;
  return '';
}

/* "이렇게 진행돼요" 밴드 — 참여 방법(3스텝) + 주차 일정은 같은 질문(어떻게 진행되나)의 답이라 한 그릇 */
function howBand(c, d) {
  const rounds = Number(c.totalRounds) || 0;
  const sched = scheduleBlock(c, d);
  const badge = rounds ? `<span class="sec__badge">총 ${rounds}주</span>` : '';
  return `<section class="sec">
    ${secTitle('cal', '이렇게 진행돼요', badge)}
    <div class="grp">${stepsSection(c)}</div>
    ${sched ? `<div class="grp">${sched}</div>` : ''}
  </section>`;
}

/* 참가 자격 — 한 문장뿐이라 임팩트가 없다. `본문 (A, B, C)` 꼴이면 대상을 칩으로 세운다.
   괄호가 없는 캠페인도 있으므로 폴백은 기존 프로즈. */
function eligibilityBlock(d) {
  const raw = String(d.eligibility || '').trim();
  if (!raw) return '';
  const m = raw.match(/^([^(（]+)[(（]([^)）]+)[)）]\s*$/);
  const chips = m ? m[2].split(/[,，·]/).map((x) => x.trim().replace(/\s*환영$/, '')).filter(Boolean) : [];
  if (!m || !chips.length) return `<div class="prose">${richText(raw)}</div>`;
  return `<p class="elig__lead">${esc(stripMarker(m[1]).trim())}</p>
    <div class="elig__chips">${chips.map((x) => `<span class="elig__chip">${esc(x)}</span>`).join('')}</div>`;
}

/* "누가·무엇을 얻나" 밴드 — 참가 자격과 참가 혜택을 한 그릇에 두 묶음으로 */
function aboutBand(d) {
  const elig = eligibilityBlock(d);
  const benefits = Array.isArray(d.benefits) ? d.benefits : [];
  if (!elig && !benefits.length) return '';
  const who = elig ? `<div class="grp">${secTitle('who', '이런 분께 딱이에요')}${elig}</div>` : '';
  const gift = benefits.length ? `<div class="grp">${secTitle('gift', '이런 걸 드려요')}
    <ul class="benefits">${benefits.map((b) => `<li><span class="chk">${CHECK('chk__ic')}</span><span>${esc(stripMarker(b))}</span></li>`).join('')}</ul></div>` : '';
  return `<section class="sec">${who}${gift}</section>`;
}

/* 주의사항 (기본값, detail.cautions 배열로 덮어쓰기) */
function cautionsList(d) {
  const items = (Array.isArray(d.cautions) && d.cautions.length) ? d.cautions : [
    '본인 명의 블로그 1개로만 참여할 수 있으며, 도배·어뷰징 시 선발에서 제외됩니다.',
    '신청 시 입력한 휴대폰 번호로 선발·리워드 안내가 발송됩니다.',
    '주차별 미션은 정해진 기간 안에 제출해야 활동으로 인정됩니다.',
    '일정·리워드는 운영 사정에 따라 변동될 수 있습니다.',
  ];
  return `<ul class="cautions">${items.map((x) => `<li>${esc(stripMarker(x))}</li>`).join('')}</ul>`;
}
// 부수 정보라 밴드를 벗겨 회색 바닥 위에 얹는다(강-중-약 리듬의 '약')
function cautionsSection(d) {
  return `<section class="sec sec--bare">${secTitle('warn', '꼭 확인하세요')}${cautionsList(d)}</section>`;
}

const challengeStatus = () => (DATA && DATA.challenge ? DATA.challenge.status : '');

function route() {
  const v = landingView(challengeStatus(), location.hash);
  if (v === VIEW.WRAPUP) return renderWrapup();
  if (v === VIEW.SUBMIT) return renderSubmit();
  if (v === VIEW.LANDING) return renderLanding();
  return renderGate(v);
}

// 상태 때문에 막힌 진입의 안내 화면. 껍데기는 하나, 문구만 분기한다.
// WHY: '아직 안 열림'과 '이미 끝남'은 참가자에게 정반대 정보라 같은 문구를 쓸 수 없다.
function gateCopy(view, c) {
  if (view === VIEW.PREPARING) {
    const openAt = upcomingOpenDate(c['모집시작'], toYmd(new Date()));
    return {
      title: '준비 중인 챌린지',
      sub: openAt ? `${fmtMD(openAt)}부터 모집이 열립니다.` : '아직 모집이 시작되지 않았습니다.',
      body: '지금은 신청을 받고 있지 않아요.<br>모집이 열리면 이 페이지에서 바로 신청하실 수 있습니다.',
      action: c.openchatUrl
        ? `<a class="btn btn--secondary btn--sm" href="${esc(c.openchatUrl)}" target="_blank" rel="noopener" style="margin-top:16px">오픈카톡 문의</a>`
        : '',
    };
  }
  if (view === VIEW.WRAPUP_LOCKED) {
    return {
      title: '진행 중인 챌린지',
      sub: '마무리 리워드 신청은 아직 열리지 않았습니다.',
      body: '모든 회차가 끝난 뒤에 이 페이지에서 리워드를 신청하실 수 있어요.',
      action: '<p class="center muted" style="margin-top:14px;font-size:13px"><a href="#submit">주차 제출하러 가기 →</a></p>',
    };
  }
  return {
    title: '종료된 챌린지',
    sub: '이 챌린지는 종료되었습니다.',
    body: '함께해 주셔서 감사합니다.<br>신청과 주차 제출은 마감되었습니다.',
    action: '<a class="btn btn--primary btn--block" href="#wrapup" style="margin-top:16px">리워드 신청하기</a>',
  };
}

function renderGate(view) {
  const c = DATA.challenge || {};
  const t = gateCopy(view, c);
  app.innerHTML = `
    <header class="hero"><div class="hero__panel"><span class="hero__eyebrow">${esc(c.name)}</span>
      <h1 class="hero__title" style="font-size:clamp(26px,7vw,38px)">${esc(t.title)}</h1></div>
      <p class="hero__sub">${esc(t.sub)}</p></header>
    <div class="wrap" style="padding-top:28px">
      <div class="card center">
        <p class="muted" style="line-height:1.75;margin-bottom:4px">${t.body}</p>
        ${t.action}
      </div>
    </div>`;
}

function rewardSection(d, c) {
  d = d || {};
  if (d.rewardType === 'grade' && Array.isArray(d.rewardTiers) && d.rewardTiers.length) {
    const tiers = d.rewardTiers.slice().sort((a, b) => a.min - b.min);
    // 구간 범위는 전체 티어로 계산하되, 0P 구간은 표에서 빼고 각주로 내린다.
    // WHY: 표 첫 행이 '0P'면 리워드 섹션에서 눈이 처음 닿는 값이 0이 된다.
    const all = tiers.map((t, i) => {
      const next = tiers[i + 1];
      const range = next ? (next.min - 1 > t.min ? `${t.min}~${next.min - 1}개` : `${t.min}개`) : `${t.min}개 이상`;
      return { amount: Number(t.amount) || 0, min: Number(t.min) || 0, range };
    });
    const paid = all.filter((t) => t.amount > 0);
    if (!paid.length) return '';
    const rows = paid.map((t) => `<tr><td>${esc(t.range)} 작성</td><td class="num"><b>${t.amount.toLocaleString()}P</b></td></tr>`).join('');
    const floor = (all.length > paid.length && paid[0].min > 0)
      ? `<p class="reward-note">${paid[0].min}개 미만 작성 시에는 지급되지 않아요.</p>` : '';
    return `<section class="sec sec--dark">${secTitle('coin', '리워드')}
      <table class="reward-table"><thead><tr>
        <th>작성 개수</th><th class="num">네이버페이 포인트</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="reward-note">작성 개수가 많을수록 리워드 ↑ · 우수활동자는 <b style="color:var(--lp-pop)">×2</b></p>${floor}</section>`;
  }
  const amt = Number(d.rewardAmount || c.rewardPerPost || 0);
  if (!amt) return '';
  return `<section class="sec sec--dark reward-card" style="text-align:center">
    ${d.rewardType === 'per_milestone' ? '목표 달성 시 리워드 지급' : '제출 1건당 리워드 적립'}<br>
    <b>${amt.toLocaleString()}P</b><br><span style="color:rgba(255,255,255,.7)">네이버페이 · 우수활동자 ×2</span></section>`;
}

/* 신청 바텀시트 — 플로팅 CTA로 연다. 배경 스크롤 잠금·ESC·포커스 트랩 포함. */
function bindSheet() {
  const sheet = $('#a-sheet'), openBtn = $('#a-open');
  if (!sheet || !openBtn) return;
  const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
  let lastFocus = null;

  const close = () => {
    sheet.hidden = true;
    sheet.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (lastFocus) lastFocus.focus();
  };
  const open = () => {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add('is-locked');
    // hidden 해제 직후 같은 프레임에 클래스를 주면 트랜지션이 안 걸린다
    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      const first = sheet.querySelector('#a-name');
      if (first) first.focus();
    });
  };

  openBtn.addEventListener('click', open);
  $('#a-close').addEventListener('click', close);
  $('#a-scrim').addEventListener('click', close);
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
}

/* ---------- 랜딩 + 신청 ---------- */
function renderLanding() {
  const c = DATA.challenge, d = DATA.detail || {};
  const closed = !canApply(c.status);
  const reward = d.rewardAmount || c.rewardPerPost;
  const rounds = c.totalRounds || 10;
  const recruit = (c['모집시작'] && c['모집마감']) ? `모집 ${fmtMD(c['모집시작'])} – ${fmtMD(c['모집마감'])}`
    : c['모집마감'] ? `~ ${fmtMD(c['모집마감'])} 모집 마감` : '';
  app.innerHTML = `
    <header class="hero">
      <div class="hero__badges reveal reveal-1">
        ${reward ? `<span class="pbadge pbadge--pop disp">활동비 지급</span>` : ''}
        <span class="pbadge disp">${esc(rounds)}주 과정</span>
      </div>
      <div class="hero__panel reveal reveal-2">
        <span class="hero__eyebrow">${esc(autoTagline(c, d))}</span>
        <h1 class="hero__title">${esc(c.name)}</h1>
      </div>
      <div class="hero__facts reveal reveal-3">
        <span class="hfact hfact--status ${closed ? 'is-closed' : ''}">${closed ? '모집 마감' : '모집 중'}</span>
        ${recruit ? `<span class="hfact">${esc(recruit)}</span>` : ''}
        ${reward ? `<span class="hfact">네이버페이 리워드</span>` : ''}
      </div>
      ${d.concept ? `<div class="hero__sub reveal reveal-4">${richText(d.concept)}</div>` : ''}
    </header>
    <div class="wrap">
      ${aboutBand(d)}
      ${rewardSection(d, c)}
      ${howBand(c, d)}
      ${cautionsSection(d)}

      ${c.openchatUrl ? `<p class="center" style="margin-top:24px"><a class="btn btn--secondary btn--sm" href="${esc(c.openchatUrl)}" target="_blank">오픈카톡 문의</a></p>` : ''}
    </div>
    <!-- 플로팅 CTA — 페이지 어디서든 항상 보인다. 마감이어도 숨기지 않고 상태를 말한다. -->
    <div class="cta-dock">
      <button class="btn btn--primary btn--block cta-dock__btn" id="a-open"${closed ? ' disabled' : ''}>
        ${closed ? '모집 마감' : '신청하기'}
      </button>
    </div>
    ${closed ? '' : `
    <div class="sheet" id="a-sheet" hidden>
      <div class="sheet__scrim" id="a-scrim"></div>
      <div class="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="a-sheet-t">
        <div class="sheet__head">
          <h2 class="sheet__title" id="a-sheet-t">참가 신청</h2>
          <button type="button" class="sheet__x" id="a-close" aria-label="닫기">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.4 4 10 8.6 14.6 4 16 5.4 11.4 10l4.6 4.6-1.4 1.4L10 11.4 5.4 16 4 14.6 8.6 10 4 5.4 5.4 4Z" fill="currentColor"/></svg>
          </button>
        </div>
        <div class="sheet__body">
          <div class="field"><label class="field__label" for="a-name">성함 <span class="req">*</span></label>
            <input class="input" id="a-name" placeholder="예) 김고방" /><div class="field__hint">띄어쓰기 없이 입력해 주세요.</div></div>
          <div class="field"><label class="field__label" for="a-phone">휴대폰 번호 <span class="req">*</span></label>
            <input class="input tnum" id="a-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" /><div class="field__hint">결과·리워드 안내를 받을 번호예요.</div></div>
          <div class="field"><label class="field__label" for="a-blog">참가할 블로그 URL <span class="req">*</span></label>
            <div class="blogrow"><input class="input" id="a-blog" type="url" placeholder="https://blog.naver.com/..." />
              <button type="button" class="btn btn--secondary" id="a-blogcheck">확인</button></div>
            <div class="field__hint">본인 명의 블로그 1개 (도배·어뷰징 불가). URL 입력 후 <b>확인</b>으로 내 블로그가 맞는지 봐주세요.</div>
            <div id="a-blogprev" class="blogprev" style="display:none"></div></div>
          <label class="checkrow"><input type="checkbox" id="a-agree" /><span>성명·휴대폰 번호 수집 및 이벤트 종료 시까지 보유에 동의합니다. (필수)</span></label>
          <div class="field__err" id="a-err" style="display:none"></div>
        </div>
        <div class="sheet__foot">
          <button class="btn btn--primary btn--block" id="a-submit">신청하기</button>
        </div>
      </div>
    </div>`}`;

  if (closed) return;
  bindSheet();
  bindPhone($('#a-phone'));
  // 블로그 URL 미리보기(크롤링) — 본인 블로그 확인용
  const checkBlog = async () => {
    const url = $('#a-blog').value.trim();
    const prev = $('#a-blogprev');
    if (!/^https?:\/\/.+/.test(url)) { prev.style.display = 'none'; return toast('블로그 URL을 입력하세요.', true); }
    const btn = $('#a-blogcheck'); const old = btn.textContent; btn.disabled = true; btn.textContent = '확인 중…';
    const r = await apiGet({ action: 'blogInfo', url }).catch(() => ({ ok: false }));
    btn.disabled = false; btn.textContent = old;
    if (!r.ok || !(r.title || r.image)) {
      prev.style.display = 'block';
      prev.innerHTML = '<div class="blogprev__empty">정보를 불러오지 못했어요. URL이 정확한지 확인해 주세요. (그래도 신청은 가능)</div>';
      return;
    }
    prev.style.display = 'block';
    prev.innerHTML = `
      ${r.image ? `<img class="blogprev__img" src="${esc(r.image)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : ''}
      <div class="blogprev__body">
        <div class="blogprev__t">${esc(r.title || '제목 없음')}</div>
        ${r.desc ? `<div class="blogprev__d">${esc(r.desc)}</div>` : ''}
        <div class="blogprev__ok">${CHECK('ico-inline')} 이 블로그가 맞나요?</div>
      </div>`;
  };
  $('#a-blogcheck').addEventListener('click', checkBlog);
  $('#a-blog').addEventListener('blur', () => { if ($('#a-blog').value.trim()) checkBlog(); });
  $('#a-submit').addEventListener('click', async (e) => {
    const name = $('#a-name').value.trim();
    const phone = $('#a-phone').value.trim();
    const blogUrl = $('#a-blog').value.trim();
    const agree = $('#a-agree').checked;
    const errs = [];
    if (!name) errs.push('성함');
    if (!normPhone(phone)) errs.push('올바른 휴대폰 번호');
    if (!/^https?:\/\/.+/.test(blogUrl)) errs.push('블로그 URL');
    if (!agree) errs.push('개인정보 동의');
    const errEl = $('#a-err');
    if (errs.length) { errEl.style.display = 'block'; errEl.textContent = errs.join(', ') + '을(를) 확인해 주세요.'; return; }
    errEl.style.display = 'none';
    e.target.disabled = true; e.target.textContent = '신청 중…';
    const r = await apiPost({ action: 'apply', challengeId: cid, name, phone, blogUrl, agree: true }).catch(() => ({ ok: false }));
    if (r.ok) renderDone('신청 완료!', '참여가 확정되었어요. 바로 주차 미션을 시작할 수 있어요.');
    else { e.target.disabled = false; e.target.textContent = '신청하기'; errEl.style.display = 'block'; errEl.textContent = '신청 실패: ' + (r.error || Object.values(r.errors || {}).join(', ')); }
  });
}

function renderDone(title, sub) {
  const c = DATA.challenge;
  document.body.classList.remove('is-locked'); // 시트에서 제출했으면 잠금이 남아 있다
  app.innerHTML = `<div class="wrap"><div class="done">
    <div class="done__icon">${CHECK('done__ic')}</div>
    <h1 class="done__title">${esc(title)}</h1>
    <p class="muted" style="margin-top:12px">${esc(sub)}</p>
    <div class="linkbtns">
      <a class="btn btn--primary btn--sm" href="#submit">주차 제출하기</a>
    </div></div></div>`;
}

/* ---------- 주차 제출 ---------- */
const PHONE_KEY = (id) => `challenge.phone.${id}`;
const BLOG_KEY = (id) => `challenge.blog.${id}`;
const STATUS_KEY = (id) => `challenge.status.${id}`; // 마지막 조회 결과(즉시 표시용)
const getCachedStatus = (id) => { try { return JSON.parse(localStorage.getItem(STATUS_KEY(id)) || 'null'); } catch (e) { return null; } };
const setCachedStatus = (id, r, phone) => { try { localStorage.setItem(STATUS_KEY(id), JSON.stringify({ r, phone })); } catch (e) {} };
function renderSubmit() {
  const c = DATA.challenge, d = DATA.detail || {};
  const savedPhone = localStorage.getItem(PHONE_KEY(cid)) || '';
  const savedBlog = localStorage.getItem(BLOG_KEY(cid)) || '';
  app.innerHTML = `
    <header class="hero" id="s-hero"><div class="hero__panel"><span class="hero__eyebrow">${esc(c.name)}</span>
      <h1 class="hero__title" style="font-size:clamp(26px,7vw,36px)">주차 미션 제출</h1></div></header>
    <div class="wrap" style="padding-top:28px">
    <div class="card" id="s-loginCard">
      <div class="field"><label class="field__label">휴대폰 번호 <span class="req">*</span></label>
        <input class="input tnum" id="s-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" value="${esc(savedPhone)}" /></div>
      <div class="field"><label class="field__label">참가한 블로그 URL <span class="req">*</span></label>
        <input class="input" id="s-blog" type="url" placeholder="https://blog.naver.com/..." value="${esc(savedBlog)}" /></div>
      <button class="btn btn--primary btn--block" id="s-check">확인</button>
      <div class="field__hint" style="margin-top:8px">신청 때 등록한 휴대폰·블로그로 본인 확인해요. 이 기기에 저장됩니다.</div>
    </div>
    <div id="s-status"></div>
  </div>`;
  bindPhone($('#s-phone'));
  $('#s-check').addEventListener('click', () => loadStatus());
  $('#s-phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadStatus(); });
  $('#s-blog').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadStatus(); });
  if (normPhone(savedPhone) && savedBlog) {
    const cached = getCachedStatus(cid);
    if (cached && cached.r && cached.r.ok && cached.r.selected) {
      renderDashboard(cached.r, cached.phone || normPhone(savedPhone)); // 캐시로 즉시 표시(로그인창·스피너 생략)
      loadStatus(true); // 백그라운드 최신화
    } else {
      loadStatus(); // 첫 방문: 일반 조회(스피너)
    }
  }
}
async function loadStatus(silent) {
  const phone = $('#s-phone').value.trim();
  const blogUrl = $('#s-blog') ? $('#s-blog').value.trim() : '';
  if (!normPhone(phone)) { if (silent) return; return toast('올바른 휴대폰 번호를 입력하세요.', true); }
  if (!/^https?:\/\/.+/.test(blogUrl)) { if (silent) return; return toast('참가한 블로그 URL을 입력하세요.', true); }
  localStorage.setItem(PHONE_KEY(cid), normPhone(phone)); // 이 기기에 기억
  localStorage.setItem(BLOG_KEY(cid), blogUrl);
  const box = $('#s-status');
  if (!silent && box) box.innerHTML = '<div class="loading"><span class="spinner"></span> 조회 중…</div>';
  const r = await apiGet({ action: 'myStatus', challengeId: cid, phone, blogUrl }).catch(() => ({ ok: false }));
  if (!r.ok) {
    if (silent) return; // 백그라운드 실패 시 캐시 화면 유지
    const msg = r.error === 'blog_mismatch' ? '블로그 URL이 신청 정보와 일치하지 않습니다.'
      : r.error === 'not_found' ? '신청 내역이 없습니다.' : '조회 실패';
    box.innerHTML = `<div class="card center muted">${msg}</div>`; return;
  }
  if (!r.selected) {
    localStorage.removeItem(STATUS_KEY(cid));
    if (silent) return;
    box.innerHTML = `<div class="card center muted">아직 선발 전이거나 선발되지 않았습니다.<br>발표일을 기다려 주세요.</div>`; return;
  }
  const cached = getCachedStatus(cid);
  setCachedStatus(cid, r, normPhone(phone));
  // 백그라운드 최신화인데 내용이 동일하면 다시 그리지 않음(깜빡임 방지)
  if (silent && cached && JSON.stringify(cached.r) === JSON.stringify(r)) return;
  renderDashboard(r, normPhone(phone));
}

// 회차 1건 카드 — 오픈=제출폼, 마감=읽기전용, 예정=잠김
function weekCard(w, d, excellent) {
  const st = String(w.status || '');
  const isOpen = st === '오픈';
  const isClosed = st === '마감';
  const stBadge = isOpen ? '<span class="wk-badge wk-badge--open">오픈</span>'
    : isClosed ? '<span class="wk-badge wk-badge--closed">마감</span>'
      : '<span class="wk-badge wk-badge--soon">예정</span>';
  const subBadge = w.submitted ? `<span class="wk-badge wk-badge--done">${CHECK('ico-inline')} 제출완료</span>`
    : (isOpen ? '<span class="wk-badge wk-badge--todo">미제출</span>' : '');
  const openMd = w['오픈일'] ? fmtMD(w['오픈일']) : '';
  const closeMd = w['마감일'] ? fmtMD(w['마감일']) : '';
  const dd = w['마감일'] ? dday(w['마감일']) : '';
  const period = (openMd || closeMd)
    ? `<span class="wk-due">${openMd || '?'} ~ ${closeMd || '?'}${dd ? ` · <b class="wk-dday">${dd}</b>` : ''}</span>` : '';
  const exBadge = excellent ? '<span class="wk-badge wk-badge--star">★ 우수활동자</span>' : '';
  const head = `<div class="wk-card__head"><span class="wk-card__n">${esc(w.week)}주차</span>${stBadge}${subBadge}${exBadge}${period}</div>`;
  if (!isOpen && !isClosed && !w.submitted) {
    return `<div class="wk-card is-soon">${head}<p class="muted" style="font-size:13px;margin-top:8px">아직 열리지 않았어요.</p></div>`;
  }
  const articleRef = (w.articleName || w.articleUrl)
    ? `<div class="wk-row"><span class="wk-row__tag">아티클</span><div class="wk-row__val"><a class="wk-ref__a" href="${esc(w.articleUrl || '#')}" target="_blank" rel="noopener"><span class="wk-ref__nm">${esc(w.articleName || '아티클 보기')}</span><span class="wk-ref__go">↗</span></a></div></div>` : '';
  const kw = w.body ? `<div class="wk-row wk-row--kw"><span class="wk-row__tag">키워드</span><div class="wk-row__val">${kwChips(w.body)}</div></div>` : '';
  const material = (articleRef || kw) ? `<div class="wk-set">${articleRef}${kw}</div>` : '';
  const form = isOpen ? `<div class="wk-submitbox">
      <div class="wk-submit__label">이번 주 작성한 게시물 URL${w.submitted ? ' <span class="wk-submit__done">· 제출완료</span>' : ''}</div>
      <div class="wk-submit">
        <input class="input" id="s-url-${esc(w.week)}" type="url" placeholder="https://blog.naver.com/.../게시물" value="${esc(w.submittedUrl || '')}"${w.submitted ? ' disabled' : ''} />
        <button class="btn ${w.submitted ? 'btn--secondary' : 'btn--primary'}" data-week="${esc(w.week)}">${w.submitted ? '수정' : '제출하기'}</button>
      </div>
      <p class="wk-note">※ 제출 전 <b>작성가이드</b>를 꼭 확인하세요. 지키지 않은 글은 반려될 수 있어요.</p></div>`
    : (w.submittedUrl ? `<div class="wk-done-url"><a href="${esc(w.submittedUrl)}" target="_blank" rel="noopener">제출한 게시물 ↗</a></div>` : '');
  return `<div class="wk-card ${isOpen ? 'is-open' : ''}">${head}${material}${form}</div>`;
}

function renderDashboard(r, phone) {
  const c = DATA.challenge || {};
  const d = DATA.detail || {};
  const p = r.progress || { done: 0, total: 0 };
  const box = $('#s-status');
  const weeks = (Array.isArray(r.weeks) && r.weeks.length) ? r.weeks
    : (r.current ? [{ week: r.current.week, status: '오픈', '마감일': r.current['마감일'], articleName: r.current.articleName, articleUrl: r.current.articleUrl, body: r.current.body, submitted: r.current.submitted, submittedUrl: r.current.submittedUrl }] : []);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const setupCommon = () => {
    const lc = $('#s-loginCard'); if (lc) lc.style.display = 'none'; // 본인확인 후 입력칸 숨김
    const hero = $('#s-hero');
    if (hero) hero.outerHTML = `
      <header class="hero hero--auth" id="s-hero"><div class="hero__panel">
        <div class="shead">
          <div class="shead__id"><span class="hero__eyebrow" style="margin:0">${esc(c.name)}</span>
            <div class="shead__name"><b>${esc(r.name)}</b>님</div></div>
          <button class="btn btn--ghost btn--sm shead__out" id="s-logout">로그아웃</button>
        </div>
        <div class="shead__prog">
          <div class="shead__progtop"><span>제출 진행</span><b>${p.done}<i>/${p.total}</i></b></div>
          <div class="shead__bar"><span style="width:${pct}%"></span></div>
        </div>
      </div></header>`;
    $('#s-logout').addEventListener('click', () => { localStorage.removeItem(PHONE_KEY(cid)); localStorage.removeItem(STATUS_KEY(cid)); renderSubmit(); });
  };
  if (!weeks.length) { box.innerHTML = `<div class="card center muted">현재 열린 회차가 없습니다.</div>`; setupCommon(); return; }

  const chips = weeks.map((w) => {
    const st = String(w.status || '');
    let cls = w.submitted ? 'is-done' : (st === '오픈' ? 'is-open' : (st === '마감' ? 'is-closed' : 'is-soon'));
    const dd = (st === '오픈' && w['마감일']) ? dday(w['마감일']) : '';
    const urgent = !w.submitted && st === '오픈' && (dd === 'D-DAY' || /^D-[0-2]$/.test(dd));
    if (urgent) cls += ' is-urgent';
    const label = w.submitted ? '완료' : (st === '오픈' ? (dd || '오픈') : (st === '마감' ? '마감' : '대기'));
    return `<button class="wkchip ${cls}" data-chip="${esc(w.week)}">${w.excellent ? '<span class="wkchip__star" title="우수활동자">★</span>' : ''}<span class="wkchip__n">${esc(w.week)}주</span><span class="wkchip__st">${label}</span></button>`;
  }).join('');

  // 학습 자료 — 운영팀이 작성한 안내(작성가이드·유의사항)와 외부 교재 링크
  const ICO_BOOK = '<svg class="ssec__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  const ICO_TASK = '<svg class="ssec__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 13 2 2 4-4"/></svg>';
  // 교재는 머리글 없이 단독 버튼으로 맨 위 — 핵심 행동(제출)을 위로 올리려 학습 자료에서 분리했다
  const eduSection = d.eduUrl ? `<section class="ssec"><a class="resbtn" href="${esc(d.eduUrl)}" target="_blank" rel="noopener"><svg class="resbtn__ic" width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 4.8C4.6 4.2 7 4.6 9 5.8V16.2C7 15 4.6 14.6 2 15.2Z" fill="#fff"/><path d="M18 4.8C15.4 4.2 13 4.6 11 5.8V16.2C13 15 15.4 14.6 18 15.2Z" fill="#fff"/></svg>교육자료(교재) 바로가기<span class="resbtn__go">↗</span></a></section>` : '';

  const weekSection = `<section class="ssec ssec--mission">
    <h2 class="ssec__h">${ICO_TASK}이번 주 미션</h2>
    <div class="wkchips">${chips}</div>
    <div id="wkdetail"></div>
  </section>`;

  const learnSection = `<section class="ssec">
    <h2 class="ssec__h">${ICO_BOOK}학습 자료</h2>
    ${d.guide ? `<details class="wkguide"><summary>작성가이드</summary><div class="prose wk-body">${richText(d.guide)}</div></details>` : ''}
    <details class="wkguide"><summary>유의사항</summary><div class="wk-cautions">${d.notice ? richText(d.notice) : cautionsList(d)}</div></details>
  </section>`;

  box.innerHTML = eduSection + weekSection + learnSection;
  setupCommon();

  const select = (wk) => {
    const w = weeks.find((x) => String(x.week) === String(wk)) || weeks[0];
    box.querySelectorAll('.wkchip').forEach((c) => c.classList.toggle('is-active', c.dataset.chip === String(w.week)));
    const active = box.querySelector('.wkchip.is-active'), cont = box.querySelector('.wkchips');
    if (active && cont) cont.scrollLeft += active.getBoundingClientRect().left + active.offsetWidth / 2 - (cont.getBoundingClientRect().left + cont.offsetWidth / 2);
    $('#wkdetail').innerHTML = weekCard(w, d, w.excellent);
    const b = $('#wkdetail').querySelector('[data-week]');
    if (b) b.addEventListener('click', () => submitWeek(phone, b));
  };
  box.querySelectorAll('.wkchip').forEach((c) => c.addEventListener('click', () => select(c.dataset.chip)));
  const chipCont = box.querySelector('.wkchips');
  if (chipCont) {
    chipCont.addEventListener('wheel', (e) => { if (e.deltaY) { e.preventDefault(); chipCont.scrollLeft += e.deltaY; } }, { passive: false });
    // 클릭&끌기 가로 스크롤. setPointerCapture는 click 타깃을 컨테이너로 바꿔 칩 클릭을 막으므로 쓰지 않는다.
    let down = false, sx = 0, sl = 0, moved = false;
    chipCont.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      down = true; moved = false; sx = e.clientX; sl = chipCont.scrollLeft;
    });
    chipCont.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; chipCont.classList.add('is-dragging'); }
      if (moved) chipCont.scrollLeft = sl - dx;
    });
    const end = () => { down = false; chipCont.classList.remove('is-dragging'); };
    chipCont.addEventListener('pointerup', end);
    chipCont.addEventListener('pointerleave', end);
    chipCont.addEventListener('pointercancel', end);
    // 실제로 끌었을 때만 클릭(칩 선택) 무시. 단순 클릭은 그대로 통과.
    chipCont.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  }
  const def = weeks.find((w) => String(w.status) === '오픈') || weeks.find((w) => !w.submitted) || weeks[0];
  select(def.week);
}

async function submitWeek(phone, btn) {
  const wk = btn.dataset.week;
  const input = $(`#s-url-${wk}`);
  if (input.disabled) { // 제출완료 → '수정' 클릭: 입력 활성화 후 재제출 대기
    input.disabled = false; input.focus();
    btn.textContent = '제출하기'; btn.classList.remove('btn--secondary'); btn.classList.add('btn--primary');
    return;
  }
  const url = input.value.trim();
  if (!/^https?:\/\/.+/.test(url)) return toast('게시물 URL을 입력하세요.', true);
  btn.disabled = true; const old = btn.textContent; btn.textContent = '제출 중…';
  const r = await apiPost({ action: 'submit', challengeId: cid, phone, week: wk, postUrl: url }).catch(() => ({ ok: false }));
  if (r.ok) { toast('제출 완료!'); loadStatus(); }
  else {
    btn.disabled = false; btn.textContent = old;
    const msg = r.error === 'week_not_open' ? '해당 주차가 열려 있지 않습니다.'
      : r.error === 'invalid_week' ? '존재하지 않는 회차입니다.'
      : r.error === 'invalid_url' ? '게시물 URL을 확인하세요.' : ('제출 실패: ' + (r.error || ''));
    toast(msg, true);
  }
}

/* ---------- 마무리 ---------- */
function renderWrapup() {
  const c = DATA.challenge || {}, d = DATA.detail || {};
  const max = Number(c.totalRounds || 10);
  const tiers = (Array.isArray(d.rewardTiers) && d.rewardTiers.length)
    ? d.rewardTiers.slice().sort((a, b) => Number(a.min) - Number(b.min))
    : [{ min: 0, amount: 0 }, { min: 2, amount: 3000 }, { min: 5, amount: 5000 }, { min: 10, amount: 10000 }];
  const unit = d.rewardUnit || '네이버페이';
  const tierRows = tiers.map((t, i) => {
    const next = tiers[i + 1];
    const range = next ? `${t.min}~${Number(next.min) - 1}개` : `${t.min}개 이상`;
    const amt = Number(t.amount) || 0;
    return `<li><span class="wru-range">${range} 작성</span><b class="wru-amt">${unit} ${amt.toLocaleString('ko-KR')} P</b></li>`;
  }).join('');
  app.innerHTML = `
    <header class="hero"><div class="hero__panel"><span class="hero__eyebrow">${esc(c.name)}</span>
      <h1 class="hero__title" style="font-size:clamp(24px,6vw,34px)">챌린지 마무리 · 리워드 신청</h1></div>
      <p class="hero__sub">완주를 진심으로 축하합니다 🎉</p></header>
    <div class="wrap" style="padding-top:24px">
      <section class="card wru-intro">
        <p><b>${esc(c.name)}</b>가 드디어 끝났습니다! 🎉</p>
        <p>이번 챌린지를 통해</p>
        <ul class="wru-stars">
          <li>검색 상위에 노출되는 <b>키워드 전략력</b></li>
          <li>독자의 행동을 유도하는 <b>콘텐츠 기획력</b></li>
          <li>데이터를 분석하고 개선하는 <b>운영 최적화 감각</b></li>
        </ul>
        <p>실무에서 바로 써먹을 수 있는 블로그 운영 역량을 쌓으셨을 거예요. 💪</p>
        <p class="wru-cta">💙 아래 폼을 꼭 작성하고 <b>챌린지 리워드</b>를 받아가세요! 💙<br>함께해 주셔서 진심으로 감사합니다. 😊</p>
      </section>

      <section class="card">
        <div class="sec__title" style="font-size:18px;margin-bottom:14px">리워드 상세</div>
        <ul class="wru-tiers">${tierRows}</ul>
        <div class="wru-notes">
          <p>※ <b>화요일 10:00</b> 이전까지 폼을 제출하지 않으면 리워드를 받을 수 없습니다.</p>
          <p>※ 문의는 오픈카카오톡으로 연락주세요.${c.openchatUrl ? ` <a href="${esc(c.openchatUrl)}" target="_blank" rel="noopener">문의하기 ↗</a>` : ''}</p>
        </div>
      </section>

      <section class="card">
        <div class="sec__title" style="font-size:18px;margin-bottom:14px">리워드 신청</div>
        <div class="field"><label class="field__label">성함 <span class="req">*</span></label>
          <input class="input" id="w-name" type="text" placeholder="예: 김고방" /></div>
        <div class="field"><label class="field__label">리워드 수령 휴대폰 번호 <span class="req">*</span></label>
          <input class="input tnum" id="w-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" /></div>
        <div class="field"><label class="field__label">참가한 블로그 URL <span class="req">*</span></label>
          <input class="input" id="w-blog" type="url" placeholder="https://blog.naver.com/..." />
          <div class="field__hint">1인 1블로그만 인정됩니다.</div></div>
        <div class="field"><label class="field__label">작성한 블로그 갯수 <span class="req">*</span></label>
          <select class="input" id="w-count">
            <option value="">선택하세요</option>
            ${Array.from({ length: max + 1 }, (_, i) => `<option value="${i}">${i}개</option>`).join('')}
          </select></div>
        <div class="field"><label class="field__label">우수활동자 여부 <span class="req">*</span></label>
          <div class="radio-row">
            <label class="radio-pill"><input type="radio" name="w-ex" value="Y" /><span>예 (우수활동자)</span></label>
            <label class="radio-pill"><input type="radio" name="w-ex" value="N" checked /><span>아니오</span></label>
          </div>
          <div class="field__hint">우수활동자는 리워드가 2배 지급됩니다.</div></div>
        <label class="checkrow"><input type="checkbox" id="w-agree" /><span>개인정보 수집·이용에 동의합니다.</span></label>
        <button class="btn btn--primary btn--block" id="w-do" style="margin-top:12px">리워드 신청 제출</button>
      </section>
    </div>`;
  bindPhone($('#w-phone'));
  $('#w-do').addEventListener('click', async (e) => {
    const name = $('#w-name').value.trim();
    const phone = $('#w-phone').value.trim();
    const blogUrl = $('#w-blog').value.trim();
    const countV = $('#w-count').value;
    const exEl = $('input[name="w-ex"]:checked');
    const excellent = exEl ? exEl.value : '';
    if (!name) return toast('성함을 입력하세요.', true);
    if (!normPhone(phone)) return toast('휴대폰 번호를 확인하세요.', true);
    if (!/^https?:\/\/.+/.test(blogUrl)) return toast('블로그 URL을 확인하세요.', true);
    if (countV === '') return toast('작성 갯수를 선택하세요.', true);
    if (!excellent) return toast('우수활동자 여부를 선택하세요.', true);
    if (!$('#w-agree').checked) return toast('개인정보 수집·이용에 동의해 주세요.', true);
    e.target.disabled = true; e.target.textContent = '제출 중…';
    const r = await apiPost({ action: 'wrapup', challengeId: cid, name, phone, blogUrl, postCount: Number(countV), excellent, agree: true }).catch(() => ({ ok: false }));
    if (r.ok) renderDone('리워드 신청 완료!', '정산 후 네이버페이 포인트로 안내드릴게요. 수고하셨습니다 🎉');
    else { e.target.disabled = false; e.target.textContent = '리워드 신청 제출'; toast('실패: ' + (r.error || (r.errors && Object.values(r.errors)[0]) || ''), true); }
  });
}

boot();
