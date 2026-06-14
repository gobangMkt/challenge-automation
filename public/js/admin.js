import { apiGet, apiPost } from './api.js';

/* ---------- 상태 ---------- */
const TOKEN_KEY = 'challenge.opToken';
const state = { token: localStorage.getItem(TOKEN_KEY) || '', campaigns: [], loaded: false };
const base = location.pathname.replace(/admin\.html$/, '');
const landingUrl = (id) => `${location.origin}${base}?c=${encodeURIComponent(id)}`;

/* ---------- 유틸 ---------- */
const el = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const op = (extra) => ({ token: state.token, ...extra });
const loading = (t = '불러오는 중…') => `<div class="loading"><span class="spinner"></span> ${t}</div>`;
function toast(msg, err) {
  const t = el('toast'); t.textContent = msg; t.className = 'toast is-show' + (err ? ' toast--err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = 'toast'; }, 3000);
}

/* ---------- 아이콘 (SVG, stroke 2) ---------- */
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  star: '<span class="brandstar">★</span>',
  mkt: SVG('<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
  manage: SVG('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  operate: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
};
/* 탭 메타 — 아이콘·라벨·설명·섹션색 클래스 */
const SECTIONS = {
  mkt: { label: '마케팅', icon: ICON.mkt, desc: '신청 상세페이지를 배포합니다', cls: 'sec-mkt' },
  manage: { label: '관리', icon: ICON.manage, desc: '신청자 명단·선발·우수활동자를 관리합니다', cls: 'sec-manage' },
  operate: { label: '운영', icon: ICON.operate, desc: '주차별 미션 발송과 제출 검수를 진행합니다', cls: 'sec-operate' },
};
const sechead = (tab) => {
  const s = SECTIONS[tab];
  return `<div class="sechead ${s.cls}"><span class="sechead__icon">${s.icon}</span>
    <div><div class="sechead__title">${s.label}</div><div class="sechead__desc">${s.desc}</div></div></div>`;
};

/* ---------- 데이터 (캐시) ---------- */
async function loadCampaigns(force) {
  if (state.loaded && !force) return state.campaigns;
  const r = await apiGet({ action: 'campaigns', token: state.token });
  state.campaigns = r.ok ? r.rows : [];
  state.loaded = true;
  return state.campaigns;
}
const findCamp = (id) => state.campaigns.find((c) => String(c.challengeId) === String(id));

/* ---------- 앱바 ---------- */
function brandHtml() { return `<button class="brand" id="home">${ICON.star} 챌린지 허브</button>`; }
function appbarHome() {
  el('appbar').innerHTML = `
    <div class="appbar__in">
      ${brandHtml()}
      <div class="appbar__spacer"></div>
      <button class="btn btn--primary btn--sm" id="newBtn">+ 새 캠페인</button>
      <button class="btn btn--ghost btn--sm" id="logout">로그아웃</button>
    </div>`;
  el('home').addEventListener('click', goHome);
  el('newBtn').addEventListener('click', () => { location.hash = '#/new'; });
  bindLogout();
}
function appbarWorkspace(camp, tab) {
  el('appbar').innerHTML = `
    <div class="appbar__in">
      <nav class="crumbs">
        ${brandHtml()}
        <span class="crumbs__sep">›</span>
        <span class="crumbs__cur">${esc(camp.name)}</span>
        <span class="badge ${camp.status === '모집중' ? 'badge--primary' : ''}">${esc(camp.status)}</span>
      </nav>
      <div class="appbar__spacer"></div>
      <button class="btn btn--ghost btn--sm" id="logout">로그아웃</button>
    </div>
    <div class="appbar__tabs">
      ${Object.entries(SECTIONS).map(([k, s]) =>
        `<button class="appbar__tab ${s.cls} ${k === tab ? 'is-active' : ''}" data-tab="${k}">${s.icon}<span>${s.label}</span></button>`).join('')}
    </div>`;
  el('home').addEventListener('click', goHome);
  el('appbar').querySelectorAll('.appbar__tab').forEach((b) =>
    b.addEventListener('click', () => { location.hash = `#/c/${encodeURIComponent(camp.challengeId)}/${b.dataset.tab}`; }));
  bindLogout();
}
function appbarBare() {
  el('appbar').innerHTML = `<div class="appbar__in">${brandHtml()}</div>`;
  el('home').addEventListener('click', goHome);
}
function goHome() { location.hash = '#/'; }
function bindLogout() {
  const lo = el('logout');
  if (lo) lo.addEventListener('click', () => { state.token = ''; state.loaded = false; localStorage.removeItem(TOKEN_KEY); route(); });
}

/* ---------- 토큰 게이트 ---------- */
function renderGate() {
  appbarBare();
  el('content').innerHTML = `
    <div class="gate"><div class="card">
      <div class="gate__logo">★</div>
      <h2 class="card__title" style="justify-content:center">운영자 인증</h2>
      <p class="muted" style="margin-bottom:16px">운영 토큰을 입력하세요.</p>
      <div class="field"><input class="input" id="tok" type="password" placeholder="운영 토큰" autocomplete="off" /></div>
      <button class="btn btn--primary btn--block" id="enter">입장</button>
    </div></div>`;
  const submit = async () => {
    const v = el('tok').value.trim();
    if (!v) return;
    state.token = v; state.loaded = false;
    const r = await apiGet({ action: 'campaigns', token: v }).catch(() => ({ ok: false }));
    if (r.ok) { localStorage.setItem(TOKEN_KEY, v); location.hash = '#/'; route(); }
    else toast('토큰이 올바르지 않습니다.', true);
  };
  el('enter').addEventListener('click', submit);
  el('tok').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/* ---------- 라우터 ---------- */
async function route() {
  if (!state.token) return renderGate();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (parts[0] === 'new') return await renderCreate();
    if (parts[0] === 'c' && parts[1]) return await renderWorkspace(decodeURIComponent(parts[1]), parts[2] || 'mkt');
    return await renderHome();
  } catch (e) { el('content').innerHTML = `<div class="card">오류: ${esc(e.message)}</div>`; }
}

/* ---------- 홈 (허브) ---------- */
async function renderHome() {
  appbarHome();
  el('content').innerHTML = loading();
  const c = await loadCampaigns(true); // 홈은 항상 최신
  const tApplied = c.reduce((s, x) => s + (x.applied || 0), 0);
  const tSel = c.reduce((s, x) => s + (x.selected || 0), 0);
  el('content').innerHTML = `
    <div class="page-head"><h1 class="page-head__title">캠페인 허브</h1>
      <p class="page-head__desc">캠페인을 누르면 마케팅·관리·운영을 한 곳에서 처리합니다.</p></div>
    <div class="statbar">
      <div class="pill"><b class="tnum">${c.length}</b><span>캠페인</span></div>
      <div class="pill"><b class="tnum">${tApplied}</b><span>총 신청</span></div>
      <div class="pill"><b class="tnum">${tSel}</b><span>총 선발</span></div>
    </div>
    <div class="grid" id="grid">
      ${c.map((x) => `
        <div class="camp-card" data-id="${esc(x.challengeId)}" role="button" tabindex="0">
          <div class="camp-card__top"><span class="camp-card__name">${esc(x.name)}</span>
            <span style="display:flex;gap:6px;align-items:center">
              <span class="badge ${x.status === '모집중' ? 'badge--primary' : ''}">${esc(x.status)}</span>
              <button class="btn btn--ghost btn--sm js-del" data-name="${esc(x.name)}" style="padding:2px 8px;color:var(--color-danger)">삭제</button>
            </span></div>
          <div class="camp-card__stats">
            <div><span class="stat__n tnum">${x.applied || 0}</span><span class="stat__l">신청</span></div>
            <div><span class="stat__n tnum">${x.selected || 0}</span><span class="stat__l">선발</span></div>
            <div><span class="stat__n tnum">${x.submissions || 0}</span><span class="stat__l">제출</span></div>
            <div><span class="stat__n tnum">${x.totalRounds || '-'}</span><span class="stat__l">회차</span></div>
          </div>
        </div>`).join('')}
      <button class="camp-card camp-card--new" id="newCard">+ 새 캠페인 만들기</button>
    </div>`;
  el('newCard').addEventListener('click', () => { location.hash = '#/new'; });
  el('grid').querySelectorAll('.camp-card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.addEventListener('click', () => { location.hash = `#/c/${encodeURIComponent(id)}/mkt`; });
    card.querySelector('.js-del')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`'${e.target.dataset.name}' 캠페인을 삭제할까요?\n신청·제출 등 관련 데이터가 모두 삭제됩니다.`)) return;
      const r = await apiPost(op({ action: 'deleteCampaign', challengeId: id })).catch(() => ({ ok: false }));
      if (r.ok) { state.loaded = false; toast('삭제됨'); renderHome(); } else toast('삭제 실패', true);
    });
  });
}

