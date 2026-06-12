import { el, toast, mount } from '../ui.js';
import { apiGet, isConfigured } from '../api.js';
import { buildMatrix } from '../lib/matrix.js';

const TOKEN_KEY = 'bc_operator_token';

export function renderAdminMatrix(challengeId) {
  const saved = sessionStorage.getItem(TOKEN_KEY) || '';
  const tokenInput = el('input', {
    class: 'input', id: 'm-token', type: 'password', placeholder: '운영자 토큰',
    autocomplete: 'off', value: saved,
  });
  const loadBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '현황 불러오기');
  const result = el('div', { class: 'stack', style: 'margin-top:16px' });

  const sort = { key: 'name', dir: 1 };

  async function load(ev) {
    if (ev) ev.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) { toast('토큰을 입력해 주세요.', 'danger'); return; }
    if (!isConfigured()) { toast('서버 연결 전입니다(GAS 배포 후).', 'danger'); return; }
    if (!challengeId) { toast('챌린지를 지정해 주세요(?c=).', 'danger'); return; }
    sessionStorage.setItem(TOKEN_KEY, token);
    loadBtn.disabled = true; loadBtn.textContent = '불러오는 중…';
    try {
      const res = await apiGet({ action: 'matrix', token, challengeId });
      if (!res.ok) {
        result.replaceChildren(el('p', { class: 'muted' },
          res.error === 'forbidden' ? '토큰이 올바르지 않습니다.' : '불러오기 실패.'));
        return;
      }
      const m = res.matrix || buildMatrix([], [], res.totalWeeks || 0);
      renderMatrix(result, m, res.totalWeeks || (m.weekTotals || []).length, sort, () =>
        renderMatrix(result, m, res.totalWeeks || (m.weekTotals || []).length, sort));
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '현황 불러오기';
    }
  }

  const panel = el('form', { class: 'card', onsubmit: load }, [
    el('div', { class: 'row-between' }, [
      el('h1', { style: 'font-size:22px' }, '제출현황 매트릭스'),
      el('span', { class: 'badge badge--accent' }, challengeId || '미지정'),
    ]),
    el('div', { class: 'field', style: 'margin-top:16px' }, [
      el('label', { for: 'm-token' }, '운영자 인증'),
      el('div', { style: 'display:flex; gap:8px' }, [tokenInput, loadBtn]),
    ]),
  ]);

  mount(el('div', { class: 'wrap--wide rise rise-1', style: 'max-width:1200px' }, [panel, result]));
  if (saved && challengeId) load();
}

function renderMatrix(container, m, totalWeeks, sort, rerender) {
  const weeks = totalWeeks || (m.weekTotals || []).length;
  if (!m.rows.length) {
    container.replaceChildren(el('div', { class: 'card center muted' }, '운영 대상 참가자가 없습니다.'));
    return;
  }

  const pct = Math.round((m.completionRate || 0) * 100);
  const doneCount = m.rows.filter((r) => r.done).length;

  const summary = el('div', { class: 'card' }, [
    el('div', { class: 'row-between', style: 'flex-wrap:wrap; gap:12px' }, [
      el('div', { class: 'stack', style: 'gap:4px' }, [
        el('p', { class: 'muted', style: 'margin:0' }, `참가자 ${m.rows.length}명 · ${weeks}회차`),
        el('div', { style: 'font-family:var(--font-display,inherit); font-size:32px; font-weight:700; line-height:1' },
          [el('span', { class: 'tnum' }, String(pct)), '%']),
        el('p', { class: 'muted', style: 'margin:0' }, [
          '완주 ', el('span', { class: 'tnum' }, `${doneCount}/${m.rows.length}`), '명',
        ]),
      ]),
    ]),
  ]);

  const sorted = sortRows(m.rows, sort);

  const sortBtn = (key, label) => el('button', {
    type: 'button', class: 'btn btn--ghost', style: 'padding:2px 6px; font-size:13px',
    'aria-sort': sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none',
    onclick: () => {
      if (sort.key === key) sort.dir *= -1; else { sort.key = key; sort.dir = 1; }
      if (rerender) rerender();
    },
  }, sort.key === key ? `${label} ${sort.dir === 1 ? '▲' : '▼'}` : label);

  const headCells = [
    el('th', {}, sortBtn('name', '성함')),
    el('th', {}, '휴대폰'),
  ];
  for (let w = 1; w <= weeks; w++) {
    headCells.push(el('th', { class: 'center tnum', style: 'min-width:44px' }, String(w)));
  }
  headCells.push(el('th', { class: 'center' }, sortBtn('submitted', '제출수')));
  headCells.push(el('th', { class: 'center' }, '완주'));

  const body = sorted.map((r) => {
    const tds = [
      el('td', {}, r.name || ''),
      el('td', { class: 'tnum muted' }, r.phone || ''),
    ];
    r.cells.forEach((ok, i) => {
      tds.push(el('td', {
        class: 'center', style: 'min-width:44px; height:44px',
        'aria-label': `${i + 1}회차 ${ok ? '제출' : '미제출'}`,
        title: `${i + 1}회차 ${ok ? '제출' : '미제출'}`,
      }, ok
        ? el('span', { class: 'badge badge--ok' }, '제출')
        : el('span', { class: 'badge badge--danger' }, '미제출')));
    });
    tds.push(el('td', { class: 'center tnum' }, `${r.submitted}/${weeks}`));
    tds.push(el('td', { class: 'center' }, r.done
      ? el('span', { class: 'badge badge--accent' }, '완주')
      : el('span', { class: 'muted' }, '—')));
    return el('tr', {}, tds);
  });

  const footCells = [
    el('td', { class: 'muted' }, '회차 제출'),
    el('td', {}, ''),
  ];
  (m.weekTotals || []).forEach((n) => {
    footCells.push(el('td', { class: 'center tnum' }, String(n)));
  });
  footCells.push(el('td', { class: 'center tnum' }, String(m.rows.reduce((a, r) => a + r.submitted, 0))));
  footCells.push(el('td', {}, ''));

  const table = el('table', { class: 'table' }, [
    el('thead', {}, el('tr', {}, headCells)),
    el('tbody', {}, body),
    el('tfoot', {}, el('tr', {}, footCells)),
  ]);

  container.replaceChildren(summary, el('div', { class: 'card', style: 'overflow-x:auto' }, [table]));
}

function sortRows(rows, sort) {
  const out = rows.slice();
  out.sort((a, b) => {
    if (sort.key === 'submitted') return (a.submitted - b.submitted) * sort.dir;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ko') * sort.dir;
  });
  return out;
}
