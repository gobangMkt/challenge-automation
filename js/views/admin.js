import { el, toast, mount } from '../ui.js';
import { apiGet, isConfigured } from '../api.js';

const TOKEN_KEY = 'bc_operator_token';

export function renderAdmin(challengeId) {
  const saved = sessionStorage.getItem(TOKEN_KEY) || '';
  const tokenInput = el('input', {
    class: 'input', id: 'f-token', type: 'password', placeholder: '운영자 토큰',
    autocomplete: 'off', value: saved,
  });
  const loadBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '명단 불러오기');
  const result = el('div', { class: 'stack', style: 'margin-top:16px' });

  async function load(ev) {
    if (ev) ev.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) { toast('토큰을 입력해 주세요.', 'danger'); return; }
    if (!isConfigured()) { toast('서버 연결 전입니다(GAS 배포 후).', 'danger'); return; }
    sessionStorage.setItem(TOKEN_KEY, token);
    loadBtn.disabled = true; loadBtn.textContent = '불러오는 중…';
    try {
      const params = { action: 'participants', token };
      if (challengeId) params.challengeId = challengeId;
      const res = await apiGet(params);
      if (!res.ok) {
        result.replaceChildren(el('p', { class: 'muted' },
          res.error === 'forbidden' ? '토큰이 올바르지 않습니다.' : '불러오기 실패.'));
        return;
      }
      renderTable(result, res.rows || []);
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '명단 불러오기';
    }
  }

  const panel = el('form', { class: 'card', onsubmit: load }, [
    el('div', { class: 'row-between' }, [
      el('h1', { style: 'font-size:22px' }, '신청자 명단'),
      el('span', { class: 'badge badge--accent' }, challengeId || '전체'),
    ]),
    el('div', { class: 'field', style: 'margin-top:16px' }, [
      el('label', { for: 'f-token' }, '운영자 인증'),
      el('div', { style: 'display:flex; gap:8px' }, [tokenInput, loadBtn]),
    ]),
  ]);

  mount(el('div', { class: 'wrap--wide rise rise-1', style: 'max-width:1000px' }, [panel, result]));
  if (saved) load();
}

function renderTable(container, rows) {
  if (!rows.length) {
    container.replaceChildren(el('div', { class: 'card center muted' }, '아직 신청자가 없습니다.'));
    return;
  }
  const head = el('tr', {}, ['#', '성함', '휴대폰', '블로그', '상태', '신청일']
    .map((h) => el('th', {}, h)));
  const body = rows.map((r, i) => el('tr', {}, [
    el('td', { class: 'tnum' }, String(i + 1)),
    el('td', {}, r.name || ''),
    el('td', { class: 'tnum' }, r.phone || ''),
    el('td', {}, r.blogUrl ? el('a', { href: r.blogUrl, target: '_blank', rel: 'noopener' }, '열기') : ''),
    el('td', {}, el('span', { class: 'badge badge--ok' }, r.status || 'applied')),
    el('td', { class: 'muted' }, fmtDate(r.appliedAt)),
  ]));
  const table = el('table', { class: 'table' }, [el('thead', {}, head), el('tbody', {}, body)]);
  container.replaceChildren(
    el('div', { class: 'card' }, [
      el('p', { class: 'muted', style: 'margin:0 0 12px' }, `총 ${rows.length}명`),
      table,
    ]),
  );
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
