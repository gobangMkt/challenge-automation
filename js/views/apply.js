import { el, toast, mount } from '../ui.js';
import { apiPost, isConfigured } from '../api.js';
import { validateApplication } from '../lib/application.js';

const FIELDS = [
  { key: 'name', label: '성함', type: 'text', hint: '띄어쓰기 없이 입력해 주세요.', placeholder: '예) 김고방', inputmode: 'text', autocomplete: 'name' },
  { key: 'phone', label: '휴대폰 번호', type: 'tel', hint: '결과·리워드 안내를 받을 번호예요.', placeholder: '010-0000-0000', inputmode: 'numeric', autocomplete: 'tel' },
  { key: 'blogUrl', label: '참가할 블로그 URL', type: 'url', hint: '본인 명의 블로그 1개 (도배·어뷰징 불가).', placeholder: 'https://blog.naver.com/...', inputmode: 'url', autocomplete: 'url' },
];

export function renderApply(challengeId) {
  const errs = {};

  const fieldNodes = FIELDS.map((f, i) => {
    const input = el('input', {
      class: 'input', id: `f-${f.key}`, type: f.type, placeholder: f.placeholder,
      inputmode: f.inputmode, autocomplete: f.autocomplete,
      'aria-describedby': `e-${f.key}`,
    });
    const errNode = el('div', { class: 'err', id: `e-${f.key}`, role: 'alert' });
    return el('div', { class: `field rise rise-${Math.min(i + 1, 3)}` }, [
      el('label', { for: `f-${f.key}` }, [f.label, el('span', { class: 'req' }, ' *')]),
      input,
      el('div', { class: 'hint' }, f.hint),
      errNode,
    ]);
  });

  const agree = el('input', { type: 'checkbox', id: 'f-agree' });
  const agreeRow = el('div', { class: 'field rise rise-3' }, [
    el('div', { class: 'check' }, [
      agree,
      el('label', { for: 'f-agree' },
        '성명·휴대폰 번호 수집 및 이벤트 종료 시까지 보유에 동의합니다. (필수)'),
    ]),
    el('div', { class: 'err', id: 'e-agree', role: 'alert' }),
  ]);

  const submitBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '신청하기');

  function readInput() {
    return {
      name: document.getElementById('f-name').value,
      phone: document.getElementById('f-phone').value,
      blogUrl: document.getElementById('f-blogUrl').value,
      agree: agree.checked,
    };
  }

  function showErrors(errors) {
    ['name', 'phone', 'blogUrl', 'agree'].forEach((k) => {
      const e = document.getElementById(`e-${k}`);
      const input = document.getElementById(`f-${k}`);
      e.textContent = errors[k] || '';
      if (input && input.setAttribute) input.setAttribute('aria-invalid', errors[k] ? 'true' : 'false');
    });
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const input = readInput();
    const v = validateApplication(input, {});
    showErrors(v.errors);
    if (!v.ok) {
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    if (!isConfigured()) {
      toast('서버 연결 전입니다(GAS 배포 후 사용).', 'danger');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '신청 중…';
    try {
      const res = await apiPost({ action: 'apply', challengeId, ...input });
      if (res.ok) { renderDone(input.name); return; }
      showErrors(res.errors || {});
      toast(res.error === 'challenge_required' ? '잘못된 접근입니다.' : '신청에 실패했어요.', 'danger');
    } catch (err) {
      toast('네트워크 오류. 잠시 후 다시 시도해 주세요.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '신청하기';
    }
  }

  const form = el('form', { class: 'card stack', novalidate: true, onsubmit: onSubmit },
    [...fieldNodes, agreeRow, submitBtn]);

  const hero = el('header', { class: 'hero rise rise-1' }, [
    el('span', { class: 'eyebrow' }, '블로그로 스펙 쌓기'),
    el('h1', {}, ['10주 블로그 챌린지 ', el('span', { class: 'star' }, '★')]),
    el('p', { class: 'lead' },
      '자격증 말고 블로그로. SEO 실무를 배우고 매주 실습하면 활동비를 드려요.'),
  ]);

  mount(el('div', {}, [hero, form]));
}

function renderDone(name) {
  mount(el('div', { class: 'card done rise rise-1' }, [
    el('div', { class: 'mark star' }, '★'),
    el('h1', { style: 'margin-top:8px' }, '신청 완료!'),
    el('p', { class: 'muted', style: 'margin-top:8px' },
      `${name}님, 신청이 접수됐어요. 선발 결과는 안내드릴게요.`),
  ]));
}