/* ---------- 캠페인 생성 ---------- */
async function renderCreate() {
  appbarBare();
  el('content').innerHTML = `
    <div class="page-head"><div class="page-head__row">
      <div><h1 class="page-head__title">새 캠페인</h1>
        <p class="page-head__desc">입력하면 신청 상세페이지가 자동 생성됩니다.</p></div>
      <button class="btn btn--ghost btn--sm" id="cancel">← 허브</button>
    </div></div>

    <div class="card"><div class="card__title">① 기본 정보</div>
      <div class="row2">
        <div class="field"><label class="field__label">캠페인명 <span style="color:var(--color-primary)">*</span></label>
          <input class="input" id="f-name" placeholder="취준 블로그 마스터즈" /></div>
        <div class="field"><label class="field__label">총 회차</label>
          <input class="input tnum" id="f-rounds" type="number" value="10" min="1" /></div>
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
        <input class="input" id="f-chat" value="https://open.kakao.com/o/sqKOVsue" />
        <div class="field__hint">기본 오픈카톡 링크 자동 입력 — 필요시 수정.</div></div>
    </div>

    <div class="card"><div class="card__title">② 리워드 (네이버페이 포인트)</div>
      <label class="field__label">작성 개수별 리워드</label>
      <table class="table" id="tier-tbl" style="margin-bottom:8px"><thead><tr>
        <th>최소 작성 개수</th><th>네이버페이 포인트</th><th></th></tr></thead><tbody></tbody></table>
      <button class="btn btn--ghost btn--sm" id="tier-add" type="button">+ 구간 추가</button>
      <div class="field__hint">작성 개수가 '최소 개수' 이상이면 그 포인트 지급. 예) 10개 작성 → 10,000P.</div>
    </div>

    <div class="card"><div class="card__title">③ 신청 상세페이지 콘텐츠</div>
      <div class="field"><label class="field__label">한 줄 태그라인</label>
        <input class="input" id="d-tag" placeholder="자격증 말고 블로그로 스펙 쌓기" /></div>
      <div class="field"><label class="field__label">캠페인 소개</label>
        <textarea class="textarea" id="d-concept" placeholder="누가·무엇을·왜"></textarea></div>
      <div class="field"><label class="field__label">참가 혜택 (한 줄에 하나씩)</label>
        <textarea class="textarea" id="d-benefits" placeholder="실무 스터디 자료&#10;매주 화요일 아티클&#10;작성 개수만큼 네이버페이"></textarea></div>
      <div class="row2">
        <div class="field"><label class="field__label">참가 자격</label><input class="input" id="d-elig" placeholder="개인 블로그 운영 중인 누구나" /></div>
        <div class="field"><label class="field__label">일정 안내</label><input class="input" id="d-sched" placeholder="신청~발표~10주" /></div>
      </div>
    </div>

    <div class="card"><div class="card__title">④ 회차 미션</div>
      <p class="muted">회차 미션·참고 아티클은 캠페인 생성 후 <b>운영 탭</b>에서 매주 발송 전에 입력합니다. 여기서는 위 총 회차 수만큼 빈 회차만 생성됩니다.</p>
    </div>

    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn--primary" id="save">캠페인 생성</button>
      <button class="btn btn--secondary" id="cancel2">취소</button>
    </div>`;

  // 리워드 티어
  const DEFAULT_TIERS = [{ min: 0, amount: 0 }, { min: 2, amount: 3000 }, { min: 6, amount: 5000 }, { min: 10, amount: 10000 }];
  const tbody = el('tier-tbl').querySelector('tbody');
  const tierRow = (t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="input tnum t-min" type="number" min="0" value="${t.min}" style="max-width:130px" /></td>
      <td><input class="input tnum t-amt" type="number" min="0" value="${t.amount}" style="max-width:170px" /></td>
      <td><button class="btn btn--ghost btn--sm t-del" type="button">삭제</button></td>`;
    tr.querySelector('.t-del').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
  };
  DEFAULT_TIERS.forEach(tierRow);
  el('tier-add').addEventListener('click', () => tierRow({ min: 0, amount: 0 }));

  el('cancel').addEventListener('click', () => { location.hash = '#/'; });
  el('cancel2').addEventListener('click', () => { location.hash = '#/'; });
  el('save').addEventListener('click', async (e) => {
    const name = el('f-name').value.trim();
    if (!name) return toast('캠페인명을 입력하세요.', true);
    const tiers = [...tbody.querySelectorAll('tr')].map((tr) => ({
      min: Number(tr.querySelector('.t-min').value) || 0,
      amount: Number(tr.querySelector('.t-amt').value) || 0,
    })).sort((a, b) => a.min - b.min);
    const rewardAmount = tiers.reduce((m, t) => Math.max(m, t.amount), 0);
    const payload = op({
      action: 'saveCampaign', name,
      totalRounds: Number(el('f-rounds').value) || 10,
      rewardPerPost: rewardAmount, excellentMultiplier: 2,
      모집시작: el('f-rs').value, 모집마감: el('f-re').value,
      발표일: el('f-ann').value, 시작일: el('f-start').value,
      openchatUrl: el('f-chat').value.trim(), status: '모집중',
      detail: {
        tagline: el('d-tag').value.trim(), concept: el('d-concept').value.trim(),
        benefits: el('d-benefits').value.split('\n').map((s) => s.trim()).filter(Boolean),
        eligibility: el('d-elig').value.trim(), scheduleText: el('d-sched').value.trim(),
        rewardType: 'grade', rewardTiers: tiers, rewardAmount, rewardUnit: '네이버페이 포인트',
      },
    });
    e.target.disabled = true; e.target.textContent = '생성 중…';
    const r = await apiPost(payload).catch(() => ({ ok: false }));
    if (!r.ok) { e.target.disabled = false; e.target.textContent = '캠페인 생성'; return toast('생성 실패: ' + (r.error || JSON.stringify(r.errors || {})), true); }
    state.loaded = false;
    toast('캠페인 생성 완료!');
    location.hash = `#/c/${encodeURIComponent(r.challengeId)}/mkt`;
  });
}

