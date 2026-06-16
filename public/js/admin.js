import { apiGet, apiPost } from './api.js';
import { thumbNode, posterNode, downloadNode } from './assets.js';

/* ---------- 상태 ---------- */
const TOKEN_KEY = 'challenge.opToken';
const state = { token: localStorage.getItem(TOKEN_KEY) || '', campaigns: [], loaded: false, cache: { detail: {}, board: {} } };
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

/* 확인 모달 — window.confirm 대체 (BI 모달, Promise<boolean>) */
const _MICON = {
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
};
function confirmModal({ title, message = '', confirmLabel = '확인', cancelLabel = '취소', danger = false }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-title">
        <div class="modal__icon ${danger ? '' : 'modal__icon--primary'}">${danger ? _MICON.trash : _MICON.alert}</div>
        <h3 class="modal__title" id="cf-title">${esc(title)}</h3>
        ${message ? `<p class="modal__msg">${esc(message)}</p>` : ''}
        <div class="modal__actions">
          <button class="btn btn--secondary" data-act="cancel">${esc(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('is-show'));
    const finish = (val) => {
      back.classList.remove('is-show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => back.remove(), 200);
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); else if (e.key === 'Enter') finish(true); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => { if (e.target === back) finish(false); });
    back.querySelector('[data-act=cancel]').addEventListener('click', () => finish(false));
    back.querySelector('[data-act=ok]').addEventListener('click', () => finish(true));
    back.querySelector('[data-act=ok]').focus();
  });
}

/* 진행률 표시 — 버튼을 진행바로 교체. 응답 동안 ~92%까지 점근, done(ok)에서 100% 또는 복원 */
function genProgress(btn, label) {
  btn.disabled = true;
  const box = document.createElement('div');
  box.className = 'genprog';
  box.innerHTML = `<div class="genprog__track"><i></i></div><span class="genprog__txt">${label}… <b>0%</b></span>`;
  btn.insertAdjacentElement('afterend', box);
  btn.style.display = 'none';
  const bar = box.querySelector('i'), num = box.querySelector('b'), lab = box.querySelector('.genprog__txt');
  let p = 0;
  const tick = () => { p += Math.max(0.8, (92 - p) * 0.09); if (p > 92) p = 92; bar.style.width = p + '%'; num.textContent = Math.round(p) + '%'; };
  tick(); const timer = setInterval(tick, 180);
  return {
    done(ok) {
      clearInterval(timer);
      if (ok) { bar.style.width = '100%'; num.textContent = '100%'; lab.childNodes[0].textContent = '완료 '; }
      else { box.remove(); btn.style.display = ''; btn.disabled = false; }
    },
  };
}

