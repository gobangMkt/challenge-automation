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

// 줄머리 불렛/번호 마커 제거 (★·☆·▶ 등 포함)
const BULLET = '[-•*·–—▪◦‣★☆◆▶▷✓✔]';
const stripMarker = (s) => String(s || '').replace(new RegExp(`^\\s*(?:${BULLET}|\\d+[.)])\\s+`), '').trim();

// 평문 렌더: 빈 줄=문단, 단일 줄바꿈=<br>, 줄단위로 -/•/1.=리스트(연속 묶음),
// ★★…★★=소제목, ---=구분선, **굵게**·느낌표 문장=강조.
function richText(str) {
  const lines = String(str == null ? '' : str).replace(/\r/g, '').split('\n');
  const ulRe = new RegExp(`^${BULLET}\\s+`);
  const olRe = /^\d+[.)]\s+/;
  const hrRe = /^[-–—_▬=]{3,}$/;
  const hdRe = /^[★☆]{1,3}\s*(.+?)\s*[★☆]{1,3}$/;
  const mdHdRe = /^#{1,6}\s*(.+?)\s*#*$/; // 마크다운식 ## 제목
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
function cautionsList(d) {
  const items = (Array.isArray(d.cautions) && d.cautions.length) ? d.cautions : [
    '본인 명의 블로그 1개로만 참여할 수 있으며, 도배·어뷰징 시 선발에서 제외됩니다.',
    '신청 시 입력한 휴대폰 번호로 선발·리워드 안내가 발송됩니다.',
    '주차별 미션은 정해진 기간 안에 제출해야 활동으로 인정됩니다.',
    '일정·리워드는 운영 사정에 따라 변동될 수 있습니다.',
  ];
  return `<ul class="cautions">${items.map((x) => `<li>${esc(stripMarker(x))}</li>`).join('')}</ul>`;
}
function cautionsSection(d) {
  return `<section class="sec"><h2 class="sec__title">꼭 확인하세요</h2>${cautionsList(d)}</section>`;
}

