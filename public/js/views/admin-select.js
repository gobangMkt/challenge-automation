import { el, toast, mount } from '../ui.js';
import { apiGet, apiPost, isConfigured } from '../api.js';
import { countByStatus } from '../lib/select.js';

const TOKEN_KEY = 'bc_operator_token';

const STATUS_BADGE = {
  applied: { cls: 'badge', label: '신청' },
  selected: { cls: 'badge badge--ok', label: '선발' },
  rejected: { cls: 'badge badge--danger', label: '탈락' },
};

export function renderAdminSelect(challengeId) {
  const saved = sessionStorage.getItem(TOKEN_KEY) || '';
  const tokenInput = el('input', {
    class: 'input', id: 'sel-token', type: 'password', placeholder: '운영자 토큰',
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
      renderPicker(result, res.rows || [], token, challengeId, load);
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '명단 불러오기';
    }
  }

  const panel = el('form', { class: 'card', onsubmit: load }, [
    el('div', { class: 'row-between' }, [
      el('h1', { style: 'font-size:22px' }, '선발 처리'),
      el('span', { class: 'badge badge--accent' }, challengeId || '전체'),
    ]),
    el('p', { class: 'muted', style: 'margin:8px 0 0' },
      '신청자를 선택해 선발/탈락을 확정합니다. 선발 알림톡은 추후 자동 발송됩니다.'),
    el('div', { class: 'field', style: 'margin-top:16px' }, [
      el('label', { for: 'sel-token' }, '운영자 인증'),
      el('div', { style: 'display:flex; gap:8px' }, [tokenInput, loadBtn]),
    ]),
  ]);

  mount(el('div', { class: 'wrap--wide rise rise-1', style: 'max-width:1000px' }, [panel, result]));
  if (saved) load();
}

function renderPicker(container, rows, token, challengeId, reload) {
  if (!rows.length) {
    container.replaceChildren(el('div', { class: 'card center muted' }, '아직 신청자가 없습니다.'));
    return;
  }

  const counts = countByStatus(rows);
  const checks = new Map();

  const head = el('tr', {}, [
    el('th', { style: 'width:36px' }, selectAllBox(rows, checks)),
    ...['성함', '휴대폰', '블로그', '상태'].map((h) => el('th', {}, h)),
  ]);

  const body = rows.map((r) => {
    const status = r.status || 'applied';
    const box = el('input', {
      type: 'checkbox', class: 'sel-row', 'aria-label': `${r.name || ''} 선택`,
      'data-phone': r.phone || '',
    });
    checks.set(r.phone || '', box);
    const b = STATUS_BADGE[status] || STATUS_BADGE.applied;
    return el('tr', {}, [
      el('td', {}, box),
      el('td', {}, r.name || ''),
      el('td', { class: 'tnum' }, r.phone || ''),
      el('td', {}, r.blogUrl
        ? el('a', { href: r.blogUrl, target: '_blank', rel: 'noopener' }, '열기') : ''),
      el('td', {}, el('span', { class: b.cls }, b.label)),
    ]);
  });

  const table = el('table', { class: 'table' }, [
    el('thead', {}, head), el('tbody', {}, body),
  ]);

  function pickedPhones() {
    return [...checks.entries()].filter(([, box]) => box.checked).map(([phone]) => phone);
  }

  async function decide(decision) {
    const phones = pickedPhones();
    if (!phones.length) { toast('대상 신청자를 선택하세요.', 'danger'); return; }
    const verb = decision === 'selected' ? '선발' : '탈락';
    selBtn.disabled = true; rejBtn.disabled = true;
    try {
      const res = await apiPost({
        action: 'select', token, challengeId, phones, decision,
      });
      if (!res.ok) {
        const msg = res.error === 'forbidden'
          ? '토큰이 올바르지 않습니다.'
          : (res.errors && res.errors.announce) || `${verb} 처리 실패.`;
        toast(msg, 'danger');
        return;
      }
      toast(`${res.changed}명 ${verb} 처리 완료.`);
      reload();
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      selBtn.disabled = false; rejBtn.disabled = false;
    }
  }

  const selBtn = el('button', { class: 'btn btn--primary', type: 'button',
    onclick: () => decide('selected') }, '선발 확정');
  const rejBtn = el('button', { class: 'btn', type: 'button',
    onclick: () => decide('rejected') }, '탈락 처리');

  const summary = el('div', { class: 'row-between', style: 'margin:0 0 12px; flex-wrap:wrap; gap:8px' }, [
    el('p', { class: 'muted', style: 'margin:0' },
      `총 ${rows.length}명 · 신청 ${counts.applied} · 선발 ${counts.selected} · 탈락 ${counts.rejected}`),
    el('div', { style: 'display:flex; gap:8px' }, [rejBtn, selBtn]),
  ]);

  container.replaceChildren(el('div', { class: 'card' }, [summary, table]));
}

function selectAllBox(rows, checks) {
  const all = el('input', { type: 'checkbox', 'aria-label': '전체 선택' });
  all.addEventListener('change', () => {
    checks.forEach((box) => { box.checked = all.checked; });
  });
  return all;
}