/* ---------- 아이콘 (SVG, stroke 2) ---------- */
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  star: '<span class="brandstar">★</span>',
  mkt: SVG('<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
  manage: SVG('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  operate: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  reward: SVG('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6 12h.01M18 12h.01"/>'),
  refresh: SVG('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
};
/* 탭 메타 — 아이콘·라벨·설명·섹션색 클래스 */
const SECTIONS = {
  mkt: { label: '마케팅', icon: ICON.mkt, desc: '신청 상세페이지를 배포합니다', cls: 'sec-mkt' },
  manage: { label: '관리', icon: ICON.manage, desc: '신청자 명단·선발·우수활동자를 관리합니다', cls: 'sec-manage' },
  operate: { label: '운영', icon: ICON.operate, desc: '주차별 미션 발송과 제출 검수를 진행합니다', cls: 'sec-operate' },
  reward: { label: '리워드', icon: ICON.reward, desc: '지급 금액별로 정산을 정리합니다', cls: 'sec-reward' },
};
const sechead = () => ''; // 섹션 배너 제거 — 설명은 상단 탭 툴팁(title)으로 노출

/* ---------- 공고 텍스트 파서 (빠른 채우기) ---------- */
function parseRecruit(text) {
  const out = { benefits: [], tiers: [] };
  const norm = String(text).replace(/\r/g, '');
  const yr = new Date().getFullYear();
  const md = (s) => { const m = String(s).match(/(\d{1,2})\.(\d{1,2})/); return m ? `${yr}-${('0' + m[1]).slice(-2)}-${('0' + m[2]).slice(-2)}` : ''; };

  // 캠페인명: "OOO에서 시작" 패턴
  let m = norm.match(/(?:^|\n)\s*([가-힣A-Za-z0-9·\- ]{2,40}?)에서\s*시작/);
  if (m) out.name = m[1].trim();

  // 일정
  let rec = norm.match(/신청\s*접수[^\n]*?[:：]\s*([^\n]+)/);
  if (rec) { const p = rec[1].split('~'); out.rs = md(p[0]); if (p[1]) out.re = md(p[1]); }
  let ann = norm.match(/(?:참가자\s*)?발표[^\n]*?[:：]\s*([^\n]+)/);
  if (ann) out.ann = md(ann[1]);
  let run = norm.match(/실습\s*진행[^\n]*?[:：]\s*([^\n]+)/);
  if (run) out.start = md(run[1].split('~')[0]);

  // 총 회차 (N주)
  let wk = norm.match(/(\d{1,2})\s*주\s*간?/);
  if (wk) out.totalRounds = Number(wk[1]);

  // 리워드 티어: "N개 ... 숫자 포인트"
  const re = /(\d{1,2})\s*(?:[~\-]\s*\d*)?\s*개[^\n]*?([\d,]+)\s*포인트/g;
  let t; while ((t = re.exec(norm))) out.tiers.push({ min: Number(t[1]), amount: Number(t[2].replace(/,/g, '')) });

  // 섹션 분할 (■ 헤더)
  const blocks = { intro: [] };
  let cur = 'intro';
  norm.split('\n').forEach((line) => {
    const h = line.match(/^\s*■\s*(.+)/);
    if (h) { cur = h[1].trim(); blocks[cur] = []; }
    else if (line.trim()) blocks[cur].push(line.trim());
  });
  if (blocks.intro.length) out.concept = blocks.intro.join('\n');
  Object.keys(blocks).forEach((k) => {
    if (/참가\s*자격/.test(k)) out.eligibility = blocks[k].join(' ');
    if (/활동\s*내용|참여\s*혜택/.test(k)) {
      blocks[k].forEach((l) => {
        if (!/포인트/.test(l) && !/문의/.test(l)) out.benefits.push(l.replace(/^[★※•\-]\s*/, '').trim());
      });
    }
    if (/진행\s*절차/.test(k)) out.scheduleText = blocks[k].join(' · ');
  });
  return out;
}

/* ---------- 데이터 (캐시) ---------- */
async function loadCampaigns(force) {
  if (state.loaded && !force) return state.campaigns;
  const r = await apiGet({ action: 'campaigns', token: state.token });
  state.campaigns = r.ok ? r.rows : [];
  if (r && r.dbUrl) state.dbUrl = r.dbUrl;
  state.loaded = true;
  return state.campaigns;
}
const findCamp = (id) => state.campaigns.find((c) => String(c.challengeId) === String(id));

/* 캐시: campaignDetail(거의 불변)·matrix(변경 시 무효화) — 탭 전환 시 재조회 줄여 속도 개선 */
async function loadDetail(id, force) {
  if (!force && state.cache.detail[id]) return state.cache.detail[id];
  const d = await apiGet({ action: 'campaignDetail', challengeId: id }).catch(() => ({}));
  state.cache.detail[id] = d; return d;
}
async function loadBoard(id, force) {
  if (!force && state.cache.board[id]) return state.cache.board[id];
  const b = await apiGet({ action: 'boardData', token: state.token, challengeId: id }).catch(() => ({ ok: false }));
  state.cache.board[id] = b; return b;
}

/* ---------- 리워드 계산 (정책: 갯수 티어 or 제출수×단가, 우수활동자 ×배수) ---------- */
const won = (n) => '₩' + (Number(n) || 0).toLocaleString('ko-KR');
const digits_ = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const toDateInput = (v) => { const m = String(v == null ? '' : v).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : ''; };
// 주차별 우수(운영에서 지정) — note의 'exw=6,8' 토큰. 우수 주차가 하나라도 있으면 우수활동자(리워드 ×배수).
const exWeeks_ = (note) => { const m = String(note == null ? '' : note).match(/exw=([\d,]+)/); return m ? m[1].split(',').map(Number).filter((n) => !isNaN(n)) : []; };
const isExcellent_ = (note) => exWeeks_(note).length > 0;
function rewardPolicy_(detail, challenge) {
  const d = detail || {}, c = challenge || {};
  // excellentMultiplier는 campaignDetail에 미노출 → 앱 기본·랜딩 표기와 동일하게 2배
  const mult = Number(d.excellentMultiplier || c.excellentMultiplier) || 2;
  if (d.rewardType === 'grade' && Array.isArray(d.rewardTiers) && d.rewardTiers.length) {
    return { type: 'grade', tiers: d.rewardTiers.slice().sort((a, b) => Number(a.min) - Number(b.min)), mult };
  }
  return { type: 'linear', perPost: Number(d.rewardAmount || c.rewardPerPost || 0), mult };
}
function rewardFor_(count, excellent, pol) {
  let base = 0;
  if (pol.type === 'grade') { for (const t of pol.tiers) if (Number(count) >= Number(t.min)) base = Number(t.amount) || 0; }
  else base = (Number(count) || 0) * pol.perPost;
  return excellent ? base * pol.mult : base;
}

/* ---------- 앱바 ---------- */
function brandHtml() { return `<button class="brand" id="home">${ICON.star} 챌린지 허브</button>`; }
function appbarHome() {
  el('appbar').innerHTML = `
    <div class="appbar__in">
      ${brandHtml()}
      <div class="appbar__spacer"></div>
      <button class="btn btn--ghost btn--sm btn--icon" id="refresh" title="새로고침" aria-label="새로고침">${ICON.refresh}</button>
      <button class="btn btn--primary btn--sm" id="newBtn">+ 새 캠페인</button>
      <button class="btn btn--ghost btn--sm" id="logout">로그아웃</button>
    </div>`;
  el('home').addEventListener('click', goHome);
  el('newBtn').addEventListener('click', () => { location.hash = '#/new'; });
  bindRefresh(); bindLogout();
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
      <button class="btn btn--ghost btn--sm btn--icon" id="refresh" title="새로고침" aria-label="새로고침">${ICON.refresh}</button>
      <button class="btn btn--ghost btn--sm" id="logout">로그아웃</button>
    </div>
    <div class="appbar__tabs">
      ${Object.entries(SECTIONS).map(([k, s]) =>
        `<button class="appbar__tab ${s.cls} ${k === tab ? 'is-active' : ''}" data-tab="${k}" title="${s.desc}">${s.icon}<span>${s.label}</span></button>`).join('')}
    </div>`;
  el('home').addEventListener('click', goHome);
  el('appbar').querySelectorAll('.appbar__tab').forEach((b) =>
    b.addEventListener('click', () => { location.hash = `#/c/${encodeURIComponent(camp.challengeId)}/${b.dataset.tab}`; }));
  bindRefresh(); bindLogout();
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
function bindRefresh() {
  const rb = el('refresh');
  if (!rb) return;
  rb.addEventListener('click', () => {
    state.loaded = false; state.cache = { detail: {}, board: {} }; // 캐시 비우고 현재 화면 새로 로드
    toast('새로고침');
    route();
  });
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
    if (parts[0] === 'edit' && parts[1]) return await renderCreate(decodeURIComponent(parts[1]));
    if (parts[0] === 'c' && parts[1]) return await renderWorkspace(decodeURIComponent(parts[1]), parts[2] || 'mkt');
    return await renderHome();
  } catch (e) { el('content').innerHTML = `<div class="card">오류: ${esc(e.message)}</div>`; }
}

/* 홈 카드 진행률 — 제출 진행(제출 ÷ 선발×회차). 선발 전이면 모집 단계 */
function campProgress(x) {
  const sel = x.selected || 0, rounds = x.totalRounds || 0, subs = x.submissions || 0;
  const exp = sel * rounds;
  const started = sel > 0 && exp > 0;
  const pct = started ? Math.min(100, Math.round((subs / exp) * 100)) : 0;
  const label = started ? `제출 진행 ${subs}/${exp}` : '모집 단계';
  return `<div class="camp-prog">
    <div class="camp-prog__head"><span>${label}</span><b class="tnum">${started ? pct + '%' : '–'}</b></div>
    <div class="camp-prog__track"><i style="width:${pct}%"></i></div>
  </div>`;
}

/* ---------- 홈 (허브) ---------- */
async function renderHome() {
  appbarHome();
  el('content').innerHTML = loading();
  const c = await loadCampaigns(true); // 홈은 항상 최신
  const tApplied = c.reduce((s, x) => s + (x.applied || 0), 0);
  const tSel = c.reduce((s, x) => s + (x.selected || 0), 0);
  el('content').innerHTML = `
    <div class="page-head page-head__row"><div>
      <h1 class="page-head__title">캠페인 허브</h1>
      <p class="page-head__desc">캠페인을 누르면 마케팅·관리·운영을 한 곳에서 처리합니다.</p></div>
      ${state.dbUrl ? `<a class="btn btn--secondary btn--sm" href="${esc(state.dbUrl)}" target="_blank" rel="noopener">🗄 DB 시트 열기 ↗</a>` : ''}
    </div>
    <div class="statbar">
      <div class="pill"><b class="tnum">${c.length}</b><span>캠페인</span></div>
      <div class="pill"><b class="tnum">${tApplied}</b><span>총 신청</span></div>
      <div class="pill"><b class="tnum">${tSel}</b><span>총 선발</span></div>
    </div>
    <div class="grid" id="grid">
      ${c.map((x) => `
        <div class="camp-card" data-id="${esc(x.challengeId)}" role="button" tabindex="0">
          <div class="camp-card__top"><span class="camp-card__name">${esc(x.name)}</span>
            <span class="camp-card__actions">
              <span class="badge ${x.status === '모집중' ? 'badge--primary' : ''}">${esc(x.status)}</span>
              <button class="btn btn--ghost btn--sm js-edit" style="padding:2px 8px;color:var(--color-primary)">수정</button>
              <button class="btn btn--ghost btn--sm js-del" data-name="${esc(x.name)}" style="padding:2px 8px;color:var(--color-danger)">삭제</button>
            </span></div>
          <div class="camp-card__stats">
            <div><span class="stat__n tnum">${x.applied || 0}</span><span class="stat__l">신청</span></div>
            <div><span class="stat__n tnum">${x.selected || 0}</span><span class="stat__l">선발</span></div>
            <div><span class="stat__n tnum">${x.submissions || 0}</span><span class="stat__l">제출</span></div>
            <div><span class="stat__n tnum">${x.totalRounds || '-'}</span><span class="stat__l">회차</span></div>
          </div>
          ${campProgress(x)}
        </div>`).join('')}
      <button class="camp-card camp-card--new" id="newCard">+ 새 캠페인 만들기</button>
    </div>`;
  el('newCard').addEventListener('click', () => { location.hash = '#/new'; });
  el('grid').querySelectorAll('.camp-card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.addEventListener('click', () => { location.hash = `#/c/${encodeURIComponent(id)}/mkt`; });
    card.querySelector('.js-edit')?.addEventListener('click', (e) => { e.stopPropagation(); location.hash = `#/edit/${encodeURIComponent(id)}`; });
    card.querySelector('.js-del')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmModal({
        title: `'${e.target.dataset.name}' 캠페인을 삭제할까요?`,
        message: '신청·제출 등 관련 데이터가 모두 삭제됩니다.\n이 작업은 되돌릴 수 없어요.',
        confirmLabel: '삭제',
        danger: true,
      });
      if (!ok) return;
      const r = await apiPost(op({ action: 'deleteCampaign', challengeId: id })).catch(() => ({ ok: false }));
      if (r.ok) { state.loaded = false; toast('삭제됨'); renderHome(); } else toast('삭제 실패', true);
    });
  });
}

