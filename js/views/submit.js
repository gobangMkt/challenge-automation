import { el, toast, mount } from '../ui.js';
import { apiPost, apiGet, isConfigured } from '../api.js';
import { validatePostUrl } from '../lib/submission.js';
import { normalizePhone } from '../lib/application.js';

export function renderSubmit(challengeId) {
  const phoneInput = el('input', {
    class: 'input', id: 's-phone', type: 'tel', placeholder: '010-0000-0000',
    inputmode: 'numeric', autocomplete: 'tel', 'aria-describedby': 's-phone-err',
  });
  const phoneErr = el('div', { class: 'err', id: 's-phone-err', role: 'alert' });
  const idBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, '내 현황 확인');
  const panel = el('div', { class: 'stack', style: 'margin-top:16px' });

  async function identify(ev) {
    if (ev) ev.preventDefault();
    phoneErr.textContent = '';
    const phone = phoneInput.value.trim();
    if (!normalizePhone(phone)) {
      phoneErr.textContent = '올바른 휴대폰 번호(010-0000-0000)를 입력하세요.';
      phoneInput.setAttribute('aria-invalid', 'true');
      return;
    }
    phoneInput.setAttribute('aria-invalid', 'false');
    if (!isConfigured()) { toast('서버 연결 전입니다(GAS 배포 후).', 'danger'); return; }
    idBtn.disabled = true; idBtn.textContent = '확인 중…';
    try {
      const res = await apiGet({ action: 'myStatus', challengeId, phone });
      if (!res.ok) {
        panel.replaceChildren(errorCard(res.error));
        return;
      }
      renderStatus(panel, challengeId, phone, res);
    } catch (err) {
      toast('네트워크 오류. 잠시 후 다시 시도해 주세요.', 'danger');
    } finally {
      idBtn.disabled = false; idBtn.textContent = '내 현황 확인';
    }
  }

  const form = el('form', { class: 'card', onsubmit: identify }, [
    el('div', { class: 'field' }, [
      el('label', { for: 's-phone' }, ['휴대폰 번호로 본인 확인', el('span', { class: 'req' }, ' *')]),
      el('div', { style: 'display:flex; gap:8px' }, [phoneInput, idBtn]),
      el('div', { class: 'hint' }, '신청 때 입력한 번호로 회차 미션과 제출 현황을 확인해요.'),
      phoneErr,
    ]),
  ]);

  const hero = el('header', { class: 'hero rise rise-1' }, [
    el('span', { class: 'eyebrow' }, '이번주 실습 제출'),
    el('h1', {}, ['주차 미션 제출 ', el('span', { class: 'star' }, '★')]),
    el('p', { class: 'lead' }, '이번주 작성한 게시물 URL을 제출하고 진행 현황을 확인하세요.'),
  ]);

  mount(el('div', { class: 'rise rise-1' }, [hero, form, panel]));
}

function errorCard(code) {
  const msg = {
    not_found: '신청 내역을 찾을 수 없어요. 신청 때 쓴 번호가 맞는지 확인해 주세요.',
    not_selected: '아직 선발 대상이 아니에요. 선발 결과 안내를 기다려 주세요.',
    invalid_phone: '올바른 휴대폰 번호를 입력해 주세요.',
    challenge_required: '잘못된 접근입니다.',
  }[code] || '확인에 실패했어요.';
  return el('div', { class: 'card center muted' }, msg);
}

function renderStatus(container, challengeId, phone, data) {
  const { name, progress, current } = data;
  const children = [];

  children.push(progressCard(name, progress));

  if (current) {
    children.push(missionCard(current));
    children.push(submitCard(challengeId, phone, current));
  } else {
    children.push(el('div', { class: 'card center muted' },
      '현재 오픈된 회차가 없어요. 회차가 열리면 안내드릴게요.'));
  }

  container.replaceChildren(el('div', { class: 'stack' }, children));
}