/* ---------- 캠페인 작업공간 ---------- */
async function renderWorkspace(id, tab) {
  el('content').innerHTML = loading();
  await loadCampaigns();
  let camp = findCamp(id);
  if (!camp) { await loadCampaigns(true); camp = findCamp(id); }
  if (!camp) { appbarBare(); el('content').innerHTML = `<div class="card">캠페인을 찾을 수 없습니다. <a href="#/">허브로</a></div>`; return; }
  appbarWorkspace(camp, tab);
  if (tab === 'manage') return drawManage(camp);
  if (tab === 'operate') return drawOperate(camp);
  return drawMarketing(camp);
}

/* ---------- 탭: 마케팅 ---------- */
async function drawMarketing(camp) {
  const id = camp.challengeId;
  const link = landingUrl(id);
  el('content').innerHTML = `
    ${sechead('mkt')}
    <div class="card"><div class="card__title">신청 상세페이지 배포</div>
      <p class="muted" style="margin-bottom:10px">이 링크를 오픈카톡·SNS·블로그에 공유하면 참가자가 바로 신청합니다.</p>
      <div class="copybox"><input class="input" id="lnk" readonly value="${esc(link)}" />
        <button class="btn btn--secondary btn--sm" id="copy">복사</button>
        <a class="btn btn--primary btn--sm" href="${esc(link)}" target="_blank">미리보기</a></div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--secondary btn--sm" target="_blank" href="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}">QR 코드</a>
        ${camp.openchatUrl ? `<a class="btn btn--secondary btn--sm" target="_blank" href="${esc(camp.openchatUrl)}">오픈카톡으로 공유</a>` : ''}
      </div>
    </div>
    <div class="card"><div class="card__title">상세페이지 미리보기</div>
      <iframe src="${esc(link)}" style="width:100%;height:560px;border:1px solid var(--color-border);border-radius:12px"></iframe>
    </div>`;
  el('copy').addEventListener('click', () => { el('lnk').select(); navigator.clipboard.writeText(link); toast('링크 복사됨'); });
}