/* ---------- 캠페인 생성 ---------- */
async function renderCreate(editId) {
  appbarBare();
  const editing = !!editId;
  el('content').innerHTML = `
    <div class="page-head"><div class="page-head__row">
      <div><h1 class="page-head__title">${editing ? '캠페인 수정' : '새 캠페인'}</h1>
        <p class="page-head__desc">${editing ? '상세페이지 내용을 수정하면 저장 즉시 반영됩니다.' : '입력하면 신청 상세페이지가 자동 생성됩니다.'}</p></div>
      <button class="btn btn--ghost btn--sm" id="cancel">← ${editing ? '취소' : '허브'}</button>
    </div></div>

    <div class="card" style="border-color:var(--color-primary)">
      <div class="card__title">빠른 채우기 — 모집 공고 붙여넣기</div>
      <p class="muted" style="margin-bottom:8px">공고 전문을 붙여넣고 버튼을 누르면 캠페인명·일정·혜택·참가자격·리워드 구간·회차를 자동 추출합니다. 못 찾은 빈 곳만 직접 채우세요.</p>
      <textarea class="textarea" id="paste" style="min-height:120px" placeholder="모집 공고 텍스트를 여기에 붙여넣기"></textarea>
      <button class="btn btn--primary btn--sm" id="autofill" type="button" style="margin-top:8px">자동 채우기</button>
    </div>

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

  // 수정 모드: 기존 값 불러와 채우기
  let editStatus = '모집중';
  if (editing) {
    el('content').style.opacity = '.5';
    const r = await apiGet({ action: 'campaignDetail', token: state.token, challengeId: editId }).catch(() => ({ ok: false }));
    el('content').style.opacity = '';
    if (!r.ok) { toast('캠페인을 불러오지 못했습니다.', true); location.hash = '#/'; return; }
    const ch = r.challenge || {}, d = r.detail || {};
    editStatus = ch.status || '모집중';
    const setv = (id, v) => { if (el(id) != null) el(id).value = v == null ? '' : v; };
    setv('f-name', ch.name); setv('f-rounds', ch.totalRounds || 10);
    setv('f-rs', ch['모집시작']); setv('f-re', ch['모집마감']); setv('f-ann', ch['발표일']); setv('f-start', ch['시작일']);
    if (ch.openchatUrl) setv('f-chat', ch.openchatUrl);
    setv('d-tag', d.tagline); setv('d-concept', d.concept);
    setv('d-benefits', Array.isArray(d.benefits) ? d.benefits.join('\n') : '');
    setv('d-elig', d.eligibility); setv('d-sched', d.scheduleText);
    if (Array.isArray(d.rewardTiers) && d.rewardTiers.length) { tbody.innerHTML = ''; d.rewardTiers.slice().sort((a, b) => a.min - b.min).forEach(tierRow); }
  }

  // 빠른 채우기
  el('autofill').addEventListener('click', () => {
    const text = el('paste').value;
    if (!text.trim()) return toast('공고 텍스트를 붙여넣으세요.', true);
    const d = parseRecruit(text);
    let n = 0;
    const set = (id, v) => { if (v) { el(id).value = v; n += 1; } };
    set('f-name', d.name); set('d-concept', d.concept); set('d-elig', d.eligibility);
    set('d-sched', d.scheduleText);
    set('f-rs', d.rs); set('f-re', d.re); set('f-ann', d.ann); set('f-start', d.start);
    if (d.benefits.length) { el('d-benefits').value = d.benefits.join('\n'); n += 1; }
    if (d.totalRounds) { el('f-rounds').value = d.totalRounds; n += 1; }
    if (d.tiers.length) { tbody.innerHTML = ''; d.tiers.sort((a, b) => a.min - b.min).forEach(tierRow); n += 1; }
    toast(n ? `${n}개 항목 자동 채움 — 빈 곳을 확인하세요` : '추출된 항목이 없습니다', !n);
  });

  const backHash = editing ? `#/c/${encodeURIComponent(editId)}/mkt` : '#/';
  el('save').textContent = editing ? '변경사항 저장' : '캠페인 생성';
  el('cancel').addEventListener('click', () => { location.hash = backHash; });
  el('cancel2').addEventListener('click', () => { location.hash = backHash; });
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
      challengeId: editing ? editId : undefined,
      totalRounds: Number(el('f-rounds').value) || 10,
      rewardPerPost: rewardAmount, excellentMultiplier: 2,
      모집시작: el('f-rs').value, 모집마감: el('f-re').value,
      발표일: el('f-ann').value, 시작일: el('f-start').value,
      openchatUrl: el('f-chat').value.trim(), status: editing ? editStatus : '모집중',
      detail: {
        tagline: el('d-tag').value.trim(), concept: el('d-concept').value.trim(),
        benefits: el('d-benefits').value.split('\n').map((s) => s.trim()).filter(Boolean),
        eligibility: el('d-elig').value.trim(), scheduleText: el('d-sched').value.trim(),
        rewardType: 'grade', rewardTiers: tiers, rewardAmount, rewardUnit: '네이버페이 포인트',
      },
    });
    const prog = genProgress(e.target, editing ? '저장 중' : '생성 중');
    const r = await apiPost(payload).catch(() => ({ ok: false }));
    prog.done(r.ok);
    if (!r.ok) return toast((editing ? '저장' : '생성') + ' 실패: ' + (r.error || JSON.stringify(r.errors || {})), true);
    state.loaded = false;
    toast(editing ? '수정 완료!' : '캠페인 생성 완료!');
    location.hash = `#/c/${encodeURIComponent(r.challengeId || editId)}/mkt`;
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
  if (tab === 'reward') return drawReward(camp);
  return drawMarketing(camp);
}

