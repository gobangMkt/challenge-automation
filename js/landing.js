import { apiGet, apiPost } from './api.js';
import { pickTheme, DISPLAY_FONTS } from './themes.js';

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

// 줄머리 불렛/번호 마커 제거 (★·☆·▶ 등 포함)
const BULLET = '[-•*·–—▪◦‣★☆◆▶▷✓✔]';
const stripMarker = (s) => String(s || '').replace(new RegExp(`^\\s*(?:${BULLET}|\\d+[.)])\\s+`), '').trim();

// 평문을 붙여넣은 그대로 렌더: 빈 줄=문단 분리, 단일 줄바꿈=<br>,
// 블록 전체가 ★/-/숫자로 시작하면 리스트로 변환.
function richText(str) {
  const blocks = String(str == null ? '' : str).replace(/\r/g, '').split(/\n[ \t]*\n+/);
  const ulRe = new RegExp(`^${BULLET}\\s+`);
  const olRe = /^\d+[.)]\s+/;
  let html = '';
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => ulRe.test(l))) {
      html += `<ul class="rich-list">${lines.map((l) => `<li>${esc(l.replace(ulRe, ''))}</li>`).join('')}</ul>`;
    } else if (lines.every((l) => olRe.test(l))) {
      html += `<ol class="rich-list">${lines.map((l) => `<li>${esc(l.replace(olRe, ''))}</li>`).join('')}</ol>`;
    } else {
      html += `<p class="rich-p">${lines.map((l) => esc(l)).join('<br>')}</p>`;
    }
  }
  return html;
}

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

/* 참여 방법 Step (공통 동선) */
function stepsSection(c) {
  const steps = [
    { t: '참가 신청', d: `모집 기간에 신청서를 작성하세요.${c['모집마감'] ? ` (~${fmtMD(c['모집마감'])} 마감)` : ''}` },
    { t: '참가자 선발', d: `발표일에 선발 결과를 개별 안내드려요.${c['발표일'] ? ` (${fmtMD(c['발표일'])} 발표)` : ''}` },
    { t: '주차별 실습', d: `시작일부터 ${c.totalRounds || 10}주간 미션을 수행합니다.${c['시작일'] ? ` (${fmtMD(c['시작일'])} 시작)` : ''}` },
  ];
  return `<section class="sec"><h2 class="sec__title">참여 방법</h2><div class="steps">
    ${steps.map((s, i) => `<div class="step"><div class="step__n">${i + 1}</div>
      <div><div class="step__t">${esc(s.t)}</div><div class="step__d">${esc(s.d)}</div></div></div>`).join('')}
  </div></section>`;
}

