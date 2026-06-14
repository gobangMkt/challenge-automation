import { apiGet, apiPost } from './api.js';

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

let DATA = null;

async function boot() {
  if (!cid) { app.innerHTML = `<div class="wrap"><p class="center muted" style="padding:80px 0">잘못된 접근입니다. 신청 링크를 확인해 주세요.</p></div>`; return; }
  const r = await apiGet({ action: 'campaignDetail', challengeId: cid }).catch(() => ({ ok: false }));
  if (!r.ok) { app.innerHTML = `<div class="wrap"><p class="center muted" style="padding:80px 0">캠페인을 찾을 수 없습니다.</p></div>`; return; }
  DATA = r;
  route();
  window.addEventListener('hashchange', route);
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
    return `<section class="sec"><h2 class="sec__title">리워드</h2>
      <div class="card" style="padding:6px;overflow:hidden"><table class="reward-table"><thead><tr>
        <th>작성 개수</th><th class="num">네이버페이 포인트</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted center" style="margin-top:10px">작성 개수가 많을수록 리워드 ↑ · 우수활동자는 ×2</p></section>`;
  }
  const amt = Number(d.rewardAmount || c.rewardPerPost || 0);
  if (!amt) return '';
  return `<section class="sec"><div class="reward-card">
    ${d.rewardType === 'per_milestone' ? '목표 달성 시 리워드 지급' : '제출 1건당 리워드 적립'}<br>
    <b>${amt.toLocaleString()}P</b><br><span class="muted">네이버페이 · 우수활동자 ×2</span></div></section>`;
}

/* ---------- 랜딩 + 신청 ---------- */
function renderLanding() {
  const c = DATA.challenge, d = DATA.detail || {};
  const closed = c.status && c.status !== '모집중';
  const benefits = Array.isArray(d.benefits) ? d.benefits : [];
  app.innerHTML = `
    <header class="hero">
      ${d.tagline ? `<span class="hero__tag reveal reveal-1">${esc(d.tagline)}</span>` : ''}
      <h1 class="hero__title reveal reveal-2">${esc(c.name)}</h1>
      ${d.concept ? `<p class="hero__sub reveal reveal-3">${esc(d.concept)}</p>` : ''}
      <div class="hero__meta reveal reveal-4">
        <span class="badge badge--accent">${esc(c.totalRounds || 10)}주 과정</span>
        ${(d.rewardAmount || c.rewardPerPost) ? `<span class="badge badge--primary">네이버페이 리워드</span>` : ''}
        <span class="badge ${closed ? 'badge--danger' : 'badge--success'}">${closed ? '모집 마감' : '모집 중'}</span>
      </div>
    </header>
    <div class="wrap">
      ${benefits.length ? `<section class="sec"><h2 class="sec__title">참가 혜택</h2>
        <ul class="benefits">${benefits.map((b) => `<li><span class="chk">✓</span><span>${esc(b)}</span></li>`).join('')}</ul></section>` : ''}
      ${d.scheduleText ? `<section class="sec"><h2 class="sec__title">일정</h2><p class="prose">${esc(d.scheduleText)}</p></section>` : ''}
      ${d.eligibility ? `<section class="sec"><h2 class="sec__title">참가 자격</h2><p class="prose">${esc(d.eligibility)}</p></section>` : ''}
      ${rewardSection(d, c)}

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
  app.innerHTML = `<div class="wrap">
    <header class="hero" style="padding:40px 4px 28px"><span class="hero__tag">Weekly Mission</span><h1 class="hero__title" style="font-size:clamp(28px,7vw,38px)">주차 미션 제출</h1>
      <p class="hero__sub">${esc(c.name)}</p></header>
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
  app.innerHTML = `<div class="wrap">
    <header class="hero" style="padding:40px 4px 28px"><span class="hero__tag">Wrap-up</span><h1 class="hero__title" style="font-size:clamp(28px,7vw,38px)">챌린지 마무리</h1>
      <p class="hero__sub">${esc(c.name)} 완주를 축하합니다</p></header>
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