/* ---------- 업로드 사이트 (Notion '서포터즈 모집 사이트 리스트' 상태=사용 기준) ---------- */
const UPLOAD_SITES = [
  { name: '요즘것들', url: 'https://allforyoung.com/', loginId: 'neoflatworks2@gmail.com', tags: ['웹사이트'] },
  { name: 'LINKareer', url: 'https://linkareer.com/', loginId: 'neoflatworks2', tags: ['웹사이트'] },
  { name: 'Contest KOREA', url: 'https://www.contestkorea.com/', loginId: 'neoflatworks2', tags: ['웹사이트'] },
  { name: 'Spectory (스펙토리)', url: 'http://spectory.net/', loginId: 'neoflatworks2@gmail.com', tags: ['웹사이트'] },
  { name: '스펙업', url: 'https://cafe.naver.com/specup', loginId: 'muggle0707', tags: ['네이버카페'], note: '대외활동│서포터즈' },
  { name: '독취사', url: 'https://cafe.naver.com/dokchi', loginId: 'muggle0707', tags: ['네이버카페'] },
  { name: '씽유', url: 'https://thinkyou.co.kr/', loginId: 'neoflatworks2', tags: ['웹사이트'] },
  { name: '씽긋', url: 'https://www.thinkcontest.com/thinkgood/index.do', loginId: 'neoflatworks2', tags: ['웹사이트'] },
];
const uploadKey = (id) => `challenge.upload.${id}`;
const getUploaded = (id) => { try { return new Set(JSON.parse(localStorage.getItem(uploadKey(id)) || '[]')); } catch (e) { return new Set(); } };
const setUploaded = (id, set) => localStorage.setItem(uploadKey(id), JSON.stringify([...set]));

// 직접 추가한 업로드 사이트 (모든 캠페인 공통, 이 기기에 저장)
const CUSTOM_SITES_KEY = 'challenge.usites.custom';
const getCustomSites = () => { try { return JSON.parse(localStorage.getItem(CUSTOM_SITES_KEY) || '[]'); } catch (e) { return []; } };
const setCustomSites = (arr) => localStorage.setItem(CUSTOM_SITES_KEY, JSON.stringify(arr));

/* ---------- 탭: 마케팅 ---------- */
async function drawMarketing(camp) {
  const id = camp.challengeId;
  const link = landingUrl(id);
  const done = getUploaded(id);
  const sites = UPLOAD_SITES.concat(getCustomSites());
  const sitesHtml = sites.map((s) => `
    <li class="usite ${done.has(s.name) ? 'is-done' : ''}">
      <label class="usite__chk"><input type="checkbox" data-name="${esc(s.name)}" ${done.has(s.name) ? 'checked' : ''} /></label>
      <div class="usite__main">
        <div class="usite__top"><span class="usite__name">${esc(s.name)}</span>
          ${(s.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join('')}</div>
        <div class="usite__meta">
          ${s.loginId ? `<span>ID <b>${esc(s.loginId)}</b></span>
          <button class="btn btn--ghost btn--sm js-cpid" data-id="${esc(s.loginId)}">ID 복사</button>` : ''}
          ${s.note ? `<span class="usite__note">${esc(s.note)}</span>` : ''}</div>
      </div>
      <a class="btn btn--secondary btn--sm" href="${esc(s.url)}" target="_blank" rel="noopener">열기</a>
      ${s.custom ? `<button class="btn btn--ghost btn--sm js-usite-del" data-name="${esc(s.name)}" style="color:var(--color-danger)">삭제</button>` : ''}
    </li>`).join('');
  el('content').innerHTML = `
    ${sechead('mkt')}
    <div class="card"><div class="card__title" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <span>신청 상세페이지 배포</span>
      <button class="btn btn--ghost btn--sm" id="editCamp" title="상세 내용 수정" aria-label="상세 내용 수정" style="padding:7px 9px"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M13.1 2.5a1.5 1.5 0 0 1 2.1 0l2.3 2.3a1.5 1.5 0 0 1 0 2.1l-8.6 8.6-4.5 1.2 1.2-4.5z" fill="currentColor"/></svg></button></div>
      <p class="muted" style="margin-bottom:10px">이 링크를 오픈카톡·SNS·블로그에 공유하면 참가자가 바로 신청합니다.</p>
      <div class="linkrow">
        <div class="linkrow__cell">
          <div class="linkrow__label">참가 신청 페이지</div>
          <div class="linkrow__btns">
            <button class="btn btn--secondary btn--sm" id="copy">링크 복사</button>
            <a class="btn btn--primary btn--sm" href="${esc(link)}" target="_blank">열기</a></div>
        </div>
        <div class="linkrow__cell">
          <div class="linkrow__label">주차 제출 페이지</div>
          <div class="linkrow__btns">
            <button class="btn btn--secondary btn--sm" id="copySubmit">링크 복사</button>
            <a class="btn btn--primary btn--sm" href="${esc(link)}#submit" target="_blank">열기</a></div>
        </div>
      </div>
    </div>
    <div class="card"><div class="card__title">썸네일 · 포스터 <span class="mono" style="color:var(--color-ink-faint);font-size:13px;font-weight:500">자동 생성</span></div>
      <p class="muted" style="margin-bottom:16px">캠페인 BI로 자동 합성됩니다. 다운로드해 업로드 사이트에 첨부하세요.</p>
      <div class="assets">
        <div class="asset"><div class="asset__prev" id="prevThumb"><span class="muted" style="font-size:13px">생성 중…</span></div>
          <button class="btn btn--secondary btn--sm" id="dlThumb">썸네일 다운로드 (1:1)</button></div>
        <div class="asset"><div class="asset__prev asset__prev--poster" id="prevPoster"><span class="muted" style="font-size:13px">생성 중…</span></div>
          <button class="btn btn--secondary btn--sm" id="dlPoster">포스터 다운로드</button></div>
      </div>
    </div>
    <div class="card"><div class="card__title">업로드할 사이트 <span id="uploadCount" class="mono" style="color:var(--color-ink-faint);font-size:13px;font-weight:500"></span></div>
      <p class="muted" style="margin-bottom:14px">상세페이지 링크를 아래 사이트에 등록하세요. 체크하면 진행 상황이 이 기기에 저장됩니다.</p>
      <ul class="usites">${sitesHtml}</ul>
      <div class="usite-add">
        <input class="input" id="us-name" placeholder="사이트명" />
        <input class="input" id="us-url" placeholder="https://..." />
        <input class="input" id="us-id" placeholder="로그인 ID (선택)" />
        <button class="btn btn--secondary btn--sm" id="us-add">+ 사이트 추가</button>
      </div>
    </div>`;
  el('copy').addEventListener('click', () => { navigator.clipboard.writeText(link); toast('신청 페이지 링크 복사됨'); });
  el('copySubmit').addEventListener('click', () => { navigator.clipboard.writeText(`${link}#submit`); toast('주차 제출 링크 복사됨'); });
  el('editCamp').addEventListener('click', () => { location.hash = `#/edit/${encodeURIComponent(id)}`; });

  // 썸네일·포스터 (상세 fetch 후 html2canvas로 미리보기 이미지 + 다운로드)
  (async () => {
    const det = await apiGet({ action: 'campaignDetail', challengeId: id }).catch(() => ({}));
    const cc = det.challenge || camp; const dd = det.detail || {};
    async function renderInto(boxId, node, dispW) {
      const box = el(boxId); if (!box) return;
      try {
        if (typeof window.html2canvas !== 'function') throw new Error('lib');
        if (document.fonts) await document.fonts.ready;
        const stage = document.createElement('div'); stage.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1';
        stage.appendChild(node); document.body.appendChild(stage);
        const canvas = await window.html2canvas(node, { scale: 0.5, backgroundColor: null, useCORS: true, logging: false });
        stage.remove();
        box.innerHTML = ''; box.style.height = 'auto';
        const img = new Image(); img.src = canvas.toDataURL('image/png');
        img.style.cssText = `width:${dispW}px;height:auto;display:block;border-radius:8px`;
        box.appendChild(img);
      } catch (e) { box.innerHTML = '<span class="muted" style="font-size:12px">미리보기 생성 실패 (다운로드는 가능)</span>'; }
    }
    await renderInto('prevThumb', thumbNode(cc, dd), 240);
    await renderInto('prevPoster', posterNode(cc, dd), 240);
    const dl = (btnId, makeNode, suffix) => el(btnId)?.addEventListener('click', async (e) => {
      const b = e.currentTarget, old = b.textContent; b.disabled = true; b.textContent = '생성 중…';
      try { await downloadNode(makeNode(), `${cc.name}_${suffix}.png`, 1); }
      catch (err) { toast('이미지 생성 실패: ' + err.message, true); }
      b.disabled = false; b.textContent = old;
    });
    dl('dlThumb', () => thumbNode(cc, dd), '썸네일');
    dl('dlPoster', () => posterNode(cc, dd), '포스터');
  })();

  const refreshCount = () => { el('uploadCount').textContent = `${getUploaded(id).size}/${sites.length}`; };
  refreshCount();
  el('content').querySelectorAll('.usite input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const set = getUploaded(id);
      if (cb.checked) set.add(cb.dataset.name); else set.delete(cb.dataset.name);
      setUploaded(id, set);
      cb.closest('.usite').classList.toggle('is-done', cb.checked);
      refreshCount();
    });
  });
  el('content').querySelectorAll('.js-cpid').forEach((b) =>
    b.addEventListener('click', () => { navigator.clipboard.writeText(b.dataset.id); toast('ID 복사됨'); }));

  // 직접 추가
  el('us-add').addEventListener('click', () => {
    const name = el('us-name').value.trim();
    let url = el('us-url').value.trim();
    const loginId = el('us-id').value.trim();
    if (!name || !url) return toast('사이트명과 URL을 입력하세요.', true);
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const list = getCustomSites();
    if (UPLOAD_SITES.concat(list).some((s) => s.name === name)) return toast('이미 같은 이름의 사이트가 있습니다.', true);
    list.push({ name, url, loginId, tags: ['직접추가'], custom: true });
    setCustomSites(list);
    drawMarketing(camp);
    toast('사이트 추가됨');
  });

  // 직접 추가 사이트 삭제
  el('content').querySelectorAll('.js-usite-del').forEach((b) =>
    b.addEventListener('click', () => {
      const name = b.dataset.name;
      setCustomSites(getCustomSites().filter((s) => s.name !== name));
      const set = getUploaded(id);
      if (set.delete(name)) setUploaded(id, set);
      drawMarketing(camp);
      toast('삭제됨');
    }));
}