function progressCard(name, progress) {
  const total = progress.total || 0;
  const done = progress.done || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const badges = [];
  for (let w = 1; w <= total; w += 1) {
    const ok = !!progress.byWeek[w];
    badges.push(el('span', {
      class: `week-dot${ok ? ' week-dot--done' : ''}`,
      title: `${w}회차 ${ok ? '제출완료' : '미제출'}`,
    }, String(w)));
  }

  return el('div', { class: 'card' }, [
    el('div', { class: 'row-between' }, [
      el('h2', { style: 'font-size:20px' }, name ? `${name}님 진행 현황` : '진행 현황'),
      el('span', { class: 'badge badge--accent' }, `${done} / ${total}`),
    ]),
    el('div', { class: 'progress', style: 'margin-top:14px' }, [
      el('div', { class: 'progress__bar', style: `width:${pct}%` }),
    ]),
    el('div', { class: 'week-dots', style: 'margin-top:14px' }, badges),
  ]);
}

function missionCard(current) {
  const rows = [
    el('div', { class: 'row-between' }, [
      el('h2', { style: 'font-size:20px' }, `${current.week}회차 미션`),
      el('span', { class: 'badge badge--accent' }, '오픈'),
    ]),
  ];
  if (current.title) rows.push(el('p', { style: 'font-weight:700; margin:12px 0 0' }, current.title));
  if (current.body) rows.push(el('p', { class: 'muted', style: 'margin:8px 0 0; white-space:pre-wrap' }, current.body));
  if (current.articleUrl) {
    rows.push(el('div', { style: 'margin-top:14px' }, [
      el('span', { class: 'hint' }, '참고 아티클'),
      el('div', { style: 'margin-top:4px' }, [
        el('a', { href: current.articleUrl, target: '_blank', rel: 'noopener', style: 'font-weight:600' },
          current.articleName || current.articleUrl),
      ]),
    ]));
  }
  return el('div', { class: 'card' }, rows);
}

function submitCard(challengeId, phone, current) {
  const urlInput = el('input', {
    class: 'input', id: 's-url', type: 'url', placeholder: 'https://blog.naver.com/...',
    inputmode: 'url', autocomplete: 'url', 'aria-describedby': 's-url-err',
    value: current.submittedUrl || '',
  });
  const urlErr = el('div', { class: 'err', id: 's-url-err', role: 'alert' });
  const btn = el('button', { class: 'btn btn--primary', type: 'submit' },
    current.submitted ? '제출 수정하기' : '제출하기');

  const note = current.submitted
    ? el('div', { class: 'badge badge--ok', style: 'margin-bottom:8px' }, '이미 제출함 (수정 가능)')
    : null;

  async function onSubmit(ev) {
    ev.preventDefault();
    urlErr.textContent = '';
    const url = urlInput.value.trim();
    if (!validatePostUrl(url)) {
      urlErr.textContent = 'http(s)로 시작하는 게시물 URL을 입력하세요.';
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return;
    }
    urlInput.setAttribute('aria-invalid', 'false');
    btn.disabled = true; btn.textContent = '제출 중…';
    try {
      const res = await apiPost({ action: 'submit', challengeId, phone, postUrl: url });
      if (res.ok) {
        toast(res.updated ? '제출을 수정했어요.' : '제출 완료!');
        current.submitted = true;
        current.submittedUrl = url;
        btn.textContent = '제출 수정하기';
        if (!note) {
          form.prepend(el('div', { class: 'badge badge--ok', style: 'margin-bottom:8px' }, '제출 완료'));
        }
        return;
      }
      const m = {
        no_open_week: '현재 오픈된 회차가 없어요.',
        not_selected: '선발 대상이 아니에요.',
        not_found: '신청 내역을 찾을 수 없어요.',
        invalid_url: 'URL 형식을 확인해 주세요.',
      }[res.error] || '제출에 실패했어요.';
      toast(m, 'danger');
    } catch (err) {
      toast('네트워크 오류. 잠시 후 다시 시도해 주세요.', 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  const form = el('form', { class: 'card stack', novalidate: true, onsubmit: onSubmit }, [
    note,
    el('div', { class: 'field' }, [
      el('label', { for: 's-url' }, ['이번주 작성한 게시물 URL', el('span', { class: 'req' }, ' *')]),
      urlInput,
      el('div', { class: 'hint' }, '블로그 채널이 아닌 이번주에 작성한 게시물 주소예요.'),
      urlErr,
    ]),
    btn,
  ]);
  return form;
}
