import { el, toast, mount } from '../ui.js';
import { apiPost, isConfigured } from '../api.js';
import { validateSettings, buildEmptyMissions, SETUP_STATUS_VALUES } from '../lib/setup.js';

const TOKEN_KEY = 'bc_operator_token';

const BASIC_FIELDS = [
  { key: 'name', label: '챌린지명', type: 'text', placeholder: '예) 취준 블로그 마스터즈', col: 2 },
  { key: 'totalRounds', label: '총회차', type: 'number', placeholder: '10', inputmode: 'numeric' },
  { key: 'status', label: '상태', type: 'select', options: SETUP_STATUS_VALUES },
  { key: '모집시작', label: '모집 시작', type: 'date' },
  { key: '모집마감', label: '모집 마감', type: 'date' },
  { key: '발표일', label: '발표일', type: 'date' },
  { key: '시작일', label: '시작일(1회차)', type: 'date' },
  { key: '오픈요일', label: '오픈 요일', type: 'text', placeholder: '예) 화' },
  { key: '마감요일', label: '마감 요일', type: 'text', placeholder: '예) 월' },
  { key: 'rewardPerPost', label: '제출당 활동비(원)', type: 'number', placeholder: '5000', inputmode: 'numeric' },
  { key: 'excellentMultiplier', label: '우수활동 배수', type: 'number', placeholder: '2', inputmode: 'numeric' },
  { key: 'openchatUrl', label: '문의 오픈카톡 URL', type: 'url', placeholder: 'https://open.kakao.com/...', col: 2 },
  { key: 'notionDbId', label: '노션 DB ID(아티클 소스)', type: 'text', col: 2 },
  { key: 'notionFilterType', label: '노션 필터값', type: 'text', placeholder: '혼잘주거' },
];