/* ---------- 탭: 관리 ---------- */
async function drawManage(camp) {
  const id = camp.challengeId;
  const myHash = location.hash;
  el('content').innerHTML = loading('명단 불러오는 중…');
  const b = await loadBoard(id);
  if (location.hash !== myHash) return; // 응답 대기 중 다른 탭으로 이동 → 덮어쓰기 방지
  const rows = b.ok ? b.rows : [];
  const selN = rows.filter((x) => x.status === 'selected' || x.status === '선발').length;
  const totalW = (b.ok && Number(b.totalWeeks)) || Number(camp.totalRounds) || 0;
  const pol = rewardPolicy_(b.policy, b.policy);
  const cntOf = (p) => Number(p.submitted) || 0;
  // 중복 탐지: 휴대폰(숫자만)·블로그(정규화)
  const normBlog = (u) => {
    const s = String(u == null ? '' : u).trim().toLowerCase();
    if (!s) return '';
    const mid = s.match(/blogid=([a-z0-9_-]+)/);
    if (mid) return 'naver:' + mid[1];
    const mp = s.match(/(?:m\.)?blog\.naver\.com\/([a-z0-9_-]+)/);
    if (mp && mp[1] !== 'postlist.naver') return 'naver:' + mp[1];
    return s.replace(/[?#].*$/, '').replace(/\/+$/, '');
  };
  const phoneCnt = {}, blogCnt = {};
  rows.forEach((p) => { const k = digits_(p.phone); if (k) phoneCnt[k] = (phoneCnt[k] || 0) + 1; const bk = normBlog(p.blogUrl); if (bk) blogCnt[bk] = (blogCnt[bk] || 0) + 1; });
  const dupP = Object.values(phoneCnt).filter((n) => n > 1).length;
  const dupB = Object.values(blogCnt).filter((n) => n > 1).length;
  const DUP = '<span class="badge badge--danger" style="margin-left:6px;font-size:10px;padding:1px 6px">중복</span>';
  el('content').innerHTML = `
    ${sechead('manage')}
    <div class="statbar">
      <div class="pill"><b class="tnum">${rows.length}</b><span>신청</span></div>
      <div class="pill"><b class="tnum" id="selCount">${selN}</b><span>선발</span></div>
      ${(dupP || dupB) ? `<div class="pill" style="border-color:var(--color-danger)"><b class="tnum" style="color:var(--color-danger)">${dupP + dupB}</b><span>중복 ${dupP ? '번호' : ''}${dupP && dupB ? '·' : ''}${dupB ? '블로그' : ''}</span></div>` : ''}
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="table"><thead><tr><th>성함</th><th>휴대폰</th><th>블로그</th><th>제출</th><th>선발/탈락</th><th>우수활동자</th><th>예상 리워드</th><th>삭제</th></tr></thead><tbody>
      ${rows.length ? rows.map((p) => {
        const sel = p.status === 'selected' || p.status === '선발';
        const rej = p.status === 'rejected' || p.status === '탈락';
        const exwks = exWeeks_(p.note);
        const isEx = exwks.length > 0;
        const cnt = cntOf(p);
        const pDup = phoneCnt[digits_(p.phone)] > 1;
        const bDup = blogCnt[normBlog(p.blogUrl)] > 1;
        return `<tr data-phone="${esc(p.phone)}" data-count="${cnt}" class="${isEx ? 'is-excellent' : ''}${(pDup || bDup) ? ' is-dup' : ''}">
          <td>${esc(p.name)}</td><td class="tnum">${esc(p.phone)}${pDup ? DUP : ''}</td>
          <td><a href="${esc(p.blogUrl)}" target="_blank">블로그</a>${bDup ? DUP : ''}</td>
          <td class="tnum js-sub">${sel ? `${cnt}/${totalW}` : '–'}</td>
          <td><span class="seg">
            <button class="seg__btn js-sel ${sel ? 'is-on' : ''}">선발</button>
            <button class="seg__btn seg__btn--rej js-rej ${rej ? 'is-on' : ''}">탈락</button></span></td>
          <td class="ex-cell">${isEx ? `<span class="ex-tag" title="우수 주차: ${exwks.join(', ')}주차"><span class="exstar">★</span> ${exwks.length}주</span>` : '<span class="muted">–</span>'}</td>
          <td class="tnum js-amt">${sel ? won(rewardFor_(cnt, isEx, pol)) : '–'}</td>
          <td><button class="btn btn--ghost btn--sm js-pdel" style="color:var(--color-danger)">삭제</button></td>
        </tr>`;
      }).join('') : '<tr><td colspan="8" class="empty">신청자가 없습니다.</td></tr>'}
      </tbody></table>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">제출수=실제 제출 건수 · 예상 리워드=${pol.type === 'grade' ? '제출갯수 티어' : '제출수×단가'} 기준, 우수활동자 ×${pol.mult}. <b>우수활동자는 운영 탭의 주차별 제출 검수에서 지정</b>하며 여기서는 표시만 됩니다. 확정 정산은 <b>리워드</b> 탭 참고.</p>`;
  const refreshRow = (tr) => {
    const cnt = Number(tr.dataset.count) || 0;
    const selNow = tr.querySelector('.js-sel')?.classList.contains('is-on');
    const isEx = tr.classList.contains('is-excellent');
    const sub = tr.querySelector('.js-sub'), amt = tr.querySelector('.js-amt');
    if (sub) sub.textContent = selNow ? `${cnt}/${totalW}` : '–';
    if (amt) amt.textContent = selNow ? won(rewardFor_(cnt, isEx, pol)) : '–';
  };
  el('content').querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-sel')?.addEventListener('click', async () => { await decide(camp, phone, 'selected', tr); refreshRow(tr); });
    tr.querySelector('.js-rej')?.addEventListener('click', async () => { await decide(camp, phone, 'rejected', tr); refreshRow(tr); });
    tr.querySelector('.js-pdel')?.addEventListener('click', async () => {
      const name = tr.querySelector('td')?.textContent || '';
      const ok = await confirmModal({ title: `'${name}' 신청자를 삭제할까요?`, message: '신청·제출 기록이 함께 삭제됩니다.', confirmLabel: '삭제', danger: true });
      if (!ok) return;
      const r2 = await apiPost(op({ action: 'deleteParticipant', challengeId: id, phone })).catch(() => ({ ok: false }));
      if (r2.ok) { state.loaded = false; state.cache.board[id] = null; toast('삭제됨'); drawManage(camp); } else toast('삭제 실패: ' + (r2.error || ''), true);
    });
  });
}
async function decide(camp, phone, decision, tr) {
  const r = await apiPost(op({ action: 'select', challengeId: camp.challengeId, phones: [phone], decision }));
  if (!r.ok) return toast('실패: ' + (r.error || ''), true);
  state.loaded = false; state.cache.board[camp.challengeId] = null; // 홈 카드 통계 + matrix 재계산
  if (tr) {
    tr.querySelector('.js-sel')?.classList.toggle('is-on', decision === 'selected');
    tr.querySelector('.js-rej')?.classList.toggle('is-on', decision === 'rejected');
    const pill = el('selCount');
    if (pill) pill.textContent = el('content').querySelectorAll('.js-sel.is-on').length;
  }
  toast(decision === 'selected' ? '선발됨' : '탈락 처리');
}

