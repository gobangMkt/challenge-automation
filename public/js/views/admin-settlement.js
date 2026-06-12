import { el, toast, mount } from '../ui.js';
import { apiGet, isConfigured } from '../api.js';
import { toCsv } from '../lib/settlement.js';

const TOKEN_KEY = 'bc_operator_token';

export function renderAdminSettlement(challengeId) {
  const saved = sessionStorage.getItem(TOKEN_KEY) || '';
  const tokenInput = el('input', {
    class: 'input', id: 'f-token', type: 'password', placeholder: '운영자 토큰',
    autocomplete: 'off', value: saved,
  });
  const loadBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '정산표 불러오기');
  const result = el('div', { class: 'stack', style: 'margin-top:16px' });

  async function load(ev) {
    if (ev) ev.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) { toast('토큰을 입력해 주세요.', 'danger'); return; }
    if (!challengeId) { toast('챌린지가 지정되지 않았습니다.', 'danger'); return; }
    if (!isConfigured()) { toast('서버 연결 전입니다(GAS 배포 후).', 'danger'); return; }
    sessionStorage.setItem(TOKEN_KEY, token);
    loadBtn.disabled = true; loadBtn.textContent = '불러오는 중…';
    try {
      const res = await apiGet({ action: 'settlement', token, challengeId });
      if (!res.ok) {
        result.replaceChildren(el('div', { class: 'card muted' },
          res.error === 'forbidden' ? '토큰이 올바르지 않습니다.' : '불러오기 실패.'));
        return;
      }
      renderTable(result, res.rows || [], res.total || 0, res.policy || {});
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '정산표 불러오기';
    }
  }

  const panel = el('form', { class: 'card', onsubmit: load }, [
    el('div', { class: 'row-between' }, [
      el('h1', { style: 'font-size:22px' }, '결과 · 정산'),
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

function renderTable(container, rows, total, policy) {
  if (!rows.length) {
    container.replaceChildren(el('div', { class: 'card center muted' }, '정산할 참가자가 없습니다.'));
    return;
  }

  const head = el('tr', {}, ['#', '성함', '휴대폰', '제출수', '우수활동자', '활동비']
    .map((h) => el('th', {}, h)));
  const body = rows.map((r, i) => el('tr', {}, [
    el('td', { class: 'tnum' }, String(i + 1)),
    el('td', {}, r.name || ''),
    el('td', { class: 'tnum' }, r.phone || ''),
    el('td', { class: 'tnum' }, String(r.submitCount)),
    el('td', {}, r.excellent
      ? el('span', { class: 'badge badge--accent' }, '우수 ★')
      : el('span', { class: 'muted' }, '—')),
    el('td', { class: 'tnum' }, fmtWon(r.amount)),
  ]));
  const foot = el('tr', {}, [
    el('td', { colspan: '5', style: 'font-weight:700' }, '합계'),
    el('td', { class: 'tnum', style: 'font-weight:700' }, fmtWon(total)),
  ]);
  const table = el('table', { class: 'table' }, [
    el('thead', {}, head),
    el('tbody', {}, body),
    el('tfoot', {}, foot),
  ]);

  const csvBtn = el('button', { class: 'btn btn--ghost', type: 'button',
    onclick: () => downloadCsv(rows) }, 'CSV 다운로드');

  container.replaceChildren(
    el('div', { class: 'card' }, [
      el('div', { class: 'row-between', style: 'margin-bottom:12px' }, [
        el('p', { class: 'muted', style: 'margin:0' },
          `총 ${rows.length}명 · 단가 ${fmtWon(policy.rewardPerPost || 0)} · 우수 ${policy.excellentMultiplier || 2}배`),
        csvBtn,
      ]),
      table,
    ]),
  );
}

function downloadCsv(rows) {
  const csv = toCsv(rows);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `정산_${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('CSV를 내려받았어요.');
}

function fmtWon(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('ko-KR')}원`;
}