export function renderAdminSetup(challengeId) {
  const saved = sessionStorage.getItem(TOKEN_KEY) || '';
  let rounds = 10;
  let missionState = buildEmptyMissions('', rounds);
  let currentChallengeId = challengeId || '';

  const tokenInput = el('input', {
    class: 'input', id: 'f-token', type: 'password', placeholder: '운영자 토큰',
    autocomplete: 'off', value: saved,
  });

  const inputs = {};
  const fieldNodes = BASIC_FIELDS.map((f) => {
    let control;
    if (f.type === 'select') {
      control = el('select', { class: 'input', id: `s-${f.key}` },
        f.options.map((o) => el('option', { value: o }, o)));
    } else {
      control = el('input', {
        class: 'input', id: `s-${f.key}`, type: f.type,
        placeholder: f.placeholder || '', inputmode: f.inputmode || null,
      });
    }
    inputs[f.key] = control;
    const errNode = el('div', { class: 'err', id: `e-${f.key}`, role: 'alert' });
    return el('div', { class: 'field', style: f.col === 2 ? 'grid-column:1/-1' : '' }, [
      el('label', { for: `s-${f.key}` }, f.label),
      control,
      errNode,
    ]);
  });
  inputs.totalRounds.value = String(rounds);
  inputs.excellentMultiplier.value = '2';

  const grid = el('div', { class: 'setup-grid' }, fieldNodes);

  const missionWrap = el('div', { class: 'stack', style: 'margin-top:8px' });
  function renderMissions() {
    const cards = missionState.map((m, i) => el('div', { class: 'mission-row' }, [
      el('div', { class: 'mission-no' }, [
        el('span', { class: 'badge badge--accent' }, `${m.round}회차`),
      ]),
      el('div', { class: 'mission-body' }, [
        el('input', {
          class: 'input', placeholder: '미션 제목', value: m.title,
          onchange: (e) => { missionState[i].title = e.target.value; },
        }),
        el('textarea', {
          class: 'input ta', placeholder: '미션 본문(이번주 안내문)', rows: 2,
          onchange: (e) => { missionState[i].body = e.target.value; },
        }, m.body || ''),
        el('div', { class: 'mission-article' }, [
          el('input', {
            class: 'input', placeholder: '참고 아티클 제목', value: m.articleName,
            onchange: (e) => { missionState[i].articleName = e.target.value; },
          }),
          el('input', {
            class: 'input', type: 'url', placeholder: '아티클 URL(비우면 자동 배정)', value: m.articleUrl,
            onchange: (e) => { missionState[i].articleUrl = e.target.value; },
          }),
        ]),
      ]),
    ]));
    missionWrap.replaceChildren(...cards);
  }

  function syncMissionCount() {
    const n = Math.max(1, Math.floor(Number(inputs.totalRounds.value)) || 10);
    if (n === rounds) return;
    const next = buildEmptyMissions(currentChallengeId, n);
    for (let i = 0; i < Math.min(n, missionState.length); i += 1) next[i] = { ...next[i], ...missionState[i], round: i + 1 };
    rounds = n;
    missionState = next;
    renderMissions();
  }
  inputs.totalRounds.addEventListener('change', syncMissionCount);

  function readBasic() {
    const out = {};
    BASIC_FIELDS.forEach((f) => { out[f.key] = inputs[f.key].value; });
    return out;
  }
  function showErrors(errors) {
    BASIC_FIELDS.forEach((f) => {
      const e = document.getElementById(`e-${f.key}`);
      if (e) e.textContent = errors[f.key] || '';
      if (inputs[f.key].setAttribute) inputs[f.key].setAttribute('aria-invalid', errors[f.key] ? 'true' : 'false');
    });
  }

  const linkBox = el('div', { class: 'link-box', style: 'display:none' });
  function showLink(cid) {
    currentChallengeId = cid;
    const url = `${location.origin}${location.pathname}?c=${encodeURIComponent(cid)}`;
    linkBox.style.display = '';
    linkBox.replaceChildren(
      el('p', { class: 'muted', style: 'margin:0 0 6px' }, '참가자 신청 링크'),
      el('div', { class: 'row-between' }, [
        el('code', { class: 'link-url' }, url),
        el('button', {
          class: 'btn btn--ghost', type: 'button',
          onclick: () => { navigator.clipboard?.writeText(url); toast('링크를 복사했어요.'); },
        }, '복사'),
      ]),
      el('p', { class: 'hint', style: 'margin-top:6px' }, `challengeId: ${cid}`),
    );
  }

  async function call(action, extra) {
    const token = tokenInput.value.trim();
    if (!token) { toast('운영자 토큰을 입력해 주세요.', 'danger'); return null; }
    if (!isConfigured()) { toast('서버 연결 전입니다(GAS 배포 후).', 'danger'); return null; }
    sessionStorage.setItem(TOKEN_KEY, token);
    const res = await apiPost({ action, token, ...extra });
    if (!res.ok && res.error === 'forbidden') toast('토큰이 올바르지 않습니다.', 'danger');
    return res;
  }

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'submit' },
    challengeId ? '설정 저장' : '챌린지 생성');
  const missionBtn = el('button', { class: 'btn btn--ghost', type: 'button' }, '회차 미션 저장');

  async function onSave(ev) {
    ev.preventDefault();
    const basic = readBasic();
    const v = validateSettings(basic);
    showErrors(v.errors);
    if (!v.ok) { const f = document.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }
    saveBtn.disabled = true; saveBtn.textContent = '저장 중…';
    try {
      const action = currentChallengeId ? 'saveSettings' : 'createChallenge';
      const extra = currentChallengeId ? { challengeId: currentChallengeId, ...basic } : basic;
      const res = await call(action, extra);
      if (res && res.ok) {
        showLink(res.challengeId || currentChallengeId);
        toast(action === 'createChallenge' ? '챌린지를 생성했어요.' : '설정을 저장했어요.');
        if (action === 'createChallenge') saveBtn.textContent = '설정 저장';
      } else if (res && res.errors) {
        showErrors(res.errors);
      } else if (res) {
        toast('저장에 실패했어요.', 'danger');
      }
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      saveBtn.disabled = false;
      if (saveBtn.textContent === '저장 중…') saveBtn.textContent = currentChallengeId ? '설정 저장' : '챌린지 생성';
    }
  }

  async function onSaveMissions() {
    if (!currentChallengeId) { toast('먼저 챌린지를 생성해 주세요.', 'danger'); return; }
    missionBtn.disabled = true; missionBtn.textContent = '저장 중…';
    try {
      const res = await call('saveMissions', {
        challengeId: currentChallengeId, totalRounds: rounds, missions: missionState,
      });
      if (res && res.ok) toast('회차 미션을 저장했어요.');
      else if (res) toast('미션 저장에 실패했어요.', 'danger');
    } catch (err) {
      toast('네트워크 오류.', 'danger');
    } finally {
      missionBtn.disabled = false; missionBtn.textContent = '회차 미션 저장';
    }
  }
  missionBtn.addEventListener('click', onSaveMissions);

  const form = el('form', { class: 'card stack', novalidate: true, onsubmit: onSave }, [
    el('div', { class: 'row-between' }, [
      el('h1', { style: 'font-size:22px' }, challengeId ? '챌린지 설정' : '새 챌린지 생성'),
      el('span', { class: 'badge badge--accent' }, challengeId || '신규'),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'f-token' }, '운영자 인증'),
      tokenInput,
    ]),
    grid,
    saveBtn,
    linkBox,
  ]);

  const missionCard = el('div', { class: 'card stack', style: 'margin-top:16px' }, [
    el('div', { class: 'row-between' }, [
      el('h2', { style: 'font-size:18px' }, '회차 미션 편집'),
      missionBtn,
    ]),
    el('p', { class: 'hint', style: 'margin:0' },
      '아티클 URL을 비우면 회차 오픈 시 노션 최신순으로 자동 배정됩니다.'),
    missionWrap,
  ]);

  renderMissions();
  if (challengeId) showLink(challengeId);

  mount(el('div', { class: 'wrap--wide rise rise-1', style: 'max-width:920px' }, [form, missionCard]));
}