/* ---------- 탭: 리워드 (지급 금액별 정산 정리) ---------- */
async function drawReward(camp) {
  const id = camp.challengeId;
  const myHash = location.hash;
  el('content').innerHTML = loading('정산 계산 중…');
  const b = await loadBoard(id);
  if (location.hash !== myHash) return;
  const totalW = (b.ok && Number(b.totalWeeks)) || Number(camp.totalRounds) || 0;
  const pol = rewardPolicy_(b.policy, b.policy);
  const selected = (b.ok ? b.rows : []).filter((p) => p.status === 'selected' || p.status === '선발');
  const people = selected.map((p) => {
    const excellent = isExcellent_(p.note);
    const count = Number(p.submitted) || 0;
    return { name: p.name, phone: p.phone, blogUrl: p.blogUrl, count, excellent, amount: rewardFor_(count, excellent, pol) };
  });
  const grand = people.reduce((s, x) => s + x.amount, 0);
  const groups = {};
  people.forEach((x) => { (groups[x.amount] = groups[x.amount] || []).push(x); });
  const amounts = Object.keys(groups).map(Number).sort((a, b) => b - a);

  const groupsHtml = amounts.map((amt) => {
    const list = groups[amt].slice().sort((a, b) => b.count - a.count);
    const sum = amt * list.length;
    const body = list.map((x) => `<tr>
      <td>${esc(x.name)}${x.excellent ? ' <span class="exstar">★</span>' : ''}</td>
      <td class="tnum">${esc(x.phone)}</td>
      <td><a href="${esc(x.blogUrl)}" target="_blank">블로그</a></td>
      <td class="tnum">${x.count}/${totalW}</td>
      <td class="tnum">${x.excellent ? 'Y' : 'N'}</td></tr>`).join('');
    return `<div class="rwd-group">
      <div class="rwd-group__head">
        <span class="rwd-group__amt">${won(amt)}<i>/인</i></span>
        <span class="rwd-group__cnt">${list.length}명</span>
        <span class="rwd-group__sum">합계 ${won(sum)}</span>
      </div>
      <div class="card" style="padding:0;overflow:auto;margin:0">
        <table class="table" style="table-layout:fixed">
        <colgroup><col style="width:22%"/><col style="width:26%"/><col/><col style="width:13%"/><col style="width:11%"/></colgroup>
        <thead><tr><th>성함</th><th>휴대폰</th><th>블로그</th><th>제출</th><th>우수</th></tr></thead>
        <tbody>${body}</tbody></table>
      </div>
    </div>`;
  }).join('');

  el('content').innerHTML = `
    ${sechead('reward')}
    <div class="statbar">
      <div class="pill"><b class="tnum">${people.length}</b><span>정산 대상</span></div>
      <div class="pill"><b class="tnum">${won(grand)}</b><span>총 지급액</span></div>
      <div class="pill"><b class="tnum">${pol.type === 'grade' ? '갯수 티어' : won(pol.perPost) + '/건'}</b><span>단가 · 우수 ×${pol.mult}</span></div>
    </div>
    ${people.length ? groupsHtml : '<div class="card center muted">정산 대상(선발자)이 없습니다.</div>'}
    <p class="muted" style="margin-top:12px;font-size:12px">금액별 그룹 · 제출 실건수 기준 · 우수활동자 ★는 ×${pol.mult}. excellentMultiplier 미설정 시 기본 2배 적용.</p>`;
}