function route() {
  const h = location.hash.replace(/^#\/?/, ''); // '#submit'·'#/submit' 모두 'submit'
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
            <div class="blogrow"><input class="input" id="a-blog" type="url" placeholder="https://blog.naver.com/..." />
              <button type="button" class="btn btn--secondary" id="a-blogcheck">확인</button></div>
            <div class="field__hint">본인 명의 블로그 1개 (도배·어뷰징 불가). URL 입력 후 <b>확인</b>으로 내 블로그가 맞는지 봐주세요.</div>
            <div id="a-blogprev" class="blogprev" style="display:none"></div></div>
          <label class="checkrow"><input type="checkbox" id="a-agree" /><span>성명·휴대폰 번호 수집 및 이벤트 종료 시까지 보유에 동의합니다. (필수)</span></label>
          <div class="field__err" id="a-err" style="display:none"></div>
          <div class="cta-fixed"><button class="btn btn--primary btn--block" id="a-submit">신청하기</button></div>
        </div>`}
      </section>
      ${c.openchatUrl ? `<p class="center" style="margin-top:24px"><a class="btn btn--secondary btn--sm" href="${esc(c.openchatUrl)}" target="_blank">오픈카톡 문의</a></p>` : ''}
      <p class="center muted" style="margin-top:20px;font-size:13px"><a href="#submit">이미 참가자라면 · 주차 제출하기 →</a></p>
    </div>`;

  if (closed) return;
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
        <div class="blogprev__ok">✓ 이 블로그가 맞나요?</div>
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
  app.innerHTML = `<div class="wrap"><div class="done">
    <div class="done__icon">✓</div>
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
    <p class="center muted" style="margin-top:20px;font-size:13px"><a href="#">← 신청 페이지로</a> · <a href="#wrapup">마무리 제출</a></p>
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
  const subBadge = w.submitted ? '<span class="wk-badge wk-badge--done">✓ 제출완료</span>'
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
      </div></div>`
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
  const learnSection = `<section class="ssec">
    <h2 class="ssec__h">${ICO_BOOK}학습 자료</h2>
    ${d.eduUrl ? `<a class="resbtn" href="${esc(d.eduUrl)}" target="_blank" rel="noopener"><svg class="resbtn__ic" width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 4.8C4.6 4.2 7 4.6 9 5.8V16.2C7 15 4.6 14.6 2 15.2Z" fill="#fff"/><path d="M18 4.8C15.4 4.2 13 4.6 11 5.8V16.2C13 15 15.4 14.6 18 15.2Z" fill="#fff"/></svg>교육자료(교재) 바로가기<span class="resbtn__go">↗</span></a>` : ''}
    ${d.guide ? `<details class="wkguide" open><summary>작성가이드 <span class="wkguide__badge">필독</span></summary><div class="prose wk-body">${richText(d.guide)}</div></details>` : ''}
    <details class="wkguide"><summary>유의사항</summary><div class="wk-cautions">${cautionsList(d)}</div></details>
  </section>`;

  const weekSection = `<section class="ssec ssec--mission">
    <h2 class="ssec__h">${ICO_TASK}이번 주 미션</h2>
    <div class="wkchips">${chips}</div>
    <div id="wkdetail"></div>
  </section>`;

  box.innerHTML = learnSection + weekSection;
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
  if (chipCont) chipCont.addEventListener('wheel', (e) => { if (e.deltaY) { e.preventDefault(); chipCont.scrollLeft += e.deltaY; } }, { passive: false });
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
        <div class="field"><label class="field__label">휴대폰 번호 <span class="req">*</span></label>
          <input class="input tnum" id="w-phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" /></div>
        <div class="field"><label class="field__label">참가한 블로그 URL <span class="req">*</span></label>
          <input class="input" id="w-blog" type="url" placeholder="https://blog.naver.com/..." /></div>
        <div class="field"><label class="field__label">작성한 블로그 갯수 <span class="req">*</span></label>
          <input class="input tnum" id="w-count" type="number" min="0" max="${max}" placeholder="0" /></div>
        <label class="checkrow"><input type="checkbox" id="w-agree" /><span>개인정보 수집·이용에 동의합니다.</span></label>
        <button class="btn btn--primary btn--block" id="w-do" style="margin-top:12px">리워드 신청 제출</button>
      </section>
      <p class="center muted" style="margin-top:18px;font-size:13px"><a href="#">← 신청 페이지로</a> · <a href="#submit">주차 제출</a></p>
    </div>`;
  bindPhone($('#w-phone'));
  $('#w-do').addEventListener('click', async (e) => {
    const phone = $('#w-phone').value.trim();
    const blogUrl = $('#w-blog').value.trim();
    const postCount = Number($('#w-count').value);
    if (!normPhone(phone)) return toast('휴대폰 번호를 확인하세요.', true);
    if (!/^https?:\/\/.+/.test(blogUrl)) return toast('블로그 URL을 확인하세요.', true);
    if (!(postCount >= 0)) return toast('작성 갯수를 입력하세요.', true);
    if (!$('#w-agree').checked) return toast('개인정보 수집·이용에 동의해 주세요.', true);
    e.target.disabled = true; e.target.textContent = '제출 중…';
    const r = await apiPost({ action: 'wrapup', challengeId: cid, phone, blogUrl, postCount, excellent: 'N', agree: true }).catch(() => ({ ok: false }));
    if (r.ok) renderDone('리워드 신청 완료!', '정산 후 네이버페이 포인트로 안내드릴게요. 수고하셨습니다 🎉');
    else { e.target.disabled = false; e.target.textContent = '리워드 신청 제출'; toast('실패: ' + (r.error || (r.errors && Object.values(r.errors)[0]) || ''), true); }
  });
}

boot();
