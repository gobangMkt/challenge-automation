import { el, mount } from './ui.js';
import { renderApply } from './views/apply.js';
import { renderAdmin } from './views/admin.js';
import { renderAdminSetup } from './views/admin-setup.js';
import { renderAdminSelect } from './views/admin-select.js';
import { renderAdminMatrix } from './views/admin-matrix.js';
import { renderAdminNotify } from './views/admin-notify.js';
import { renderAdminSettlement } from './views/admin-settlement.js';
import { renderSubmit } from './views/submit.js';
import { renderWrapup } from './views/wrapup.js';

// 챌린지 식별은 ?c=<challengeId> (쿼리), 화면은 #/... (해시). 예: ?c=blcamp#/admin/matrix
function route() {
  const params = new URLSearchParams(location.search);
  const challengeId = params.get('c');
  const hash = location.hash;

  if (hash.startsWith('#/admin/setup')) return renderAdminSetup(challengeId);
  if (hash.startsWith('#/admin/select')) return renderAdminSelect(challengeId);
  if (hash.startsWith('#/admin/matrix')) return renderAdminMatrix(challengeId);
  if (hash.startsWith('#/admin/notify')) return renderAdminNotify(challengeId);
  if (hash.startsWith('#/admin/settlement')) return renderAdminSettlement(challengeId);
  if (hash.startsWith('#/admin')) return renderAdmin(challengeId);
  if (hash.startsWith('#/submit')) return renderSubmit(challengeId);
  if (hash.startsWith('#/wrapup')) return renderWrapup(challengeId);
  if (challengeId) return renderApply(challengeId);
  return renderLanding();
}

function renderLanding() {
  const adminLinks = [
    ['설정', '#/admin/setup'], ['명단', '#/admin'], ['선발', '#/admin/select'],
    ['현황', '#/admin/matrix'], ['알림', '#/admin/notify'], ['정산', '#/admin/settlement'],
  ];
  mount(el('div', { class: 'card center rise rise-1', style: 'margin-top:48px' }, [
    el('div', { class: 'mark star', style: 'font-size:40px' }, '★'),
    el('h1', { style: 'margin-top:8px' }, '블로그 챌린지'),
    el('p', { class: 'muted', style: 'margin-top:8px' },
      '신청 링크(?c=챌린지ID)로 접속해 주세요.'),
    el('p', { class: 'muted', style: 'margin-top:16px; font-size:13px' },
      '운영자: ?c=<챌린지ID> 뒤에 ' + adminLinks.map((a) => a[1]).join(' / ') + ' 해시로 접속'),
  ]));
}

window.addEventListener('hashchange', route);
route();
