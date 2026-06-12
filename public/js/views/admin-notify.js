import { el, toast, mount } from '../ui.js';
import { apiGet, apiPost, isConfigured } from '../api.js';

const TOKEN_KEY = 'bc_operator_token';

const TYPE_LABEL = { open: '오픈', remind: '리마인드', select: '선발', done: '완주' };

export function renderAdminNotify(challengeId) {
  const saved = sessionStorage.getItem(TOKEN_KEY) || '';
  const tokenInput = el('input', {
    class: 'input', id: 'f-token', type: 'password', placeholder: '운영자 토큰',
    autocomplete: 'off', value: saved,
  });
  const loadBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '로그 불러오기');
  const result = el('div', { class: 'stack', style: 'margin-top:16px' });

  async function load(ev) {
    if (ev) ev.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) { toast('토큰을 입력해 주세요.', 'danger'); return; }
    if (!isConfigured()) { toast('서버 연결 전입니다(GAS 배포 후).', 'danger'); return; }
    sessionStorage.setItem(TOKEN_KEY, token);
    loadBtn.disabled = true; loadBtn.textContent = '불러오는 중…';
    try {
      const params = { action: 'notifyLog', token };
      if (challengeId) params.challengeId = challengeId;
      const res = await apiGet(params);
      if (!res.ok) {
        result.replaceChildren(el('p', { class: 'muted' },
          res.error === 'forbidden' ? '토큰이 올바르지 않습니다.' : '불러오기 실패.'));
        return;
      }
      renderTable(result, res.rows || [], token);
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '로그 불러오기';
    }
  }

  const panel = el('form', { class: 'card', onsubmit: load }, [
    el('div', { class: 'row-between' }, [
      el('h1', { style: 'font-size:22px' }, '알림 발송 로그'),
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

function renderTable(container, rows, token) {
  if (!rows.length) {
    container.replaceChildren(el('div', { class: 'card center muted' }, '아직 발송 이력이 없습니다.'));
    return;
  }
  const head = el('tr', {}, ['회차', '유형', '휴대폰', '발송시각', '결과', '재발송']
    .map((h) => el('th', {}, h)));

  const body = rows.map((r) => {
    const failed = !String(r['결과'] || '').startsWith('성공');
    const resendBtn = el('button', {
      class: 'btn btn--ghost', type: 'button', style: 'width:auto; padding:6px 12px',
    }, '재발송');

    resendBtn.addEventListener('click', async () => {
      resendBtn.disabled = true; resendBtn.textContent = '발송 중…';
      try {
        const res = await apiPost({
          action: 'resend', token, challengeId: r.challengeId, week: r['회차'],
          type: r.type, phone: r.phone,
        });
        if (res.ok) toast('재발송했어요.');
        else toast(res.error === 'forbidden' ? '권한이 없습니다.' : `재발송 실패(${res.result || ''})`, 'danger');
      } catch (err) {
        toast('네트워크 오류.', 'danger');
      } finally {
        resendBtn.disabled = false; resendBtn.textContent = '재발송';
      }
    });

    return el('tr', {}, [
      el('td', { class: 'tnum' }, r['회차'] ? String(r['회차']) : '-'),
      el('td', {}, el('span', { class: 'badge badge--accent' }, TYPE_LABEL[r.type] || r.type || '')),
      el('td', { class: 'tnum' }, r.phone || ''),
      el('td', { class: 'muted' }, fmtDateTime(r['발송시각'])),
      el('td', {}, el('span', {
        class: `badge ${failed ? 'badge--danger' : 'badge--ok'}`,
      }, r['결과'] || '')),
      el('td', {}, resendBtn),
    ]);
  });

  const table = el('table', { class: 'table' }, [el('thead', {}, head), el('tbody', {}, body)]);
  container.replaceChildren(
    el('div', { class: 'card' }, [
      el('p', { class: 'muted', style: 'margin:0 0 12px' }, `총 ${rows.length}건 (최신순)`),
      table,
    ]),
  );
}

function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 16);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