/* ---------- 탭: 관리 ---------- */
async function drawManage(camp) {
  const id = camp.challengeId;
  el('content').innerHTML = loading('명단 불러오는 중…');
  const r = await apiGet({ action: 'participants', token: state.token, challengeId: id });
  const rows = r.ok ? r.rows : [];
  const selN = rows.filter((x) => x.status === 'selected' || x.status === '선발').length;
  el('content').innerHTML = `
    ${sechead('manage')}
    <div class="statbar">
      <div class="pill"><b class="tnum">${rows.length}</b><span>신청</span></div>
      <div class="pill"><b class="tnum">${selN}</b><span>선발</span></div>
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="table"><thead><tr><th>성함</th><th>휴대폰</th><th>블로그</th><th>상태</th><th>우수</th><th>처리</th></tr></thead><tbody>
      ${rows.length ? rows.map((p) => {
        const sel = p.status === 'selected' || p.status === '선발';
        const isEx = String(p.note || '').indexOf('excellent') >= 0;
        return `<tr data-phone="${esc(p.phone)}">
          <td>${esc(p.name)}</td><td class="tnum">${esc(p.phone)}</td>
          <td><a href="${esc(p.blogUrl)}" target="_blank">블로그</a></td>
          <td><span class="badge ${sel ? 'badge--success' : p.status === 'rejected' ? 'badge--danger' : 'badge--primary'}">${esc(p.status)}</span></td>
          <td><button class="btn btn--ghost btn--sm js-ex">${isEx ? '★ 우수' : '☆'}</button></td>
          <td><button class="btn btn--secondary btn--sm js-sel">선발</button>
            <button class="btn btn--ghost btn--sm js-rej">탈락</button></td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="empty">신청자가 없습니다.</td></tr>'}
      </tbody></table>
    </div>`;
  el('content').querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-sel')?.addEventListener('click', () => decide(camp, phone, 'selected'));
    tr.querySelector('.js-rej')?.addEventListener('click', () => decide(camp, phone, 'rejected'));
    tr.querySelector('.js-ex')?.addEventListener('click', async (e) => {
      const r2 = await apiPost(op({ action: 'setExcellent', challengeId: id, phone }));
      if (r2.ok) { e.target.textContent = r2.excellent ? '★ 우수' : '☆'; toast(r2.excellent ? '우수활동자 지정' : '우수 해제'); }
      else toast('실패', true);
    });
  });
}
async function decide(camp, phone, decision) {
  const r = await apiPost(op({ action: 'select', challengeId: camp.challengeId, phones: [phone], decision }));
  if (r.ok) { state.loaded = false; toast(decision === 'selected' ? '선발됨' : '탈락 처리'); drawManage(camp); }
  else toast('실패: ' + (r.error || ''), true);
}

/* ---------- 탭: 운영 (주차) ---------- */
async function drawOperate(camp) {
  const id = camp.challengeId;
  el('content').innerHTML = `${sechead('operate')}<div id="weeks">${loading('주차 불러오는 중…')}</div><div id="weekPane"></div>`;
  const r = await apiGet({ action: 'missions', token: state.token, challengeId: id });
  const weeks = r.ok ? r.rows : [];
  const wrap = el('weeks');
  if (!weeks.length) { wrap.innerHTML = '<p class="empty">회차가 없습니다.</p>'; return; }
  wrap.innerHTML = `<div class="weekchips">${weeks.map((w) => {
    const st = w['상태'] || '대기';
    const cls = st === '오픈' ? 's-open' : st === '마감' ? 's-done' : '';
    return `<button class="weekchip ${cls}" data-r="${esc(w['회차'])}"><span>${esc(w['회차'])}주</span><small>${esc(st)}</small></button>`;
  }).join('')}</div>`;
  wrap.querySelectorAll('.weekchip').forEach((b) =>
    b.addEventListener('click', () => { wrap.querySelectorAll('.weekchip').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); drawWeek(camp, Number(b.dataset.r), weeks); }));
}
async function drawWeek(camp, round, weeks) {
  const id = camp.challengeId;
  const pane = el('weekPane'); pane.innerHTML = loading();
  const wm = weeks.find((w) => Number(w['회차']) === round) || {};
  const status = wm['상태'] || '대기';
  const r = await apiGet({ action: 'weekSubmissions', token: state.token, challengeId: id, round });
  const submitted = r.ok ? r.submitted : [];
  const missing = r.ok ? r.missing : [];
  pane.innerHTML = `
    <div class="card">
      <div class="page-head__row">
        <div class="card__title" style="margin:0">${round}주차 <span class="badge ${status === '오픈' ? 'badge--success' : status === '마감' ? '' : 'badge--accent'}">${esc(status)}</span></div>
        <div style="display:flex;gap:8px">
          ${status !== '오픈' ? `<button class="btn btn--primary btn--sm" id="open">이 주차 열기 (발송)</button>` : ''}
          ${status === '오픈' ? `<button class="btn btn--secondary btn--sm" id="close">마감</button>` : ''}
        </div>
      </div>
      <div class="field" style="margin-top:16px"><label class="field__label">미션 제목</label>
        <input class="input" id="m-title" value="${esc(wm['미션제목'] || '')}" placeholder="예: 1주차 키워드 글쓰기" /></div>
      <div class="field"><label class="field__label">미션 안내문</label>
        <textarea class="textarea" id="m-body" placeholder="이번 주 미션 안내 (제출화면·알림톡에 노출)">${esc(wm['미션본문'] || '')}</textarea></div>
      <div class="field"><label class="field__label">참고 아티클 URL</label>
        <input class="input" id="m-article" value="${esc(wm['articleUrl'] || '')}" placeholder="https://... (이 자료 기반으로 미션 안내)" /></div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn--secondary btn--sm" id="m-save">미션 저장</button>
        <span class="muted" style="font-size:13px">발송(열기) 전에 미션을 저장하세요.</span>
      </div>
    </div>
    <div class="statbar">
      <div class="pill"><b class="tnum">${submitted.length}</b><span>제출</span></div>
      <div class="pill"><b class="tnum">${missing.length}</b><span>미제출(선발자)</span></div>
    </div>
    <div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr>
      <th>성함</th><th>게시물</th><th>제출일</th><th>검수</th><th>처리</th></tr></thead><tbody>
      ${submitted.length ? submitted.map((s) => `<tr data-phone="${esc(s.phone)}">
        <td>${esc(s.name)} ${s.excellent ? '<span class="badge badge--accent badge--star"></span>' : ''}</td>
        <td><a href="${esc(s.postUrl)}" target="_blank">게시물</a></td>
        <td class="tnum">${esc(s.제출일시)}</td>
        <td><span class="badge ${s.검수상태 === '승인' ? 'badge--success' : s.검수상태 === '반려' ? 'badge--danger' : ''}">${esc(s.검수상태 || '대기')}</span></td>
        <td><button class="btn btn--secondary btn--sm js-ok">승인</button>
          <button class="btn btn--ghost btn--sm js-no">반려</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">제출 없음</td></tr>'}
      ${missing.map((m) => `<tr><td class="muted">${esc(m.name)}</td><td colspan="3" class="muted">미제출</td><td><span class="badge badge--danger">미제출</span></td></tr>`).join('')}
    </tbody></table></div>`;
  el('m-save')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = '저장 중…';
    const rr = await apiPost(op({ action: 'saveMission', challengeId: id, round, title: el('m-title').value.trim(), body: el('m-body').value.trim(), articleUrl: el('m-article').value.trim() })).catch(() => ({ ok: false }));
    e.target.disabled = false; e.target.textContent = '미션 저장';
    if (rr.ok) toast(`${round}주차 미션 저장됨`); else toast('저장 실패', true);
  });
  el('open')?.addEventListener('click', () => setWeek(camp, round, '오픈', weeks));
  el('close')?.addEventListener('click', () => setWeek(camp, round, '마감', weeks));
  pane.querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-ok')?.addEventListener('click', () => review(camp, phone, round, '승인', weeks));
    tr.querySelector('.js-no')?.addEventListener('click', () => review(camp, phone, round, '반려', weeks));
  });
}
async function setWeek(camp, round, status, weeks) {
  const r = await apiPost(op({ action: 'openWeek', challengeId: camp.challengeId, round, status }));
  if (r.ok) { toast(`${round}주차 ${status}`); drawOperate(camp); }
  else toast('실패', true);
}
async function review(camp, phone, round, status, weeks) {
  const r = await apiPost(op({ action: 'reviewSubmission', challengeId: camp.challengeId, phone, round, status }));
  if (r.ok) { toast(`검수: ${status}`); drawWeek(camp, round, weeks); }
  else toast('실패', true);
}

/* ---------- 부트 ---------- */
window.addEventListener('hashchange', route);
route();