/* 일정 — 시작일 있으면 주차별 표, 없으면 scheduleText 프로즈 */
function scheduleSection(c, d) {
  const rounds = Number(c.totalRounds) || 0;
  if (c['시작일'] && rounds) {
    const rows = Array.from({ length: rounds }, (_, i) =>
      `<tr><td>${i + 1}주차</td><td>${addDays(c['시작일'], i * 7)} 시작</td></tr>`).join('');
    return `<section class="sec"><h2 class="sec__title">챌린지 일정 <span class="badge" style="background:var(--lp-surface2);color:var(--lp-primary);border:0">총 ${rounds}주</span></h2>
      <table class="sched"><thead><tr><th>회차</th><th>시작일</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }
  if (d.scheduleText) return `<section class="sec"><h2 class="sec__title">일정</h2><div class="prose">${richText(d.scheduleText)}</div></section>`;
  return '';
}

/* 주의사항 (기본값, detail.cautions 배열로 덮어쓰기) */
function cautionsSection(d) {
  const items = (Array.isArray(d.cautions) && d.cautions.length) ? d.cautions : [
    '본인 명의 블로그 1개로만 참여할 수 있으며, 도배·어뷰징 시 선발에서 제외됩니다.',
    '신청 시 입력한 휴대폰 번호로 선발·리워드 안내가 발송됩니다.',
    '주차별 미션은 정해진 기간 안에 제출해야 활동으로 인정됩니다.',
    '일정·리워드는 운영 사정에 따라 변동될 수 있습니다.',
  ];
  return `<section class="sec"><h2 class="sec__title">꼭 확인하세요</h2>
    <ul class="cautions">${items.map((x) => `<li>${esc(stripMarker(x))}</li>`).join('')}</ul></section>`;
}

function route() {
  const h = location.hash.replace('#', '');
  if (h === 'submit') return renderSubmit();
  if (h === 'wrapup') return renderWrapup();
  return renderLanding();
}

function rewardSection(d, c) {
  d = d || {};
  if (d.rewardType === 'grade' && Array.isArray(d.rewardTiers) && d.rewardTiers.length) {
    const tiers = d.rewardTiers.slice().sort((a, b) => a.min - b.min);
    const rows = tiers.map((t, i) => {
      const next = tiers[i + 1];
      const range = next ? (next.min - 1 > t.min ? `${t.min}~${next.min - 1}개` : `${t.min}개`) : `${t.min}개 이상`;
      return `<tr><td>${esc(range)} 작성</td><td class="num"><b>${Number(t.amount).toLocaleString()}P</b></td></tr>`;
    }).join('');
    return `<section class="sec"><div class="infocard"><h2 class="sec__title">리워드</h2>
      <table class="reward-table"><thead><tr>
        <th>작성 개수</th><th class="num">네이버페이 포인트</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="reward-note">작성 개수가 많을수록 리워드 ↑ · 우수활동자는 <b style="color:var(--lp-pop)">×2</b></p></div></section>`;
  }
  const amt = Number(d.rewardAmount || c.rewardPerPost || 0);
  if (!amt) return '';
  return `<section class="sec"><div class="infocard reward-card" style="text-align:center">
    ${d.rewardType === 'per_milestone' ? '목표 달성 시 리워드 지급' : '제출 1건당 리워드 적립'}<br>
    <b>${amt.toLocaleString()}P</b><br><span style="color:rgba(255,255,255,.7)">네이버페이 · 우수활동자 ×2</span></div></section>`;
}

/* ---------- 랜딩 + 신청 ---------- */
function renderLanding() {
  const c = DATA.challenge, d = DATA.detail || {};
  const closed = c.status && c.status !== '모집중';
  const benefits = Array.isArray(d.benefits) ? d.benefits : [];
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
      ${benefits.length ? `<section class="sec"><div class="infocard"><h2 class="sec__title">참가 혜택</h2>
        <ul class="benefits">${benefits.map((b) => `<li><span class="chk">✓</span><span>${esc(stripMarker(b))}</span></li>`).join('')}</ul></div></section>` : ''}
      ${d.eligibility ? `<section class="sec"><h2 class="sec__title">참가 자격</h2><div class="prose">${richText(d.eligibility)}</div></section>` : ''}
      ${rewardSection(d, c)}
      ${stepsSection(c)}
      ${scheduleSection(c, d)}
      ${cautionsSection(d)}

      <section class="sec apply-card" id="apply">
        <h2 class="sec__title">참가 신청</h2>
        ${closed ? `<div class="card center muted">현재 모집 기간이 아닙니다.</div>` : `
        <div class="card">
          <div class="field"><label class="field__label">성함 <span class="req">*</span></label>
            <input class="input" id="a-name" placeholder="예) 김고방" /><div class="field__hint">띄어쓰기 없이 입력해 주세요.</div></div>
          <div class="field"><label class="field__label">휴대폰 번호 <span class="req">*</span></label>
            <input class="input tnum" id="a-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" /><div class="field__hint">결과·리워드 안내를 받을 번호예요.</div></div>
          <div class="field"><label class="field__label">참가할 블로그 URL <span class="req">*</span></label>
            <input class="input" id="a-blog" type="url" placeholder="https://blog.naver.com/..." /><div class="field__hint">본인 명의 블로그 1개 (도배·어뷰징 불가).</div></div>
          <label class="checkrow"><input type="checkbox" id="a-agree" /><span>성명·휴대폰 번호 수집 및 이벤트 종료 시까지 보유에 동의합니다. (필수)</span></label>
          <div class="field__err" id="a-err" style="display:none"></div>
          <div class="cta-fixed"><button class="btn btn--primary btn--block" id="a-submit">신청하기</button></div>
        </div>`}
      </section>
      ${c.openchatUrl ? `<p class="center" style="margin-top:24px"><a class="btn btn--secondary btn--sm" href="${esc(c.openchatUrl)}" target="_blank">오픈카톡 문의</a></p>` : ''}
      <p class="center muted" style="margin-top:20px;font-size:13px"><a href="#submit">이미 참가자라면 · 주차 제출하기 →</a></p>
    </div>`;

  if (closed) return;
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
    if (r.ok) renderDone('신청 완료!', '선발 결과는 발표일에 안내드려요. 오픈카톡에서 소식을 받아보세요.');
    else { e.target.disabled = false; e.target.textContent = '신청하기'; errEl.style.display = 'block'; errEl.textContent = '신청 실패: ' + (r.error || Object.values(r.errors || {}).join(', ')); }
  });
}

