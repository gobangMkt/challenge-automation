import { el, toast, mount } from '../ui.js';
import { apiPost, isConfigured } from '../api.js';
import { normalizePhone } from '../lib/application.js';

export function renderWrapup(challengeId) {
  const phoneInput = el('input', {
    class: 'input', id: 'w-phone', type: 'tel', placeholder: '010-0000-0000',
    inputmode: 'numeric', autocomplete: 'tel', 'aria-describedby': 'e-phone',
  });
  const blogInput = el('input', {
    class: 'input', id: 'w-blog', type: 'url', placeholder: 'https://blog.naver.com/...',
    inputmode: 'url', autocomplete: 'url', 'aria-describedby': 'e-blog',
  });

  const countSelect = el('select', { class: 'input', id: 'w-count', 'aria-describedby': 'e-count' }, [
    el('option', { value: '' }, '선택하세요'),
    ...Array.from({ length: 11 }, (_, n) => el('option', { value: String(n) }, `${n}개`)),
  ]);

  const excYes = el('input', { type: 'radio', name: 'w-exc', id: 'w-exc-y', value: 'Y' });
  const excNo = el('input', { type: 'radio', name: 'w-exc', id: 'w-exc-n', value: 'N' });
  const excRow = el('div', { class: 'field' }, [
    el('label', {}, ['우수활동자 여부', el('span', { class: 'req' }, ' *')]),
    el('div', { class: 'hint' }, '정확히 입력해 주세요. 우수활동자는 활동비를 2배로 받아요.'),
    el('div', { class: 'choice', role: 'radiogroup', 'aria-label': '우수활동자 여부' }, [
      el('label', { class: 'choice__opt', for: 'w-exc-y' }, [excYes, '예 (Y)']),
      el('label', { class: 'choice__opt', for: 'w-exc-n' }, [excNo, '아니오 (N)']),
    ]),
    el('div', { class: 'err', id: 'e-exc', role: 'alert' }),
  ]);

  const agree = el('input', { type: 'checkbox', id: 'w-agree' });
  const agreeRow = el('div', { class: 'field' }, [
    el('div', { class: 'check' }, [
      agree,
      el('label', { for: 'w-agree' },
        '성명·휴대폰 번호 수집 및 이벤트 종료 시까지 보유에 동의합니다. (필수)'),
    ]),
    el('div', { class: 'err', id: 'e-agree', role: 'alert' }),
  ]);

  const submitBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '마무리 제출하기');

  function field(labelText, input, errId, hint) {
    return el('div', { class: 'field' }, [
      el('label', { for: input.id }, [labelText, el('span', { class: 'req' }, ' *')]),
      input,
      hint ? el('div', { class: 'hint' }, hint) : null,
      el('div', { class: 'err', id: errId, role: 'alert' }),
    ]);
  }

  function setErr(id, msg, input) {
    document.getElementById(id).textContent = msg || '';
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function validate() {
    const errors = {};
    const phone = normalizePhone(phoneInput.value);
    if (!phone) errors.phone = '올바른 휴대폰 번호(010-0000-0000)를 입력하세요.';
    if (countSelect.value === '') errors.count = '작성 갯수를 선택하세요.';
    const exc = excYes.checked ? 'Y' : (excNo.checked ? 'N' : '');
    if (!exc) errors.exc = '우수활동자 여부를 선택하세요.';
    if (!agree.checked) errors.agree = '개인정보 수집·이용에 동의해 주세요.';
    return { errors, phone, exc };
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const { errors, phone, exc } = validate();
    setErr('e-phone', errors.phone, phoneInput);
    setErr('e-count', errors.count, countSelect);
    setErr('e-exc', errors.exc);
    setErr('e-agree', errors.agree);
    if (Object.keys(errors).length) {
      const first = document.querySelector('[aria-invalid="true"], .err:not(:empty)');
      if (first && first.focus) first.focus();
      return;
    }
    if (!isConfigured()) {
      toast('서버 연결 전입니다(GAS 배포 후 사용).', 'danger');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '제출 중…';
    try {
      const res = await apiPost({
        action: 'wrapup',
        challengeId,
        phone,
        blogUrl: blogInput.value.trim(),
        postCount: Number(countSelect.value),
        excellent: exc,
        agree: true,
      });
      if (res.ok) { renderDone(); return; }
      const e = res.errors || {};
      setErr('e-phone', e.phone, phoneInput);
      setErr('e-count', e.postCount, countSelect);
      setErr('e-exc', e.excellent);
      setErr('e-agree', e.agree);
      toast(res.error === 'challenge_required' ? '잘못된 접근입니다.' : '제출에 실패했어요.', 'danger');
    } catch (err) {
      toast('네트워크 오류. 잠시 후 다시 시도해 주세요.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '마무리 제출하기';
    }
  }

  const form = el('form', { class: 'card stack', novalidate: true, onsubmit: onSubmit }, [
    field('리워드를 수령할 휴대폰 번호', phoneInput, 'e-phone', '신청 때 입력한 번호와 같아야 해요.'),
    field('참가한 블로그 URL', blogInput, 'e-blog', '본인 명의 블로그 1개.'),
    field('작성한 블로그 갯수', countSelect, 'e-count', '0개~10개 중에서 정확히 선택하세요.'),
    excRow,
    agreeRow,
    submitBtn,
  ]);

  const hero = el('header', { class: 'hero rise rise-1' }, [
    el('span', { class: 'eyebrow' }, '10주 완주'),
    el('h1', {}, ['챌린지 마무리 ', el('span', { class: 'star' }, '★')]),
    el('p', { class: 'lead' },
      '완주를 축하해요! 작성 갯수와 우수활동자 여부를 정확히 남겨주시면 활동비를 정산해 드려요.'),
  ]);

  mount(el('div', { class: 'wrap' }, [hero, form]));
}

function renderDone() {
  mount(el('div', { class: 'wrap' }, [
    el('div', { class: 'card done rise rise-1' }, [
      el('div', { class: 'mark star' }, '★'),
      el('h1', { style: 'margin-top:8px' }, '제출 완료!'),
      el('p', { class: 'muted', style: 'margin-top:8px' },
        '마무리가 접수됐어요. 활동비 정산 후 안내드릴게요.'),
    ]),
  ]));
}
