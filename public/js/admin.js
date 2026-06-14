import { apiGet, apiPost } from './api.js';
import { thumbNode, posterNode, downloadNode } from './assets.js';

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

/* ---------- 탭: 마케팅 ---------- */
async function drawMarketing(camp) {
  const id = camp.challengeId;
  const link = landingUrl(id);
  const done = getUploaded(id);
  const sitesHtml = UPLOAD_SITES.map((s) => `
    <li class="usite ${done.has(s.name) ? 'is-done' : ''}">
      <label class="usite__chk"><input type="checkbox" data-name="${esc(s.name)}" ${done.has(s.name) ? 'checked' : ''} /></label>
      <div class="usite__main">
        <div class="usite__top"><span class="usite__name">${esc(s.name)}</span>
          ${s.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join('')}</div>
        <div class="usite__meta"><span>ID <b>${esc(s.loginId)}</b></span>
          <button class="btn btn--ghost btn--sm js-cpid" data-id="${esc(s.loginId)}">ID 복사</button>
          ${s.note ? `<span class="usite__note">${esc(s.note)}</span>` : ''}</div>
      </div>
      <a class="btn btn--secondary btn--sm" href="${esc(s.url)}" target="_blank" rel="noopener">열기</a>
    </li>`).join('');
  el('content').innerHTML = `
    ${sechead('mkt')}
    <div class="card"><div class="card__title">신청 상세페이지 배포</div>
      <p class="muted" style="margin-bottom:10px">이 링크를 오픈카톡·SNS·블로그에 공유하면 참가자가 바로 신청합니다.</p>
      <div class="copybox"><input class="input" id="lnk" readonly value="${esc(link)}" />
        <button class="btn btn--secondary btn--sm" id="copy">복사</button>
        <a class="btn btn--primary btn--sm" href="${esc(link)}" target="_blank">미리보기</a></div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn--primary btn--sm" id="editCamp">상세 내용 수정</button>
        <a class="btn btn--secondary btn--sm" target="_blank" href="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}">QR 코드</a>
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
    </div>`;
  el('copy').addEventListener('click', () => { el('lnk').select(); navigator.clipboard.writeText(link); toast('링크 복사됨'); });
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

  const refreshCount = () => { el('uploadCount').textContent = `${getUploaded(id).size}/${UPLOAD_SITES.length}`; };
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
      <table class="table"><thead><tr><th>성함</th><th>휴대폰</th><th>블로그</th><th>선발/탈락</th><th>우수활동자</th><th>삭제</th></tr></thead><tbody>
      ${rows.length ? rows.map((p) => {
        const sel = p.status === 'selected' || p.status === '선발';
        const rej = p.status === 'rejected' || p.status === '탈락';
        const isEx = String(p.note || '').indexOf('excellent') >= 0;
        return `<tr data-phone="${esc(p.phone)}">
          <td>${esc(p.name)}</td><td class="tnum">${esc(p.phone)}</td>
          <td><a href="${esc(p.blogUrl)}" target="_blank">블로그</a></td>
          <td><span class="seg">
            <button class="seg__btn js-sel ${sel ? 'is-on' : ''}">선발</button>
            <button class="seg__btn seg__btn--rej js-rej ${rej ? 'is-on' : ''}">탈락</button></span></td>
          <td><button class="btn btn--ghost btn--sm js-ex ${isEx ? 'is-ex' : ''}">${isEx ? '★ 우수' : '☆ 지정'}</button></td>
          <td><button class="btn btn--ghost btn--sm js-pdel" style="color:var(--color-danger)">삭제</button></td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="empty">신청자가 없습니다.</td></tr>'}
      </tbody></table>
    </div>`;
  el('content').querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-sel')?.addEventListener('click', () => decide(camp, phone, 'selected'));
    tr.querySelector('.js-rej')?.addEventListener('click', () => decide(camp, phone, 'rejected'));
    tr.querySelector('.js-pdel')?.addEventListener('click', async () => {
      const name = tr.querySelector('td')?.textContent || '';
      const ok = await confirmModal({ title: `'${name}' 신청자를 삭제할까요?`, message: '신청·제출 기록이 함께 삭제됩니다.', confirmLabel: '삭제', danger: true });
      if (!ok) return;
      const r2 = await apiPost(op({ action: 'deleteParticipant', challengeId: id, phone })).catch(() => ({ ok: false }));
      if (r2.ok) { state.loaded = false; toast('삭제됨'); drawManage(camp); } else toast('삭제 실패: ' + (r2.error || ''), true);
    });
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
  el('content').innerHTML = `${sechead('operate')}<div id="opGlobal"></div><div id="weeks">${loading('주차 불러오는 중…')}</div><div id="weekPane"></div>`;
  const [r, det] = await Promise.all([
    apiGet({ action: 'missions', token: state.token, challengeId: id }),
    apiGet({ action: 'campaignDetail', challengeId: id }).catch(() => ({})),
  ]);
  const gd = det.detail || {};
  el('opGlobal').innerHTML = `
    <div class="card"><div class="card__title">전역 설정 <span class="muted" style="font-size:13px;font-weight:500">모든 주차 공통</span></div>
      <div class="field"><label class="field__label">교육자료(교재) 링크</label>
        <input class="input" id="g-edu" value="${esc(gd.eduUrl || '')}" placeholder="https://... (SEO 교재·교육자료)" />
        ${gd.eduName ? `<div class="field__hint">현재: <b>${esc(gd.eduName)}</b></div>` : '<div class="field__hint">저장 시 링크 제목을 자동으로 가져옵니다.</div>'}</div>
      <div class="field"><label class="field__label">참고하세요 (유의사항 · 제출 화면 하단 노출)</label>
        <textarea class="textarea" id="g-notice" style="min-height:200px" placeholder="제출 마감 정책 · 리워드 안내 · 우등생 선정기준 · 제외 대상 등">${esc(gd.notice || '')}</textarea>
        <div class="field__hint">자동 서식: ★★소제목★★ / ------- / 리스트 / **강조**.</div></div>
      <button class="btn btn--secondary btn--sm" id="g-save">전역 설정 저장</button>
    </div>`;
  el('g-save').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = '저장 중…';
    const rr = await apiPost(op({ action: 'saveCampaignMeta', challengeId: id, eduUrl: el('g-edu').value.trim(), notice: el('g-notice').value })).catch(() => ({ ok: false }));
    e.target.disabled = false; e.target.textContent = '전역 설정 저장';
    if (rr.ok) { toast('전역 설정 저장됨' + (rr.eduName ? ` · 교재: ${rr.eduName}` : '')); drawOperate(camp); } else toast('저장 실패', true);
  });
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
          <button class="btn btn--ghost btn--sm" id="wk-refresh">↻ 새로고침</button>
          ${status !== '오픈' ? `<button class="btn btn--primary btn--sm" id="open">이 주차 열기 (발송)</button>` : ''}
          ${status === '오픈' ? `<button class="btn btn--secondary btn--sm" id="close">마감</button>` : ''}
        </div>
      </div>
      <div class="field" style="margin-top:16px"><label class="field__label">미션 제목</label>
        <input class="input" id="m-title" value="${esc(wm['미션제목'] || '')}" placeholder="예: 1주차 키워드 글쓰기" /></div>
      <div class="field"><label class="field__label">참고 아티클 URL</label>
        <input class="input" id="m-article" value="${esc(wm['articleUrl'] || '')}" placeholder="https://... (아티클명은 URL에서 자동 추출)" />
        ${wm['articleName'] ? `<div class="field__hint">현재 아티클: <b>${esc(wm['articleName'])}</b></div>` : '<div class="field__hint">저장 시 링크 제목을 자동으로 가져옵니다.</div>'}</div>
      <div class="field"><label class="field__label">주차 안내문 (전체)</label>
        <textarea class="textarea" id="m-body" style="min-height:340px" placeholder="교재·아티클·키워드·작성가이드·제출마감·리워드·우등생 선정기준·유의사항 등 안내문 전체를 붙여넣기.">${esc(wm['미션본문'] || '')}</textarea>
        <div class="field__hint">자동 서식: 빈 줄=문단, <b>★★ 소제목 ★★</b>=소제목, <b>-------</b>=구분선, <b>- / 1.</b>=리스트, <b>**굵게**</b>·느낌표 문장=강조.</div></div>
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
          <button class="btn btn--ghost btn--sm js-no">반려</button>
          <button class="btn btn--ghost btn--sm js-wex ${s.excellent ? 'is-ex' : ''}">${s.excellent ? '★ 우수' : '☆ 우수'}</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">제출 없음</td></tr>'}
      ${missing.map((m) => `<tr><td class="muted">${esc(m.name)}</td><td colspan="3" class="muted">미제출</td><td><span class="badge badge--danger">미제출</span></td></tr>`).join('')}
    </tbody></table></div>`;
  el('m-save')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = '저장 중…';
    const rr = await apiPost(op({ action: 'saveMission', challengeId: id, round, title: el('m-title').value.trim(), body: el('m-body').value.trim(), articleUrl: el('m-article').value.trim() })).catch(() => ({ ok: false }));
    e.target.disabled = false; e.target.textContent = '미션 저장';
    if (rr.ok) { toast(`${round}주차 미션 저장됨${rr.articleName ? ` · 아티클: ${rr.articleName}` : ''}`); drawWeek(camp, round, weeks); } else toast('저장 실패', true);
  });
  el('wk-refresh')?.addEventListener('click', () => drawWeek(camp, round, weeks));
  el('open')?.addEventListener('click', () => setWeek(camp, round, '오픈', weeks));
  el('close')?.addEventListener('click', () => setWeek(camp, round, '마감', weeks));
  pane.querySelectorAll('tr[data-phone]').forEach((tr) => {
    const phone = tr.dataset.phone;
    tr.querySelector('.js-ok')?.addEventListener('click', () => review(camp, phone, round, '승인', weeks));
    tr.querySelector('.js-no')?.addEventListener('click', () => review(camp, phone, round, '반려', weeks));
    tr.querySelector('.js-wex')?.addEventListener('click', async () => {
      const r2 = await apiPost(op({ action: 'setExcellent', challengeId: id, phone })).catch(() => ({ ok: false }));
      if (r2.ok) { toast(r2.excellent ? '우수활동자 지정' : '우수 해제'); drawWeek(camp, round, weeks); } else toast('실패', true);
    });
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