function renderDone(title, sub) {
  const c = DATA.challenge;
  app.innerHTML = `<div class="wrap"><div class="done">
    <div class="done__icon">✓</div>
    <h1 style="font-size:24px;font-weight:800">${esc(title)}</h1>
    <p class="muted" style="margin-top:10px">${esc(sub)}</p>
    <div class="linkbtns">
      <a class="btn btn--secondary btn--sm" href="#submit">주차 제출하기</a>
      ${c.openchatUrl ? `<a class="btn btn--primary btn--sm" href="${esc(c.openchatUrl)}" target="_blank">오픈카톡</a>` : ''}
    </div></div></div>`;
}

/* ---------- 주차 제출 ---------- */
function renderSubmit() {
  const c = DATA.challenge;
  app.innerHTML = `
    <header class="hero"><div class="hero__panel"><span class="hero__eyebrow">${esc(c.name)}</span>
      <h1 class="hero__title" style="font-size:clamp(26px,7vw,36px)">주차 미션 제출</h1></div></header>
    <div class="wrap" style="padding-top:28px">
    <div class="card">
      <div class="field"><label class="field__label">휴대폰 번호로 본인 확인 <span class="req">*</span></label>
        <div style="display:flex;gap:8px"><input class="input tnum" id="s-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" />
        <button class="btn btn--primary" id="s-check">확인</button></div>
        <div class="field__hint">신청 때 입력한 번호로 이번 주 미션과 제출 현황을 확인해요.</div></div>
    </div>
    <div id="s-status"></div>
    <p class="center muted" style="margin-top:20px;font-size:13px"><a href="#">← 신청 페이지로</a> · <a href="#wrapup">마무리 제출</a></p>
  </div>`;
  $('#s-check').addEventListener('click', loadStatus);
  $('#s-phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadStatus(); });
}
async function loadStatus() {
  const phone = $('#s-phone').value.trim();
  if (!normPhone(phone)) return toast('올바른 휴대폰 번호를 입력하세요.', true);
  const box = $('#s-status'); box.innerHTML = '<div class="loading"><span class="spinner"></span> 조회 중…</div>';
  const r = await apiGet({ action: 'myStatus', challengeId: cid, phone }).catch(() => ({ ok: false }));
  if (!r.ok) { box.innerHTML = `<div class="card center muted">${r.error === 'not_found' ? '신청 내역이 없습니다.' : '조회 실패'}</div>`; return; }
  if (!r.selected) { box.innerHTML = `<div class="card center muted">아직 선발 전이거나 선발되지 않았습니다.<br>발표일을 기다려 주세요.</div>`; return; }
  const p = r.progress || { done: 0, total: 0 };
  const cur = r.current;
  box.innerHTML = `
    <div class="card"><div class="card__title">${esc(r.name)}님 · 진행 ${p.done}/${p.total}</div>
      ${!cur ? `<p class="muted">현재 열린 주차가 없습니다. 회차 오픈을 기다려 주세요.</p>` : `
      <p class="badge badge--primary" style="margin-bottom:10px">${cur.week}주차 미션</p>
      <p class="prose" style="margin-bottom:6px"><b>${esc(cur.title || '미션')}</b></p>
      <p class="prose muted" style="margin-bottom:12px">${esc(cur.body || '')}</p>
      ${cur.articleUrl ? `<p style="margin-bottom:12px"><a href="${esc(cur.articleUrl)}" target="_blank">참고 아티클 보기 →</a></p>` : ''}
      <div class="field"><label class="field__label">이번 주 작성한 게시물 URL</label>
        <input class="input" id="s-url" type="url" placeholder="https://blog.naver.com/.../게시물" value="${esc(cur.submittedUrl || '')}" /></div>
      <button class="btn btn--primary btn--block" id="s-do">${cur.submitted ? '제출 수정' : '제출하기'}</button>
      ${cur.submitted ? '<p class="center muted" style="margin-top:8px;font-size:13px">이미 제출됨 — 수정 가능</p>' : ''}`}
    </div>`;
  const btn = $('#s-do');
  if (btn) btn.addEventListener('click', async () => {
    const url = $('#s-url').value.trim();
    if (!/^https?:\/\/.+/.test(url)) return toast('게시물 URL을 입력하세요.', true);
    btn.disabled = true; btn.textContent = '제출 중…';
    const rr = await apiPost({ action: 'submit', challengeId: cid, phone, postUrl: url }).catch(() => ({ ok: false }));
    if (rr.ok) { toast('제출 완료!'); loadStatus(); } else { btn.disabled = false; btn.textContent = '제출하기'; toast('제출 실패: ' + (rr.error || ''), true); }
  });
}

/* ---------- 마무리 ---------- */
function renderWrapup() {
  const c = DATA.challenge;
  app.innerHTML = `
    <header class="hero"><div class="hero__panel"><span class="hero__eyebrow">${esc(c.name)}</span>
      <h1 class="hero__title" style="font-size:clamp(26px,7vw,36px)">챌린지 마무리</h1></div>
      <p class="hero__sub">완주를 축하합니다</p></header>
    <div class="wrap" style="padding-top:28px">
    <div class="card">
      <div class="field"><label class="field__label">휴대폰 번호 <span class="req">*</span></label>
        <input class="input tnum" id="w-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" /></div>
      <div class="field"><label class="field__label">참가한 블로그 URL <span class="req">*</span></label>
        <input class="input" id="w-blog" type="url" placeholder="https://blog.naver.com/..." /></div>
      <div class="field"><label class="field__label">작성한 블로그 갯수 <span class="req">*</span></label>
        <input class="input tnum" id="w-count" type="number" min="0" max="${esc(c.totalRounds || 10)}" placeholder="0" /></div>
      <label class="checkrow"><input type="checkbox" id="w-ex" /><span>우수활동자 여부 (해당 시 체크)</span></label>
      <button class="btn btn--primary btn--block" id="w-do" style="margin-top:12px">마무리 제출</button>
    </div>
    <p class="center muted" style="margin-top:20px;font-size:13px"><a href="#">← 신청 페이지로</a></p>
  </div>`;
  $('#w-do').addEventListener('click', async (e) => {
    const phone = $('#w-phone').value.trim();
    const blogUrl = $('#w-blog').value.trim();
    const postCount = Number($('#w-count').value);
    if (!normPhone(phone)) return toast('휴대폰 번호 확인', true);
    if (!/^https?:\/\/.+/.test(blogUrl)) return toast('블로그 URL 확인', true);
    e.target.disabled = true; e.target.textContent = '제출 중…';
    const r = await apiPost({ action: 'wrapup', challengeId: cid, phone, blogUrl, postCount, excellent: $('#w-ex').checked ? 'Y' : 'N', agree: true }).catch(() => ({ ok: false }));
    if (r.ok) renderDone('마무리 제출 완료!', '활동비 정산 후 안내드릴게요. 수고하셨습니다.');
    else { e.target.disabled = false; e.target.textContent = '마무리 제출'; toast('실패: ' + (r.error || ''), true); }
  });
}

boot();