/* ---------- 탭: 운영 (주차) ---------- */
async function drawOperate(camp) {
  const id = camp.challengeId;
  const myHash = location.hash;
  el('content').innerHTML = `${sechead('operate')}<div id="opGlobal"></div><div id="weeks">${loading('주차 불러오는 중…')}</div><div id="weekPane"></div>`;
  const [r, det] = await Promise.all([
    apiGet({ action: 'missions', token: state.token, challengeId: id }),
    loadDetail(id),
  ]);
  if (location.hash !== myHash) return; // 응답 대기 중 다른 탭으로 이동 → 덮어쓰기 방지
  const gd = det.detail || {};
  const hasGlobal = !!(gd.eduUrl || gd.guide || gd.notice);
  el('opGlobal').innerHTML = `
    <details class="foldcard"${hasGlobal ? '' : ' open'}>
      <summary class="foldcard__sum"><span class="foldcard__chev" aria-hidden="true">›</span><span class="card__title" style="margin:0">전역 설정 <span class="muted" style="font-size:13px;font-weight:500">교육자료·작성가이드·유의사항 (매주 공통)</span></span></summary>
      <div class="foldcard__body">
      <div class="field"><label class="field__label">교육자료(교재) 링크</label>
        <input class="input" id="g-edu" value="${esc(gd.eduUrl || '')}" placeholder="https://... (SEO 교재·교육자료)" />
        ${gd.eduUrl ? '<div class="field__hint">✓ 설정됨 — 제출 화면 상단에 상시 노출</div>' : '<div class="field__hint">참가자 제출 화면 상단에 상시 노출됩니다.</div>'}</div>
      <div class="field"><label class="field__label">안내문 (작성가이드 + 유의사항 · 매주 공통)</label>
        <textarea class="textarea" id="g-guide" style="min-height:340px" placeholder="작성가이드 · 제출 마감 · 리워드 · 우등생 선정기준 · 제외 대상 등 매주 동일하게 노출될 내용 전체를 한 번에 붙여넣기">${esc(gd.guide || gd.notice || '')}</textarea>
        <div class="field__hint">자동 서식: ★★소제목★★ / ------- 구분선 / - · 1. 리스트 / **굵게**(bold) / 느낌표 문장(강조색).</div></div>
      <button class="btn btn--secondary btn--sm" id="g-save">전역 설정 저장</button>
      </div>
    </details>`;
  el('g-save').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = '저장 중…';
    const rr = await apiPost(op({ action: 'saveCampaignMeta', challengeId: id, eduUrl: el('g-edu').value.trim(), guide: el('g-guide').value })).catch(() => ({ ok: false }));
    e.target.disabled = false; e.target.textContent = '전역 설정 저장';
    if (rr.ok) { state.cache.detail[id] = null; toast('전역 설정 저장됨' + (rr.eduName ? ` · 교재: ${rr.eduName}` : '')); drawOperate(camp); } else toast('저장 실패', true);
  });
  const weeks = r.ok ? r.rows : [];
  const wrap = el('weeks');
  if (!weeks.length) { wrap.innerHTML = '<p class="empty">회차가 없습니다.</p>'; return; }
  wrap.innerHTML = `<div class="op-sectit">회차 선택</div><div class="weekchips">${weeks.map((w) => {
    const st = w['상태'] || '대기';
    const cls = st === '오픈' ? 's-open' : st === '마감' ? 's-done' : 's-wait';
    return `<button class="weekchip ${cls}" data-r="${esc(w['회차'])}"><span class="weekchip__n">${esc(w['회차'])}주</span><span class="weekchip__st">${esc(st === '마감' ? '종료' : st)}</span></button>`;
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
  const locked = status === '오픈' || status === '마감';
  const stLabel = status === '마감' ? '종료' : status; // 종료=마감
  const dis = locked ? ' disabled' : '';
  pane.innerHTML = `
    <div class="card">
      <div class="page-head__row">
        <div class="card__title" style="margin:0;display:flex;align-items:center;gap:10px">${round}주차
          <span class="badge ${status === '오픈' ? 'badge--success' : status === '마감' ? '' : 'badge--primary'}">${esc(stLabel)}</span></div>
        <div style="display:flex;gap:10px;align-items:center">
          <label class="switch${status === '대기' ? ' is-disabled' : ''}" title="${status === '대기' ? '저장하면 오픈됩니다' : '오픈/종료 전환'}">
            <input type="checkbox" id="wk-onoff" ${status === '오픈' ? 'checked' : ''}${status === '대기' ? ' disabled' : ''} />
            <span class="switch__track"><span class="switch__thumb"></span></span>
            <span class="switch__txt">${status === '오픈' ? '오픈' : '종료'}</span>
          </label>
          <button class="btn ${locked ? 'btn--ghost' : 'btn--primary'} btn--sm" id="wk-save" data-mode="${locked ? 'edit' : 'save'}">${locked ? '수정' : '저장'}</button>
          <button class="btn btn--ghost btn--sm" id="wk-refresh">↻</button>
        </div>
      </div>
      <p class="muted" style="margin-top:14px;font-size:13px">내용 입력 후 <b>저장</b>하면 잠기고 주차가 <b>오픈</b>됩니다. 오픈/종료는 우측 토글로 전환하세요. 작성가이드·교육자료는 <b>전역 설정</b>에서 관리됩니다.</p>
      <div class="row2">
        <div class="field"><label class="field__label">오픈일 <span class="req">*</span></label>
          <input class="input" id="m-open" type="date" value="${esc(toDateInput(wm['오픈일']))}"${dis} /></div>
        <div class="field"><label class="field__label">마감일 <span class="req">*</span></label>
          <input class="input" id="m-due" type="date" value="${esc(toDateInput(wm['마감일']))}"${dis} /></div>
      </div>
      <div class="row2">
        <div class="field"><label class="field__label">참고 아티클 URL</label>
          <input class="input" id="m-article" value="${esc(wm['articleUrl'] || '')}" placeholder="https://... (아티클명 자동 추출)"${dis} />
          ${wm['articleName'] ? `<div class="field__hint">현재: <b>${esc(wm['articleName'])}</b></div>` : '<div class="field__hint">저장 시 제목 자동 추출</div>'}</div>
        <div class="field"><label class="field__label">키워드</label>
          <input class="input" id="m-keyword" value="${esc(wm['미션본문'] || '')}" placeholder="예: #고시원준비물 (여러 개면 쉼표)"${dis} /></div>
      </div>
      <div class="notifybar">
        <button class="btn btn--kakao" id="wk-notify"${status === '대기' ? ' disabled' : ''}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.7-2.5.6.1 1.3.1 2 .1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>
          알림톡 발송</button>
        <span class="muted" style="font-size:13px">${status === '대기' ? '저장(오픈) 후 발송할 수 있어요.' : '선발자 전원에게 이번 주 안내를 보냅니다.'}</span>
      </div>
    </div>
    <div class="card">
      <div class="card__title">제출 <span class="muted" style="font-size:13px;font-weight:500">${submitted.length}명</span></div>
      ${submitted.length ? `<div style="overflow-x:auto"><table class="table table--fixed">
        <colgroup><col style="width:30%"/><col style="width:14%"/><col style="width:24%"/><col style="width:16%"/><col style="width:16%"/></colgroup>
        <thead><tr><th>성함</th><th>게시물</th><th>제출일</th><th class="ta-c">상태</th><th class="ta-c">처리</th></tr></thead><tbody>
        ${submitted.map((s) => {
        const rej = s.검수상태 === '반려';
        return `<tr data-phone="${esc(s.phone)}" class="${rej ? 'is-rejected' : ''}">
          <td class="ellip"><span class="op-name"><span class="op-name__t">${esc(s.name)}</span>
            <button class="exbtn js-wex ${s.excellent ? 'is-ex' : ''}" title="우수활동자 지정/해제" aria-label="우수활동자">${s.excellent ? '★' : '☆'}</button></span></td>
          <td><a href="${esc(s.postUrl)}" target="_blank">게시물</a></td>
          <td class="tnum">${esc(s.제출일시)}</td>
          <td class="ta-c"><span class="badge ${rej ? 'badge--danger' : 'badge--success'}">${rej ? '반려' : '정상'}</span></td>
          <td class="ta-c"><button class="btn ${rej ? 'btn--danger' : 'btn--ghost'} btn--sm js-no" data-rej="${rej ? '1' : ''}">${rej ? '반려 해제' : '반려'}</button></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>` : '<p class="empty">아직 제출이 없습니다.</p>'}
    </div>
    <div class="card">
      <div class="card__title">미제출 <span class="muted" style="font-size:13px;font-weight:500">${missing.length}명</span></div>
      ${missing.length ? `<div class="namechips">${missing.map((m) => `<span class="namechip">${esc(m.name)}</span>`).join('')}</div>` : '<p class="empty">선발자 전원 제출 완료!</p>'}
    </div>`;
  el('wk-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.mode === 'edit') { // 잠금 해제 → 수정 모드
      ['m-open', 'm-due', 'm-article', 'm-keyword'].forEach((i) => { el(i).disabled = false; });
      el('m-open').focus();
      btn.dataset.mode = 'save'; btn.textContent = '저장';
      btn.classList.remove('btn--ghost'); btn.classList.add('btn--primary');
      return;
    }
    const openDate = el('m-open').value, dueDate = el('m-due').value;
    const keyword = el('m-keyword').value.trim(), articleUrl = el('m-article').value.trim();
    if (!openDate || !dueDate) return toast('오픈일·마감일을 모두 입력하세요.', true);
    if (openDate > dueDate) return toast('마감일이 오픈일보다 빠릅니다.', true);
    btn.disabled = true; btn.textContent = '저장 중…';
    const rr = await apiPost(op({ action: 'saveMission', challengeId: id, round, body: keyword, articleUrl, openDate, dueDate })).catch(() => ({ ok: false }));
    if (!rr.ok) { btn.disabled = false; btn.textContent = '저장'; return toast('저장 실패', true); }
    // 저장 후 자동 오픈
    await apiPost(op({ action: 'openWeek', challengeId: id, round, status: '오픈' })).catch(() => ({}));
    wm['미션본문'] = keyword; wm['articleUrl'] = articleUrl;
    wm['오픈일'] = openDate; wm['마감일'] = dueDate; wm['상태'] = '오픈';
    if (rr.articleName != null) wm['articleName'] = rr.articleName;
    state.cache.board[id] = null;
    toast(`${round}주차 저장 · 오픈됨${rr.articleName ? ` · 아티클: ${rr.articleName}` : ''}`);
    drawWeek(camp, round, weeks);
  });
  el('wk-refresh')?.addEventListener('click', () => drawWeek(camp, round, weeks));
  el('wk-onoff')?.addEventListener('change', async (e) => {
    const next = e.target.checked ? '오픈' : '마감';
    const rr = await apiPost(op({ action: 'openWeek', challengeId: id, round, status: next })).catch(() => ({ ok: false }));
    if (rr.ok) { wm['상태'] = next; state.cache.board[id] = null; toast(`${round}주차 ${next === '오픈' ? '오픈' : '종료'}`); drawWeek(camp, round, weeks); }
    else { e.target.checked = !e.target.checked; toast('상태 변경 실패', true); }
  });
  el('wk-notify')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await confirmModal({ title: `${round}주차 알림톡을 발송할까요?`, message: '선발자 전원에게 이번 주 안내가 발송됩니다.', confirmLabel: '발송' });
    if (!ok) return;
    const orig = btn.innerHTML;
    btn.disabled = true; btn.textContent = '발송 중…';
    const rr = await apiPost(op({ action: 'notifyWeek', challengeId: id, round })).catch(() => ({ ok: false }));
    btn.disabled = false; btn.innerHTML = orig;
    if (rr.ok) toast(`발송 완료 · 성공 ${rr.sent || 0}${rr.fail ? ` · 실패 ${rr.fail}` : ''}`, rr.fail > 0);
    else toast('발송 실패: ' + (rr.error || 'SOLAPI 설정 확인'), true);
  });
  pane.querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-no')?.addEventListener('click', (e) => {
      const rejNow = e.currentTarget.dataset.rej === '1';
      review(camp, phone, round, rejNow ? '' : '반려', weeks); // 토글: 반려 ↔ 해제
    });
    tr.querySelector('.js-wex')?.addEventListener('click', async () => {
      const r2 = await apiPost(op({ action: 'setWeekExcellent', challengeId: id, round, phone })).catch(() => ({ ok: false }));
      if (r2.ok) { toast(r2.excellent ? `${round}주차 우수 지정` : '우수 해제'); drawWeek(camp, round, weeks); } else toast('실패', true);
    });
  });
  // 회차 칩 상태 동기화 (오픈/종료 전환 시 칩 라벨·색 즉시 반영)
  const chip = el('weeks')?.querySelector(`.weekchip[data-r="${round}"]`);
  if (chip) {
    const stx = wm['상태'] || '대기';
    chip.classList.remove('s-open', 's-done', 's-wait');
    chip.classList.add(stx === '오픈' ? 's-open' : stx === '마감' ? 's-done' : 's-wait');
    const se = chip.querySelector('.weekchip__st');
    if (se) se.textContent = stx === '마감' ? '종료' : stx;
  }
}
async function review(camp, phone, round, status, weeks) {
  const r = await apiPost(op({ action: 'reviewSubmission', challengeId: camp.challengeId, phone, round, status }));
  if (r.ok) { toast(status === '반려' ? '반려 처리' : '반려 해제'); drawWeek(camp, round, weeks); }
  else toast('실패', true);
}

/* ---------- 부트 ---------- */
window.addEventListener('hashchange', route);
route();
