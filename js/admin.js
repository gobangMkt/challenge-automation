import { apiGet, apiPost } from './api.js';

/* ---------- 상태 ---------- */
const TOKEN_KEY = 'challenge.opToken';
const CAMP_KEY = 'challenge.curCampaign';
const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  campaigns: [],
  current: localStorage.getItem(CAMP_KEY) || '',
};
const base = location.pathname.replace(/admin\.html$/, '');
const landingUrl = (id) => `${location.origin}${base}?c=${encodeURIComponent(id)}`;

/* ---------- 유틸 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const el = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg, err) {
  const t = el('toast'); t.textContent = msg; t.className = 'toast is-show' + (err ? ' toast--err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = 'toast'; }, 3000);
}
const op = (extra) => ({ token: state.token, ...extra });
const loading = (t = '불러오는 중…') => `<div class="loading"><span class="spinner"></span> ${t}</div>`;

/* ---------- 아이콘 ---------- */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
};

/* ---------- 레지스트리 ---------- */
const features = [
  { id: 'home', label: '캠페인 허브', icon: I.home, render: renderHome },
  { id: 'campaign', label: '캠페인 생성', icon: I.plus, render: renderCampaign },
  { id: 'manage', label: '관리 · 마케팅', icon: I.users, render: renderManage },
  { id: 'operate', label: '운영 (주차)', icon: I.calendar, render: renderOperate },
];

/* ---------- 셸 ---------- */
function renderSidebar() {
  el('nav').innerHTML = features.map((f) =>
    `<button class="navitem" data-id="${f.id}">${f.icon}<span>${f.label}</span></button>`).join('');
  el('nav').querySelectorAll('.navitem').forEach((b) =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.id; closeDrawer(); }));
  el('foot').innerHTML = state.token
    ? `운영자 인증됨 · <button class="btn btn--ghost btn--sm" id="logout" style="padding:2px 6px">로그아웃</button>`
    : '미인증';
  const lo = el('logout');
  if (lo) lo.addEventListener('click', () => { state.token = ''; localStorage.removeItem(TOKEN_KEY); location.hash = ''; route(); });
}
function highlight(id) {
  el('nav').querySelectorAll('.navitem').forEach((b) => b.classList.toggle('is-active', b.dataset.id === id));
}
function closeDrawer() { el('sidebar').classList.remove('is-open'); el('scrim')?.remove(); }
el('menuBtn').addEventListener('click', () => {
  el('sidebar').classList.add('is-open');
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim';
  s.addEventListener('click', closeDrawer); document.body.appendChild(s);
});

