import { submitVoc, VOC_CATEGORIES } from './voc-sdk.js';

/**
 * VoC 신고 모달 열기.
 * @param {object} opts
 * @param {function} opts.toast      - toast(msg, isError) 함수 (서비스 측 제공)
 * @param {string}  [opts.icon]      - 모달 헤더 아이콘 HTML (기본 텍스트 아이콘)
 * @param {string}  [opts.channel]   - VoC 채널 (기본 'app')
 */
export function openVocModal({ toast, icon = '📣', channel = 'app' } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="voc-title">
      <div class="modal__icon modal__icon--primary">${icon}</div>
      <h3 class="modal__title" id="voc-title">버그·개선 신고</h3>
      <p class="modal__msg">불편하거나 고쳤으면 하는 점을 적어주세요. 개선 파이프라인으로 바로 접수됩니다.</p>
      <div class="rp-cats" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
        ${VOC_CATEGORIES.map((c, i) =>
          `<button type="button" class="rp-cat${i === 0 ? ' is-active' : ''}" data-cat="${c}">${c}</button>`
        ).join('')}
      </div>
      <textarea id="voc-msg" class="input" rows="4"
        placeholder="예: 명단에서 선발 토글이 가끔 안 먹어요 / 정산표에 합계가 있으면 좋겠어요"
        style="margin-top:10px;resize:vertical"></textarea>
      <div class="modal__actions">
        <button class="btn btn--secondary" data-act="cancel" type="button">취소</button>
        <button class="btn btn--primary" data-act="ok" type="button">접수</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('is-show'));
  document.getElementById('voc-msg').focus();

  let category = VOC_CATEGORIES[0];
  back.querySelectorAll('.rp-cat').forEach((b) => b.addEventListener('click', () => {
    category = b.dataset.cat;
    back.querySelectorAll('.rp-cat').forEach((x) => x.classList.toggle('is-active', x === b));
  }));

  const close = () => { back.classList.remove('is-show'); setTimeout(() => back.remove(), 200); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelector('[data-act=cancel]').addEventListener('click', close);
  back.querySelector('[data-act=ok]').addEventListener('click', async () => {
    const message = document.getElementById('voc-msg').value.trim();
    if (!message) { toast?.('내용을 입력하세요.', true); return; }
    const btn = back.querySelector('[data-act=ok]');
    btn.disabled = true;
    const r = await submitVoc({ message, category, channel }).catch(() => ({ ok: false }));
    if (r.ok) { close(); toast?.('신고가 접수되었습니다. 감사합니다!'); }
    else { btn.disabled = false; toast?.('접수 실패. 잠시 후 다시 시도하세요.', true); }
  });
}