/* ---------- 토큰 게이트 ---------- */
function renderGate() {
  highlight('');
  el('content').innerHTML = `
    <div class="gate">
      <div class="card">
        <div class="gate__logo">★</div>
        <h2 class="card__title" style="justify-content:center">운영자 인증</h2>
        <p class="muted" style="margin-bottom:16px">운영 토큰을 입력하세요.</p>
        <div class="field"><input class="input" id="tok" type="password" placeholder="운영 토큰" autocomplete="off" /></div>
        <button class="btn btn--primary btn--block" id="enter">입장</button>
      </div>
    </div>`;
  const submit = async () => {
    const v = el('tok').value.trim();
    if (!v) return;
    state.token = v;
    const r = await apiGet({ action: 'campaigns', token: v }).catch(() => ({ ok: false }));
    if (r.ok) {
      localStorage.setItem(TOKEN_KEY, v); renderSidebar();
      location.hash = '#/home'; route();
    } else { toast('토큰이 올바르지 않습니다.', true); }
  };
  el('enter').addEventListener('click', submit);
  el('tok').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/* ---------- 라우터 ---------- */
async function route() {
  if (!state.token) return renderGate();
  const id = (location.hash.replace(/^#\//, '') || 'home').split('/')[0];
  const f = features.find((x) => x.id === id) || features[0];
  highlight(f.id);
  el('content').innerHTML = loading();
  try { await f.render(); } catch (e) { el('content').innerHTML = `<div class="card">오류: ${esc(e.message)}</div>`; }
}

async function loadCampaigns() {
  const r = await apiGet({ action: 'campaigns', token: state.token });
  state.campaigns = r.ok ? r.rows : [];
  return state.campaigns;
}
function setCurrent(id) { state.current = id; localStorage.setItem(CAMP_KEY, id); }
function campaignPicker() {
  if (!state.campaigns.length) return '<p class="empty">캠페인이 없습니다. 먼저 <b>캠페인 생성</b>에서 만드세요.</p>';
  const opts = state.campaigns.map((c) =>
    `<option value="${esc(c.challengeId)}" ${c.challengeId === state.current ? 'selected' : ''}>${esc(c.name)} (${esc(c.status)})</option>`).join('');
  return `<div class="field" style="max-width:380px"><label class="field__label">캠페인 선택</label>
    <select class="select" id="campSel">${opts}</select></div>`;
}

/* ---------- 뷰: 홈 ---------- */
async function renderHome() {
  await loadCampaigns();
  const c = state.campaigns;
  const tApplied = c.reduce((s, x) => s + (x.applied || 0), 0);
  const tSel = c.reduce((s, x) => s + (x.selected || 0), 0);
  el('content').innerHTML = `
    <div class="page-head"><div class="page-head__row">
      <div><h1 class="page-head__title">캠페인 허브</h1>
      <p class="page-head__desc">진행 중인 챌린지 캠페인을 한눈에 관리하세요.</p></div>
      <button class="btn btn--primary" id="newCamp">+ 새 캠페인</button>
    </div></div>
    <div class="statbar">
      <div class="pill"><b class="tnum">${c.length}</b><span>캠페인</span></div>
      <div class="pill"><b class="tnum">${tApplied}</b><span>총 신청</span></div>
      <div class="pill"><b class="tnum">${tSel}</b><span>총 선발</span></div>
    </div>
    <div class="grid" id="grid">
      ${c.map((x) => `
        <button class="camp-card" data-id="${esc(x.challengeId)}">
          <div class="camp-card__top"><span class="camp-card__name">${esc(x.name)}</span>
            <span class="badge ${x.status === '모집중' ? 'badge--primary' : 'badge'}">${esc(x.status)}</span></div>
          <div class="camp-card__stats">
            <div class="stat"><span class="stat__n tnum">${x.applied || 0}</span><span class="stat__l">신청</span></div>
            <div class="stat"><span class="stat__n tnum">${x.selected || 0}</span><span class="stat__l">선발</span></div>
            <div class="stat"><span class="stat__n tnum">${x.submissions || 0}</span><span class="stat__l">제출</span></div>
            <div class="stat"><span class="stat__n tnum">${x.totalRounds || '-'}</span><span class="stat__l">회차</span></div>
          </div>
        </button>`).join('')}
      <button class="camp-card camp-card--new" id="newCard">+ 새 캠페인 만들기</button>
    </div>`;
  const go = () => { location.hash = '#/campaign'; };
  el('newCamp').addEventListener('click', go); el('newCard').addEventListener('click', go);
  el('grid').querySelectorAll('.camp-card[data-id]').forEach((b) =>
    b.addEventListener('click', () => { setCurrent(b.dataset.id); location.hash = '#/manage'; }));
}

/* ---------- 뷰: 캠페인 생성 ---------- */
async function renderCampaign() {
  const N = 10;
  const missionRows = Array.from({ length: N }, (_, i) => `
    <div class="mission-row">
      <div class="mission-row__hd">${i + 1}회차</div>
      <div class="row2">
        <div class="field" style="margin:0"><input class="input" data-m="title" data-r="${i + 1}" placeholder="미션 제목 (예: 키워드 글쓰기)" /></div>
        <div class="field" style="margin:0"><input class="input" data-m="articleUrl" data-r="${i + 1}" placeholder="참고 아티클 URL (선택)" /></div>
      </div>
      <div class="field" style="margin:8px 0 0"><textarea class="textarea" data-m="body" data-r="${i + 1}" placeholder="이번 주 미션 안내문 (알림톡·제출화면에 노출)"></textarea></div>
    </div>`).join('');

  el('content').innerHTML = `
    <div class="page-head"><h1 class="page-head__title">캠페인 생성</h1>
      <p class="page-head__desc">노션에서 정리한 챌린지 상세를 입력하면 신청 상세페이지가 자동 생성됩니다.</p></div>

    <div class="card"><div class="card__title">① 기본 정보</div>
      <div class="row2">
        <div class="field"><label class="field__label">캠페인명 <span class="req">*</span></label>
          <input class="input" id="f-name" placeholder="취준 블로그 마스터즈" /></div>
        <div class="field"><label class="field__label">총 회차</label>
          <input class="input tnum" id="f-rounds" type="number" value="10" min="1" /></div>
      </div>
      <div class="row2">
        <div class="field"><label class="field__label">제출당 활동비(원)</label>
          <input class="input tnum" id="f-reward" type="number" value="10000" min="0" /></div>
        <div class="field"><label class="field__label">우수활동자 배수</label>
          <input class="input tnum" id="f-mult" type="number" value="2" min="1" step="0.5" /></div>
      </div>
      <div class="row2">
        <div class="field"><label class="field__label">모집 시작</label><input class="input" id="f-rs" type="date" /></div>
        <div class="field"><label class="field__label">모집 마감</label><input class="input" id="f-re" type="date" /></div>
      </div>
      <div class="row2">
        <div class="field"><label class="field__label">발표일</label><input class="input" id="f-ann" type="date" /></div>
        <div class="field"><label class="field__label">시작일</label><input class="input" id="f-start" type="date" /></div>
      </div>
      <div class="field"><label class="field__label">오픈카톡 문의 URL</label>
        <input class="input" id="f-chat" placeholder="https://open.kakao.com/o/..." /></div>
    </div>

    <div class="card"><div class="card__title">② 신청 상세페이지 콘텐츠</div>
      <div class="field"><label class="field__label">한 줄 태그라인</label>
        <input class="input" id="d-tag" placeholder="자격증 말고 블로그로 스펙 쌓기" /></div>
      <div class="field"><label class="field__label">캠페인 소개</label>
        <textarea class="textarea" id="d-concept" placeholder="누가, 무엇을, 왜 — 챌린지 소개"></textarea></div>
      <div class="field"><label class="field__label">참가 혜택 (한 줄에 하나씩)</label>
        <textarea class="textarea" id="d-benefits" placeholder="실무 스터디 자료 제공&#10;매주 화요일 실무 아티클&#10;제출 갯수만큼 활동비 + 우수활동자 2배"></textarea></div>
      <div class="row2">
        <div class="field"><label class="field__label">참가 자격</label>
          <input class="input" id="d-elig" placeholder="개인 블로그 운영 중인 누구나" /></div>
        <div class="field"><label class="field__label">일정 안내</label>
          <input class="input" id="d-sched" placeholder="신청 1/20~1/26 · 발표 1/27 · 10주 진행" /></div>
      </div>
    </div>

    <div class="card"><div class="card__title">③ 회차별 미션 (선택 — 나중에 운영에서 입력 가능)</div>
      ${missionRows}
    </div>

    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn--primary" id="save">캠페인 생성</button>
      <button class="btn btn--secondary" id="cancel">취소</button>
    </div>
    <div id="result"></div>`;

  el('cancel').addEventListener('click', () => { location.hash = '#/home'; });
  el('save').addEventListener('click', async (e) => {
    const name = el('f-name').value.trim();
    if (!name) return toast('캠페인명을 입력하세요.', true);
    const missions = [];
    el('content').querySelectorAll('.mission-row').forEach((row, i) => {
      const g = (m) => row.querySelector(`[data-m="${m}"]`).value.trim();
      const title = g('title'), body = g('body'), articleUrl = g('articleUrl');
      if (title || body || articleUrl) missions.push({ round: i + 1, title, body, articleUrl });
    });
    const payload = op({
      action: 'saveCampaign', name,
      totalRounds: Number(el('f-rounds').value) || 10,
      rewardPerPost: el('f-reward').value, excellentMultiplier: el('f-mult').value,
      모집시작: el('f-rs').value, 모집마감: el('f-re').value,
      발표일: el('f-ann').value, 시작일: el('f-start').value,
      openchatUrl: el('f-chat').value.trim(), status: '모집중',
      missions,
      detail: {
        tagline: el('d-tag').value.trim(), concept: el('d-concept').value.trim(),
        benefits: el('d-benefits').value.split('\n').map((s) => s.trim()).filter(Boolean),
        eligibility: el('d-elig').value.trim(), scheduleText: el('d-sched').value.trim(),
      },
    });
    e.target.disabled = true; e.target.textContent = '생성 중…';
    const r = await apiPost(payload).catch(() => ({ ok: false }));
    e.target.disabled = false; e.target.textContent = '캠페인 생성';
    if (!r.ok) return toast('생성 실패: ' + (r.error || JSON.stringify(r.errors || {})), true);
    setCurrent(r.challengeId);
    toast('캠페인 생성 완료!');
    const link = landingUrl(r.challengeId);
    el('result').innerHTML = `<div class="card" style="margin-top:16px;border-color:var(--color-success)">
      <div class="card__title">✓ 생성됨 — 신청 상세페이지</div>
      <div class="copybox"><input class="input" readonly value="${esc(link)}" id="lnk" />
        <button class="btn btn--secondary btn--sm" id="copy">복사</button>
        <a class="btn btn--primary btn--sm" href="${esc(link)}" target="_blank">열기</a></div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn--ghost btn--sm" onclick="location.hash='#/manage'">관리로</button>
        <button class="btn btn--ghost btn--sm" onclick="location.hash='#/operate'">운영으로</button>
      </div></div>`;
    el('copy').addEventListener('click', () => { el('lnk').select(); navigator.clipboard.writeText(link); toast('링크 복사됨'); });
  });
}

/* ---------- 뷰: 관리 · 마케팅 ---------- */
async function renderManage() {
  await loadCampaigns();
  if (!state.current && state.campaigns[0]) setCurrent(state.campaigns[0].challengeId);
  el('content').innerHTML = `
    <div class="page-head"><h1 class="page-head__title">관리 · 마케팅</h1></div>
    ${campaignPicker()}
    <div class="tabs"><button class="tab is-active" data-t="manage">관리 (명단·선발)</button>
      <button class="tab" data-t="mkt">마케팅 (배포)</button></div>
    <div id="pane"></div>`;
  const sel = el('campSel');
  if (sel) sel.addEventListener('change', () => { setCurrent(sel.value); drawPane('manage'); setTab('manage'); });
  el('content').querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => { setTab(t.dataset.t); drawPane(t.dataset.t); }));
  function setTab(t) { el('content').querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-active', x.dataset.t === t)); }
  if (state.current) drawPane('manage'); else el('pane').innerHTML = '';
}

async function drawPane(tab) {
  const pane = el('pane');
  if (!state.current) { pane.innerHTML = '<p class="empty">캠페인을 먼저 선택하세요.</p>'; return; }
  if (tab === 'mkt') return drawMarketing(pane);
  pane.innerHTML = loading('명단 불러오는 중…');
  const r = await apiGet({ action: 'participants', token: state.token, challengeId: state.current });
  const rows = r.ok ? r.rows : [];
  const ex = await apiGet({ action: 'weekSubmissions', token: state.token, challengeId: state.current, round: 1 }).catch(() => ({}));
  const exSet = {};
  (rows).forEach((x) => {}); // excellent는 note기반 — participants에 미포함이라 별도 표시 생략, 토글로 관리
  pane.innerHTML = `
    <div class="statbar">
      <div class="pill"><b class="tnum">${rows.length}</b><span>신청</span></div>
      <div class="pill"><b class="tnum">${rows.filter((x) => x.status === 'selected' || x.status === '선발').length}</b><span>선발</span></div>
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="table"><thead><tr>
        <th>성함</th><th>휴대폰</th><th>블로그</th><th>상태</th><th>우수</th><th>처리</th>
      </tr></thead><tbody>
      ${rows.length ? rows.map((p) => {
        const selected = p.status === 'selected' || p.status === '선발';
        const isEx = String(p.note || '').indexOf('excellent') >= 0;
        return `<tr data-phone="${esc(p.phone)}">
          <td>${esc(p.name)}</td><td class="tnum">${esc(p.phone)}</td>
          <td><a href="${esc(p.blogUrl)}" target="_blank">블로그</a></td>
          <td><span class="badge ${selected ? 'badge--success' : p.status === 'rejected' ? 'badge--danger' : 'badge--primary'}">${esc(p.status)}</span></td>
          <td><button class="btn btn--ghost btn--sm js-ex">${isEx ? '★ 우수' : '☆'}</button></td>
          <td><button class="btn btn--secondary btn--sm js-sel">선발</button>
            <button class="btn btn--ghost btn--sm js-rej">탈락</button></td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="empty">신청자가 없습니다.</td></tr>'}
      </tbody></table>
    </div>`;
  pane.querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-sel')?.addEventListener('click', () => decide(phone, 'selected'));
    tr.querySelector('.js-rej')?.addEventListener('click', () => decide(phone, 'rejected'));
    tr.querySelector('.js-ex')?.addEventListener('click', async (e) => {
      const r2 = await apiPost(op({ action: 'setExcellent', challengeId: state.current, phone }));
      if (r2.ok) { e.target.textContent = r2.excellent ? '★ 우수' : '☆'; toast(r2.excellent ? '우수활동자 지정' : '우수 해제'); }
      else toast('실패', true);
    });
  });
}
async function decide(phone, decision) {
  const r = await apiPost(op({ action: 'select', challengeId: state.current, phones: [phone], decision }));
  if (r.ok) { toast(decision === 'selected' ? '선발됨' : '탈락 처리'); drawPane('manage'); }
  else toast('실패: ' + (r.error || ''), true);
}

async function drawMarketing(pane) {
  const link = landingUrl(state.current);
  const c = state.campaigns.find((x) => x.challengeId === state.current) || {};
  const dr = await apiGet({ action: 'campaignDetail', challengeId: state.current }).catch(() => ({}));
  const chat = (dr.challenge && dr.challenge.openchatUrl) || c.openchatUrl || '';
  pane.innerHTML = `
    <div class="card"><div class="card__title">신청 상세페이지 배포</div>
      <p class="muted" style="margin-bottom:10px">이 링크를 오픈카톡·SNS·블로그에 공유하면 참가자가 바로 신청합니다.</p>
      <div class="copybox"><input class="input" id="lnk" readonly value="${esc(link)}" />
        <button class="btn btn--secondary btn--sm" id="copy">복사</button>
        <a class="btn btn--primary btn--sm" href="${esc(link)}" target="_blank">미리보기</a></div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--secondary btn--sm" target="_blank"
          href="https://twitter.com/intent/tweet?text=${encodeURIComponent((c.name || '') + ' 참가 신청')}&url=${encodeURIComponent(link)}">X 공유</a>
        <a class="btn btn--secondary btn--sm" target="_blank"
          href="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}">QR 코드</a>
        ${chat ? `<a class="btn btn--secondary btn--sm" target="_blank" href="${esc(chat)}">오픈카톡</a>` : ''}
      </div>
    </div>
    <div class="card"><div class="card__title">상세페이지 미리보기</div>
      <iframe src="${esc(link)}" style="width:100%;height:560px;border:1px solid var(--color-border);border-radius:12px"></iframe>
    </div>`;
  el('copy').addEventListener('click', () => { el('lnk').select(); navigator.clipboard.writeText(link); toast('링크 복사됨'); });
}

/* ---------- 뷰: 운영 (주차) ---------- */
async function renderOperate() {
  await loadCampaigns();
  if (!state.current && state.campaigns[0]) setCurrent(state.campaigns[0].challengeId);
  el('content').innerHTML = `
    <div class="page-head"><h1 class="page-head__title">운영 · 주차 관리</h1>
      <p class="page-head__desc">주차를 열어 제출을 받고, 그 주 제출물을 검수합니다.</p></div>
    ${campaignPicker()}
    <div id="weeks"></div><div id="weekPane"></div>`;
  const sel = el('campSel');
  if (sel) sel.addEventListener('change', () => { setCurrent(sel.value); loadWeeks(); });
  if (state.current) loadWeeks();
}
async function loadWeeks() {
  const wrap = el('weeks'); wrap.innerHTML = loading('주차 불러오는 중…');
  const r = await apiGet({ action: 'missions', token: state.token, challengeId: state.current });
  const weeks = r.ok ? r.rows : [];
  if (!weeks.length) { wrap.innerHTML = '<p class="empty">회차가 없습니다.</p>'; el('weekPane').innerHTML = ''; return; }
  wrap.innerHTML = `<div class="weekchips">${weeks.map((w) => {
    const st = w['상태'] || '대기';
    const cls = st === '오픈' ? 's-open' : st === '마감' ? 's-done' : '';
    return `<button class="weekchip ${cls}" data-r="${esc(w['회차'])}"><span>${esc(w['회차'])}주</span><small>${esc(st)}</small></button>`;
  }).join('')}</div>`;
  wrap._weeks = weeks;
  wrap.querySelectorAll('.weekchip').forEach((b) =>
    b.addEventListener('click', () => { wrap.querySelectorAll('.weekchip').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); drawWeek(Number(b.dataset.r), weeks); }));
}
async function drawWeek(round, weeks) {
  const pane = el('weekPane'); pane.innerHTML = loading();
  const wm = weeks.find((w) => Number(w['회차']) === round) || {};
  const status = wm['상태'] || '대기';
  const r = await apiGet({ action: 'weekSubmissions', token: state.token, challengeId: state.current, round });
  const submitted = r.ok ? r.submitted : [];
  const missing = r.ok ? r.missing : [];
  pane.innerHTML = `
    <div class="card"><div class="page-head__row">
      <div><div class="card__title" style="margin:0">${round}주차 — <span class="badge ${status === '오픈' ? 'badge--success' : 'badge'}">${esc(status)}</span></div>
        <p class="muted" style="margin-top:6px">${esc(wm['미션제목'] || '미션 미입력')}</p></div>
      <div style="display:flex;gap:8px">
        ${status !== '오픈' ? `<button class="btn btn--primary btn--sm" id="open">이 주차 열기</button>` : ''}
        ${status === '오픈' ? `<button class="btn btn--secondary btn--sm" id="close">마감</button>` : ''}
      </div>
    </div></div>
    <div class="statbar">
      <div class="pill"><b class="tnum">${submitted.length}</b><span>제출</span></div>
      <div class="pill"><b class="tnum">${missing.length}</b><span>미제출(선발자)</span></div>
    </div>
    <div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr>
      <th>성함</th><th>게시물</th><th>제출일</th><th>검수</th><th>처리</th></tr></thead><tbody>
      ${submitted.length ? submitted.map((s) => `<tr data-phone="${esc(s.phone)}">
        <td>${esc(s.name)} ${s.excellent ? '<span class="badge badge--accent badge--star"></span>' : ''}</td>
        <td><a href="${esc(s.postUrl)}" target="_blank">게시물 열기</a></td>
        <td class="tnum">${esc(s.제출일시)}</td>
        <td><span class="badge ${s.검수상태 === '승인' ? 'badge--success' : s.검수상태 === '반려' ? 'badge--danger' : ''}">${esc(s.검수상태 || '대기')}</span></td>
        <td><button class="btn btn--secondary btn--sm js-ok">승인</button>
          <button class="btn btn--ghost btn--sm js-no">반려</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">제출 없음</td></tr>'}
      ${missing.map((m) => `<tr><td class="muted">${esc(m.name)}</td><td colspan="3" class="muted">미제출</td>
        <td><span class="badge badge--danger">미제출</span></td></tr>`).join('')}
    </tbody></table></div>`;
  el('open')?.addEventListener('click', () => setWeek(round, '오픈', weeks));
  el('close')?.addEventListener('click', () => setWeek(round, '마감', weeks));
  pane.querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-ok')?.addEventListener('click', () => review(phone, round, '승인', weeks));
    tr.querySelector('.js-no')?.addEventListener('click', () => review(phone, round, '반려', weeks));
  });
}
async function setWeek(round, status, weeks) {
  const r = await apiPost(op({ action: 'openWeek', challengeId: state.current, round, status }));
  if (r.ok) { toast(`${round}주차 ${status}`); loadWeeks().then(() => drawWeek(round, weeks)); }
  else toast('실패', true);
}
async function review(phone, round, status, weeks) {
  const r = await apiPost(op({ action: 'reviewSubmission', challengeId: state.current, phone, round, status }));
  if (r.ok) { toast(`검수: ${status}`); drawWeek(round, weeks); }
  else toast('실패', true);
}

/* ---------- 부트 ---------- */
renderSidebar();
window.addEventListener('hashchange', route);
route();
